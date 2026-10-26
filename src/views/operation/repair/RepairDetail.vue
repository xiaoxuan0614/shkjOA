<template>
  <a-drawer :open="!!id" title="工单记录详情" width="min(1180px, 96vw)" :destroy-on-close="true" @close="$emit('close')">
    <a-spin :spinning="busy">
      <a-result v-if="error" status="error" title="详情加载失败" :sub-title="error"><template #extra><a-button @click="load">重新加载</a-button></template></a-result>
      <template v-else-if="data">
        <a-descriptions bordered :column="2" size="small">
          <a-descriptions-item label="工单编号">{{ display(order.orderNo) }}</a-descriptions-item>
          <a-descriptions-item label="报价状态"><DictValue code="repair_quotation_status" :value="order.quotationStatus" /></a-descriptions-item>
          <a-descriptions-item label="状态">{{ workStates[order.workStatus] || display(order.workStatus) }}</a-descriptions-item>
          <a-descriptions-item label="项目 / 分期">{{ projectName(order) }}</a-descriptions-item>
          <a-descriptions-item label="当前负责人">{{ display(order.responsibleUserName) }}</a-descriptions-item>
          <a-descriptions-item label="有效维修时长">{{ hours(order.effectiveDurationSeconds) }}</a-descriptions-item>
          <a-descriptions-item label="人员累计工时">{{ hours(order.personWorkSeconds) }}</a-descriptions-item>
        </a-descriptions>
        <a-tabs v-model:active-key="tab" class="repair-tabs">
          <a-tab-pane key="report" tab="报修信息">
            <a-descriptions bordered :column="2" size="small">
              <a-descriptions-item v-for="field in reportFields" :key="field[0]" :label="field[1]">{{ display(order[field[0]]) }}</a-descriptions-item>
              <a-descriptions-item label="产品" :span="2">{{ rows('products').map(p => p.productNameSnapshot).filter(Boolean).join('、') || order.productNames || '—' }}</a-descriptions-item>
            </a-descriptions>
            <h3>报修附件</h3><FileLinks :files="rows('reportAttachments')" />
          </a-tab-pane>
          <a-tab-pane v-for="group in groups" :key="group.key" :tab="group.title">
            <section v-for="table in group.tables" :key="table.key" class="repair-section">
              <h3>{{ table.title }}</h3>
              <a-table :data-source="rows(table.key)" :columns="table.fields.map(([dataIndex, title]) => ({ dataIndex, title, width: 160 }))" row-key="id" size="small" :pagination="{ pageSize: 10, showSizeChanger: false }" :scroll="{ x: Math.max(640, table.fields.length * 160) }">
                <template #bodyCell="{ column, record }"><DictValue v-if="table.key === 'quotations' && column.dataIndex === 'stage'" code="repair_quotation_status" :value="record.stage" /><template v-else>{{ fieldText(column.dataIndex, record[column.dataIndex]) }}</template></template>
              </a-table>
            </section>
          </a-tab-pane>
          <a-tab-pane key="files" tab="业务附件"><FileLinks :files="rows('attachments')" /></a-tab-pane>
          <a-tab-pane key="history" tab="操作时间线">
            <a-alert v-if="logError" type="error" :message="logError"><template #action><a-button @click="loadLogs(logPage)">重试</a-button></template></a-alert>
            <a-table :loading="logBusy" :data-source="logs" :columns="logColumns" row-key="id" :pagination="false" size="small" :scroll="{ x: 800 }">
              <template #bodyCell="{ column, record }"><FileLinks v-if="column.key === 'files'" :files="record.attachments || []" /><template v-else>{{ display(record[column.dataIndex]) }}</template></template>
            </a-table>
            <a-pagination :current="logPage" :total="logTotal" :page-size="20" :show-size-changer="false" :disabled="logBusy" @change="loadLogs" />
          </a-tab-pane>
        </a-tabs>
      </template>
    </a-spin>
  </a-drawer>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { display, hours, projectName, repairDetail, repairLogs, workStates, type Row } from './repair.api';
import DictValue from '/@/components/DictValue.vue';
import FileLinks from './RepairFiles.vue';
const props = defineProps<{ id: string }>();
defineEmits(['close']);
const data = ref<Row | null>(null), busy = ref(false), error = ref(''), tab = ref('report');
const logs = ref<Row[]>([]), logBusy = ref(false), logError = ref(''), logPage = ref(1), logTotal = ref(0);
let generation = 0, logGeneration = 0;
const order = computed(() => data.value?.order || {});
const rows = (key: string): Row[] => Array.isArray(data.value?.[key]) ? data.value![key] : [];
const reportFields = [['customerNameSnapshot','客户'],['reporterNameDisplay','报修人'],['reportTimeDisplay','报修时间'],['serviceAddress','服务地址'],['contactPerson','联系人'],['contactPhone','联系电话'],['faultDescription','故障现象'],['reportRemark','备注']];
const groups = [
  { key: 'work', title: '维修作业', tables: [ { key: 'workRecords', title: '每次维修记录', fields: [['recordNo','记录编号'],['operatorNameSnapshot','作业人员'],['repairMethod','维修方式'],['recordStatus','作业状态'],['effectiveStartedAt','有效开始时间'],['effectiveEndedAt','有效结束时间'],['durationSeconds','工时'],['faultDescription','故障现象'],['repairDescription','维修内容'],['vehiclePlateSnapshot','使用车辆']] } ] },
  { key: 'people', title: '人员与派单', tables: [
    { key: 'workPersons', title: '作业参与人员', fields: [['workRecordId','关联作业ID'],['personNameSnapshot','人员'],['personType','人员类型']] },
    { key: 'members', title: '协助成员', fields: [['userNameSnapshot','姓名'],['roleNameSnapshot','角色'],['personType','人员类型'],['memberStatus','状态'],['effectiveFrom','生效时间'],['effectiveTo','结束时间'],['exitReason','退出原因']] },
    { key: 'assignments', title: '派单与转单记录', fields: [['fromNameSnapshot','原负责人'],['toNameSnapshot','接单人'],['assignedAt','分配时间'],['effectiveFrom','生效时间'],['reason','原因']] },
  ] },
  { key: 'materials', title: '物料记录', tables: [
    { key: 'materialLinks', title: '物料申请关联', fields: [['stockApplyId','库存申请ID'],['materialId','物料ID'],['linkType','关联类型']] },
    { key: 'materialUses', title: '物料使用', fields: [['workRecordId','关联作业ID'],['materialId','物料ID'],['usedQuantity','使用数量'],['useDescription','使用说明'],['useStatus','状态'],['confirmedAt','确认时间']] },
    { key: 'materialWriteoffItems', title: '物料核销', fields: [['materialId','物料ID'],['writeoffType','核销类型'],['requestedQuantity','申请数量'],['effectiveQuantity','生效数量'],['reason','原因'],['effectiveAt','生效时间']] },
  ] },
  { key: 'price', title: '报价与完工', tables: [
    { key: 'quotations', title: '报价记录', fields: [['revisionNo','版本'],['quotationMode','报价方式'],['noQuoteReason','无需报价原因'],['totalAmount','报价金额'],['stage','阶段'],['customerConfirmedAmount','客户确认金额'],['customerConfirmedAt','客户确认时间']] },
    { key: 'quotationItems', title: '报价明细', fields: [['itemName','项目'],['quantity','数量'],['unitPrice','单价'],['lineAmount','金额']] },
    { key: 'completions', title: '完工记录', fields: [['completionDescription','完工说明'],['submittedAt','提交时间'],['approvalStatus','审批状态'],['finalAmount','最终金额'],['amountChangeReason','金额变化原因'],['returnReason','退回原因']] },
    { key: 'evaluations', title: '回访评价', fields: [['evaluationStatus','状态'],['serviceAttitudeScore','服务态度'],['repairQualityScore','维修质量'],['responseEfficiencyScore','响应效率'],['opinion','评价意见'],['recordedAt','记录时间']] },
  ] },
  { key: 'approval', title: '申请与审批', tables: [
    { key: 'applications', title: '业务申请', fields: [['applicationNo','申请编号'],['applicationType','申请类型'],['reason','申请原因'],['applicationStatus','状态'],['submittedAt','提交时间'],['decidedAt','决定时间'],['effectiveAt','生效时间']] },
    { key: 'workflows', title: '关联审批', fields: [['title','审批标题'],['processName','流程'],['initiatorName','发起人'],['status','状态'],['roundNo','轮次']] },
  ] },
];
const labels: Record<string,string> = { ONLINE:'线上', OFFLINE:'线下', INTERNAL:'内部人员', EXTERNAL:'外协', ACTIVE:'进行中', ENDED:'已结束', EXITED:'已退出', RUNNING:'审批中', APPROVED:'已通过', REJECTED:'已驳回', RETURNED:'已退回', WITHDRAWN:'已撤回', TERMINATED:'已终止', COMPLETED:'已完成', TRANSFER:'转单', CLOSE:'关闭', COMPLETION:'完工', COLLABORATION:'协助', QUOTATION:'报价', REQUIRED:'需要报价', NOT_REQUIRED:'无需报价', DRAFT:'草稿', SUBMITTED:'已提交', CONFIRMED:'已确认', VOIDED:'已作废' };
function fieldText(key: string, value: unknown) { if(key === 'durationSeconds') return hours(value); return /Status$|^status$|^stage$|Type$|Mode$|Method$/.test(key) ? labels[String(value)] || display(value) : display(value); }
const logColumns = [{ title:'时间',dataIndex:'occurredAt',width:190 },{title:'操作',dataIndex:'eventName',width:180},{title:'操作人',dataIndex:'operatorName',width:120},{title:'内容 / 审批意见',dataIndex:'content'},{title:'附件',key:'files',width:180}];
async function load() {
  const token = ++generation; ++logGeneration;
  data.value = null; error.value = ''; logs.value = []; logTotal.value = 0; logPage.value = 1; logError.value = ''; logBusy.value = false;
  if (!props.id) { busy.value = false; return; }
  busy.value = true;
  try { const result = await repairDetail(props.id); if(token === generation) { result.order.reporterNameDisplay ??= result.order.reporterName; result.order.reportTimeDisplay ??= result.order.reportTime; data.value = result; } }
  catch(e) { if(token === generation) error.value = (e as Error).message; }
  finally { if(token === generation) busy.value = false; }
}
async function loadLogs(page = 1) {
  const token = ++logGeneration; const id = props.id;
  if(!id) return;
  logBusy.value = true; logError.value = ''; logPage.value = page; logs.value = [];
  try { const result = await repairLogs(id,page); if(token === logGeneration && id === props.id) { logs.value = result.records; logTotal.value = result.total; } }
  catch(e) { if(token === logGeneration) logError.value = (e as Error).message; }
  finally { if(token === logGeneration) logBusy.value = false; }
}
watch(() => props.id, () => { tab.value = 'report'; void load(); }, { immediate:true });
watch(tab, value => { if(value === 'history') void loadLogs(1); });
onBeforeUnmount(() => { ++generation; ++logGeneration; });
</script>
<style scoped>
.repair-tabs { margin-top: 20px; }
.repair-section { margin-bottom: 28px; }
h3 { margin: 20px 0 12px; font-size: 15px; font-weight: 600; }
:deep(.ant-descriptions-item-content), :deep(.ant-table-cell) { white-space: pre-wrap; overflow-wrap: anywhere; }
:deep(.ant-pagination) { margin-top: 16px; }
</style>
