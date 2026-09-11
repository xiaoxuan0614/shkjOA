<template>
  <div class="detail-implement">
    <a-alert v-if="loadError" type="error" show-icon :message="loadError" style="margin-bottom: 12px">
      <template #action><a-button size="small" @click="load">重试</a-button></template>
    </a-alert>
    <a-table
      :columns="columns"
      :data-source="records"
      :pagination="pagination"
      :loading="loading"
      row-key="id"
      size="middle"
      bordered
      @change="handlePageChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
        </template>
      </template>
    </a-table>
    <LogModal @register="registerModal" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, watch, onBeforeUnmount } from 'vue';
  import { useModal } from '/@/components/Modal';
  import { getImplementRecords } from '../ProjectDetail.api';
  import { formatLogHours } from '/@/views/implement/logDisplay';
  import LogModal from './LogModal.vue';

  const props = defineProps<{ projectId: string }>();
  const records = ref<any[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` });
  let sequence = 0;
  const [registerModal, { openModal, closeModal }] = useModal();
  const columns = [
    { title: '提交人', dataIndex: 'submitterName', width: 100 },
    { title: '签到时间', dataIndex: 'signInTime', width: 170 },
    { title: '签退时间', dataIndex: 'signOutTime', width: 170 },
    { title: '实施内容', dataIndex: 'workContent', ellipsis: true },
    { title: '工时', dataIndex: 'hours', customRender: ({ record }) => formatLogHours(record), width: 180 },
    { title: '实施位置', dataIndex: 'implementLocationName', ellipsis: true },
    { title: '车辆', dataIndex: 'vehicleNo', width: 100 },
    {
      title: '公里数',
      dataIndex: 'mileage',
      width: 90,
      customRender: ({ text }) => (text === null || text === undefined || text === '' ? '—' : `${text}km`),
    },
    { title: '操作', key: 'action', width: 90, align: 'center' },
  ];

  function openDetail(record: any) {
    openModal(true, { periodId: props.projectId, logId: record.id });
  }

  async function load() {
    const request = ++sequence;
    records.value = [];
    loadError.value = '';
    if (!props.projectId) {
      loading.value = false;
      pagination.total = 0;
      return;
    }
    loading.value = true;
    try {
      const res: any = await getImplementRecords({ periodId: props.projectId, pageNo: pagination.current, pageSize: pagination.pageSize });
      if (request !== sequence) return;
      records.value = Array.isArray(res) ? res : res?.records || [];
      pagination.total = Array.isArray(res) ? res.length : Number(res?.total) || 0;
    } catch {
      if (request !== sequence) return;
      pagination.total = 0;
      loadError.value = '实施记录加载失败，请重试';
    } finally {
      if (request === sequence) loading.value = false;
    }
  }

  function handlePageChange(page: { current: number; pageSize: number }) {
    pagination.current = page.pageSize === pagination.pageSize ? page.current : 1;
    pagination.pageSize = page.pageSize;
    void load();
  }

  watch(
    () => props.projectId,
    (_, previous) => {
      pagination.current = 1;
      if (previous) closeModal();
      void load();
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    sequence += 1;
  });
</script>
