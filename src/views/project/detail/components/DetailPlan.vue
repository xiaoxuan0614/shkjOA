<template>
  <div class="detail-plan">
    <a-table :columns="columns" :data-source="plans" :pagination="false" size="middle" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'planFileId'">
          <a-button
            v-if="record.planFileId"
            size="small"
            preIcon="ant-design:eye-outlined"
            @click="previewFileInModal(record.planFileId, record.planName)"
          >
            预览
          </a-button>
          <span v-else>—</span>
        </template>
        <template v-else-if="column.key === 'planType'">
          {{ planTypeMap[String(record.planType)] || record.planType || '—' }}
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { getPlan } from '../ProjectDetail.api';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { loadDictOptions } from '../../Project.data';

  const props = defineProps<{
    projectId: string;
  }>();

  const plans = ref<any[]>([]);
  const planTypeMap = ref<Record<string, string>>({});

  // 后端 project_plan 字段: planName/planType/planFileId/planStartTime/planEndTime/plannedTotalHours/status/remark
  const columns = [
    { title: '方案名称', dataIndex: 'planName' },
    { title: '方案类型', dataIndex: 'planType', key: 'planType' },
    { title: '计划开始时间', dataIndex: 'planStartTime' },
    { title: '计划结束时间', dataIndex: 'planEndTime' },
    { title: '计划总工时', dataIndex: 'plannedTotalHours' },
    { title: '方案文档', dataIndex: 'planFileId', key: 'planFileId' },
    { title: '备注', dataIndex: 'remark' },
  ];

  async function load() {
    const [res, options]: any[] = await Promise.all([getPlan({ periodId: props.projectId, pageNo: 1, pageSize: 100 }), loadDictOptions('plan_type')]);
    const list = res?.records || res || [];
    plans.value = list || [];
    planTypeMap.value = Object.fromEntries(options.map((item: any) => [String(item.value), item.label]));
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
