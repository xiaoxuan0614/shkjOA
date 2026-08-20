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
  import { AmapPoi } from '/@/components/jeecg/AMapPlaceSearch.vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { projectFormSchema } from '../Project.data';
  import {
    addProject,
    editProject,
    addPeriod,
    projectDetail,
    getCustomerList,
    getMainProjectList,
  } from '../Project.api';
  import { loadUserOptions } from '/@/views/resource/userOptions';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();

  // 编辑模式(带 id 时为编辑回显, id 即分期ID)
  const editId = ref<string | undefined>(route.query?.id as string | undefined);

  // 客户列表(甲方选择带出)
  let customerMap: Recordable = {};

  // 主项目列表(分期: 选择所属主项目带出主项目名称)
  let mainProjectMap: Recordable = {};

  // 负责人: id → 姓名
  let leaderNameMap: Recordable = {};

  // 注册表单
  const [registerForm, { setFieldsValue, validate, updateSchema }] = useForm({
    labelWidth: 120,
    schemas: projectFormSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
    baseRowStyle: { padding: '0 20px' },
  });

  /**
   * 加载主项目列表, 注入「所属主项目」下拉(未选/不选则为新建主项目)
   */
  async function loadMainProjects() {
    const res: any = await getMainProjectList();
    const data = res?.records || res || [];
    mainProjectMap = (data || []).reduce((map, p) => {
      map[p.id] = p;
      return map;
    }, {});
    await updateSchema({
      field: 'projectId',
      componentProps: {
        options: (data || []).map((p) => ({ label: p.projectName, value: p.id })),
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: '不选则本记录作为主项目',
        onChange: handleParentChange,
      },
    });
  }

  /**
   * 选择所属主项目后, 带出主项目名称(只读)
   */
  async function handleParentChange(id: any) {
    const p = mainProjectMap[id];
    await setFieldsValue({ projectName: p ? p.projectName : '' });
  }

  /**
   * 加载客户列表, 注入甲方名称下拉
   */
  async function loadCustomers() {
    const res: any = await getCustomerList();
    const data = res?.records || res || [];
    customerMap = (data || []).reduce((map, c) => {
      map[c.id] = c;
      return map;
    }, {});
    await updateSchema({
      field: 'customerId',
      componentProps: {
        options: (data || []).map((c) => ({ label: c.customerName || c.name, value: c.id })),
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
      contactPerson: c.contactPerson || c.contact,
      contactPhone: c.contactPhone || c.phone,
      customerInfo: c.customerInfo || c.info,
    });
  }

  /**
   * 加载项目负责人用户下拉
   */
  async function loadLeaders() {
    const users = await loadUserOptions();
    leaderNameMap = (users || []).reduce((map, u) => {
      map[u.value] = u.label;
      return map;
    }, {});
    await updateSchema({
      field: 'projectLeaderId',
      componentProps: { options: users || [], showSearch: true, optionFilterProp: 'label', placeholder: '请选择项目负责人' },
    });
  }

  /**
   * 编辑回显
   * ⚠️ 多选字段(业务属性/涉及产品清单)后端存逗号分隔字符串, 表单需要数组 → 拆分回显
   */
  async function loadDetail() {
    if (!editId.value) return;
    const data = await projectDetail({ periodId: editId.value });
    const values: Recordable = { ...data };
    ['businessAttribute', 'involvedProducts'].forEach((f) => {
      if (typeof values[f] === 'string' && values[f]) {
        values[f] = values[f].split(',').filter(Boolean);
      }
    });
    await setFieldsValue(values);
    // 回显经纬度到地图选点组件(打开弹窗时地图定位到该点)
    await updateSchema({
      field: 'projectAddress',
      componentProps: { lng: data.longitude ?? null, lat: data.latitude ?? null },
    });
  }

  /**
   * 高德搜索选中地址后, 把经纬度写入隐藏字段随保存提交
   */
  async function loadAddressSelect() {
    await updateSchema({
      field: 'projectAddress',
      componentProps: {
        onSelect: (poi: AmapPoi | null) => {
          setFieldsValue(
            poi ? { longitude: poi.lng, latitude: poi.lat } : { longitude: undefined, latitude: undefined }
          );
        },
      },
    });
  }

  /**
   * 保存: 未选主项目=新建主项目及分期(addProjectPeriod); 选了主项目=新增分期(addPeriod); 编辑=editProjectPeriod
   */
  async function handleSave() {
    try {
      const values = await validate();
      const { projectId, projectName, periodName, ...rest } = values;
      // 多选字段: 数组 → 逗号分隔字符串(对齐后端存储格式)
      const submitValues: Recordable = { ...rest };
      ['businessAttribute', 'involvedProducts'].forEach((f) => {
        if (Array.isArray(submitValues[f])) {
          submitValues[f] = submitValues[f].join(',');
        }
      });
      const base = {
        ...submitValues,
        projectLeaderName: leaderNameMap[rest.projectLeaderId] || '',
        customerName: customerMap[rest.customerId]?.customerName || customerMap[rest.customerId]?.name || '',
      };
      if (editId.value) {
        // 编辑主项目+分期
        await editProject({ ...base, projectId, projectName, periodId: editId.value, periodName });
      } else if (projectId) {
        // 已有主项目下新增分期
        await addPeriod({ ...base, projectId, periodName });
      } else {
        // 新建主项目 + 首期
        await addProject({ ...base, projectName, periodName });
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
    await loadMainProjects();
    await loadLeaders();
    await loadAddressSelect();
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
