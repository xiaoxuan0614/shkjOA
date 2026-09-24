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
              <!-- 状态推进按钮(项目详情不提供实施完成入口) -->
              <template v-for="action in flowActions" :key="action.act || action.status || action.label">
                <a-popconfirm v-if="action.pop" :title="`确认执行「${action.label}」？`" @confirm="handleAdvance(action)">
                  <a-button v-auth="action.auth" type="primary" size="small" :loading="advancing">{{ action.label }}</a-button>
                </a-popconfirm>
                <a-button v-else v-auth="action.auth" type="primary" size="small" :loading="advancing" @click="handleAdvance(action)">
                  {{ action.label }}
                </a-button>
              </template>
              <span>项目类型：{{ projectTypeText }}</span>
              <span>甲方名称：{{ project.customerName || '—' }}</span>
              <span>项目对接人：{{ project.projectLiaisonUserName || '—' }}</span>
            </div>
          </div>
        </div>
      </a-card>

      <!-- 项目详情 tab -->
      <a-card class="project-detail__body">
        <a-alert v-if="loadError" type="error" :message="loadError" show-icon>
          <template #action><a-button @click="load">重新加载</a-button></template>
        </a-alert>
        <a-spin v-else-if="!detailReady" tip="正在加载项目信息…" />
        <template v-else>
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
              <DetailQuotation :key="projectId" :period-id="projectId" />
            </a-tab-pane>
            <a-tab-pane v-if="visibleTabs.includes('contract')" key="contract" tab="合同信息">
              <DetailContract :project-id="projectId" :project="project" />
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
          </a-tabs>
        </template>
      </a-card>
    </div>

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
  import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
  import { DETAIL_TAB_KEYS, resolveDetailTabs, type DetailTabKey } from './detailTabs';
  import { useQuotationDepartment } from './useQuotationDepartment';
  import { useRoute, useRouter } from 'vue-router';
  import { getProjectBasic, getActivities } from './ProjectDetail.api';
  import { statusFlow, projectStatusMap, statusColorMap, loadProjectStatusMap, loadProjectTypeMap, loadDictOptions } from '../Project.data';
  import { changePeriodStatus } from '../Project.api';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { useUserStore } from '/@/store/modules/user';
  import DetailBasic from './components/DetailBasic.vue';
  import DetailContract from './components/DetailContract.vue';
  import DetailQuotation from './components/DetailQuotation.vue';
  import DetailMember from './components/DetailMember.vue';
  import DetailPosition from './components/DetailPosition.vue';
  import DetailImplement from './components/DetailImplement.vue';
  import DetailAcceptance from './components/DetailAcceptance.vue';
  import DetailFile from './components/DetailFile.vue';
  import DetailMaterialAccount from './components/DetailMaterialAccount.vue';

  const route = useRoute();
  const router = useRouter();
  const { createMessage } = useMessage();
  const userStore = useUserStore();
  const canViewQuotation = useQuotationDepartment();
  const projectId = computed(() => String(route.params.id || '')); // 分期ID periodId
  const activeKey = ref<DetailTabKey>('basic');
  const initialReworkId = computed(() => String(route.query.reworkId || ''));
  const detailReady = ref(false);
  const loadError = ref('');
  const openedTabs = ref<DetailTabKey[]>([]);
  let loadSequence = 0;
  const visibleTabs = computed(() =>
    DETAIL_TAB_KEYS.filter((key) => (key !== 'quotation' || canViewQuotation.value) &&
      (resolveDetailTabs(project.value).includes(key) || openedTabs.value.includes(key)))
  );
  const project = ref<any>({});
  const projectDisplayName = computed(
    () =>
      [project.value.projectName, project.value.periodName]
        .map((name) => String(name ?? '').trim())
        .filter(Boolean)
        .join('-') || '—'
  );
  const activities = ref<any[]>([]);
  const advancing = ref(false);
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

  /**
   * 状态流转按钮：合同签订/审批和实施完成不在项目详情页办理。
   * 验收、返工和质保均由专用业务接口校验并推进，详情页不再手工改状态。
   */
  const flowActions = computed(() => {
    const flow = statusFlow[project.value.status];
    const actions: any[] = [];
    if (flow && flow.actions) {
      flow.actions.forEach((action) => {
        if (['contractSign', 'processComplete'].includes(action.act)) return;
        actions.push({ ...action, pop: true });
      });
    }
    return actions;
  });

  async function load() {
    const sequence = ++loadSequence;
    const id = projectId.value;
    loadError.value = '';
    try {
      if (!id) throw new Error('缺少项目分期 ID');
      const data = await getProjectBasic({ periodId: id });
      if (sequence !== loadSequence) return;
      if (!data?.periodId) throw new Error('未找到项目详情');
      project.value = data;
      openedTabs.value = [...new Set([...openedTabs.value, ...resolveDetailTabs(data)])];
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
      openedTabs.value = [];
      activeKey.value = 'basic';
      void load();
    },
    { immediate: true }
  );
  watch(() => route.query.tab, applyRequestedTab);
  watch(canViewQuotation, () => {
    if (!canViewQuotation.value && activeKey.value === 'quotation') activeKey.value = 'basic';
    else if (canViewQuotation.value && route.query.tab === 'quotation') applyRequestedTab();
  });
  onBeforeUnmount(() => {
    loadSequence++;
  });

  /**
   * 状态推进: 前端传 periodId + status 给统一状态变更接口
   */
  async function handleAdvance(action: any) {
    if (advancing.value) return;
    advancing.value = true;
    try {
      await changePeriodStatus({ periodId: projectId.value, status: action.status });
      createMessage.success(`操作成功：${action.label}`);
      await load();
    } catch (error: any) {
      createMessage.error(error?.message || `${action.label || '操作'}失败，请重试`);
    } finally {
      advancing.value = false;
    }
  }

  async function handleBusinessChanged() {
    await load();
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
        padding: 2px 8px 2px 0;
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

      &__activity {
        width: 100%;

        &-scroll {
          max-height: 360px;
        }
      }
    }
  }
</style>
