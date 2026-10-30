<template>
  <a-result v-if="!canView" status="403" title="暂无售后档案查看权限" />
  <main v-else class="maintenance-page">
    <template v-if="!editor">
    <header><div><h1>维保管理</h1><p class="hint">选择售后项目，查看维保合同或维护项目位置。</p></div><a-button :disabled="loading" @click="load(page)">刷新</a-button></header>
    <a-input-search v-model:value="keyword" class="search" allow-clear placeholder="搜索售后档案名称或编号" :maxlength="100" @search="load(1)" />
    <a-alert v-if="error" type="error" show-icon :message="error"><template #action><a-button @click="load(page)">重试</a-button></template></a-alert>
    <a-table :columns="columns" :data-source="records" :loading="loading" row-key="id" :pagination="false" bordered :scroll="{ x: 950 }" :locale="{emptyText:error?'加载失败，请重试':'暂无可见售后项目'}">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key==='name'"><a-button type="link" class="project-name" @click="openProject(record)">{{ record.archiveName || '未提供项目名称' }}</a-button><div class="hint">{{ record.archiveNo }}</div></template>
        <template v-else-if="column.dataIndex==='archiveStatus'">{{ archiveStates[record.archiveStatus] || '未提供状态' }}</template>
        <template v-else-if="column.key==='action'"><a-button type="link" @click="openProject(record)">查看项目</a-button></template>
      </template>
    </a-table>
    <a-pagination :current="page" :total="total" :page-size="20" :show-size-changer="false" :disabled="loading" :show-total="n => `共 ${n} 个售后项目`" @change="load" />
    <a-drawer :open="!!projectId && !editor" title="售后项目详情" width="min(1180px, 96vw)" :destroy-on-close="true" :mask-closable="false" @close="closeProject">
      <a-spin :spinning="detailLoading"><a-alert v-if="detailError" type="error" :message="detailError"><template #action><a-button @click="loadProject">重试</a-button></template></a-alert>
        <template v-if="detail">
          <a-descriptions bordered :column="2" size="small"><a-descriptions-item label="售后项目">{{ detail.archive.archiveName }}</a-descriptions-item><a-descriptions-item label="客户">{{ detail.archive.customerNameSnapshot || '—' }}</a-descriptions-item><a-descriptions-item label="档案编号">{{ detail.archive.archiveNo }}</a-descriptions-item><a-descriptions-item label="状态">{{ archiveStates[detail.archive.archiveStatus] || '未提供' }}</a-descriptions-item><a-descriptions-item label="服务地址" :span="2">{{ detail.archive.serviceAddress || '—' }}</a-descriptions-item></a-descriptions>
          <a-tabs v-model:active-key="tab" class="project-tabs">
            <a-tab-pane key="basic" tab="基本资料">
              <h3>联系人</h3><a-table :data-source="detail.contact || []" :columns="contactColumns" row-key="id" :pagination="false" size="small"><template #bodyCell="{column,record}"><template v-if="column.dataIndex==='contactStatus'">{{ record.contactStatus==='ACTIVE'?'有效':'停用' }}</template></template></a-table>
              <h3>项目产品</h3><a-table :data-source="detail.product || []" :columns="productColumns" row-key="id" :pagination="{pageSize:10,showSizeChanger:false}" size="small" />
            </a-tab-pane>
            <a-tab-pane key="contracts" tab="维保合同">
              <a-result v-if="!canReadContracts" status="403" title="暂无维保合同查看权限" />
              <template v-else>
                <div class="toolbar"><a-button :disabled="contractLoading" @click="loadContracts(contractPage)">刷新合同</a-button><a-button v-if="canEditContracts && detail.archive.archiveStatus !== 'CLOSED'" type="primary" @click="editor = {}">新增维保合同</a-button></div>
                <a-alert v-if="contractError" type="error" :message="contractError" />
                <a-table :data-source="contractRows" :columns="contractColumns" :loading="contractLoading" row-key="id" :pagination="false" :scroll="{x:1050}" size="small" bordered>
                  <template #bodyCell="{column,record}">
                    <template v-if="column.key==='type'">{{ record.maintenanceType==='FULL'?'全包':record.maintenanceType==='PARTIAL'?'半包':'—' }}</template>
                    <template v-else-if="column.key==='term'">{{ date(record.startDate) }} 至 {{ date(record.endDate) }}</template>
                    <template v-else-if="column.key==='amount'">{{ money(record.contractAmount) }}</template>
                    <template v-else-if="column.key==='status'">{{ approvalStates[record.approvalStatus] || '未提供' }}<div class="hint">{{ executionStates[record.executionStatus] || '未提供' }}</div></template>
                    <template v-else-if="column.key==='action'"><a-space><a-button v-if="canAmount" type="link" @click="editor={contractId:record.id}">查看</a-button><a-button v-if="canEditContracts && record.approvalStatus==='APPROVED' && detail.archive.archiveStatus!=='CLOSED'" type="link" @click="editor={renewFrom:record.id}">续签</a-button></a-space></template>
                  </template>
                </a-table>
                <a-pagination :current="contractPage" :total="contractTotal" :page-size="10" :show-size-changer="false" :disabled="contractLoading" @change="loadContracts" />
              </template>
            </a-tab-pane>
            <a-tab-pane key="locations" tab="位置管理"><ArchiveLocations v-if="tab==='locations'" :key="projectId" :archive-id="projectId" :can-edit="canEditArchive && ['DRAFT','ACTIVE','SUSPENDED'].includes(detail.archive.archiveStatus)" /></a-tab-pane>
          </a-tabs>

        </template>
      </a-spin>
    </a-drawer>
    </template>
    <MaintenanceContract v-if="editor && detail" :key="`${projectId}-${editor.contractId || editor.renewFrom || 'new'}`" :archive="detail.archive" :detail="detail" :contract-id="editor.contractId" :renew-from="editor.renewFrom" :can-edit="canEditContracts && detail.archive.archiveStatus!=='CLOSED'" :can-submit="canSubmitContracts" @close="editor=undefined" @saved="loadContracts(contractPage)" />
  </main>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useUserStore } from '/@/store/modules/user';
import { usePermission } from '/@/hooks/web/usePermission';
import { archives, archiveDetail, contracts, type Row } from './maintenance.api';
import { archiveStates, approvalStates, executionStates, money, date } from './maintenance.model';
import ArchiveLocations from './ArchiveLocations.vue';
import MaintenanceContract from './MaintenanceContract.vue';
defineOptions({name:'MaintenanceManagement'});
const user=useUserStore(), {hasPermission}=usePermission();
const admin=computed(()=>user.getUserInfo.username==='admin'||user.getIdentity.roleCodes.includes('admin'));
const permitted=(code:string)=>!!user.getToken&&(admin.value||hasPermission(`afterSales:${code}`));
const canView=computed(()=>permitted('archive:view')),canEditArchive=computed(()=>permitted('archive:edit')),canAmount=computed(()=>permitted('amount:view'));
const canReadContracts=computed(()=>canView.value&&permitted('maintenance:view'));
const canEditContracts=computed(()=>canReadContracts.value&&canAmount.value&&canEditArchive.value&&permitted('maintenance:edit'));
const canSubmitContracts=computed(()=>canReadContracts.value&&canAmount.value&&permitted('maintenance:submit'));
const keyword=ref(''),page=ref(1),total=ref(0),records=ref<Row[]>([]),loading=ref(false),error=ref('');
const projectId=ref(''),detail=ref<Row>(),detailLoading=ref(false),detailError=ref(''),tab=ref('basic'),editor=ref<Row>();
const contractRows=ref<Row[]>([]),contractPage=ref(1),contractTotal=ref(0),contractLoading=ref(false),contractError=ref('');
let generation=0,detailGeneration=0,contractGeneration=0,contractsLoaded=false;
const columns=[{title:'售后项目 / 档案编号',key:'name',width:380},{title:'客户',dataIndex:'customerNameSnapshot',width:280},{title:'档案状态',dataIndex:'archiveStatus',width:100},{title:'操作',key:'action',width:120}];
const contactColumns=[{title:'联系人',dataIndex:'contactName'},{title:'联系电话',dataIndex:'contactPhone'},{title:'职务',dataIndex:'contactRole'},{title:'状态',dataIndex:'contactStatus'}];
const productColumns=[{title:'产品名称',dataIndex:'productName'},{title:'品牌',dataIndex:'brand'},{title:'型号',dataIndex:'model'},{title:'数量',dataIndex:'quantity'},{title:'单位',dataIndex:'unitName'}];
const contractColumns=computed(()=>[{title:'合同名称',dataIndex:'contractName',width:220},{title:'合同编号',dataIndex:'contractNo',width:160},{title:'类型',key:'type',width:80},{title:'维保期限',key:'term',width:220},...(canAmount.value?[{title:'金额（元）',key:'amount',width:130}]:[]),{title:'合同状态',key:'status',width:140},{title:'操作',key:'action',width:150}]);
async function load(next=1){if(!canView.value)return;const seq=++generation;loading.value=true;error.value='';page.value=next;records.value=[];total.value=0;try{const result=await archives(next,keyword.value.trim());if(seq===generation){records.value=result.records;total.value=result.total;}}catch(e){if(seq===generation)error.value=(e as Error).message;}finally{if(seq===generation)loading.value=false;}}
function closeProject(){++detailGeneration;++contractGeneration;projectId.value='';detail.value=undefined;editor.value=undefined;contractRows.value=[];contractTotal.value=0;}
function openProject(row:Row){closeProject();projectId.value=row.id;tab.value='basic';contractsLoaded=false;void loadProject();}
async function loadProject(){const seq=++detailGeneration,id=projectId.value;if(!id)return;detailLoading.value=true;detailError.value='';detail.value=undefined;try{const result=await archiveDetail(id);if(seq===detailGeneration)detail.value=result;}catch(e){if(seq===detailGeneration)detailError.value=(e as Error).message;}finally{if(seq===detailGeneration)detailLoading.value=false;}}
async function loadContracts(next=1){if(!canReadContracts.value||!projectId.value)return;const seq=++contractGeneration,id=projectId.value;contractLoading.value=true;contractError.value='';contractRows.value=[];contractTotal.value=0;contractPage.value=next;try{const result=await contracts(id,next);if(seq===contractGeneration){contractRows.value=result.records;contractTotal.value=result.total;contractsLoaded=true;}}catch(e){if(seq===contractGeneration)contractError.value=(e as Error).message;}finally{if(seq===contractGeneration)contractLoading.value=false;}}
watch(tab,value=>{if(value==='contracts'&&!contractsLoaded)void loadContracts(1);});
watch(()=>user.getIdentity.userId,()=>{++generation;closeProject();records.value=[];total.value=0;void load(1);},{immediate:true});
onBeforeUnmount(()=>{++generation;closeProject();});
</script>
<style scoped>
.maintenance-page{padding:20px}header,.toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px}h1{margin:0;font-size:22px}h3{margin:20px 0 12px}.hint{color:var(--text-color-secondary,#595959);margin:4px 0;font-size:13px}.search{max-width:440px;margin-bottom:20px}.project-name{padding:0;height:auto;white-space:normal;text-align:left}.project-tabs{margin-top:24px}:deep(.ant-pagination){margin-top:16px;text-align:right}:deep(.ant-alert){margin-bottom:16px}:deep(.ant-table-cell){overflow-wrap:anywhere}
</style>
