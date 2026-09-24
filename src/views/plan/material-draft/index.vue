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
        <template v-else-if="column.dataIndex === 'adopted'">
          <a-tag :color="isQuotationAdopted(record) ? 'success' : 'default'">{{ isQuotationAdopted(record) ? '已采用' : '未采用' }}</a-tag>
        </template>
      </template>
    </BasicTable>

    <a-modal v-model:open="addModalOpen" title="新增报价" ok-text="下一步" cancel-text="取消" :confirm-loading="periodLoading" :ok-button-props="{ disabled: periodLoading || !selectedPeriodId }" @ok="confirmAdd">
      <a-form layout="vertical">
        <a-form-item label="项目分期" required>
          <a-select
            v-model:value="selectedPeriodId"
            show-search
            allow-clear
            option-filter-prop="label"
            :options="periodOptions"
            :loading="periodLoading"
            @dropdown-visible-change="loadPeriods"
            placeholder="请选择需要报价的项目分期"
          >
            <template #notFoundContent>
              <span v-if="periodLoading" role="status"><a-spin size="small" /> 正在加载项目分期…</span>
              <span v-else>{{ periodFailed ? '加载失败，请重新展开重试' : '暂无匹配的项目分期' }}</span>
            </template>
          </a-select>
        </a-form-item>
      </a-form>
      <a-empty v-if="periodLoaded && !periodLoading && !periodOptions.length" description="当前没有可新增报价的项目分期" />
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
  import { useUserStore } from '/@/store/modules/user';
  import { quotationListStatusMap, quotationColumns, quotationSearchFormSchema } from '../Plan.data';
  import { exportCandidateMaterials } from '../materialExcel';
  import {
    getQuotationPeriods,
    isQuotationAdopted,
    quotationList,
    candidateAction,
    checkCandidateExport,
    getCandidateExportData,
  } from '../Plan.api';
  import { quotationListCapabilities } from '../quotationGovernance';

  defineOptions({ name: 'QuotationManagementList' });

  const PERMISSIONS = {
    add: 'plan:quotation:add',
  } as const;

  const router = useRouter();
  const userStore = useUserStore();
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
  const periodLoaded = ref(false);
  const periodFailed = ref(false);
  let periodSequence = 0;

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
      rowKey: 'id',
      columns: [
        ...quotationColumns,
        { title: '定价状态', dataIndex: 'priced', width: 100, customRender: ({ text }) => (String(text) === '1' ? '已定价' : '未定价') },
      ],
      actionColumn: { width: 390, fixed: 'right', title: '操作', dataIndex: 'action', slots: { customRender: 'action' } },
      canResize: true,
      useSearchForm: true,
      formConfig: { schemas: quotationSearchFormSchema, autoSubmitOnEnter: true, showAdvancedButton: false },
      pagination: { pageSize: 10, showTotal: (total) => `共 ${total} 条报价` },
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
    periodSequence++;
    periodLoading.value = false;
    periodLoaded.value = false;
    periodFailed.value = false;
    periodOptions.value = [];
  }

  async function loadPeriods(open: boolean) {
    if (!open || periodLoading.value || periodLoaded.value) return;
    const sequence = ++periodSequence;
    periodLoading.value = true;
    periodFailed.value = false;
    try {
      const periods = await getQuotationPeriods();
      if (sequence !== periodSequence) return;
      periodOptions.value = periods.map((item: any) => ({
        value: String(item.periodId),
        projectName: String(item.projectName || '').trim(),
        label: `${item.projectName || '未命名主项目'} / ${item.periodName || '未命名分期'}（${item.periodId}）`,
      }));
      periodLoaded.value = true;
    } catch (error: any) {
      if (sequence !== periodSequence) return;
      periodFailed.value = true;
      periodOptions.value = [];
      createMessage.error(error?.message || '项目分期加载失败，请重试');
    } finally {
      if (sequence === periodSequence) periodLoading.value = false;
    }
  }

  function confirmAdd() {
    if (periodLoading.value || !periodLoaded.value) return;
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

  function openEditor(record: Recordable, mode = 'view', audit = false) {
    router.push({
      path: '/plan/material-draft/editor',
      query: {
        mode, ...(audit ? { audit: '1' } : {}), periodId: record.periodId, candidateId: record.id,
        version: record.version, candidateName: record.candidateName, status: record.status,
        adopted: record.adopted, priced: record.priced, createBy: record.createBy,
      },
    });
  }

  async function handleExport(record: Recordable) {
    if (exportingId.value) return;
    if (!assertPermission('plan:quotation:export')) return;
    exportingId.value = String(record.id);
    try {
      const check = await checkCandidateExport(record);
      if (check?.allowed !== true) throw new Error(check?.reason || '当前无导出资格，请刷新');
      const data = await getCandidateExportData(record);
      await exportCandidateMaterials(data);
      createMessage.success('报价物料清单已导出');
    } catch (error: any) {
      createMessage.error(error?.message || '导出失败，请刷新后重试');
    } finally {
      exportingId.value = '';
    }
  }

  async function act(record: Recordable, action: 'submit' | 'withdraw' | 'void') {
    if (operatingId.value) return;
    operatingId.value = String(record.id);
    try {
      if (!quotationListCapabilities(record, hasPermission, userStore.getUserInfo)[action]) throw new Error('当前无此操作权限');
      // 始终传列表显示时的版本；不把新版本套到旧数据上重试。
      await candidateAction(action, record);
      createMessage.success('操作成功');
      await reload();
    } catch (error: any) {
      createMessage.error(error?.message || '操作失败，请刷新后重试');
    } finally {
      operatingId.value = '';
    }
  }

  function getTableAction(record: Recordable): ActionItem[] {
    const caps = quotationListCapabilities(record, hasPermission, userStore.getUserInfo);
    const ready = record.version != null;
    return [
      { label: '查看详情', onClick: () => openEditor(record) },
      { label: record.approvalRoute === 'MARKET' ? '市场审批' : '技术审批', ifShow: ready && caps.approve, onClick: () => openEditor(record, 'view', true) },
      { label: '市场定价', ifShow: ready && caps.price, onClick: () => openEditor(record, 'price') },
      {
        label: '导出',
        ifShow: ready && caps.export,
        loading: exportingId.value === String(record.id),
        disabled: !!exportingId.value,
        onClick: () => handleExport(record),
      },
      ...(['submit', 'withdraw', 'void'] as const).map((action) => ({
        label: { submit: '提交审批', withdraw: '撤回', void: '作废' }[action],
        ifShow: ready && caps[action],
        disabled: !!operatingId.value,
        popConfirm: {
          title: { submit: '确认提交报价审批？', withdraw: '确认撤回报价审批？', void: '确认作废此报价？' }[action],
          confirm: () => act(record, action),
        },
      })),
    ];
  }
</script>
