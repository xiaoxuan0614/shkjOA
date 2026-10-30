<template>
  <div class="location-toolbar"><p>每个项目至少保留1个位置，最多3个。</p><a-space><a-button :disabled="loading || !rows.length" @click="viewRecord = {}">查看全部位置</a-button><a-button :disabled="loading || busy" @click="load">刷新</a-button><a-button v-if="canEdit" type="primary" :disabled="busy || loading || !!error || rows.length >= 3" @click="edit()">新增位置</a-button></a-space></div>
  <a-alert v-if="error" type="error" show-icon :message="error" />
  <a-table :columns="columns" :data-source="rows" row-key="id" :loading="loading" :pagination="false" size="small" bordered :scroll="{ x: 900 }">
    <template #bodyCell="{ column, record }"><a-space v-if="column.key === 'action'"><a-button type="link" :disabled="busy" @click="viewRecord = { ...record }">查看</a-button><a-button v-if="canEdit" type="link" :disabled="busy" @click="edit(record)">修改</a-button><a-button v-if="canEdit" type="link" danger :disabled="busy || rows.length <= 1" @click="remove = record; reason = ''; formError = ''">删除</a-button></a-space><template v-else>{{ record[column.dataIndex] ?? '—' }}</template></template>
  </a-table>
  <LocationViewModal :open="!!viewRecord" :records="rows" :selected-id="viewRecord?.id" @update:open="open => { if (!open) viewRecord = undefined; }" />
  <a-modal :open="!!draft" :title="draft?.id ? '修改位置' : '新增位置'" :width="720" destroy-on-close :confirm-loading="busy" :closable="!busy" :mask-closable="false" :cancel-button-props="{ disabled: busy }" @cancel="draft = undefined" @ok="save">
    <a-alert v-if="formError" type="error" :message="formError" />
    <AMapLocationMap v-if="draft" :key="draft.id || 'new'" :lng="mapLng" :lat="mapLat" :address="mapAddress" :disabled="busy" :auto-locate="false" height="320px" class="location-map" @select="onSelectLocation" />
    <a-form v-if="draft" layout="vertical" :disabled="busy">
      <a-form-item label="位置名称" required><a-input v-model:value="draft.locationName" :maxlength="128" /></a-form-item>
      <p>经纬度填写完整后，停止输入片刻即可自动定位地图，无需补0。</p>
      <a-form-item label="经度"><a-input v-model:value="draft.longitude" @blur="syncCoordinates" @press-enter="syncCoordinates" placeholder="-180 至 180" :maxlength="32" /></a-form-item>
      <a-form-item label="纬度"><a-input v-model:value="draft.latitude" @blur="syncCoordinates" @press-enter="syncCoordinates" placeholder="-90 至 90" :maxlength="32" /></a-form-item>
      <a-form-item label="位置说明"><a-textarea v-model:value="draft.description" :maxlength="255" /></a-form-item>
    </a-form>
  </a-modal>
  <a-modal :open="!!remove" title="删除位置" :confirm-loading="busy" :closable="!busy" :mask-closable="false" :cancel-button-props="{ disabled: busy }" @cancel="remove = undefined" @ok="deleteLocation">
    <p>删除“{{ remove?.locationName }}”？历史记录仍保留。</p><a-textarea v-model:value="reason" placeholder="请填写删除原因" :maxlength="2000" :disabled="busy" /><a-alert v-if="formError" type="error" :message="formError" />
  </a-modal>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { message } from 'ant-design-vue';
import LocationViewModal from '/@/components/jeecg/LocationViewModal.vue';
import AMapLocationMap from '/@/components/jeecg/AMapLocationMap.vue';
import type { AmapPoi } from '/@/components/jeecg/AMapPlaceSearch.vue';
import { locations, request, type Row } from './maintenance.api';
import { locationPayload } from './maintenance.model';
const props = defineProps<{ archiveId:string; canEdit:boolean }>();
const rows=ref<Row[]>([]), loading=ref(false), busy=ref(false), error=ref(''), formError=ref(''), draft=ref<Row>(), remove=ref<Row>(), reason=ref('');
const viewRecord=ref<Row>();
const mapLng=ref<number|null>(null), mapLat=ref<number|null>(null), mapAddress=ref('');
function coordinate(value: unknown): number | null {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
const pendingCoordinateInput = ref(false);
watch(() => [draft.value?.longitude, draft.value?.latitude, !!draft.value], (_value, _oldValue, onCleanup) => {
  pendingCoordinateInput.value = !!draft.value && (coordinate(draft.value?.longitude) !== mapLng.value || coordinate(draft.value?.latitude) !== mapLat.value);
  if (!pendingCoordinateInput.value) return;
  const timer = setTimeout(syncCoordinates, 600);
  onCleanup(() => clearTimeout(timer));
});

function syncCoordinates() {
  if (!draft.value || busy.value || !props.canEdit) return;
  const nextLng=coordinate(draft.value.longitude), nextLat=coordinate(draft.value.latitude);
  if(nextLng == null || nextLat == null || Math.abs(nextLng)>180 || Math.abs(nextLat)>90){pendingCoordinateInput.value=false;return;}
  if(nextLng===mapLng.value && nextLat===mapLat.value)return;
  pendingCoordinateInput.value=false;
  mapAddress.value='';
  mapLng.value=nextLng;
  mapLat.value=nextLat;
}

function onSelectLocation(poi: AmapPoi | null) {
  if (pendingCoordinateInput.value) return;
  if (!draft.value || busy.value || !props.canEdit) return;
  mapLng.value=poi?.lng ?? null;
  mapLat.value=poi?.lat ?? null;
  mapAddress.value=poi?.address || poi?.name || '';
  draft.value.longitude = poi?.lng == null ? '' : String(poi.lng);
  draft.value.latitude = poi?.lat == null ? '' : String(poi.lat);
  if (poi) {
    draft.value.locationName = poi.name || poi.address || '';
    draft.value.description = poi.address || '';
  }
}
let generation=0;
const columns=[{title:'位置名称',dataIndex:'locationName',width:180},{title:'经度',dataIndex:'longitude',width:150},{title:'纬度',dataIndex:'latitude',width:150},{title:'说明',dataIndex:'description',width:240},{title:'操作',key:'action',width:200}];
async function load(){const seq=++generation;loading.value=true;error.value='';rows.value=[];try{const result=await locations(props.archiveId);if(seq===generation)rows.value=result;}catch(e){if(seq===generation)error.value=(e as Error).message;}finally{if(seq===generation)loading.value=false;}}
function edit(row?:Row){if(!props.canEdit)return;if(!row && (loading.value || error.value || rows.value.length>=3)){message.warning('每个项目最多3个位置，请核对列表');return;}formError.value='';mapLng.value=coordinate(row?.longitude);mapLat.value=coordinate(row?.latitude);mapAddress.value=row?.locationName||'';draft.value=row?{...row,reason:''}:{locationName:'',longitude:'',latitude:'',description:'',sortNo:0,reason:''};}
async function save(){if(busy.value || !props.canEdit || !draft.value)return;formError.value='';try{const payload=locationPayload(props.archiveId,draft.value);busy.value=true;if(!draft.value.id && (await locations(props.archiveId)).length>=3)throw new Error('每个项目最多3个位置，请刷新列表');await request('location/save',payload,true);draft.value=undefined;message.success('位置已保存');await load();}catch(e){formError.value=(e as Error).message;}finally{busy.value=false;}}
async function deleteLocation(){if(busy.value || !props.canEdit || !remove.value)return;if(!reason.value.trim()){formError.value='请填写删除原因';return;}busy.value=true;try{if((await locations(props.archiveId)).length<=1)throw new Error('每个项目至少保留1个位置，不能删除最后一个');await request('location/delete',{archiveId:props.archiveId,id:remove.value.id,reason:reason.value.trim()},true);remove.value=undefined;message.success('位置已删除');await load();}catch(e){formError.value=(e as Error).message;}finally{busy.value=false;}}
watch(()=>props.archiveId,()=>{draft.value=undefined;remove.value=undefined;viewRecord.value=undefined;void load();},{immediate:true});
onBeforeUnmount(()=>{++generation;});
</script>
<style scoped>.location-map{margin-bottom:16px}.location-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.location-toolbar p{margin:0;color:var(--text-color-secondary,#595959)}:deep(.ant-alert){margin-bottom:12px}</style>
