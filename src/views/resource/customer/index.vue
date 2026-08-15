<template>
  <div>
    <!-- 往来客户列表 -->
    <BasicTable @register="registerTable">
      <!-- 插槽:table标题 -->
      <template #tableTitle>
        <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handleAdd">
          新增
        </a-button>
        <a-dropdown>
          <template #overlay>
            <a-menu>
              <a-menu-item key="1" @click="batchHandleDelete">
                <Icon icon="ant-design:delete-outlined"></Icon>
                删除
              </a-menu-item>
            </a-menu>
          </template>
          <a-button>批量操作
            <Icon icon="mdi:chevron-down"></Icon>
          </a-button>
        </a-dropdown>
      </template>
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" :dropDownActions="getDropDownAction(record)" />
      </template>
    </BasicTable>
    <!-- 新增/编辑弹窗 -->
    <CustomerModal @register="registerModal" @success="handleSuccess" />
  </div>
</template>

<script lang="ts" name="resource-customer" setup>
  import { reactive } from 'vue';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import CustomerModal from './CustomerModal.vue';
  import { columns, searchFormSchema } from './Customer.data';
  import { list, deleteOne, batchDelete } from './Customer.api';

  const { createMessage } = useMessage();

  const queryParam = reactive<any>({});

  // 注册 modal
  const [registerModal, { openModal }] = useModal();

  // 注册 table
  const { tableContext } = useListPage({
    tableProps: {
      title: '往来客户',
      api: list,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
        // 创建日期 RangePicker -> 后端 createTime_begin / createTime_end
        fieldMapToTime: [['createTime', ['createTime_begin', 'createTime_end'], 'YYYY-MM-DD']],
      },
      actionColumn: {
        width: 130,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
    },
  });

  const [registerTable, { reload }, { selectedRowKeys }] = tableContext;

  /**
   * 新增
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
   * 详情(只读)
   */
  function handleDetail(record: Recordable) {
    openModal(true, {
      record,
      isUpdate: true,
      showFooter: false,
    });
  }

  /**
   * 删除单个
   */
  async function handleDelete(record: Recordable) {
    await deleteOne({ id: record.id }, handleSuccess);
  }

  /**
   * 批量删除(按钮常显，点击时校验选择)
   */
  async function batchHandleDelete() {
    if (!selectedRowKeys.value.length) {
      createMessage.warning('请先勾选要删除的数据');
      return;
    }
    await batchDelete({ ids: selectedRowKeys.value }, handleSuccess);
  }

  /**
   * 成功回调
   */
  function handleSuccess() {
    selectedRowKeys.value = [];
    reload();
  }

  /**
   * 操作栏: 编辑
   */
  function getTableAction(record: Recordable) {
    return [
      {
        label: '编辑',
        onClick: handleEdit.bind(null, record),
      },
    ];
  }

  /**
   * 下拉操作栏: 详情 + 删除
   */
  function getDropDownAction(record: Recordable) {
    return [
      {
        label: '详情',
        onClick: handleDetail.bind(null, record),
      },
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
