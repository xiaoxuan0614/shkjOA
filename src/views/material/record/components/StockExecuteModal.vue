<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    :title="title"
    width="min(1240px, calc(100vw - 32px))"
    :okText="okText"
    :confirmLoading="submitting"
    :closable="!submitting"
    :keyboard="!submitting"
    :maskClosable="!submitting"
    :okButtonProps="{ disabled: selectedCount === 0 || !!loadError || allDone }"
    @ok="handleOk"
  >
    <a-descriptions :column="{ xs: 1, sm: 2, md: 4 }" size="small" bordered class="stock-exec__desc">
      <a-descriptions-item label="申请单号">{{ apply.applyNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="方向">
        <a-tag :color="typeMap[apply.applyType]?.color">{{ typeMap[apply.applyType]?.text || apply.applyType || '—' }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="业务类型">
        <a-tag :color="bizMap[apply.bizType]?.color">{{ bizMap[apply.bizType]?.text || apply.bizType || '—' }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="申请人">{{ apply.applyUserName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="项目" :span="2">{{ apply.projectName || apply.projectNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="申请备注" :span="2">
        <a-tooltip :title="apply.remark">
          <span class="stock-exec__summary-remark">{{ apply.remark || '—' }}</span>
        </a-tooltip>
      </a-descriptions-item>
    </a-descriptions>

    <div class="stock-exec__status" aria-live="polite">
      <span
        >共 <strong>{{ rows.length }}</strong> 种物料</span
      >
      <span
        >待执行 <strong>{{ executableCount }}</strong> 种</span
      >
      <span
        >已完成 <strong>{{ completedCount }}</strong> 种</span
      >
      <span class="stock-exec__status-selected"
        >已选 <strong>{{ selectedCount }}</strong> 种</span
      >
    </div>

    <div class="stock-exec__toolbar">
      <div class="stock-exec__filters">
        <a-input
          v-model:value="keyword"
          allow-clear
          :disabled="submitting"
          class="stock-exec__search"
          placeholder="搜索物料名称、分类、品牌或型号"
          @pressEnter="resetPage"
        />
        <a-select
          v-model:value="statusFilter"
          :options="statusOptions"
          :disabled="submitting"
          class="stock-exec__status-filter"
          @change="resetPage"
        />
        <a-checkbox v-model:checked="selectedOnly" :disabled="submitting" @change="resetPage">仅看已选</a-checkbox>
      </div>
      <div class="stock-exec__batch-actions">
        <a-button size="small" :disabled="submitting || !filteredExecutableRows.length" @click="selectAllFiltered">全选筛选结果</a-button>
        <a-button size="small" :disabled="submitting || !selectedCount" @click="fillSelectedWithRemaining">按可执行量填充</a-button>
        <a-button size="small" :disabled="submitting || !selectedCount" @click="clearSelection">取消全选</a-button>
      </div>
    </div>

    <div v-if="loadError" class="stock-exec__error" role="alert">
      <span>{{ loadError }}</span>
      <a-button type="link" size="small" :disabled="submitting" @click="loadRows">重新加载</a-button>
    </div>
    <a-alert
      v-else-if="allDone"
      type="success"
      show-icon
      class="stock-exec__notice"
      :message="isReturn ? '该申请已全部完成入库处置' : `该申请已全部完成${ioType === 'OUT' ? '出库' : '入库'}`"
    />
    <a-alert
      v-else-if="isReturn"
      type="info"
      show-icon
      class="stock-exec__notice"
      message="项目还料默认按合格回库处理，可逐项改为报废或遗失；报废和遗失必须填写处置原因。"
    />

    <template v-if="!loadError">
      <template v-if="ioType === 'OUT'">
        <div class="stock-exec__outbound-list" role="table" aria-label="出库物料列表">
          <div class="stock-exec__outbound-grid stock-exec__outbound-header" role="row">
            <div role="columnheader">
              <a-checkbox
                aria-label="选择当前页可执行物料"
                :checked="allCurrentPageChecked"
                :indeterminate="someCurrentPageChecked"
                :disabled="submitting || !currentPageExecutableRows.length"
                @change="onHeaderCheck"
              />
            </div>
            <div role="columnheader">物料信息</div>
            <div role="columnheader">申请量</div>
            <div role="columnheader">库存</div>
            <div role="columnheader">已出</div>
            <div role="columnheader">待出</div>
          </div>

          <div class="stock-exec__outbound-body" :style="outboundListStyle">
            <template v-if="currentPageRows.length">
              <div
                v-for="record in currentPageRows"
                :key="record.itemId"
                class="stock-exec__outbound-item"
                :class="rowClassName(record)"
                role="rowgroup"
              >
                <div class="stock-exec__outbound-grid stock-exec__outbound-summary" role="row">
                  <div role="cell">
                    <a-checkbox
                      :checked="!!record.checked"
                      :disabled="submitting || !canExecuteRow(record)"
                      :aria-label="`选择物料${record.materialName || ''}`"
                      @change="(event) => onRowCheck(record, event)"
                    />
                  </div>
                  <div class="stock-exec__material" role="cell">
                    <div class="stock-exec__material-name">{{ record.materialName || '未命名物料' }}</div>
                    <div class="stock-exec__material-meta">
                      <span v-if="record.materialCode">{{ record.materialCode }}</span>
                      <span v-if="record.materialCategory">{{ record.materialCategory }}</span>
                      <span v-if="formatBrand(record.brand)">{{ formatBrand(record.brand) }}</span>
                      <span v-if="record.model">{{ record.model }}</span>
                    </div>
                  </div>
                  <div class="stock-exec__outbound-stat" role="cell">
                    <span class="stock-exec__mobile-label">申请量</span>
                    <strong>{{ formatQuantity(record.appliedQty) }}</strong>
                    <small>{{ record.unitName || '' }}</small>
                  </div>
                  <div class="stock-exec__outbound-stat" role="cell">
                    <span class="stock-exec__mobile-label">库存</span>
                    <strong :class="{ 'stock-exec__number--empty': record.currentUnitStockQty !== undefined && record.currentUnitStockQty <= 0 }">
                      {{ formatOptionalQuantity(record.currentUnitStockQty) }}
                    </strong>
                    <small>{{ record.currentUnitStockQty === undefined ? '' : record.unitName || '' }}</small>
                  </div>
                  <div class="stock-exec__outbound-stat" role="cell">
                    <span class="stock-exec__mobile-label">已出</span>
                    <strong>{{ formatQuantity(record.executedQty) }}</strong>
                    <small>{{ record.unitName || '' }}</small>
                  </div>
                  <div class="stock-exec__outbound-stat stock-exec__outbound-stat--pending" role="cell">
                    <span class="stock-exec__mobile-label">待出</span>
                    <strong>{{ formatQuantity(record.remain) }}</strong>
                    <small>{{ record.unitName || '' }}</small>
                  </div>
                </div>

                <div class="stock-exec__outbound-operation" role="row">
                  <div class="stock-exec__outbound-operation-title" role="cell">操作出库</div>
                  <div class="stock-exec__outbound-operation-content" role="cell">
                    <div class="stock-exec__outbound-quantity">
                      <span>本次出库</span>
                      <div class="stock-exec__field">
                        <a-input-number
                          v-model:value="record.execQty"
                          :data-exec-item="record.itemId"
                          :min="0.0001"
                          :max="maxExecutableQty(record)"
                          :precision="4"
                          :disabled="submitting || record.remain <= 0 || !record.checked"
                          :status="record.qtyError ? 'error' : ''"
                          placeholder="输入出库数量"
                          style="width: 100%"
                          @change="clearRowErrors(record)"
                        />
                        <span v-if="record.qtyError" class="stock-exec__field-error">{{ record.qtyError }}</span>
                      </div>
                      <span class="stock-exec__outbound-unit">{{ record.unitName || '' }}</span>
                    </div>
                    <a-input
                      v-model:value="record.remark"
                      :disabled="submitting || record.remain <= 0 || !record.checked"
                      placeholder="出库备注（选填）"
                    />
                  </div>
                </div>
              </div>
            </template>
            <a-empty
              v-else
              class="stock-exec__outbound-empty"
              :description="rows.length ? '当前筛选条件下没有物料' : emptyMessage || '暂无可办理的物料明细'"
            />
          </div>
        </div>

        <a-pagination
          v-if="filteredRows.length"
          v-bind="tablePagination"
          class="stock-exec__outbound-pagination"
          size="small"
          @change="handleListPageChange"
          @showSizeChange="handleListPageChange"
        />
      </template>

      <a-table
        v-else
        :columns="columns"
        :data-source="filteredRows"
        :row-key="(record) => record.itemId"
        :row-class-name="rowClassName"
        :pagination="tablePagination"
        :scroll="tableScroll"
        size="small"
        bordered
        @change="handleTableChange"
      >
        <template #emptyText>
          <a-empty :description="rows.length ? '当前筛选条件下没有物料' : emptyMessage || '暂无可办理的物料明细'" />
        </template>
        <template #headerCell="{ column }">
          <a-checkbox
            v-if="column.key === 'check'"
            aria-label="选择当前页可执行物料"
            :checked="allCurrentPageChecked"
            :indeterminate="someCurrentPageChecked"
            :disabled="submitting || !currentPageExecutableRows.length"
            @change="onHeaderCheck"
          />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'check'">
            <a-checkbox
              :checked="!!record.checked"
              :disabled="submitting || !canExecuteRow(record)"
              :aria-label="`选择物料${record.materialName || ''}`"
              @change="(event) => onRowCheck(record, event)"
            />
          </template>
          <template v-else-if="column.key === 'material'">
            <div class="stock-exec__material">
              <div class="stock-exec__material-name">{{ record.materialName || '未命名物料' }}</div>
              <div class="stock-exec__material-meta">
                <span v-if="record.materialCode">{{ record.materialCode }}</span>
                <span v-if="record.materialCategory">{{ record.materialCategory }}</span>
                <span v-if="formatBrand(record.brand)">{{ formatBrand(record.brand) }}</span>
                <span v-if="record.model">{{ record.model }}</span>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'quantity'">
            <div class="stock-exec__quantity-overview">
              <span
                >批准 <strong>{{ formatQuantity(record.approvedQty) }}</strong
                >{{ record.unitName || '' }}</span
              >
              <small>申请 {{ formatQuantity(record.appliedQty) }}{{ record.unitName || '' }}</small>
              <small>已执行 {{ formatQuantity(record.executedQty) }}{{ record.unitName || '' }}</small>
            </div>
          </template>
          <template v-else-if="column.key === 'remain'">
            <span class="stock-exec__number" :class="{ 'stock-exec__number--done': record.remain <= 0 }">
              {{ formatQuantity(record.remain) }}{{ record.unitName || '' }}
            </span>
          </template>
          <template v-else-if="column.key === 'execQty'">
            <div class="stock-exec__field">
              <a-input-number
                v-model:value="record.execQty"
                :data-exec-item="record.itemId"
                :min="0.0001"
                :max="maxExecutableQty(record)"
                :precision="4"
                :disabled="submitting || record.remain <= 0 || !record.checked"
                :status="record.qtyError ? 'error' : ''"
                style="width: 100%"
                @change="clearRowErrors(record)"
              />
              <span v-if="record.qtyError" class="stock-exec__field-error">{{ record.qtyError }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'disposition'">
            <div class="stock-exec__disposition">
              <a-select
                v-model:value="record.dispositionType"
                :data-disposition-item="record.itemId"
                :options="dispositionOptions"
                :disabled="submitting || record.remain <= 0 || !record.checked"
                :status="record.dispositionError ? 'error' : ''"
                style="width: 100%"
                @change="() => onDispositionChange(record)"
              />
              <a-input
                v-if="needsDispositionRemark(record)"
                v-model:value="record.dispositionRemark"
                :data-disposition-remark-item="record.itemId"
                :disabled="submitting || !record.checked"
                :status="record.dispositionError ? 'error' : ''"
                placeholder="填写报废/遗失原因"
                @input="clearRowErrors(record)"
              />
              <span v-if="record.dispositionError" class="stock-exec__field-error">{{ record.dispositionError }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'remark'">
            <a-input v-model:value="record.remark" :disabled="submitting || record.remain <= 0 || !record.checked" placeholder="执行备注（选填）" />
          </template>
        </template>
      </a-table>
    </template>

    <div class="stock-exec__tip"> 表头勾选只作用于当前页；“全选筛选结果”可跨页选择。切换筛选和分页不会丢失已填写内容。 </div>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { computed, nextTick, reactive, ref, watch } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { useStockAccess } from '../stockAccess';
  const { canExecute } = useStockAccess();
  import { queryById, queryItems, executeApply } from '../StockApply.api';
  import { loadDictMap } from '../../material.util';
  import { APPROVAL_APPROVED } from '/@/utils/approvalStatus';

  type StatusFilter = 'EXECUTABLE' | 'DONE' | 'ALL';

  const { createMessage, createConfirm } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const apply = ref<any>({});
  const rows = ref<any[]>([]);
  const loadError = ref('');
  const emptyMessage = ref('');
  const keyword = ref('');
  const statusFilter = ref<StatusFilter>('EXECUTABLE');
  const selectedOnly = ref(false);
  const submitting = ref(false);
  let loadSequence = 0;

  const pagination = reactive({ current: 1, pageSize: 30 });
  const bizMap = ref<Record<string, { text: string; color: string }>>({});
  const typeMap = ref<Record<string, { text: string; color: string }>>({});
  const brandMap = ref<Record<string, { text: string; color: string }>>({});
  loadDictMap('stock_apply_biz_type').then((map) => (bizMap.value = map));
  loadDictMap('stock_apply_type').then((map) => (typeMap.value = map));
  loadDictMap('material_brand').then((map) => (brandMap.value = map));

  const dispositionOptions = [
    { label: '合格回库', value: 'RESTOCK' },
    { label: '报废', value: 'SCRAP' },
    { label: '遗失', value: 'LOST' },
  ];

  const isReturn = computed(
    () =>
      String(apply.value.applyType || '').toUpperCase() === 'IN' &&
      String(apply.value.bizType || '').toUpperCase() === 'RETURN' &&
      String(apply.value.usageType || '').toUpperCase() === 'PROJECT'
  );
  const ioType = computed<'IN' | 'OUT'>(() => (apply.value.applyType === 'IN' ? 'IN' : 'OUT'));
  const title = computed(() => (ioType.value === 'OUT' ? '办理出库' : '办理入库'));
  const selectedRows = computed(() => rows.value.filter((row) => row.checked && row.remain > 0));
  const selectedCount = computed(() => selectedRows.value.length);
  const executableCount = computed(() => rows.value.filter((row) => row.remain > 0).length);
  const completedCount = computed(() => rows.value.filter((row) => row.remain <= 0).length);
  const allDone = computed(() => rows.value.length > 0 && executableCount.value === 0);
  const okText = computed(() => `${ioType.value === 'OUT' ? '执行出库' : '执行入库'}（已选 ${selectedCount.value} 条）`);

  const statusOptions = computed(() => [
    { label: `待执行（${executableCount.value}）`, value: 'EXECUTABLE' },
    { label: `已完成（${completedCount.value}）`, value: 'DONE' },
    { label: `全部（${rows.value.length}）`, value: 'ALL' },
  ]);

  const columns = computed(() => {
    const result: any[] = [
      { title: '选择', key: 'check', width: 54, align: 'center', fixed: 'left' },
      { title: '物料', key: 'material', width: 280, fixed: 'left' },
      { title: '数量概览', key: 'quantity', width: 170 },
      { title: ioType.value === 'OUT' ? '剩余待出库' : '剩余待入库', key: 'remain', width: 120, align: 'right' },
      { title: ioType.value === 'OUT' ? '*本次出库数' : '*本次入库数', key: 'execQty', width: 145 },
    ];
    if (ioType.value === 'OUT') result.splice(result.length - 1, 0, { title: '实时库存', key: 'stock', width: 135, align: 'right' });
    if (isReturn.value) result.push({ title: '*还料处置', key: 'disposition', width: 230 });
    result.push({ title: '执行备注', key: 'remark', width: 210 });
    return result;
  });

  const filteredRows = computed(() => {
    const normalizedKeyword = keyword.value.trim().toLowerCase();
    return rows.value.filter((row) => {
      if (statusFilter.value === 'EXECUTABLE' && row.remain <= 0) return false;
      if (statusFilter.value === 'DONE' && row.remain > 0) return false;
      if (selectedOnly.value && !row.checked) return false;
      if (!normalizedKeyword) return true;
      return [row.materialName, row.materialCode, row.materialCategory, row.brand, formatBrand(row.brand), row.model]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(normalizedKeyword));
    });
  });

  const tablePagination = computed(() => ({
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: filteredRows.value.length,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['30', '50'],
    disabled: submitting.value,
    showTotal: (total: number) => `共 ${total} 条`,
  }));
  const tableScroll = computed(() => ({
    x: isReturn.value ? 1210 : ioType.value === 'OUT' ? 1115 : 980,
    y: typeof window === 'undefined' ? 360 : Math.max(260, Math.min(440, window.innerHeight - 430)),
  }));
  const outboundListStyle = computed(() => ({ maxHeight: `${tableScroll.value.y}px` }));
  const currentPageRows = computed(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    return filteredRows.value.slice(start, start + pagination.pageSize);
  });
  const currentPageExecutableRows = computed(() => currentPageRows.value.filter(canExecuteRow));
  const filteredExecutableRows = computed(() => filteredRows.value.filter(canExecuteRow));
  const allCurrentPageChecked = computed(
    () => currentPageExecutableRows.value.length > 0 && currentPageExecutableRows.value.every((row) => row.checked)
  );
  const someCurrentPageChecked = computed(() => currentPageExecutableRows.value.some((row) => row.checked) && !allCurrentPageChecked.value);

  const [register, { closeModal, setModalProps }] = useModalInner(async (data) => {
    apply.value = data.record || {};
    rows.value = [];
    emptyMessage.value = '';
    keyword.value = '';
    selectedOnly.value = false;
    statusFilter.value = 'EXECUTABLE';
    pagination.current = 1;
    pagination.pageSize = 30;
    submitting.value = false;
    await loadRows();
  });

  async function loadRows() {
    const applyId = apply.value.id;
    if (!applyId) {
      loadError.value = '缺少申请 ID，无法加载物料明细';
      emptyMessage.value = '';
      return;
    }
    const requestSequence = ++loadSequence;
    loadError.value = '';
    emptyMessage.value = '';
    setModalProps({ loading: true });
    try {
      const latest: any = await queryById({ id: applyId });
      if (requestSequence !== loadSequence) return;
      apply.value = latest;
      if (!canExecute(latest)) throw new Error('当前申请不可执行或您没有出入库权限');
      const items = await loadAllItems(String(applyId));
      if (requestSequence !== loadSequence) return;
      const approvedItems = items.filter((item: any) => String(item.status) === APPROVAL_APPROVED);
      rows.value = approvedItems.map((item: any) => {
        const appliedQty = finiteNumber(item.applyQty ?? item.unitQty);
        const approvedQty = finiteNumber(item.approvedQty ?? item.applyQty ?? item.unitQty);
        const executedQty = finiteNumber(item.executedQty);
        const remain = Math.max(approvedQty - executedQty, 0);
        const currentUnitStockQty = optionalFiniteNumber(item.currentUnitStockQty);
        return {
          itemId: String(item.id),
          materialId: item.materialId,
          materialCode: item.materialCode || '',
          materialCategory: item.materialCategory,
          materialName: item.materialName,
          brand: item.brand,
          model: item.model,
          unitName: item.unitName,
          currentUnitStockQty,
          appliedQty,
          approvedQty,
          executedQty,
          remain,
          execQty: ioType.value === 'OUT' && currentUnitStockQty !== undefined ? Math.min(remain, currentUnitStockQty) : remain,
          checked: remain > 0 && !(ioType.value === 'OUT' && currentUnitStockQty !== undefined && currentUnitStockQty <= 0),
          remark: '',
          dispositionType: 'RESTOCK',
          dispositionRemark: '',
          qtyError: '',
          dispositionError: '',
        };
      });
      if (!rows.value.length) emptyMessage.value = '该申请暂无已审批通过的物料明细';
      if (rows.value.length > 0 && rows.value.every((row) => row.remain <= 0)) statusFilter.value = 'ALL';
    } catch (error: any) {
      if (requestSequence !== loadSequence) return;
      loadError.value = error?.message || '物料明细加载失败，请稍后重试';
      emptyMessage.value = '';
      rows.value = [];
    } finally {
      if (requestSequence === loadSequence) setModalProps({ loading: false });
    }
  }

  async function loadAllItems(applyId: string) {
    const records: any[] = [];
    const seenIds = new Set<string>();
    const pageSize = 100;
    for (let pageNo = 1; pageNo <= 1000; pageNo += 1) {
      const result: any = await queryItems({ applyId, pageNo, pageSize });
      const pageRecords = Array.isArray(result) ? result : result?.records || [];
      pageRecords.forEach((record: any) => {
        const recordId = String(record?.id || '');
        if (!recordId || seenIds.has(recordId)) return;
        seenIds.add(recordId);
        records.push(record);
      });
      if (Array.isArray(result)) return records;
      const pages = Number(result?.pages);
      const total = Number(result?.total);
      const current = Number(result?.current) || pageNo;
      if (pageRecords.length === 0) return records;
      if (Number.isFinite(pages) && pages > 0) {
        if (current >= pages) return records;
        continue;
      }
      if (Number.isFinite(total) && total >= 0) {
        if (records.length >= total) return records;
        continue;
      }
      if (pageRecords.length < pageSize) return records;
    }
    throw new Error('申请物料数量过多，未能完整加载，请联系管理员');
  }

  function finiteNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function optionalFiniteNumber(value: unknown) {
    if (value === null || value === undefined || value === '') return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  function formatQuantity(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : '—';
  }

  function formatOptionalQuantity(value: unknown) {
    return value === undefined ? '—' : formatQuantity(value);
  }

  function maxExecutableQty(row: any) {
    if (ioType.value !== 'OUT' || row.currentUnitStockQty === undefined) return row.remain;
    return Math.max(Math.min(row.remain, row.currentUnitStockQty), 0);
  }

  function canExecuteRow(row: any) {
    return row.remain > 0 && maxExecutableQty(row) > 0;
  }

  function formatBrand(value: unknown) {
    const raw = String(value ?? '');
    return brandMap.value[raw]?.text || raw;
  }

  function resetPage() {
    pagination.current = 1;
  }

  function handleTableChange(page: { current?: number; pageSize?: number }) {
    const nextPageSize = Number(page.pageSize) || pagination.pageSize;
    pagination.current = nextPageSize === pagination.pageSize ? Number(page.current) || 1 : 1;
    pagination.pageSize = nextPageSize;
  }

  function handleListPageChange(current: number, pageSize: number) {
    const nextPageSize = Number(pageSize) || pagination.pageSize;
    pagination.current = nextPageSize === pagination.pageSize ? Number(current) || 1 : 1;
    pagination.pageSize = nextPageSize;
  }

  function onHeaderCheck(event: any) {
    const checked = Boolean(event.target.checked);
    currentPageExecutableRows.value.forEach((row) => {
      row.checked = checked;
      if (checked && !(Number(row.execQty) > 0)) row.execQty = maxExecutableQty(row);
      clearRowErrors(row);
    });
  }

  function onRowCheck(row: any, event: any) {
    row.checked = Boolean(event.target.checked);
    if (row.checked && !(Number(row.execQty) > 0)) row.execQty = maxExecutableQty(row);
    clearRowErrors(row);
  }

  function selectAllFiltered() {
    filteredExecutableRows.value.forEach((row) => {
      row.checked = true;
      if (!(Number(row.execQty) > 0)) row.execQty = maxExecutableQty(row);
      clearRowErrors(row);
    });
  }

  function clearSelection() {
    rows.value.forEach((row) => {
      row.checked = false;
      clearRowErrors(row);
    });
  }

  function fillSelectedWithRemaining() {
    selectedRows.value.forEach((row) => {
      row.execQty = maxExecutableQty(row);
      clearRowErrors(row);
    });
  }

  function needsDispositionRemark(row: any) {
    return ['SCRAP', 'LOST'].includes(String(row.dispositionType));
  }

  function onDispositionChange(row: any) {
    if (!needsDispositionRemark(row)) row.dispositionRemark = '';
    clearRowErrors(row);
  }

  function clearRowErrors(row: any) {
    row.qtyError = '';
    row.dispositionError = '';
  }

  function rowClassName(row: any) {
    if (row.qtyError || row.dispositionError) return 'stock-exec__row--error';
    if (row.remain <= 0) return 'stock-exec__row--done';
    if (row.checked) return 'stock-exec__row--selected';
    return '';
  }

  function validateSelected(selected: any[]) {
    rows.value.forEach(clearRowErrors);
    let firstInvalid: any;
    selected.forEach((row) => {
      const quantity = Number(row.execQty);
      if (!Number.isFinite(quantity) || quantity <= 0) row.qtyError = '请输入大于 0 的数量';
      else if (quantity > row.remain) row.qtyError = `不能超过剩余 ${formatQuantity(row.remain)}`;
      else if (ioType.value === 'OUT' && row.currentUnitStockQty !== undefined && quantity > row.currentUnitStockQty) {
        row.qtyError = `不能超过实时库存 ${formatQuantity(row.currentUnitStockQty)}`;
      }
      if (isReturn.value) {
        if (!row.dispositionType) row.dispositionError = '请选择还料处置方式';
        else if (needsDispositionRemark(row) && !String(row.dispositionRemark || '').trim()) {
          row.dispositionError = '报废或遗失必须填写原因';
        }
      }
      if (!firstInvalid && (row.qtyError || row.dispositionError)) firstInvalid = row;
    });
    return firstInvalid;
  }

  async function revealInvalidRow(row: any) {
    keyword.value = '';
    selectedOnly.value = false;
    statusFilter.value = 'EXECUTABLE';
    await nextTick();
    const index = filteredRows.value.findIndex((item) => item.itemId === row.itemId);
    pagination.current = Math.max(1, Math.floor(Math.max(index, 0) / pagination.pageSize) + 1);
    await nextTick();
    const selector = row.qtyError
      ? `[data-exec-item="${row.itemId}"] input`
      : needsDispositionRemark(row)
        ? `[data-disposition-remark-item="${row.itemId}"]`
        : `[data-disposition-item="${row.itemId}"] .ant-select-selector`;
    const control = document.querySelector(selector) as HTMLElement | null;
    control?.focus();
  }

  async function handleOk() {
    if (!canExecute(apply.value)) return createMessage.warning('当前申请不可执行或您没有出入库权限');
    if (submitting.value) return;
    const selected = selectedRows.value;
    if (!selected.length) {
      createMessage.warning('请勾选要办理的物料明细');
      return;
    }
    const invalid = validateSelected(selected);
    if (invalid) {
      await revealInvalidRow(invalid);
      createMessage.warning(`请检查「${invalid.materialName || '未命名物料'}」的办理信息`);
      return;
    }
    if (selected.length >= 50) {
      createConfirm({
        iconType: 'warning',
        title: `确认批量${ioType.value === 'OUT' ? '出库' : '入库'}`,
        content: `本次将办理 ${selected.length} 种物料，请确认${isReturn.value ? '数量和处置方式' : '数量'}均已核对。`,
        okText: '确认执行',
        cancelText: '继续检查',
        onOk: () => executeSelected(selected),
      });
      return;
    }
    await executeSelected(selected);
  }

  async function executeSelected(selected: any[]) {
    if (submitting.value) return;
    submitting.value = true;
    try {
      await executeApply({
        applyId: apply.value.id,
        items: selected.map((row) => ({
          itemId: row.itemId,
          executeQty: Number(row.execQty),
          ...(String(row.remark || '').trim() ? { remark: String(row.remark).trim() } : {}),
          ...(isReturn.value
            ? {
                dispositionType: row.dispositionType,
                ...(needsDispositionRemark(row) ? { dispositionRemark: String(row.dispositionRemark).trim() } : {}),
              }
            : {}),
        })),
      });
      createMessage.success(`${ioType.value === 'OUT' ? '出库' : '入库'}完成，共 ${selected.length} 条`);
      closeModal();
      emit('success');
    } finally {
      submitting.value = false;
    }
  }

  watch([keyword, statusFilter, selectedOnly], resetPage);
  watch(
    () => filteredRows.value.length,
    (total) => {
      const lastPage = Math.max(1, Math.ceil(total / pagination.pageSize));
      if (pagination.current > lastPage) pagination.current = lastPage;
    }
  );
</script>

<style lang="less" scoped>
  .stock-exec {
    &__desc {
      margin-bottom: 12px;
    }

    &__summary-remark {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__status {
      display: flex;
      min-height: 38px;
      gap: 12px 24px;
      align-items: center;
      padding: 8px 12px;
      color: #434343;
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 4px;

      strong {
        color: #262626;
        font-variant-numeric: tabular-nums;
      }
    }

    &__status-selected,
    &__number {
      color: #0958d9;
    }

    &__toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin: 12px 0;
    }

    &__filters,
    &__batch-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    &__filters {
      min-width: 0;
      flex: 1;
    }

    &__batch-actions {
      flex: none;
    }

    &__search {
      width: 290px;
    }

    &__status-filter {
      width: 150px;
    }

    &__error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 40px;
      margin-bottom: 12px;
      padding: 6px 12px;
      color: #a8071a;
      background: #fff2f0;
      border: 1px solid #ffccc7;
      border-radius: 4px;
    }

    &__notice {
      margin-bottom: 12px;
    }

    &__outbound-list {
      overflow-x: auto;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      scrollbar-color: #bfbfbf transparent;
      scrollbar-width: thin;
    }

    &__outbound-grid {
      display: grid;
      min-width: 760px;
      grid-template-columns: 44px minmax(220px, 2fr) repeat(4, minmax(88px, 0.75fr));
      gap: 12px;
      align-items: center;
      padding: 0 12px;
    }

    &__outbound-header {
      min-height: 40px;
      color: #262626;
      background: #fafafa;
      border-bottom: 1px solid #d9d9d9;
      font-size: 13px;
      font-weight: 600;

      > div:nth-child(n + 3) {
        text-align: right;
      }
    }

    &__outbound-body {
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-color: #bfbfbf transparent;
      scrollbar-width: thin;
    }

    &__outbound-item {
      min-width: 760px;
      border-bottom: 1px solid #f0f0f0;

      &:last-child {
        border-bottom: 0;
      }

      &.stock-exec__row--selected {
        .stock-exec__outbound-summary {
          background: #f5f9ff;
        }

        .stock-exec__outbound-operation {
          background: #edf5ff;
        }
      }

      &.stock-exec__row--done {
        color: #8c8c8c;

        .stock-exec__outbound-operation {
          background: #fafafa;
        }
      }

      &.stock-exec__row--error {
        .stock-exec__outbound-summary,
        .stock-exec__outbound-operation {
          background: #fff2f0;
        }
      }
    }

    &__outbound-summary {
      min-height: 62px;
      padding-top: 8px;
      padding-bottom: 8px;
      background: #fff;
    }

    &__outbound-stat {
      display: flex;
      gap: 3px;
      align-items: baseline;
      justify-content: flex-end;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;

      strong {
        color: #262626;
        font-weight: 600;
      }

      small {
        color: #595959;
      }

      &--pending strong {
        color: #0958d9;
      }
    }

    &__mobile-label {
      display: none;
    }

    &__outbound-operation {
      display: grid;
      min-height: 50px;
      grid-template-columns: 100px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding: 8px 12px 8px 68px;
      background: #fafafa;
      border-top: 1px dashed #e8e8e8;
    }

    &__outbound-operation-title {
      color: #262626;
      font-size: 13px;
      font-weight: 600;
      line-height: 32px;
    }

    &__outbound-operation-content {
      display: grid;
      grid-template-columns: minmax(280px, 340px) minmax(240px, 1fr);
      gap: 12px;
      align-items: start;
    }

    &__outbound-quantity {
      display: grid;
      grid-template-columns: 72px minmax(140px, 1fr) 36px;
      gap: 8px;
      align-items: start;

      > span:first-child,
      .stock-exec__outbound-unit {
        color: #595959;
        line-height: 32px;
      }
    }

    &__outbound-empty {
      min-width: 760px;
      padding: 40px 16px;
    }

    &__outbound-pagination {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }

    &__material-name {
      overflow: hidden;
      color: #262626;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__material-meta {
      display: flex;
      gap: 2px 10px;
      margin-top: 3px;
      overflow: hidden;
      color: #595959;
      font-size: 12px;
      line-height: 1.5;
      white-space: nowrap;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    &__quantity-overview {
      display: flex;
      color: #262626;
      flex-direction: column;
      font-variant-numeric: tabular-nums;
      line-height: 1.5;

      small {
        color: #595959;
      }
    }

    &__number {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    &__number--done {
      color: #8c8c8c;
      font-weight: 400;
    }

    &__number--empty {
      color: #cf1322;
    }

    &__field,
    &__disposition {
      display: grid;
      gap: 6px;
    }

    &__field-error {
      color: #cf1322;
      font-size: 12px;
      line-height: 1.3;
    }

    &__tip {
      margin-top: 10px;
      color: #595959;
      font-size: 12px;
      line-height: 1.5;
    }
  }

  :deep(.stock-exec__row--done td) {
    color: #8c8c8c;
    background: #fafafa !important;
  }

  :deep(.stock-exec__row--selected td) {
    background: #f5f9ff;
  }

  :deep(.stock-exec__row--error td) {
    background: #fff2f0;
  }

  @media (max-width: 900px) {
    .stock-exec {
      &__status,
      &__toolbar,
      &__filters,
      &__batch-actions {
        align-items: stretch;
        flex-wrap: wrap;
      }

      &__toolbar {
        flex-direction: column;
      }

      &__filters,
      &__batch-actions {
        width: 100%;
      }

      &__search {
        min-width: 240px;
        flex: 1;
      }
    }
  }
</style>
