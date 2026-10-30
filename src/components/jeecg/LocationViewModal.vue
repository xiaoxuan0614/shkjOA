<template>
  <a-modal
    :open="open"
    :width="fullscreen ? '100vw' : 760"
    :style="fullscreen ? { top: '0', maxWidth: '100vw', paddingBottom: '0' } : {}"
    :body-style="fullscreen ? { height: 'calc(100dvh - 110px)', overflowY: 'auto' } : {}"
    destroy-on-close
    :mask-closable="false"
    @cancel="close"
  >
    <template #title>
      <div class="location-view-title">
        <span>{{ title }}</span>
        <a-button size="small" :aria-pressed="fullscreen" @click="fullscreen = !fullscreen">{{ fullscreen ? '退出全屏' : '全屏查看' }}</a-button>
      </div>
    </template>
    <template v-if="open">
      <p>共 {{ records.length }} 个位置，{{ points.length }} 个有效锚点<span v-if="records.length > points.length">；{{ records.length - points.length }} 个位置无有效坐标，未显示在地图上</span>。</p>
      <AMapLocationsView v-if="points.length" :points="points" :selected-index="selectedIndex" :height="fullscreen ? 'max(320px, calc(100dvh - 420px))' : '380px'" class="location-view-map" @select="selectedIndex = $event" />
      <a-empty v-else description="当前项目暂无有效位置坐标" class="location-view-map" />
      <a-select v-if="records.length" v-model:value="selectedIndex" :options="records.map((item,index)=>({ value:index,label:`${index+1}. ${item.locationName || '未命名位置'}` }))" aria-label="查看位置详情" class="location-selector" />
      <a-descriptions v-if="selected" bordered :column="1" size="small">
        <a-descriptions-item label="位置名称">{{ selected.locationName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="经度">{{ selected.longitude ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="纬度">{{ selected.latitude ?? '—' }}</a-descriptions-item>
        <a-descriptions-item label="位置说明">{{ selected.description || '—' }}</a-descriptions-item>
      </a-descriptions>
    </template>
    <template #footer><a-button @click="close">关闭</a-button></template>
  </a-modal>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import AMapLocationsView from './AMapLocationsView.vue';

  const props = withDefaults(defineProps<{
    open: boolean;
    title?: string;
    selectedId?: string;
    records: {
      id?: string;
      locationName?: string | null;
      longitude?: string | number | null;
      latitude?: string | number | null;
      description?: string | null;
    }[];
  }>(), { title: '项目位置总览' });
  const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();
  const fullscreen = ref(false);
  const coordinate = (value: unknown) => value == null || String(value).trim() === '' ? null : Number(value);
  const selectedIndex = ref(0);
  const selected = computed(() => props.records[selectedIndex.value]);
  const points = computed(() => props.records.flatMap((record,index) => {
    const lng=coordinate(record.longitude), lat=coordinate(record.latitude);
    return lng != null && lat != null && Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng)<=180 && Math.abs(lat)<=90
      ? [{ index, lng, lat, name:record.locationName || '未命名位置' }] : [];
  }));
  watch(() => [props.open, props.records, props.selectedId], () => {
    fullscreen.value=false;
    const index=props.selectedId ? props.records.findIndex(item=>item.id===props.selectedId) : 0;
    selectedIndex.value=Math.max(0,index);
  }, { immediate:true });
  function close() { emit('update:open', false); }
</script>

<style scoped>
  .location-view-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-right: 32px; }
  .location-selector { width:100%; margin-bottom:12px; }
  .location-view-map { margin-bottom: 16px; }
</style>
