<template>
  <div class="material-plan-table">
    <div class="material-plan-table__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" :disabled="!editable" @click="openDrawer(true)"> 选择物料 </a-button>
      <span v-if="editable" class="material-plan-table__hint">
        从物料库选择后会自动带出物料编码，可继续填写{{ mode === 'quotation' ? '数量、单位' : '计划数量和备注' }}。
      </span>
      <span v-else class="material-plan-table__hint">{{ mode === 'quotation' ? '报价已锁定或当前账号无编辑权限' : '清单已锁定' }}，仅支持查看。</span>
    </div>

    <a-table
      :columns="columns"
      :data-source="rows"
      :row-key="(record) => record._key"
      :pagination="false"
      :loading="loading"
      :scroll="{ x: 1180 }"
      size="middle"
      bordered
    >
      <template #emptyText>
        <a-empty description="暂未添加物料，请从现有物料库中选择" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'plannedQty'">
          <a-input-number
            v-model:value="record.plannedQty"
            :min="0.01"
            :precision="2"
            :disabled="!editable"
            placeholder="请输入"
            style="width: 100%"
          />
        </template>
        <template v-else-if="column.key === 'unit'">
          <a-select
            v-model:value="record._unitValue"
            :options="record._unitOptions"
            :loading="record._unitLoading"
            :disabled="!editable || record._unitLoading"
            placeholder="请选择单位"
            style="width: 100%"
          />
        </template>
        <template v-else-if="column.key === 'remark'">
          <a-input v-model:value="record.remark" :disabled="!editable" :maxlength="mode === 'quotation' ? 500 : 200" placeholder="选填" />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-popconfirm v-if="editable" title="确定移除该物料吗？" @confirm="removeRow(record._key)">
            <a-button type="link" size="small" danger>移除</a-button>
          </a-popconfirm>
          <span v-else>—</span>
        </template>
      </template>
    </a-table>

    <div v-if="rows.length" class="material-plan-table__summary">
      共 {{ rows.length }} 种物料，{{ mode === 'quotation' ? '数量' : '计划数量' }}合计 {{ totalQty }}
    </div>
    <MaterialSelectDrawer @register="registerDrawer" @success="handleSelected" />
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import MaterialSelectDrawer from '/@/views/material/apply/components/MaterialSelectDrawer.vue';
  import { getMaterialCandidateItemList, getMaterialDetail, getPlanMaterialList } from '../Plan.api';

  const props = withDefaults(
    defineProps<{
      periodId?: string;
      candidateId?: string;
      editable?: boolean;
      mode?: 'plan' | 'quotation';
    }>(),
    { editable: true, mode: 'plan' }
  );

  const { createMessage } = useMessage();
  const emit = defineEmits<{ loaded: [count: number] }>();
  const [registerDrawer, { openDrawer }] = useDrawer();
  const rows = ref<any[]>([]);
  const loading = ref(false);
  const loadFailed = ref(false);
  let keySeed = 0;

  const columns = computed(() => [
    { title: '物料编码', dataIndex: 'materialCode', key: 'materialCode', width: 150, fixed: 'left' },
    { title: '物料类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 120 },
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 180 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 120 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 140 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 120, align: 'center' },
    { title: props.mode === 'quotation' ? '数量' : '计划数量', key: 'plannedQty', width: 130 },
    { title: '备注', key: 'remark', width: 220 },
    { title: '操作', key: 'action', width: 80, align: 'center', fixed: 'right' },
  ]);

  const totalQty = computed(() =>
    rows.value.reduce((sum, item) => sum + (Number(item.plannedQty) || 0), 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  );

  function createUnitOptions(material: any, currentUnitId?: string, currentUnit?: string) {
    const units = Array.isArray(material?.unitList) ? [...material.unitList] : [];
    units.sort((a: any, b: any) => Number(b.isBaseUnit || 0) - Number(a.isBaseUnit || 0) || Number(a.sortNo || 0) - Number(b.sortNo || 0));
    if (props.mode === 'quotation') {
      const options = units.filter((item: any) => item.id && item.unitName).map((item: any) => ({ label: item.unitName, value: String(item.id) }));
      if (currentUnitId && !options.some((item: any) => item.value === String(currentUnitId))) {
        options.push({ label: currentUnit || '原单位', value: String(currentUnitId) });
      }
      return options;
    }
    const names = units.map((item: any) => item.unitName).filter(Boolean);
    if (!names.length && material?.unit) names.push(material.unit);
    if (!names.length && currentUnit) names.push(currentUnit);
    return Array.from(new Set(names.map(String))).map((name) => ({ label: name, value: name }));
  }

  function getDefaultUnit(material: any, options: { value: string }[], currentUnitId?: string, currentUnit?: string) {
    const currentValue = props.mode === 'quotation' ? currentUnitId : currentUnit;
    if (currentValue && options.some((item) => item.value === String(currentValue))) return String(currentValue);
    const baseUnit = material?.unitList?.find((item: any) => item.isBaseUnit);
    return props.mode === 'quotation'
      ? baseUnit?.id
        ? String(baseUnit.id)
        : options[0]?.value
      : baseUnit?.unitName || material?.unit || options[0]?.value;
  }

  async function load() {
    const queryId = props.mode === 'quotation' ? props.candidateId : props.periodId;
    if (!queryId) {
      rows.value = [];
      emit('loaded', 0);
      return;
    }
    loading.value = true;
    loadFailed.value = false;
    try {
      const result: any =
        props.mode === 'quotation'
          ? await getMaterialCandidateItemList({ candidateId: props.candidateId, pageNo: 1, pageSize: 1000 })
          : await getPlanMaterialList({ periodId: props.periodId, pageNo: 1, pageSize: 1000 });
      const list = result?.records || result || [];
      const detailMap = new Map<string, any>();
      await Promise.all(
        list.map(async (item: any) => {
          if (!item.materialId || detailMap.has(item.materialId)) return;
          try {
            const material: any = await getMaterialDetail({ id: item.materialId });
            detailMap.set(item.materialId, material || {});
          } catch {
            detailMap.set(item.materialId, {});
          }
        })
      );
      rows.value = list.map((item: any) => {
        const material = detailMap.get(item.materialId) || {};
        const unitOptions = createUnitOptions(material, item.unitId, item.unit);
        return {
          ...item,
          _key: ++keySeed,
          materialCode: material.materialCode || item.materialCode || '—',
          _unitValue: getDefaultUnit(material, unitOptions, item.unitId, item.unit),
          _unitOptions: unitOptions,
          _unitLoading: false,
          plannedQty: props.mode === 'quotation' ? (item.quantity ?? 1) : (item.plannedQty ?? item.purchaseQty ?? 1),
        };
      });
      emit('loaded', rows.value.length);
    } catch (error: any) {
      loadFailed.value = true;
      createMessage.error(error?.message || '用料清单加载失败，请刷新后重试');
    } finally {
      loading.value = false;
    }
  }

  async function handleSelected(selected: any[]) {
    for (const selectedMaterial of selected || []) {
      const material = { ...selectedMaterial };
      if (rows.value.some((item) => String(item.materialId) === String(material.id))) {
        createMessage.warning(`「${material.materialName}」已在清单中`);
        continue;
      }
      const row: any = {
        _key: ++keySeed,
        materialId: material.id,
        materialCode: material.materialCode || '—',
        materialCategory: material.materialCategory,
        materialName: material.materialName,
        brand: material.brand,
        model: material.model,
        unit: undefined,
        unitId: undefined,
        _unitValue: undefined,
        _unitOptions: [],
        _unitLoading: true,
        plannedQty: 1,
        remark: '',
      };
      rows.value.push(row);
      try {
        const detail: any = material.unitList?.length ? material : await getMaterialDetail({ id: material.id });
        row._unitOptions = createUnitOptions(detail, material.unitId, material.unit);
        row._unitValue = getDefaultUnit(detail, row._unitOptions, material.unitId, material.unit);
      } catch {
        row._unitOptions = createUnitOptions(material, material.unitId, material.unit);
        row._unitValue = getDefaultUnit(material, row._unitOptions, material.unitId, material.unit);
        createMessage.warning(`「${material.materialName}」的单位列表加载失败，请稍后重试`);
      } finally {
        row._unitLoading = false;
      }
    }
  }

  function removeRow(key: number) {
    rows.value = rows.value.filter((item) => item._key !== key);
  }

  async function importRows(records: Recordable[]) {
    if (!props.editable || props.mode !== 'plan') throw new Error('当前用料计划不可编辑');
    const incoming = Array.from(
      new Map<string, Recordable>(
        (records || []).filter((item) => item.materialId).map((item) => [String(item.materialId), item] as [string, Recordable])
      ).values()
    );
    if (!incoming.length) throw new Error('没有可导入的物料');
    loading.value = true;
    try {
      const detailMap = new Map<string, any>();
      await Promise.all(
        incoming.map(async (item) => {
          const materialId = String(item.materialId || '');
          if (!materialId || detailMap.has(materialId)) return;
          const detail: any = await getMaterialDetail({ id: materialId });
          detailMap.set(materialId, detail || {});
        })
      );
      let added = 0;
      let updated = 0;
      const nextRows = [...rows.value];
      incoming.forEach((item) => {
        const materialId = String(item.materialId || '');
        if (!materialId) return;
        const detail = detailMap.get(materialId) || {};
        const unitOptions = createUnitOptions(detail);
        if (!unitOptions.length) throw new Error(`「${detail.materialName || item.materialName || materialId}」没有可用单位`);
        const requestedUnit = String(item.unit || '');
        const unitValue =
          requestedUnit && unitOptions.some((option) => option.value === requestedUnit) ? requestedUnit : getDefaultUnit(detail, unitOptions);
        const existingIndex = nextRows.findIndex((row) => String(row.materialId) === materialId);
        const existing = existingIndex >= 0 ? nextRows[existingIndex] : undefined;
        const normalized = {
          ...(existing || {}),
          _key: existing?._key || ++keySeed,
          materialId,
          materialCode: detail.materialCode || item.materialCode || '—',
          materialCategory: detail.materialCategory || item.materialCategory,
          materialName: detail.materialName || item.materialName,
          brand: detail.brand || item.brand,
          model: detail.model || item.model,
          _unitValue: unitValue,
          _unitOptions: unitOptions,
          _unitLoading: false,
          plannedQty: Number(item.plannedQty ?? item.quantity),
          remark: item.remark || '',
        };
        if (existingIndex >= 0) {
          nextRows.splice(existingIndex, 1, normalized);
          updated += 1;
        } else {
          nextRows.push(normalized);
          added += 1;
        }
      });
      rows.value = nextRows;
      emit('loaded', rows.value.length);
      return { added, updated };
    } finally {
      loading.value = false;
    }
  }

  function getData() {
    if (loading.value) throw new Error('用料清单仍在加载，请稍后再保存');
    if (loadFailed.value) throw new Error('用料清单加载失败，为避免覆盖原数据，请刷新后重试');
    const loadingUnit = rows.value.find((item) => item._unitLoading);
    if (loadingUnit) throw new Error(`「${loadingUnit.materialName || '未命名物料'}」的单位仍在加载，请稍后再保存`);
    const missingUnit = rows.value.find((item) => !item._unitValue);
    if (missingUnit) throw new Error(`请选择「${missingUnit.materialName || '未命名物料'}」的单位`);
    const invalid = rows.value.find((item) => !item.materialId || !(Number(item.plannedQty) > 0));
    if (invalid) throw new Error(`请填写「${invalid.materialName || '未命名物料'}」的${props.mode === 'quotation' ? '数量' : '计划数量'}`);
    if (props.mode === 'quotation') {
      return rows.value.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        materialId: item.materialId,
        quantity: Number(item.plannedQty),
        unitId: item._unitValue,
        remark: item.remark,
      }));
    }
    return rows.value.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      materialId: item.materialId,
      materialCategory: item.materialCategory,
      materialName: item.materialName,
      brand: item.brand,
      model: item.model,
      unit: item._unitValue,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      purchaseQty: item.purchaseQty,
      plannedQty: item.plannedQty,
      actualQty: item.actualQty,
      purchaseStatus: item.purchaseStatus,
      expressNo: item.expressNo,
      remark: item.remark,
    }));
  }

  defineExpose({ getData, importRows, reload: load, getRowCount: () => rows.value.length });

  watch(() => [props.periodId, props.candidateId, props.mode], load, { immediate: true });
</script>

<style lang="less" scoped>
  .material-plan-table {
    &__toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    &__hint {
      color: #595959;
      line-height: 32px;
    }

    &__summary {
      margin-top: 12px;
      color: #595959;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  }
</style>
