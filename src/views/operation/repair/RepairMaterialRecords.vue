<template>
  <section>
    <a-radio-group v-model:value="view" button-style="solid" class="material-views" aria-label="物料记录分类">
      <a-radio-button value="account">数量总览</a-radio-button>
      <a-radio-button value="links">领还料记录</a-radio-button>
      <a-radio-button value="uses">使用记录</a-radio-button>
      <a-radio-button value="writeoffs">损坏 / 遗失核销</a-radio-button>
    </a-radio-group>
    <template v-if="view === 'account'">
      <div class="material-toolbar">
        <a-input-search v-model:value="keyword" placeholder="搜索物料名称、编码、品牌、型号" aria-label="搜索物料" allow-clear :disabled="loading" @search="load(1)" />
        <a-button :disabled="loading" @click="load(page)">刷新</a-button>
      </div>
      <p class="material-hint">按物料和单位汇总整张工单；已领用为实际出库数量。点击物料名称可查看数量明细。</p>
      <a-alert v-if="error" type="error" show-icon :message="error"><template #action><a-button @click="load(page)">重试</a-button></template></a-alert>
      <a-table :columns="accountColumns" :data-source="records" :row-key="materialKey" :loading="loading" :pagination="false" size="small" bordered :scroll="{ x: 1100 }" :locale="{ emptyText: error ? '加载失败，请重试' : '暂无符合条件的物料记录' }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'material'"><a-button type="link" class="material-name" @click="selected = record">{{ record.materialName || '未提供物料名称' }}</a-button><div class="material-meta">{{ [record.materialCode, record.model].filter(Boolean).join(' · ') }}</div></template>
          <template v-else-if="column.dataIndex === 'baseUnitName'">{{ record.baseUnitName || '—' }}</template>
          <template v-else><span :class="{ 'remaining-quantity': column.dataIndex === 'remainingReturnQty' && Number(record.remainingReturnQty) > 0 }">{{ quantity(record[column.dataIndex]) }}</span></template>
        </template>
      </a-table>
      <a-pagination :current="page" :total="total" :page-size="10" :show-size-changer="false" :disabled="loading" :show-total="n => `共 ${n} 项`" @change="load" />
      <p class="material-hint">剩余待处置包含申请还料但尚未执行的数量；已报废、已遗失和已核销不计作已归还。</p>
    </template>
    <template v-else>
      <p class="material-hint">{{ recordHints[view] }}</p>
      <a-table :columns="recordColumns" :data-source="historyRows" row-key="id" :pagination="{ pageSize: 10, showSizeChanger: false }" size="small" bordered :scroll="{ x: 1000 }" :locale="{ emptyText: '暂无可见记录' }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'material'"><strong>{{ materialInfo(record, links).name }}</strong><div class="material-meta">{{ materialInfo(record, links).model }}</div></template>
          <template v-else-if="column.key === 'unit'">{{ materialInfo(record, links).unit }}</template>
          <template v-else-if="column.dataIndex === 'outboundQty'">{{ record.linkType === 'PICK' ? quantity(record.outboundQty) : '—' }}</template>
          <template v-else-if="['usedQuantity', 'requestedQuantity', 'effectiveQuantity'].includes(column.dataIndex)">{{ quantity(record[column.dataIndex]) }}</template>
          <template v-else-if="column.key === 'state'">{{ materialStates[record[column.dataIndex]] || '未知状态' }}</template>
          <template v-else>{{ /Time$|At$/.test(column.dataIndex) ? display(record[column.dataIndex]).replace('T', ' ').slice(0, 19) : display(record[column.dataIndex]) }}</template>
        </template>
      </a-table>
    </template>
    <a-modal :open="!!selected" title="物料数量明细" :footer="null" width="720px" @cancel="selected = undefined">
      <template v-if="selected">
        <a-descriptions bordered :column="2" size="small">
          <a-descriptions-item label="物料名称" :span="2">{{ selected.materialName || '未提供物料名称' }}</a-descriptions-item>
          <a-descriptions-item label="编码">{{ display(selected.materialCode) }}</a-descriptions-item>
          <a-descriptions-item label="单位">{{ display(selected.baseUnitName) }}</a-descriptions-item>
          <a-descriptions-item label="品牌">{{ display(selected.brand) }}</a-descriptions-item>
          <a-descriptions-item label="型号">{{ display(selected.model) }}</a-descriptions-item>
          <a-descriptions-item v-for="[key, label] in quantityFields" :key="key" :label="label">{{ quantity(selected[key]) }}</a-descriptions-item>
        </a-descriptions>
        <p class="material-hint">当前可还已扣除待处理占用，与剩余待处置数量不同；整单汇总不代表本人可操作数量。</p>
      </template>
    </a-modal>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { display, repairMaterialPage, type Row } from './repair.api';
import { materialInfo, materialKey, materialStates, quantity } from './repairMaterialDisplay';
const props = defineProps<{ orderId: string; active: boolean; links: Row[]; uses: Row[]; writeoffs: Row[] }>();
const view = ref('account'), keyword = ref(''), page = ref(1), total = ref(0), records = ref<Row[]>([]), loading = ref(false), error = ref(''), selected = ref<Row>();
let generation = 0, loaded = false;
const quantityFields = [['pendingApplyQty','领料待审批'],['unOutboundQty','已批准待出库'],['outboundQty','已领用'],['confirmedUseQty','已确认使用'],['pendingUseQty','使用待确认'],['shouldReturnQty','应还总量'],['actualReturnQty','已归还'],['pendingReturnQty','还料待处理'],['scrapQty','已报废'],['lostQty','已遗失'],['writeoffQty','已核销'],['pendingWriteoffQty','核销待审批'],['remainingReturnQty','剩余待处置'],['availableReturnQty','当前可还']];
const materialColumn = { title:'物料名称 / 型号',key:'material',width:250,fixed:'left' as const };
const accountColumns = [materialColumn,{title:'单位',dataIndex:'baseUnitName',width:70}, ...[['outboundQty','已领用'],['confirmedUseQty','已确认使用'],['actualReturnQty','已归还'],['pendingReturnQty','还料待处理'],['writeoffQty','已核销'],['remainingReturnQty','剩余待处置']].map(([dataIndex,title])=>({dataIndex,title,width:120,align:'right' as const}))];
const recordHints: Record<string,string> = { links:'领还料记录用于查看物料来源；申请关联不代表已经完成出入库。', uses:'仅已确认的使用记录计入已确认使用数量，草稿和已作废记录不计入。', writeoffs:'损坏或遗失通过核销处理，只有实际生效数量计入已核销。' };
const historyRows = computed(()=>view.value==='links'?props.links:view.value==='uses'?props.uses:props.writeoffs);
const recordColumns = computed(()=>[materialColumn,{title:'单位',key:'unit',width:70},...(view.value==='links'?[
  {title:'业务类型',dataIndex:'linkType',key:'state'}, {title:'实际领出数量',dataIndex:'outboundQty'}, {title:'创建时间',dataIndex:'createTime'},
]:view.value==='uses'?[
  {title:'使用数量',dataIndex:'usedQuantity'}, {title:'状态',dataIndex:'useStatus',key:'state'}, {title:'使用说明',dataIndex:'useDescription'}, {title:'登记时间',dataIndex:'createTime'}, {title:'确认时间',dataIndex:'confirmedAt'},
]:[
  {title:'核销类型',dataIndex:'writeoffType',key:'state'}, {title:'申请数量',dataIndex:'requestedQuantity'}, {title:'生效数量',dataIndex:'effectiveQuantity'}, {title:'原因',dataIndex:'reason'}, {title:'生效时间',dataIndex:'effectiveAt'},
]).map(col=>({...col,width:col.dataIndex.endsWith('Time')||col.dataIndex.endsWith('At')?180:140}))]);
async function load(next = 1) {
  const token = ++generation, id = props.orderId;
  if (!id) return;
  loading.value = true; error.value = ''; records.value = []; total.value = 0; page.value = next;
  try { const result = await repairMaterialPage(id, next, keyword.value.trim()); if(token===generation && id===props.orderId) { records.value=result.records; total.value=result.total; loaded=true; } }
  catch(e) { if(token===generation) error.value = /502|Network Error|timeout/i.test((e as Error).message) ? '物料数量服务暂时无法连接，请稍后重试' : `物料数量加载失败：${(e as Error).message}`; }
  finally { if(token===generation) loading.value=false; }
}
watch(()=>props.orderId,()=>{ ++generation; loaded=false; records.value=[]; total.value=0; page.value=1; keyword.value=''; error.value=''; loading.value=false; selected.value=undefined; view.value='account'; });
watch(()=>[props.active,props.orderId],()=>{ if(props.active && props.orderId && !loaded && !loading.value) void load(); },{immediate:true});
onBeforeUnmount(()=>{ ++generation; });
</script>
<style scoped>
.material-views { margin-bottom: 20px; }
.material-toolbar { display: flex; gap: 12px; align-items: center; }
.material-toolbar .ant-input-search { max-width: 380px; }
.material-hint, .material-meta { color: var(--text-color-secondary, #595959); line-height: 1.6; }
.material-hint { margin: 12px 0; }
.material-meta { font-size: 12px; overflow-wrap: anywhere; }
.material-name { padding: 0; height: auto; white-space: normal; text-align: left; }
.remaining-quantity { color: var(--error-color, #cf1322); font-weight: 600; }
:deep(.ant-pagination) { margin-top: 16px; text-align: right; }
:deep(.ant-table-cell) { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
</style>
