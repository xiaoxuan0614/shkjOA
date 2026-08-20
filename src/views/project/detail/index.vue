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
            <div class="project-detail__name">{{ project.periodName || project.projectName || '—' }}</div>
            <div class="project-detail__meta">
              <span>当前状态：<a-tag :color="statusColor">{{ statusText }}</a-tag></span>
              <!-- 状态推进按钮(按当前状态动态显示, 可多动作) -->
              <template v-for="(action, i) in flowActions" :key="i">
                <a-popconfirm
                  v-if="action.pop"
                  :title="`确认执行「${action.label}」？`"
                  @confirm="handleAdvance(action)"
                >
                  <a-button v-auth="action.auth" type="primary" size="small">{{ action.label }}</a-button>
                </a-popconfirm>
                <a-button v-else v-auth="action.auth" type="primary" size="small" @click="handleAdvance(action)">
                  {{ action.label }}
                </a-button>
              </template>
              <span>项目编号：{{ project.projectNo || '—' }}</span>
              <span>项目类型：{{ project.projectType || '—' }}</span>
              <span>甲方名称：{{ project.customerName || '—' }}</span>
              <span>项目负责人：{{ project.projectLeaderName || '—' }}</span>
            </div>
          </div>
        </div>
      </a-card>

      <!-- 8 个 tab -->
      <a-card class="project-detail__body">
        <a-tabs v-model:activeKey="activeKey">
          <a-tab-pane key="basic" tab="基本信息">
            <DetailBasic :project="project" />
          </a-tab-pane>
          <a-tab-pane key="plan" tab="计划方案">
            <DetailPlan :project-id="projectId" />
          </a-tab-pane>
          <a-tab-pane key="member" tab="项目成员">
            <DetailMember :project-id="projectId" />
          </a-tab-pane>
          <a-tab-pane key="position" tab="实施位置">
            <DetailPosition :project-id="projectId" />
          </a-tab-pane>
          <a-tab-pane key="implement" tab="实施记录">
            <DetailImplement :project-id="projectId" />
          </a-tab-pane>
          <a-tab-pane key="acceptance" tab="验收记录">
            <DetailAcceptance :project-id="projectId" />
          </a-tab-pane>
          <a-tab-pane key="file" tab="项目文件">
            <DetailFile :project-id="projectId" />
          </a-tab-pane>
          <a-tab-pane key="material" tab="用料清单">
            <DetailMaterial :project-id="projectId" />
          </a-tab-pane>
        </a-tabs>
      </a-card>
    </div>

    <!-- 右侧项目动态 -->
    <a-card class="project-detail__activity">
      <div class="project-detail__activity-title">项目动态</div>
      <a-timeline class="project-detail__activity-list">
        <a-timeline-item v-for="(act, idx) in activities" :key="idx" color="blue">
          <div class="project-detail__activity-text">{{ act.actionContent || act.content }}</div>
          <div class="project-detail__activity-time">{{ act.operateTime || act.time }}</div>
        </a-timeline-item>
      </a-timeline>
      <div v-if="!activities.length" class="project-detail__activity-empty">暂无动态</div>
    </a-card>
  </div>
</template>

<script lang="ts" name="project-detail" setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { getProjectBasic, getActivities, getAcceptance } from './ProjectDetail.api';
  import { statusFlow, projectStatusMap, statusColorMap, loadProjectStatusMap } from '../Project.data';
  import { changePeriodStatus } from '../Project.api';
  import { useMessage } from '/@/hooks/web/useMessage';
  import DetailBasic from './components/DetailBasic.vue';
  import DetailPlan from './components/DetailPlan.vue';
  import DetailMember from './components/DetailMember.vue';
  import DetailPosition from './components/DetailPosition.vue';
  import DetailImplement from './components/DetailImplement.vue';
  import DetailAcceptance from './components/DetailAcceptance.vue';
  import DetailFile from './components/DetailFile.vue';
  import DetailMaterial from './components/DetailMaterial.vue';

  const route = useRoute();
  const router = useRouter();
  const { createMessage } = useMessage();
  const projectId = route.params.id as string; // 分期ID periodId

  const activeKey = ref('basic');
  const project = ref<any>({});
  const activities = ref<any[]>([]);
  // 状态字典映射(数据源 project_period_status, 加载失败回退 projectStatusMap)
  const statusMeta = ref<Recordable>({});
  // 客户验收记录(判断客户验收是否完成 → 是否可进入质保)
  const customerAcceptDone = ref(false);

  const statusText = computed(
    () => statusMeta.value[project.value.status]?.text || projectStatusMap[project.value.status] || project.value.status || '—'
  );
  const progressPercent = computed(() => Number(project.value.totalProgress) || 0);
  const statusColor = computed(
    () => statusMeta.value[project.value.status]?.color || statusColorMap[project.value.status] || 'default'
  );

  /**
   * 状态流转按钮: statusFlow 配置 + 验收阶段附加「进入质保」(客户验收完成即进入质保)
   * ⚠️ 合同签订/审批入口只在项目管理列表, 详情页不展示(过滤 contractSign)
   */
  const flowActions = computed(() => {
    const flow = statusFlow[project.value.status];
    const actions: any[] = [];
    if (flow && flow.actions) {
      flow.actions.forEach((action) => {
        if (action.act === 'contractSign') return;
        actions.push({ ...action, pop: true });
      });
    }
    // 验收阶段内, 客户验收已完成 → 附加「进入质保」
    const inAcceptPhase = ['IMPLEMENT_COMPLETED', 'INTERNAL_ACCEPTING', 'ACCEPTING'].includes(project.value.status);
    if (inAcceptPhase && customerAcceptDone.value) {
      actions.push({ label: '进入质保', status: 'WARRANTY', auth: 'project:accept', pop: false });
    }
    return actions;
  });

  async function load() {
    const data = await getProjectBasic({ periodId: projectId });
    project.value = data || {};
    const acts = await getActivities({ periodId: projectId, pageNo: 1, pageSize: 50 });
    const list = acts?.records || acts || [];
    activities.value = list || [];
    // 客户验收是否有已验收记录(result 非空)
    try {
      const res: any = await getAcceptance({ periodId: projectId, pageNo: 1, pageSize: 1 });
      const records = res?.records || res || [];
      const record = records[0];
      customerAcceptDone.value = !!record && !!record.result;
    } catch (e) {
      customerAcceptDone.value = false;
    }
  }

  /**
   * 状态推进: 前端传 periodId + status 给统一状态变更接口
   */
  async function handleAdvance(action: any) {
    await changePeriodStatus({ periodId: projectId, status: action.status });
    createMessage.success(`操作成功：${action.label}`);
    load();
  }

  function goBack() {
    router.push('/project/list');
  }

  onMounted(async () => {
    statusMeta.value = await loadProjectStatusMap();
    load();
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
      }

      &-time {
        color: #999;
        font-size: 12px;
        margin-top: 4px;
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
      }
    }
  }
</style>
