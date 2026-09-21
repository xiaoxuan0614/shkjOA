<template>
  <div class="pick-apply">
    <!-- 通用菜单入口默认归属物料管理；从出入库管理跳入时保留返回入口。 -->
    <div class="pick-apply__breadcrumb">
      <a-breadcrumb>
        <a-breadcrumb-item>
          <a v-if="returnToRecord" @click="handleCancel">出入库管理</a>
          <span v-else>物料管理</span>
        </a-breadcrumb-item>
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
        <a-button type="primary" preIcon="ant-design:plus-outlined" :disabled="isProjectMode && !selectedPeriodId" @click="handleAddMaterial">
          {{ isReworkMode ? '补充本轮可申请物料' : isProjectMode ? '添加可申请物料' : '添加物料' }}
        </a-button>
      </div>
      <a-alert
        v-if="isReworkMode"
        type="info"
        show-icon
        class="pick-apply__rework-tip"
        message="返工领料只使用本轮额外领料额度"
        description="列表不会混入原计划用料；当前可申请数量由本返工单的额外领料计划扣除已占用和已出库数量后计算。"
      />
      <a-table :columns="detailColumns" :data-source="detailList" :row-key="(r) => r._key" :pagination="false" size="middle" bordered>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'material'">
            <div class="pick-apply__material-identity">
              <span class="pick-apply__material-name">{{ record.materialName || '未命名物料' }}</span>
              <span class="pick-apply__material-code">{{ record.materialCode || '暂无编码' }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'brand'">
            {{ formatBrand(record.brand) }}
          </template>
          <template v-else-if="column.key === 'stockQty'">
            <!-- 库存：接口 currentStockQty + baseUnitName（如 1个） -->
            {{ formatStock(record) }}
          </template>
          <template v-else-if="column.key === 'unitQty'">
            <a-input-number
              v-model:value="record.unitQty"
              :min="0.01"
              :max="isProjectMode ? record.availableApplyQty : undefined"
              :precision="2"
              placeholder="申请数量"
              style="width: 100%"
            />
          </template>
          <template v-else-if="column.key === 'availableApplyQty'">
            <span class="pick-apply__available"> {{ record.availableApplyQty }}{{ record.baseUnitName || record.unitName || '' }} </span>
          </template>
          <template v-else-if="column.key === 'unitName'">
            <a-select
              v-model:value="record.unitName"
              :options="record.unitOptions || []"
              :disabled="isProjectMode"
              placeholder="选择单位"
              style="width: 100%"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" danger size="small" @click="handleRemoveDetail(record._key)">删除</a-button>
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
    <MaterialSelectDrawer
      :source-mode="isProjectMode ? 'project' : 'all'"
      :labor-only="usageType === MATERIAL_USAGE_TYPE.LABOR_PROTECTION"
      :period-id="selectedPeriodId"
      @register="registerDrawer"
      @success="handleDrawerSuccess"
    />
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useTabs } from '/@/hooks/web/useTabs';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { pickFormSchema } from './Pick.data';
  import {
    submitPickApply,
    updatePickApply,
    getParticipatedProjects,
    getProjectMaterialAccountPage,
    getProjectPeriodDetail,
    getReworkMaterials,
    getApplyById,
  } from './Pick.api';
  import { queryItems } from '../record/StockApply.api';
  import { resolveCurrentMaterialUser, getCurrentUser, loadDictMap, loadMaterialMap } from '../material.util';
  import { MATERIAL_USAGE_TYPE } from '../material.constants';
  import MaterialSelectDrawer from '../apply/components/MaterialSelectDrawer.vue';
  import { validateEditableRows } from '/@/components/EditableTable';
  import { PageEnum } from '/@/enums/pageEnum';
  import { useSessionDraft } from '/@/hooks/web/useSessionDraft';

  const router = useRouter();
  const route = useRoute();
  const { close: closeTab } = useTabs();
  async function leaveCompletedForm() {
    const completedRoute = { ...route };
    await router.push(returnPath.value);
    await closeTab(completedRoute);
  }
  const { createMessage } = useMessage();

  // 注册表单
  const [registerForm, { setFieldsValue, getFieldsValue, resetFields, validate, updateSchema }] = useForm({
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
  const reworkId = ref(String(route.query.reworkId || ''));
  const returnPath = computed(() => {
    const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from;
    return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : PageEnum.BASE_HOME;
  });
  const returnToRecord = computed(() => returnPath.value === '/material/record');

  const submitLoading = ref(false);
  const usageType = ref<string>(MATERIAL_USAGE_TYPE.PROJECT);
  const selectedPeriodId = ref('');
  const isProjectMode = computed(() => usageType.value === MATERIAL_USAGE_TYPE.PROJECT);
  const isReworkMode = computed(() => Boolean(reworkId.value));
  const brandMap = ref<Record<string, { text: string; color: string }>>({});
  const projectMaterialPeriodStatus = [
    'IMPLEMENTING',
    'DEBUGGING',
    'DEBUG_COMPLETED',
    'IMPLEMENT_COMPLETED',
    'PENDING_ACCEPT',
    'INTERNAL_ACCEPTING',
    'ACCEPTING',
    'REWORKING',
  ].join(',');

  // 明细表格列
  const detailColumns = computed(() => [
    { title: '物料', key: 'material', width: 240 },
    { title: '类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 110 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 120 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 140 },
    ...(isProjectMode.value
      ? [{ title: '当前可申请数量', dataIndex: 'availableApplyQty', key: 'availableApplyQty', width: 150 }]
      : [{ title: '库存', dataIndex: 'stockQty', key: 'stockQty', width: 100 }]),
    { title: '*申请数量', key: 'unitQty', width: 140 },
    { title: '*单位', key: 'unitName', width: 120 },
    { title: '操作', key: 'action', width: 90, align: 'center', fixed: 'right' },
  ]);

  const detailList = ref<any[]>([]);
  let pickBaseline = '';
  const draft = useSessionDraft<any>(`material-pick:${applyId || 'new'}:${reworkId.value}`, () => ({
    baseline: pickBaseline, usageType: usageType.value, periodId: selectedPeriodId.value,
    form: { remark: getFieldsValue().remark, repairOrderNo: getFieldsValue().repairOrderNo },
    rows: detailList.value.map((row) => ({ id: row.id, unitQty: row.unitQty, unitName: row.unitName })),
  }));
  async function restorePickDraft() {
    if (!draft.isAlive()) return;
    const saved = draft.read();
    if (saved && Array.isArray(saved.rows)) {
      if (editMode && (!pickBaseline || saved.baseline !== pickBaseline)) {
        createMessage.warning('领料单已变化，未恢复旧草稿');
      } else {
        if (!editMode) {
          if (!isReworkMode.value) {
            if (!Object.values(MATERIAL_USAGE_TYPE).includes(saved.usageType)) throw new Error('草稿用料类型无效');
            await onUsageTypeChange(saved.usageType);
            if (saved.usageType === MATERIAL_USAGE_TYPE.PROJECT && saved.periodId) {
              if (!projectOptions.value.some((item) => String(item.value) === String(saved.periodId))) throw new Error('草稿项目已不可选，请重新选择');
              selectedPeriodId.value = String(saved.periodId);
            }
            await setFieldsValue({ usageType: usageType.value, periodId: selectedPeriodId.value || undefined });
          }
          const materialMap = await loadMaterialMap({ force: true });
          let available: any[] = Object.values(materialMap);
          if (isReworkMode.value) available = await getAvailableReworkMaterials();
          else if (isProjectMode.value) available = (selectedPeriodId.value ? await loadAllProjectMaterialAccounts(selectedPeriodId.value) : [])
            .filter((row) => Number(row.availableApplyQty) > 0)
            .map((row) => ({ ...materialMap[String(row.materialId)], ...row, id: row.materialId }));
          else if (usageType.value === MATERIAL_USAGE_TYPE.LABOR_PROTECTION) {
            const categories = await loadDictMap('material_category');
            const matches = Object.entries(categories).filter(([, item]: any) => String(item.text).trim() === '劳保用品');
            if (matches.length !== 1) throw new Error('劳保物料类别已变化，请重新选料');
            available = available.filter((row) => String(row.materialCategory) === matches[0][0]);
          }
          if (!draft.isAlive()) return;
          detailList.value = [];
          const picked = available.filter((row) => saved.rows.some((item: any) => String(item.id) === String(row.id)));
          if (picked.length) handleDrawerSuccess(picked);
          if (picked.length !== saved.rows.length) createMessage.warning('部分草稿物料已不可申请，请核对清单');
        }
        await setFieldsValue(saved.form || {});
        for (const row of detailList.value) {
          const input = saved.rows.find((item: any) => String(item.id) === String(row.id));
          if (input) {
            row.unitQty = input.unitQty;
            if (!isProjectMode.value && row.unitOptions?.some((option: any) => option.value === input.unitName)) row.unitName = input.unitName;
          }
        }
      }
    }
    draft.enable();
  }
  let detailKeySeed = 0;

  /** 库存展示：接口 currentStockQty + baseUnitName（如 1个） */
  function formatStock(r: any) {
    const qty = r.currentStockQty ?? r.stockQty;
    const unit = r.baseUnitName ?? r.unitName ?? r.unit;
    if (qty == null || qty === '' || qty === '-') return '—';
    return `${qty}${unit || ''}`;
  }

  function formatBrand(value: unknown) {
    const rawValue = String(value ?? '');
    return brandMap.value[rawValue]?.text || rawValue || '—';
  }

  /** 使用人/部门默认当前操作人 */
  async function initUserInfo() {
    const cur = await resolveCurrentMaterialUser().catch(() => ({ ...getCurrentUser(), deptName: getCurrentUser().deptName || '部门加载失败' }));
    setFieldsValue({ applyUserName: cur.applyUserName, deptName: cur.deptName });
  }

  // 当前用户参与项目由接口一次返回；搜索在本地完成，避免暴露全量项目。
  const projectOptions = ref<any[]>([]);
  const participatedProjectPool = ref<any[]>([]);

  function mapProjectOption(item: any) {
    return {
      label: `${item.projectName || '未命名项目'} / ${item.periodName || '未命名分期'}`,
      value: String(item.periodId || ''),
      periodId: String(item.periodId || ''),
      periodName: item.periodName || '',
      projectName: item.projectName || '',
      projectId: String(item.projectId || ''),
      projectNo: item.projectNo || '',
      periodNo: item.periodNo || '',
    };
  }

  async function loadProjectOptions() {
    const data: any = await getParticipatedProjects({ periodStatus: projectMaterialPeriodStatus });
    const records = data?.records || data || [];
    const uniqueRecords = new Map<string, any>();
    records.forEach((item: any) => {
      const key = String(item.periodId || '');
      if (key && !uniqueRecords.has(key)) uniqueRecords.set(key, item);
    });
    participatedProjectPool.value = Array.from(uniqueRecords.values());
    projectOptions.value = participatedProjectPool.value.map(mapProjectOption);
    return projectOptions.value;
  }

  /** change 同时处理选择和清空，防止沿用原分期物料。 */
  function onProjectChange(periodId?: string) {
    const nextPeriodId = String(periodId || '');
    if (selectedPeriodId.value !== nextPeriodId && detailList.value.length) {
      detailList.value = [];
      createMessage.info('项目已变更，原物料明细已清空');
    }
    selectedPeriodId.value = nextPeriodId;
  }

  async function onUsageTypeChange(value: string) {
    if (isReworkMode.value) return;
    if (usageType.value !== value && detailList.value.length) {
      detailList.value = [];
      createMessage.info('用料类型已变更，原物料明细已清空');
    }
    usageType.value = value;
    setFieldsValue({ repairOrderNo: undefined });
    if (value !== MATERIAL_USAGE_TYPE.PROJECT) {
      selectedPeriodId.value = '';
      setFieldsValue({ periodId: undefined });
    } else if (!projectOptions.value.length) {
      await loadProjectOptions();
    }
  }

  /** 表单挂载后再注入项目选项 + 默认当前操作人 + 编辑模式回填 */
  onMounted(async () => {
    await initUserInfo();
    try {
      brandMap.value = await loadDictMap('material_brand');
      // 返工领料由 reworkId 锁定项目和额外领料额度；普通新增才加载全部参与项目。
      if (isReworkMode.value && !editMode) await initializeReworkContext();
      else if (!editMode) await loadProjectOptions();
      syncProjectFields();
      if (editMode) {
        await loadApplyForEdit();
        syncProjectFields();
      } else if (isReworkMode.value) {
        await addAvailableReworkMaterials();
      }
      if (!editMode || pickBaseline) {
        try { await restorePickDraft(); }
        catch (error: any) { createMessage.warning(error?.message || '领料草稿恢复失败，请重新核对'); }
        finally { draft.enable(); }
      }
    } catch (error: any) {
      createMessage.error(error?.message || '领料申请初始化失败，请返回后重试');
    }
  });

  function syncProjectFields() {
    updateSchema([
      {
        field: 'usageType',
        componentProps: { onChange: onUsageTypeChange, disabled: isReworkMode.value },
      },
      {
        field: 'periodId',
        componentProps: {
          options: projectOptions,
          onChange: onProjectChange,
          disabled: isReworkMode.value,
        },
      },
    ]);
  }

  async function initializeReworkContext() {
    const routePeriodId = String(route.query.periodId || '');
    if (!routePeriodId) throw new Error('缺少项目分期 ID，无法发起返工领料');
    selectedPeriodId.value = routePeriodId;
    usageType.value = MATERIAL_USAGE_TYPE.PROJECT;
    const detail: any = await getProjectPeriodDetail({ periodId: routePeriodId });
    const option = mapProjectOption({ ...detail, periodId: routePeriodId });
    projectOptions.value = [option];
    participatedProjectPool.value = [{ ...detail, periodId: routePeriodId }];
    setFieldsValue({
      usageType: MATERIAL_USAGE_TYPE.PROJECT,
      periodId: option.value,
    });
  }

  async function getAvailableReworkMaterials() {
    if (!reworkId.value) return [];
    const [result, materialMap]: any[] = await Promise.all([getReworkMaterials({ reworkId: reworkId.value }), loadMaterialMap()]);
    const records = Array.isArray(result) ? result : [];
    return records
      .filter((item: any) => item.materialId && Number(item.availableApplyQty) > 0)
      .map((item: any) => {
        const material = materialMap[String(item.materialId)] || {};
        const baseUnit = material.unitList?.find((unit: any) => unit.isBaseUnit) || material.unitList?.[0] || {};
        const unitName = material.baseUnitName || material.unit || baseUnit.unitName || '';
        return {
          ...material,
          ...item,
          id: item.materialId,
          baseUnitName: unitName,
          unit: unitName,
          unitList: material.unitList || (unitName ? [{ unitName }] : []),
          availableApplyQty: Math.max(Number(item.availableApplyQty) || 0, 0),
        };
      });
  }

  async function addAvailableReworkMaterials() {
    try {
      const candidates = await getAvailableReworkMaterials();
      const missing = candidates.filter((item: any) => !detailList.value.some((detail) => String(detail.id) === String(item.id)));
      if (!missing.length) {
        createMessage.info(detailList.value.length ? '本轮可申请物料已全部加入' : '本轮暂无可申请的额外领料物料');
        return;
      }
      handleDrawerSuccess(missing);
    } catch (error: any) {
      createMessage.error(error?.message || '返工额外领料物料加载失败，请重试');
    }
  }

  /** 编辑模式：queryById 回填申请头 + 明细 */
  async function loadApplyForEdit() {
    try {
      const res: any = await getApplyById({ id: applyId });
      if (!res) return;
      reworkId.value = String(res.reworkId || reworkId.value || '');
      const resolvedUsageType = res.usageType || (res.periodId || res.projectNo ? MATERIAL_USAGE_TYPE.PROJECT : MATERIAL_USAGE_TYPE.MAINTENANCE);
      usageType.value = resolvedUsageType;
      if (resolvedUsageType === MATERIAL_USAGE_TYPE.PROJECT) {
        selectedPeriodId.value = String(res.periodId || '');
        if (!isReworkMode.value) await loadProjectOptions();
        if (!selectedPeriodId.value && res.projectNo) {
          const matches = projectOptions.value.filter((item) => item.periodNo === res.projectNo || item.projectNo === res.projectNo);
          if (matches.length === 1) selectedPeriodId.value = matches[0].periodId;
        }
        if (selectedPeriodId.value && !projectOptions.value.some((item) => item.value === selectedPeriodId.value)) {
          const detail: any = await getProjectPeriodDetail({ periodId: selectedPeriodId.value });
          projectOptions.value.push({
            ...mapProjectOption({ ...detail, periodId: selectedPeriodId.value }),
            disabled: !isReworkMode.value,
          });
          if (!isReworkMode.value) createMessage.warning('原项目已不在可领料范围，请重新选择参与项目');
        }
      }
      setFieldsValue({
        usageType: resolvedUsageType,
        periodId: selectedPeriodId.value || undefined,
        useDate: res.useDate,
        repairOrderNo: res.repairOrderNo,
        remark: res.remark,
        applyUserName: res.applyUserName,
        deptName:
          res.deptName ||
          (String(res.applyUserId || '') === getCurrentUser().applyUserId
            ? (await resolveCurrentMaterialUser().catch(() => getCurrentUser())).deptName
            : '—'),
      });
      // 明细走 /stock/apply/items 分页接口（queryById.itemList 已废弃）
      const itemRes: any = await queryItems({ applyId, pageNo: 1, pageSize: 500 });
      const items = itemRes?.records || itemRes || [];
      const materialAccountMap = new Map<string, any>();
      if (resolvedUsageType === MATERIAL_USAGE_TYPE.PROJECT && selectedPeriodId.value) {
        const accounts = isReworkMode.value ? await getAvailableReworkMaterials() : await loadAllProjectMaterialAccounts(selectedPeriodId.value);
        accounts.forEach((account: any) => materialAccountMap.set(String(account.materialId), account));
      }
      detailList.value = items.map((it: any) => {
        const account = materialAccountMap.get(String(it.materialId)) || {};
        const unitName = account.baseUnitName || it.baseUnitName || it.unitName || '';
        const projectItem = resolvedUsageType === MATERIAL_USAGE_TYPE.PROJECT;
        return {
          _key: ++detailKeySeed,
          id: it.materialId,
          materialCode: account.materialCode || it.materialCode || '',
          materialName: account.materialName || it.materialName,
          materialCategory: account.materialCategory || it.materialCategory,
          brand: account.brand || it.brand,
          model: account.model || it.model,
          currentStockQty: it.currentStockQty ?? it.stockQty,
          baseUnitName: unitName,
          unitQty: projectItem ? (it.baseQty ?? it.unitQty ?? it.applyQty ?? 1) : (it.unitQty ?? it.applyQty ?? 1),
          unitName: projectItem ? unitName : it.unitName || unitName,
          unitOptions: unitName ? [{ label: unitName, value: unitName }] : [],
          availableApplyQty: Math.max(Number(account.availableApplyQty ?? it.availableApplyQty) || 0, 0),
        };
      });
      pickBaseline = JSON.stringify(res);
    } catch (e) {
      pickBaseline = '';
      createMessage.error('申请加载失败');
    }
  }

  async function loadAllProjectMaterialAccounts(periodId: string) {
    const records: any[] = [];
    const pageSize = 200;
    for (let pageNo = 1; pageNo <= 1000; pageNo += 1) {
      const result: any = await getProjectMaterialAccountPage({ periodId, pageNo, pageSize });
      const pageRecords = Array.isArray(result) ? result : result?.records || [];
      records.push(...pageRecords.filter((item: any) => item.materialId));
      const total = Number(result?.total);
      if (
        Array.isArray(result) ||
        pageRecords.length === 0 ||
        (Number.isFinite(total) && pageNo * pageSize >= total) ||
        pageRecords.length < pageSize
      ) {
        return records;
      }
    }
    throw new Error('项目物料数量过多，未能在安全页数内完成回填');
  }

  /** 添加物料：打开抽屉 */
  function handleAddMaterial() {
    if (isProjectMode.value && !selectedPeriodId.value) {
      createMessage.warning('请先选择分期项目');
      return;
    }
    if (isReworkMode.value) {
      void addAvailableReworkMaterials();
      return;
    }
    openDrawer(true, { excludeMaterialIds: detailList.value.map((item) => item.id) });
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
        materialCode: m.materialCode,
        materialName: m.materialName,
        materialCategory: m.materialCategory,
        brand: m.brand,
        model: m.model,
        currentStockQty: m.currentStockQty ?? m.stockQty, // 库存(接口 currentStockQty)
        baseUnitName: m.baseUnitName ?? m.unit, // 基准单位名
        availableApplyQty: isProjectMode.value ? Math.max(Number(m.availableApplyQty) || 0, 0) : undefined,
        unitQty: isProjectMode.value ? Math.max(Number(m.availableApplyQty) || 0, 0) : 1,
        unitName: m.unit || m.baseUnitName, // 项目用料固定计划单位，其余默认基准单位
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
    const issues = validateEditableRows(detailList.value, {
      selectorField: 'id',
      selectorLabel: '物料',
      optionLabel: (value) => detailList.value.find((item) => String(item.id) === String(value))?.materialName || String(value),
      rules: [
        { field: 'unitQty', label: '申请数量', required: true, validate: (value) => Number(value) > 0 || '申请数量必须大于 0' },
        { field: 'unitName', label: '单位', required: true },
      ],
    });
    if (issues.length) {
      createMessage.warning(issues[0].message);
      return null;
    }
    if (isProjectMode.value) {
      const overAvailable = detailList.value.find((d) => Number(d.unitQty) > Number(d.availableApplyQty || 0));
      if (overAvailable) {
        createMessage.warning(`「${overAvailable.materialName}」申请数量不能超过当前可申请数量 ${overAvailable.availableApplyQty}`);
        return null;
      }
    }
    const cur = getCurrentUser();
    const submitData: any = {
      applyType: 'OUT', // 领料 = 出库
      bizType: 'PICK', // 领料业务类型(后端扩展字段)
      usageType: usageType.value,
      applyUserId: cur.applyUserId,
      useDate: values.useDate,
      ...(usageType.value === MATERIAL_USAGE_TYPE.MAINTENANCE ? { repairOrderNo: String(values.repairOrderNo || '').trim() } : {}),
      remark: values.remark,
      itemList: detailList.value.map((d) => ({
        materialId: d.id,
        unitName: d.unitName,
        unitQty: d.unitQty,
      })),
    };
    if (isProjectMode.value) {
      if (!selectedPeriodId.value) {
        createMessage.warning('请选择分期项目');
        return null;
      }
      if (!isReworkMode.value && !participatedProjectPool.value.some((item) => String(item.periodId) === selectedPeriodId.value)) {
        createMessage.warning('请选择当前可领料的参与项目');
        return null;
      }
      submitData.periodId = selectedPeriodId.value;
      if (isReworkMode.value) submitData.reworkId = reworkId.value;
    }
    return submitData;
  }

  /** 提交领料申请(新增 or 重新提交) */
  async function handleSubmit() {
    const data = await buildSubmitData().catch(() => null); // 表单校验失败(vben validate reject)静默返回
    if (!data) return;
    submitLoading.value = true;
    try {
      if (editMode) {
        await updatePickApply({ ...data, id: applyId });
        createMessage.success('重新提交成功');
      } else {
        await submitPickApply(data);
        createMessage.success('领料申请提交成功');
      }
      draft.clear();
      await resetFields();
      detailList.value = [];
      await leaveCompletedForm();
    } finally {
      submitLoading.value = false;
    }
  }

  /** 取消 */
  function handleCancel() {
    draft.clear();
    void resetFields();
    detailList.value = [];
    void leaveCompletedForm();
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

    &__rework-tip {
      margin-bottom: 12px;
    }

    &__material-identity {
      display: flex;
      min-width: 0;
      gap: 12px;
      align-items: baseline;
      justify-content: space-between;
    }

    &__material-name {
      min-width: 0;
      overflow: hidden;
      color: #262626;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    &__material-code {
      max-width: 45%;
      overflow: hidden;
      color: #8c8c8c;
      font-size: 12px;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: none;
    }

    &__available {
      color: #1677ff;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  }
</style>
