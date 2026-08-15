<template>
  <div class="plan-implement">
    <!-- 实施计划信息 -->
    <div class="plan-implement__section">
      <div class="plan-implement__section-title">实施计划</div>
      <a-descriptions :column="3" size="middle">
        <a-descriptions-item label="实施开始时间">{{ plan.implementStart || '—' }}</a-descriptions-item>
        <a-descriptions-item label="预计结束时间">{{ plan.implementEnd || '—' }}</a-descriptions-item>
        <a-descriptions-item label="计划总工时">{{ plan.totalHours || '—' }}</a-descriptions-item>
        <a-descriptions-item label="描述文档">{{ plan.planDoc || '—' }}</a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">{{ plan.remark || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>

    <!-- 进度安排 -->
    <div class="plan-implement__section">
      <div class="plan-implement__section-title">进度安排</div>
      <a-table
        :columns="scheduleColumns"
        :data-source="plan.schedule || []"
        :pagination="false"
        size="middle"
        bordered
      />
    </div>

    <!-- 实施位置信息 -->
    <div class="plan-implement__section">
      <div class="plan-implement__section-title">实施位置信息</div>
      <a-table
        :columns="positionColumns"
        :data-source="plan.positions || []"
        :pagination="false"
        size="middle"
        bordered
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
  defineProps<{
    plan: Recordable;
  }>();

  // 进度安排表列(墨刀: 序号/工序名称/现场负责人/计划开始时间/计划完成时间/计划工时)
  const scheduleColumns = [
    { title: '序号', dataIndex: 'seq', width: 60, align: 'center' },
    { title: '工序名称', dataIndex: 'workName' },
    { title: '现场负责人', dataIndex: 'owner' },
    { title: '计划开始时间', dataIndex: 'startTime' },
    { title: '计划完成时间', dataIndex: 'endTime' },
    { title: '计划工时', dataIndex: 'hours' },
  ];

  // 实施位置信息表列(墨刀: 序号/实施位置/经度/纬度/位置描述)
  const positionColumns = [
    { title: '序号', dataIndex: 'seq', width: 60, align: 'center' },
    { title: '实施位置', dataIndex: 'name' },
    { title: '经度', dataIndex: 'lng' },
    { title: '纬度', dataIndex: 'lat' },
    { title: '位置描述', dataIndex: 'description' },
  ];
</script>

<style lang="less" scoped>
  .plan-implement {
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
