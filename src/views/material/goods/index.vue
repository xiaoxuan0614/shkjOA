<template>
  <div>
    <!-- 物料库存列表 -->
    <BasicTable @register="registerTable" :rowSelection="rowSelection">
      <!-- 表格标题栏 -->
      <template #tableTitle>
        <a-button type="primary" v-auth="'mtl:goods:add'" @click="handleAdd" preIcon="ant-design:plus-outlined">
          新增
        </a-button>
        <a-button preIcon="ant-design:import-outlined" @click="openImportModal(true, {})">导入</a-button>
        <a-dropdown>
          <template #overlay>
            <a-menu>
              <a-menu-item key="1" @click="batchHandleDelete">
                <Icon icon="ant-design:delete-outlined"></Icon>
                删除
              </a-menu-item>
            </a-menu>
          </template>
          <a-button v-auth="'mtl:goods:deleteBatch'">批量操作
            <Icon icon="mdi:chevron-down"></Icon>
          </a-button>
        </a-dropdown>
      </template>

      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" :dropDownActions="getDropDownAction(record)" />
      </template>

      <!-- 字段回显插槽：库存数量(不拼单位) -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'stockQty'">
          {{ record.stockQty }}
        </template>
      </template>
    </BasicTable>

    <!-- 新增/编辑物料弹窗(含单位子表) -->
    <GoodsModal @register="registerModal" @success="handleSuccess" />
    <!-- 物料Excel导入弹窗(下载模板按钮在弹窗内，由 JImportModal 的 template 配置提供) -->
    <JImportModal @register="registerImportModal" :url="importExcel" :template="{ name: '物料导入模板', url: importTemplate }" />
  </div>
</template>

<script lang="ts" name="mtl-goods" setup>
  import { reactive } from 'vue';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import GoodsModal from './components/GoodsModal.vue';
  import JImportModal from '/@/components/Form/src/jeecg/components/JImportModal.vue';
  import { columns, searchFormSchema } from './Goods.data';
  import { list, deleteOne, batchDelete, queryById, importExcel, importTemplate } from './Goods.api';

  const { createMessage } = useMessage();

  const queryParam = reactive<any>({});

  // 注册新增/编辑物料弹窗
  const [registerModal, { openModal }] = useModal();
  // 注册导入弹窗(JImportModal)
  const [registerImportModal, { openModal: openImportModal }] = useModal();

  // 注册表格
  const { tableContext } = useListPage({
    tableProps: {
      title: '物料基本维护',
      api: list,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
        fieldMapToNumber: [],
        fieldMapToTime: [],
      },
      actionColumn: {
        width: 160,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
    },
  });

  const [registerTable, { reload }, { rowSelection, selectedRowKeys }] = tableContext;

  /**
   * 新增事件：打开新增物料弹窗(物料编码自动生成)
   */
  function handleAdd() {
    openModal(true, { isUpdate: false, showFooter: true });
  }

  /**
   * 编辑事件：查询详情(含单位子表 unitList)后打开编辑弹窗
   */
  async function handleEdit(record: Recordable) {
    // 列表行不含单位子表，编辑时重新查询完整详情
    const detail = await queryById({ id: record.id });
    openModal(true, {
      record: { ...record, ...detail },
      isUpdate: true,
      showFooter: true,
    });
  }

  /**
   * 详情事件：只读查看物料(含单位子表)
   */
  async function handleDetail(record: Recordable) {
    const detail = await queryById({ id: record.id });
    openModal(true, {
      record: { ...record, ...detail },
      isUpdate: true,
      showFooter: false,
    });
  }

  /**
   * 删除事件
   */
  async function handleDelete(record) {
    await deleteOne({ id: record.id }, handleSuccess);
  }

  /**
   * 批量删除事件(按钮常显，点击时校验选择)
   */
  async function batchHandleDelete() {
    if (!selectedRowKeys.value.length) {
      createMessage.warning('请先勾选要删除的数据');
      return;
    }
    await batchDelete({ ids: selectedRowKeys.value }, handleSuccess);
  }

  /**
   * 成功回调：清空选中并刷新列表
   */
  function handleSuccess() {
    selectedRowKeys.value = [];
    reload();
  }

  /**
   * 操作栏(编辑)
   */
  function getTableAction(record) {
    return [
      {
        label: '编辑',
        onClick: handleEdit.bind(null, record),
        auth: 'mtl:goods:edit',
      },
    ];
  }

  /**
   * 下拉操作栏(详情 + 删除)
   */
  function getDropDownAction(record) {
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
        auth: 'mtl:goods:delete',
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
