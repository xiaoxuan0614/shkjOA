<template>
  <BasicModal v-bind="$attrs" @register="registerModal" destroyOnClose :title="title" :width="560" @ok="handleSubmit">
    <BasicForm @register="registerForm" name="VehicleForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { formSchema } from './Vehicle.data';
  import { queryById, saveOrUpdate } from './Vehicle.api';
  const ready = ref(false);
  const submitting = ref(false);
  let loadSequence = 0;

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
    const sequence = ++loadSequence;
    ready.value = false;
    await resetFields();
    setModalProps({
      confirmLoading: false,
      showCancelBtn: !!data?.showFooter,
      showOkBtn: !!data?.showFooter,
    });
    isUpdate.value = !!data?.isUpdate;
    isDetail.value = !!data?.showFooter;
    setProps({ disabled: true });
    setModalProps({ loading: true });
    try {
      const values = data?.isUpdate ? await queryById({ vehicleId: data.record.vehicleId }) : {};
      if (sequence !== loadSequence) return;
      if (!values || (data?.isUpdate && values.vehicleId == null)) throw new Error('车辆详情为空');
      await setFieldsValue(values);
      ready.value = true;
      setProps({ disabled: !data?.showFooter });
    } catch {
      // 不允许详情加载失败后用空表单覆盖已有车辆。
      if (sequence === loadSequence) closeModal();
    } finally {
      if (sequence === loadSequence) setModalProps({ loading: false });
    }
  });

  // 提交
  async function handleSubmit() {
    if (!ready.value || submitting.value) return;
    submitting.value = true;
    try {
      const values = await validate();
      setModalProps({ confirmLoading: true });
      await saveOrUpdate(values, isUpdate.value);
      closeModal();
      emit('success');
    } catch (error: any) {
      const errorFields = error?.errorFields;
      if (errorFields && errorFields.length) {
        scrollToField(errorFields[0].name, { behavior: 'smooth', block: 'center' });
      }
    } finally {
      submitting.value = false;
      setModalProps({ confirmLoading: false });
    }
  }
</script>
