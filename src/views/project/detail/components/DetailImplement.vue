<template>
  <div class="detail-implement">
    <a-table :columns="columns" :data-source="records" :pagination="false" size="middle" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
        </template>
      </template>
    </a-table>

    <!-- 实施记录详情弹窗 -->
    <LogModal @register="registerModal" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { useModal } from '/@/components/Modal';
  import { getImplementRecords } from '../ProjectDetail.api';
  import LogModal from './LogModal.vue';

  const props = defineProps<{
    projectId: string;
  }>();

  const records = ref<any[]>([]);
  const [registerModal, { openModal }] = useModal();

  // 后端 project_implement_log 字段
  const columns = [
    { title: '实施日期', dataIndex: 'logDate' },
    { title: '提交人', dataIndex: 'submitterName' },
    { title: '工作内容', dataIndex: 'workContent' },
    { title: '工时', dataIndex: 'hours' },
    { title: '实施位置', dataIndex: 'locationName' },
    { title: '车辆', dataIndex: 'vehicleNo' },
    { title: '公里数', dataIndex: 'mileage' },
    { title: '备注', dataIndex: 'remark' },
    { title: '操作', key: 'action', width: 90, align: 'center' },
  ];

  function openDetail(record: any) {
    openModal(true, { record });
  }

  async function load() {
    const res: any = await getImplementRecords({ periodId: props.projectId, pageNo: 1, pageSize: 100 });
    const list = res?.records || res || [];
    records.value = list || [];
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
