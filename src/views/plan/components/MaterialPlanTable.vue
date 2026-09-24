<template>
  <div class="material-plan-table" :class="{ 'material-plan-table--quotation': mode === 'quotation' }">
    <div v-if="showToolbar" class="material-plan-table__toolbar">
      <a-button
        type="primary"
        preIcon="ant-design:plus-outlined"
        :disabled="!editable || !structureEditable || contractLoading"
        @click="openMaterialDrawer"
      >
        选择物料
      </a-button>
      <span v-if="editable" class="material-plan-table__hint"> 从物料库选择后会自动带出物料编码，可继续填写{{ quantityText }}、单位和备注。 </span>
      <span v-else-if="pricingEditable" class="material-plan-table__hint">定价时仅可修改提价比例、终价，其他内容只读。</span>
      <span v-else class="material-plan-table__hint">{{ mode === 'quotation' ? '报价已锁定或当前账号无编辑权限' : '清单已锁定' }}，仅支持查看。</span>
    </div>

    <a-table
      :columns="columns"
      :data-source="rows"
      :row-key="(record) => record._key"
      :pagination="tablePagination"
      :loading="loading"
      :scroll="{ x: tableScrollX }"
      size="middle"
      bordered
      table-layout="fixed"
    >
      <template #emptyText>
        <a-empty description="暂未添加物料，请从现有物料库中选择" />
      </template>
      <template #headerCell="{ column }">
        <span>
          {{ column.title }}
          <span v-if="column.required" class="material-plan-table__required" aria-hidden="true">*</span>
        </span>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'materialIdentity'">
          <div
            class="material-plan-table__material-identity"
            :aria-label="`${materialDisplayName(record)}，物料编码 ${record.materialCode || '无'}`"
          >
            <a-button v-if="mode === 'quotation'" type="link" class="material-plan-table__material-name" style="padding: 0; height: auto; white-space: normal; text-align: left" :disabled="!record.materialId" @click.stop="basicInfoRef?.open({ materialId: record.materialId })">{{ materialDisplayName(record) }}</a-button>
            <span v-else class="material-plan-table__material-name">{{ materialDisplayName(record) }}</span>
            <span class="material-plan-table__material-code" aria-hidden="true">{{ record.materialCode || '—' }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'model' && mode === 'quotation'">
          <a-tooltip :title="record.model || undefined">
            <span class="material-plan-table__model-clamp" :tabindex="record.model ? 0 : undefined">{{ record.model || '—' }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="['basePrice', 'markupRate', 'finalPrice'].includes(column.key)">
          <a-input-number
            v-if="column.key === 'basePrice' || pricingEditable || directQuotation"
            :value="record[column.key]"
            :disabled="busy || (column.key === 'basePrice' ? !basePriceEditable : !pricingEditable)"
            :min="0"
            :max="9999999999"
            :precision="quantityAndCostPrecision"
            :addon-after="column.key === 'markupRate' ? '%' : undefined"
            string-mode
            :aria-label="`${record.materialName} ${column.title}`"
            placeholder="请输入"
            style="width: 100%"
            @change="(value) => changeQuotePrice(record, column.key, value)"
            @blur="changeQuotePrice(record, column.key, record[column.key], true)"
          />
          <span v-else>{{ column.key === 'markupRate' && hasPrice(record[column.key]) ? Number(record[column.key]).toFixed(2) + '%' : record[column.key] ?? '—' }}</span>
          <div v-if="record._priceError?.key === column.key" role="alert" class="material-plan-table__price-error">{{
            record._priceError.message
          }}</div>
        </template>
        <template v-else-if="column.key === 'plannedQty'">
          <a-input-number
            v-model:value="record.plannedQty"
            :min="contractMinimum(record)"
            :precision="quantityAndCostPrecision"
            :disabled="!editable || !structureEditable || contractLoading"
            placeholder="请输入"
            style="width: 100%"
          />
        </template>
        <template v-else-if="column.key === 'unit'">
          <a-select
            v-model:value="record._unitValue"
            :options="record._unitOptions"
            :loading="record._unitLoading"
            :disabled="!editable || !structureEditable || contractLoading || record._unitLoading || !!contractItem(record)"
            placeholder="请选择单位"
            style="width: 100%"
          />
        </template>
        <template v-else-if="column.key === 'remark'">
          <a-input
            v-model:value="record.remark"
            :disabled="!editable || contractLoading"
            :maxlength="mode === 'quotation' ? 500 : 200"
            placeholder="选填"
          />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-tooltip v-if="contractItem(record)" title="合同物料，不可移除">
            <span><a-button type="link" size="small" danger disabled>移除</a-button></span>
          </a-tooltip>
          <a-popconfirm v-else-if="editable && structureEditable && !contractLoading" title="确定移除该物料吗？" @confirm="removeRow(record._key)">
            <a-button type="link" size="small" danger>移除</a-button>
          </a-popconfirm>
          <span v-else>—</span>
        </template>
      </template>
    </a-table>

    <div v-if="rows.length" class="material-plan-table__summary"> 共 {{ rows.length }} 种物料，{{ quantityText }}合计 {{ totalQty }} </div>
    <MaterialSelectDrawer
      v-if="editable && structureEditable && showToolbar"
      :show-selected-materials="mode === 'plan' || mode === 'quotation'"
      :show-select-all="mode === 'quotation'"
      :code-tooltip="mode === 'quotation'"
      :quotation-layout="mode === 'quotation'"
      @register="registerDrawer"
      @success="handleSelected"
    />
    <MaterialBasicInfoModal v-if="mode === 'quotation'" ref="basicInfoRef" />
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue';
  import { hasPrice, decimalPrice, quotationPricePayload, quotationSnapshot, guidancePrice, validateDirectQuotation } from '../quotationPricing';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import MaterialSelectDrawer from '/@/views/material/apply/components/MaterialSelectDrawer.vue';
  import MaterialBasicInfoModal from '/@/views/material/components/MaterialBasicInfoModal.vue';
  const basicInfoRef = ref<InstanceType<typeof MaterialBasicInfoModal>>();
  import { loadMaterialMap } from '/@/views/material/material.util';
  import { getAllMaterialCandidateItems, getPlanMaterialList } from '../Plan.api';
  import { validateEditableRows } from '/@/components/EditableTable';

  const props = withDefaults(
    defineProps<{
      periodId?: string;
      contractItems?: Recordable[];
      contractLoading?: boolean;
      candidateId?: string;
      editable?: boolean;
      busy?: boolean;
      quotePricing?: boolean;
      directQuotation?: boolean;
      pricingEditable?: boolean;
      basePriceEditable?: boolean;
      costVisible?: boolean;
      snapshotOnly?: boolean;
      priceVisible?: boolean;
      structureEditable?: boolean;
      mode?: 'plan' | 'quotation' | 'supplement' | 'rework';
      showToolbar?: boolean;
      showAction?: boolean;
      showRemark?: boolean;
      paginated?: boolean;
      combinedMaterialIdentity?: boolean;
    }>(),
    {
      contractItems: () => [],
      contractLoading: false,
      editable: true,
      structureEditable: true,
      priceVisible: false,
      basePriceEditable: false,
      mode: 'plan',
      showToolbar: true,
      showAction: true,
      showRemark: true,
      paginated: false,
      combinedMaterialIdentity: false,
    }
  );

  const { createMessage } = useMessage();
  const emit = defineEmits<{ loaded: [count: number] }>();
  const [registerDrawer, { openDrawer }] = useDrawer();
  const rows = ref<any[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  // 分页只控制展示；草稿、校验和全量同步始终使用完整 rows，避免遗漏其他页。
  const tablePagination = computed(() =>
    props.paginated
      ? {
          current: currentPage.value,
          pageSize: pageSize.value,
          total: rows.value.length,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total: number) => `共 ${total} 条`,
          onChange: (page: number, size: number) => {
            currentPage.value = size === pageSize.value ? page : 1;
            pageSize.value = size;
          },
        }
      : false
  );
  watch(
    () => rows.value.length,
    (count) => {
      currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(count / pageSize.value)));
    }
  );
  const loading = ref(false);
  const loaded = ref(false);
  const loadFailed = ref(false);
  const persistedSnapshot = ref('[]');
  let keySeed = 0;
  let loadSequence = 0;
  let materialMapPrimed = false;
  const quantityAndCostPrecision = 2;

  function materialDisplayName(record: any) {
    const name = record.materialName || '—';
    const brand = String(record.brand ?? '').trim();
    return props.mode === 'quotation' && brand ? `${name}（${brand}）` : name;
  }

  const quantityText = computed(() => {
    if (props.mode === 'quotation') return '数量';
    if (props.mode === 'supplement') return '补料数量';
    if (props.mode === 'rework') return '额外领料量';
    return '计划数量';
  });

  const tableScrollX = computed(() => {
    if (props.mode === 'quotation' && props.combinedMaterialIdentity) return 1100;
    if (props.quotePricing) return props.combinedMaterialIdentity ? 1650 : 1800;
    return props.combinedMaterialIdentity ? 1050 : 1180;
  });

  const columns = computed(() => [
    ...(props.combinedMaterialIdentity
      ? [{ title: '物料名称', key: 'materialIdentity', width: props.mode === 'quotation' ? 220 : 130, fixed: 'left' }]
      : [{ title: '物料编码', dataIndex: 'materialCode', key: 'materialCode', width: 130, fixed: 'left' }]),
    ...(!props.combinedMaterialIdentity ? [{ title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 130 }] : []),
    ...(!(props.mode === 'quotation' && props.combinedMaterialIdentity) ? [{ title: '品牌', dataIndex: 'brand', key: 'brand', width: 60 }] : []),
    { title: '型号', dataIndex: 'model', key: 'model', width: props.mode === 'quotation' ? 120 : 80 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 90, align: 'center', required: props.editable },
    { title: quantityText.value, key: 'plannedQty', width: 110, required: props.editable },
    ...(props.mode === 'quotation' && props.quotePricing && (props.costVisible || props.priceVisible || props.basePriceEditable)
      ? [{ title: '成本价', key: 'basePrice', width: 100, required: props.basePriceEditable }]
      : []),
    ...(props.mode === 'quotation' && props.quotePricing && props.priceVisible
      ? [
          ...(!props.directQuotation ? [{ title: '指导比例', key: 'markupRate', width: 120 }] : []),
          { title: props.directQuotation ? '报价' : '指导价', key: 'finalPrice', width: 100, required: props.directQuotation && props.pricingEditable },
        ]
      : []),
    ...(props.showRemark ? [{ title: '备注', key: 'remark', width: props.mode === 'quotation' ? undefined : 120 }] : []),
    ...(props.showAction ? [{ title: '操作', key: 'action', width: 80, align: 'center', fixed: 'right' }] : []),
  ]);

  const totalQty = computed(() =>
    rows.value.reduce((sum, item) => sum + (Number(item.plannedQty) || 0), 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  );

  function serializeRows(list: any[]) {
    return JSON.stringify(
      list.map((item) => ({
        id: item.id ? String(item.id) : '',
        materialId: item.materialId ? String(item.materialId) : '',
        unitValue: item._unitValue == null ? '' : String(item._unitValue),
        plannedQty: item.plannedQty == null || item.plannedQty === '' ? null : Number(item.plannedQty),
        remark: String(item.remark || ''),
        ...(props.mode === 'quotation' ? { basePrice: item.basePrice, markupRate: item.markupRate, finalPrice: item.finalPrice } : {}),
      }))
    );
  }

  const dirty = computed(() => serializeRows(rows.value) !== persistedSnapshot.value);

  function openMaterialDrawer() {
    if (!props.editable || !props.structureEditable) return;
    if (loading.value) {
      createMessage.warning('用料清单仍在加载，请稍后再选择物料');
      return;
    }
    openDrawer(true, { excludeMaterialIds: rows.value.map((item) => item.materialId) });
  }

  function createUnitOptions(material: any, currentUnitId?: string, currentUnit?: string) {
    const units = Array.isArray(material?.unitList) ? [...material.unitList] : [];
    units.sort((a: any, b: any) => Number(b.isBaseUnit || 0) - Number(a.isBaseUnit || 0) || Number(a.sortNo || 0) - Number(b.sortNo || 0));
    if (props.mode !== 'supplement') {
      const options = units.filter((item: any) => item.id && item.unitName).map((item: any) => ({ label: item.unitName, value: String(item.id) }));
      const matchedUnit = units.find((item: any) => String(item.unitName || '') === String(currentUnit || ''));
      const resolvedCurrentUnitId = currentUnitId || matchedUnit?.id;
      if (resolvedCurrentUnitId && !options.some((item: any) => item.value === String(resolvedCurrentUnitId))) {
        options.push({ label: currentUnit || '原单位', value: String(resolvedCurrentUnitId) });
      }
      return options;
    }
    const names = units.map((item: any) => item.unitName).filter(Boolean);
    if (!names.length && material?.unit) names.push(material.unit);
    if (!names.length && currentUnit) names.push(currentUnit);
    return Array.from(new Set(names.map(String))).map((name) => ({ label: name, value: name }));
  }

  function getDefaultUnit(material: any, options: { value: string }[], currentUnitId?: string, currentUnit?: string) {
    const currentUnitRecord = material?.unitList?.find(
      (item: any) => String(item.id || '') === String(currentUnitId || currentUnit || '') || String(item.unitName || '') === String(currentUnit || '')
    );
    const useUnitId = props.mode !== 'supplement';
    const currentValue = useUnitId ? currentUnitId || currentUnitRecord?.id : currentUnitRecord?.unitName || currentUnit;
    if (currentValue && options.some((item) => item.value === String(currentValue))) return String(currentValue);
    const baseUnit = material?.unitList?.find((item: any) => item.isBaseUnit);
    return useUnitId ? (baseUnit?.id ? String(baseUnit.id) : options[0]?.value) : baseUnit?.unitName || material?.unit || options[0]?.value;
  }

  async function load() {
    currentPage.value = 1;
    const requestSequence = ++loadSequence;
    const queryId = props.mode === 'quotation' ? props.candidateId : props.periodId;
    if (!queryId) {
      rows.value = [];
      persistedSnapshot.value = serializeRows(rows.value);
      loading.value = false;
      loaded.value = false;
      loadFailed.value = false;
      emit('loaded', 0);
      return;
    }
    if (props.mode === 'supplement' || props.mode === 'rework') {
      rows.value = [];
      persistedSnapshot.value = serializeRows(rows.value);
      loading.value = false;
      loaded.value = true;
      loadFailed.value = false;
      emit('loaded', 0);
      return;
    }
    loading.value = true;
    loaded.value = false;
    loadFailed.value = false;
    try {
      const listRequest =
        props.mode === 'quotation'
          ? getAllMaterialCandidateItems(props.candidateId!)
          : getPlanMaterialList({ periodId: props.periodId, pageNo: 1, pageSize: 1000 });
      if (props.snapshotOnly) {
        const result = await listRequest;
        await hydrateRows(result?.records || result || [], requestSequence, {});
        return;
      }
      // 首载时让清单和物料主数据并发；当前组件生命周期内只强制刷新一次，后续回查复用模块缓存。
      const shouldRefreshMaterialMap = !materialMapPrimed;
      materialMapPrimed = true;
      const [result, materialMap]: any[] = await Promise.all([listRequest, loadMaterialMap({ force: shouldRefreshMaterialMap })]);
      const list = result?.records || result || [];
      await hydrateRows(list, requestSequence, materialMap);
    } catch (error: any) {
      if (requestSequence === loadSequence) {
        loaded.value = false;
        loadFailed.value = true;
        createMessage.error(error?.message || '用料清单加载失败，请刷新后重试');
      }
    } finally {
      if (requestSequence === loadSequence) loading.value = false;
    }
  }

  async function hydrateRows(list: any[], requestSequence?: number, providedMaterialMap?: Record<string, any>) {
    // 物料分页列表已包含 unitList，统一从模块缓存补齐编码和单位，避免保存后逐条请求 queryById。
    const materialMap = providedMaterialMap || (await loadMaterialMap());
    if (requestSequence && requestSequence !== loadSequence) return;
    rows.value = list.map((item: any) => {
      const pricingDefaults: Record<string, any> = {};
      // 只在市场定价时初始化，不覆盖已经保存的比例或手动指导价。
      if (props.pricingEditable && !props.directQuotation) {
        const rate = hasPrice(item.markupRate) ? item.markupRate : item.guideMarkupRate;
        if (hasPrice(rate)) pricingDefaults.markupRate = rate;
        if (!hasPrice(item.finalPrice) && hasPrice(item.basePrice) && hasPrice(rate)) {
          try { pricingDefaults.finalPrice = guidancePrice(item.basePrice, rate); }
          catch (error: any) { pricingDefaults._priceError = { key: 'markupRate', message: error.message }; }
        }
      }
      const material = materialMap[String(item.materialId || '')] || {};
      const unitOptions = createUnitOptions(material, item.unitId, item.unit);
      return {
        ...item,
        ...pricingDefaults,
        _quotationSnapshot: quotationSnapshot(item),
        _key: ++keySeed,
        materialCode: material.materialCode || item.materialCode || '—',
        _unitValue: getDefaultUnit(material, unitOptions, item.unitId, item.unit),
        _unitOptions: unitOptions,
        _unitLoading: false,
        plannedQty: props.mode === 'quotation' ? (item.quantity ?? 1) : (item.plannedQty ?? item.purchaseQty ?? 1),
      };
    });
    persistedSnapshot.value = serializeRows(rows.value);
    loaded.value = true;
    emit('loaded', rows.value.length);
  }

  async function hydrateSavedQuotationRows(records: any[]) {
    if (props.mode !== 'quotation') return;
    // 保存响应是本次写入的权威结果，避免候选单 ID 变化触发的旧查询覆盖回显。
    loadSequence += 1;
    loading.value = true;
    loadFailed.value = false;
    try {
      await hydrateRows(Array.isArray(records) ? records : []);
    } finally {
      loading.value = false;
    }
  }

  async function handleSelected(selected: any[]) {
    if (!props.editable || !props.structureEditable) return;
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
        ...(props.mode === 'quotation' && props.basePriceEditable ? { basePrice: props.directQuotation ? 0 : material.costPrice ?? 0 } : {}),
        ...(props.mode === 'quotation' && props.directQuotation ? { finalPrice: '0.00' } : {}),
        remark: '',
      };
      rows.value.push(row);
      try {
        const materialMap = props.mode === 'quotation' || material.unitList?.length ? undefined : await loadMaterialMap();
        const detail = materialMap?.[String(material.id || '')] || material;
        row._unitOptions = createUnitOptions(detail, material.unitId, material.unit);
        row._unitValue = getDefaultUnit(detail, row._unitOptions, material.unitId, material.unit);
        if (!row._unitOptions.length) throw new Error('没有可用单位');
      } catch {
        row._unitOptions = [];
        row._unitValue = undefined;
        createMessage.warning(`「${material.materialName}」的单位列表加载失败，请稍后重试`);
      } finally {
        row._unitLoading = false;
      }
    }
  }

  function contractItem(row: Recordable) {
    return props.mode === 'plan' ? props.contractItems.find((item) => String(item.materialId) === String(row.materialId)) : undefined;
  }

  function contractMinimum(row: Recordable) {
    return Math.max(0.01, Number(contractItem(row)?.quantity) || 0);
  }

  function validateContractRows(data: Recordable[]) {
    if (props.mode !== 'plan') return;
    for (const item of props.contractItems) {
      const row = data.find((entry) => String(entry.materialId) === String(item.materialId));
      if (!row) throw new Error('合同物料不可删除，请刷新用料计划后重试');
      const label = row.materialName || item.materialId;
      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) throw new Error(`「${label}」合同数量无效，请核对合同清单`);
      if (Number(row.plannedQty) < Number(item.quantity)) throw new Error(`「${label}」计划数量不能低于合同数量 ${item.quantity}`);
      if (item.unitId && String(row._unitValue) !== String(item.unitId)) throw new Error(`「${label}」单位与合同清单不一致，请核对已有计划`);
    }
  }

  function removeRow(key: number) {
    const row = rows.value.find((item) => item._key === key);
    if (!props.editable || !props.structureEditable || props.contractLoading || (row && contractItem(row))) return;
    rows.value = rows.value.filter((item) => item._key !== key);
  }

  async function importRows(records: Recordable[]) {
    if (!props.editable || !['plan', 'rework'].includes(props.mode)) throw new Error('当前用料计划不可编辑');
    if (loading.value) throw new Error('用料清单仍在加载，请稍后再导入');
    const incoming = Array.from(
      new Map<string, Recordable>(
        (records || []).filter((item) => item.materialId).map((item) => [String(item.materialId), item] as [string, Recordable])
      ).values()
    );
    if (!incoming.length) throw new Error('没有可导入的物料');
    loading.value = true;
    try {
      const materialMap = await loadMaterialMap();
      let added = 0;
      let updated = 0;
      const nextRows = [...rows.value];
      incoming.forEach((item) => {
        const materialId = String(item.materialId || '');
        if (!materialId) return;
        const detail = materialMap[materialId] || item;
        const unitOptions = createUnitOptions(detail);
        if (!unitOptions.length) throw new Error(`「${detail.materialName || item.materialName || materialId}」没有可用单位`);
        const requestedUnit = String(item.unit || '');
        const requestedUnitId = String(item.unitId || detail?.unitList?.find((unit: any) => String(unit.unitName || '') === requestedUnit)?.id || '');
        const unitValue =
          requestedUnitId && unitOptions.some((option) => option.value === requestedUnitId) ? requestedUnitId : getDefaultUnit(detail, unitOptions);
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
      validateContractRows(nextRows);
      rows.value = nextRows;
      emit('loaded', rows.value.length);
      return { added, updated };
    } finally {
      loading.value = false;
    }
  }

  function getData() {
    if (props.contractLoading) throw new Error('合同清单尚未加载完成，请稍后再保存');
    if (loading.value) throw new Error('用料清单仍在加载，请稍后再保存');
    validateContractRows(rows.value);
    if (loadFailed.value) throw new Error('用料清单加载失败，为避免覆盖原数据，请刷新后重试');
    const loadingUnit = rows.value.find((item) => item._unitLoading);
    if (loadingUnit) throw new Error(`「${loadingUnit.materialName || '未命名物料'}」的单位仍在加载，请稍后再保存`);
    const issues = validateEditableRows(rows.value, {
      selectorField: 'materialId',
      selectorLabel: '物料',
      optionLabel: (value) => rows.value.find((item) => String(item.materialId) === String(value))?.materialName || String(value),
      rules: [
        ...(props.directQuotation && props.pricingEditable
          ? [{ field: 'finalPrice', label: '报价', required: true, validate: (value: any, row: any) => {
              try { validateDirectQuotation(row.basePrice, value); return true; }
              catch (error: any) { return error.message; }
            } }]
          : []),
        ...(props.mode === 'quotation' && props.basePriceEditable
          ? [{ field: 'basePrice', label: '成本价', required: true }]
          : []),
        { field: '_unitValue', label: '单位', required: true },
        {
          field: 'plannedQty',
          label: quantityText.value,
          required: true,
          validate: (value) => Number(value) > 0 || `${quantityText.value}必须大于 0`,
        },
      ],
    });
    if (issues.length) {
      if (props.paginated) currentPage.value = Math.floor(issues[0].rowIndex / pageSize.value) + 1;
      throw new Error(issues[0].message);
    }
    if (props.mode === 'quotation') {
      return rows.value.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        materialId: item.materialId,
        quantity: Number(item.plannedQty),
        unitId: item._unitValue,
        remark: item.remark,
        ...(props.basePriceEditable ? quotationPricePayload({ basePrice: item.basePrice }) : {}),
        ...(props.pricingEditable ? quotationPricePayload({ ...(!props.directQuotation ? { markupRate: item.markupRate } : {}), finalPrice: item.finalPrice }) : {}),
      }));
    }
    if (props.mode === 'plan' || props.mode === 'rework') {
      return rows.value.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        materialId: item.materialId,
        plannedQty: Number(item.plannedQty),
        unitId: item._unitValue,
        remark: item.remark,
      }));
    }
    return rows.value.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      materialId: item.materialId,
      materialCode: item.materialCode,
      materialCategory: item.materialCategory,
      materialName: item.materialName,
      brand: item.brand,
      model: item.model,
      // 补料接口仍提交单位名称；计划用料 editBatch 在上方单独提交 unitId。
      unit: item._unitOptions?.find((option: any) => String(option.value) === String(item._unitValue))?.label || String(item._unitValue),
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

  function reset() {
    loadSequence += 1;
    rows.value = [];
    persistedSnapshot.value = serializeRows(rows.value);
    loading.value = false;
    loaded.value = false;
    loadFailed.value = false;
    emit('loaded', 0);
  }

  function getSubmissionState() {
    return {
      loading: loading.value,
      loaded: loaded.value,
      loadFailed: loadFailed.value,
      saving: false,
      dirty: dirty.value,
      hasData: rows.value.length > 0,
    };
  }

  defineExpose({
    async restoreQuotationDraft(records: any[]) {
      if (props.mode !== 'quotation' || !props.editable) return;
      const serverSnapshot = persistedSnapshot.value;
      await hydrateRows(records.map((row) => ({ ...row, quantity: row.plannedQty, unitId: row._unitValue || row.unitId })));
      persistedSnapshot.value = serverSnapshot;
    },
    getQuotationReviewData(latest: any[]) {
      const edited = getData();
      if (!edited.length || latest.length !== rows.value.length) throw new Error('报价明细为空或已变化，请刷新后审批');
      return latest.map((item) => {
        const row = rows.value.find((value) => String(value.id) === String(item.id));
        if (!row || row._quotationSnapshot !== quotationSnapshot(item)) throw new Error('报价明细已被修改，请刷新后审批');
        return {
          id: item.id,
          materialId: item.materialId,
          quantity: item.quantity,
          unitId: item.unitId,
          remark: item.remark,
          ...quotationPricePayload(row, true),
        };
      });
    },
    getData,
    getRows: () => rows.value,
    importRows,
    getMaterialIds: () => rows.value.map((item) => String(item.materialId)),
    hydrateSavedQuotationRows,
    reload: load,
    reset,
    getRowCount: () => rows.value.length,
    getSubmissionState,
  });

  watch(() => [props.periodId, props.candidateId, props.mode], load, { immediate: true });

  function changeQuotePrice(row: any, key: string, value: any, showError = false) {
    if (key === 'basePrice' ? !props.basePriceEditable : !props.priceVisible || !props.pricingEditable) return;
    row._priceError = undefined;
    row[key] = hasPrice(value) ? value : null;
    if (!hasPrice(value)) return;
    try {
      decimalPrice(value, key === 'basePrice' ? '成本价' : key === 'markupRate' ? '提价比例' : '终价', key === 'markupRate' ? 4 : 2);
      if (key === 'markupRate' && props.pricingEditable) row.finalPrice = guidancePrice(row.basePrice, value);
      if (props.directQuotation && hasPrice(row.basePrice) && hasPrice(row.finalPrice)) {
        validateDirectQuotation(row.basePrice, row.finalPrice);
      }
    } catch (error: any) {
      if (showError || props.directQuotation) row._priceError = { key, message: error.message };
    }
  }
</script>

<style lang="less" scoped>
  .material-plan-table__model-clamp {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 20px;
    max-height: 40px;
  }
  .material-plan-table {
    min-width: 0;

    & {
      :deep(.ant-input-number),
      :deep(.ant-input-number-group-wrapper),
      :deep(.ant-input-number-affix-wrapper),
      :deep(.ant-select),
      :deep(.ant-input) {
        min-width: 0;
        max-width: 100%;
        width: 100%;
        box-sizing: border-box;
      }

      :deep(.ant-input-number-group-addon) {
        padding-inline: 6px;
      }

      :deep(.ant-table-cell) {
        overflow-wrap: anywhere;
      }
    }

    &__price-error {
      color: @error-color;
      font-size: 12px;
      margin-top: 4px;
    }

    &__material-identity {
      min-width: 0;
      line-height: 1.35;
    }

    &__material-name,
    &__material-code {
      display: block;
      overflow-wrap: anywhere;
    }

    &__material-name {
      color: @text-color;
      font-weight: 500;
    }

    &__material-code {
      margin-top: 2px;
      color: @text-color-secondary;
      font-size: 12px;
      line-height: 1.3;
      font-variant-numeric: tabular-nums;
    }
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

    &__required {
      margin-left: 4px;
      color: @error-color;
    }
  }
</style>
