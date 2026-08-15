<template>
  <div class="detail-implement">
    <a-table
      :columns="columns"
      :data-source="records"
      :pagination="false"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button type="link" size="small" @click="openLog(record)">查看日志</a-button>
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
        </template>
      </template>
    </a-table>

    <!-- 查看日志弹窗 -->
    <LogModal @register="registerModal" :project-id="projectId" />
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

  // 设计稿列: 工序/现场负责人/计划开始时间/计划完成时间/计划工时/剩余天数/状态/操作
  const columns = [
    { title: '工序', dataIndex: 'workName' },
    { title: '现场负责人', dataIndex: 'owner' },
    { title: '计划开始时间', dataIndex: 'planStart' },
    { title: '计划完成时间', dataIndex: 'planEnd' },
    { title: '计划工时', dataIndex: 'planHours' },
    { title: '剩余天数', dataIndex: 'remainingDays' },
    { title: '状态', dataIndex: 'status' },
    { title: '操作', key: 'action', width: 110, align: 'center' },
  ];

  function statusColor(status: string): string {
    const map: Recordable = {
      未开始: 'default',
      进行中: 'processing',
      已完成: 'success',
      已暂停: 'warning',
    };
    return map[status] || 'default';
  }

  function openLog(record: any) {
    openModal(true, { record });
  }

  async function load() {
    const data = await getImplementRecords({ projectId: props.projectId });
    records.value = data || [];
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
