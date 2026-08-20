<template>
  <BasicModal
    v-bind="$attrs"
    @register="registerModal"
    destroyOnClose
    :title="title"
    :width="620"
    @ok="handleSubmit"
  >
    <BasicForm @register="registerForm" name="OutsourcingForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { formSchema } from './Outsourcing.data';
  import { saveOrUpdate } from './Outsourcing.api';

  // Emits声明
  const emit = defineEmits(['register', 'success']);

  const isUpdate = ref(false);
  const isDetail = ref(false);
  const title = computed(() => {
    if (!unref(isUpdate)) return '新增外协单位';
    return unref(isDetail) ? '编辑外协单位' : '外协单位详情';
  });

  // 表单配置
  const [registerForm, { setProps, resetFields, setFieldsValue, validate, scrollToField }] = useForm({
    labelWidth: 100,
    schemas: formSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
  });

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
  });

  // 提交
  async function handleSubmit() {
    try {
      const values = await validate();
      setModalProps({ confirmLoading: true });
      await saveOrUpdate(values, isUpdate.value);
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
