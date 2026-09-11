<template>
  <div class="return-apply">
    <!-- 通用菜单入口默认归属物料管理；从出入库管理跳入时保留返回入口。 -->
    <div class="return-apply__breadcrumb">
      <a-breadcrumb>
        <a-breadcrumb-item>
          <a v-if="returnToRecord" @click="handleCancel">出入库管理</a>
          <span v-else>物料管理</span>
        </a-breadcrumb-item>
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
        <span>还料明细（当前项目待归还的物料）</span>
        <span class="return-apply__tip">本次还料数量默认等于系统应还数量；修改后必须填写差异原因</span>
      </div>
      <a-table
        :columns="detailColumns"
        :data-source="detailList"
        :row-key="(r) => r._key"
        :pagination="false"
        :loading="materialLoading"
        :locale="{ emptyText: detailEmptyText }"
        :scroll="{ x: 1080 }"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'returnQty'">
            <a-input-number
              v-model:value="record.returnQty"
              :min="0"
              :max="record.shouldReturnQty"
              placeholder="还料数量"
              style="width: 100%"
            />
          </template>
          <template v-else-if="column.key === 'differenceReason'">
            <a-input
              v-if="needsDifferenceReason(record)"
              v-model:value="record.differenceReason"
              :maxlength="200"
              placeholder="与应还数量不一致，请填写原因"
            />
            <span v-else class="return-apply__muted">—</span>
          </template>
        </template>
      </a-table>
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
  import { computed, ref, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { returnFormSchema } from './Return.data';
  import { getApplyById, getParticipatedProjects, getProjectMaterialAccount, submitReturnApply, updateReturnApply } from './Return.api';
  import { queryItems } from '../record/StockApply.api';
  import { getCurrentUser } from '../material.util';
  import { MATERIAL_USAGE_TYPE } from '../material.constants';
  import { APPROVAL_PENDING } from '/@/utils/approvalStatus';

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
  const returnPath = computed(() => {
    const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from;
    return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard/analysis';
  });
  const returnToRecord = computed(() => returnPath.value === '/material/record');

  const submitLoading = ref(false);
  const materialLoading = ref(false);
  const selectedPeriodId = ref('');
  let materialRequestSeed = 0;

  // 系统应还数量取总账 remainingReturnQty；本次还料数量由申请人确认，最终处置由库管执行。
  const detailColumns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 150 },
    { title: '类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 100 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 110 },
    { title: '单位', dataIndex: 'unitName', key: 'unitName', width: 80 },
    { title: '系统应还数量', dataIndex: 'shouldReturnQty', key: 'shouldReturnQty', width: 120 },
    { title: '*本次还料数量', key: 'returnQty', width: 150 },
    { title: '差异原因', key: 'differenceReason', width: 260 },
  ];

  const detailList = ref<any[]>([]);
  const detailEmptyText = computed(() => (selectedPeriodId.value ? '该项目当前没有待还物料' : '请先选择参与项目'));
  let detailKeySeed = 0;

  /** 还料人/部门默认当前操作人 */
  function initUserInfo() {
    const cur = getCurrentUser();
    setFieldsValue({ applyUserName: cur.applyUserName, deptName: cur.deptName });
  }

  // 接口只返回当前登录用户已确认参与的项目；搜索在返回结果中本地完成。
  const projectOptions = ref<any[]>([]);
  const participatedProjectPool = ref<any[]>([]);

  function mapProjectOption(item: any) {
    const periodNo = item.periodNo || item.projectNo || '暂无编号';
    return {
      label: `${item.projectName || '未命名项目'} / ${item.periodName || '未命名分期'}（${periodNo}）`,
      value: String(item.periodId || ''),
      periodId: String(item.periodId || ''),
      periodNo: item.periodNo || '',
      periodName: item.periodName || '',
      projectName: item.projectName || '',
      projectId: String(item.projectId || ''),
      projectNo: item.projectNo || '',
    };
  }

  function filterProjectOptions(keyword = '') {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const records = normalizedKeyword
      ? participatedProjectPool.value.filter((item: any) =>
          [item.projectName, item.periodName, item.projectNo, item.periodNo, item.projectId, item.periodId].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(normalizedKeyword)
          )
        )
      : participatedProjectPool.value;
    projectOptions.value = records.map(mapProjectOption).filter((item) => item.value);
    return projectOptions.value;
  }

  /** 页面进入即加载参与项目，打开下拉可直接选择。 */
  async function loadProjectOptions() {
    try {
      const data: any = await getParticipatedProjects();
      const records = data?.records || data || [];
      const uniqueRecords = new Map<string, any>();
      records.forEach((item: any) => {
        const key = String(item.periodId || '');
        if (key && !uniqueRecords.has(key)) uniqueRecords.set(key, item);
      });
      participatedProjectPool.value = Array.from(uniqueRecords.values());
      return filterProjectOptions();
    } catch (error) {
      participatedProjectPool.value = [];
      projectOptions.value = [];
      createMessage.error('参与项目加载失败，请刷新页面后重试');
      return [];
    }
  }

  function onProjectSearch(keyword: string) {
    filterProjectOptions(keyword);
  }

  function getProjectDisplayName(option?: any) {
    return [option?.projectName, option?.periodName].filter(Boolean).join(' / ');
  }

  async function fetchAllMaterialAccounts(periodId: string) {
    const pageSize = 200;
    const first: any = await getProjectMaterialAccount({ periodId, pageNo: 1, pageSize });
    const firstRecords = first?.records || (Array.isArray(first) ? first : []);
    const total = Number(first?.total || firstRecords.length);
    const pageCount = Math.ceil(total / pageSize);
    if (pageCount <= 1) return firstRecords;
    const rest = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        getProjectMaterialAccount({ periodId, pageNo: index + 2, pageSize })
      )
    );
    return firstRecords.concat(rest.flatMap((page: any) => page?.records || (Array.isArray(page) ? page : [])));
  }

  function mapMaterialAccountRow(item: any) {
    const shouldReturnQty = Number(item.remainingReturnQty || 0);
    return {
      _key: ++detailKeySeed,
      materialId: item.materialId,
      materialName: item.materialName,
      materialCategory: item.materialCategory,
      brand: item.brand,
      model: item.model,
      unitName: item.baseUnitName,
      shouldReturnQty,
      totalShouldReturnQty: Number(item.shouldReturnQty || 0),
      returnQty: shouldReturnQty,
      differenceReason: '',
    };
  }

  /** 读取该分期待处置数量大于 0 的物料，数量统一使用基准单位。 */
  async function loadReturnMaterials(periodId: string) {
    const requestId = ++materialRequestSeed;
    materialLoading.value = true;
    detailList.value = [];
    try {
      const records = await fetchAllMaterialAccounts(periodId);
      if (requestId !== materialRequestSeed || periodId !== selectedPeriodId.value) return [];
      const rows = records.filter((item: any) => Number(item.remainingReturnQty || 0) > 0).map(mapMaterialAccountRow);
      detailList.value = rows;
      return rows;
    } catch (error) {
      if (requestId === materialRequestSeed) {
        detailList.value = [];
        createMessage.error('项目待还物料加载失败，请重新选择项目后重试');
      }
      return [];
    } finally {
      if (requestId === materialRequestSeed) materialLoading.value = false;
    }
  }

  /**
   * 选择参与项目 → 以 periodId 查询项目物料总账并带出待还物料。
   */
  async function onProjectChange(periodId?: string, option?: any) {
    const normalizedPeriodId = String(periodId || '');
    ++materialRequestSeed;
    selectedPeriodId.value = normalizedPeriodId;
    detailList.value = [];
    materialLoading.value = false;
    setFieldsValue({
      periodId: normalizedPeriodId || undefined,
      projectName: normalizedPeriodId ? getProjectDisplayName(option) : undefined,
    });
    if (normalizedPeriodId) await loadReturnMaterials(normalizedPeriodId);
  }

  /** 表单挂载后再注入远程搜索 + 默认当前操作人 + 编辑模式回填 */
  onMounted(async () => {
    initUserInfo();
    await loadProjectOptions();
    updateSchema([
      {
        field: 'periodId',
        componentProps: { options: projectOptions, onSearch: onProjectSearch, onChange: onProjectChange },
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
      const options = projectOptions.value.length ? projectOptions.value : await loadProjectOptions();
      const selectedOption = options.find(
        (item: any) => item.periodId === String(res.periodId || '') || (res.projectNo && item.periodNo === res.projectNo)
      );
      const resolvedPeriodId = String(res.periodId || selectedOption?.periodId || '');
      if (!resolvedPeriodId) {
        createMessage.error('该还料申请缺少项目分期ID，无法按当前接口重新提交');
        return;
      }
      selectedPeriodId.value = resolvedPeriodId;
      if (!selectedOption) {
        projectOptions.value.unshift({
          label: res.projectName || res.projectNo || resolvedPeriodId,
          value: resolvedPeriodId,
          periodId: resolvedPeriodId,
          periodNo: res.projectNo || '',
          periodName: res.projectName || '',
          projectName: '',
        });
      }
      setFieldsValue({
        usageType: MATERIAL_USAGE_TYPE.PROJECT,
        periodId: resolvedPeriodId,
        projectName: selectedOption ? getProjectDisplayName(selectedOption) : res.projectName,
        remark: res.remark,
        applyUserName: res.applyUserName, // 还料人
        deptName: res.deptName,
      });
      // 明细与当前项目总账并行读取；总账的 remainingReturnQty 作为当前系统应还数量。
      const [itemRes, accountRecords] = await Promise.all([
        queryItems({ applyId, pageNo: 1, pageSize: 500 }),
        fetchAllMaterialAccounts(resolvedPeriodId),
      ]);
      const items = itemRes?.records || itemRes || [];
      const accountMap = new Map(accountRecords.map((item: any) => [String(item.materialId), item]));
      detailList.value = items.map((it: any) => ({
        _key: ++detailKeySeed,
        applyItemId: it.id,
        materialId: it.materialId,
        materialName: it.materialName,
        materialCategory: it.materialCategory,
        brand: it.brand,
        model: it.model,
        unitName: accountMap.get(String(it.materialId))?.baseUnitName || it.unitName,
        shouldReturnQty: Number(
          accountMap.get(String(it.materialId))?.remainingReturnQty ?? it.shouldReturn ?? it.canReturn ?? it.unitQty ?? it.applyQty ?? 0
        ),
        totalShouldReturnQty: Number(accountMap.get(String(it.materialId))?.shouldReturnQty ?? it.shouldReturn ?? 0),
        returnQty: Number(it.unitQty ?? it.applyQty ?? 0),
        differenceReason: it.remark || '',
      }));
    } catch (e) {
      createMessage.error('申请加载失败');
    }
  }

  function isQtyDifferent(row: any) {
    const actual = Number(row.returnQty);
    const expected = Number(row.shouldReturnQty);
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    return Math.abs(actual - expected) > 1e-8;
  }

  function needsDifferenceReason(row: any) {
    return Number(row.returnQty) > 0 && isQtyDifferent(row);
  }

  /** 校验并组装提交数据 */
  async function buildSubmitData() {
    const values = await validate();
    if (!detailList.value.length) {
      createMessage.warning('请选择参与项目并加载待还物料');
      return null;
    }
    const invalid = detailList.value.find(
      (d) => !Number.isFinite(Number(d.returnQty)) || Number(d.returnQty) < 0 || Number(d.returnQty) > Number(d.shouldReturnQty)
    );
    if (invalid) {
      createMessage.warning(`「${invalid.materialName}」本次还料数量须在 0 至 ${invalid.shouldReturnQty} 之间`);
      return null;
    }
    const hasReturn = detailList.value.filter((d) => d.returnQty > 0);
    if (!hasReturn.length) {
      createMessage.warning('请至少填写一条还料数量');
      return null;
    }
    const missingReason = hasReturn.find((d) => needsDifferenceReason(d) && !String(d.differenceReason || '').trim());
    if (missingReason) {
      createMessage.warning(`「${missingReason.materialName}」本次还料数量与系统应还数量不一致，请填写差异原因`);
      return null;
    }
    const cur = getCurrentUser();
    const formValues = { ...values };
    delete formValues.projectName;
    return {
      ...formValues,
      applyType: 'IN', // 还料 = 入库
      bizType: 'RETURN',
      usageType: MATERIAL_USAGE_TYPE.PROJECT,
      periodId: selectedPeriodId.value,
      applyUserId: cur.applyUserId,
      itemList: hasReturn.map((d) => ({
        ...(d.applyItemId ? { id: d.applyItemId } : {}),
        materialId: d.materialId,
        materialName: d.materialName,
        materialCategory: d.materialCategory,
        brand: d.brand,
        model: d.model,
        unit: d.unitName,
        unitName: d.unitName,
        unitQty: Number(d.returnQty),
        baseQty: Number(d.returnQty),
        applyQty: Number(d.returnQty),
        remark: needsDifferenceReason(d) ? String(d.differenceReason).trim() : '',
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
        await updateReturnApply({ ...data, id: applyId, status: APPROVAL_PENDING, executeStatus: '待入库' });
        createMessage.success('重新提交成功');
      } else {
        await submitReturnApply(data);
        createMessage.success('还料申请提交成功');
      }
      router.push(returnPath.value);
    } finally {
      submitLoading.value = false;
    }
  }

  /** 取消 */
  function handleCancel() {
    router.push(returnPath.value);
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

    &__muted {
      color: #bfbfbf;
    }

    &__footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 8px 0 24px;
    }
  }
</style>
