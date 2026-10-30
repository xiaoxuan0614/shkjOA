<template>
  <div class="rest-page">
    <a-alert type="info" show-icon message="页面预览 · 示例数据" description="休息登记与主管转派接口待接入。这里仅预览安排，不会修改真实排班或维修单。" />
    <section class="rest-section">
      <h3>1. 设置休息时间</h3>
      <a-form layout="vertical">
        <div class="rest-grid">
          <a-form-item label="日期" required><a-date-picker v-model:value="form.date" value-format="YYYY-MM-DD" :allow-clear="false" /></a-form-item>
          <a-form-item label="运维人员" required><a-select v-model:value="form.userId" placeholder="请选择人员" :options="demoPeople.map(p => ({value:p.id,label:p.name}))" /></a-form-item>
          <a-form-item label="开始时间" required><a-time-picker v-model:value="form.start" value-format="HH:mm" format="HH:mm" :allow-clear="false" /></a-form-item>
          <a-form-item label="结束时间" required><a-time-picker v-model:value="form.end" value-format="HH:mm" format="HH:mm" :allow-clear="false" /></a-form-item>
        </div>
        <a-space wrap><a-button @click="period('08:00','12:00')">上午</a-button><a-button @click="period('13:00','18:00')">下午</a-button><a-button @click="period('00:00','23:59')">全天</a-button></a-space>
        <a-form-item label="休息备注" class="reason"><a-input v-model:value="form.reason" placeholder="可填写调休等安排说明" :maxlength="200" /></a-form-item>
        <a-button type="primary" @click="query">查看受影响维修单</a-button>
      </a-form>
    </section>
    <a-alert v-if="error" type="error" show-icon :message="error" />
    <section v-if="checked" class="rest-section">
      <div class="rest-heading"><div><h3>2. 指定接收人</h3><p>自动派单 · 执行时间与休息时间冲突</p></div><a-tag>{{ pending.length }} 单待转 · 已指定 {{ assigned }} 单</a-tag></div>
      <a-alert v-if="working.length" type="warning" show-icon message="执行中的维修单不能直接批量转派，需另行处理。" />
      <div class="batch-bar"><span>已选 {{ selected.length }} 单</span><a-select v-model:value="batchTarget" placeholder="选择批量接收人" :options="options" /><a-button :disabled="!selected.length || !batchTarget" @click="assignBatch">为所选单指定</a-button></div>
      <a-table row-key="id" :data-source="rows" :pagination="false" :columns="columns" :row-selection="{selectedRowKeys:selected,onChange:keys => selected = keys,getCheckboxProps:row => ({disabled:row.state==='working'})}" :scroll="{x:700}">
        <template #bodyCell="{column,record}">
          <template v-if="column.key==='order'"><strong>{{ record.title }}</strong><p>{{ record.id }} · {{ record.customer }}</p></template>
          <template v-else-if="column.key==='state'"><a-tag :color="record.state==='working'?'orange':'blue'">{{ record.state==='working'?'执行中':'待执行' }}</a-tag></template>
          <template v-else-if="column.key==='target'"><a-select v-if="record.state==='pending'" v-model:value="record.targetId" placeholder="指定接收人" :options="options" allow-clear /><span v-else>需另行处理</span></template>
        </template>
        <template #emptyText>这个休息时段没有受影响的示例维修单</template>
      </a-table>
      <div class="rest-footer"><span>实际生效前，后端需重新检查工单与人员状态。</span><a-button type="primary" @click="confirm">预览确认结果</a-button></div>
    </section>
    <a-modal v-model:open="showResult" title="休息与转派预览" :footer="null"><p>{{ personName }} · {{ form.date }} {{ form.start }}—{{ form.end }}</p><p>待转维修单 {{ rows.length }} 单，已全部指定接收人。</p><p v-for="row in rows" :key="row.id">{{ row.id }} → {{ demoPeople.find(p=>p.id===row.targetId)?.name }}</p><a-alert type="info" message="预览完成，未保存休息、未执行转单。" /></a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { demoPeople, eligiblePeople, previewOrders, validateRest, assignmentError, type RestOrder } from './restAssignment';
const form = reactive({date:dayjs().format('YYYY-MM-DD'),userId:'',start:'08:00',end:'12:00',reason:''});
const rows=ref<RestOrder[]>([]), selected=ref<string[]>([]), batchTarget=ref(''), checked=ref(false), error=ref(''), showResult=ref(false);
const pending=computed(()=>rows.value.filter(r=>r.state==='pending')), working=computed(()=>rows.value.filter(r=>r.state==='working'));
const assigned=computed(()=>pending.value.filter(r=>r.targetId).length);
const options=computed(()=>eligiblePeople(form.userId).map(p=>({value:p.id,label:`${p.name} · ${p.hint}`})));
const personName=computed(()=>demoPeople.find(p=>p.id===form.userId)?.name);
const columns=[{title:'维修单',key:'order'},{title:'预计执行',dataIndex:'time',width:110},{title:'状态',key:'state',width:100},{title:'接收人',key:'target',width:260}];
watch(()=>[form.date,form.userId,form.start,form.end],()=>{checked.value=false;rows.value=[];selected.value=[];batchTarget.value='';error.value='';showResult.value=false;});
function period(start:string,end:string){form.start=start;form.end=end;}
function query(){showResult.value=false;error.value=validateRest(form);if(error.value)return;rows.value=previewOrders(form);selected.value=[];checked.value=true;}
function assignBatch(){if(!eligiblePeople(form.userId).some(p=>p.id===batchTarget.value))return;rows.value.forEach(r=>{if(r.state==='pending'&&selected.value.includes(r.id))r.targetId=batchTarget.value;});selected.value=[];error.value='';}
function confirm(){error.value=assignmentError(form,rows.value);if(!error.value)showResult.value=true;}
</script>
<style scoped>
.rest-page{display:grid;gap:16px}.rest-section{background:#fff;border:1px solid #e9edf2;border-radius:8px;padding:20px}.rest-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.rest-grid :deep(.ant-picker){width:100%}h3{font-size:16px;margin:0 0 16px}p{color:#667085;font-size:13px;margin:6px 0}.reason{margin-top:16px}.rest-heading,.rest-footer,.batch-bar{display:flex;gap:12px;align-items:center;justify-content:space-between}.batch-bar{justify-content:flex-start;background:#f5f7fa;padding:12px;margin:16px 0}.batch-bar :deep(.ant-select){width:280px}.rest-section :deep(td .ant-select){width:100%}.rest-footer{margin-top:20px;color:#667085;font-size:13px}@media(max-width:700px){.rest-grid{grid-template-columns:1fr 1fr}.rest-heading,.rest-footer,.batch-bar{flex-wrap:wrap}.rest-section{padding:12px}}
</style>
