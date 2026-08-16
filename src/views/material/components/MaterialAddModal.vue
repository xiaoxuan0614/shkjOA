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
        field: 'materialName',
        component: 'Input',
        componentProps: { placeholder: '请输入物料名称' },
        dynamicRules: () => [{ required: true, message: '请输入物料名称!' }],
      },
      {
        label: '类别',
        field: 'materialCategory',
        component: 'JDictSelectTag',
        componentProps: { dictCode: 'material_category', placeholder: '请选择类别' },
        dynamicRules: () => [{ required: true, message: '请选择类别!' }],
      },
      {
        label: '物料编码',
        field: 'materialCode',
        component: 'Input',
        componentProps: { placeholder: '系统自动生成', disabled: true },
        // 编号显示规则：新增时隐藏编号（后端生成），创建后显示只读
        ifShow: () => !!unref(isUpdate),
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
        label: '基准单价',
        field: 'unitPrice',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入基准单位单价', min: 0, precision: 2, style: { width: '100%' } },
      },
      {
        label: '初始库存',
        field: 'stockQty',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入初始库存(基准单位)', min: 0, style: { width: '100%' } },
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
      // 基准单价/初始库存未填默认 0（对齐后端「没写默认就是 0」），保证这两个字段始终随新增请求上送；不传伪造 id（编码/主键由后端生成）
      emit('success', { ...values, unitPrice: values.unitPrice ?? 0, stockQty: values.stockQty ?? 0 });
      closeModal();
    } catch ({ errorFields }) {
      if (errorFields) {
        return Promise.reject(errorFields);
      }
    }
  }
</script>
