<template>
  <div class="detail-position">
    <div class="detail-position__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" @click="openAdd">新增位置</a-button>
    </div>
    <a-table :columns="columns" :data-source="positions" :pagination="false" size="middle" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button
            type="link"
            size="small"
            :disabled="!validCoordinates(record)"
            :title="validCoordinates(record) ? '在地图上查看位置' : '该位置缺少有效经纬度'"
            @click="openMap(record)"
            >查看地图</a-button
          >
          <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
          <a-popconfirm title="是否确认删除" @confirm="handleDelete(record)">
            <a-button type="link" size="small" danger>删除</a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="mapOpen" :title="mapRecord?.locationName || '实施位置'" :footer="null" :width="760" destroy-on-close>
      <template v-if="mapRecord">
        <AMapLocationMap
          :lng="coordinate(mapRecord.longitude)"
          :lat="coordinate(mapRecord.latitude)"
          :address="mapRecord.locationName || ''"
          height="380px"
          disabled
        />
        <p v-if="mapRecord.description" class="detail-position__description">{{ mapRecord.description }}</p>
      </template>
    </a-modal>

    <!-- 新增/编辑弹窗 -->
    <PositionModal v-model:open="editorOpen" :project-id="projectId" :record="editingRecord" @success="load" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getPositions, deletePosition } from '../ProjectDetail.api';
  import PositionModal from './PositionModal.vue';
  import AMapLocationMap from '/@/components/jeecg/AMapLocationMap.vue';

  const props = defineProps<{
    projectId: string;
  }>();

  const { createMessage } = useMessage();
  const positions = ref<any[]>([]);
  const mapOpen = ref(false);
  const mapRecord = ref<any | null>(null);
  const editorOpen = ref(false);
  const editingRecord = ref<any | null>(null);

  // 后端 project_location 字段
  const columns = [
    { title: '实施位置', dataIndex: 'locationName' },
    { title: '经度', dataIndex: 'longitude' },
    { title: '纬度', dataIndex: 'latitude' },
    { title: '位置描述', dataIndex: 'description' },
    { title: '操作', key: 'action', width: 210, align: 'center' },
  ];

  async function load() {
    const res: any = await getPositions({ periodId: props.projectId, pageNo: 1, pageSize: 100 });
    const list = res?.records || res || [];
    positions.value = list || [];
  }

  function coordinate(raw: unknown): number | null {
    if (raw == null || String(raw).trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function validCoordinates(record: any): boolean {
    const lng = coordinate(record.longitude);
    const lat = coordinate(record.latitude);
    return lng != null && lat != null && Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
  }

  function openMap(record: any) {
    if (!validCoordinates(record)) return;
    mapRecord.value = { ...record };
    mapOpen.value = true;
  }

  function openAdd() {
    editingRecord.value = null;
    editorOpen.value = true;
  }

  function openEdit(record: any) {
    editingRecord.value = { ...record };
    editorOpen.value = true;
  }

  async function handleDelete(record: any) {
    await deletePosition({ id: record.id });
    createMessage.success(`删除位置「${record.locationName}」成功`);
    load();
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .detail-position {
    &__toolbar {
      margin-bottom: 12px;
    }
    &__description {
      margin: 12px 0 0;
      color: #595959;
      overflow-wrap: anywhere;
    }
  }
</style>
