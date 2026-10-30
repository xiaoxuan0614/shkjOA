<template>
  <section>
    <div class="work-toolbar"><h3>维修作业记录</h3><a-button :disabled="loading" @click="loadPage(page)">刷新</a-button></div>
    <a-alert v-if="error" type="error" show-icon :message="error"><template #action><a-button @click="loadPage(page)">重试</a-button></template></a-alert>
    <a-table :columns="columns" :data-source="records" row-key="id" :loading="loading" :pagination="false" size="small" bordered :scroll="{ x: 1450 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'"><a-button type="link" :disabled="!(record.recordId || record.id)" @click="openRecord(record)">查看详情</a-button></template>
        <template v-else-if="column.dataIndex === 'durationSeconds'">{{ hours(record.durationSeconds) }}</template>
        <template v-else-if="column.dataIndex === 'repairDescription'"><span class="work-summary" :title="record.repairDescription">{{ display(record.repairDescription) }}</span></template>
        <template v-else>{{ text(column.dataIndex, record[column.dataIndex]) }}</template>
      </template>
    </a-table>
    <a-pagination :current="page" :total="total" :page-size="10" :show-size-changer="false" :disabled="loading" :show-total="n => `共 ${n} 条`" @change="loadPage" />
    <a-drawer :open="!!selected" title="维修作业详情" width="min(960px, 96vw)" @close="closeRecord">
      <a-spin :spinning="detailLoading">
        <a-alert v-if="detailError" type="error" :message="detailError"><template #action><a-button @click="loadRecord">重试</a-button></template></a-alert>
        <template v-else-if="detail">
          <a-descriptions bordered :column="2" size="small">
            <a-descriptions-item label="作业人员">{{ display(selected?.operatorNameSnapshot) }}</a-descriptions-item>
            <a-descriptions-item label="作业序号">{{ display(selected?.recordNo) }}</a-descriptions-item>
            <a-descriptions-item label="维修方式">{{ text('repairMethod', selected?.repairMethod) }}</a-descriptions-item>
            <a-descriptions-item label="日志状态">{{ text('formStatus', detail.formStatus) }}</a-descriptions-item>
            <a-descriptions-item label="签到时间">{{ display(detail.effectiveStartedAt) }}</a-descriptions-item>
            <a-descriptions-item label="签退时间">{{ display(detail.effectiveEndedAt) }}</a-descriptions-item>
            <a-descriptions-item label="签到状态">{{ display(selected?.signInStatusName) }}</a-descriptions-item>
            <a-descriptions-item label="签退状态">{{ display(selected?.signOutStatusName) }}</a-descriptions-item>
            <a-descriptions-item label="本次工时">{{ hours(detail.durationSeconds) }}</a-descriptions-item>
            <a-descriptions-item label="使用车辆">{{ display(detail.vehiclePlateSnapshot) }}</a-descriptions-item>
            <a-descriptions-item v-if="selected?.clockAbnormalReason" label="打卡异常说明" :span="2">{{ selected.clockAbnormalReason }}</a-descriptions-item>
            <a-descriptions-item v-if="selected?.correctionDescription" label="补签退说明" :span="2">{{ selected.correctionDescription }}</a-descriptions-item>
            <a-descriptions-item label="故障描述" :span="2">{{ display(detail.faultDescription) }}</a-descriptions-item>
            <a-descriptions-item label="维修内容" :span="2">{{ display(detail.repairDescription) }}</a-descriptions-item>
          </a-descriptions>
          <section v-if="detail.persons?.length"><h3>参与人员</h3><a-table :data-source="detail.persons" :columns="personColumns" :pagination="false" size="small" :row-key="(_r, i) => i"><template #bodyCell="{column,record}">{{ text(column.dataIndex,record[column.dataIndex]) }}</template></a-table></section>
          <section v-if="detail.outsources?.length"><h3>外协实际用人</h3><a-table :data-source="detail.outsources" :columns="outsourceColumns" :pagination="false" size="small" row-key="outsourceMemberId"><template #bodyCell="{column,record}"><template v-if="column.dataIndex === 'outsourceMemberId'">{{ memberName(record.outsourceMemberId) }}</template><template v-else>{{ display(record[column.dataIndex]) }}</template></template></a-table></section>
          <section v-if="materials.length"><h3>本次用料</h3><a-table :data-source="materials" :columns="materialColumns" :pagination="false" size="small" :row-key="(_r, i) => i"><template #bodyCell="{column,record}">{{ display(record[column.dataIndex]) }}</template></a-table></section>
          <section v-if="detail.files?.length"><h3>照片、视频及附件</h3>
            <div v-for="(file, index) in detail.files" :key="index">
              <a-button v-if="file.referenceType === 'PUBLIC_PATH'" type="link" @click="previewFileInModal(file.fileId)">{{ file.fileName || '查看附件' }}</a-button>
              <FileLinks v-else-if="file.referenceType === 'ATTACHMENT_ID'" :files="[file]" />
              <span v-else>{{ file.fileName || '无法识别的附件引用' }}</span>
            </div>
          </section>
        </template>
      </a-spin>
    </a-drawer>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { repairWorkPage, repairWorkDetail, display, hours, type Row } from './repair.api';
import { previewFileInModal } from '/@/utils/filePreview';
import FileLinks from './RepairFiles.vue';
const props = defineProps<{ orderId: string; active: boolean; members: Row[]; materialLinks: Row[] }>();
const records = ref<Row[]>([]), page = ref(1), total = ref(0), loading = ref(false), error = ref('');
const selected = ref<Row>(), detail = ref<Row>(), detailLoading = ref(false), detailError = ref('');
let generation = 0, detailGeneration = 0, loaded = false;
const labels: Record<string,string> = { ONLINE:'线上', OFFLINE:'线下', INSPECTION:'检查', ACTIVE:'进行中', ENDED:'已结束', PENDING_CORRECTION:'待补卡', DRAFT:'草稿', SUBMITTED:'已提交', INTERNAL:'内部人员', EXTERNAL:'外协' };
const text = (key: string, value: unknown) => ['repairMethod','recordStatus','formStatus','personType'].includes(key) ? labels[String(value)] || display(value) : display(value);
const columns = [
  {title:'作业序号',dataIndex:'recordNo',width:90}, {title:'作业人员',dataIndex:'operatorNameSnapshot',width:120},
  {title:'维修方式',dataIndex:'repairMethod',width:90}, {title:'签到时间',dataIndex:'effectiveStartedAt',width:180}, {title:'签退时间',dataIndex:'effectiveEndedAt',width:180},
  {title:'签到状态',dataIndex:'signInStatusName',width:120}, {title:'签退状态',dataIndex:'signOutStatusName',width:120},
  {title:'工时',dataIndex:'durationSeconds',width:100}, {title:'日志状态',dataIndex:'formStatus',width:90}, {title:'维修内容',dataIndex:'repairDescription',width:240}, {title:'操作',key:'action',width:100,fixed:'right' as const},
];
const personColumns = [{title:'姓名',dataIndex:'name'},{title:'人员类型',dataIndex:'personType'},{title:'角色',dataIndex:'roleName'}];
const outsourceColumns = [{title:'外协单位',dataIndex:'outsourceMemberId'},{title:'实际人数',dataIndex:'headcount'},{title:'总工时（小时）',dataIndex:'workHours'},{title:'备注',dataIndex:'remark'}];
const materialColumns = [{title:'物料名称',dataIndex:'name'},{title:'用量',dataIndex:'quantity'},{title:'说明',dataIndex:'description'}];
const memberName = (id: string) => { const member = props.members.find(m => m.id === id); return member?.unitName || member?.userNameSnapshot || '未提供单位名称'; };
const materials = computed(() => {
  const uses = detail.value?.materialUses || [];
  return (detail.value?.materialItems?.length ? detail.value.materialItems : uses).map((item: Row) => {
    const link = props.materialLinks.find(m => m.id === item.pickLinkId);
    return { name: item.materialName || item.materialNameSnapshot || link?.materialName || link?.materialNameSnapshot || '未提供物料名称', quantity: item.quantity ?? item.usedQuantity, description: item.description ?? item.useDescription };
  });
});
async function loadPage(next = 1) {
  const token = ++generation, id = props.orderId;
  if (!id) return;
  loading.value = true; error.value = ''; page.value = next; records.value = [];
  try { const result = await repairWorkPage(id, next); if (token === generation && id === props.orderId) { records.value = result.records; total.value = result.total; loaded = true; } }
  catch (e) { if (token === generation) { error.value = (e as Error).message; total.value = 0; } }
  finally { if (token === generation) loading.value = false; }
}
function closeRecord() { ++detailGeneration; selected.value = undefined; detail.value = undefined; detailLoading.value = false; }
function openRecord(row: Row) { selected.value = row; void loadRecord(); }
async function loadRecord() {
  const recordId = String(selected.value?.recordId || selected.value?.id || ''), id = props.orderId, token = ++detailGeneration;
  if (!recordId || !id) return;
  detail.value = undefined; detailLoading.value = true; detailError.value = '';
  try { const result = await repairWorkDetail(id, recordId); if (token === detailGeneration && id === props.orderId) detail.value = result; }
  catch (e) { if (token === detailGeneration) detailError.value = (e as Error).message; }
  finally { if (token === detailGeneration) detailLoading.value = false; }
}
watch(() => props.orderId, () => { ++generation; closeRecord(); records.value = []; total.value = 0; page.value = 1; error.value = ''; loading.value = false; loaded = false; });
watch(() => [props.active, props.orderId], () => { if (props.active && props.orderId && !loaded && !loading.value) void loadPage(1); }, { immediate: true });
onBeforeUnmount(() => { ++generation; ++detailGeneration; });
</script>
<style scoped>
.work-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
h3 { margin: 20px 0 12px; font-size: 15px; font-weight: 600; }
.work-toolbar h3 { margin: 0; }
.work-summary { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
:deep(.ant-pagination) { margin-top: 16px; }
:deep(.ant-descriptions-item-content) { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
