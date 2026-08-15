<template>
  <div class="stocktake-page">
    <!-- 盘存记录：后端盘存接口生成的盘盈/盘亏台账，按 sourceType=stocktake 过滤 -->
    <BasicTable @register="registerTable">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'diff'">
          <span :class="{ 'text-danger': record.diff < 0, 'text-success': record.diff > 0 }">
            {{ record.diff > 0 ? '+' : '' }}{{ record.diff }} {{ record.unitName || '' }}
          </span>
        </template>
      </template>
    </BasicTable>
  </div>
</template>

<script lang="ts" name="mtl-stocktake" setup>
  import { BasicTable } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema } from './data';
  import { list as listRecord } from '../record/IoRecord.api';
  import { loadMaterialMap, enrichMaterialInfo } from '../material.util';

  // 物料 id → 物料信息(物料编码/名称富化，台账只回 materialId)
  let materialMapLoaded = false;
  async function ensureMaterialMap() {
    if (materialMapLoaded) return;
    materialMapLoaded = true;
    try {
      await loadMaterialMap();
    } catch (e) {
      // 失败不阻塞列表，物料编码/名称留空
    }
  }

  /**
   * 列表包装：固定只查盘存台账(sourceType=stocktake) + 按 materialId 富化物料编码/名称 + 计算差异
   */
  async function listWithMaterial(params: any) {
    await ensureMaterialMap();
    const res: any = await listRecord(params);
    const records = res?.records || (Array.isArray(res) ? res : []);
    enrichMaterialInfo(records);
    (records || []).forEach((r: any) => {
      r.diff = Number(r.afterQty || 0) - Number(r.beforeQty || 0);
    });
    return res;
  }

  const { tableContext } = useListPage({
    tableProps: {
      title: '盘存记录',
      api: listWithMaterial,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
      },
      // 盘存记录 = 台账中来源为 stocktake(盘存) 的记录
      beforeFetch: (params) => Object.assign(params, { sourceType: 'stocktake' }),
    },
  });

  const [registerTable] = tableContext;
</script>

<style lang="less" scoped>
  .stocktake-page {
    padding: 4px;
  }

  .text-danger {
    color: #f5222d;
    font-weight: 500;
  }

  .text-success {
    color: #52c41a;
    font-weight: 500;
  }
</style>
