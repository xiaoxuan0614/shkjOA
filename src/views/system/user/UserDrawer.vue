<template>
  <BasicDrawer
    v-bind="$attrs"
    @register="registerDrawer"
    :title="getTitle"
    :width="adaptiveWidth"
    @ok="handleSubmit"
    :showFooter="showFooter"
    destroyOnClose
  >
    <BasicForm @register="registerForm" />
    <a-button type="link" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen">
      {{ advancedOpen ? '收起更多设置' : '更多设置（岗位、个人资料等）' }}
    </a-button>
  </BasicDrawer>
</template>
<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { formSchema } from './user.data';
  import { userResponsibleDepartments, userDepartmentIds } from './userDepartment';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { saveOrUpdateUser, getUserRoles, getUserDepartList, getAllRolesListNoByTenant } from './user.api';
  import { useDrawerAdaptiveWidth } from '/@/hooks/jeecg/useAdaptiveWidth';
  import { loadUserDrawerRecord } from './userDrawerLoader';
  import { advancedUserFields, mergeUserFormValues } from './userFormSections';
  import { useMessage } from '/@/hooks/web/useMessage';

  // 声明Emits
  const emit = defineEmits(['success', 'register']);
  const isUpdate = ref(true);
  const ready = ref(false);
  const advancedOpen = ref(false);
  const originalValues = ref<Recordable>({});
  let rolesRequest: Promise<any> | undefined;
  function loadRoleOptions(params) {
    if (!rolesRequest) rolesRequest = getAllRolesListNoByTenant(params).catch((error) => {
      rolesRequest = undefined;
      throw error;
    });
    return rolesRequest;
  }
  const compactSchemas = formSchema.map((schema) => {
    if (!advancedUserFields.has(schema.field)) return schema;
    const originalIfShow = schema.ifShow;
    return { ...schema, ifShow: (context) => advancedOpen.value &&
      (typeof originalIfShow === 'function' ? originalIfShow(context) : originalIfShow !== false) };
  }).sort((a, b) => Number(advancedUserFields.has(a.field)) - Number(advancedUserFields.has(b.field)));
  const { createMessage } = useMessage();
  const departOptions = ref([]);
  let isFormDepartUser = false;
  //表单配置
  const [registerForm, { setProps, resetFields, setFieldsValue, getFieldsValue, validate, updateSchema }] = useForm({
    labelWidth: 90,
    schemas: compactSchemas,
    showActionButtonGroup: false,
  });
  // TODO [VUEN-527] https://www.teambition.com/task/6239beb894b358003fe93626
  const showFooter = ref(true);
  //表单赋值
  const [registerDrawer, { setDrawerProps, closeDrawer }] = useDrawerInner(async (data) => {
    ready.value = false;
    advancedOpen.value = false;
    originalValues.value = {};
    rolesRequest = undefined;
    data = { ...data, record: { ...data?.record } };
    await resetFields();
    showFooter.value = data?.showFooter ?? true;
    setDrawerProps({ confirmLoading: false, showFooter: showFooter.value });
    isUpdate.value = !!data?.isUpdate;
    if (unref(isUpdate)) {
      try {
        const loaded = await loadUserDrawerRecord(data.record, getUserRoles, getUserDepartList);
        data.record = loaded.record;
        departOptions.value = loaded.options;
      } catch {
        createMessage.error('用户关联信息加载失败，请关闭后重试，暂不可保存');
        setProps({ disabled: true });
        return;
      }
    } else {
      departOptions.value = [];
    }
    //处理角色用户列表情况(和角色列表有关系)
    data.selectedroles && (await setFieldsValue({ selectedroles: data.selectedroles }));
    // -update-begin--author:liaozhiyang---date:20240702---for：【TV360X-1737】部门用户编辑接口，增加参数updateFromPage:"deptUsers"
    isFormDepartUser = data?.departDisabled === true ? true : false;
    // -update-end--author:liaozhiyang---date:20240702---for：【TV360X-1737】部门用户编辑接口，增加参数updateFromPage:"deptUsers"
    //编辑时隐藏密码/角色列表隐藏角色信息/我的部门时隐藏所属部门
    await updateSchema([
      {
        field: 'password',
        // 【QQYUN-8324】
        ifShow: !unref(isUpdate),
      },
      {
        field: 'confirmPassword',
        ifShow: !unref(isUpdate),
      },
      {
        field: 'departIds',
        componentProps: { options: departOptions },
      },
      {
        field: 'selecteddeparts',
        show: !data?.departDisabled,
      },
      {
        field: 'selectedroles',
        show: !data.isRole && !data?.departDisabled,
        componentProps:{
          api: loadRoleOptions
        }
      },
    ]);
    // 无论新增还是编辑，都可以设置表单值
    if (typeof data.record === 'object') {
      originalValues.value = { ...data.record };
      await setFieldsValue({
        ...data.record,
      });
    }
    // 隐藏底部时禁用整个表单
    // 代码逻辑说明: VUEN-1117【issue】0523周开源问题
    setProps({ disabled: !showFooter.value });
    if(unref(isUpdate)){
      await updateSchema([
        //修改主岗位和兼职岗位的参数
        {
          field: 'mainDepPostId',
          componentProps: { params: { departIds: data.record.selecteddeparts, parentId: data.record.selecteddeparts } },
        },
        {
          field: 'otherDepPostId',
          componentProps: { params: { departIds: data.record.selecteddeparts, parentId: data.record.selecteddeparts } },
        }
      ]);
    }
    //部门管理，新增用户，在岗位下添加人员的时候默认当前岗位为主岗位
    await updateSchema([
      {
        field: 'mainDepPostId',
        defaultValue: data?.mainDepPostId || '',
      }
    ]);
    ready.value = true;
  });
  //获取标题
  const getTitle = computed(() => {
    // 代码逻辑说明: 【QQYUN-8389】系统用户详情抽屉title更改
    if (!unref(isUpdate)) {
      return '新增用户';
    } else {
      return unref(showFooter) ? '编辑用户' : '用户详情';
    }
  });
  const { adaptiveWidth } = useDrawerAdaptiveWidth();

  //提交事件
  async function handleSubmit() {
    if (!ready.value || !showFooter.value) return;
    try {
      const validated = await validate();
      setDrawerProps({ confirmLoading: true });
      const formValues = getFieldsValue();
      let values = mergeUserFormValues(formSchema, originalValues.value, formValues, validated) as Recordable;
      const selectedDepartments = values.selecteddeparts ?? formValues.selecteddeparts;
      // 隐藏部门选择且无表单值时不猜测清空，避免误删部门关系。
      if (selectedDepartments !== undefined) {
        values.selecteddeparts = userDepartmentIds(selectedDepartments);
      }
      values.departIds = userResponsibleDepartments(values.userIdentity ?? formValues.userIdentity, values.departIds ?? formValues.departIds);
      let isUpdateVal = unref(isUpdate);
      // -update-begin--author:liaozhiyang---date:20240702---for：【TV360X-1737】部门用户编辑接口，增加参数updateFromPage:"deptUsers"
      let params = values;
      if (isFormDepartUser) {
        params = { ...params, updateFromPage: 'deptUsers' };
      }
      // -update-end--author:liaozhiyang---date:20240702---for：【TV360X-1737】部门用户编辑接口，增加参数updateFromPage:"deptUsers"
      //提交表单
      await saveOrUpdateUser(params, isUpdateVal);
      //关闭弹窗
      closeDrawer();
      //刷新列表
      emit('success',{isUpdateVal ,values});
    } finally {
      setDrawerProps({ confirmLoading: false });
    }
  }
</script>
<style scoped lang="less">
  :deep(.ant-input-number){
    width: 100%;
  }
</style>
