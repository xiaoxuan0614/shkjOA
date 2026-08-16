<template>
  <div class="pick-apply">
    <!-- 面包屑：出入库管理 → 领料申请（点「出入库管理」返回） -->
    <div class="pick-apply__breadcrumb">
      <a-breadcrumb>
        <a-breadcrumb-item><a @click="handleCancel">出入库管理</a></a-breadcrumb-item>
        <a-breadcrumb-item>{{ editMode ? '编辑领料申请' : '领料申请' }}</a-breadcrumb-item>
      </a-breadcrumb>
    </div>

    <!-- 申请信息 -->
    <div class="pick-apply__card">
      <div class="pick-apply__card-title">
        <span>{{ editMode ? '编辑领料申请' : '领料申请信息' }}</span>
        <a-button v-if="editMode" type="link" @click="handleCancel">返回列表</a-button>
      </div>
      <BasicForm @register="registerForm" />
    </div>

    <!-- 物料明细 -->
    <div class="pick-apply__card">
      <div class="pick-apply__card-title">
        <span>物料明细</span>
        <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handleAddMaterial">添加物料</a-button>
      </div>
      <a-table :columns="detailColumns" :data-source="detailList" :row-key="(r) => r._key" :pagination="false" size="middle" bordered>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'stockQty'">
            <!-- 库存：接口 currentStockQty + baseUnitName（如 1个） -->
            {{ formatStock(record) }}
          </template>
          <template v-else-if="column.key === 'unitQty'">
            <a-input-number v-model:value="record.unitQty" :min="1" placeholder="申请数量" style="width: 100%" />
          </template>
          <template v-else-if="column.key === 'unitName'">
            <a-select v-model:value="record.unitName" :options="record.unitOptions || []" placeholder="选择单位" style="width: 100%" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" danger size="small" @click="handleRemoveDetail(record._key)">移除</a-button>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 底部操作 -->
    <div class="pick-apply__footer">
      <a-button type="primary" preIcon="ant-design:send-outlined" :loading="submitLoading" @click="handleSubmit">
        {{ editMode ? '重新提交' : '提交领料申请' }}
      </a-button>
      <a-button @click="handleCancel">取消</a-button>
    </div>

    <!-- 选物料抽屉 -->
    <MaterialSelectDrawer @register="registerDrawer" @success="handleDrawerSuccess" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useDebounceFn } from '@vueuse/core';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { pickFormSchema } from './Pick.data';
  import { submitPickApply, updatePickApply, searchProjectPeriod, getApplyById } from './Pick.api';
  import { queryItems } from '../record/StockApply.api';
  import { getCurrentUser } from '../material.util';
  import { ensurePeriodRecords, mapPeriodNoOptions } from '../material.options';
  import MaterialSelectDrawer from '../apply/components/MaterialSelectDrawer.vue';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();

  // 注册表单
  const [registerForm, { setFieldsValue, validate, updateSchema }] = useForm({
    labelWidth: 100,
    schemas: pickFormSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 8 },
  });

  // 注册抽屉
  const [registerDrawer, { openDrawer }] = useDrawer();

  // 编辑模式(撤回/驳回后重新编辑：/material/pick?applyId=xxx)
  const editMode = !!route.query.applyId;
  const applyId = (route.query.applyId as string) || '';

  const submitLoading = ref(false);

  // 明细表格列
  const detailColumns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 160 },
    { title: '类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 110 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 120 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 140 },
    { title: '库存', dataIndex: 'stockQty', key: 'stockQty', width: 90 },
    { title: '*申请数量', key: 'unitQty', width: 140 },
    { title: '*单位', key: 'unitName', width: 120 },
    { title: '操作', key: 'action', width: 90, align: 'center', fixed: 'right' },
  ];

  const detailList = ref<any[]>([]);
  let detailKeySeed = 0;

  /** 库存展示：接口 currentStockQty + baseUnitName（如 1个） */
  function formatStock(r: any) {
    const qty = r.currentStockQty ?? r.stockQty;
    const unit = r.baseUnitName ?? r.unitName ?? r.unit;
    if (qty == null || qty === '' || qty === '-') return '—';
    return `${qty}${unit || ''}`;
  }

  /** 使用人/部门默认当前操作人 */
  function initUserInfo() {
    const cur = getCurrentUser();
    setFieldsValue({ applyUserName: cur.applyUserName, deptName: cur.deptName });
  }

  // 项目下拉选项(远程模糊搜索 /project/period/searchByName，防抖 300ms)
  const projectOptions = ref<any[]>([]);
  /** 加载项目分期下拉：优先取预载的第 1 页(10 条)映射，避免「打开没数据/每次才请求」 */
  async function loadProjectOptions() {
    projectOptions.value = mapPeriodNoOptions(await ensurePeriodRecords());
  }

  const onProjectSearch = useDebounceFn(async (keyword: string) => {
    if (!keyword) {
      // 空关键词回到预载的分期首页
      projectOptions.value = mapPeriodNoOptions(await ensurePeriodRecords());
      return;
    }
    const data: any = await searchProjectPeriod({ keyword, pageNo: 1, pageSize: 20 });
    projectOptions.value = mapPeriodNoOptions(data?.records || data || []);
  }, 300);

  /** 选择分期项目 → 带出分期编号/名称 */
  function onProjectSelect(periodNo: string, option: any) {
    setFieldsValue({ projectNo: periodNo, projectName: option?.projectName || '' });
  }

  /** 表单挂载后再注入远程搜索 + 默认当前操作人 + 编辑模式回填 */
  onMounted(async () => {
    initUserInfo();
    // 分期项目下拉预载(第 1 页 10 条)，页面渲染即请求，打开下拉即有数据
    await loadProjectOptions();
    updateSchema([
      {
        field: 'projectNo',
        componentProps: { options: projectOptions, onSearch: onProjectSearch, onSelect: onProjectSelect },
      },
    ]);
    if (editMode) {
      await loadApplyForEdit();
    }
  });

  /** 编辑模式：queryById 回填申请头 + 明细 */
  async function loadApplyForEdit() {
    try {
      const res: any = await getApplyById({ id: applyId });
      if (!res) return;
      setFieldsValue({
        projectNo: res.projectNo,
        projectName: res.projectName,
        useDate: res.useDate,
        remark: res.remark,
        applyUserName: res.applyUserName,
        deptName: res.deptName,
      });
      // 明细走 /stock/apply/items 分页接口（queryById.itemList 已废弃）
      const itemRes: any = await queryItems({ applyId, pageNo: 1, pageSize: 500 });
      const items = itemRes?.records || itemRes || [];
      detailList.value = items.map((it: any) => ({
        _key: ++detailKeySeed,
        id: it.materialId,
        materialName: it.materialName,
        materialCategory: it.materialCategory,
        brand: it.brand,
        model: it.model,
        currentStockQty: it.currentStockQty ?? it.stockQty, // 库存(接口 currentStockQty)
        baseUnitName: it.baseUnitName ?? it.unitName, // 基准单位名
        unitQty: it.unitQty ?? it.applyQty ?? 1,
        unitName: it.unitName,
        unitOptions: [{ label: it.unitName, value: it.unitName }],
      }));
    } catch (e) {
      createMessage.error('申请加载失败');
    }
  }

  /** 添加物料：打开抽屉 */
  function handleAddMaterial() {
    openDrawer(true);
  }

  /** 抽屉确定：物料回填明细行(单位取物料 unitList) */
  function handleDrawerSuccess(selected: any[]) {
    if (!selected || !selected.length) {
      createMessage.warning('请选择物料');
      return;
    }
    selected.forEach((m) => {
      if (detailList.value.some((d) => d.id === m.id)) {
        createMessage.warning(`「${m.materialName}」已在明细中`);
        return;
      }
      detailList.value.push({
        _key: ++detailKeySeed,
        id: m.id,
        materialName: m.materialName,
        materialCategory: m.materialCategory,
        brand: m.brand,
        model: m.model,
        currentStockQty: m.currentStockQty ?? m.stockQty, // 库存(接口 currentStockQty)
        baseUnitName: m.baseUnitName ?? m.unit, // 基准单位名
        unitQty: 1,
        unitName: m.unit, // 默认基准单位
        unitOptions: (m.unitList || []).map((u: any) => ({ label: u.unitName, value: u.unitName })),
      });
    });
  }

  /** 移除明细行 */
  function handleRemoveDetail(key: number) {
    detailList.value = detailList.value.filter((d) => d._key !== key);
  }

  /** 校验并组装提交数据 */
  async function buildSubmitData() {
    const values = await validate();
    if (!detailList.value.length) {
      createMessage.warning('请添加物料明细');
      return null;
    }
    const invalid = detailList.value.find((d) => !d.unitQty || !d.unitName);
    if (invalid) {
      createMessage.warning('请填写完整的申请数量和单位');
      return null;
    }
    const cur = getCurrentUser();
    return {
      applyType: 'OUT', // 领料 = 出库
      bizType: 'PICK', // 领料业务类型(后端扩展字段)
      applyUserId: cur.applyUserId,
      ...values,
      itemList: detailList.value.map((d) => ({
        materialId: d.id,
        materialName: d.materialName,
        materialCategory: d.materialCategory,
        brand: d.brand,
        model: d.model,
        unitName: d.unitName,
        unitQty: d.unitQty,
      })),
    };
  }

  /** 提交领料申请(新增 or 重新提交) */
  async function handleSubmit() {
    const data = await buildSubmitData().catch(() => null); // 表单校验失败(vben validate reject)静默返回
    if (!data) return;
    submitLoading.value = true;
    try {
      if (editMode) {
        await updatePickApply({ ...data, id: applyId, status: 'PENDING', executeStatus: '待出库' });
        createMessage.success('重新提交成功');
      } else {
        await submitPickApply(data);
        createMessage.success('领料申请提交成功');
      }
      router.push('/material/record');
    } finally {
      submitLoading.value = false;
    }
  }

  /** 取消 */
  function handleCancel() {
    router.push('/material/record');
  }
</script>

<style lang="less" scoped>
  .pick-apply {
    padding: 16px;

    &__breadcrumb {
      margin-bottom: 12px;
    }

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
        display: flex;
        justify-content: space-between;
        align-items: center;
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
