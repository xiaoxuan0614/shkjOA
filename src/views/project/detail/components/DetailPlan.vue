<template>
  <div class="detail-plan">
    <!-- 实施计划 -->
    <div class="detail-plan__section">
      <div class="detail-plan__section-title">实施计划</div>
      <a-descriptions :column="3" size="middle">
        <a-descriptions-item label="实施开始时间">{{ plan.implementStart || '—' }}</a-descriptions-item>
        <a-descriptions-item label="预计结束时间">{{ plan.implementEnd || '—' }}</a-descriptions-item>
        <a-descriptions-item label="计划总工时">{{ plan.totalHours || '—' }}</a-descriptions-item>
        <a-descriptions-item label="描述文档">{{ plan.planDoc || '—' }}</a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">{{ plan.remark || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>

    <!-- 进度安排 -->
    <div class="detail-plan__section">
      <div class="detail-plan__section-title">进度安排</div>
      <a-table
        :columns="scheduleColumns"
        :data-source="plan.schedule || []"
        :pagination="false"
        size="middle"
        bordered
      />
    </div>

    <!-- 人员配置 -->
    <div class="detail-plan__section">
      <div class="detail-plan__section-title">人员配置</div>
      <a-descriptions :column="3" size="middle">
        <a-descriptions-item label="项目负责人">{{ plan.owner || '—' }}</a-descriptions-item>
        <a-descriptions-item label="参与人员">{{ plan.participants || '—' }}</a-descriptions-item>
        <a-descriptions-item label="外协单位">{{ plan.outsourcingUnit || '—' }}</a-descriptions-item>
        <a-descriptions-item label="外协人数">{{ plan.outsourcingCount || '—' }}</a-descriptions-item>
        <a-descriptions-item label="外协工时">{{ plan.outsourcingHours || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { getPlan } from '../ProjectDetail.api';

  const props = defineProps<{
    projectId: string;
  }>();

  const plan = ref<any>({});

  const scheduleColumns = [
    { title: '序号', dataIndex: 'seq', width: 60, align: 'center' },
    { title: '工序名称', dataIndex: 'workName' },
    { title: '现场负责人', dataIndex: 'owner' },
    { title: '计划开始时间', dataIndex: 'startTime' },
    { title: '计划完成时间', dataIndex: 'endTime' },
    { title: '计划工时', dataIndex: 'hours' },
  ];

  async function load() {
    const data = await getPlan({ projectId: props.projectId });
    plan.value = data || {};
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .detail-plan {
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
