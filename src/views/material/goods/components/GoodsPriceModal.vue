<template>
  <BasicModal v-bind="$attrs" @register="register" title="价格维护" :width="520" @ok="handleSubmit" destroyOnClose>
    <p
      >{{ materialName }}<span v-if="unit">（基准单位：{{ unit }}）</span></p
    >
    <BasicForm @register="registerForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import Big from 'big.js';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm, type FormSchema } from '/@/components/Form';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { MATERIAL_PRICE_PERMISSION, queryById, saveMaterialPrices } from '../Goods.api';

  const emit = defineEmits(['register', 'success']);
  const { hasPermission } = usePermission();
  const { createMessage } = useMessage();
  const materialId = ref('');
  const materialName = ref('');
  const unit = ref('');
  const ready = ref(false);
  const saving = ref(false);
  function formatPrice(value: unknown, info?: { userTyping?: boolean; input?: string }) {
    if (info?.userTyping) return info.input ?? String(value ?? '');
    if (value == null || String(value).trim() === '') return '';
    try { return new Big(String(value)).toFixed(2); } catch { return String(value); }
  }
  function defaultPrice(value: unknown) {
    return formatPrice(value == null || String(value).trim() === '' ? '0' : value);
  }
  function guardNumericInput(event: InputEvent) {
    if (event.data && !/^[\d.]+$/.test(event.data)) event.preventDefault();
  }
  function guardNumericPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') || '';
    if (!/^\d*(\.\d*)?$/.test(text)) event.preventDefault();
  }
  const schemas: FormSchema[] = [
    { label: '成本价', field: 'costPrice', digits: 2, integerDigits: 16 },
    { label: '基准单价', field: 'unitPrice', digits: 2, integerDigits: 16 },
    { label: '指导比例', field: 'guideMarkupRate', digits: 2, integerDigits: 14 },
  ].map(({ digits, integerDigits, ...field }) => ({
    ...field,
    component: 'InputNumber',
    componentProps: {
      min: 0,
      precision: digits,
      stringMode: true,
      formatter: formatPrice,
      inputmode: 'decimal',
      addonAfter: field.field === 'guideMarkupRate' ? '%' : undefined,
      onBeforeinput: guardNumericInput,
      onPaste: guardNumericPaste,
      style: { width: '100%' },
    },
    helpMessage:
      field.field === 'unitPrice'
        ? '留空不修改，填写 0 可保存为零。'
        : '未维护时默认 0.00，保留两位小数；手动清空不修改原值。',
    rules: [
      {
        validator: async (_rule, value) => {
          if (value == null || value === '') return;
          if (!new RegExp(`^\\d{1,${integerDigits}}(\\.\\d{1,${digits}})?$`).test(String(value)))
            throw new Error(`请输入非负数，最多 ${integerDigits} 位整数和 ${digits} 位小数`);
        },
      },
    ],
  }));
  const [registerForm, { resetFields, setFieldsValue, validate, setProps }] = useForm({
    schemas,
    labelWidth: 100,
    baseColProps: { span: 24 },
    showActionButtonGroup: false,
  });
  const [register, { closeModal, setModalProps }] = useModalInner(async (data) => {
    ready.value = false;
    materialId.value = '';
    materialName.value = '';
    unit.value = '';
    await resetFields();
    setProps({ disabled: true });
    setModalProps({ confirmLoading: false, okButtonProps: { disabled: true } });
    if (!hasPermission(MATERIAL_PRICE_PERMISSION)) {
      createMessage.warning('无价格维护权限');
      closeModal();
      return;
    }
    try {
      if (!data?.id) throw new Error('缺少物料 ID');
      const detail = await queryById({ id: data.id });
      materialId.value = String(detail.id || data.id);
      materialName.value = detail.materialName || '';
      unit.value = detail.unit || '';
      await setFieldsValue({ costPrice: defaultPrice(detail.costPrice), unitPrice: detail.unitPrice, guideMarkupRate: defaultPrice(detail.guideMarkupRate) });
      ready.value = true;
      setProps({ disabled: false });
      setModalProps({ okButtonProps: { disabled: false } });
    } catch (error: any) {
      createMessage.error(error?.message || '价格加载失败，请关闭后重试');
    }
  });
  async function handleSubmit() {
    if (!ready.value || saving.value) return;
    if (!hasPermission(MATERIAL_PRICE_PERMISSION)) {
      createMessage.warning('无价格维护权限');
      return;
    }
    try {
      const values = await validate();
      const prices = Object.fromEntries(Object.entries(values).filter(([, value]) => value != null && value !== ''));
      if (!Object.keys(prices).length) {
        createMessage.warning('请至少填写一项价格信息');
        return;
      }
      saving.value = true;
      setModalProps({ confirmLoading: true });
      await saveMaterialPrices({ ...prices, id: materialId.value });
      createMessage.success('价格已保存');
      emit('success');
      closeModal();
    } catch (error: any) {
      if (!error?.errorFields) createMessage.error(error?.message || '价格保存失败，请重试');
    } finally {
      saving.value = false;
      setModalProps({ confirmLoading: false });
    }
  }
</script>
