<template>
  <BasicModal v-bind="$attrs" @register="register" destroyOnClose title="添加回款" :width="560" @ok="handleSubmit">
    <BasicForm @register="registerForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { loadPaybackTypeOptions } from './Payment.data';
  import { savePayback } from './Payment.api';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  // 墨刀添加回款字段: 回款类型*/回款金额*/回款日期*/计划回款金额*/已回款金额*/开票金额/发票号/回款说明/附件
  const [registerForm, { resetFields, validate }] = useForm({
    labelWidth: 110,
    showActionButtonGroup: false,
    baseColProps: { span: 24 },
    schemas: [
      {
        label: '回款类型',
        field: 'type',
        component: 'ApiSelect',
        componentProps: { api: loadPaybackTypeOptions, placeholder: '请选择回款类型' },
        dynamicRules: () => [{ required: true, message: '请选择回款类型!' }],
      },
      {
        label: '回款金额',
        field: 'amount',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入回款金额', min: 0, style: { width: '100%' } },
        dynamicRules: () => [{ required: true, message: '请输入回款金额!' }],
      },
      {
        label: '回款日期',
        field: 'payDate',
        component: 'DatePicker',
        componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择回款日期' },
        dynamicRules: () => [{ required: true, message: '请选择回款日期!' }],
      },
      {
        label: '计划回款金额',
        field: 'planAmount',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入计划回款金额', min: 0, style: { width: '100%' } },
      },
      {
        label: '已回款金额',
        field: 'paidAmount',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入已回款金额', min: 0, style: { width: '100%' } },
      },
      {
        label: '开票金额',
        field: 'invoiceAmount',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入开票金额', min: 0, style: { width: '100%' } },
      },
      {
        label: '发票号',
        field: 'invoiceNo',
        component: 'Input',
        componentProps: { placeholder: '请输入发票号' },
      },
      {
        label: '回款说明',
        field: 'remark',
        component: 'InputTextArea',
        componentProps: { placeholder: '请输入回款说明', rows: 3 },
      },
    ],
  });

  const [register, { closeModal }] = useModalInner(async () => {
    await resetFields();
  });

  async function handleSubmit() {
    try {
      const values = await validate();
      await savePayback(values);
      createMessage.success('添加回款成功');
      closeModal();
      emit('success');
    } catch ({ errorFields }) {
      if (errorFields) {
        return Promise.reject(errorFields);
      }
    }
  }
</script>
