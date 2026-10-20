<template>
  <BasicModal title="新增部门" :width="680" v-bind="$attrs" @ok="handleOk" @register="registerModal">
    <a-alert v-if="error" type="error" show-icon :message="error" class="mb-4" />
    <a-form-item label="所属公司">
      <a-input :value="company?.departName || company?.title || '正在读取所属公司'" disabled />
    </a-form-item>
    <BasicForm @register="registerForm" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { saveOrUpdateDepart, readCompanyRoot } from '../depart.api';
  import { useBasicFormSchema } from '../depart.data';
  import { departmentCreateValues } from '../singleCompany';

  const emit = defineEmits(['success', 'register']);
  // 兼容旧调用方传入的树，但绝不从其选中节点推断新部门归属。
  defineProps({ rootTreeData: { type: Array, default: () => [] } });
  const company = ref<any>(null);
  const error = ref('');
  const saving = ref(false);
  let sequence = 0;
  const fields = ['departName', 'departNameAbbr', 'departOrder', 'mobile', 'fax', 'address', 'memo'];
  const schemas = useBasicFormSchema(ref([])).basicFormSchema
    .filter(item => fields.includes(item.field))
    .map(item => item.field === 'departName'
      ? { ...item, label: '部门名称', componentProps: { placeholder: '请输入部门名称' }, rules: [{ required: true, message: '请输入部门名称' }] }
      : item.field === 'departNameAbbr' ? { ...item, label: '部门简称', componentProps: { placeholder: '请输入部门简称' } } : item);
  const [registerForm, { resetFields, setFieldsValue, validate }] = useForm({ schemas, showActionButtonGroup: false });
  const [registerModal, { setModalProps, closeModal }] = useModalInner(async () => {
    const request = ++sequence;
    company.value = null;
    error.value = '';
    setModalProps({ confirmLoading: false, okButtonProps: { disabled: true } });
    await resetFields();
    await setFieldsValue({ departOrder: 0 });
    try {
      const root = await readCompanyRoot();
      if (request !== sequence) return;
      company.value = root;
      setModalProps({ okButtonProps: { disabled: false } });
    } catch (err: any) {
      if (request === sequence) error.value = err?.message || '所属公司加载失败，请关闭后重试';
    }
  });
  async function handleOk() {
    if (saving.value || !company.value) return;
    const request = sequence;
    const companyId = String(company.value.id);
    saving.value = true;
    setModalProps({ confirmLoading: true });
    try {
      const values = await validate();
      const latest = await readCompanyRoot();
      if (request !== sequence || String(latest.id) !== companyId) throw new Error('所属公司已变化，请关闭后重新新增');
      await saveOrUpdateDepart(departmentCreateValues(values, companyId), false);
      closeModal();
      emit('success');
    } catch (err: any) {
      if (err?.message) error.value = err.message;
    } finally {
      saving.value = false;
      setModalProps({ confirmLoading: false });
    }
  }
</script>
