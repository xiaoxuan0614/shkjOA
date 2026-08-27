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
  import { onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import type { ActionItem } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { loadQuotationStatusMap, quotationColumns, quotationSearchFormSchema } from '../Plan.data';
  import { exportCandidateMaterials } from '../materialExcel';
  import {
    getMaterialCandidateItemList,
    getQuotationPeriods,
    QUOTATION_STATUS_DRAFT,
    QUOTATION_STATUS_SUBMITTED,
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
  const statusMeta = ref<Recordable>({});
  const operatingId = ref('');
  const exportingId = ref('');
  const addModalOpen = ref(false);
  const selectedPeriodId = ref<string>();
  const candidateName = ref('');
  const periodOptions = ref<{ label: string; value: string }[]>([]);
  const periodLoading = ref(false);

  onMounted(async () => {
    statusMeta.value = await loadQuotationStatusMap();
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
    if (record.status !== QUOTATION_STATUS_DRAFT) return createMessage.warning('当前状态不可修改，请先恢复为草稿');
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
    if (!assertPermission(PERMISSIONS.lock) || record.status !== QUOTATION_STATUS_DRAFT || operatingId.value) return;
    operatingId.value = String(record.id);
    try {
      const result: any = await getMaterialCandidateItemList({ candidateId: record.id, pageNo: 1, pageSize: 1 });
      const rows = result?.records || result || [];
      if (!rows.length) throw new Error('请先添加报价物料后再锁定');
      await updateMaterialCandidateStatus(record, QUOTATION_STATUS_SUBMITTED, false);
      createMessage.success('报价已锁定');
      await reload();
    } catch (error: any) {
      createMessage.error(error?.message || '锁定失败，请重试');
    } finally {
      operatingId.value = '';
    }
  }

  async function handleUnlock(record: Recordable) {
    const unlockable = record.status === QUOTATION_STATUS_SUBMITTED;
    if (!assertPermission(PERMISSIONS.unlock) || !unlockable || operatingId.value) return;
    operatingId.value = String(record.id);
    try {
      await updateMaterialCandidateStatus(record, QUOTATION_STATUS_DRAFT, false);
      createMessage.success('报价已解锁，可以继续修改');
      await reload();
    } catch (error: any) {
      createMessage.error(error?.message || '解锁失败，请重试');
    } finally {
      operatingId.value = '';
    }
  }

  async function handleDelete(record: Recordable) {
    if (!assertPermission(PERMISSIONS.delete) || record.status !== QUOTATION_STATUS_DRAFT || operatingId.value) return;
    operatingId.value = String(record.id);
    try {
      await voidMaterialCandidate(record, false);
      createMessage.success('报价已删除');
      await reload();
    } catch (error: any) {
      createMessage.error(error?.message || '删除失败，请重试');
    } finally {
      operatingId.value = '';
    }
  }

  function getTableAction(record: Recordable): ActionItem[] {
    const locked = record.status !== QUOTATION_STATUS_DRAFT;
    const unlockable = record.status === QUOTATION_STATUS_SUBMITTED;
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
        label: '锁定',
        auth: PERMISSIONS.lock,
        ifShow: !locked,
        loading: operatingId.value === String(record.id),
        disabled: !!operatingId.value,
        popConfirm: {
          title: '锁定后不可修改或删除，确定锁定该报价吗？',
          confirm: handleLock.bind(null, record),
        },
      },
      {
        label: '解锁',
        auth: PERMISSIONS.unlock,
        ifShow: locked && unlockable,
        loading: operatingId.value === String(record.id),
        disabled: !!operatingId.value,
        popConfirm: {
          title: '解锁后报价可继续修改，确定解锁吗？',
          confirm: handleUnlock.bind(null, record),
        },
      },
      {
        label: '删除',
        color: 'error',
        auth: PERMISSIONS.delete,
        ifShow: !locked,
        disabled: !!operatingId.value,
        popConfirm: {
          title: '删除后报价及物料明细不可恢复，确定删除吗？',
          confirm: handleDelete.bind(null, record),
        },
      },
    ];
  }
</script>
