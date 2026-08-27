<template>
  <div class="plan-position">
    <!-- 实施位置 -->
    <div class="plan-position__group-title">
      <span>实施位置</span>
      <a-button v-if="editable" type="primary" size="small" preIcon="ant-design:plus-outlined" :disabled="rowSaving" @click="addPosition">
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
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'index'">
          {{ record._key }}
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
          <a-input-number
            v-model:value="record.longitude"
            :disabled="!rowEditable(record)"
            placeholder="经度"
            style="width: 100%"
            @change="markDirty(record)"
          />
        </template>
        <template v-else-if="column.key === 'latitude'">
          <a-input-number
            v-model:value="record.latitude"
            :disabled="!rowEditable(record)"
            placeholder="纬度"
            style="width: 100%"
            @change="markDirty(record)"
          />
        </template>
        <template v-else-if="column.key === 'description'">
          <a-input v-model:value="record.description" :disabled="!rowEditable(record)" placeholder="位置描述" @change="markDirty(record)" />
        </template>
        <template v-else-if="column.key === 'action'">
          <template v-if="editable">
            <a-button v-if="record._locked" type="link" size="small" :disabled="rowSaving" @click="unlockRow(record)">修改</a-button>
            <a-button v-else type="link" size="small" :loading="record._saving" :disabled="rowSaving && !record._saving" @click="saveRow(record)">
              保存
            </a-button>
            <a-popconfirm title="确认删除该条位置信息？" @confirm="removePosition(record)">
              <a-button type="link" danger size="small" :disabled="rowSaving">删除</a-button>
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
  import { AmapPoi } from '/@/components/jeecg/AMapPlaceSearch.vue';
  import { editPlanLocationsBatch, getPlanLocations } from './Plan.api';
  import { useMessage } from '/@/hooks/web/useMessage';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑
  const props = defineProps<{
    editable?: boolean;
    periodId?: string;
  }>();

  // 地图搜索选中后填充行内经纬度/描述
  function onSelectPoi(record: any, poi: AmapPoi | null) {
    if (!rowEditable(record)) return;
    if (!poi) {
      record.longitude = undefined;
      record.latitude = undefined;
      record.description = '';
      markDirty(record);
      return;
    }
    record.locationName = poi.address || poi.name;
    record.longitude = poi.lng;
    record.latitude = poi.lat;
    record.description = poi.address || poi.name;
    markDirty(record);
  }

  // 字段对齐后端 project_location: locationName/longitude/latitude/description
  const columns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '实施位置', key: 'locationName', width: 280 },
    { title: '经度', key: 'longitude', width: 120 },
    { title: '纬度', key: 'latitude', width: 120 },
    { title: '位置描述', key: 'description' },
    { title: '操作', key: 'action', width: 140, align: 'center' },
  ];
  const positionList = ref<any[]>([]);
  const loading = ref(false);
  const rowSaving = computed(() => positionList.value.some((item) => item._saving));
  const savedSnapshotById = new Map<string, Recordable>();
  let positionSeed = 0;

  function rowEditable(record: any) {
    return !!props.editable && !record._locked && !record._saving;
  }

  function markDirty(record: any) {
    if (rowEditable(record)) record._dirty = true;
  }

  function updateLocationName(record: any, value: string) {
    if (!rowEditable(record)) return;
    record.locationName = value;
    record._dirty = true;
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

  function validateRow(item: any) {
    if (!String(item.locationName || '').trim() || item.longitude == null || item.latitude == null) {
      throw new Error('请完整填写实施位置及经纬度');
    }
  }

  function normalizeRow(item: any, locked = !!item.id) {
    return {
      ...item,
      _key: ++positionSeed,
      _locked: locked,
      _saving: false,
      _dirty: false,
      longitude: item.longitude == null ? undefined : Number(item.longitude),
      latitude: item.latitude == null ? undefined : Number(item.latitude),
    };
  }

  // 暴露给父级(行数组, 父级映射为 project_location 实体 + periodId)
  defineExpose({
    getData() {
      positionList.value.forEach(validateRow);
      return positionList.value.map(toPayload);
    },
    setData(list: any[]) {
      setLoadedRows(list || [], false);
    },
    reload: () => loadPositions(false),
  });

  function setLoadedRows(records: any[], preserveLocalChanges: boolean) {
    const drafts = preserveLocalChanges
      ? positionList.value.filter((item) => !item._locked && !item._saving).map((item) => ({ ...item, _saving: false }))
      : [];

    positionSeed = 0;
    const loadedRows = records.map((item) => normalizeRow(item, true));
    savedSnapshotById.clear();
    loadedRows.forEach((item) => {
      if (item.id) savedSnapshotById.set(String(item.id), toPayload(item));
    });

    if (!preserveLocalChanges) {
      positionList.value = loadedRows;
      return;
    }

    const visibleRows = loadedRows;
    drafts.forEach((draft) => {
      if (draft.id) {
        const index = visibleRows.findIndex((item) => String(item.id) === String(draft.id));
        if (index >= 0) visibleRows[index] = draft;
        else visibleRows.push(draft);
      } else {
        visibleRows.push(draft);
      }
    });
    positionSeed = Math.max(positionSeed, ...visibleRows.map((item) => Number(item._key) || 0));
    positionList.value = visibleRows;
  }

  async function loadPositions(preserveLocalChanges = false) {
    if (!props.periodId) {
      positionList.value = [];
      savedSnapshotById.clear();
      return;
    }
    loading.value = true;
    try {
      const result: any = await getPlanLocations({ periodId: props.periodId, pageNo: 1, pageSize: 1000 });
      const records = Array.isArray(result) ? result : result?.records || [];
      setLoadedRows(records, preserveLocalChanges);
    } catch (error: any) {
      if (!preserveLocalChanges) positionList.value = [];
      createMessage.warning(error?.message || '位置信息加载失败，请刷新后重试');
    } finally {
      loading.value = false;
    }
  }

  watch(
    () => props.periodId,
    () => loadPositions(false),
    { immediate: true }
  );

  // 添加位置
  function addPosition() {
    positionList.value.push(normalizeRow({ locationName: '', longitude: undefined, latitude: undefined, description: '' }, false));
  }

  function unlockRow(record: any) {
    if (rowSaving.value) return;
    record._locked = false;
    record._dirty = false;
  }

  /**
   * editBatch 是按分期全量同步接口。行保存时以已落库快照为基线，仅替换当前行，
   * 不携带其他未保存草稿或本地待删除行，避免一次行保存顺带修改其他数据。
   */
  async function saveRow(record: any) {
    if (!props.editable) return createMessage.warning('当前计划方案不可编辑');
    if (!props.periodId) return createMessage.warning('缺少项目分期 ID，无法保存');
    if (rowSaving.value) return;
    try {
      validateRow(record);
    } catch (error: any) {
      createMessage.warning(error?.message || '请检查位置信息');
      return;
    }

    record._saving = true;
    try {
      const records = Array.from(savedSnapshotById.values()).map((item) => ({ ...item }));
      const payload = toPayload(record);
      if (record.id) {
        const index = records.findIndex((item) => String(item.id) === String(record.id));
        if (index >= 0) records[index] = payload;
        else records.push(payload);
      } else {
        records.push(payload);
      }
      await editPlanLocationsBatch({ periodId: props.periodId, records }, false);
      await loadPositions(true);
      createMessage.success('该条位置信息已保存');
    } catch (error: any) {
      createMessage.warning(error?.message || '位置信息保存失败，请重试');
    } finally {
      record._saving = false;
    }
  }

  // 新增草稿直接移除；已落库行通过全量同步立即提交删除，避免依赖已移除的“保存全部”。
  async function removePosition(record: any) {
    if (!record.id) {
      positionList.value = positionList.value.filter((item) => item._key !== record._key);
      return;
    }
    if (!props.editable) return createMessage.warning('当前计划方案不可编辑');
    if (!props.periodId) return createMessage.warning('缺少项目分期 ID，无法删除');
    if (rowSaving.value) return;
    record._saving = true;
    try {
      const records = Array.from(savedSnapshotById.entries())
        .filter(([id]) => id !== String(record.id))
        .map(([, item]) => ({ ...item }));
      await editPlanLocationsBatch({ periodId: props.periodId, records }, false);
      await loadPositions(true);
      createMessage.success('该条位置信息已删除');
    } catch (error: any) {
      createMessage.warning(error?.message || '位置信息删除失败，请重试');
    } finally {
      record._saving = false;
    }
  }
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
