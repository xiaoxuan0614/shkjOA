<template>
  <div class="project-apply">
    <!-- 申请信息 -->
    <div class="project-apply__card">
      <div class="project-apply__card-title">基本信息</div>
      <BasicForm @register="registerForm" />
    </div>

    <!-- 底部操作 -->
    <div class="project-apply__footer">
      <a-button type="primary" preIcon="ant-design:save-outlined" @click="handleSave">保存</a-button>
      <a-button @click="handleCancel">取消</a-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { projectFormSchema } from '../Project.data';
  import { addProject, editProject, projectDetail, getCustomerList } from '../Project.api';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();

  // 编辑模式(带 id 时为编辑回显)
  const editId = ref<string | undefined>(route.query?.id as string | undefined);

  // 客户列表(甲方选择带出)
  const customerOptions = ref<any[]>([]);
  let customerMap: Recordable = {};

  // 注册表单
  const [registerForm, { setFieldsValue, validate, updateSchema }] = useForm({
    labelWidth: 120,
    schemas: projectFormSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
    baseRowStyle: { padding: '0 20px' },
  });

  /**
   * 加载客户列表, 注入甲方名称下拉
   */
  async function loadCustomers() {
    const data = await getCustomerList();
    customerOptions.value = data || [];
    customerMap = (data || []).reduce((map, c) => {
      map[c.id] = c;
      return map;
    }, {});
    // 更新甲方名称下拉选项
    await updateSchema({
      field: 'customerId',
      componentProps: {
        options: customerOptions.value.map((c) => ({ label: c.name, value: c.id })),
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

  /**
   * 编辑回显
   */
  async function loadDetail() {
    if (!editId.value) return;
    const data = await projectDetail({ id: editId.value });
    await setFieldsValue({ ...data });
  }

  /**
   * 保存
   */
  async function handleSave() {
    try {
      const values = await validate();
      if (editId.value) {
        await editProject({ ...values, id: editId.value });
      } else {
        await addProject(values);
      }
      createMessage.success('保存成功');
      router.push('/project/list');
    } catch (error) {
      // 校验失败/接口异常
    }
  }

  /**
   * 取消
   */
  function handleCancel() {
    router.push('/project/list');
  }

  onMounted(async () => {
    await loadCustomers();
    if (editId.value) {
      await loadDetail();
    }
  });
</script>

<style lang="less" scoped>
  .project-apply {
    padding: 16px;

    &__card {
      background: #fff;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 16px;

      &-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
        margin-bottom: 16px;
      }
    }

    &__footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 8px 0 24px;
    }
  }
</style>
