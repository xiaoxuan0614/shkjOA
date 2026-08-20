<template>
  <div class="project-plan">
    <!-- 第1部分: 顶部工具栏(返回 / 标题 / 保存草稿 / 提交审批) -->
    <div class="project-plan__toolbar">
      <div class="project-plan__toolbar-left">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="handleCancel">返回</a-button>
        <span class="project-plan__toolbar-title">{{ pageTitle }}</span>
      </div>
      <div class="project-plan__toolbar-right">
        <a-button preIcon="ant-design:save-outlined" @click="handleSave">保存草稿</a-button>
        <a-button type="primary" preIcon="ant-design:audit-outlined" :loading="submitting" @click="handleSubmitAudit">
          提交审批
        </a-button>
      </div>
    </div>

    <!-- 第2部分: 内容盒子(与工具栏间隔 5px) -->
    <div class="project-plan__content">
      <a-tabs v-model:activeKey="activeKey">
        <!-- 每个 tab 顶部: 项目基本信息(供查看) -->
        <a-tab-pane key="file" tab="方案文件管理">
          <PlanProjectInfo :record="projectRecord" />
          <PlanFileMgmt ref="fileRef" :editable="editable" />
        </a-tab-pane>
        <a-tab-pane key="material" tab="用料计划">
          <PlanProjectInfo :record="projectRecord" />
          <PlanMaterial ref="materialRef" :editable="editable" />
        </a-tab-pane>
        <a-tab-pane key="person" tab="人员配置">
          <PlanProjectInfo :record="projectRecord" />
          <PlanPerson ref="personRef" :editable="editable" :period-id="periodId" />
        </a-tab-pane>
        <a-tab-pane key="implement" tab="实施进度计划">
          <PlanProjectInfo :record="projectRecord" />
          <PlanImplement ref="implementRef" :editable="editable" :period-id="periodId" />
        </a-tab-pane>
        <a-tab-pane key="position" tab="位置信息">
          <PlanProjectInfo :record="projectRecord" />
          <PlanPosition ref="positionRef" :editable="editable" />
        </a-tab-pane>
        <a-tab-pane key="payment" tab="回款计划">
          <PlanProjectInfo :record="projectRecord" />
          <PlanPayment ref="paymentRef" :period-id="periodId" :editable="editable" />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useMessage } from '/@/hooks/web/useMessage';
  import PlanFileMgmt from './PlanFileMgmt.vue';
  import PlanMaterial from './PlanMaterial.vue';
  import PlanPerson from './PlanPerson.vue';
  import PlanImplement from './PlanImplement.vue';
  import PlanPosition from './PlanPosition.vue';
  import PlanPayment from './PlanPayment.vue';
  import PlanProjectInfo from './PlanProjectInfo.vue';
  import { addPlan, projectDetail, changePeriodStatus } from '../Project.api';
  import { addPosition } from '../detail/ProjectDetail.api';
  import { addPlanMaterialPlan, addPlanMember, addPlanProcess } from './Plan.api';
  import { savePayback } from '/@/views/payment/Payment.api';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();

  // 当前标签
  const activeKey = ref('file');

  // 新增模式全部标签可编辑
  const editable = computed(() => true);

  // 分期ID(项目已存在, 各子资源均以 periodId 关联)
  const periodId = route.query?.periodId as string | undefined;

  const pageTitle = computed(() => '编辑计划方案');

  // 项目记录(头部上下文 + 回款自动带出)
  const projectRecord = ref<Recordable>({});

  // 子组件引用
  const fileRef = ref();
  const materialRef = ref();
  const personRef = ref();
  const implementRef = ref();
  const positionRef = ref();
  const paymentRef = ref();

  /**
   * 加载项目信息(头部上下文/回款自动带出)
   */
  async function loadProject() {
    if (!periodId) return;
    try {
      const data: any = await projectDetail({ periodId });
      projectRecord.value = data || {};
    } catch {
      // 项目信息加载失败不阻塞页面
    }
  }

  /**
   * 保存: 方案文件管理门禁 -> 主提交 addPlan(方案头+计划时间) -> 各子资源逐条提交(容忍部分失败)
   * @param goBack 保存后是否返回列表(提交审批时传 false, 由 handleSubmitAudit 统一流转)
   */
  async function handleSave(goBack = true) {
    // 1) 门禁: 方案文件管理(至少一条, 且每行 名称/类型 非空)
    let docs: any[];
    try {
      docs = await fileRef.value.getData();
    } catch {
      activeKey.value = 'file';
      return; // getData 内部已提示具体原因
    }

    // 2) 收集其余标签数据
    const materialRows = materialRef.value?.getData?.() || [];
    const { personList = [], outsourcingList = [] } = personRef.value?.getData?.() || {};
    const implementData = implementRef.value?.getData?.() || {};
    const { progressList = [] } = implementData;
    const positionRows = positionRef.value?.getData?.() || [];
    // 回款计划只读展示合同主信息, 不在此保存

    // 3) 主提交: 每个方案文档 addPlan 一条(多个 project_plan), 首条带计划验收日期/实施计划文件
    const planTimes = {
      acceptanceDate: implementData.acceptanceDate,
      planFileId: implementData.fileId,
      planFileName: implementData.fileName,
    };
    try {
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        await addPlan({
          ...doc,
          ...(i === 0 ? planTimes : {}),
          remark: i === 0 ? implementData.remark || doc.remark : doc.remark,
          periodId,
        });
      }
    } catch {
      return;
    }

    // 4) 子数据提交(每条 try/catch, 容忍部分失败)
    const failures: string[] = [];

    // 用料计划 -> project_material_plan
    for (const row of materialRows) {
      try {
        await addPlanMaterialPlan({
          periodId,
          materialId: row.id,
          materialCategory: row.categoryName,
          materialName: row.goodsName,
          brand: row.brand,
          model: row.model,
          unit: row.unit,
          purchaseQty: row.useNum,
          expressNo: row.expressNo,
        });
      } catch {
        failures.push(`用料「${row.goodsName}」`);
      }
    }

    // 人员配置 -> project_member(参与人员)
    for (const p of personList) {
      try {
        await addPlanMember({
          periodId,
          userName: p.memberName || p.member || '',
          memberId: p.memberId,
          memberRole: p.role,
          inviteStatus: p.inviteStatus || '待邀请',
          outsourcingFlag: false,
        });
      } catch {
        failures.push(`人员「${p.memberName || p.member}」`);
      }
    }

    // 人员配置 -> project_member(外协, 仅落 单位/外协标记)
    for (const o of outsourcingList) {
      try {
        await addPlanMember({
          periodId,
          userName: o.unit,
          memberRole: '外协',
          outsourcingFlag: true,
          outsourcingUnit: o.unit,
        });
      } catch {
        failures.push(`外协「${o.unit}」`);
      }
    }

    // 实施计划 -> project_process(工序)
    for (const pr of progressList) {
      try {
        await addPlanProcess({
          periodId,
          processName: pr.name,
          siteLeaderName: pr.leader,
          plannedStartTime: pr.startTime,
          plannedEndTime: pr.endTime,
          plannedHours: pr.hours,
        });
      } catch {
        failures.push(`工序「${pr.name}」`);
      }
    }

    // 位置信息 -> project_location
    for (const loc of positionRows) {
      try {
        await addPosition({
          periodId,
          locationName: loc.locationName,
          longitude: loc.longitude,
          latitude: loc.latitude,
          description: loc.description,
        });
      } catch {
        failures.push(`位置「${loc.locationName}」`);
      }
    }

    // 回款计划 -> project_contractItem(节点 + 比例, 金额自动算)
    const paybackRows = paymentRef.value?.getData?.() || [];
    for (const p of paybackRows) {
      if (!p.node) continue;
      try {
        await savePayback({
          periodId,
          node: p.node,
          ratio: p.ratio,
          amount: p.amount,
          planDate: p.planDate,
        });
      } catch {
        failures.push(`回款节点「${p.node}」`);
      }
    }

    // 5) 结果提示
    if (failures.length) {
      createMessage.warning(`计划已保存，但以下子数据保存失败：${failures.join('、')}`);
    } else {
      createMessage.success('计划保存成功');
    }
    if (goBack) {
      router.push('/project/list');
    }
  }

  /**
   * 提交审批: 保存计划 → 项目状态流转「待立项」→ 返回列表
   */
  const submitting = ref(false);
  async function handleSubmitAudit() {
    if (!periodId) return;
    submitting.value = true;
    try {
      // 先保存计划(不返回列表)
      await handleSave(false);
      // 项目 → 待立项
      await changePeriodStatus({ periodId, status: 'PENDING_APPROVAL' });
      createMessage.success('计划已提交审批，项目进入「待立项」');
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

  onMounted(() => {
    loadProject();
  });
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

    // 第2部分: 内容盒子(tab 栏与内容分开)
    &__content {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      overflow: hidden;

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
