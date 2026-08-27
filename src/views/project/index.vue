<template>
  <div>
    <!-- 项目列表 -->
    <BasicTable @register="registerTable">
      <!-- 插槽:table标题 -->
      <template #tableTitle>
        <a-button type="primary" @click="handleAdd" preIcon="ant-design:plus-outlined"> 新增</a-button>
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
        <template v-else-if="column.dataIndex === 'projectType'">
          {{ projectTypeMeta[record.projectType] || record.projectType || '—' }}
        </template>
        <template v-else-if="column.dataIndex === 'projectLiaisonUserName'">
          {{ getProjectLiaisonName(record) }}
        </template>
      </template>
    </BasicTable>
    <!-- 计划审批 -->
    <PlanAuditModal @register="registerPlanAuditModal" @success="handleAuditSuccess" />
  </div>
</template>

<script lang="ts" name="project-projectlist" setup>
  import { reactive, ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema, statusFlow, projectStatusMap, statusColorMap, loadProjectStatusMap, loadProjectTypeMap } from './Project.data';
  import { projectList, projectDetail, deleteProject, changePeriodStatus } from './Project.api';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getApprovalStatusMeta, isApprovalApproved } from '/@/utils/approvalStatus';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import PlanAuditModal from './components/PlanAuditModal.vue';

  const router = useRouter();
  const { createMessage } = useMessage();

  const [registerPlanAuditModal, { openModal: openPlanAuditModal }] = useModal();

  // 状态字典映射(数据源 project_period_status, 加载失败回退 projectStatusMap)
  const statusMeta = ref<Recordable>({});
  // 项目类型字典映射(数据源 project_type)
  const projectTypeMeta = ref<Recordable>({});
  // 项目对接人姓名映射；接口姓名快照为空时按用户 ID 补齐。
  const liaisonNameMap = ref<Recordable>({});
  let liaisonOptionsPromise: Promise<{ label: string; value: string }[]> | null = null;

  const queryParam = reactive<any>({});

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
        showAdvancedButton: true,
        fieldMapToTime: [],
      },
      actionColumn: {
        width: 300,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
      afterFetch: enrichProjectLiaisons,
    },
  });

  const [registerTable, { reload }] = tableContext;

  /**
   * 新增事件: 跳转新增项目页
   */
  function handleAdd() {
    router.push('/project/apply');
  }

  /**
   * 编辑计划方案: 跳转六标签计划页
   */
  function handleAddPlan(record: Recordable) {
    router.push({ path: '/project/plan', query: { periodId: record.periodId } });
  }

  /** 已提交合同统一进入合同信息页查看和处理，不再使用独立审批弹窗。 */
  function handleContractInfo(record: Recordable) {
    router.push({
      path: '/project/contract',
      query: { mode: 'view', periodId: record.periodId || record.id, projectId: record.projectId },
    });
  }

  function isContractSubmitted(record: Recordable) {
    return !!record.contractId || ['0', '1', '2', '3'].includes(String(record.contractStatus ?? ''));
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

  /**
   * 状态推进: 前端传 periodId + status 给统一状态变更接口
   * act='contractSign': 跳转「合同信息」页面(合同提交后项目→筹备中)
   * act='planAudit': 打开「计划审批」弹窗(待立项→通过/驳回)
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
    if (flow && flow.actions) {
      flow.actions.forEach((action) => {
        // 明确返回合同 ID 或状态 0/1/2/3 时，均表示已有合同记录，不再显示「合同签订」。
        if (action.act === 'contractSign' && isContractSubmitted(record)) return;
        const item: Recordable = {
          label: action.label,
          auth: action.auth,
        };
        if (action.act === 'contractSign') {
          // 合同签订: 直接打开弹窗, 无确认框
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
    if (isApprovalApproved(record.contractStatus) || record.status === 'PREPARING') {
      actions.push({
        label: '编辑计划方案',
        onClick: handleAddPlan.bind(null, record),
      });
    }
    return actions;
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
          title: '是否确认删除该分期？',
          confirm: handleDelete.bind(null, record),
          placement: 'topLeft',
        },
      },
    ];
  }
</script>
