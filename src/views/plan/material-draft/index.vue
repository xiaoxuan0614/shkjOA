<template>
  <div>
    <BasicTable @register="registerTable">
      <template #tableTitle>
        <a-button v-auth="PERMISSIONS.add" type="primary" preIcon="ant-design:plus-outlined" @click="handleAdd">新增</a-button>
      </template>
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusMeta[record.status]?.color || 'default'">
            {{ statusMeta[record.status]?.text || record.status || '—' }}
          </a-tag>
        </template>
      </template>
    </BasicTable>

    <a-modal v-model:open="addModalOpen" title="新增报价" ok-text="下一步" cancel-text="取消" :confirm-loading="periodLoading" @ok="confirmAdd">
      <a-form layout="vertical">
        <a-form-item label="项目分期" required>
          <a-select
            v-model:value="selectedPeriodId"
            show-search
            allow-clear
            option-filter-prop="label"
            :options="periodOptions"
            :loading="periodLoading"
            placeholder="请选择需要报价的项目分期"
          />
        </a-form-item>
        <a-form-item label="报价单名称" required>
          <a-input v-model:value="candidateName" :maxlength="100" placeholder="请输入报价单名称" />
        </a-form-item>
      </a-form>
      <a-empty v-if="!periodLoading && !periodOptions.length" description="当前没有可新增报价的项目分期" />
    </a-modal>
  </div>
</template>

<script lang="ts" name="quotation-management-list" setup>
  import { ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import type { ActionItem } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { quotationListStatusMap, quotationColumns, quotationSearchFormSchema } from '../Plan.data';
  import { exportCandidateMaterials } from '../materialExcel';
  import {
    getMaterialCandidateItemList,
    getQuotationPeriods,
    QUOTATION_STATUS_SUBMITTED,
    QUOTATION_STATUS_APPROVED,
    QUOTATION_STATUS_REJECTED,
    isQuotationEditable,
    quotationList,
    updateMaterialCandidateStatus,
    voidMaterialCandidate,
  } from '../Plan.api';

  defineOptions({ name: 'QuotationManagementList' });

  const PERMISSIONS = {
    add: 'plan:quotation:add',
    edit: 'plan:quotation:edit',
    lock: 'plan:quotation:lock',
    unlock: 'plan:quotation:unlock',
    delete: 'plan:quotation:delete',
  } as const;

  const router = useRouter();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const statusMeta = quotationListStatusMap;
  const operatingId = ref('');
  const exportingId = ref('');
  const addModalOpen = ref(false);
  const selectedPeriodId = ref<string>();
  const candidateName = ref('');
  const periodOptions = ref<{ label: string; value: string; projectName: string }[]>([]);
  const periodLoading = ref(false);

  // 仅更新空名称或上次自动生成的名称，保留用户手动填写的内容。
  watch(selectedPeriodId, (periodId, previousPeriodId) => {
    const previousProjectName = periodOptions.value.find((item) => item.value === previousPeriodId)?.projectName;
    const previousDefaultName = previousProjectName ? `${previousProjectName}报价单` : '';
    if (candidateName.value.trim() && candidateName.value !== previousDefaultName) return;
    const projectName = periodOptions.value.find((item) => item.value === periodId)?.projectName;
    candidateName.value = projectName ? `${projectName}报价单` : '';
  });

  const { tableContext } = useListPage({
    tableProps: {
      title: '报价管理',
      api: quotationList,
      columns: quotationColumns,
      canResize: true,
      formConfig: {
        schemas: quotationSearchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
        fieldMapToTime: [],
      },
      actionColumn: { width: 390, fixed: 'right' },
    },
  });

  const [registerTable, { reload }] = tableContext;

  function assertPermission(code: string) {
    if (hasPermission(code)) return true;
    createMessage.warning('当前账号没有此操作权限');
    return false;
  }

  async function handleAdd() {
    if (!assertPermission(PERMISSIONS.add)) return;
    selectedPeriodId.value = undefined;
    candidateName.value = '';
    addModalOpen.value = true;
    periodLoading.value = true;
    try {
      const periods = await getQuotationPeriods();
      periodOptions.value = periods.map((item: any) => ({
        value: String(item.periodId),
        projectName: String(item.projectName || '').trim(),
        label: `${item.projectName || '未命名主项目'} / ${item.periodName || '未命名分期'}（${item.periodId}）`,
      }));
    } catch (error: any) {
      periodOptions.value = [];
      createMessage.error(error?.message || '项目分期加载失败，请重试');
    } finally {
      periodLoading.value = false;
    }
  }

  function confirmAdd() {
    if (!selectedPeriodId.value) {
      createMessage.warning('请选择项目分期');
      return;
    }
    if (!candidateName.value.trim()) {
      createMessage.warning('请输入报价单名称');
      return;
    }
    addModalOpen.value = false;
    router.push({
      path: '/plan/material-draft/editor',
      query: { mode: 'create', periodId: selectedPeriodId.value, candidateName: candidateName.value.trim() },
    });
  }

  function handleEdit(record: Recordable) {
    if (!assertPermission(PERMISSIONS.edit)) return;
    if (!isQuotationEditable(record.status)) return createMessage.warning('当前状态不可修改');
    router.push({ path: '/plan/material-draft/editor', query: { mode: 'edit', periodId: record.periodId, candidateId: record.id } });
  }

  function handleView(record: Recordable) {
    router.push({ path: '/plan/material-draft/editor', query: { mode: 'view', periodId: record.periodId, candidateId: record.id } });
  }

  async function handleExport(record: Recordable) {
    if (exportingId.value) return;
    exportingId.value = String(record.id);
    try {
      const result: any = await getMaterialCandidateItemList({ candidateId: record.id, pageNo: 1, pageSize: 1000 });
      await exportCandidateMaterials(record, result?.records || result || []);
      createMessage.success('报价物料清单已导出');
    } catch (error: any) {
      createMessage.error(error?.message || '导出失败，请重试');
    } finally {
      exportingId.value = '';
    }
  }

  async function handleLock(record: Recordable) {
    if (!assertPermission(PERMISSIONS.edit) || !isQuotationEditable(record.status) || operatingId.value) return;
    operatingId.value = String(record.id);
    try {
      const result: any = await getMaterialCandidateItemList({ candidateId: record.id, pageNo: 1, pageSize: 1 });
      const rows = result?.records || result || [];
      if (!rows.length) throw new Error('请先添加报价物料后再提交审批');
      await updateMaterialCandidateStatus(record, QUOTATION_STATUS_SUBMITTED, false);
      createMessage.success('报价已提交，等待审批');
      await reload();
    } catch (error: any) {
      createMessage.error(error?.message || '提交失败，请重试');
    } finally {
      operatingId.value = '';
    }
  }

  async function handleDelete(record: Recordable) {
    if (!assertPermission(PERMISSIONS.delete) || !isQuotationEditable(record.status) || operatingId.value) return;
    operatingId.value = String(record.id);
    try {
      await voidMaterialCandidate(record, false);
      createMessage.success('报价已作废');
      await reload();
    } catch (error: any) {
      createMessage.error(error?.message || '删除失败，请重试');
    } finally {
      operatingId.value = '';
    }
  }

  function getTableAction(record: Recordable): ActionItem[] {
    const locked = !isQuotationEditable(record.status);
    return [
      {
        label: '查看详情',
        onClick: handleView.bind(null, record),
      },
      {
        label: '导出',
        loading: exportingId.value === String(record.id),
        disabled: !!exportingId.value,
        onClick: handleExport.bind(null, record),
      },
      {
        label: '修改',
        auth: PERMISSIONS.edit,
        ifShow: !locked,
        disabled: !!operatingId.value,
        onClick: handleEdit.bind(null, record),
      },
      {
        label: '提交审批',
        auth: PERMISSIONS.edit,
        ifShow: !locked,
        loading: operatingId.value === String(record.id),
        disabled: !!operatingId.value,
        popConfirm: {
          title: '提交后等待领导审批，确定提交报价吗？',
          confirm: handleLock.bind(null, record),
        },
      },
      ...[QUOTATION_STATUS_APPROVED, QUOTATION_STATUS_REJECTED].map((status) => ({
        label: status === QUOTATION_STATUS_APPROVED ? '通过' : '驳回',
        auth: PERMISSIONS.lock,
        ifShow: record.status === QUOTATION_STATUS_SUBMITTED,
        disabled: !!operatingId.value,
        popConfirm: {
          title: status === QUOTATION_STATUS_APPROVED ? '通过后报价将锁定，确认通过？' : '确认驳回此报价？',
          confirm: () => handleReview(record, status),
        },
      })),
      {
        label: '作废',
        color: 'error',
        auth: PERMISSIONS.delete,
        ifShow: !locked,
        disabled: !!operatingId.value,
        popConfirm: {
          title: '作废后报价不可修改，原记录仍保留，确定作废吗？',
          confirm: handleDelete.bind(null, record),
        },
      },
    ];
  }

  async function handleReview(record: Recordable, status: string) {
    if (!assertPermission(PERMISSIONS.lock) || record.status !== QUOTATION_STATUS_SUBMITTED || operatingId.value) return;
    operatingId.value = String(record.id);
    try {
      await updateMaterialCandidateStatus(record, status, false);
      createMessage.success(status === QUOTATION_STATUS_APPROVED ? '报价已通过并锁定' : '报价已驳回');
      await reload();
    } finally {
      operatingId.value = '';
    }
  }
</script>
