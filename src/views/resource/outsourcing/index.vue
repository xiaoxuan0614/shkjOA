<template>
  <div>
    <!-- 外协单位列表 -->
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
      <!-- 状态列(字典 outsourcing_status) -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusMeta[record.status]?.color || 'default'">
            {{ (statusMeta[record.status]?.text || record.status) ?? '—' }}
          </a-tag>
        </template>
      </template>
    </BasicTable>
    <!-- 新增/编辑弹窗 -->
    <OutsourcingModal @register="registerModal" @success="handleSuccess" />
  </div>
</template>

<script lang="ts" name="resource-outsourcing" setup>
  import { reactive, ref, onMounted } from 'vue';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import OutsourcingModal from './OutsourcingModal.vue';
  import { columns, searchFormSchema, loadOutsourcingStatusMap } from './Outsourcing.data';
  import { list, deleteOne, batchDelete } from './Outsourcing.api';

  const { createMessage } = useMessage();

  const queryParam = reactive<any>({});
  // 状态下拉字典映射
  const statusMeta = ref<Recordable>({});

  onMounted(async () => {
    statusMeta.value = await loadOutsourcingStatusMap();
  });

  // 注册 modal
  const [registerModal, { openModal }] = useModal();

  // 注册 table
  const { tableContext } = useListPage({
    tableProps: {
      title: '外协单位',
      api: list,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
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
