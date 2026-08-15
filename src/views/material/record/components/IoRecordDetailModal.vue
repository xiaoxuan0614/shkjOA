<template>
  <BasicModal v-bind="$attrs" @register="register" title="出入库台账详情" :width="760" :showOkBtn="false" :showCancelBtn="false" @cancel="closeModal">
    <a-spin :spinning="loading">
      <!-- 台账记录：本次出入库变动 -->
      <a-descriptions :column="2" size="small" bordered class="record-desc" title="台账记录">
        <a-descriptions-item label="类型">
          <a-tag :color="dictColor(typeMap, record.ioType)">{{ dictText(typeMap, record.ioType) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="来源">
          <a-tag :color="dictColor(sourceMap, record.sourceType)">{{ dictText(sourceMap, record.sourceType) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="来源单号">{{ record.sourceNo || '—' }}</a-descriptions-item>
        <a-descriptions-item label="记录时间">{{ record.createTime || '—' }}</a-descriptions-item>
        <a-descriptions-item label="数量(所选单位)">{{ record.unitQty }} {{ record.unitName || '' }}</a-descriptions-item>
        <a-descriptions-item label="基准数量">{{ record.baseQty ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="单价">{{ record.unitPrice ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="金额">{{ record.amount ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="变动前库存">{{ record.beforeQty ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="变动后库存">{{ record.afterQty ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="备注" :span="2">{{ record.remark || '—' }}</a-descriptions-item>
      </a-descriptions>

      <!-- 物料详情：按台账 materialId 查物料主表 -->
      <a-divider orientation="left">物料详情</a-divider>
      <template v-if="material && material.id">
        <a-descriptions :column="2" size="small" bordered class="record-desc">
          <a-descriptions-item label="物料编码">{{ material.materialCode || '—' }}</a-descriptions-item>
          <a-descriptions-item label="物料名称">{{ material.materialName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="物料类别">
            <a-tag :color="dictColor(categoryMap, material.materialCategory)">{{ dictText(categoryMap, material.materialCategory) || material.materialCategory || '—' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="品牌">
            <a-tag :color="dictColor(brandMap, material.brand)">{{ dictText(brandMap, material.brand) || material.brand || '—' }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="型号">{{ material.model || '—' }}</a-descriptions-item>
          <a-descriptions-item label="基准单位">{{ material.unit || '—' }}</a-descriptions-item>
          <a-descriptions-item label="当前库存">{{ material.stockQty ?? 0 }} {{ material.unit || '' }}</a-descriptions-item>
          <a-descriptions-item label="库存金额">{{ material.stockAmount ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="安全库存">{{ material.safetyStock ?? '—' }}</a-descriptions-item>
          <a-descriptions-item label="物料备注">{{ material.remark || '—' }}</a-descriptions-item>
        </a-descriptions>

        <!-- 多单位换算：物料单位子表 -->
        <template v-if="material.unitList && material.unitList.length">
          <div class="unit-title">单位换算</div>
          <a-table
            size="small"
            :data-source="material.unitList"
            :columns="unitColumns"
            :pagination="false"
            :scroll="{ x: '100%' }"
            bordered
            row-key="id"
          />
        </template>
      </template>
      <a-empty v-else description="未查询到物料详情" />
    </a-spin>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicColumn } from '/@/components/Table';
  import { queryById as queryMaterialById } from '/@/views/material/goods/Goods.api';
  import { loadDictMap, loadMaterialMap, resolveMaterial } from '/@/views/material/material.util';

  const loading = ref(false);
  const record = ref<any>({});
  const material = ref<any>(null);

  // 后端数据字典 map(代码 → {text,color})，全部来自系统数据字典，不写死
  type DictMap = Record<string, { text: string; color: string }>;
  // 字典：类型(IN/OUT)、来源(apply/manual/stocktake)、物料类别、品牌
  const typeMap = ref<DictMap>({});
  const sourceMap = ref<DictMap>({});
  const categoryMap = ref<DictMap>({});
  const brandMap = ref<DictMap>({});
  const dictText = (m: DictMap, v?: string) => (v ? m[v]?.text || v : '—');
  const dictColor = (m: DictMap, v?: string) => m[v]?.color || undefined;

  const unitColumns: BasicColumn[] = [
    { title: '单位名称', dataIndex: 'unitName' },
    { title: '是否基准单位', dataIndex: 'isBaseUnit', width: 110, customRender: ({ text }) => (text ? '是' : '否') },
    { title: '换算比例', dataIndex: 'conversionQty', width: 100 },
    { title: '排序', dataIndex: 'sortNo', width: 70 },
  ];

  const [register, { closeModal }] = useModalInner(async (data) => {
    record.value = data.record || {};
    material.value = null;
    loading.value = true;
    try {
      // 字典缓存加载(模块级缓存，重复打开不重复请求)
      typeMap.value = await loadDictMap('stock_apply_type');
      sourceMap.value = await loadDictMap('stock_io_source_type');
      categoryMap.value = await loadDictMap('material_category');
      brandMap.value = await loadDictMap('material_brand');
      // 物料详情：优先按 id 查物料主表(queryById 返回最新库存/单位子表)，失败降级用列表缓存
      const mid = record.value.materialId;
      if (mid != null) {
        try {
          const res: any = await queryMaterialById({ id: mid });
          material.value = res?.id ? res : resolveMaterial(mid);
        } catch (e) {
          await loadMaterialMap(); // 确保列表缓存已加载，供 resolveMaterial 兜底
          material.value = resolveMaterial(mid);
        }
      }
    } finally {
      loading.value = false;
    }
  });
</script>

<style lang="less" scoped>
  .record-desc {
    margin-bottom: 8px;
  }

  .unit-title {
    margin: 10px 0 6px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.88);
  }
</style>
