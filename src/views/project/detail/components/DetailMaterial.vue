<template>
  <div class="detail-material">
    <a-table
      :columns="columns"
      :data-source="materials"
      :pagination="false"
      size="middle"
      bordered
    />
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { getMaterials } from '../ProjectDetail.api';

  const props = defineProps<{
    projectId: string;
  }>();

  const materials = ref<any[]>([]);

  // 后端 project_material_plan 字段
  const columns = [
    { title: '类别', dataIndex: 'materialCategory' },
    { title: '名称', dataIndex: 'materialName' },
    { title: '品牌', dataIndex: 'brand' },
    { title: '型号', dataIndex: 'model' },
    { title: '单位', dataIndex: 'unit' },
    { title: '采购量', dataIndex: 'purchaseQty' },
    { title: '计划用量', dataIndex: 'plannedQty' },
    { title: '实际用量', dataIndex: 'actualQty' },
    { title: '采购状态', dataIndex: 'purchaseStatus' },
  ];

  async function load() {
    const res: any = await getMaterials({ periodId: props.projectId, pageNo: 1, pageSize: 100 });
    const list = res?.records || res || [];
    materials.value = list || [];
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
