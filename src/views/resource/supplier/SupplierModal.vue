<template>
  <BasicModal
    v-bind="$attrs"
    @register="registerModal"
    destroyOnClose
    :title="title"
    :width="620"
    @ok="handleSubmit"
  >
    <BasicForm @register="registerForm" name="SupplierForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { formSchema } from './Supplier.data';
  import { saveOrUpdate } from './Supplier.api';
  import { loadUserOptions } from '../userOptions';
  import { useFuzzySelect } from '/@/utils/fuzzySelect';

  // Emits声明
  const emit = defineEmits(['register', 'success']);

  const isUpdate = ref(false);
  const isDetail = ref(false);
  const title = computed(() => {
    if (!unref(isUpdate)) return '新增供应商';
    return unref(isDetail) ? '编辑供应商' : '供应商详情';
  });

  // 对接人下拉：初次点击不展示，输入后模糊过滤(下拉统一)
  const liaison = useFuzzySelect();

  // 表单配置
  const [registerForm, { setProps, resetFields, setFieldsValue, validate, scrollToField, updateSchema }] = useForm({
    labelWidth: 100,
    schemas: formSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
  });

  /**
   * 加载全量用户到过滤池，注入对接人选择器(onSearch 输入后模糊)，选中后自动带出姓名
   * 编号显示规则：新增时隐藏，编辑/详情显示(只读)
   */
  async function loadUserSelects(record?: any) {
    liaison.setAll(await loadUserOptions());
    await updateSchema([
      { field: 'supplierNo', ifShow: () => !!isUpdate.value },
      {
        field: 'liaisonUserId',
        componentProps: {
          options: liaison.options,
          onSearch: liaison.onSearch,
          onSelect: (_v: any, o: any) => setFieldsValue({ liaisonUserName: o?.label || '' }),
        },
      },
    ]);
    // 编辑回显：把当前对接人选项塞回，保证显示姓名
    if (record?.liaisonUserId) liaison.preselect(record.liaisonUserId);
  }

  /** 供应商编号由后端生成，新增时留空；提交时若为空则不传(后端生成) */
  // 弹窗打开时赋值
  const [registerModal, { setModalProps, closeModal }] = useModalInner(async (data) => {
    await resetFields();
    setModalProps({
      confirmLoading: false,
      showCancelBtn: !!data?.showFooter,
      showOkBtn: !!data?.showFooter,
    });
    isUpdate.value = !!data?.isUpdate;
    // showFooter=false 表示只读详情
    isDetail.value = !!data?.showFooter;
    if (data?.record) {
      await setFieldsValue({ ...data.record });
    }
    // 详情模式下禁用整个表单
    setProps({ disabled: !data?.showFooter });
    await loadUserSelects(data?.record);
  });

  // 提交
  async function handleSubmit() {
    try {
      const values = await validate();
      setModalProps({ confirmLoading: true });
      const payload = { ...values };
      // 编号后端生成：为空则不传
      if (!payload.supplierNo) delete payload.supplierNo;
      await saveOrUpdate(payload, isUpdate.value);
      closeModal();
      emit('success');
    } catch ({ errorFields }) {
      if (errorFields && errorFields.length) {
        scrollToField(errorFields[0].name, { behavior: 'smooth', block: 'center' });
      }
      return Promise.reject(errorFields);
    } finally {
      setModalProps({ confirmLoading: false });
    }
  }
</script>

<style lang="less" scoped>
  :deep(.ant-input-number) {
    width: 100%;
  }
</style>
