<template>
  <a-auto-complete
    v-bind="restAttrs"
    :value="state"
    :options="options"
    :placeholder="placeholder"
    :disabled="disabled"
    :not-found-content="notFoundContent"
    :default-active-first-option="false"
    style="width: 100%"
    @search="onSearch"
    @change="onChange"
    @select="onSelect"
  />
</template>

<script lang="ts" setup>
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { useDebounceFn } from '@vueuse/core';
  import { useAttrs } from '/@/hooks/core/useAttrs';
  import { omit } from 'lodash-es';
  import { loadAMap } from '/@/utils/amap';

  /** 高德 POI 规范化对象(选中后回传) */
  export interface AmapPoi {
    name: string;
    address: string;
    lng?: number;
    lat?: number;
    pname?: string;
    cityname?: string;
    adcode?: string;
    type?: string;
    tel?: string;
  }

  const props = defineProps<{
    value?: string;
    placeholder?: string;
    disabled?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'change', value: string): void;
    (e: 'update:value', value: string): void;
    (e: 'select', poi: AmapPoi | null): void;
  }>();

  // 透传其余 attrs 给内部 a-auto-complete(排除内部处理的 value/事件, 避免表单双触发)
  const attrs = useAttrs();
  const restAttrs = computed(() => omit(attrs, ['value', 'onChange', 'onUpdate:value', 'onSelect']));

  const state = ref<string>(props.value ?? '');
  const options = ref<any[]>([]);
  const loading = ref(false);
  const searched = ref(false);
  // 地图服务错误信息(如 INVALID_USER_SCODE / key 无白名单等), 空串表示正常
  const amapError = ref('');
  let placeSearch: any = null;
  let seq = 0;

  // 外部 setFieldsValue / 回显同步
  watch(
    () => props.value,
    (v) => {
      state.value = v ?? '';
    },
    { immediate: true }
  );

  const notFoundContent = computed(() => {
    if (loading.value) return '搜索中…';
    if (amapError.value) return `地图服务未就绪(${amapError.value})，可手动输入`;
    if (searched.value && !options.value.length) return '未找到匹配地点';
    return null;
  });

  // POI → 下拉选项
  function toOption(poi: any) {
    return {
      value: poi.address || poi.name,
      label: `${poi.name}${poi.address ? ' · ' + poi.address : ''}`,
      poi: {
        name: poi.name,
        address: poi.address || '',
        lng: poi.location?.lng,
        lat: poi.location?.lat,
        pname: poi.pname,
        cityname: poi.cityname,
        adcode: poi.adcode,
        type: poi.type,
        tel: poi.tel,
      } as AmapPoi,
    };
  }

  const doSearch = useDebounceFn((keyword: string) => {
    const kw = (keyword || '').trim();
    if (!kw) {
      options.value = [];
      searched.value = false;
      loading.value = false;
      return;
    }
    if (!(window as any).AMap?.PlaceSearch) {
      amapError.value = '插件未加载';
      loading.value = false;
      return;
    }
    // 正常发起搜索时清掉上一次的错误提示
    amapError.value = '';
    const my = ++seq;
    try {
      placeSearch = placeSearch || new (window as any).AMap.PlaceSearch({ pageSize: 10 });
      placeSearch.search(kw, (status: string, result: any) => {
        if (my !== seq) return; // 丢弃过期回调
        loading.value = false;
        searched.value = true;
        if (status === 'complete' && result?.poiList?.pois?.length) {
          options.value = result.poiList.pois.map(toOption);
        } else if (status === 'no_data') {
          options.value = [];
        } else {
          // 高德错误: status 非 complete/no_data 时 result 可能直接是错误码字符串(如 "INVALID_USER_SCODE")
          options.value = [];
          const info = typeof result === 'string' ? result : result?.info || result?.infoTip || '服务不可用';
          amapError.value = info;
        }
      });
    } catch {
      options.value = [];
      loading.value = false;
      amapError.value = '加载异常';
    }
  }, 300);

  function onSearch(keyword: string) {
    loading.value = true;
    doSearch(keyword);
  }

  function onChange(text: string) {
    state.value = text;
    emit('change', text);
    emit('update:value', text);
    if (!text) emit('select', null); // 清空时通知父级清除经纬度
  }

  function onSelect(_value: string, option: any) {
    const poi = option?.poi as AmapPoi;
    if (!poi) return;
    const addr = poi.address || poi.name;
    state.value = addr;
    emit('update:value', addr);
    emit('change', addr);
    emit('select', poi);
  }

  onMounted(() => {
    loadAMap().catch(() => {
      amapError.value = '脚本加载失败';
    });
  });

  onUnmounted(() => {
    // useDebounceFn(v10) 返回的函数无 .cancel 方法, 仅做可选调用, 避免卸载时抛错
    (doSearch as any).cancel?.();
  });
</script>
