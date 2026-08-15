<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    destroyOnClose
    :title="title"
    :width="560"
    @ok="handleSubmit"
  >
    <BasicForm @register="registerForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';

  // Emits声明
  const emit = defineEmits(['register', 'success']);

  // 标题(新增/编辑)
  const isUpdate = ref(false);
  const title = computed(() => (unref(isUpdate) ? '编辑物料' : '新增物料'));

  // 表单配置
  const [registerForm, { resetFields, setFieldsValue, validate, setProps }] = useForm({
    labelWidth: 100,
    showActionButtonGroup: false,
    baseColProps: { span: 24 },
    schemas: [
      {
        label: '物料名称',
        field: 'goodsName',
        component: 'Input',
        componentProps: { placeholder: '请输入物料名称' },
        dynamicRules: () => [{ required: true, message: '请输入物料名称!' }],
      },
      {
        label: '类别',
        field: 'categoryName',
        component: 'Select',
        componentProps: {
          placeholder: '请选择类别',
          options: [
            { label: '智能闸口', value: '智能闸口' },
            { label: '地磅材料', value: '地磅材料' },
            { label: '材料类', value: '材料类' },
            { label: '其他配件', value: '其他配件' },
          ],
        },
        dynamicRules: () => [{ required: true, message: '请选择类别!' }],
      },
      {
        label: '物料编码',
        field: 'goodsCode',
        component: 'Input',
        componentProps: { placeholder: '请输入物料编码' },
        dynamicRules: () => [{ required: true, message: '请输入物料编码!' }],
      },
      {
        label: '品牌',
        field: 'brand',
        component: 'Input',
        componentProps: { placeholder: '请输入品牌' },
      },
      {
        label: '型号(规格)',
        field: 'model',
        component: 'Input',
        componentProps: { placeholder: '请输入型号(规格)' },
        dynamicRules: () => [{ required: true, message: '请输入型号(规格)!' }],
      },
      {
        label: '库存数量',
        field: 'stock',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入库存数量', min: 0, style: { width: '100%' } },
      },
    ],
  });

  // 赋值
  const [register, { closeModal }] = useModalInner(async (data) => {
    await resetFields();
    isUpdate.value = !!data?.isUpdate;
    setProps({ disabled: !!data?.disabled });
    if (data?.record) {
      await setFieldsValue({ ...data.record });
    }
  });

  // 提交
  async function handleSubmit() {
    try {
      const values = await validate();
      emit('success', { ...values, id: Date.now() });
      closeModal();
    } catch ({ errorFields }) {
      if (errorFields) {
        return Promise.reject(errorFields);
      }
    }
  }
</script>
