<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    destroyOnClose
    title="添加用料申请"
    :width="560"
    @ok="handleSubmit"
  >
    <BasicForm @register="registerForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  // 表单: 物料类别/物料名称/品牌/型号/库存/申请数量/单位/快递单号
  const [registerForm, { resetFields, validate }] = useForm({
    labelWidth: 100,
    showActionButtonGroup: false,
    baseColProps: { span: 24 },
    schemas: [
      {
        label: '物料类别',
        field: 'category',
        component: 'Input',
        componentProps: { placeholder: '请输入物料类别' },
        dynamicRules: () => [{ required: true, message: '请输入物料类别!' }],
      },
      {
        label: '物料名称',
        field: 'name',
        component: 'Input',
        componentProps: { placeholder: '请输入物料名称' },
        dynamicRules: () => [{ required: true, message: '请输入物料名称!' }],
      },
      {
        label: '品牌',
        field: 'brand',
        component: 'Input',
        componentProps: { placeholder: '请输入品牌' },
      },
      {
        label: '型号',
        field: 'model',
        component: 'Input',
        componentProps: { placeholder: '请输入型号' },
      },
      {
        label: '申请数量',
        field: 'applyQty',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入申请数量', min: 1, style: { width: '100%' } },
        dynamicRules: () => [{ required: true, message: '请输入申请数量!' }],
      },
      {
        label: '单位',
        field: 'unit',
        component: 'Select',
        componentProps: {
          options: [
            { label: '个', value: '个' },
            { label: '台', value: '台' },
            { label: '米', value: '米' },
            { label: '根', value: '根' },
          ],
          placeholder: '请选择单位',
        },
        dynamicRules: () => [{ required: true, message: '请选择单位!' }],
      },
      {
        label: '快递单号',
        field: 'expressNo',
        component: 'Input',
        componentProps: { placeholder: '请输入快递单号' },
      },
    ],
  });

  const [register, { closeModal }] = useModalInner(async () => {
    await resetFields();
  });

  async function handleSubmit() {
    try {
      const values = await validate();
      createMessage.success('申请提交成功(演示)');
      closeModal();
      emit('success');
    } catch ({ errorFields }) {
      if (errorFields) {
        return Promise.reject(errorFields);
      }
    }
  }
</script>
