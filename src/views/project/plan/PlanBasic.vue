<template>
  <div class="plan-basic">
    <BasicForm @register="registerForm" />
  </div>
</template>

<script lang="ts" setup>
  import { onMounted } from 'vue';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { projectFormSchema } from '../Project.data';
  import { getCustomerList } from '../Project.api';

  // 属性: editable 控制是否可编辑(新增后可编辑, 保存后仅基本信息可改)
  const props = defineProps<{
    editable?: boolean;
    record?: Recordable;
  }>();

  // 客户映射
  let customerMap: Recordable = {};

  // 表单配置
  const [registerForm, { setProps, setFieldsValue, getFieldsValue, validate, updateSchema }] = useForm({
    labelWidth: 120,
    schemas: projectFormSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
    baseRowStyle: { padding: '0 20px' },
  });

  // 暴露给父级: 校验 + 取值
  defineExpose({
    async getData() {
      await validate();
      return getFieldsValue();
    },
  });

  /**
   * 加载客户列表, 注入甲方名称下拉
   */
  async function loadCustomers() {
    const data = await getCustomerList();
    customerMap = (data || []).reduce((map, c) => {
      map[c.id] = c;
      return map;
    }, {});
    await updateSchema({
      field: 'customerId',
      componentProps: {
        options: (data || []).map((c) => ({ label: c.name, value: c.id })),
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: '请选择客户',
        onChange: handleCustomerChange,
      },
    });
  }

  /**
   * 选客户后带出联系人/电话/甲方信息
   */
  async function handleCustomerChange(id: any) {
    const c = customerMap[id];
    if (!c) return;
    await setFieldsValue({
      contact: c.contact,
      phone: c.phone,
      customerInfo: c.info,
    });
  }

  onMounted(async () => {
    await loadCustomers();
    // 根据权限设置禁用
    await setProps({ disabled: !props.editable });
    if (props.record) {
      await setFieldsValue({ ...props.record });
    }
  });
</script>
