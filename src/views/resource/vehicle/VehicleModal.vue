<template>
  <BasicModal
    v-bind="$attrs"
    @register="registerModal"
    destroyOnClose
    :title="title"
    :width="560"
    @ok="handleSubmit"
  >
    <BasicForm @register="registerForm" name="VehicleForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { formSchema } from './Vehicle.data';
  import { saveOrUpdate } from './Vehicle.api';

  // Emits声明
  const emit = defineEmits(['register', 'success']);

  const isUpdate = ref(false);
  const isDetail = ref(false);
  const title = computed(() => {
    if (!unref(isUpdate)) return '新增车辆';
    return unref(isDetail) ? '编辑车辆' : '车辆详情';
  });

  // 表单配置
  const [registerForm, { setProps, resetFields, setFieldsValue, validate, scrollToField }] = useForm({
    labelWidth: 100,
    schemas: formSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 24 },
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
