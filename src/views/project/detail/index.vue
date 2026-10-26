<template>
  <div class="project-detail">
    <div class="project-detail__main">
      <!-- 顶部项目信息 -->
      <a-card class="project-detail__header">
        <div class="project-detail__header-left">
          <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
          <div class="project-detail__progress">
            <a-progress type="circle" :percent="progressPercent" :width="64" />
          </div>
          <div class="project-detail__info">
            <div class="project-detail__name">{{ projectDisplayName }}</div>
            <div class="project-detail__meta">
              <span
                >当前状态：<a-tag :color="statusColor">{{ statusText }}</a-tag></span
              >
              <span>项目类型：<DictValue code="project_type" :value="project.projectType" :fallback="projectTypeText" /></span>
              <span>甲方名称：{{ project.customerName || '—' }}</span>
              <span>项目对接人：{{ project.projectLiaisonUserName || '—' }}</span>
            </div>
          </div>
        </div>
      </a-card>

      <PeriodOperations v-if="detailReady" :key="projectId" :project="project" :manager="manager" :participant="participant" :type-names="projectTypeMeta" :material-visible="visibleTabs.includes('material')" :acceptance-visible="visibleTabs.includes('acceptance')" :has-primary="!!(businessActions.length || membershipError || canCreateQuotation || quotationApprovalVisible || quotationPricingVisible || quotationGrantVisible)" @changed="handleBusinessChanged" @acceptance="activeKey = 'acceptance'" @material="activeKey = 'material'">
        <a-space wrap>
          <a-button v-if="canCreateQuotation" type="primary" preIcon="ant-design:plus-outlined" @click="quotationCreate?.open()">新增报价</a-button>
          <a-button v-if="quotationApprovalVisible" :type="quotationApprovalError ? 'default' : 'primary'" :danger="!!quotationApprovalError" preIcon="ant-design:audit-outlined" :loading="quotationApprovalLoading || quotationApprovalNavigating" @click="openQuotationApproval">{{ quotationApprovalError ? '报价审批加载失败，重试' : '报价审批' }}</a-button>
          <a-button v-if="quotationPricingVisible" :type="quotationPricingError ? 'default' : 'primary'" :danger="!!quotationPricingError" preIcon="ant-design:account-book-outlined" :loading="quotationPricingLoading || quotationPricingNavigating" @click="openQuotationPricing">{{ quotationPricingError ? '报价定价加载失败，重试' : '报价定价' }}</a-button>
          <a-button v-if="quotationGrantVisible" :danger="!!quotationGrantError" preIcon="ant-design:safety-certificate-outlined" :loading="quotationGrantLoading" @click="openQuotationGrant">{{ quotationGrantError ? '报价授权加载失败，重试' : '报价授权' }}</a-button>
          <a-button v-for="action in businessActions" :key="action.key" :type="action.mode === 'view' && action.key !== 'contractAudit' ? 'default' : 'primary'" @click="handleBusinessAction(action)">{{ action.label }}</a-button>
          <a-button v-if="membershipError" danger @click="loadMembership">项目身份加载失败，点击重试</a-button>
        </a-space>
      </PeriodOperations>

      <!-- 项目详情 tab -->
      <a-card class="project-detail__body">
        <a-alert v-if="loadError" type="error" :message="loadError" show-icon>
          <template #action><a-button @click="load">重新加载</a-button></template>
        </a-alert>
        <a-spin v-else-if="!detailReady" tip="正在加载项目信息…" />
        <template v-else>
          <a-alert v-if="historyTabsError" type="warning" show-icon message="部分历史资料未能确认，当前仅展示已确认的入口。">
            <template #action><a-button @click="load">重新加载</a-button></template>
          </a-alert>
          <a-tabs :key="projectId" v-model:activeKey="activeKey">
            <a-tab-pane key="basic" tab="基本信息">
              <DetailBasic
                :project="project"
                :editable="canEditProject"
                :project-type-text="projectTypeText"
                :business-attribute-text="businessAttributeText"
                :involved-products-text="involvedProductsText"
                @edit="handleEditProject"
              />
            </a-tab-pane>
            <a-tab-pane v-if="canViewQuotation" key="quotation" tab="报价信息">
              <DetailQuotation ref="quotationListRef" :key="projectId" :period-id="projectId" :can-create="canCreateQuotation" @create="quotationCreate?.open()" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('contract')" key="contract" tab="合同信息">
              <DetailContract :project-id="projectId" :project="project" allow-withdraw @changed="handleBusinessChanged" @edit="handleContractEdit" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('plan')" key="plan" tab="计划审批记录">
              <DetailPlanHistory v-if="activeKey === 'plan'" :key="projectId" :period-id="projectId" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('member')" key="member" tab="项目成员">
              <DetailMember :project-id="projectId" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('position')" key="position" tab="实施位置">
              <DetailPosition :project-id="projectId" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('implement')" key="implement" tab="实施记录">
              <DetailImplement :project-id="projectId" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('acceptance')" key="acceptance" tab="验收记录">
              <DetailAcceptance :project-id="projectId" :project="project" :initial-rework-id="initialReworkId" @changed="handleBusinessChanged" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('file')" key="file" tab="项目文件">
              <DetailFile :project-id="projectId" :editable="canManageFiles" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('material')" key="material" tab="用料统计">
              <DetailMaterialAccount :project-id="projectId" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('payment')" key="payment" tab="回款信息">
              <FinanceDetail v-if="canViewPayment && activeKey === 'payment'" :key="projectId" :period-id="projectId" :context="project" embedded />
            </a-tab-pane>
          </a-tabs>
        </template>
      </a-card>
    </div>

    <ProjectQuotationCreate ref="quotationCreate" :period-id="projectId" :project-name="projectDisplayName" :default-name="`${String(project.projectName ?? '').trim()}${String(project.periodName ?? '').trim()}报价单`" :allowed="canCreateQuotation" @created="quotationListRef?.reload()" />
    <a-modal v-model:open="quotationApprovalOpen" title="选择待审批报价" :footer="null" :width="720">
      <a-table :data-source="quotationApprovalRecords" row-key="id" :pagination="false" :scroll="{ y: 360 }" :columns="[{ title: '报价名称', dataIndex: 'candidateName' }, { title: '审批线路', key: 'route', width: 120 }, { title: '操作', key: 'action', width: 100 }]">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'route'">{{ record.approvalRoute === 'MARKET' ? '市场审批' : '技术审批' }}</template>
          <a-button v-else-if="column.key === 'action'" type="link" :disabled="quotationApprovalNavigating" @click="enterQuotationApproval(record)">审批</a-button>
        </template>
      </a-table>
    </a-modal>
    <a-modal v-model:open="quotationPricingOpen" title="选择待定价报价" :footer="null" :width="720">
      <a-table :data-source="quotationPricingRecords" row-key="id" :pagination="false" :scroll="{ y: 360 }" :columns="[{ title: '报价名称', dataIndex: 'candidateName' }, { title: '操作', key: 'action', width: 100 }]">
        <template #bodyCell="{ column, record }">
          <a-button v-if="column.key === 'action'" type="link" :disabled="quotationPricingNavigating" @click="enterQuotationPricing(record)">定价</a-button>
        </template>
      </a-table>
    </a-modal>
    <QuotationGrantModal v-model:open="quotationGrantOpen" :period-id="projectId" :period-name="projectDisplayName" />
    <!-- 右侧项目动态 -->
    <a-card class="project-detail__activity">
      <div class="project-detail__activity-title">项目动态</div>
      <div v-if="activities.length" class="project-detail__activity-scroll" tabindex="0" aria-label="项目动态列表，可滚动查看">
        <a-timeline class="project-detail__activity-list">
          <a-timeline-item v-for="(act, idx) in activities" :key="act.id || idx" color="blue">
            <div class="project-detail__activity-text">{{ act.actionContent || act.content || '—' }}</div>
            <div class="project-detail__activity-meta">
              <span class="project-detail__activity-operator">操作人：{{ act.operatorName || '—' }}</span>
              <span class="project-detail__activity-time">{{ act.operateTime || act.time || '—' }}</span>
            </div>
          </a-timeline-item>
        </a-timeline>
      </div>
      <div v-if="!activities.length" class="project-detail__activity-empty">暂无动态</div>
    </a-card>
  </div>
</template>

<script lang="ts" name="project-detail" setup>
  import { ref, computed, onMounted, watch, onBeforeUnmount, onActivated, onDeactivated } from 'vue';
  import { resolvePeriodDetailActions, type PeriodDetailAction } from '../periodDetailActions';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { contractProjectContext } from '../contract/projectContext';
  import { isApprovalPending } from '/@/utils/approvalStatus';
  import DetailPlanHistory from './components/DetailPlanHistory.vue';
  import { DETAIL_TAB_KEYS, resolveDetailTabs, type DetailTabKey } from './detailTabs';
  import { readClosedPeriodTabs } from './closedPeriodTabs';
  import { getPeriodApprovalHistory } from '../plan/PeriodApproval.api';
  import { useQuotationDepartment } from './useQuotationDepartment';
  import { useRoute, useRouter } from 'vue-router';
  import { getProjectBasic, getActivities } from './ProjectDetail.api';
  import { projectStatusMap, statusColorMap, loadProjectStatusMap, loadProjectTypeMap, loadDictOptions } from '../Project.data';
  import DictValue from '/@/components/DictValue.vue';
  import { readProjectMembership } from '../projectMembership';
  import PeriodOperations from './components/PeriodOperations.vue';
  import QuotationGrantModal from '/@/views/plan/material-draft/QuotationGrantModal.vue';
  import { useQuotationGrant } from './useQuotationGrant';
  import FinanceDetail from '/@/views/payment/FinanceDetail.vue';
  import { usePermissionStore } from '/@/store/modules/permission';
  import { canViewPaymentTab } from './paymentAccess';
  import { useUserStore } from '/@/store/modules/user';
  import DetailBasic from './components/DetailBasic.vue';
  import DetailContract from './components/DetailContract.vue';
  import DetailQuotation from './components/DetailQuotation.vue';
  import ProjectQuotationCreate from './components/ProjectQuotationCreate.vue';
  import { canCreateProjectQuotation } from './quotationCreate';
  import { useQuotationApproval } from './useQuotationApproval';
  import DetailMember from './components/DetailMember.vue';
  import DetailPosition from './components/DetailPosition.vue';
  import DetailImplement from './components/DetailImplement.vue';
  import DetailAcceptance from './components/DetailAcceptance.vue';
  import DetailFile from './components/DetailFile.vue';
  import DetailMaterialAccount from './components/DetailMaterialAccount.vue';

  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();
  const { hasPermission } = usePermission();
  const manager = ref(false);
  const participant = ref(false);
  const membershipError = ref(false);
  let membershipSequence = 0;
  const canViewQuotation = useQuotationDepartment();
  const projectId = computed(() => String(route.params.id || '')); // 分期ID periodId
  const activeKey = ref<DetailTabKey>('basic');
  const initialReworkId = computed(() => String(route.query.reworkId || ''));
  const detailReady = ref(false);
  const project = ref<any>({});
  const { visible: quotationGrantVisible, loading: quotationGrantLoading, error: quotationGrantError,
    open: quotationGrantOpen, handleOpen: openQuotationGrant } = useQuotationGrant(projectId, detailReady, computed(() => project.value.contractStatus));
  const loadError = ref('');
  const historyTabs = ref<DetailTabKey[]>([]);
  const historyTabsError = ref(false);
  let loadSequence = 0;
  const paymentPermissions = usePermissionStore();
  const canViewPayment = computed(() => canViewPaymentTab(
    String(userStore.getIdentity.userId || ''), userStore.getIdentity.roleCodes, paymentPermissions.getBackMenuList,
  ));
  const visibleTabs = computed(() =>
    DETAIL_TAB_KEYS.filter((key) => (key !== 'quotation' || canViewQuotation.value) &&
      (key !== 'contract' || hasPermission('project:contract:view') ||
        (isApprovalPending(project.value.contractStatus) && hasPermission('project:contract:approve'))) &&
      (key !== 'payment' || canViewPayment.value) &&
      resolveDetailTabs(project.value, historyTabs.value).includes(key))
  );
  const { records: quotationApprovalRecords, loading: quotationApprovalLoading, error: quotationApprovalError,
    open: quotationApprovalOpen, navigating: quotationApprovalNavigating, visible: quotationApprovalVisible,
    handleOpen: openQuotationApproval, enter: enterQuotationApproval } = useQuotationApproval(projectId, project, detailReady);
  const { records: quotationPricingRecords, loading: quotationPricingLoading, error: quotationPricingError,
    open: quotationPricingOpen, navigating: quotationPricingNavigating, visible: quotationPricingVisible,
    handleOpen: openQuotationPricing, enter: enterQuotationPricing } = useQuotationApproval(projectId, project, detailReady, 'price');
  const quotationCreate = ref<InstanceType<typeof ProjectQuotationCreate>>();
  const quotationListRef = ref<InstanceType<typeof DetailQuotation>>();
  const canCreateQuotation = computed(() => detailReady.value && !!currentUserId.value && canCreateProjectQuotation(project.value.status, canViewQuotation.value, hasPermission, project.value.priced));
  const projectDisplayName = computed(
    () =>
      [project.value.projectName, project.value.periodName]
        .map((name) => String(name ?? '').trim())
        .filter(Boolean)
        .join('-') || '—'
  );
  const activities = ref<any[]>([]);
  // 状态字典映射(数据源 project_period_status, 加载失败回退 projectStatusMap)
  const statusMeta = ref<Recordable>({});
  const projectTypeMeta = ref<Record<string, string>>({});
  const businessAttributeMeta = ref<Record<string, string>>({});
  const involvedProductsMeta = ref<Record<string, string>>({});
  const statusText = computed(
    () => statusMeta.value[project.value.status]?.text || projectStatusMap[project.value.status] || project.value.status || '—'
  );
  const projectTypeText = computed(() => mapDictValue(project.value.projectType, projectTypeMeta.value));
  const businessAttributeText = computed(() => mapDictValue(project.value.businessAttribute, businessAttributeMeta.value, true));
  const involvedProductsText = computed(() => mapDictValue(project.value.involvedProducts, involvedProductsMeta.value, true));
  const progressPercent = computed(() => Number(project.value.totalProgress) || 0);
  const statusColor = computed(() => statusMeta.value[project.value.status]?.color || statusColorMap[project.value.status] || 'default');
  const currentUserId = computed(() => {
    const user: any = userStore.getUserInfo;
    return String(user?.id ?? user?.userId ?? '');
  });
  const businessActions = computed(() => !detailReady.value ? [] : resolvePeriodDetailActions(project.value, {
    userId: currentUserId.value,
    admin: !!userStore.getIdentity.roleCodes?.includes('admin'),
    manager: manager.value,
    hasPermission,
  }));
  async function loadMembership() {
    const sequence = ++membershipSequence;
    const id = projectId.value;
    const userId = currentUserId.value;
    manager.value = false;
    participant.value = false;
    membershipError.value = false;
    if (!id || !userId) return;
    try {
      const membership = await readProjectMembership(id, userId);
      if (sequence !== membershipSequence || id !== projectId.value || userId !== currentUserId.value) return;
      manager.value = membership.manager;
      participant.value = membership.participant;
    } catch { if (sequence === membershipSequence) membershipError.value = true; }
  }
  function handleContractEdit() {
    if (!detailReady.value || !projectId.value || !hasPermission('project:contract:view')) return;
    router.push({ path: '/project/contract', query: { periodId: projectId.value, projectId: project.value.projectId, mode: 'edit', from: 'periodDetail' },
      state: { contractProjectContext: contractProjectContext(project.value, currentUserId.value) } });
  }
  function handleBusinessAction(action: PeriodDetailAction) {
    const current = businessActions.value.find(item => item.key === action.key);
    if (!current) return;
    const periodId = projectId.value;
    if (current.tab === 'contract') {
      router.push({ path: '/project/contract', query: { periodId, projectId: project.value.projectId, mode: current.mode, from: 'periodDetail' },
        state: { contractProjectContext: contractProjectContext(project.value, currentUserId.value) } });
    } else {
      router.push({ path: '/project/plan', query: { periodId, from: 'periodDetail',
        ...(current.mode === 'edit' ? {} : { mode: 'view' }),
        ...(current.mode === 'audit' ? { audit: '1', ...(route.query.approvalId ? { approvalId: String(route.query.approvalId) } : {}) } : {}) } });
    }
  }
  watch([projectId, currentUserId], loadMembership, { immediate: true, flush: 'sync' });
  // 项目创建后，只有指定的项目对接人可从详情页进入编辑。
  const canEditProject = computed(() => !!currentUserId.value && String(project.value.projectLiaisonUserId ?? '') === currentUserId.value);
  const canManageFiles = computed(() => {
    if (!currentUserId.value) return false;
    return [project.value.projectLiaisonUserId, project.value.projectManagerUserId]
      .filter(Boolean)
      .some((userId) => String(userId) === currentUserId.value);
  });
  function mapDictValue(value: unknown, dictionary: Record<string, string>, multiple = false) {
    if (value === undefined || value === null || value === '') return '—';
    const values = multiple ? (Array.isArray(value) ? value : String(value).split(/[,，]/)) : [value];
    return values
      .map((item) => {
        const code = String(item).trim();
        return dictionary[code] || code;
      })
      .filter(Boolean)
      .join('、');
  }

  async function load() {
    const sequence = ++loadSequence;
    const id = projectId.value;
    detailReady.value = false;
    loadError.value = '';
    try {
      if (!id) throw new Error('缺少项目分期 ID');
      const data = await getProjectBasic({ periodId: id });
      if (sequence !== loadSequence) return;
      if (String(data?.periodId || '') !== id) throw new Error('项目分期信息不匹配，请重新加载');
      project.value = data;
      historyTabs.value = [];
      historyTabsError.value = false;
      if (data.status === 'CLOSED') {
        const history = await readClosedPeriodTabs(id);
        if (sequence !== loadSequence) return;
        historyTabs.value = history.tabs;
        historyTabsError.value = history.failed;
      }
      // 早期/未知状态仅核实历史；筹备及后续按项目阶段开放，关闭由上方统一查询。
      if (data.status !== 'CLOSED' && !resolveDetailTabs(data).includes('plan')) {
        historyTabs.value = historyTabs.value.filter(key => key !== 'plan');
        try {
          const rows = await getPeriodApprovalHistory(id);
          if (sequence !== loadSequence) return;
          if (rows.length) historyTabs.value.push('plan');
        } catch {
          if (sequence !== loadSequence) return;
          historyTabsError.value = true;
        }
      }
      const firstLoad = !detailReady.value;
      detailReady.value = true;
      if (firstLoad) applyRequestedTab();
    } catch (error: any) {
      if (sequence !== loadSequence) return;
      loadError.value = error?.message || '项目加载失败，请重试';
      return;
    }
    try {
      const acts = await getActivities({ periodId: id, pageNo: 1, pageSize: 50 });
      if (sequence !== loadSequence) return;
      const list = acts?.records || acts || [];
      activities.value = Array.isArray(list) ? list : [];
    } catch {
      /* 动态加载失败由请求层提示，不阻断已加载的详情。 */
    }
  }

  function applyRequestedTab() {
    if (!detailReady.value) return;
    const requested = String(route.query.tab || 'basic') as DetailTabKey;
    if (!DETAIL_TAB_KEYS.includes(requested)) {
      activeKey.value = 'basic';
      return;
    }
    activeKey.value = visibleTabs.value.includes(requested) ? requested : 'basic';
  }
  watch(
    projectId,
    () => {
      project.value = {};
      activities.value = [];
      detailReady.value = false;
      historyTabs.value = [];
      historyTabsError.value = false;
      activeKey.value = 'basic';
      void load();
    },
    { immediate: true }
  );
  watch(() => route.query.tab, applyRequestedTab);
  watch(visibleTabs, (tabs) => {
    if (detailReady.value && !tabs.includes(activeKey.value)) activeKey.value = 'basic';
  });
  watch(activeKey, (tab) => {
    if (detailReady.value && route.query.tab !== tab) router.replace({ query: { ...route.query, tab } });
  });
  let needsRefresh = false;
  onDeactivated(() => { needsRefresh = true; loadSequence += 1; membershipSequence += 1; detailReady.value = false; manager.value = false; });
  onActivated(() => { if (needsRefresh) { needsRefresh = false; void load(); void loadMembership(); } });
  watch(canViewQuotation, () => {
    if (!canViewQuotation.value && activeKey.value === 'quotation') activeKey.value = 'basic';
    else if (canViewQuotation.value && route.query.tab === 'quotation') applyRequestedTab();
  });
  onBeforeUnmount(() => {
    membershipSequence += 1;
    loadSequence++;
  });

  async function handleBusinessChanged() {
    await Promise.all([load(), loadMembership()]);
  }

  function goBack() {
    router.push('/project/list');
  }

  function handleEditProject() {
    if (!canEditProject.value) return;
    router.push({
      path: '/project/apply',
      query: { id: projectId.value, periodId: projectId.value, projectId: project.value.projectId },
    });
  }

  onMounted(async () => {
    const [loadedStatusMeta, loadedProjectTypeMeta, businessOptions, productOptions] = await Promise.all([
      loadProjectStatusMap(),
      loadProjectTypeMap(),
      loadDictOptions('project_business_attr'),
      loadDictOptions('project_products'),
    ]);
    statusMeta.value = loadedStatusMeta;
    projectTypeMeta.value = loadedProjectTypeMeta;
    businessAttributeMeta.value = Object.fromEntries(businessOptions.map((item) => [String(item.value), item.label]));
    involvedProductsMeta.value = Object.fromEntries(productOptions.map((item) => [String(item.value), item.label]));
  });
</script>

<style lang="less" scoped>
  .project-detail__actions { margin-bottom: 16px; }
  .project-detail {
    display: flex;
    gap: 16px;
    padding: 16px;
    align-items: flex-start;

    &__main {
      flex: 1;
      min-width: 0;
    }

    &__header {
      margin-bottom: 16px;

      &-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }
    }

    &__progress {
      flex-shrink: 0;
    }

    &__info {
      min-width: 0;
    }

    &__name {
      overflow-wrap: anywhere;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    &__meta {
      margin-top: 8px;
      color: #666;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }

    &__activity {
      width: 280px;
      flex-shrink: 0;

      &-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
        margin-bottom: 16px;
      }

      &-text {
        color: #333;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      &-scroll {
        max-height: calc(100vh - 150px);
        overflow-y: auto;
        // Ant Timeline 内容默认 top: -7px，预留顶部空间避免被滚动容器裁切。
        padding: 8px 8px 8px 0;
        scrollbar-gutter: stable;

        &:focus-visible {
          outline: 2px solid #1677ff;
          outline-offset: 2px;
          border-radius: 4px;
        }
      }

      &-list {
        margin-bottom: 0;
      }

      &-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        color: #999;
        font-size: 12px;
        margin-top: 4px;
      }

      &-operator,
      &-time {
        overflow-wrap: anywhere;
      }

      &-empty {
        color: #999;
        text-align: center;
        padding: 24px 0;
      }
    }
  }

  @media (max-width: 1200px) {
    .project-detail {
      flex-direction: column;

      &__main {
        width: 100%;
      }

      &__activity {
        width: 100%;

        &-scroll {
          max-height: 360px;
        }
      }
    }
  }
</style>
