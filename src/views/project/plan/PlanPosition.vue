<template>
  <div class="plan-position">
    <!-- 实施位置 -->
    <div class="plan-position__group-title">
      <span>实施位置</span>
      <a-button
        v-if="editable"
        type="primary"
        size="small"
        preIcon="ant-design:plus-outlined"
        :disabled="!canWrite"
        :title="canWrite ? '添加实施位置' : '位置信息加载完成后才能添加'"
        @click="addPosition"
      >
        添加
      </a-button>
    </div>
    <a-table
      :loading="loading"
      :columns="columns"
      :data-source="positionList"
      :row-key="(record) => record._key"
      :pagination="false"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'index'">
          {{ index + 1 }}
        </template>
        <template v-else-if="column.key === 'locationName'">
          <AMapLocationSelect
            :value="record.locationName"
            :lng="record.longitude"
            :lat="record.latitude"
            :disabled="!rowEditable(record)"
            :auto-locate="rowEditable(record) && (record.longitude == null || record.latitude == null)"
            placeholder="点击地图选点"
            @update:value="(v: string) => updateLocationName(record, v)"
            @select="(poi: AmapPoi | null) => onSelectPoi(record, poi)"
          />
        </template>
        <template v-else-if="column.key === 'longitude'">
          <a-input-number v-model:value="record.longitude" :disabled="!rowEditable(record)" placeholder="经度" style="width: 100%" />
        </template>
        <template v-else-if="column.key === 'latitude'">
          <a-input-number v-model:value="record.latitude" :disabled="!rowEditable(record)" placeholder="纬度" style="width: 100%" />
        </template>
        <template v-else-if="column.key === 'description'">
          <a-input v-model:value="record.description" :disabled="!rowEditable(record)" placeholder="位置描述" />
        </template>
        <template v-else-if="column.key === 'action'">
          <template v-if="editable">
            <a-popconfirm title="确认移除该位置？保存本页后生效" @confirm="removePosition(record)">
              <a-button type="link" danger size="small" :disabled="!canWrite">删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue';
  import AMapLocationSelect from '/@/components/jeecg/AMapLocationSelect.vue';
  import type { AmapPoi } from '/@/components/jeecg/AMapPlaceSearch.vue';
  import { getPlanLocations } from './Plan.api';
  import { useMessage } from '/@/hooks/web/useMessage';

  const props = defineProps<{ editable?: boolean; periodId?: string }>();
  const emit = defineEmits<{ 'persisted-change': [persisted: boolean] }>();
  const { createMessage } = useMessage();
  const columns = computed(() => [
    { title: '序号', key: 'index', width: 60 },
    { title: '实施位置', key: 'locationName', width: 280 },
    { title: '经度', key: 'longitude', width: 120 },
    { title: '纬度', key: 'latitude', width: 120 },
    { title: '位置描述', key: 'description' },
    ...(props.editable ? [{ title: '操作', key: 'action', width: 80, align: 'center' }] : []),
  ]);
  const positionList = ref<any[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const loadFailed = ref(false);
  const persistedSnapshot = ref('[]');
  const canWrite = computed(() => !!props.editable && loaded.value && !loading.value && !loadFailed.value);
  const dirty = computed(() => JSON.stringify(positionList.value.map(toPayload)) !== persistedSnapshot.value);
  let positionSeed = 0;
  let loadSequence = 0;

  function rowEditable(_record: any) {
    return canWrite.value;
  }

  function toPayload(item: any) {
    return {
      ...(item.id ? { id: String(item.id) } : {}),
      locationName: String(item.locationName || '').trim(),
      longitude: String(item.longitude ?? ''),
      latitude: String(item.latitude ?? ''),
      description: item.description || '',
    };
  }

  function validateRow(item: any, index: number) {
    if (
      !String(item.locationName || '').trim() ||
      item.longitude == null ||
      item.latitude == null ||
      !Number.isFinite(Number(item.longitude)) ||
      !Number.isFinite(Number(item.latitude))
    ) {
      throw new Error(`第 ${index + 1} 行：请完整填写实施位置及有效经纬度`);
    }
  }

  function updateLocationName(record: any, value: string) {
    if (canWrite.value) record.locationName = value;
  }

  function onSelectPoi(record: any, poi: AmapPoi | null) {
    if (!canWrite.value) return;
    record.locationName = poi?.address || poi?.name || '';
    record.longitude = poi?.lng;
    record.latitude = poi?.lat;
    record.description = poi?.address || poi?.name || '';
  }

  function setLoadedRows(records: any[]) {
    positionSeed = 0;
    positionList.value = records.filter(Boolean).map((item) => ({
      ...item,
      _key: ++positionSeed,
      longitude: item.longitude == null ? undefined : Number(item.longitude),
      latitude: item.latitude == null ? undefined : Number(item.latitude),
    }));
    persistedSnapshot.value = JSON.stringify(positionList.value.map(toPayload));
    emit('persisted-change', positionList.value.length > 0);
  }

  async function loadPositions() {
    const sequence = ++loadSequence;
    const periodId = props.periodId;
    loaded.value = false;
    loadFailed.value = false;
    if (!periodId) return;
    loading.value = true;
    try {
      // 全量保存前必须读齐分页，避免未加载的位置被误删。
      const records: any[] = [];
      let pageNo = 1;
      while (true) {
        const result: any = await getPlanLocations({ periodId, pageNo, pageSize: 1000 });
        if (sequence !== loadSequence || periodId !== props.periodId) return;
        const page = Array.isArray(result) ? result : result?.records;
        if (!Array.isArray(page)) throw new Error('位置信息返回格式异常');
        records.push(...page);
        const total = Number(result?.total ?? records.length);
        if (Array.isArray(result) || records.length >= total) break;
        if (!page.length) throw new Error('位置信息未完整加载，请刷新重试');
        pageNo += 1;
      }
      setLoadedRows(records);
      loaded.value = true;
    } catch (error: any) {
      if (sequence === loadSequence) {
        loadFailed.value = true;
        createMessage.warning(error?.message || '位置信息加载失败，请刷新后重试');
      }
    } finally {
      if (sequence === loadSequence) loading.value = false;
    }
  }

  function addPosition() {
    if (!canWrite.value) return;
    positionList.value.push({ _key: ++positionSeed, locationName: '', longitude: undefined, latitude: undefined, description: '' });
  }

  function removePosition(record: any) {
    if (canWrite.value) positionList.value = positionList.value.filter((item) => item._key !== record._key);
  }

  watch(
    () => props.periodId,
    () => {
      positionList.value = [];
      persistedSnapshot.value = '[]';
      loading.value = false;
      void loadPositions();
    },
    { immediate: true }
  );

  defineExpose({
    getData() {
      if (!loaded.value || loading.value || loadFailed.value) throw new Error('位置信息未完整加载，请刷新后再保存');
      positionList.value.forEach(validateRow);
      return positionList.value.map(toPayload);
    },
    setData(list: any[]) {
      loadSequence += 1;
      loading.value = false;
      loaded.value = true;
      loadFailed.value = false;
      setLoadedRows(list || []);
    },
    reload: loadPositions,
    getSubmissionState: () => ({
      loading: loading.value,
      loaded: loaded.value,
      loadFailed: loadFailed.value,
      saving: false,
      dirty: dirty.value,
      sequence: loadSequence,
    }),
  });
</script>

<style lang="less" scoped>
  .plan-position {
    &__group-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 14px;
      color: #333;
      margin-bottom: 12px;
    }
  }
</style>
