<template>
  <section class="price-section">
    <h3>报价记录</h3>
    <p class="section-hint">每行对应一次报价版本，展开可查看该版本的报价明细。</p>
    <a-table :columns="quoteColumns" :data-source="quotations" row-key="id" size="small" bordered :pagination="{ pageSize: 5, showSizeChanger: false }" :scroll="{ x: 1000 }" expand-column-title="明细" :locale="{ emptyText: '暂无可见报价记录' }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'revisionNo'">{{ record.revisionNo != null ? `第${record.revisionNo}版` : '未提供版本' }}</template>
        <template v-else-if="column.dataIndex === 'quotationMode'">{{ modes[record.quotationMode] || '未提供报价方式' }}</template>
        <DictValue v-else-if="column.dataIndex === 'stage'" code="repair_quotation_status" :value="record.stage" :fallback="quotationStages[record.stage] || '未提供报价状态'" />
        <template v-else-if="column.dataIndex.endsWith('Amount')">{{ money(record[column.dataIndex]) }}</template>
        <template v-else>{{ dateText(record[column.dataIndex]) }}</template>
      </template>
      <template #expandedRowRender="{ record }">
        <div class="record-details">
          <p v-if="record.noQuoteReason"><strong>无需报价原因：</strong>{{ record.noQuoteReason }}</p>
          <a-table v-if="record.quotationMode !== 'NOT_REQUIRED'" :columns="itemColumns" :data-source="quoteItems(record, items)" row-key="id" size="small" :pagination="false" :scroll="{ x: 680 }" :locale="{ emptyText: '本版本暂无可见报价明细' }">
            <template #bodyCell="{ column, record: item }"><template v-if="['unitPrice','lineAmount'].includes(column.dataIndex)">{{ money(item[column.dataIndex]) }}</template><template v-else>{{ display(item[column.dataIndex]) }}</template></template>
          </a-table>
          <p v-if="record.customerConfirmationRemark"><strong>客户沟通备注：</strong>{{ record.customerConfirmationRemark }}</p>
          <p v-if="record.customerConfirmedAt"><strong>客户确认登记时间：</strong>{{ dateText(record.customerConfirmedAt) }}</p>
          <p v-if="record.invalidationReason"><strong>失效原因：</strong>{{ record.invalidationReason }}</p>
        </div>
      </template>
    </a-table>
  </section>
  <section class="price-section">
    <h3>完工提交记录</h3>
    <p class="section-hint">每次完工提交分别保留，展开查看完工说明、金额调整和退回信息。</p>
    <a-table :columns="completionColumns" :data-source="completions" row-key="id" size="small" bordered :pagination="{ pageSize: 5, showSizeChanger: false }" :scroll="{ x: 1000 }" expand-column-title="详情" :locale="{ emptyText: '暂无可见完工提交记录' }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'submissionNo'">{{ record.submissionNo != null ? `第${record.submissionNo}次` : '—' }}</template>
        <template v-else-if="column.key === 'status'">{{ completionState(record, applications) }}</template>
        <template v-else-if="column.key === 'quote'">{{ quoteVersion(record, quotations) }}</template>
        <template v-else-if="column.dataIndex?.endsWith('Amount')">{{ money(record[column.dataIndex]) }}</template>
        <template v-else>{{ dateText(record[column.dataIndex]) }}</template>
      </template>
      <template #expandedRowRender="{ record }">
        <a-descriptions bordered size="small" :column="2" class="record-details">
          <a-descriptions-item label="完工说明" :span="2">{{ display(record.completionDescription) }}</a-descriptions-item>
          <a-descriptions-item label="送审报价金额（元）">{{ money(record.approvalAmount) }}</a-descriptions-item>
          <a-descriptions-item label="客户确认金额（元）">{{ money(record.customerConfirmedAmount) }}</a-descriptions-item>
          <a-descriptions-item label="本次最终金额（元）">{{ money(record.finalAmount) }}</a-descriptions-item>
          <a-descriptions-item label="审核时间">{{ dateText(record.reviewedAt) }}</a-descriptions-item>
          <a-descriptions-item v-if="record.amountChangeReason" label="金额调整原因" :span="2">{{ record.amountChangeReason }}</a-descriptions-item>
          <a-descriptions-item v-if="record.returnType" label="退回处理">{{ returnTypes[record.returnType] || '未提供处理方式' }}</a-descriptions-item>
          <a-descriptions-item v-if="record.returnedAt" label="退回时间">{{ dateText(record.returnedAt) }}</a-descriptions-item>
          <a-descriptions-item v-if="record.returnReason" label="退回原因" :span="2">{{ record.returnReason }}</a-descriptions-item>
        </a-descriptions>
      </template>
    </a-table>
  </section>
</template>
<script setup lang="ts">
import DictValue from '/@/components/DictValue.vue';
import { display, type Row } from './repair.api';
import { completionState, quoteItems, quoteVersion, quotationStages, money, dateText } from './repairPriceDisplay';
defineProps<{ quotations: Row[]; items: Row[]; completions: Row[]; applications: Row[] }>();
const modes: Record<string,string> = { REQUIRED:'需要报价', NOT_REQUIRED:'无需报价' };
const returnTypes: Record<string,string> = { MATERIAL_SUPPLEMENT:'补充资料后重提', REWORK:'完成复修后重提' };
const quoteColumns = [
  {title:'报价版本',dataIndex:'revisionNo',width:100},{title:'报价方式',dataIndex:'quotationMode',width:110},{title:'报价状态',dataIndex:'stage',width:170},
  {title:'送审报价（元）',dataIndex:'totalAmount',width:150,align:'right' as const},{title:'客户确认金额（元）',dataIndex:'customerConfirmedAmount',width:170,align:'right' as const},{title:'提交时间',dataIndex:'submittedAt',width:180},
];
const itemColumns = [{title:'序号',dataIndex:'itemNo',width:70},{title:'报价项目',dataIndex:'itemName',width:260},{title:'数量',dataIndex:'quantity',width:100},{title:'单价（元）',dataIndex:'unitPrice',width:120,align:'right' as const},{title:'金额（元）',dataIndex:'lineAmount',width:120,align:'right' as const}];
const completionColumns = [{title:'提交次数',dataIndex:'submissionNo',width:100},{title:'审批状态',key:'status',width:120},{title:'采用报价',key:'quote',width:120},{title:'本次最终金额（元）',dataIndex:'finalAmount',width:180,align:'right' as const},{title:'提交时间',dataIndex:'submittedAt',width:180},{title:'审核时间',dataIndex:'reviewedAt',width:180}];
</script>
<style scoped>
.price-section + .price-section { margin-top: 32px; }
h3 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
.section-hint { margin: 0 0 16px; color: var(--text-color-secondary, #595959); }
.record-details { padding: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.record-details p { margin: 12px 0; }
:deep(.ant-table-cell) { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
</style>
