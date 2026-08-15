<template>
  <div class="plan-info">
    <!-- 基本信息 -->
    <div class="plan-info__section">
      <div class="plan-info__section-title">基本信息</div>
      <a-descriptions :column="2" bordered size="middle">
        <a-descriptions-item label="项目名称">{{ project.projectName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="项目ID">{{ project.projectNo || '—' }}</a-descriptions-item>
        <a-descriptions-item label="甲方名称">{{ project.customerName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="甲方联系人">{{ project.contact || '—' }}</a-descriptions-item>
        <a-descriptions-item label="甲方联系电话">{{ project.phone || '—' }}</a-descriptions-item>
        <a-descriptions-item label="项目负责人">{{ project.manager || '—' }}</a-descriptions-item>
        <a-descriptions-item label="项目类型">{{ project.projectType || '—' }}</a-descriptions-item>
        <a-descriptions-item label="项目需求" :span="2">{{ project.requirement || '—' }}</a-descriptions-item>
        <a-descriptions-item label="项目地址" :span="2">{{ project.address || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>

    <!-- 人员配置 -->
    <div class="plan-info__section">
      <div class="plan-info__section-title">人员配置</div>
      <a-descriptions :column="3" size="middle">
        <a-descriptions-item label="项目负责人">{{ plan.owner || '—' }}</a-descriptions-item>
        <a-descriptions-item label="参与人员">{{ plan.participants || '—' }}</a-descriptions-item>
        <a-descriptions-item label="外协单位">{{ plan.outsourcingUnit || '—' }}</a-descriptions-item>
        <a-descriptions-item label="外协人数">{{ plan.outsourcingCount || '—' }}</a-descriptions-item>
        <a-descriptions-item label="外协工时">{{ plan.outsourcingHours || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>

    <!-- 合同信息 -->
    <div class="plan-info__section">
      <div class="plan-info__section-title">合同信息</div>
      <a-descriptions :column="3" size="middle">
        <a-descriptions-item label="合同类型">{{ project.contractType || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同金额">{{ project.contractAmount || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同签订日期">{{ project.contractDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="质保期">{{ project.warranty || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>
  </div>
</template>

<script lang="ts" setup>
  defineProps<{
    project: Recordable;
    plan: Recordable;
  }>();
</script>

<style lang="less" scoped>
  .plan-info {
    &__section {
      margin-bottom: 24px;

      &-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
        margin-bottom: 12px;
        padding-left: 8px;
        border-left: 3px solid #1677ff;
      }
    }
  }
</style>
