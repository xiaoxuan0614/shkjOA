<template>
  <div class="detail-position">
    <div class="detail-position__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" @click="openAdd">新增位置</a-button>
    </div>
    <a-table
      :columns="columns"
      :data-source="positions"
      :pagination="false"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
          <a-popconfirm title="是否确认删除" @confirm="handleDelete(record)">
            <a-button type="link" size="small" danger>删除</a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>

    <!-- 新增/编辑弹窗 -->
    <PositionModal @register="registerModal" @success="load" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { useModal } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getPositions, deletePosition } from '../ProjectDetail.api';
  import PositionModal from './PositionModal.vue';

  const props = defineProps<{
    projectId: string;
  }>();

  const { createMessage } = useMessage();
  const positions = ref<any[]>([]);
  const [registerModal, { openModal }] = useModal();

  // 后端 project_location 字段
  const columns = [
    { title: '实施位置', dataIndex: 'locationName' },
    { title: '经度', dataIndex: 'longitude' },
    { title: '纬度', dataIndex: 'latitude' },
    { title: '位置描述', dataIndex: 'description' },
    { title: '操作', key: 'action', width: 130, align: 'center' },
  ];

  async function load() {
    const res: any = await getPositions({ periodId: props.projectId, pageNo: 1, pageSize: 100 });
    const list = res?.records || res || [];
    positions.value = list || [];
  }

  function openAdd() {
    openModal(true, { isUpdate: false, projectId: props.projectId });
  }

  function openEdit(record: any) {
    openModal(true, { isUpdate: true, record, projectId: props.projectId });
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
  }
</style>
