<template>
  <a-modal v-model:open="visible" title="物料基本信息" :width="640" :footer="null" @cancel="invalidate">
    <a-spin v-if="loading" tip="正在加载物料信息…" />
    <a-alert v-else-if="error" type="error" show-icon :message="error">
      <template #action><a-button size="small" @click="load">重试</a-button></template>
    </a-alert>
    <a-descriptions v-else :column="1" bordered size="small" class="material-basic-info">
      <a-descriptions-item label="编码">{{ detail.materialCode || '—' }}</a-descriptions-item>
      <a-descriptions-item label="名称">{{ detail.materialName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="类别">{{ categoryName }}</a-descriptions-item>
      <a-descriptions-item label="品牌">{{ brandName }}</a-descriptions-item>
      <a-descriptions-item label="型号">{{ detail.model || '—' }}</a-descriptions-item>
      <a-descriptions-item label="参数"><div class="material-basic-info__parameters">{{ detail.specificationParams || '—' }}</div></a-descriptions-item>
      <a-descriptions-item label="库存">{{ detail.stockQty ?? '—' }}{{ detail.stockQty != null ? detail.unit || '' : '' }}</a-descriptions-item>
    </a-descriptions>
  </a-modal>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref } from 'vue';
  import { queryById } from '../goods/Goods.api';
  import { loadDictMap } from '../material.util';

  const visible = ref(false);
  const loading = ref(false);
  const error = ref('');
  const materialId = ref('');
  const detail = ref<Recordable>({});
  const categories = ref<Record<string, { text: string }>>({});
  const brands = ref<Record<string, { text: string }>>({});
  const categoryName = computed(() => detail.value.materialCategory_dictText || categories.value[String(detail.value.materialCategory)]?.text || detail.value.materialCategory || '—');
  const brandName = computed(() => detail.value.brand_dictText || brands.value[String(detail.value.brand)]?.text || detail.value.brand || '—');
  let sequence = 0;

  function invalidate() { sequence += 1; loading.value = false; }
  function open(record: Recordable) {
    materialId.value = String(record.materialId || record.id || '');
    detail.value = {};
    visible.value = true;
    void load();
  }
  async function load() {
    const request = ++sequence;
    const id = materialId.value;
    loading.value = true;
    error.value = '';
    try {
      if (!id) throw new Error('缺少物料 ID，无法查询基本信息');
      const [result, categoryMap, brandMap] = await Promise.all([
        queryById({ id }), loadDictMap('material_category'), loadDictMap('material_brand'),
      ]);
      if (request !== sequence || !visible.value) return;
      if (String(result?.id || '') !== id) throw new Error('物料详情不匹配，请重试');
      detail.value = result;
      categories.value = categoryMap;
      brands.value = brandMap;
    } catch (err: any) {
      if (request === sequence && visible.value) error.value = err?.message || '物料信息加载失败，请重试';
    } finally { if (request === sequence) loading.value = false; }
  }
  onBeforeUnmount(invalidate);
  defineExpose({ open });
</script>

<style scoped>
  .material-basic-info { overflow-wrap: anywhere; }
  .material-basic-info__parameters { white-space: pre-wrap; max-height: 360px; overflow-y: auto; }
</style>
