<template>
  <div class="return-apply">
    <!-- 面包屑：出入库管理 → 还料申请（点「出入库管理」返回） -->
    <div class="return-apply__breadcrumb">
      <a-breadcrumb>
        <a-breadcrumb-item><a @click="handleCancel">出入库管理</a></a-breadcrumb-item>
        <a-breadcrumb-item>{{ editMode ? '编辑还料申请' : '还料申请' }}</a-breadcrumb-item>
      </a-breadcrumb>
    </div>

    <!-- 申请信息 -->
    <div class="return-apply__card">
      <div class="return-apply__card-title">
        <span>{{ editMode ? '编辑还料申请' : '还料申请信息' }}</span>
        <a-button v-if="editMode" type="link" @click="handleCancel">返回列表</a-button>
      </div>
      <BasicForm @register="registerForm" />
    </div>

    <!-- 还料明细 -->
    <div class="return-apply__card">
      <div class="return-apply__card-title">
        <span>还料明细（该项目之前领用未用完的可还料）</span>
        <span class="return-apply__tip">可还数量由系统计算，本次还料数量不可超过可还数量</span>
      </div>
      <a-table :columns="detailColumns" :data-source="detailList" :row-key="(r) => r._key" :pagination="false" size="middle" bordered>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'returnQty'">
            <a-input-number v-model:value="record.returnQty" :min="0" :max="record.canReturn" placeholder="还料数量" style="width: 100%" />
          </template>
        </template>
      </a-table>
      <div v-if="!detailList.length" class="return-apply__empty">请先选择项目单号</div>
    </div>

    <!-- 底部操作 -->
    <div class="return-apply__footer">
      <a-button type="primary" preIcon="ant-design:send-outlined" :loading="submitLoading" @click="handleSubmit">
        {{ editMode ? '重新提交' : '提交还料申请' }}
      </a-button>
      <a-button @click="handleCancel">取消</a-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useDebounceFn } from '@vueuse/core';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { returnFormSchema, returnListMock } from './Return.data';
  import { submitReturnApply, updateReturnApply, searchProjectPeriod, getReturnList, getApplyById } from './Return.api';
  import { queryItems } from '../record/StockApply.api';
  import { getCurrentUser } from '../material.util';
  import { ensurePeriodRecords, mapPeriodNoOptions } from '../material.options';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();

  // 注册表单
  const [registerForm, { setFieldsValue, validate, updateSchema }] = useForm({
    labelWidth: 100,
    schemas: returnFormSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 8 },
  });

  // 编辑模式(撤回/驳回后重新编辑：/material/return?applyId=xxx)
  const editMode = !!route.query.applyId;
  const applyId = (route.query.applyId as string) || '';

  const submitLoading = ref(false);

  // 还料明细列(三层数量前两层：应还数量=系统算，实际还库数量=申请人填；最终入库数=库管入库时确认)
  const detailColumns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 150 },
    { title: '类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 100 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 110 },
    { title: '单位', dataIndex: 'unitName', key: 'unitName', width: 70 },
    { title: '应还数量', dataIndex: 'canReturn', key: 'canReturn', width: 90 },
    { title: '*实际还库数量', key: 'returnQty', width: 130 },
  ];

  const detailList = ref<any[]>([]);
  let detailKeySeed = 0;

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

  /**
   * 选择分期项目 → 带出分期编号/名称 + 加载可还料列表
   */
  async function onProjectSelect(periodNo: string, option: any) {
    setFieldsValue({ projectNo: periodNo, projectName: option?.projectName || '' });
    detailList.value = [];
    let list: any[] = [];
    // 正式对接还料列表接口 /stock/apply/returnList；接口异常时退回本地示例(returnListMock)
    try {
      const res: any = await getReturnList({ projectNo: periodNo });
      list = res?.records || res || [];
    } catch (e) {
      list = returnListMock[periodNo] || [];
    }
    detailList.value = list.map((m: any) => ({ _key: ++detailKeySeed, ...m }));
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
        remark: res.remark,
        applyUserName: res.applyUserName, // 还料人
        deptName: res.deptName,
      });
      // 明细走 /stock/apply/items 分页接口（queryById.itemList 已废弃）
      const itemRes: any = await queryItems({ applyId, pageNo: 1, pageSize: 500 });
      const items = itemRes?.records || itemRes || [];
      detailList.value = items.map((it: any) => ({
        _key: ++detailKeySeed,
        materialId: it.materialId,
        materialName: it.materialName,
        materialCategory: it.materialCategory,
        brand: it.brand,
        model: it.model,
        unitName: it.unitName,
        canReturn: it.shouldReturn ?? it.canReturn ?? it.unitQty ?? it.applyQty ?? 0, // 应还数量
        returnQty: it.actualReturn ?? it.unitQty ?? it.applyQty ?? 0, // 实际还库数量
      }));
    } catch (e) {
      createMessage.error('申请加载失败');
    }
  }

  /** 校验并组装提交数据 */
  async function buildSubmitData() {
    const values = await validate();
    if (!detailList.value.length) {
      createMessage.warning('请选择项目单号加载还料列表');
      return null;
    }
    const invalid = detailList.value.find((d) => d.returnQty == null || d.returnQty > d.canReturn);
    if (invalid) {
      createMessage.warning(`「${invalid.materialName}」还料数量不能超过可还数量`);
      return null;
    }
    const hasReturn = detailList.value.filter((d) => d.returnQty > 0);
    if (!hasReturn.length) {
      createMessage.warning('请至少填写一条还料数量');
      return null;
    }
    const cur = getCurrentUser();
    return {
      applyType: 'IN', // 还料 = 入库
      bizType: 'RETURN', // 还料业务类型(后端扩展字段)
      applyUserId: cur.applyUserId,
      returnUser: cur.applyUserName, // 还料人=当前用户(表单已自动填充)
      ...values,
      itemList: hasReturn.map((d) => ({
        materialId: d.materialId,
        materialName: d.materialName,
        materialCategory: d.materialCategory,
        unitName: d.unitName,
        unitQty: d.returnQty,
        shouldReturn: d.canReturn, // 应还数量快照(后端算)
        actualReturn: d.returnQty, // 实际还库数量(申请人填)
      })),
    };
  }

  /** 提交还料申请(新增 or 重新提交) */
  async function handleSubmit() {
    const data = await buildSubmitData().catch(() => null); // 表单校验失败(vben validate reject)静默返回
    if (!data) return;
    submitLoading.value = true;
    try {
      if (editMode) {
        await updateReturnApply({ ...data, id: applyId, status: 'PENDING', executeStatus: '待入库' });
        createMessage.success('重新提交成功');
      } else {
        await submitReturnApply(data);
        createMessage.success('还料申请提交成功');
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
  .return-apply {
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

    &__tip {
      font-size: 12px;
      font-weight: normal;
      color: #999;
    }

    &__empty {
      color: #999;
      text-align: center;
      padding: 24px 0;
    }

    &__footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 8px 0 24px;
    }
  }
</style>
