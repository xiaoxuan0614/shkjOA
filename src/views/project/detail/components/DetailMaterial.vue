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

  // 设计稿列: 类别/名称/品牌/型号/单位/采购量/计划用量/实际用量
  const columns = [
    { title: '类别', dataIndex: 'category' },
    { title: '名称', dataIndex: 'name' },
    { title: '品牌', dataIndex: 'brand' },
    { title: '型号', dataIndex: 'model' },
    { title: '单位', dataIndex: 'unit' },
    { title: '采购量', dataIndex: 'purchaseQty' },
    { title: '计划用量', dataIndex: 'planQty' },
    { title: '实际用量', dataIndex: 'actualQty' },
  ];

  async function load() {
    const data = await getMaterials({ projectId: props.projectId });
    materials.value = data || [];
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
