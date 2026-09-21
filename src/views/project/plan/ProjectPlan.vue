<template>
  <div class="project-plan">
    <!-- 第1部分: 顶部工具栏（按页保存） -->
    <div class="project-plan__toolbar">
      <div class="project-plan__toolbar-left">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="handleCancel">返回</a-button>
        <span class="project-plan__toolbar-title">{{ pageTitle }}</span>
        <a-button
          class="project-plan__detail-button"
          size="small"
          preIcon="ant-design:info-circle-outlined"
          :disabled="!contextReady"
          @click="handleBasicDetail"
        >
          详情
        </a-button>
      </div>
      <div class="project-plan__toolbar-right">
        <template v-if="editable">
          <a-button
            v-if="currentTabSave"
            :preIcon="currentTabEditing ? 'ant-design:file-done-outlined' : 'ant-design:edit-outlined'"
            :loading="currentTabSaving"
            :disabled="submitting || tabSaveBusy || currentTabBusy"
            @click="handleSaveCurrentTab"
          >
            {{ currentTabEditing ? currentTabSaveLabel : '修改' }}
          </a-button>
          <a-button type="primary" preIcon="ant-design:audit-outlined" :loading="submitting" :disabled="tabSaveBusy" @click="handleSubmitAudit">
            提交审批
          </a-button>
        </template>
        <template v-else-if="canAuditPlan">
          <a-button danger :disabled="submitting" @click="openRejectModal">驳 回</a-button>
          <a-popconfirm title="确认通过该计划方案？通过后项目将进入实施中。" @confirm="handleApproveAudit">
            <a-button type="primary" :loading="submitting">通 过</a-button>
          </a-popconfirm>
        </template>
        <a-tag v-else-if="permissionLoaded" color="default">{{ readonlyHint }}</a-tag>
      </div>
    </div>

    <!-- 第2部分: 内容盒子(与工具栏间隔 5px) -->
    <div class="project-plan__content">
      <div v-if="contextLoading || (!contextReady && !contextLoadFailed)" class="project-plan__state">
        <a-spin tip="正在加载项目与合同信息…" />
      </div>
      <a-result v-else-if="contextLoadFailed" status="error" title="计划上下文加载失败" :sub-title="contextErrorText">
        <template #extra>
          <a-button type="primary" @click="loadContext">重新加载</a-button>
        </template>
      </a-result>
      <a-tabs v-else v-model:activeKey="activeKey">
        <a-tab-pane key="file" tab="方案文件" force-render>
          <PlanFileMgmt
            ref="fileRef"
            :editable="writeEnabled && tabEditing.file"
            :period-id="periodId"
            @persisted-change="(persisted) => (tabEditing.file = !persisted)"
          />
        </a-tab-pane>
        <a-tab-pane key="material" tab="用料计划" force-render>
          <PlanMaterial
            ref="materialRef"
            :period-id="periodId"
            :editable="writeEnabled && tabEditing.material && !tabSaving.material"
            @persisted-change="handleMaterialPersistedChange"
          />
        </a-tab-pane>
        <a-tab-pane key="person" tab="人员配置" force-render>
          <PlanPerson
            ref="personRef"
            :editable="writeEnabled && !tabSaving.person"
            :outsource-editable="writeEnabled && tabEditing.person && !tabSaving.person"
            :period-id="periodId"
            @persisted-change="handlePersonPersistedChange"
            @members-change="handleMembersChange"
          />
        </a-tab-pane>
        <a-tab-pane key="implement" tab="实施计划" force-render>
          <PlanImplement
            ref="implementRef"
            :editable="writeEnabled && tabEditing.implement && !tabSaving.implement"
            :period-id="periodId"
            @persisted-change="handleImplementPersistedChange"
          />
        </a-tab-pane>
        <a-tab-pane key="position" tab="位置信息" force-render>
          <PlanPosition
            ref="positionRef"
            :editable="writeEnabled && tabEditing.position && !tabSaving.position"
            :period-id="periodId"
            @persisted-change="(persisted) => (tabEditing.position = !persisted)"
          />
        </a-tab-pane>
        <a-tab-pane key="payment" tab="回款计划" force-render>
          <PlanPayment ref="paymentRef" :period-id="periodId" :contract-record="contractRecord" :project-record="projectRecord" />
        </a-tab-pane>
      </a-tabs>
    </div>
    <ProjectBasicDrawer @register="registerProjectBasicDrawer" />
    <a-modal
      v-model:open="rejectModalOpen"
      title="驳回计划方案"
      ok-text="确认驳回"
      cancel-text="取消"
      :confirm-loading="submitting"
      :ok-button-props="{ danger: true }"
      :mask-closable="false"
      @ok="handleRejectAudit"
    >
      <a-alert
        class="project-plan__reject-warning"
        type="warning"
        show-icon
        message="当前接口暂不支持保存驳回原因"
        description="确认后只会把项目退回筹备中；原因需待后端扩展审批接口后才能持久化。"
      />
      <a-form layout="vertical">
        <a-form-item label="驳回原因" required>
          <a-textarea v-model:value="rejectReason" :rows="4" :maxlength="500" show-count placeholder="请填写驳回原因" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, computed, watch } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { useDrawer } from '/@/components/Drawer';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useUserStore } from '/@/store/modules/user';
  import PlanFileMgmt from './PlanFileMgmt.vue';
  import PlanMaterial from './PlanMaterial.vue';
  import PlanPerson from './PlanPerson.vue';
  import PlanImplement from './PlanImplement.vue';
  import PlanPosition from './PlanPosition.vue';
  import PlanPayment from './PlanPayment.vue';
  import ProjectBasicDrawer from '../components/ProjectBasicDrawer.vue';
  import { projectDetail, changePeriodStatus } from '../Project.api';
  import { addPlanProcessesBatch, editPlanOutsourcesBatch, editPlanProcessesBatch, editPlanLocationsBatch } from './Plan.api';
  import { editPlanMaterialBatch } from '/@/views/plan/Plan.api';
  import { contractDetail } from '/@/views/payment/Payment.api';
  import { refreshTodos } from '/@/views/todo/useTodoCenter';
  import { APPROVAL_PENDING, getApprovalStatusMeta, isApprovalPending } from '/@/utils/approvalStatus';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const userStore = useUserStore();
  const [registerProjectBasicDrawer, { openDrawer: openProjectBasicDrawer }] = useDrawer();

  // 当前标签
  const activeKey = ref('file');

  const contractRecord = ref<Recordable>({});
  const periodStatus = ref('');
  const planApprovalStatus = ref('');
  const permissionLoaded = ref(false);
  const contextLoading = ref(true);
  const contextReady = ref(false);
  const contextLoadFailed = ref(false);
  const contextErrorText = ref('请确认项目分期有效后重试。');
  const currentUserId = computed(() => {
    const user: any = userStore.getUserInfo;
    return String(user?.id ?? user?.userId ?? '');
  });
  // 只有合同审批时指定的项目经理可编写计划。
  const editable = computed(
    () =>
      route.query.mode !== 'view' &&
      permissionLoaded.value &&
      contextReady.value &&
      periodStatus.value === 'PREPARING' &&
      !!currentUserId.value &&
      String(contractRecord.value.projectManagerUserId ?? '') === currentUserId.value
  );
  const isAuditView = computed(() => route.query.mode === 'view' && route.query.audit === '1');
  const canAuditPlan = computed(
    () =>
      isAuditView.value &&
      permissionLoaded.value &&
      contextReady.value &&
      periodStatus.value === 'PENDING_APPROVAL' &&
      isApprovalPending(planApprovalStatus.value) &&
      hasPermission('project:plan:audit')
  );
  const readonlyHint = computed(() => {
    if (contextLoading.value) return '正在加载计划上下文';
    if (contextLoadFailed.value) return '项目或合同信息加载失败';
    if (!isAuditView.value && periodStatus.value === 'PENDING_APPROVAL') return '计划已提交审批，当前仅可查看';
    if (route.query.mode !== 'view' && periodStatus.value !== 'PREPARING') return '仅筹备中的项目可编辑计划';
    if (!isAuditView.value) return '仅合同审批指定的项目经理可编辑';
    if (periodStatus.value !== 'PENDING_APPROVAL') return '当前项目不在计划待审批状态';
    if (planApprovalStatus.value && !isApprovalPending(planApprovalStatus.value)) {
      return `该计划审批状态为「${getApprovalStatusMeta(planApprovalStatus.value).text}」`;
    }
    if (!hasPermission('project:plan:audit')) return '当前账号无计划审批权限';
    return '计划状态加载失败，暂无法审批';
  });

  // 分期 ID 必须跟随路由变化：同路由切换 query 时 Vue 会复用当前组件。
  const periodId = computed(() => {
    const value = route.query?.periodId;
    return String(Array.isArray(value) ? value[0] || '' : value || '').trim();
  });

  const pageTitle = computed(() => (editable.value ? '编辑计划方案' : '查看计划方案'));

  // 项目记录（保持项目字段原样，合同数据单独存放，避免同名字段互相覆盖）
  const projectRecord = ref<Recordable>({});

  function handleBasicDetail() {
    if (!periodId.value) {
      createMessage.warning('缺少项目分期 ID，无法查看项目详情');
      return;
    }
    openProjectBasicDrawer(true, { record: { ...projectRecord.value, periodId: periodId.value }, useProvidedDetail: true });
  }

  // 子组件引用
  const fileRef = ref();
  const materialRef = ref();
  const personRef = ref();
  const implementRef = ref();
  const positionRef = ref();
  const paymentRef = ref();
  const tabSaving = reactive({ file: false, material: false, person: false, implement: false, position: false });
  const tabEditing = reactive({ file: false, material: false, person: false, implement: false, position: false });
  const submitting = ref(false);
  const writeEnabled = computed(() => editable.value && !submitting.value);
  const tabSaveBusy = computed(() => Object.values(tabSaving).some(Boolean));
  const tabSaveHandlers = {
    file: saveFileTab,
    material: saveMaterialTab,
    person: savePersonTab,
    implement: saveImplementTab,
    position: savePositionTab,
  };
  type SavableTab = keyof typeof tabSaveHandlers;
  const currentTabKey = computed<SavableTab | undefined>(() =>
    Object.prototype.hasOwnProperty.call(tabSaveHandlers, activeKey.value) ? (activeKey.value as SavableTab) : undefined
  );
  const currentTabSave = computed<(() => Promise<unknown>) | undefined>(() => {
    const key = currentTabKey.value;
    return key ? tabSaveHandlers[key] : undefined;
  });
  const currentTabSaving = computed(() => {
    const key = currentTabKey.value;
    return key ? tabSaving[key] : false;
  });
  const currentTabEditing = computed(() => {
    const key = currentTabKey.value;
    return key ? tabEditing[key] : false;
  });
  const currentTabBusy = computed(() => {
    const key = currentTabKey.value;
    const state = key ? getTabSubmissionState(key) : undefined;
    return !!(state?.loading || state?.saving);
  });
  const currentTabSaveLabel = computed(() => (currentTabKey.value === 'person' ? '保存此页' : '保存本页'));

  function handleSaveCurrentTab() {
    const key = currentTabKey.value;
    if (!key) return;
    const state = getTabSubmissionState(key);
    if (!state || state.loading) {
      createMessage.warning('当前页数据仍在加载，请稍后再操作');
      return;
    }
    if (state.loaded === false || state.loadFailed) {
      createMessage.warning('当前页数据加载失败，请刷新后重试');
      return;
    }
    if (!tabEditing[key]) {
      tabEditing[key] = true;
      return;
    }
    return tabSaveHandlers[key]();
  }

  function handleMaterialPersistedChange(persisted: boolean) {
    tabEditing.material = !persisted;
  }

  function handleImplementPersistedChange(persisted: boolean) {
    tabEditing.implement = !persisted;
  }

  function handlePersonPersistedChange(persisted: boolean) {
    tabEditing.person = !persisted;
  }

  function handleMembersChange() {
    void implementRef.value?.reloadLeaders?.();
  }

  function saveProcessRecords(implementData: any) {
    const payload = {
      periodId: periodId.value,
      plannedAcceptanceDate: implementData.acceptanceDate,
      plannedAcceptanceRemark: implementData.remark || null,
      records: implementData.processList || [],
    };
    return implementData.isUpdate ? editPlanProcessesBatch(payload) : addPlanProcessesBatch(payload);
  }

  async function runTabSave(key: keyof typeof tabSaving, label: string, action: () => Promise<unknown>, reload: () => Promise<unknown>) {
    if (!editable.value) {
      createMessage.warning('仅合同审批指定的项目经理可保存计划');
      return false;
    }
    if (!periodId.value) {
      createMessage.warning('缺少项目分期 ID，无法保存');
      return false;
    }
    const state = getTabSubmissionState(key);
    if (!state || state.loading) {
      createMessage.warning(`${label}仍在加载，请稍后再保存`);
      return false;
    }
    if (state.loaded === false || state.loadFailed) {
      createMessage.warning(`${label}加载失败，为避免覆盖原数据，请刷新后重试`);
      return false;
    }
    if (tabSaving[key] || submitting.value) return false;
    tabSaving[key] = true;
    try {
      await action();
      await reload();
      const reloadedState = getTabSubmissionState(key);
      if (!reloadedState || reloadedState.loading || reloadedState.loaded === false || reloadedState.loadFailed) {
        throw new Error(`${label}已提交保存，但最新数据回查失败，请刷新确认`);
      }
      createMessage.success(`${label}已保存`);
      return true;
    } catch (error: any) {
      createMessage.warning(error?.message || `${label}保存失败，请重试`);
      return false;
    } finally {
      tabSaving[key] = false;
    }
  }

  async function saveFileTab() {
    const saved = await runTabSave(
      'file',
      '方案文件',
      async () => fileRef.value.saveAll(),
      async () => {}
    );
    if (saved) tabEditing.file = false;
    return saved;
  }

  async function savePositionTab() {
    const targetPeriodId = periodId.value;
    const saved = await runTabSave(
      'position',
      '位置信息',
      async () => editPlanLocationsBatch({ periodId: targetPeriodId, records: positionRef.value.getData() }, false),
      async () => {
        if (targetPeriodId !== periodId.value) throw new Error('项目分期已切换，请在原分期确认保存结果');
        await positionRef.value?.reload?.();
      }
    );
    if (saved && targetPeriodId === periodId.value) tabEditing.position = false;
    return saved;
  }

  async function saveMaterialTab() {
    const saved = await runTabSave(
      'material',
      '用料计划',
      async () => editPlanMaterialBatch({ periodId: periodId.value, records: (await materialRef.value?.getData?.()) || [] }, false),
      async () => materialRef.value?.reload?.()
    );
    // 空清单也是一次有效保存，不能用“是否有行”代替“是否已保存”。
    if (saved) tabEditing.material = false;
    return saved;
  }

  async function savePersonTab() {
    const saved = await runTabSave(
      'person',
      '人员配置',
      async () => editPlanOutsourcesBatch({ periodId: periodId.value, records: personRef.value?.getOutsourceRecords?.() || [] }),
      async () => personRef.value?.reloadOutsources?.()
    );
    if (saved) tabEditing.person = false;
  }

  async function saveImplementTab() {
    const saved = await runTabSave(
      'implement',
      '实施计划',
      async () => {
        const data = implementRef.value?.getData?.() || {};
        await saveProcessRecords(data);
      },
      async () => implementRef.value?.reload?.()
    );
    if (saved) tabEditing.implement = false;
    return saved;
  }

  /**
   * 加载项目信息(头部上下文/回款自动带出)
   */
  async function loadContext() {
    const requestSequence = ++contextLoadSequence;
    const targetPeriodId = periodId.value;
    contextLoading.value = true;
    contextReady.value = false;
    contextLoadFailed.value = false;
    permissionLoaded.value = false;
    contractRecord.value = {};
    projectRecord.value = {};
    periodStatus.value = '';
    planApprovalStatus.value = '';
    if (!targetPeriodId) {
      contextLoading.value = false;
      contextLoadFailed.value = true;
      contextErrorText.value = '缺少项目分期 ID，无法加载计划方案。';
      permissionLoaded.value = true;
      return;
    }
    try {
      const [projectResult, contractResult] = await Promise.allSettled([
        projectDetail({ periodId: targetPeriodId }, true),
        contractDetail({ periodId: targetPeriodId }, true),
      ]);
      if (requestSequence !== contextLoadSequence || targetPeriodId !== periodId.value) return;
      if (projectResult.status === 'rejected' || contractResult.status === 'rejected') {
        const bothFailed = projectResult.status === 'rejected' && contractResult.status === 'rejected';
        contextLoadFailed.value = true;
        contextErrorText.value = bothFailed
          ? '项目与合同信息均未加载成功。为避免子页使用空上下文，请重试。'
          : '项目或合同信息未完整加载。为避免错误编辑与覆盖，请重试。';
        return;
      }

      const project = (projectResult.value as Recordable) || {};
      const contract = (contractResult.value as Recordable) || {};
      contractRecord.value = contract;
      periodStatus.value = String(project.status || '');
      // 兼容后端切换期：生命周期待审批可推导为审批状态 2，其他状态不做推断。
      planApprovalStatus.value = String(project.approvalStatus ?? (project.status === 'PENDING_APPROVAL' ? APPROVAL_PENDING : ''));
      projectRecord.value = project;
      contextReady.value = true;
    } catch {
      if (requestSequence !== contextLoadSequence || targetPeriodId !== periodId.value) return;
      contextLoadFailed.value = true;
      contextErrorText.value = '项目与合同信息加载时发生异常。为避免错误编辑与覆盖，请重试。';
    } finally {
      if (requestSequence === contextLoadSequence && targetPeriodId === periodId.value) {
        contextLoading.value = false;
        permissionLoaded.value = true;
      }
    }
  }

  /**
   * 提交审批只负责项目状态流转，不再隐式保存任何页签数据。
   */
  const rejectModalOpen = ref(false);
  const rejectReason = ref('');

  const planTabLabels = {
    file: '方案文件',
    material: '用料计划',
    person: '人员配置',
    implement: '实施计划',
    position: '位置信息',
    payment: '回款计划',
  } as const;
  type PlanTabKey = keyof typeof planTabLabels;
  const planTabKeys = Object.keys(planTabLabels) as PlanTabKey[];
  watch(activeKey, (key) => {
    // 首次进入由子页挂载时加载；已挂载页签再次激活仅刷新成员，保留工序/外协草稿。
    if (key === 'person') void personRef.value?.reloadPeople?.();
    if (key === 'implement') void implementRef.value?.reloadLeaders?.();
  });

  function getTabSubmissionState(key: PlanTabKey) {
    const refs: Record<PlanTabKey, any> = {
      file: fileRef.value,
      material: materialRef.value,
      person: personRef.value,
      implement: implementRef.value,
      position: positionRef.value,
      payment: paymentRef.value,
    };
    return refs[key]?.getSubmissionState?.();
  }

  function focusTab(key: PlanTabKey) {
    activeKey.value = key;
  }

  function validateBeforeSubmit() {
    for (const key of planTabKeys) {
      const state = getTabSubmissionState(key);
      if (!state) {
        focusTab(key);
        return `「${planTabLabels[key]}」尚未就绪，请稍后再提交`;
      }
      if (state.loading || state.saving) {
        focusTab(key);
        return `「${planTabLabels[key]}」正在${state.saving ? '保存' : '加载'}，请完成后再提交`;
      }
      if (state.loaded === false || state.loadFailed) {
        focusTab(key);
        return `「${planTabLabels[key]}」加载失败，为避免提交不完整计划，请刷新后重试`;
      }
      if (state.dirty) {
        focusTab(key);
        return `「${planTabLabels[key]}」还有未保存内容，请先保存`;
      }
    }

    const businessValidators: Array<{ key: PlanTabKey; validate: () => unknown }> = [
      { key: 'material', validate: () => materialRef.value?.getData?.() },
      { key: 'person', validate: () => personRef.value?.getOutsourceRecords?.() },
      { key: 'implement', validate: () => implementRef.value?.getData?.() },
    ];
    for (const { key, validate } of businessValidators) {
      try {
        validate();
      } catch (error: any) {
        focusTab(key);
        return error?.message || `「${planTabLabels[key]}」数据校验未通过`;
      }
    }

    return '';
  }

  function openRejectModal() {
    rejectReason.value = '';
    rejectModalOpen.value = true;
  }

  async function handleApproveAudit() {
    if (!periodId.value || !canAuditPlan.value || submitting.value) return;
    const validationMessage = validateBeforeSubmit();
    if (validationMessage) {
      createMessage.warning(validationMessage);
      return;
    }
    submitting.value = true;
    try {
      await changePeriodStatus({ periodId: periodId.value, status: 'IMPLEMENTING' });
      createMessage.success('审批通过，项目开始实施');
      refreshTodos(true).catch(() => undefined);
      router.push('/project/list');
    } finally {
      submitting.value = false;
    }
  }

  async function handleRejectAudit() {
    if (!periodId.value || !canAuditPlan.value || submitting.value) return;
    if (!rejectReason.value.trim()) {
      createMessage.warning('请填写驳回原因');
      return;
    }
    submitting.value = true;
    try {
      await changePeriodStatus({ periodId: periodId.value, status: 'PREPARING' });
      createMessage.warning('已驳回并退回筹备中；当前接口未持久化驳回原因');
      rejectModalOpen.value = false;
      refreshTodos(true).catch(() => undefined);
      router.push('/project/list');
    } finally {
      submitting.value = false;
    }
  }

  async function handleSubmitAudit() {
    if (!periodId.value || !editable.value || submitting.value) return;
    if (tabSaveBusy.value) {
      createMessage.warning('当前页仍在保存，请完成后再提交审批');
      return;
    }
    const validationMessage = validateBeforeSubmit();
    if (validationMessage) {
      createMessage.warning(validationMessage);
      return;
    }
    submitting.value = true;
    try {
      await changePeriodStatus({ periodId: periodId.value, status: 'PENDING_APPROVAL' });
      createMessage.success('计划已提交审批，项目进入「待审批」');
      refreshTodos(true).catch(() => undefined);
      router.push('/project/list');
    } finally {
      submitting.value = false;
    }
  }

  /**
   * 取消
   */
  function handleCancel() {
    router.push('/project/list');
  }

  let contextLoadSequence = 0;

  watch(
    periodId,
    () => {
      activeKey.value = 'file';
      Object.assign(tabEditing, { file: false, material: false, person: false, implement: false, position: false });
      Object.assign(tabSaving, { file: false, material: false, person: false, implement: false, position: false });
      rejectModalOpen.value = false;
      rejectReason.value = '';
      void loadContext();
    },
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .project-plan {
    padding: 16px;

    // 第1部分: 顶部工具栏
    &__toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fff;
      border-radius: 8px;
      padding: 10px 20px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      margin-bottom: 5px; // 与内容盒子的间隔

      &-left {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      &-title {
        font-weight: 600;
        font-size: 16px;
        color: #333;
      }

      &-right {
        display: flex;
        gap: 8px;
      }
    }

    &__detail-button {
      margin-inline-start: 6px;
    }

    &__reject-warning {
      margin-bottom: 16px;
    }

    // 第2部分: 内容盒子(tab 栏与内容分开)
    &__content {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      overflow: hidden;

      .project-plan__state {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 320px;
      }

      // tab 栏: 独立色条 + 底部分隔线, 与内容明显分开
      :deep(.ant-tabs-nav) {
        margin-bottom: 0;
        padding: 0 16px;
        background: #fafafa;
        border-bottom: 1px solid #e8e8e8;

        &::before {
          border-bottom: none;
        }
      }

      :deep(.ant-tabs-tab) {
        padding: 12px 20px;
        font-weight: 500;
        margin: 0 4px;
        border: none !important;
        background: transparent !important;
        border-radius: 0 !important;

        &.ant-tabs-tab-active {
          color: #1890ff;
          font-weight: 600;
        }
      }

      :deep(.ant-tabs-ink-bar) {
        background: #1890ff;
        height: 3px;
      }

      // 内容区: 独立留白
      :deep(.ant-tabs-content-holder) {
        padding: 20px;
      }
    }
  }
</style>
