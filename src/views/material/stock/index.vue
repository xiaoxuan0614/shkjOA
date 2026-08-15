<template>
  <div>
    <!-- 库存管理：所有在库物料数量，库管在此做手动入库/出库 -->
    <BasicTable @register="registerTable">
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" />
      </template>
      <!-- 字段回显：库存数量(不拼单位) -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'stockQty'">
          {{ record.stockQty }}
        </template>
      </template>
    </BasicTable>

    <!-- 手动入库/出库弹窗(复用物料模块 IOModal，走 /stock/ioRecord/manualIn|manualOut) -->
    <IOModal @register="registerIOModal" @success="handleSuccess" />
    <!-- 盘存弹窗(留痕) -->
    <StocktakeModal @register="registerStocktakeModal" @success="handleSuccess" />
  </div>
</template>

<script lang="ts" name="mtl-stock" setup>
  import { reactive } from 'vue';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema } from './Stock.data';
  import { list } from '../goods/Goods.api';
  import IOModal from '../goods/components/IOModal.vue';
  import StocktakeModal from './components/StocktakeModal.vue';

  const queryParam = reactive<any>({});

  // 注册手动出入库弹窗
  const [registerIOModal, { openModal: openIOModal }] = useModal();
  // 注册盘存弹窗
  const [registerStocktakeModal, { openModal: openStocktakeModal }] = useModal();

  // 注册表格
  const { tableContext } = useListPage({
    tableProps: {
      title: '库存管理',
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
        width: 120,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
    },
  });

  const [registerTable, { reload }] = tableContext;

  /**
   * 出入库事件：打开手动入库/出库弹窗(库存数量维护，走 ioRecord)
   */
  function handleIo(record: Recordable) {
    openIOModal(true, { record });
  }

  /**
   * 盘存事件：打开盘存弹窗(调整在库数量，留痕)
   */
  function handleStocktake(record: Recordable) {
    openStocktakeModal(true, { record });
  }

  /**
   * 成功回调：刷新列表
   */
  function handleSuccess() {
    reload();
  }

  /**
   * 操作栏(出入库 + 盘存)
   */
  function getTableAction(record) {
    return [
      {
        label: '出入库',
        onClick: handleIo.bind(null, record),
        auth: 'mtl:goods:io',
      },
      {
        label: '盘存',
        onClick: handleStocktake.bind(null, record),
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
