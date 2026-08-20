<template>
  <BasicModal v-bind="$attrs" @register="register" destroyOnClose :title="title" :width="720" @ok="handleSubmit">
    <!-- 地图选点: 拖动地图中心 pin 自动填充下方字段 -->
    <AMapLocationMap
      :lng="recordLng"
      :lat="recordLat"
      :address="recordAddress"
      height="320px"
      style="margin-bottom: 16px"
      @select="onSelectLocation"
    />
    <BasicForm @register="registerForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import AMapLocationMap from '/@/components/jeecg/AMapLocationMap.vue';
  import { AmapPoi } from '/@/components/jeecg/AMapPlaceSearch.vue';
  import { addPosition, editPosition } from '../ProjectDetail.api';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const isUpdate = ref(false);
  const periodId = ref('');
  const title = computed(() => (unref(isUpdate) ? '编辑位置' : '添加位置'));

  // 地图回显: 打开弹窗时把已有经纬度/位置传给地图
  const recordLng = ref<number | null>(null);
  const recordLat = ref<number | null>(null);
  const recordAddress = ref('');

  // 字段对齐后端 project_location: longitude/latitude/locationName/description
  const [registerForm, { resetFields, setFieldsValue, validate }] = useForm({
    labelWidth: 100,
    showActionButtonGroup: false,
    baseColProps: { span: 24 },
    schemas: [
      {
        label: '经度',
        field: 'longitude',
        component: 'Input',
        componentProps: { placeholder: '自动填充' },
        dynamicRules: () => [{ required: true, message: '请输入经度!' }],
      },
      {
        label: '纬度',
        field: 'latitude',
        component: 'Input',
        componentProps: { placeholder: '自动填充' },
        dynamicRules: () => [{ required: true, message: '请输入纬度!' }],
      },
      {
        label: '实施位置',
        field: 'locationName',
        component: 'Input',
        componentProps: { placeholder: '自动填充' },
        dynamicRules: () => [{ required: true, message: '请输入实施位置!' }],
      },
      {
        label: '位置描述',
        field: 'description',
        component: 'InputTextArea',
        componentProps: { placeholder: '请输入位置描述', rows: 3 },
      },
    ],
  });

  const [register, { closeModal }] = useModalInner(async (data) => {
    await resetFields();
    isUpdate.value = !!data?.isUpdate;
    periodId.value = data?.projectId || '';
    if (data?.record) {
      recordLng.value = data.record.longitude ?? null;
      recordLat.value = data.record.latitude ?? null;
      recordAddress.value = data.record.locationName || '';
      await setFieldsValue({ ...data.record });
    } else {
      recordLng.value = null;
      recordLat.value = null;
      recordAddress.value = '';
    }
  });

  /**
   * 地图选点后自动填充位置名/经纬度/描述
   */
  async function onSelectLocation(poi: AmapPoi | null) {
    await setFieldsValue(
      poi
        ? { locationName: poi.name || poi.address, longitude: poi.lng, latitude: poi.lat, description: poi.address }
        : { locationName: '', longitude: undefined, latitude: undefined, description: '' }
    );
  }

  async function handleSubmit() {
    try {
      const values = await validate();
      const payload = { ...values, periodId: periodId.value };
      if (isUpdate.value) {
        await editPosition(payload);
        createMessage.success('编辑成功');
      } else {
        await addPosition(payload);
        createMessage.success('新增成功');
      }
      closeModal();
      emit('success');
    } catch ({ errorFields }) {
      if (errorFields) {
        return Promise.reject(errorFields);
      }
    }
  }
</script>
