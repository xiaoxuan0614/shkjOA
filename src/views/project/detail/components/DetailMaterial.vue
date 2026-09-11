<template>
  <div class="detail-material">
    <a-table :columns="columns" :data-source="materials" :pagination="false" size="middle" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'purchaseStatus'">
          {{ purchaseStatusMap[String(record.purchaseStatus)] || record.purchaseStatus || '—' }}
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { getMaterials } from '../ProjectDetail.api';
  import { loadDictOptions } from '../../Project.data';
  import { enrichMaterialInfo, loadMaterialMap } from '/@/views/material/material.util';

  const props = defineProps<{
    projectId: string;
  }>();

  const materials = ref<any[]>([]);
  const purchaseStatusMap = ref<Record<string, string>>({});
  const purchaseStatusFallback = [
    { value: '0', label: '关闭' },
    { value: '1', label: '待采购' },
    { value: '2', label: '采购中' },
    { value: '3', label: '已到货' },
    { value: '4', label: '已入库' },
  ];

  // 后端 project_material_plan 字段
  const columns = [
    { title: '物料编码', dataIndex: 'materialCode', width: 150 },
    { title: '类别', dataIndex: 'materialCategory' },
    { title: '名称', dataIndex: 'materialName' },
    { title: '品牌', dataIndex: 'brand' },
    { title: '型号', dataIndex: 'model' },
    { title: '单位', dataIndex: 'unit' },
    { title: '采购量', dataIndex: 'purchaseQty' },
    { title: '计划用量', dataIndex: 'plannedQty' },
    { title: '实际用量', dataIndex: 'actualQty' },
    { title: '采购状态', dataIndex: 'purchaseStatus', key: 'purchaseStatus' },
  ];

  async function load() {
    const [res, options, materialMap]: any[] = await Promise.all([
      getMaterials({ periodId: props.projectId, pageNo: 1, pageSize: 100 }),
      loadDictOptions('purchase_order_status', purchaseStatusFallback),
      loadMaterialMap({ force: true }),
    ]);
    const list = res?.records || res || [];
    materials.value = enrichMaterialInfo(list || [], materialMap);
    purchaseStatusMap.value = Object.fromEntries(options.map((item: any) => [String(item.value), item.label]));
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
