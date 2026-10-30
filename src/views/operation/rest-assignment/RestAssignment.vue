<template>
  <div class="rest-page">
    <a-alert v-if="s.error" type="error" show-icon :message="s.error" />
    <a-alert v-if="s.message" type="success" show-icon :message="s.message" />
    <a-space v-if="!s.options"><a-spin v-if="s.loading" /><a-button v-else @click="init">重新读取权限与配置</a-button></a-space>
    <a-alert v-else-if="!canManage" type="warning" message="当前账号没有休息与调度管理权限" />
    <template v-else>
      <a-alert v-if="!enabled" type="info" message="固定四人轮值尚未启用，请由管理员完成初始化；可查询已有休息记录。" />
      <p>固定轮值顺序：{{ members.map(p=>p.name).join(' → ') || '尚未配置' }}。手动指定不推进自动轮值。</p>
      <a-radio-group :value="s.tab" :disabled="locked" @change="switchTab($event.target.value)"><a-radio-button value="rest">设置休息与转派</a-radio-button><a-radio-button value="history">休息记录</a-radio-button><a-radio-button value="schedule">待调度 / 执行计划</a-radio-button></a-radio-group>
      <a-alert v-if="s.uncertain" type="warning" message="提交结果待核对，当前方案已锁定"><template #action><a-button :loading="s.busy" @click="sendPending">按原请求重试</a-button></template></a-alert>
      <section v-if="s.tab==='rest'" class="section">
        <a-form layout="vertical" :disabled="!enabled||locked">
          <div class="grid"><a-form-item label="休息人员" required><a-select v-model:value="s.form.userId" :options="members.map(p=>({value:p.userId,label:p.name}))" placeholder="选择固定轮值人员" @change="formChanged" /></a-form-item>
          <a-form-item label="开始日期" required><a-date-picker v-model:value="s.form.startDate" value-format="YYYY-MM-DD" :allow-clear="false" @change="formChanged" /></a-form-item><a-form-item label="开始时间" required><a-time-picker v-model:value="s.form.startTime" value-format="HH:mm" format="HH:mm" :allow-clear="false" @change="formChanged" /></a-form-item>
          <a-form-item label="结束日期" required><a-date-picker v-model:value="s.form.endDate" value-format="YYYY-MM-DD" :allow-clear="false" @change="formChanged" /></a-form-item><a-form-item label="结束时间" required><a-time-picker v-model:value="s.form.endTime" value-format="HH:mm" format="HH:mm" :allow-clear="false" @change="formChanged" /></a-form-item></div>
          <a-space><a-button @click="period('morning')">上午</a-button><a-button @click="period('afternoon')">下午</a-button><a-button @click="period('all')">全天</a-button></a-space>
          <a-form-item label="备注"><a-input v-model:value="s.form.remark" :maxlength="1000" /></a-form-item>
          <a-button type="primary" :loading="s.loading" @click="preview">查询并预览分配</a-button>
        </a-form>
        <p v-if="s.calendar">当日排班：{{ [...new Set((s.calendar.dutyUsers||[]).map(p=>p.name))].join('、')||'未安排' }}；已有休息 {{ s.calendar.rests?.total||0 }} 条（休息记录可分页查询）。</p>
        <template v-if="s.preview">
          <h3>受影响的未完成维修单（{{ items.length }} 单）</h3><p>未指定的单子按原规则自动分配。每次改选都会重新预览。</p>
          <a-alert v-if="s.preview.blockedReasons?.length" type="warning" :message="s.preview.blockedReasons.map(reasonText).join('；')" />
          <div class="batch"><span>已选 {{ s.selected.length }} 单</span><a-select v-model:value="s.batchTarget" :disabled="locked||s.loading" placeholder="所选单共同可接人员" :options="candidates.map(p=>({value:p.userId,label:p.name}))" /><a-button :disabled="!s.batchTarget||locked||s.loading" @click="choose(s.selected,s.batchTarget)">批量指定</a-button><a-button :disabled="!s.selected.length||locked||s.loading" @click="choose(s.selected)">改回自动</a-button></div>
          <a-table row-key="orderId" :data-source="items" :pagination="false" :columns="columns" :scroll="{x:800}" :row-selection="{selectedRowKeys:s.selected,onChange:keys=>s.selected=keys,getCheckboxProps:()=>({disabled:locked||s.loading})}">
            <template #bodyCell="{column,record}">
              <template v-if="column.key==='schedule'">{{ formatTime(record.schedule?.plannedStartAt) }}<br />{{ formatTime(record.schedule?.plannedEndAt) }}<a-button type="link" :disabled="locked" @click="editSchedule(record.orderId)">设置预计执行时间</a-button></template>
              <template v-else-if="column.key==='target'"><a-select :value="s.choices[record.orderId]||''" :disabled="locked||s.loading" :options="personOptions(record)" @change="choose([record.orderId],$event)" /><p>预计接收人：{{ record.suggestedTargetName||'暂无可接人员' }}</p></template>
              <template v-else-if="column.key==='blocked'">{{ (record.blockedReasons||[]).map(reasonText).join('；')||'可分配' }}</template>
            </template>
          </a-table>
          <p>预览有效至 {{ formatTime(s.preview.expiresAt) }}。变更或过期后须重新预览。</p>
          <a-button type="primary" :disabled="!ready" @click="openConfirm">确认休息并调整派单</a-button>
        </template>
        <div v-if="s.result?.assignments" class="result"><h3>已生效分配</h3><p v-for="row in s.result.assignments" :key="row.orderId">{{ row.orderId }} → {{ row.targetName }}（{{ row.mode==='AUTO'?'自动':'指定' }}）</p></div>
      </section>
      <section v-if="s.tab==='history'" class="section">
        <a-space wrap><a-date-picker v-model:value="s.historyDate" :disabled="s.historyLoading" value-format="YYYY-MM-DD" placeholder="全部日期" /><a-select v-model:value="s.historyUser" :disabled="s.historyLoading" :options="[{value:'',label:'全部人员'},...members.map(p=>({value:p.userId,label:p.name}))]" /><a-button :loading="s.historyLoading" @click="history(true)">查询</a-button></a-space>
        <a-table row-key="id" :data-source="s.history" :pagination="false" :columns="historyColumns"><template #bodyCell="{column,record}"><template v-if="column.key==='user'">{{ name(record.userId) }}</template><template v-else-if="column.key==='time'">{{ formatTime(record.startAt) }} 至 {{ formatTime(record.endAt) }}</template><template v-else-if="column.key==='status'">{{ statusText(record.displayStatus) }}</template><template v-else-if="column.key==='action'"><a-button type="link" :disabled="locked" @click="viewRest(record.id)">查看详情</a-button></template></template></a-table>
        <a-button v-if="s.history.length<s.historyTotal" :loading="s.historyLoading" @click="history()">加载更多（已载入{{ s.history.length }}/{{ s.historyTotal }}）</a-button>
      </section>
      <section v-if="s.tab==='schedule'" class="section">
        <a-space><a-select v-model:value="s.scheduleFilter" :disabled="s.scheduleLoading||locked" :options="[{value:'WAIT_DISPATCH',label:'待调度'},{value:'ASSIGNED',label:'已分配·待维修'}]" @change="schedules(true)" /><a-button :loading="s.scheduleLoading" :disabled="locked||!enabled" @click="schedules(true)">刷新</a-button></a-space>
        <p>已检查 {{ s.scanned }}/{{ s.scheduleTotal }} 张待维修单，匹配 {{ s.schedules.length }} 张；继续加载检查后续工单。</p><a-alert v-if="s.scheduleFailures.length" type="warning" :message="'部分工单详情读取失败，请刷新重试：'+s.scheduleFailures.join('、')" />
        <a-table row-key="id" :data-source="s.schedules" :pagination="false" :columns="scheduleColumns"><template #bodyCell="{column,record}"><template v-if="column.key==='schedule'">{{ formatTime(record.schedule?.plannedStartAt) }} 至 {{ formatTime(record.schedule?.plannedEndAt) }}</template><template v-else-if="column.key==='action'"><a-button type="link" :disabled="locked" @click="editSchedule(record.id)">设置预计执行时间</a-button></template></template></a-table>
        <a-button v-if="s.scanned<s.scheduleTotal" :loading="s.scheduleLoading" :disabled="locked" @click="schedules()">继续加载并检查</a-button>
      </section>
    </template>
    <a-modal v-model:open="s.confirmOpen" title="确认休息与转派" :closable="!locked" :mask-closable="false" :keyboard="false" :ok-button-props="{disabled:!ready}" :confirm-loading="s.busy" :cancel-button-props="{disabled:locked}" ok-text="确认并生效" @ok="confirm"><p>{{ name(s.form.userId) }}：{{ s.form.startDate }} {{ s.form.startTime }} 至 {{ s.form.endDate }} {{ s.form.endTime }}</p><p>共 {{ items.length }} 单，确认后立即生效。</p><p v-for="row in items" :key="row.orderId">{{ row.orderNo }} → {{ row.suggestedTargetName||'未分配' }}（{{ row.mode==='MANUAL'?'指定':'自动' }}）</p></a-modal>
    <a-modal :open="!!s.editing" title="设置预计执行时间（北京时间）" :footer="null" :closable="!locked" :mask-closable="false" :keyboard="false" @cancel="s.editing=null">
      <a-form layout="vertical" :disabled="locked"><div class="grid two"><template v-for="part in ['start','end']" :key="part"><a-form-item :label="part==='start'?'开始日期':'结束日期'"><a-date-picker v-model:value="s.scheduleForm[part+'Date']" value-format="YYYY-MM-DD" :allow-clear="false" /></a-form-item><a-form-item :label="part==='start'?'开始时间':'结束时间'"><a-time-picker v-model:value="s.scheduleForm[part+'Time']" value-format="HH:mm" format="HH:mm" :allow-clear="false" /></a-form-item></template></div><a-form-item label="设置/调整原因" required><a-textarea v-model:value="s.scheduleForm.reason" :maxlength="1000" /></a-form-item></a-form>
      <a-alert v-if="s.error" type="error" :message="s.error" /><a-button v-if="s.scheduleUncertain" :loading="s.scheduleSaving" @click="reconcileSchedule">读取最新工单核对</a-button><a-button v-else type="primary" :loading="s.scheduleSaving" :disabled="locked" @click="saveSchedule">保存计划并尝试派单</a-button>
    </a-modal>
    <a-modal :open="!!s.detail" title="休息及转派记录" :footer="null" :closable="!locked" :mask-closable="false" @cancel="s.detail=null"><template v-if="s.detail"><p>{{ name(s.detail.rest.userId) }}：{{ formatTime(s.detail.rest.startAt) }} 至 {{ formatTime(s.detail.rest.endAt) }}</p><p>{{ s.detail.rest.remark||'无备注' }}</p><p v-for="row in s.detail.assignments" :key="row.id">{{ row.orderId }}：{{ row.fromNameSnapshot }} → {{ row.toNameSnapshot }}（{{ row.dispatchMode==='AUTO'?'自动':'指定' }}）</p><template v-if="s.detail.rest.status==='VALID' && Date.parse(s.detail.rest.endAt)>s.now"><a-alert type="warning" message="取消休息不会转回已分配工单" /><a-textarea v-model:value="s.cancelReason" placeholder="填写取消原因" :maxlength="1000" :disabled="locked" /><a-popconfirm title="确定取消休息？已转派工单不会转回。" @confirm="cancel"><a-button danger :disabled="locked">取消休息</a-button></a-popconfirm></template></template></a-modal>
  </div>
</template>
<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { restApi } from './restAssignment.api';
import { useRestManager } from './useRestManager';
const props=defineProps<{initialTab?:string}>();
const emit=defineEmits(['changed','lock-change']);
const {s,canManage,enabled,locked,members,items,candidates,ready,name,init,formChanged,period,preview,choose,openConfirm,confirm,sendPending,history,viewRest,cancel,schedules,editSchedule,saveSchedule,reconcileSchedule,switchTab,formatTime,reasonText}=useRestManager(restApi,()=>emit('changed'));
watch(locked,v=>emit('lock-change',v));onBeforeRouteLeave(()=>!locked.value);onMounted(async()=>{await init();if(props.initialTab)switchTab(props.initialTab);});
const personOptions=(row:any)=>[{value:'',label:'按规则自动分配'},...(row.eligibleCandidates||[]).map((p:any)=>({value:p.userId,disabled:p.canAssign!==true,label:`${p.name} · ${p.canAssign?'待处理'+p.pendingCount+'单':reasonText(p.blockedReason)}`}))];
const statusText=(value:string)=>({SCHEDULED:'待开始',RESTING:'休息中',ENDED:'已结束',CANCELLED:'已取消'}[value]||value);
const columns=[{title:'工单号',dataIndex:'orderNo',width:180},{title:'预计执行时间',key:'schedule',width:220},{title:'分配方式 / 接收人',key:'target',width:260},{title:'检查结果',key:'blocked',width:180}];
const historyColumns=[{title:'人员',key:'user'},{title:'休息时段',key:'time'},{title:'状态',key:'status'},{title:'操作',key:'action'}];
const scheduleColumns=[{title:'工单号',dataIndex:'orderNo'},{title:'故障',dataIndex:'faultDescription'},{title:'预计执行时间',key:'schedule'},{title:'操作',key:'action'}];
</script>
<style scoped>
.rest-page{display:grid;gap:16px}.section{background:#fff;border:1px solid #e9edf2;border-radius:8px;padding:20px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.grid.two{grid-template-columns:1fr 1fr}.grid :deep(.ant-picker){width:100%}h3{font-size:16px;margin:18px 0 12px}p{color:#667085;line-height:1.6;font-size:13px;margin:10px 0}.batch{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#f5f7fa;padding:12px;margin:16px 0}.batch :deep(.ant-select){min-width:220px}.section :deep(td .ant-select){width:100%}.section :deep(.ant-form-item){margin-bottom:14px}.section :deep(.ant-space){margin-bottom:12px}@media(max-width:700px){.grid{grid-template-columns:1fr 1fr}.section{padding:12px}}
</style>
