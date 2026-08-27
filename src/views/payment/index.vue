<template>
  <div>
    <!-- 合同列表 -->
    <BasicTable @register="registerTable">
      <!-- 插槽:table标题 -->
      <template #tableTitle>
        <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handleAdd">新增合同</a-button>
      </template>
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" :dropDownActions="getDropDownAction(record)" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="getApprovalStatusMeta(record.status).color">
            {{ getApprovalStatusMeta(record.status).text }}
          </a-tag>
        </template>
      </template>
    </BasicTable>

    <ContractModal @register="registerModal" @success="handleSuccess" />
  </div>
</template>

<script lang="ts" name="payment-contractlist" setup>
  import { reactive } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage';
  import ContractModal from './ContractModal.vue';
  import { columns, searchFormSchema } from './Payment.data';
  import { contractList } from './Payment.api';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
  import { useMessage } from '/@/hooks/web/useMessage';

  defineOptions({ name: 'PaymentContractList' });

  const router = useRouter();
  const { createMessage } = useMessage();
  const queryParam = reactive<any>({});
  const [registerModal, { openModal }] = useModal();

  const { tableContext } = useListPage({
    tableProps: {
      title: '回款管理',
      api: contractList,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
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

  const [registerTable, { reload }] = tableContext;

  /**
   * 新增合同
   */
  function handleAdd() {
    openModal(true, { isUpdate: false });
  }

  /**
   * 编辑合同
   */
  function handleEdit(record: Recordable) {
    if (!record.periodId) {
      createMessage.warning('当前合同缺少项目分期 ID，无法修改');
      return;
    }
    router.push({
      path: '/project/contract',
      query: {
        mode: 'edit',
        periodId: record.periodId,
        projectId: record.projectId,
      },
    });
  }

  /**
   * 详情: 跳转合同详情页(回款记录)
   */
  function handleDetail(record: Recordable) {
    if (!record.periodId) {
      createMessage.warning('当前合同缺少项目分期 ID，无法查看详情');
      return;
    }
    router.push({ path: `/payment/detail/${record.periodId}` });
  }

  function handleSuccess() {
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
      {
        label: '详情',
        onClick: handleDetail.bind(null, record),
      },
    ];
  }

  /**
   * 下拉操作栏: 删除(占位)
   */
  function getDropDownAction(_record: Recordable) {
    return [
      {
        label: '删除',
        popConfirm: {
          title: '是否确认删除',
          confirm: () => {},
          placement: 'topLeft',
        },
      },
    ];
  }
</script>
