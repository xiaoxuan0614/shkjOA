<template>
  <div class="plan-material">
    <div class="plan-material__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handleAdd">添加申请</a-button>
    </div>
    <a-table
      :columns="columns"
      :data-source="list"
      :pagination="false"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-popconfirm title="是否确认删除" @confirm="handleDelete(record)">
            <a-button type="link" size="small" danger>删除</a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>

    <MaterialApplyModal @register="registerModal" @success="load" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { useModal } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { defHttp } from '/@/utils/http/axios';
  import { getPlanMaterialList } from '../Plan.api';
  import MaterialApplyModal from './MaterialApplyModal.vue';

  const props = defineProps<{
    projectId: string;
  }>();

  const { createMessage } = useMessage();
  const list = ref<any[]>([]);
  const [registerModal, { openModal }] = useModal();

  // 墨刀申请清单列: 物料类别/物料名称/品牌/型号/库存/申请数量/单位/快递单号/操作
  const columns = [
    { title: '物料类别', dataIndex: 'category' },
    { title: '物料名称', dataIndex: 'name' },
    { title: '品牌', dataIndex: 'brand' },
    { title: '型号', dataIndex: 'model' },
    { title: '库存', dataIndex: 'stock' },
    { title: '申请数量', dataIndex: 'applyQty' },
    { title: '单位', dataIndex: 'unit' },
    { title: '快递单号', dataIndex: 'expressNo' },
    { title: '操作', key: 'action', width: 90, align: 'center' },
  ];

  async function load() {
    const data = await getPlanMaterialList({ projectId: props.projectId });
    list.value = data || [];
  }

  function handleAdd() {
    openModal(true, { projectId: props.projectId });
  }

  function handleDelete(record: any) {
    createMessage.success(`删除「${record.name}」申请(演示)`);
    load();
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .plan-material {
    &__toolbar {
      margin-bottom: 12px;
    }
  }
</style>
