<template>
  <div class="plan-payment">
    <!-- 合同信息 -->
    <div class="plan-payment__section">
      <div class="plan-payment__section-title">合同信息</div>
      <a-descriptions :column="3" size="middle">
        <a-descriptions-item label="项目名称">{{ project.projectName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="甲方名称">{{ project.customerName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同类型">{{ project.contractType || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同金额">{{ project.contractAmount || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同签订日期">{{ project.contractDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="质保期">{{ project.warranty || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>

    <!-- 回款计划 -->
    <div class="plan-payment__section">
      <div class="plan-payment__section-title">回款计划</div>
      <a-table
        :columns="columns"
        :data-source="plan.paybackPlan || []"
        :pagination="false"
        size="middle"
        bordered
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
  defineProps<{
    project: Recordable;
    plan: Recordable;
  }>();

  // 墨刀回款计划列: 序号/回款类型/计划回款金额/计划回款日期
  const columns = [
    { title: '序号', dataIndex: 'seq', width: 60, align: 'center' },
    { title: '回款类型', dataIndex: 'type' },
    { title: '计划回款金额', dataIndex: 'amount' },
    { title: '计划回款日期', dataIndex: 'planDate' },
  ];
</script>

<style lang="less" scoped>
  .plan-payment {
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
