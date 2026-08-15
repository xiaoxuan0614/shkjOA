<template>
  <div class="plan-detail">
    <a-card class="plan-detail__card">
      <!-- 顶部标题 -->
      <div class="plan-detail__header">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
        <span class="plan-detail__title">方案详情</span>
      </div>

      <!-- 五个 tab -->
      <a-tabs v-model:activeKey="activeKey">
        <a-tab-pane key="info" tab="项目信息">
          <PlanInfo :project="project" :plan="plan" />
        </a-tab-pane>
        <a-tab-pane key="implement" tab="实施计划">
          <PlanImplement :plan="plan" />
        </a-tab-pane>
        <a-tab-pane key="material" tab="用料计划">
          <PlanMaterial :project-id="projectId" />
        </a-tab-pane>
        <a-tab-pane key="position" tab="位置信息">
          <PlanPosition :project-id="projectId" />
        </a-tab-pane>
        <a-tab-pane key="payment" tab="回款计划">
          <PlanPayment :project="project" :plan="plan" />
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<script lang="ts" name="plan-detail" setup>
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { planDetail } from '../Plan.api';
  import PlanInfo from '../components/PlanInfo.vue';
  import PlanImplement from '../components/PlanImplement.vue';
  import PlanMaterial from '../components/PlanMaterial.vue';
  import PlanPosition from '../components/PlanPosition.vue';
  import PlanPayment from '../components/PlanPayment.vue';

  const route = useRoute();
  const router = useRouter();
  const projectId = route.params.id as string;

  const activeKey = ref('info');
  const project = ref<any>({});
  const plan = ref<any>({});

  async function load() {
    const data = await planDetail({ id: projectId });
    project.value = data || {};
    plan.value = data?.plan || {};
  }

  function goBack() {
    router.push('/plan/list');
  }

  onMounted(() => {
    load();
  });
</script>

<style lang="less" scoped>
  .plan-detail {
    padding: 16px;

    &__card {
      background: #fff;
      border-radius: 4px;
      padding: 16px;
    }

    &__header {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 8px;

      &-title {
        font-weight: 600;
        font-size: 16px;
        color: #333;
      }
    }
  }
</style>
