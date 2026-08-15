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
            <div class="project-detail__name">{{ project.projectName || '—' }}</div>
            <div class="project-detail__meta">
              <span>当前状态：<a-tag :color="statusColor">{{ project.status || '—' }}</a-tag></span>
              <!-- 状态推进按钮(按当前状态动态显示，带角色权限码) -->
              <a-button
                v-if="advanceFlow"
                v-auth="advanceFlow.auth"
                type="primary"
                size="small"
                @click="handleAdvance"
              >
                {{ advanceFlow.action }}
              </a-button>
              <span>项目类型：{{ project.projectType || '—' }}</span>
              <span>合同签订日期：{{ project.contractDate || '—' }}</span>
              <span>计划交付日期：{{ project.deliverDate || '—' }}</span>
              <span>已回款金额：{{ project.receivedAmount || 0 }}</span>
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
          <div class="project-detail__activity-text">{{ act.content }}</div>
          <div class="project-detail__activity-time">{{ act.time }}</div>
        </a-timeline-item>
      </a-timeline>
      <div v-if="!activities.length" class="project-detail__activity-empty">暂无动态</div>
    </a-card>
  </div>
</template>

<script lang="ts" name="project-detail" setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { getProjectBasic, getActivities } from './ProjectDetail.api';
  import { statusFlow } from '../Project.data';
  import { advanceStatus } from '../Project.api';
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
  const projectId = route.params.id as string;

  const activeKey = ref('basic');
  const project = ref<any>({});
  const activities = ref<any[]>([]);

  // 当前状态对应的推进动作(下一状态/按钮文案/权限码)；完结/关闭时为 null 不显示
  const advanceFlow = computed(() => statusFlow[project.value.status] || null);

  const progressPercent = computed(() => Number(project.value.progress) || 0);
  const statusColor = computed(() => {
    const map: Recordable = {
      未开始: 'default',
      筹备: 'blue',
      实施中: 'processing',
      实施完成: 'cyan',
      内部验收: 'geekblue',
      客户验收: 'orange',
      质保中: 'purple',
      完结: 'success',
      关闭: 'error',
    };
    return map[project.value.status] || 'default';
  });

  async function load() {
    const data = await getProjectBasic({ id: projectId });
    project.value = data || {};
    const acts = await getActivities({ projectId });
    activities.value = acts || [];
  }

  /**
   * 状态推进：按生命周期顺序推进到下一状态
   */
  async function handleAdvance() {
    const flow = advanceFlow.value;
    if (!flow) return;
    await advanceStatus({ id: projectId, targetStatus: flow.next });
    createMessage.success(`状态已推进到「${flow.next}」`);
    load();
  }

  function goBack() {
    router.push('/project/list');
  }

  onMounted(() => {
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
