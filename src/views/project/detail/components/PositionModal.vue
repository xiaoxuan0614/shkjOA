<template>
  <a-modal
    :open="open"
    :title="record ? '编辑位置' : '添加位置'"
    :width="720"
    :confirm-loading="saving"
    :mask-closable="!saving"
    :closable="!saving"
    :cancel-button-props="{ disabled: saving }"
    destroy-on-close
    @cancel="close"
    @ok="handleSubmit"
  >
    <AMapLocationMap
      v-if="open"
      :lng="mapLng"
      :lat="mapLat"
      :address="mapAddress"
      :auto-locate="!record"
      height="320px"
      style="margin-bottom: 16px"
      @select="onSelectLocation"
    />
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="经度" name="longitude"><a-input v-model:value="form.longitude" placeholder="自动填充" /></a-form-item>
      <a-form-item label="纬度" name="latitude"><a-input v-model:value="form.latitude" placeholder="自动填充" /></a-form-item>
      <a-form-item label="实施位置" name="locationName"><a-input v-model:value="form.locationName" placeholder="自动填充" /></a-form-item>
      <a-form-item label="位置描述" name="description"
        ><a-textarea v-model:value="form.description" placeholder="请输入位置描述" :rows="3"
      /></a-form-item>
    </a-form>
  </a-modal>
</template>

<script lang="ts" setup>
  import { reactive, ref, watch } from 'vue';
  import { message } from 'ant-design-vue';
  import AMapLocationMap from '/@/components/jeecg/AMapLocationMap.vue';
  import type { AmapPoi } from '/@/components/jeecg/AMapPlaceSearch.vue';
  import { addPosition, editPosition } from '../ProjectDetail.api';

  interface PositionRecord {
    id?: string;
    longitude?: string | number | null;
    latitude?: string | number | null;
    locationName?: string | null;
    description?: string | null;
  }
  const props = defineProps<{ open: boolean; projectId: string; record?: PositionRecord | null }>();
  const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'success'): void }>();
  const formRef = ref<{ validate: () => Promise<unknown> }>();
  const form = reactive({ longitude: '', latitude: '', locationName: '', description: '' });
  const rules = {
    longitude: [{ required: true, message: '请输入经度' }],
    latitude: [{ required: true, message: '请输入纬度' }],
    locationName: [{ required: true, message: '请输入实施位置' }],
  };
  const mapLng = ref<number | null>(null);
  const mapLat = ref<number | null>(null);
  const mapAddress = ref('');
  const saving = ref(false);

  function coordinate(raw: unknown): number | null {
    if (raw == null || String(raw).trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  watch(
    () => props.open,
    (open) => {
      if (!open) return;
      const record = props.record;
      form.longitude = record?.longitude == null ? '' : String(record.longitude);
      form.latitude = record?.latitude == null ? '' : String(record.latitude);
      form.locationName = record?.locationName || '';
      form.description = record?.description || '';
      mapLng.value = coordinate(record?.longitude);
      mapLat.value = coordinate(record?.latitude);
      mapAddress.value = record?.locationName || '';
    },
    { immediate: true }
  );

  function onSelectLocation(poi: AmapPoi | null) {
    if (!props.open) return;
    form.longitude = poi?.lng == null ? '' : String(poi.lng);
    form.latitude = poi?.lat == null ? '' : String(poi.lat);
    form.locationName = poi?.name || poi?.address || '';
    form.description = poi?.address || '';
  }

  function close() {
    if (!saving.value) emit('update:open', false);
  }

  async function handleSubmit() {
    if (saving.value) return;
    if (!formRef.value) return;
    try {
      await formRef.value.validate();
    } catch {
      return;
    }
    const lng = coordinate(form.longitude);
    const lat = coordinate(form.latitude);
    if (lng == null || lat == null || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      message.error('请输入有效的经纬度');
      return;
    }
    saving.value = true;
    try {
      const payload = { periodId: props.projectId, ...form, ...(props.record?.id ? { id: props.record.id } : {}) };
      if (props.record) await editPosition(payload);
      else await addPosition(payload);
      message.success(props.record ? '编辑成功' : '新增成功');
      emit('update:open', false);
      emit('success');
    } catch (error) {
      message.error((error as Error)?.message || '保存位置失败，请重试');
    } finally {
      saving.value = false;
    }
  }
</script>
