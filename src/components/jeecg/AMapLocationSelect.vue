<template>
  <div class="amap-location-select" :class="{ 'amap-location-select--inline': inline }">
    <!-- 只读输入框: 显示当前已确认地址 -->
    <a-input :value="innerValue" :placeholder="placeholder" :disabled="disabled" readonly @click="handleFieldClick">
      <template #prefix>
        <svg class="amap-location-select__pin" width="14" height="18" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M20 2 C 10 2 3 11 3 20 C 3 33 20 50 20 50 C 20 50 37 33 37 20 C 37 11 30 2 20 2 Z"
            fill="#FF4D4F"
            stroke="#CF1322"
            stroke-width="1.5"
          />
          <circle cx="20" cy="20" r="8" fill="#fff" />
        </svg>
      </template>
      <template #suffix>
        <span class="amap-location-select__hint">{{ inline ? (locked ? '点击「修改定位」再调整' : '拖动地图微调') : '地图选点' }}</span>
      </template>
    </a-input>

    <!-- 内联模式: 输入框下方直接显示地图 + 定位 pin + 锁定/修改工具条 -->
    <div v-if="inline" class="amap-location-select__inline">
      <a-form-item-rest>
        <AMapLocationMap
          :lng="mapLng"
          :lat="mapLat"
          :address="mapAddress"
          :height="mapHeight"
          :disabled="disabled || locked"
          @select="onMapSelect"
          @update:lng="(v) => (mapLng = v)"
          @update:lat="(v) => (mapLat = v)"
          @update:address="(v) => (mapAddress = v)"
        />
      </a-form-item-rest>
      <div class="amap-location-select__toolbar">
        <a-button v-if="locked" size="small" type="primary" ghost preIcon="ant-design:edit-outlined" :disabled="disabled" @click="handleUnlock">
          修改定位
        </a-button>
        <template v-else>
          <span class="amap-location-select__tip">拖动地图或搜索调整位置</span>
          <a-button size="small" @click="handleCancelMove">取 消</a-button>
          <a-button size="small" type="primary" @click="handleSaveMove">保 存</a-button>
        </template>
      </div>
    </div>

    <!-- 弹窗选点(非内联模式) -->
    <BasicModal
      v-else
      v-bind="$attrs"
      @register="registerModal"
      :title="modalTitle"
      :width="720"
      destroyOnClose
      :okText="'确定'"
      :cancelText="'取消'"
      @ok="handleConfirm"
    >
      <div class="amap-location-select__map">
        <!-- a-form-item-rest: 阻断外层 Form.Item 收集弹窗内搜索组件，避免 id 冲突/双字段告警 -->
        <a-form-item-rest>
          <AMapLocationMap
            :lng="modalLng"
            :lat="modalLat"
            :address="modalAddress"
            :height="mapHeight"
            @select="onModalSelect"
          />
        </a-form-item-rest>
      </div>
    </BasicModal>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { BasicModal, useModal } from '/@/components/Modal';
  import AMapLocationMap from './AMapLocationMap.vue';
  import type { AmapPoi } from './AMapPlaceSearch.vue';

  const props = withDefaults(
    defineProps<{
      /** 地址文本(与 AMapPlaceSearch 对齐) */
      value?: string;
      /** 经度(回显) */
      lng?: number | null;
      /** 纬度(回显) */
      lat?: number | null;
      placeholder?: string;
      disabled?: boolean;
      /** 地图高度(px) */
      mapHeight?: string;
      /** 内联模式: 地图直接显示在表单里(参考图样式); 默认 false=点击输入框弹窗选点 */
      inline?: boolean;
    }>(),
    {
      lng: null,
      lat: null,
      mapHeight: '320px',
      inline: false,
    }
  );

  const emit = defineEmits<{
    (e: 'change', value: string): void;
    (e: 'update:value', value: string): void;
    (e: 'select', poi: AmapPoi | null): void;
  }>();

  const innerValue = ref<string>(props.value ?? '');
  watch(
    () => props.value,
    (v) => {
      innerValue.value = v ?? '';
    },
    { immediate: true }
  );

  // ===== 内联模式: 锁定/修改定位 =====
  // 已确认位置(表单里存的) vs 地图当前展示位置
  const locked = ref(true);
  const savedPoi = ref<AmapPoi | null>(
    props.lng != null && props.lat != null
      ? { name: props.value ?? '', address: props.value ?? '', lng: props.lng, lat: props.lat }
      : null
  );
  const mapLng = ref<number | null>(props.lng ?? null);
  const mapLat = ref<number | null>(props.lat ?? null);
  const mapAddress = ref<string>(props.value ?? '');
  let draftPoi: AmapPoi | null = savedPoi.value;

  // 外部回显(lng/lat 变化, 如详情回显注入) → 同步地图(仅未处于编辑中时)
  // ⚠️ 只监听 lng/lat, 不监听 value: 保存时组件自身 emit 导致 value 变化, 不能把地图重置回旧值
  watch(
    () => [props.lng, props.lat] as const,
    ([nl, na]) => {
      const next = nl != null && na != null ? { name: props.value ?? '', address: props.value ?? '', lng: nl, lat: na } : null;
      savedPoi.value = next;
      if (locked.value) {
        mapLng.value = nl ?? null;
        mapLat.value = na ?? null;
        mapAddress.value = props.value ?? '';
      }
    }
  );

  /** 地图选点事件(拖动/搜索) */
  function onMapSelect(poi: AmapPoi | null) {
    if (!poi || poi.lng == null || poi.lat == null) return;
    draftPoi = poi;
    // 同步地图展示位置(便于「取消」时还原)
    mapLng.value = poi.lng;
    mapLat.value = poi.lat;
    mapAddress.value = poi.address || poi.name || '';
  }

  /** 解锁: 可拖动/搜索 */
  function handleUnlock() {
    locked.value = false;
    draftPoi = savedPoi.value;
  }

  /** 保存: 确认新位置并回传父级 */
  function handleSaveMove() {
    if (!draftPoi || draftPoi.lng == null || draftPoi.lat == null) return;
    const addr = draftPoi.address || draftPoi.name || '';
    innerValue.value = addr;
    savedPoi.value = draftPoi;
    emit('update:value', addr);
    emit('change', addr);
    emit('select', draftPoi);
    locked.value = true;
  }

  /** 取消: 还原到已确认位置 */
  function handleCancelMove() {
    draftPoi = savedPoi.value;
    mapLng.value = savedPoi.value?.lng ?? null;
    mapLat.value = savedPoi.value?.lat ?? null;
    mapAddress.value = savedPoi.value?.address || savedPoi.value?.name || '';
    locked.value = true;
  }

  // ===== 弹窗模式 =====
  const modalTitle = ref('地图选点');
  const modalLng = ref<number | null>(null);
  const modalLat = ref<number | null>(null);
  const modalAddress = ref('');
  let lastPoi: AmapPoi | null = null;

  const [registerModal, { openModal }] = useModal();

  function handleFieldClick() {
    if (props.disabled || props.inline) return;
    modalLng.value = props.lng ?? null;
    modalLat.value = props.lat ?? null;
    modalAddress.value = props.value ?? '';
    lastPoi =
      props.lng != null && props.lat != null
        ? { name: props.value ?? '', address: props.value ?? '', lng: props.lng, lat: props.lat }
        : null;
    openModal(true);
  }

  function onModalSelect(poi: AmapPoi | null) {
    lastPoi = poi;
    if (poi) {
      modalLng.value = poi.lng ?? null;
      modalLat.value = poi.lat ?? null;
      modalAddress.value = poi.address || poi.name;
    }
  }

  function handleConfirm() {
    if (!lastPoi || lastPoi.lng == null || lastPoi.lat == null) return;
    const addr = lastPoi.address || lastPoi.name || '';
    innerValue.value = addr;
    emit('update:value', addr);
    emit('change', addr);
    emit('select', lastPoi);
  }
</script>

<style lang="less" scoped>
  .amap-location-select {
    width: 100%;

    &__pin {
      display: block;
      margin-top: 1px;
    }

    &__hint {
      color: #ff4d4f;
      font-size: 12px;
      user-select: none;
    }

    &__inline {
      margin-top: 8px;
      border: 1px solid #f0f0f0;
      border-radius: 6px;
      overflow: hidden;
    }

    &__toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #fafafa;
      border-top: 1px solid #f0f0f0;
    }

    &__tip {
      flex: 1;
      color: #999;
      font-size: 12px;
    }

    &__map {
      padding-top: 4px;
    }
  }
</style>
