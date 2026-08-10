<template>
  <div class="project-plan">
    <div class="project-plan__card">
      <!-- 顶部标题 -->
      <div class="project-plan__header">
        <span class="project-plan__header-title">{{ pageTitle }}</span>
      </div>

      <!-- 六个标签 -->
      <a-tabs v-model:activeKey="activeKey">
        <a-tab-pane key="basic" tab="基本信息">
          <PlanBasic ref="basicRef" :editable="basicEditable" :record="projectRecord" />
        </a-tab-pane>
        <a-tab-pane key="material" tab="用料计划">
          <PlanMaterial ref="materialRef" :editable="editable" />
        </a-tab-pane>
        <a-tab-pane key="person" tab="人员配置">
          <PlanPerson ref="personRef" :editable="editable" />
        </a-tab-pane>
        <a-tab-pane key="implement" tab="实施计划">
          <PlanImplement ref="implementRef" :editable="editable" />
        </a-tab-pane>
        <a-tab-pane key="position" tab="位置信息">
          <PlanPosition ref="positionRef" :editable="editable" />
        </a-tab-pane>
        <a-tab-pane key="payment" tab="回款计划">
          <PlanPayment ref="paymentRef" :editable="editable" :project="projectRecord" />
        </a-tab-pane>
      </a-tabs>

      <!-- 底部按钮 -->
      <div class="project-plan__footer">
        <a-button type="primary" preIcon="ant-design:save-outlined" @click="handleSave">保存</a-button>
        <a-button @click="handleCancel">取消</a-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useMessage } from '/@/hooks/web/useMessage';
  import PlanBasic from './PlanBasic.vue';
  import PlanMaterial from './PlanMaterial.vue';
  import PlanPerson from './PlanPerson.vue';
  import PlanImplement from './PlanImplement.vue';
  import PlanPosition from './PlanPosition.vue';
  import PlanPayment from './PlanPayment.vue';
  import { savePlan, projectDetail } from '../Project.api';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();

  const activeKey = ref('basic');

  // 路由参数
  const projectId = route.query?.projectId as string | undefined;
  const readonly = !!route.query?.readonly;

  // 项目记录(用于基本信息/回款自动带出)
  const projectRecord = ref<Recordable>({});

  // 子组件引用
  const basicRef = ref();
  const materialRef = ref();
  const personRef = ref();
  const implementRef = ref();
  const positionRef = ref();
  const paymentRef = ref();

  // 权限: readonly 时全部只读; 否则基本信息可编辑, 其余待接入编辑态
  const basicEditable = computed(() => !readonly);
  const editable = computed(() => !readonly);

  const pageTitle = computed(() => (readonly ? '计划方案详情' : '新增计划方案'));

  /**
   * 加载项目信息(回款/基本信息自动带出)
   */
  async function loadProject() {
    if (!projectId) return;
    const data = await projectDetail({ id: projectId });
    projectRecord.value = data || {};
  }

  /**
   * 保存: 收集六个标签数据
   */
  async function handleSave() {
    try {
      // 收集各标签数据
      const basicData = await basicRef.value?.getData?.();
      const materialData = materialRef.value?.getData?.();
      const personData = personRef.value?.getData?.();
      const implementData = implementRef.value?.getData?.();
      const positionData = positionRef.value?.getData?.();
      const paymentData = paymentRef.value?.getData?.();

      await savePlan({
        projectId,
        basic: basicData,
        material: materialData,
        person: personData,
        implement: implementData,
        position: positionData,
        payment: paymentData,
      });
      createMessage.success('计划保存成功');
      router.push('/project/list');
    } catch (error) {
      // 校验失败或接口异常
    }
  }

  /**
   * 取消
   */
  function handleCancel() {
    router.push('/project/list');
  }

  onMounted(() => {
    loadProject();
  });
</script>

<style lang="less" scoped>
  .project-plan {
    padding: 16px;

    &__card {
      background: #fff;
      border-radius: 4px;
      padding: 16px;
    }

    &__header {
      margin-bottom: 8px;

      &-title {
        font-weight: 600;
        font-size: 16px;
        color: #333;
      }
    }

    &__footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 16px 0 8px;
      border-top: 1px solid #f0f0f0;
    }
  }
</style>
