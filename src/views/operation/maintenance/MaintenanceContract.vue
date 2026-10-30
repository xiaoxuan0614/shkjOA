<template>
  <section class="contract-editor">
    <header class="editor-heading"><h2>{{ renewFrom ? '续签维保合同' : contractId ? '维保合同详情' : '新增维保合同' }}</h2><a-button :disabled="busy || uploading" @click="close">返回合同列表</a-button></header>
    <a-spin :spinning="loading">
      <a-alert v-if="error" type="error" show-icon :message="error" />
      <a-button v-if="loadFailed" @click="load">重新加载</a-button>
      <template v-if="draft && !loadFailed">
        <h3>项目基本信息</h3>
        <a-form layout="vertical"><div class="form-grid">
          <a-form-item label="售后项目"><a-input :value="archive.archiveName" disabled /></a-form-item>
          <a-form-item label="甲方名称"><a-input :value="draft.customerSnapshot?.customerName || archive.customerNameSnapshot || '—'" disabled /></a-form-item>
          <a-form-item label="项目联系人"><a-input :value="(detail.contact || []).filter(item => item.contactStatus === 'ACTIVE').map(item => item.contactName).filter(Boolean).join('、') || '—'" disabled /></a-form-item>
        </div></a-form>
        <a-descriptions v-if="draft.id" bordered :column="2" size="small">
          <a-descriptions-item label="审批状态">{{ approvalStates[draft.approvalStatus] || '未提供' }}</a-descriptions-item><a-descriptions-item label="执行状态">{{ executionStates[draft.executionStatus] || '未提供' }}</a-descriptions-item>
        </a-descriptions>
        <p v-if="previousName" class="hint">续签自：{{ previousName }}。本次新建合同并保留上期记录，请重新填写期限和上传附件。</p>
        <a-form layout="vertical" :disabled="!editing || busy || uploading" class="contract-form">
          <h3>合同信息</h3>
          <div class="form-grid">
            <a-form-item label="合同名称" required><a-input v-model:value="draft.contractName" /></a-form-item>
            <a-form-item label="合同编号" required><a-input v-model:value="draft.contractNo" /></a-form-item>
            <a-form-item label="维保类型" required><a-radio-group v-model:value="draft.maintenanceType"><a-radio value="FULL">全包</a-radio><a-radio value="PARTIAL">半包</a-radio></a-radio-group></a-form-item>
            <a-form-item label="维保合同金额（元）" required><a-input-number v-model:value="draft.contractAmount" :min="0" :precision="2" /></a-form-item>
            <a-form-item v-for="[key,label] in dates" :key="key" :label="label" required><a-date-picker v-model:value="draft[key]" value-format="YYYY-MM-DD" /></a-form-item>
            <a-form-item label="销售负责人"><a-select disabled placeholder="待接口支持后开放选择" /><span class="hint">当前接口尚不支持保存销售负责人。</span></a-form-item>
          </div>
          <a-form-item label="维保范围／服务内容" required><a-textarea v-model:value="draft.serviceContent" :rows="3" /></a-form-item>
          <a-form-item label="备注"><a-textarea v-model:value="draft.remark" :rows="3" /></a-form-item>
          <h3>服务与费用约定</h3>
          <div class="form-grid">
            <a-form-item v-for="[key,label] in billing" :key="key" :label="label" required><a-select v-model:value="draft[key]" :options="billingOptions" placeholder="请选择费用责任" /></a-form-item>
          </div>
          <a-form-item label="覆盖范围"><a-radio-group v-model:value="draft.scopeMode"><a-radio value="ALL">全部有效产品</a-radio><a-radio value="SELECTED">指定产品 / 设备</a-radio></a-radio-group></a-form-item>
          <a-form-item v-if="draft.scopeMode === 'SELECTED'" label="指定产品 / 设备"><a-select v-model:value="scopeKeys" mode="multiple" show-search option-filter-prop="label" :options="scopeOptions" placeholder="请选择本档案的产品或设备" /></a-form-item>
          <p v-else class="hint">提交审批时冻结当前有效产品范围。</p>
          <a-form-item v-for="[key,label] in texts" :key="key" :label="label"><a-textarea v-model:value="draft[key]" :rows="2" /></a-form-item>
          <a-form-item v-if="editing && draft.id" label="修改原因（选填）"><a-textarea v-model:value="draft.reason" :maxlength="2000" /></a-form-item>
        </a-form>
        <h3>合同附件</h3>
        <a-upload v-if="editing" :before-upload="upload" :show-upload-list="false" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"><a-button :loading="uploading" :disabled="busy || uploading || draft.attachmentIds.length >= 20">上传合同附件</a-button></a-upload>
        <p class="hint">逐个上传，最多20个；提交审批至少需要1个附件。</p>
        <div v-for="fileId in draft.attachmentIds" :key="fileId" class="file-row"><a-button type="link" :disabled="!attachment(fileId)?.storageKey" @click="preview(fileId)">{{ attachment(fileId)?.fileName || '附件资料未返回，请刷新档案' }}</a-button><a-button v-if="editing" type="link" danger :disabled="busy || uploading" @click="draft.attachmentIds = draft.attachmentIds.filter(id => id !== fileId); dirty = true">移除</a-button></div>
        <section class="payment-plan">
          <p class="hint">选择回款项、比例和计划日期；修改比例会按合同金额计算回款金额，也可直接调整金额。</p>
          <a-alert v-if="!Array.isArray(draft.paymentPlans)" type="warning" message="接口未返回回款计划，暂不可修改计划；保存其他内容会保留原计划。" />
          <PaymentPlanEditor
            v-else :rows="draft.paymentPlans" :node-options="planNodeOptions" :row-key="planKey"
            mode="date" node-field="paymentNode" amount-field="plannedAmount" :unique-nodes="false"
            :readonly="!editing" :disabled="busy || uploading" :can-add="draft.paymentPlans.length < 500"
            remove-confirmation="移除此计划？保存合同后生效，有到账历史的计划不能删除。"
            @add="draft.paymentPlans.push({paymentNode:undefined,plannedAmount:null,plannedDate:'',ratio:null,remark:''})"
            @remove="record => draft.paymentPlans.splice(draft.paymentPlans.indexOf(record),1)"
            @change="changePlan">
            <template #footer><div class="plan-total">计划合计：{{ money(planTotal) }} {{ draft.currency || 'CNY' }} / 合同金额：{{ money(draft.contractAmount) }}</div></template>
          </PaymentPlanEditor>
          <a-descriptions v-if="draft.paymentSummary" size="small" :column="3"><a-descriptions-item label="已收金额">{{ money(draft.paymentSummary.receivedAmount) }}</a-descriptions-item><a-descriptions-item label="剩余应收">{{ money(draft.paymentSummary.remainingAmount) }}</a-descriptions-item><a-descriptions-item label="超收金额">{{ money(draft.paymentSummary.overpaidAmount) }}</a-descriptions-item></a-descriptions>
          <a-form layout="vertical" :disabled="!editing || busy || uploading"><a-form-item label="结算条款"><a-textarea v-model:value="draft.settlementTerms" :rows="3" placeholder="填写合同约定的结算方式" /></a-form-item></a-form>
        </section>
        <template v-if="draft.revisions?.length"><h3>审批记录</h3><a-table :data-source="draft.revisions" :columns="revisionColumns" row-key="id" :pagination="false" size="small"><template #bodyCell="{column,record}"><template v-if="column.dataIndex==='approvalStatus'">{{ approvalStates[record.approvalStatus] || '未提供' }}</template><template v-else>{{ record[column.dataIndex] || '—' }}</template></template></a-table></template>
      </template>
    </a-spin>
    <footer class="editor-actions">
      <a-space>
        <a-button :disabled="busy || uploading" @click="close">关闭</a-button>
        <a-button v-if="draft?.id && !editing && canEdit && editable(draft)" :disabled="busy || loading" @click="editing = true">修改合同</a-button>
        <a-button v-if="editing && canEdit && !loadFailed" type="primary" :loading="busy" :disabled="uploading || loading" @click="save">保存草稿</a-button>
        <a-button v-if="draft?.id && !editing && editable(draft) && canSubmit && archive.archiveStatus === 'ACTIVE'" type="primary" :loading="busy" @click="act('submit')">提交审批</a-button>
        <a-button v-if="draft?.approvalStatus === 'PENDING' && canSubmit" :loading="busy" @click="withdrawOpen = true; actionReason = ''">撤回申请</a-button>
      </a-space>
    </footer>
    <a-modal v-model:open="withdrawOpen" title="撤回维保合同申请" :confirm-loading="busy" :mask-closable="false" :closable="!busy" :cancel-button-props="{disabled:busy}" @ok="act('withdraw')"><a-textarea v-model:value="actionReason" placeholder="撤回原因（必填）" :maxlength="1000" :disabled="busy" /><p v-if="error">{{ error }}</p></a-modal>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { archiveDetail, contractDetail, request, uploadAttachment, type Row } from './maintenance.api';
import { approvalStates, executionStates, editable, contractPayload, newContract, validateSubmit, money } from './maintenance.model';
import Big from 'big.js';
import PaymentPlanEditor from '/@/components/PaymentPlan/PaymentPlanEditor.vue';
import { loadDictOptions } from '/@/views/project/Project.data';
import { previewFileInModal } from '/@/utils/filePreview';
const props=defineProps<{ archive:Row; detail:Row; contractId?:string; renewFrom?:string; canEdit:boolean; canSubmit:boolean }>();
const emit=defineEmits(['close','saved']);
const draft=ref<Row>(), editing=ref(false), loading=ref(false), loadFailed=ref(false), busy=ref(false), uploading=ref(false), error=ref(''), previousName=ref(''), scopeKeys=ref<string[]>([]), dirty=ref(false), files=ref<Row[]>([]), savedScopes=ref<Row[]>([]), withdrawOpen=ref(false), actionReason=ref('');
let generation=0, savedId='';
const dates=[['signedDate','合同签订日期'],['startDate','维保开始日期'],['endDate','维保结束日期']];
const billing=[['laborBillingMode','人工费用'],['materialBillingMode','材料费用'],['outsourceBillingMode','外协费用'],['travelBillingMode','差旅费用']];
const billingOptions=[{value:'INCLUDED',label:'包含在合同内'},{value:'EXTRA',label:'另行收费'},{value:'AGREED',label:'另行约定'}];
const texts=[['exclusions','不包含的服务范围'],['responseTerms','响应时限和承诺'],['billingNotes','收费补充说明']];
const planNodeOptions=ref<{label:string;value:string}[]>([]);
onMounted(async()=>{try{planNodeOptions.value=await loadDictOptions('payback_node');if(!planNodeOptions.value.length)message.warning('回款项字典为空，请检查字典配置');}catch{message.warning('回款项加载失败，请重新打开合同后重试');}});
function changePlan(record:Row,field:string){
  if(field==='ratio' && record.ratio!=null && record.ratio!=='' && draft.value?.contractAmount!=null){
    record.plannedAmount=Number(new Big(draft.value.contractAmount).times(record.ratio).div(100).round(2,Big.roundHalfUp).toString());
  }
}

const planTotal=computed(()=>(draft.value?.paymentPlans||[]).reduce((sum,p)=>sum+Math.round(Number(p.plannedAmount||0)*100),0)/100);
const planKeys=new WeakMap<object,number>();let planSeed=0;
function planKey(row:Row){if(row.id)return row.id;if(!planKeys.has(row))planKeys.set(row,++planSeed);return `new-${planKeys.get(row)}`;}
const revisionColumns=[{title:'送审次数',dataIndex:'revisionNo'},{title:'审批状态',dataIndex:'approvalStatus'},{title:'提交时间',dataIndex:'submittedAt'},{title:'通过时间',dataIndex:'approvedAt'}];
const scopeOptions=computed(()=>{
 const products=(props.detail.product||[]).filter(p=>p.productStatus==='ACTIVE').map(p=>({value:`product:${p.id}`,label:`产品：${p.productName}`}));
 const assets=(props.detail.asset||[]).filter(a=>a.assetStatus==='IN_SERVICE').map(a=>({value:`asset:${a.id}`,label:`设备：${a.assetNo || a.serialNo || '未提供编号'}（${(props.detail.product||[]).find(p=>p.id===a.productId)?.productName || '未提供产品名称'}）`}));
 const all=[...products,...assets];
 for(const s of savedScopes.value){const value=s.productId?`product:${s.productId}`:`asset:${s.assetId}`;if(!all.some(o=>o.value===value))all.push({value,label:`历史范围：${s.targetSnapshot?.productName || s.targetSnapshot?.assetNo || '已停用产品 / 设备'}`});}
 return all;
});
const scope=()=>scopeKeys.value.map(key=>{const [kind,id]=key.split(':');return kind==='product'?{productId:id}:{assetId:id};});
function apply(result:Row){draft.value={...result,paymentPlans:Array.isArray(result.paymentPlans)?result.paymentPlans.map(p=>({...p,plannedAmount:p.plannedAmount==null?null:Number(p.plannedAmount),ratio:p.ratio==null?null:Number(p.ratio),plannedDate:p.plannedDate?String(p.plannedDate).slice(0,10):''})):undefined,attachmentIds:Array.isArray(result.attachmentIds)?[...result.attachmentIds]:[],reason:''};for(const [key]of dates)if(draft.value[key])draft.value[key]=String(draft.value[key]).slice(0,10);savedScopes.value=result.scope||[];scopeKeys.value=savedScopes.value.map(s=>s.productId?`product:${s.productId}`:`asset:${s.assetId}`);dirty.value=false;}
async function load(){const seq=++generation;loading.value=true;loadFailed.value=false;error.value='';try{
 const freshArchive=await archiveDetail(props.archive.id);if(seq!==generation)return;files.value=[...(freshArchive.attachment||[])];const id=savedId||props.contractId||props.renewFrom;
 if(id){const result=await contractDetail(id,props.archive.id);if(seq!==generation)return;if(props.renewFrom&&!savedId){previousName.value=result.contractName;if(result.approvalStatus!=='APPROVED')throw new Error('只能续签已通过的合同');apply({...newContract(props.archive.id,result),scope:result.scope});editing.value=true;}else{apply(result);editing.value=false;}}
 else{apply(newContract(props.archive.id));editing.value=true;}
 }catch(e){if(seq===generation){error.value=(e as Error).message;loadFailed.value=true;}}finally{if(seq===generation)loading.value=false;}}
async function save(){if(!draft.value||busy.value||uploading.value||!props.canEdit)return;error.value='';try{const body=contractPayload(draft.value,scope());busy.value=true;const result=await request('maintenanceContract/save',body,true);if(!result?.id || result.archiveId!==props.archive.id || (draft.value.id && result.id!==draft.value.id))throw new Error('保存结果未确认，请关闭后刷新合同列表核对');savedId=result.id;apply(result);editing.value=false;emit('saved');message.success('合同草稿已保存');}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
async function act(action:'submit'|'withdraw'){if(!draft.value?.id||busy.value||!props.canSubmit)return;error.value='';busy.value=true;try{const latest=await contractDetail(draft.value.id,props.archive.id);if(action==='submit'){if(!editable(latest))throw new Error('当前合同不可提交');validateSubmit(latest);}if(action==='withdraw'&&latest.approvalStatus!=='PENDING')throw new Error('当前合同不在审批中');if(action==='withdraw'&&(!actionReason.value.trim()||actionReason.value.trim().length>1000))throw new Error('请填写1000字以内的撤回原因');const result=await request(`maintenanceContract/${action}`,{id:latest.id,...(action==='withdraw'?{reason:actionReason.value.trim()}:{})},true);if(result?.id!==latest.id || result.archiveId!==props.archive.id)throw new Error('操作结果未确认，请刷新核对');apply(result);withdrawOpen.value=false;emit('saved');message.success(action==='submit'?'已提交审批':'已撤回');}catch(e){error.value=(e as Error).message;}finally{busy.value=false;}}
async function upload(file:File){if(!draft.value||!editing.value||uploading.value||busy.value)return false;if(draft.value.attachmentIds.length>=20||file.size>20*1024*1024||!/\.(pdf|docx?|xlsx?|png|jpe?g)$/i.test(file.name)){message.error('支持PDF、Word、Excel、图片，单个20MB以内，最多20个');return false;}uploading.value=true;try{const item=await uploadAttachment(props.archive.id,file);files.value.push(item);draft.value.attachmentIds.push(item.id);dirty.value=true;}catch(e){error.value=(e as Error).message;}finally{uploading.value=false;}return false;}
const attachment=(id:string)=>files.value.find(f=>f.id===id);
function preview(id:string){const file=attachment(id);if(file?.storageKey)previewFileInModal({name:file.fileName,url:file.storageKey});}
function close(){if(busy.value||uploading.value)return;if(editing.value&&dirty.value)Modal.confirm({title:'放弃未保存的合同修改？',onOk:()=>emit('close')});else emit('close');}
watch([draft,scopeKeys],()=>{if(editing.value)dirty.value=true;},{deep:true,flush:'sync'});
watch(()=>[props.archive.id,props.contractId,props.renewFrom],()=>{savedId='';void load();},{immediate:true});
onBeforeUnmount(()=>{++generation;});
</script>
<style scoped>
.contract-editor{background:var(--component-background,#fff);padding:24px;border-radius:4px}.editor-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.editor-heading h2{margin:0;font-size:20px}.editor-actions{position:sticky;bottom:0;padding:16px 0;background:var(--component-background,#fff);border-top:1px solid var(--border-color-base,#d9d9d9);z-index:2}.contract-form{margin-top:20px}.payment-plan{margin-top:24px}.plan-total{display:flex;justify-content:space-between;gap:16px;align-items:center;margin:12px 0}.payment-plan :deep(.ant-input-number){width:100%}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px}.form-grid :deep(.ant-picker),.form-grid :deep(.ant-input-number){width:100%}.hint{color:var(--text-color-secondary,#595959);margin:12px 0}.file-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.file-row :deep(.ant-btn){white-space:normal;height:auto;text-align:left}h3{margin:24px 0 12px}:deep(.ant-alert){margin-bottom:12px}@media(max-width:700px){.form-grid{grid-template-columns:1fr}}
</style>
