<template>
  <div>
    <!-- 项目列表 -->
    <BasicTable @register="registerTable">
      <!-- 插槽:table标题 -->
      <template #tableTitle>
        <a-button v-if="hasPermission('project:add')" type="primary" @click="handleAdd" preIcon="ant-design:plus-outlined"> 新增</a-button>
      </template>
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" :dropDownActions="getDropDownAction(record)" />
      </template>
      <!-- 字段回显插槽 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusMeta[record.status]?.color || statusColorMap[record.status] || 'default'">
            {{ statusMeta[record.status]?.text || projectStatusMap[record.status] || record.status || '—' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'contractStatus'">
          <a-tag :color="getApprovalStatusMeta(record.contractStatus).color">
            {{ getApprovalStatusMeta(record.contractStatus).text }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'arrivalStatus'">
          <a-tag :color="Number(record.arrivalStatus) === 1 ? 'success' : 'default'">
            {{ Number(record.arrivalStatus) === 1 ? '已到货' : '未到货' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'projectType'">
          {{ projectTypeMeta[record.projectType] || record.projectType || '—' }}
        </template>
        <template v-else-if="column.dataIndex === 'projectLiaisonUserName'">
          {{ getProjectLiaisonName(record) }}
        </template>
      </template>
    </BasicTable>
    <a-modal
      v-model:open="createProjectModalOpen"
      title="选择新增项目类型"
      ok-text="进入填写"
      cancel-text="取消"
      :confirm-loading="mainProjectLoading"
      :ok-button-props="{ disabled: createProjectMode === 'period' && !selectedMainProjectId }"
      :mask-closable="false"
      @ok="handleCreateProjectConfirm"
    >
      <div class="project-create-mode">
        <a-radio-group v-model:value="createProjectMode" class="project-create-mode__options">
          <label class="project-create-mode__option" :class="{ active: createProjectMode === 'project' }">
            <a-radio value="project">新建主项目</a-radio>
            <span>创建一个全新的主项目，并同时填写首个分期信息。</span>
          </label>
          <label class="project-create-mode__option" :class="{ active: createProjectMode === 'period' }">
            <a-radio value="period">已有主项目下新增分期</a-radio>
            <span>先选择所属主项目，再填写本次新增的分期信息。</span>
          </label>
        </a-radio-group>

        <a-form-item v-if="createProjectMode === 'period'" label="所属主项目" required class="project-create-mode__parent">
          <a-select
            v-model:value="selectedMainProjectId"
            show-search
            option-filter-prop="label"
            placeholder="请选择所属主项目"
            :options="mainProjectOptions"
            :loading="mainProjectLoading"
            not-found-content="暂无可选主项目"
          />
        </a-form-item>
      </div>
    </a-modal>
    <!-- 计划审批 -->
    <PlanAuditModal @register="registerPlanAuditModal" @success="handleAuditSuccess" />
    <ArrivalConfirmModal @register="registerArrivalConfirmModal" @success="reload" />
    <AcceptanceModal @register="registerAcceptanceModal" @success="reload" />
    <MaterialSupplementDrawer @register="registerMaterialSupplementDrawer" @success="handleSupplementSuccess" />
    <ProcessCompletionDrawer @register="registerProcessCompletionDrawer" @success="reload" />
  </div>
</template>

<script lang="ts" name="project-projectlist" setup>
  import { reactive, ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useDrawer } from '/@/components/Drawer';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema, statusFlow, projectStatusMap, statusColorMap, loadProjectStatusMap, loadProjectTypeMap } from './Project.data';
  import { projectList, projectDetail, deleteProject, changePeriodStatus, getMainProjectList } from './Project.api';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getApprovalStatusMeta, isApprovalApproved } from '/@/utils/approvalStatus';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import PlanAuditModal from './components/PlanAuditModal.vue';
  import ArrivalConfirmModal from './components/ArrivalConfirmModal.vue';
  import AcceptanceModal from './components/AcceptanceModal.vue';
  import { usePermission } from '/@/hooks/web/usePermission';
  import MaterialSupplementDrawer from './components/MaterialSupplementDrawer.vue';
  import ProcessCompletionDrawer from './components/ProcessCompletionDrawer.vue';
  import { refreshTodos } from '/@/views/todo/useTodoCenter';

  import { useAcceptanceAccess } from './useAcceptanceAccess';

  const { canOperateAcceptance, canStartAcceptance, canViewAcceptanceEntry } = useAcceptanceAccess();
  const router = useRouter();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();

  const [registerPlanAuditModal, { openModal: openPlanAuditModal }] = useModal();
  const [registerArrivalConfirmModal, { openModal: openArrivalConfirmModal }] = useModal();
  const [registerAcceptanceModal, { openModal: openAcceptanceModal }] = useModal();
  const [registerMaterialSupplementDrawer, { openDrawer: openMaterialSupplementDrawer }] = useDrawer();
  const [registerProcessCompletionDrawer, { openDrawer: openProcessCompletionDrawer }] = useDrawer();

  // 状态字典映射(数据源 project_period_status, 加载失败回退 projectStatusMap)
  const statusMeta = ref<Recordable>({});
  // 项目类型字典映射(数据源 project_type)
  const projectTypeMeta = ref<Recordable>({});
  // 项目对接人姓名映射；接口姓名快照为空时按用户 ID 补齐。
  const liaisonNameMap = ref<Recordable>({});
  let liaisonOptionsPromise: Promise<{ label: string; value: string }[]> | null = null;

  const queryParam = reactive<any>({});
  const createProjectModalOpen = ref(false);
  const createProjectMode = ref<'project' | 'period'>('project');
  const selectedMainProjectId = ref<string>();
  const mainProjectOptions = ref<{ label: string; value: string }[]>([]);
  const mainProjectLoading = ref(false);

  async function loadLiaisonOptions() {
    liaisonOptionsPromise ||= loadUserOptions().catch(() => []);
    const users = await liaisonOptionsPromise;
    liaisonNameMap.value = users.reduce((map, user) => {
      map[user.value] = user.label;
      return map;
    }, {} as Recordable);
    return users;
  }

  function getProjectLiaisonUserId(record: Recordable) {
    return record.projectLiaisonUserId ?? record.projectLiaisonId ?? record.projectLeaderId;
  }

  function getProjectLiaisonName(record: Recordable) {
    const snapshot = record.projectLiaisonUserName || record.projectLiaisonName || record.projectLeaderName;
    if (snapshot && snapshot !== '—') return snapshot;
    return liaisonNameMap.value[String(getProjectLiaisonUserId(record) ?? '')] || '—';
  }

  async function enrichProjectLiaisons(records: Recordable[]) {
    await loadLiaisonOptions();
    return Promise.all(
      (records || []).map(async (record) => {
        if (getProjectLiaisonName(record) !== '—') return record;
        const currentPeriodId = record.periodId || record.id;
        if (!currentPeriodId) return record;
        try {
          const detail: any = await projectDetail({ periodId: currentPeriodId });
          return {
            ...record,
            projectLiaisonUserId: detail?.projectLiaisonUserId ?? getProjectLiaisonUserId(record),
            projectLiaisonUserName:
              detail?.projectLiaisonUserName || detail?.projectLiaisonName || detail?.projectLeaderName || record.projectLiaisonUserName,
          };
        } catch {
          return record;
        }
      })
    );
  }

  onMounted(async () => {
    const [loadedStatusMeta, loadedProjectTypeMeta] = await Promise.all([loadProjectStatusMap(), loadProjectTypeMap(), loadLiaisonOptions()]);
    statusMeta.value = loadedStatusMeta;
    projectTypeMeta.value = loadedProjectTypeMeta;
  });

  // 注册table数据
  const { tableContext } = useListPage({
    tableProps: {
      title: '项目管理',
      api: projectList,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: false,
        fieldMapToTime: [],
      },
      actionColumn: {
        width: 400,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
      afterFetch: enrichProjectLiaisons,
    },
  });

  const [registerTable, { reload }] = tableContext;

  /** 新增前先明确是新建主项目，还是给已有主项目新增分期。 */
  async function handleAdd() {
    if (!hasPermission('project:add')) {
      createMessage.warning('暂无新增项目权限，请联系管理员授权');
      return;
    }
    createProjectMode.value = 'project';
    selectedMainProjectId.value = undefined;
    createProjectModalOpen.value = true;
    if (mainProjectOptions.value.length || mainProjectLoading.value) return;
    mainProjectLoading.value = true;
    try {
      const res: any = await getMainProjectList({ pageNo: 1, pageSize: 1000 });
      const records = res?.records || res || [];
      mainProjectOptions.value = records.map((item: Recordable) => ({
        label: [item.projectName || '未命名主项目', item.projectNo].filter(Boolean).join(' · '),
        value: String(item.id),
      }));
    } finally {
      mainProjectLoading.value = false;
    }
  }

  function handleCreateProjectConfirm() {
    if (!hasPermission('project:add')) {
      createProjectModalOpen.value = false;
      createMessage.warning('暂无新增项目权限，请联系管理员授权');
      return;
    }
    if (createProjectMode.value === 'period' && !selectedMainProjectId.value) {
      createMessage.warning('请选择所属主项目');
      return;
    }
    createProjectModalOpen.value = false;
    router.push({
      path: '/project/apply',
      query: createProjectMode.value === 'period' ? { mode: 'period', parentProjectId: selectedMainProjectId.value } : { mode: 'project' },
    });
  }

  /** 统一计划入口：筹备中编辑，提交后只读查看。 */
  function handlePlan(record: Recordable) {
    router.push({
      path: '/project/plan',
      query: { periodId: record.periodId || record.id, ...(canEditPlan(record) ? {} : { mode: 'view' }) },
    });
  }

  function handleMaterialSupplement(record: Recordable) {
    openMaterialSupplementDrawer(true, { record, allowCreate: canApplyMaterialSupplement(record) });
  }

  function canApplyMaterialSupplement(record: Recordable) {
    return ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED'].includes(String(record.status || ''));
  }

  const arrivalConfirmableStatuses = new Set(['PENDING_APPROVAL', 'IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED']);

  /** 从待计划审批到实施完成前允许确认一次到货；已到货或实施完成后隐藏。 */
  function canConfirmArrival(record: Recordable) {
    return Number(record.arrivalStatus) !== 1 && arrivalConfirmableStatuses.has(String(record.status || ''));
  }

  function handleConfirmArrival(record: Recordable) {
    openArrivalConfirmModal(true, { record, periodId: record.periodId || record.id });
  }

  /** 计划审批前仅筹备中的项目允许编辑；审批通过后只能查看计划详情。 */
  function canEditPlan(record: Recordable) {
    return String(record.status || '') === 'PREPARING';
  }

  /** 已提交合同统一进入合同信息页查看和处理，不再使用独立审批弹窗。 */
  function handleContractInfo(record: Recordable) {
    router.push({
      path: '/project/contract',
      query: { mode: 'view', periodId: record.periodId || record.id, projectId: record.projectId },
    });
  }

  function isContractSubmitted(record: Recordable) {
    return !!record.contractId || ['-1', '0', '1', '2', '3'].includes(String(record.contractStatus ?? ''));
  }

  /**
   * 详情: 跳转项目详情页(8-tab), id 为分期ID
   */
  function handleDetail(record: Recordable) {
    router.push({ path: `/project/detail/${record.periodId || record.id}` });
  }

  /**
   * 删除(后端仅允许删分期)
   */
  async function handleDelete(record: Recordable) {
    await deleteProject({ periodId: record.periodId || record.id });
    createMessage.success(`删除分期「${record.periodName || record.projectName}」成功`);
    reload();
  }

  /**
   * 计划审批成功回调
   */
  function handleAuditSuccess() {
    reload();
  }

  function handleSupplementSuccess() {
    reload();
    refreshTodos(true).catch(() => undefined);
  }

  /**
   * 状态推进: 前端传 periodId + status 给统一状态变更接口
   * act='contractSign': 跳转「合同信息」页面(合同提交后项目→筹备中)
   * act='planAudit': 打开「计划审批」弹窗(待审批→通过/驳回)
   */
  async function handleAdvance(record: Recordable, action: any) {
    if (action.act === 'contractSign') {
      router.push({
        path: '/project/contract',
        query: { mode: 'create', periodId: record.periodId || record.id, projectId: record.projectId },
      });
      return;
    }
    if (action.act === 'planAudit') {
      openPlanAuditModal(true, { ...record, periodId: record.periodId || record.id, record });
      return;
    }
    if (action.act === 'processComplete') {
      openProcessCompletionDrawer(true, { record, periodId: record.periodId || record.id });
      return;
    }
    await changePeriodStatus({ periodId: record.periodId || record.id, status: action.status });
    createMessage.success(`操作成功：${action.label}`);
    reload();
  }

  /**
   * 操作栏: 状态流转(项目创建后仅允许从详情页编辑基本信息)
   */
  function getTableAction(record: Recordable) {
    const flow = statusFlow[record.status];
    const actions = [];
    if (String(record.status || '') === 'ACCEPTING' && canViewAcceptanceEntry()) {
      const managerId = record.projectManagerUserId || record.projectManagerId;
      const canAccept = canOperateAcceptance('INTERNAL', managerId) || canOperateAcceptance('CUSTOMER', managerId);
      actions.push({
        label: '验收',
        disabled: !canAccept,
        tooltip: canAccept ? '填写验收结果' : '无本项目验收办理权限',
        onClick: () => {
          if (canViewAcceptanceEntry() && canAccept) openAcceptanceModal(true, { periodId: record.periodId || record.id });
        },
      });
    }
    if (record.status === 'PENDING_ACCEPT') {
      actions.push({
        label: '开始验收',
        disabled: !canStartAcceptance(),
        popConfirm: {
          title: '确认启动内部和外部验收？',
          confirm: async () => {
            if (!canStartAcceptance()) return;
            await changePeriodStatus({ periodId: record.periodId || record.id, status: 'PENDING_ACCEPT' });
            createMessage.success('验收已启动');
            await reload();
            refreshTodos(true).catch(() => undefined);
          },
        },
      });
    }
    if (flow && flow.actions) {
      flow.actions.forEach((action) => {
        // 明确返回合同 ID 或状态 0/1/2/3 时，均表示已有合同记录，不再显示「合同签订」。
        if (action.act === 'contractSign' && isContractSubmitted(record)) return;
        const item: Recordable = {
          label: action.label,
          auth: action.auth,
        };
        if (['contractSign', 'processComplete'].includes(action.act)) {
          // 合同签订和工序完成先打开各自办理界面，不在列表按钮上直接确认。
          item.onClick = handleAdvance.bind(null, record, action);
        } else {
          item.popConfirm = {
            title: `确认执行「${action.label}」？`,
            confirm: handleAdvance.bind(null, record, action),
            placement: 'topLeft',
          };
        }
        actions.push(item);
      });
    }
    // 合同通过前，列表统一显示合同信息入口；通过后仅从项目详情查看。
    if (isContractSubmitted(record) && !isApprovalApproved(record.contractStatus)) {
      actions.push({
        label: '合同信息',
        onClick: handleContractInfo.bind(null, record),
      });
    }
    // 高频计划入口直接展示在操作栏，不收进“更多”。
    if (canEditPlan(record) || String(record.status || '') === 'PENDING_APPROVAL') {
      actions.push({
        label: canEditPlan(record) ? '编辑计划方案' : '查看计划方案',
        onClick: handlePlan.bind(null, record),
      });
    }
    if (canConfirmArrival(record)) {
      actions.push({
        label: '确认到货',
        auth: 'project:arrival:confirm',
        onClick: handleConfirmArrival.bind(null, record),
      });
    }
    return actions;
  }

  /**
   * 下拉操作栏: 详情 + 删除
   */
  function getDropDownAction(record: Recordable) {
    const actions: Recordable[] = [
      {
        label: '详情',
        onClick: handleDetail.bind(null, record),
      },
      {
        label: '删除',
        popConfirm: {
          title: '是否确认删除该分期？',
          confirm: handleDelete.bind(null, record),
          placement: 'topLeft',
        },
      },
    ];
    if (canApplyMaterialSupplement(record)) {
      actions.splice(1, 0, {
        label: '补料管理',
        onClick: handleMaterialSupplement.bind(null, record),
      });
    }
    return actions;
  }
</script>

<style lang="less" scoped>
  .project-create-mode {
    &__options {
      display: grid;
      gap: 12px;
      width: 100%;
    }

    &__option {
      display: grid;
      gap: 6px;
      padding: 14px 16px;
      border: 1px solid #d9d9d9;
      border-radius: 8px;
      cursor: pointer;
      transition:
        border-color 0.2s,
        background-color 0.2s;

      &.active {
        border-color: #1890ff;
        background: #e6f7ff;
      }

      > span {
        padding-left: 24px;
        color: #595959;
        line-height: 1.6;
      }
    }

    &__parent {
      margin-top: 20px;
      margin-bottom: 0;
    }
  }
</style>
