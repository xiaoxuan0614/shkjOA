<template>
  <div>
    <!-- 车辆列表 -->
    <BasicTable @register="registerTable" :row-selection="null">
      <!-- 插槽:table标题 -->
      <template #tableTitle>
        <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handleAdd"> 新增车辆 </a-button>
      </template>
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" :dropDownActions="getDropDownAction(record)" />
      </template>
      <!-- 状态列: tag 展示 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="getStatusColor(record.status)">{{ record.status }}</a-tag>
        </template>
      </template>
    </BasicTable>
    <!-- 新增/编辑弹窗 -->
    <VehicleModal @register="registerModal" @success="handleSuccess" />
  </div>
</template>

<script lang="ts" name="resource-vehicle" setup>
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage';
  import VehicleModal from './VehicleModal.vue';
  import { columns, searchFormSchema, getStatusColor } from './Vehicle.data';
  import { list, deleteOne } from './Vehicle.api';

  const router = useRouter();

  // 注册 modal
  const [registerModal, { openModal }] = useModal();

  // 注册 table
  const { tableContext } = useListPage({
    tableProps: {
      title: '车辆管理',
      api: list,
      rowKey: 'vehicleId',
      showIndexColumn: true,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
      },
      actionColumn: {
        width: 140,
        fixed: 'right',
      },
    },
  });

  const [registerTable, { reload }, { selectedRowKeys }] = tableContext;

  /**
   * 新增车辆
   */
  function handleAdd() {
    openModal(true, {
      isUpdate: false,
      showFooter: true,
    });
  }

  /**
   * 编辑
   */
  function handleEdit(record: Recordable) {
    openModal(true, {
      record,
      isUpdate: true,
      showFooter: true,
    });
  }

  /**
   * 详情: 跳转车辆详情页
   */
  function handleDetail(record: Recordable) {
    router.push({ path: `/resource/vehicle/detail/${record.vehicleId}` });
  }

  /**
   * 删除单个
   */
  async function handleDelete(record: Recordable) {
    await deleteOne({ vehicleId: record.vehicleId }, handleSuccess);
  }

  /**
   * 成功回调
   */
  function handleSuccess() {
    selectedRowKeys.value = [];
    reload();
  }

  /**
   * 操作栏: 编辑 + 详情
   */
  function getTableAction(record: Recordable) {
    return [
      {
        label: '编辑',
        onClick: handleEdit.bind(null, record),
      },
      {
        label: '详情',
        onClick: handleDetail.bind(null, record),
      },
    ];
  }

  /**
   * 下拉操作栏: 删除
   */
  function getDropDownAction(record: Recordable) {
    return [
      {
        label: '删除',
        popConfirm: {
          title: '是否确认删除',
          confirm: handleDelete.bind(null, record),
          placement: 'topLeft',
        },
      },
    ];
  }
</script>

<style lang="less" scoped>
  :deep(.ant-picker),
  :deep(.ant-input-number) {
    width: 100%;
  }
</style>
