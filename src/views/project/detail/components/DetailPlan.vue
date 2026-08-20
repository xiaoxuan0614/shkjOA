<template>
  <div class="detail-plan">
    <a-table :columns="columns" :data-source="plans" :pagination="false" size="middle" bordered />
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { getPlan } from '../ProjectDetail.api';

  const props = defineProps<{
    projectId: string;
  }>();

  const plans = ref<any[]>([]);

  // 后端 project_plan 字段: planName/planType/planFileId/planStartTime/planEndTime/plannedTotalHours/status/remark
  const columns = [
    { title: '方案名称', dataIndex: 'planName' },
    { title: '方案类型', dataIndex: 'planType' },
    { title: '计划开始时间', dataIndex: 'planStartTime' },
    { title: '计划结束时间', dataIndex: 'planEndTime' },
    { title: '计划总工时', dataIndex: 'plannedTotalHours' },
    { title: '方案文档', dataIndex: 'planFileId', customRender: ({ text }) => text || '—' },
    { title: '备注', dataIndex: 'remark' },
  ];

  async function load() {
    const res: any = await getPlan({ periodId: props.projectId, pageNo: 1, pageSize: 100 });
    const list = res?.records || res || [];
    plans.value = list || [];
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
