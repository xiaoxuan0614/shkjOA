<template>
  <BasicModal v-bind="$attrs" @register="register" destroyOnClose :title="title" :width="560" @ok="handleSubmit">
    <BasicForm @register="registerForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const isUpdate = ref(false);
  const title = computed(() => (unref(isUpdate) ? '编辑位置' : '添加位置'));

  // 设计稿字段: 经度* / 纬度* / 实施位置* / 位置描述
  const [registerForm, { resetFields, setFieldsValue, validate }] = useForm({
    labelWidth: 100,
    showActionButtonGroup: false,
    baseColProps: { span: 24 },
    schemas: [
      {
        label: '经度',
        field: 'lng',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入经度', style: { width: '100%' }, min: -180, max: 180 },
        dynamicRules: () => [{ required: true, message: '请输入经度!' }],
      },
      {
        label: '纬度',
        field: 'lat',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入纬度', style: { width: '100%' }, min: -90, max: 90 },
        dynamicRules: () => [{ required: true, message: '请输入纬度!' }],
      },
      {
        label: '实施位置',
        field: 'name',
        component: 'Input',
        componentProps: { placeholder: '请输入实施位置' },
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
    if (data?.record) {
      await setFieldsValue({ ...data.record });
    }
  });

  async function handleSubmit() {
    try {
      const values = await validate();
      createMessage.success(isUpdate.value ? '编辑成功' : '新增成功');
      closeModal();
      emit('success');
    } catch ({ errorFields }) {
      if (errorFields) {
        return Promise.reject(errorFields);
      }
    }
  }
</script>
