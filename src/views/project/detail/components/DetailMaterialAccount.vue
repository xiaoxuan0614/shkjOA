<template>
  <div class="material-account">
    <div class="material-account__toolbar">
      <div class="material-account__heading">
        <div class="material-account__title">项目物料总账</div>
        <div class="material-account__subtitle">计划、申请、出库、施工消耗和归还处置数量均按物料基准单位统计，展开行可查看完整口径</div>
      </div>
      <div class="material-account__actions">
        <a-input-search
          v-model:value="keywordInput"
          allow-clear
          placeholder="搜索物料编码、名称、品牌或型号"
          class="material-account__search"
          @search="handleSearch"
        />
        <a-button :disabled="!keyword" @click="handleReset">重置</a-button>
        <a-popover title="统计口径" placement="bottomRight">
          <template #content>
            <div class="material-account__definitions">
              <p><strong>当前可申请：</strong>计划量扣除实际出库、已审批未出库和待审批申请后的剩余量。</p>
              <p><strong>计划剩余：</strong>计划量扣除实际出库量，不代表本次还可申请的数量。</p>
              <p><strong>待处置：</strong>应还量扣除合格回库、报废和遗失后的剩余量。</p>
            </div>
          </template>
          <a-button>口径说明</a-button>
        </a-popover>
      </div>
    </div>

    <div v-if="loadError" class="material-account__error" role="alert">
      <span>{{ loadError }}</span>
      <a-button type="link" size="small" @click="load">重新加载</a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="materials"
      :loading="loading"
      :pagination="pagination"
      :row-key="(record) => record.materialId"
      :scroll="{ x: 1080 }"
      size="middle"
      bordered
      @change="handleTableChange"
    >
      <template #emptyText>
        <a-empty :description="keyword ? '没有匹配的项目物料' : '暂无项目用料统计'" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'material'">
          <div class="material-account__material">
            <div class="material-account__material-name">{{ record.materialName || '未命名物料' }}</div>
            <div class="material-account__material-meta">
              <span>{{ record.materialCode || '暂无编码' }}</span>
              <span>{{ record.baseUnitName ? `单位：${record.baseUnitName}` : '单位未配置' }}</span>
            </div>
          </div>
        </template>
        <template v-else-if="column.key === 'spec'">
          <div class="material-account__spec">
            <span>{{ record.materialCategory || '—' }}</span>
            <span>{{ [formatBrand(record.brand), record.model].filter(Boolean).join(' · ') || '—' }}</span>
          </div>
        </template>
        <template v-else-if="quantityKeys.has(String(column.key))">
          <span
            class="material-account__number"
            :class="{
              'material-account__number--pending': column.key === 'remainingReturnQty' && Number(record.remainingReturnQty) > 0,
            }"
          >
            {{ formatQuantity(record[column.dataIndex]) }}
          </span>
        </template>
        <template v-else-if="column.key === 'actualCost'">
          <span class="material-account__cost">{{ formatCurrency(record.actualCost) }}</span>
        </template>
      </template>

      <template #expandedRowRender="{ record }">
        <div class="material-account__expanded">
          <section v-for="group in expandedGroups(record)" :key="group.title">
            <h4>{{ group.title }}</h4>
            <dl>
              <div v-for="item in group.items" :key="item.label">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </section>
        </div>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { reactive, ref, watch } from 'vue';
  import { getMaterialAccounts } from '../ProjectDetail.api';
  import { loadDictMap } from '/@/views/material/material.util';

  const props = defineProps<{
    projectId: string;
  }>();

  const materials = ref<Recordable[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  const keywordInput = ref('');
  const keyword = ref('');
  const brandMap = ref<Record<string, { text: string; color: string }>>({});
  let loadSequence = 0;

  const quantityKeys = new Set(['plannedQty', 'outboundQty', 'consumedQty', 'remainingReturnQty']);
  const columns = [
    { title: '物料', key: 'material', width: 250, fixed: 'left' },
    { title: '类别 / 品牌型号', key: 'spec', width: 190 },
    { title: '计划数量', dataIndex: 'plannedQty', key: 'plannedQty', width: 105, align: 'right' },
    { title: '实际出库', dataIndex: 'outboundQty', key: 'outboundQty', width: 105, align: 'right' },
    { title: '施工消耗', dataIndex: 'consumedQty', key: 'consumedQty', width: 105, align: 'right' },
    { title: '待处置', dataIndex: 'remainingReturnQty', key: 'remainingReturnQty', width: 105, align: 'right' },
    { title: '实际成本', dataIndex: 'actualCost', key: 'actualCost', width: 130, align: 'right', fixed: 'right' },
  ];

  const pagination = reactive({
    current: 1,
    pageSize: 20,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['20', '50', '100'],
    showTotal: (total: number) => `共 ${total} 种物料`,
  });

  loadDictMap('material_brand').then((map) => (brandMap.value = map));

  function formatBrand(value: unknown) {
    const raw = String(value ?? '');
    return brandMap.value[raw]?.text || raw;
  }

  function formatQuantity(value: unknown) {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : String(value);
  }

  function formatWithUnit(value: unknown, unit: unknown) {
    const quantity = formatQuantity(value);
    return quantity === '—' ? quantity : `${quantity}${String(unit || '')}`;
  }

  function formatCurrency(value: unknown) {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    return Number.isFinite(number) ? `￥${number.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(value);
  }

  function expandedGroups(record: Recordable) {
    const quantity = (value: unknown) => formatWithUnit(value, record.baseUnitName);
    return [
      {
        title: '申请占用',
        items: [
          { label: '待审批申请', value: quantity(record.pendingApplyQty) },
          { label: '已审批申请', value: quantity(record.validApplyQty) },
          { label: '已审批未出库', value: quantity(record.unOutboundQty) },
          { label: '当前可申请', value: quantity(record.availableApplyQty) },
          { label: '计划剩余', value: quantity(record.planRemainingQty) },
        ],
      },
      {
        title: '归还处置',
        items: [
          { label: '系统应还', value: quantity(record.shouldReturnQty) },
          { label: '合格回库', value: quantity(record.actualReturnQty) },
          { label: '报废', value: quantity(record.scrapQty) },
          { label: '遗失', value: quantity(record.lostQty) },
          { label: '待处置', value: quantity(record.remainingReturnQty) },
        ],
      },
      {
        title: '金额与库存',
        items: [
          { label: '仓库当前库存', value: quantity(record.stockQty) },
          { label: '实际出库金额', value: formatCurrency(record.outboundAmount) },
          { label: '合格回库冲减', value: formatCurrency(record.returnAmount) },
          { label: '项目实际成本', value: formatCurrency(record.actualCost) },
        ],
      },
    ];
  }

  async function load() {
    const requestSequence = ++loadSequence;
    if (!props.projectId) {
      materials.value = [];
      pagination.total = 0;
      loading.value = false;
      loadError.value = '';
      return;
    }
    loading.value = true;
    loadError.value = '';
    try {
      const result: any = await getMaterialAccounts({
        periodId: props.projectId,
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
        ...(keyword.value ? { keyword: keyword.value } : {}),
      });
      if (requestSequence !== loadSequence) return;
      const records = Array.isArray(result) ? result : result?.records || [];
      materials.value = records;
      pagination.current = Number(result?.current) || pagination.current;
      pagination.pageSize = Number(result?.size) || pagination.pageSize;
      pagination.total = Array.isArray(result) ? records.length : Number(result?.total) || 0;
    } catch (error: any) {
      if (requestSequence !== loadSequence) return;
      materials.value = [];
      pagination.total = 0;
      loadError.value = error?.message || '项目用料统计加载失败，请稍后重试';
    } finally {
      if (requestSequence === loadSequence) loading.value = false;
    }
  }

  function handleSearch(value: string) {
    keyword.value = String(value || '').trim();
    keywordInput.value = keyword.value;
    pagination.current = 1;
    void load();
  }

  function handleReset() {
    keywordInput.value = '';
    keyword.value = '';
    pagination.current = 1;
    void load();
  }

  function handleTableChange(page: { current?: number; pageSize?: number }) {
    const nextPageSize = Number(page.pageSize) || pagination.pageSize;
    pagination.current = nextPageSize === pagination.pageSize ? Number(page.current) || 1 : 1;
    pagination.pageSize = nextPageSize;
    void load();
  }

  watch(
    () => props.projectId,
    () => {
      keywordInput.value = '';
      keyword.value = '';
      pagination.current = 1;
      void load();
    },
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .material-account {
    &__toolbar {
      display: flex;
      gap: 16px;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    &__heading {
      min-width: 0;
    }

    &__title {
      color: #262626;
      font-size: 16px;
      font-weight: 600;
    }

    &__subtitle {
      margin-top: 4px;
      color: #595959;
      font-size: 13px;
      line-height: 1.5;
    }

    &__actions {
      display: flex;
      flex: none;
      gap: 8px;
      align-items: center;
    }

    &__search {
      width: 300px;
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

    &__material-name {
      overflow: hidden;
      color: #262626;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__material-meta,
    &__spec {
      display: flex;
      gap: 4px 12px;
      color: #595959;
      font-size: 12px;
      line-height: 1.6;
    }

    &__material-meta {
      margin-top: 2px;
      flex-wrap: wrap;
    }

    &__spec {
      flex-direction: column;
    }

    &__number,
    &__cost,
    dd {
      font-variant-numeric: tabular-nums;
    }

    &__number--pending {
      color: #d46b08;
      font-weight: 600;
    }

    &__cost {
      color: #262626;
      font-weight: 600;
    }

    &__expanded {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      padding: 8px 18px 12px;
      background: #fafafa;

      section {
        min-width: 0;
      }

      h4 {
        margin: 0 0 8px;
        color: #262626;
        font-size: 13px;
        font-weight: 600;
      }

      dl {
        display: grid;
        gap: 6px;
        margin: 0;
      }

      dl > div {
        display: flex;
        gap: 12px;
        align-items: baseline;
        justify-content: space-between;
      }

      dt {
        color: #595959;
      }

      dd {
        margin: 0;
        color: #262626;
        font-weight: 500;
        text-align: right;
      }
    }

    &__definitions {
      max-width: 360px;

      p {
        margin: 0 0 8px;
        color: #434343;
        line-height: 1.6;
      }

      p:last-child {
        margin-bottom: 0;
      }
    }
  }

  @media (max-width: 1200px) {
    .material-account {
      &__toolbar {
        align-items: stretch;
        flex-direction: column;
      }

      &__actions {
        flex-wrap: wrap;
      }

      &__search {
        width: min(100%, 360px);
      }

      &__expanded {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
