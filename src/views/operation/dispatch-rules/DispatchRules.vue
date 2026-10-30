<template>
  <div class="dispatch-rules">
    <a-alert type="info" show-icon message="Mock 预览：人员、客户和规则均为示例，仅当前页面会话保存，不影响真实派单。" />
    <div class="rule-guide">
      <div><a-tag color="blue">客户制</a-tag><strong>指定客户 → 固定负责人</strong><p>覆盖该客户全部现有及新增项目，负责人休息时仍照常派单。</p></div>
      <div><a-tag color="purple">值班制</a-tag><strong>其余客户 → 值班人员</strong><p>无需选择客户，按值班表和自动派单规则分配，休息人员跳过。</p></div>
    </div>
    <div class="query-bar">
      <a-select v-model:value="filters.userId" aria-label="查询运维人员" placeholder="全部运维人员" allow-clear :options="people" />
      <a-select v-model:value="filters.mode" aria-label="查询派单方式" placeholder="全部派单方式" allow-clear :options="modes" />
      <a-select v-model:value="filters.customerId" aria-label="查询客户制客户" placeholder="客户制负责客户" allow-clear :options="customers" />
      <a-select v-model:value="filters.status" aria-label="查询状态" placeholder="全部状态" allow-clear :options="[{label:'启用',value:'enabled'},{label:'停用',value:'disabled'}]" />
      <a-button @click="filters={}">重置</a-button>
    </div>
    <div class="toolbar"><span>派单规则 <a-tag>{{ filtered.length }} 条</a-tag></span><a-button type="primary" @click="edit()">新增规则</a-button></div>
    <a-alert v-if="pageError" type="error" :message="pageError" closable @close="pageError=''" />
    <a-table :columns="columns" :data-source="filtered" row-key="id" :pagination="{pageSize:8,hideOnSinglePage:true}" :scroll="{x:820}">
      <template #bodyCell="{column,record}">
        <template v-if="column.key==='person'">{{ personName(record.userId) }}</template>
        <template v-else-if="column.key==='mode'"><a-tag :color="record.mode==='CUSTOMER'?'blue':'purple'">{{ record.mode==='CUSTOMER'?'客户制':'值班制' }}</a-tag></template>
        <template v-else-if="column.key==='scope'"><template v-if="record.mode==='CUSTOMER'"><a-tag v-for="id in record.customerIds" :key="id">{{ customerName(id) }}</a-tag><div class="muted">以上客户的全部项目 · 休息不影响派单</div></template><template v-else>所有未指定负责人的客户<div class="muted">全部项目 · 按值班表及自动派单规则</div></template></template>
        <template v-else-if="column.key==='status'"><a-badge :status="record.enabled?'success':'default'" :text="record.enabled?'启用':'停用'" /></template>
        <template v-else-if="column.key==='action'"><a-button type="link" @click="edit(record)">编辑</a-button><a-popconfirm :title="record.enabled?'停用后，仅影响后续派单；客户制客户将回到值班范围。':'启用此规则？仅影响后续派单。'" @confirm="toggle(record)"><a-button type="link">{{ record.enabled?'停用':'启用' }}</a-button></a-popconfirm></template>
      </template>
    </a-table>
    <section class="preview"><h3>派单归属预览</h3><p class="muted">选择客户，查看该客户所有项目会进入哪种派单方式。</p><a-select v-model:value="previewCustomer" aria-label="预览客户" :options="customers" placeholder="选择客户" /><a-alert v-if="previewCustomer" :type="previewResult.type" :message="previewResult.title" :description="previewResult.description" show-icon /></section>
    <p class="muted">调整规则仅影响后续派单，已分配维修单保持原负责人。客户制工单不因休息自动转派，需换人时由主管主动转单。</p>
    <a-modal v-model:open="open" :title="form.id?'编辑派单规则':'新增派单规则'" ok-text="保存 Mock 规则" :mask-closable="false" @ok="save">
      <a-form layout="vertical">
        <a-form-item label="运维人员" required><a-select v-model:value="form.userId" :options="people" placeholder="请选择人员" show-search option-filter-prop="label" /></a-form-item>
        <a-form-item label="派单方式" required><a-radio-group v-model:value="form.mode" :options="modes" @change="form.customerIds=[];formError=''" /></a-form-item>
        <a-form-item v-if="form.mode==='CUSTOMER'" label="负责客户" required><a-select v-model:value="form.customerIds" mode="multiple" :options="customers" placeholder="选择一个或多个客户" option-filter-prop="label" /><p class="muted">包含所选客户全部项目，不受值班表或休息影响。同一客户仅允许一个有效负责人。</p></a-form-item>
        <a-alert v-else type="info" message="自动承接所有未指定负责人的客户，无需逐个选择客户。具体接收人由值班表及自动派单规则决定。" />
        <a-form-item label="状态"><a-switch v-model:checked="form.enabled" checked-children="启用" un-checked-children="停用" /></a-form-item>
        <a-alert v-if="formError" type="error" :message="formError" show-icon />
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';
import { people, customers, rules, validateRule, type DispatchRule } from './dispatchRules.mock';
const modes = [{label:'客户制',value:'CUSTOMER'},{label:'值班制',value:'DUTY'}];
const filters=ref<{userId?:string;mode?:string;customerId?:string;status?:string}>({});
const filtered=computed(()=>rules.filter(r=>(!filters.value.userId||r.userId===filters.value.userId)&&(!filters.value.mode||r.mode===filters.value.mode)&&(!filters.value.customerId||r.customerIds.includes(filters.value.customerId))&&(!filters.value.status||r.enabled===(filters.value.status==='enabled'))));
const personName=(id:string)=>people.find(p=>p.value===id)?.label||'未知人员';
const customerName=(id:string)=>customers.find(c=>c.value===id)?.label||'未知客户';
const columns=[{title:'运维人员',key:'person',width:130},{title:'派单方式',key:'mode',width:110},{title:'负责范围',key:'scope',width:300},{title:'状态',key:'status',width:90},{title:'更新时间',dataIndex:'updatedAt',width:170},{title:'操作',key:'action',width:150}];
const blank=():DispatchRule=>({id:'',userId:'',mode:'CUSTOMER',customerIds:[],enabled:true,updatedAt:''});
const open=ref(false), form=ref<DispatchRule>(blank()), formError=ref(''),pageError=ref(''),previewCustomer=ref<string>();
function edit(row?:DispatchRule){form.value=row?{...row,customerIds:[...row.customerIds]}:blank();formError.value='';open.value=true;}
function save(){const next={...form.value,customerIds:form.value.mode==='CUSTOMER'?[...form.value.customerIds]:[]};formError.value=validateRule(next);if(formError.value)return;next.updatedAt=new Date().toLocaleString('zh-CN',{hour12:false});const i=rules.findIndex(r=>r.id===next.id);if(i<0){next.id=`mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;rules.push(next);}else rules.splice(i,1,next);open.value=false;pageError.value='';message.success('已保存 Mock 规则，仅当前页面会话有效');}
function toggle(row:DispatchRule){const next={...row,enabled:!row.enabled};pageError.value=validateRule(next);if(pageError.value)return;row.enabled=next.enabled;row.updatedAt=new Date().toLocaleString('zh-CN',{hour12:false});}
const previewResult=computed(()=>{const owner=rules.find(r=>r.enabled&&r.mode==='CUSTOMER'&&r.customerIds.includes(previewCustomer.value||''));if(owner)return {type:'success' as const,title:`客户制 · ${personName(owner.userId)}`,description:'该客户全部项目固定派给此人，即使休息也照常分配。'};const duty=rules.filter(r=>r.enabled&&r.mode==='DUTY');return duty.length?{type:'info' as const,title:'值班制 · 按值班表与自动派单规则分配',description:`参与人员：${duty.map(r=>personName(r.userId)).join('、')}。本预览不计算具体轮值结果；缺执行时间或无可接人员进入待调度。`}:{type:'warning' as const,title:'待调度 · 没有启用的值班人员',description:'该客户没有指定负责人，且暂无值班人员，请先配置。'};});
</script>
<style scoped>
.dispatch-rules{display:flex;flex-direction:column;gap:16px}.rule-guide{display:grid;grid-template-columns:1fr 1fr;gap:16px}.rule-guide>div,.preview{border:1px solid var(--border-color,#e5e7eb);border-radius:6px;padding:16px}.rule-guide p{margin:10px 0 0;color:#595959}.query-bar{background:var(--app-content-background,#f5f7fa);padding:16px;display:flex;gap:12px;flex-wrap:wrap}.query-bar .ant-select{min-width:155px}.toolbar{display:flex;align-items:center;justify-content:space-between}.muted{color:#595959;font-size:13px;line-height:1.8;margin:6px 0}.preview .ant-select{width:280px;max-width:100%;margin:0 0 12px}.preview h3{font-size:16px;margin:0}.preview .ant-alert{margin-top:4px}@media(max-width:640px){.rule-guide{grid-template-columns:1fr}.query-bar .ant-select{width:100%}}
</style>
