<template>
  <BasicDrawer v-bind="$attrs" @register="register" title="补料管理" :width="1180" :show-footer="false" destroyOnClose>
    <div class="material-supplement__header">
      <div>
        <div class="material-supplement__project">{{ projectTitle }}</div>
        <div class="material-supplement__hint">补料申请、审批和处理记录统一在当前页面办理。</div>
      </div>
      <a-button v-if="allowCreate && !creating" type="primary" preIcon="ant-design:plus-outlined" @click="startCreate">新增补料申请</a-button>
    </div>

    <template v-if="creating">
      <a-alert
        class="material-supplement__notice"
        type="info"
        show-icon
        message="本次补料按整张单据审批"
        description="审批通过后由系统补充到计划用料清单，原计划内容不可在此处直接修改。"
      />

      <section class="material-supplement__section">
        <div class="material-supplement__heading">
          <div>
            <h3>新增补料申请</h3>
            <span>请选择库内物料，并填写补料数量、单位和补料原因。</span>
          </div>
          <a-button @click="handleViewMaterialPlan">查看用料清单</a-button>
        </div>
        <MaterialPlanTable ref="supplementRef" :period-id="periodId" mode="supplement" :show-remark="false" />
        <div class="material-supplement__reason">
          <div class="material-supplement__reason-label"><span aria-hidden="true">*</span> 补料原因</div>
          <a-textarea v-model:value="supplementReason" :rows="3" :maxlength="500" show-count placeholder="请填写本张补料单的补料原因" />
        </div>
        <div class="material-supplement__form-actions">
          <a-button :disabled="submitting" @click="cancelCreate">取消</a-button>
          <a-button type="primary" :loading="submitting" @click="handleSubmit">提交补料申请</a-button>
        </div>
      </section>
    </template>

    <template v-else>
      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
        <a-tab-pane key="mine" tab="我的申请" />
        <a-tab-pane v-if="canApprove" key="pending">
          <template #tab>
            <a-badge :count="pendingCount" :overflow-count="99" :offset="[8, -2]">待我审批</a-badge>
          </template>
        </a-tab-pane>
        <a-tab-pane v-if="canApprove" key="history" tab="审批记录" />
      </a-tabs>

      <div v-if="activeTab === 'pending' && canApprove" class="material-supplement__batch-actions">
        <span>已选 {{ selectedOrderKeys.length }} 张</span>
        <a-button :disabled="!selectedOrderKeys.length" @click="prepareApproval(true)">批量通过</a-button>
        <a-button danger :disabled="!selectedOrderKeys.length" @click="prepareApproval(false)">批量驳回</a-button>
      </div>

      <a-alert v-if="!canApprove" class="material-supplement__scope-tip" type="info" show-icon message="当前仅显示本人提交的补料申请" />

      <a-table
        v-model:expandedRowKeys="expandedRowKeys"
        :columns="orderColumns"
        :data-source="displayOrders"
        :loading="loading"
        :pagination="false"
        :row-key="(record) => record.orderKey"
        :row-selection="activeTab === 'pending' && canApprove ? rowSelection : undefined"
        :scroll="{ x: activeTab === 'history' ? 1160 : activeTab === 'mine' ? 1040 : 980 }"
        size="middle"
        bordered
        @expand="handleExpand"
      >
        <template #emptyText><a-empty :description="emptyDescription" /></template>
        <template #expandedRowRender="{ record }">
          <div v-if="record.detailLoading" class="material-supplement__detail-loading"><a-spin size="small" /> 正在加载物料明细…</div>
          <a-table
            v-else
            :columns="materialColumns"
            :data-source="record.materials"
            :pagination="false"
            :row-key="(item, index) => item.id || item.materialId || index"
            size="small"
          >
            <template #emptyText><a-empty description="暂无物料明细" /></template>
            <template #bodyCell="{ column, record: material }">
              <template v-if="column.key === 'brand'">{{ getBrandText(material.brand) }}</template>
            </template>
          </a-table>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatus(record).color">{{ getStatus(record).text }}</a-tag>
          </template>
          <template v-else-if="column.key === 'materialSummary'">
            <span v-if="record.detailLoaded">{{ record.materials.length }} 种 / 合计 {{ record.totalQty }}</span>
            <a-button v-else type="link" size="small" @click="expandOrder(record)">展开查看</a-button>
          </template>
          <template v-else-if="column.key === 'reason'">
            <a-tooltip :title="record.reason"
              ><span class="material-supplement__ellipsis">{{ record.reason || '—' }}</span></a-tooltip
            >
          </template>
          <template v-else-if="column.key === 'approvalReason'">
            <a-tooltip :title="record.approvalReason"
              ><span class="material-supplement__ellipsis">{{ record.approvalReason || '—' }}</span></a-tooltip
            >
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="prepareApproval(true, record)">通过</a-button>
            <a-button type="link" size="small" danger @click="prepareApproval(false, record)">驳回</a-button>
          </template>
        </template>
      </a-table>
    </template>

    <BasicModal @register="registerMaterialPreview" title="用料清单预览" :width="1100" :showOkBtn="false" cancelText="关闭" destroyOnClose>
      <DetailMaterial v-if="previewPeriodId" :project-id="previewPeriodId" />
    </BasicModal>

    <a-modal
      v-model:open="approvalVisible"
      :title="approvalApproved ? '确认通过补料单' : '驳回补料单'"
      :okText="approvalApproved ? '确认通过' : '确认驳回'"
      :confirm-loading="approving"
      @ok="submitApproval"
    >
      <a-alert
        class="material-supplement__confirm-tip"
        type="info"
        show-icon
        :message="`本次将${approvalApproved ? '通过' : '驳回'} ${pendingOrders.length} 张补料单`"
      />
      <a-textarea
        v-if="!approvalApproved"
        v-model:value="approvalReason"
        :rows="4"
        :maxlength="500"
        show-count
        placeholder="请填写统一驳回原因（必填）"
      />
    </a-modal>
  </BasicDrawer>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { BasicModal, useModal } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { getApprovalStatusMeta, isApprovalApproved, isApprovalPending, isApprovalRejected } from '/@/utils/approvalStatus';
  import { enrichMaterialInfo, getCurrentUser, loadDictMap, loadMaterialMap } from '/@/views/material/material.util';
  import MaterialPlanTable from '/@/views/plan/components/MaterialPlanTable.vue';
  import DetailMaterial from '../detail/components/DetailMaterial.vue';
  import {
    addProjectMaterialApplies,
    approveProjectMaterialApply,
    approveProjectMaterialAppliesBatch,
    getProjectMaterialApplyDetail,
    getProjectMaterialApplies,
  } from '../Project.api';
  import { getMaterials } from '../detail/ProjectDetail.api';

  type SupplementTab = 'mine' | 'pending' | 'history';

  interface SupplementOrder extends Recordable {
    orderKey: string;
    applicationId: string;
    materials: Recordable[];
    totalQty: string;
    reason: string;
    detailLoaded: boolean;
    detailLoading: boolean;
  }

  const APPROVE_PERMISSION = 'project:materialApply:approve';
  const emit = defineEmits(['register', 'success']);
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const canApprove = computed(() => hasPermission(APPROVE_PERMISSION));
  const currentUserId = computed(() => getCurrentUser().applyUserId);

  const periodId = ref('');
  const previewPeriodId = ref('');
  const projectName = ref('');
  const periodName = ref('');
  const allowCreate = ref(false);
  const creating = ref(false);
  const activeTab = ref<SupplementTab>('mine');
  const planRecords = ref<Recordable[]>([]);
  const orders = ref<SupplementOrder[]>([]);
  const selectedOrderKeys = ref<string[]>([]);
  const expandedRowKeys = ref<string[]>([]);
  const targetBizId = ref('');
  const loading = ref(false);
  const submitting = ref(false);
  const supplementRef = ref();
  const supplementReason = ref('');
  const brandMap = ref<Record<string, { text: string; color: string }>>({});

  const approvalVisible = ref(false);
  const approvalApproved = ref(true);
  const approvalReason = ref('');
  const pendingOrders = ref<SupplementOrder[]>([]);
  const approving = ref(false);

  const [registerMaterialPreview, { openModal: openMaterialPreview }] = useModal();

  const projectTitle = computed(() => [projectName.value || '项目补料', periodName.value].filter(Boolean).join(' / '));
  const myOrders = computed(() => orders.value.filter((record) => isCurrentUserApplication(record)));
  const pendingApprovalOrders = computed(() => orders.value.filter((record) => isApprovalPending(record.approvalStatus ?? record.status)));
  const approvalHistoryOrders = computed(() =>
    orders.value.filter(
      (record) => isApprovalApproved(record.approvalStatus ?? record.status) || isApprovalRejected(record.approvalStatus ?? record.status)
    )
  );
  const pendingCount = computed(() => pendingApprovalOrders.value.length);
  const displayOrders = computed(() => {
    if (activeTab.value === 'pending' && canApprove.value) return pendingApprovalOrders.value;
    if (activeTab.value === 'history' && canApprove.value) return approvalHistoryOrders.value;
    return myOrders.value;
  });
  const emptyDescription = computed(() => {
    if (activeTab.value === 'pending') return '当前没有待审批补料单';
    if (activeTab.value === 'history') return '当前没有补料审批记录';
    return '当前没有本人提交的补料申请';
  });
  const rowSelection = computed(() => ({
    selectedRowKeys: selectedOrderKeys.value,
    onChange: (keys: string[]) => (selectedOrderKeys.value = keys),
  }));
  const orderColumns = computed(() => {
    const columns: Recordable[] = [
      { title: '状态', key: 'status', width: 105 },
      { title: '申请人', dataIndex: 'applyUserName', width: 120 },
      { title: '申请时间', dataIndex: 'applyTime', width: 180 },
      { title: '物料汇总', key: 'materialSummary', width: 150 },
      { title: '补料原因', key: 'reason', width: 240 },
    ];
    if (activeTab.value === 'history') {
      columns.push(
        { title: '审批人', dataIndex: 'approvalUserName', width: 120 },
        { title: '审批时间', dataIndex: 'approvalTime', width: 180 },
        { title: '审批意见', key: 'approvalReason', width: 220 }
      );
    } else if (activeTab.value === 'mine') {
      columns.push({ title: '审批意见', key: 'approvalReason', width: 220 });
    }
    if (activeTab.value === 'pending' && canApprove.value) {
      columns.push({ title: '操作', key: 'action', width: 120, align: 'center', fixed: 'right' });
    }
    return columns;
  });
  const materialColumns = [
    { title: '物料编码', dataIndex: 'materialCode', width: 140 },
    { title: '物料类别', dataIndex: 'materialCategory', width: 120 },
    { title: '物料名称', dataIndex: 'materialName', width: 180 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 120 },
    { title: '规格型号', dataIndex: 'model', width: 150 },
    { title: '单位', dataIndex: 'unit', width: 90, align: 'center' },
    { title: '补料数量', dataIndex: 'applyQty', width: 110, align: 'right' },
  ];

  const [register] = useDrawerInner(async (data) => {
    const record = data?.record || data || {};
    periodId.value = String(data?.periodId || record.periodId || record.id || record.actionParams?.periodId || '');
    projectName.value = data?.projectName || record.projectName || record.title || '';
    periodName.value = data?.periodName || record.periodName || '';
    targetBizId.value = String(data?.targetBizId || record.bizId || '');
    allowCreate.value = data?.allowCreate ?? ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED'].includes(String(record.status || ''));
    const requestedTab = String(data?.initialTab || (targetBizId.value ? 'pending' : 'mine')) as SupplementTab;
    activeTab.value = canApprove.value && ['pending', 'history'].includes(requestedTab) ? requestedTab : 'mine';
    creating.value = Boolean(data?.initialCreate && allowCreate.value);
    supplementReason.value = '';
    previewPeriodId.value = '';
    planRecords.value = [];
    orders.value = [];
    selectedOrderKeys.value = [];
    expandedRowKeys.value = [];
    approvalVisible.value = false;
    supplementRef.value?.reset?.();
    if (!periodId.value) {
      createMessage.error('缺少项目分期 ID，无法加载补料管理');
      return;
    }
    await Promise.all([loadOrders(), loadBrandMap(), allowCreate.value ? loadPlanRecords() : Promise.resolve()]);
    if (targetBizId.value && canApprove.value) await locateTargetOrder();
  });

  function isCurrentUserApplication(record: Recordable) {
    const applicantId = String(record.applyUserId ?? record.createBy ?? '');
    return Boolean(currentUserId.value && applicantId === currentUserId.value);
  }

  function getStatus(record: Recordable) {
    return getApprovalStatusMeta(record.approvalStatus ?? record.status);
  }

  function getBrandText(value: unknown) {
    const rawValue = String(value ?? '');
    return brandMap.value[rawValue]?.text || rawValue || '—';
  }

  function toOrder(record: Recordable): SupplementOrder {
    const applicationId = String(record.id || '');
    const materials = Array.isArray(record.items) ? record.items : [];
    return {
      ...record,
      orderKey: applicationId,
      applicationId,
      materials,
      applyUserName: record.applyUserName || '—',
      applyTime: record.applyTime || record.createTime || '—',
      reason: record.applyReason || '',
      detailLoaded: materials.length > 0,
      detailLoading: false,
      totalQty: calculateTotalQty(materials),
    };
  }

  function calculateTotalQty(materials: Recordable[]) {
    return materials.reduce((sum, item) => sum + (Number(item.applyQty) || 0), 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  }

  async function loadOrders() {
    loading.value = true;
    try {
      const [result, materialMap]: any[] = await Promise.all([
        getProjectMaterialApplies({ periodId: periodId.value, pageNo: 1, pageSize: 1000 }),
        loadMaterialMap({ force: true }),
      ]);
      const records: Recordable[] = Array.isArray(result) ? result : result?.records || [];
      records.forEach((record) => enrichMaterialInfo(record.items, materialMap));
      const visibleRecords = canApprove.value ? records : records.filter((record) => isCurrentUserApplication(record));
      orders.value = visibleRecords.filter((record) => record.id).map(toOrder);
    } catch (error: any) {
      orders.value = [];
      createMessage.error(error?.message || '补料申请加载失败');
    } finally {
      loading.value = false;
    }
  }

  async function loadBrandMap() {
    brandMap.value = await loadDictMap('material_brand');
  }

  async function loadPlanRecords() {
    try {
      const result: any = await getMaterials({ periodId: periodId.value, pageNo: 1, pageSize: 1000 });
      planRecords.value = Array.isArray(result) ? result : result?.records || [];
    } catch {
      planRecords.value = [];
    }
  }

  async function loadOrderDetail(order: SupplementOrder) {
    if (order.detailLoaded || order.detailLoading || !order.applicationId) return;
    order.detailLoading = true;
    try {
      const detail: any = await getProjectMaterialApplyDetail({ id: order.applicationId });
      const materials = Array.isArray(detail?.items) ? detail.items : [];
      const materialMap = await loadMaterialMap();
      enrichMaterialInfo(materials, materialMap);
      Object.assign(order, detail || {}, { materials, detailLoaded: true, totalQty: calculateTotalQty(materials) });
    } catch (error: any) {
      createMessage.error(error?.message || '补料物料明细加载失败');
    } finally {
      order.detailLoading = false;
    }
  }

  async function handleExpand(expanded: boolean, record: SupplementOrder) {
    if (expanded) await loadOrderDetail(record);
  }

  async function expandOrder(record: SupplementOrder) {
    if (!expandedRowKeys.value.includes(record.orderKey)) expandedRowKeys.value = [...expandedRowKeys.value, record.orderKey];
    await loadOrderDetail(record);
  }

  async function locateTargetOrder() {
    const targetOrder = orders.value.find((order) => order.applicationId === targetBizId.value);
    if (!targetOrder) return;
    if (isApprovalPending(targetOrder.approvalStatus ?? targetOrder.status)) activeTab.value = 'pending';
    else if (
      isApprovalApproved(targetOrder.approvalStatus ?? targetOrder.status) ||
      isApprovalRejected(targetOrder.approvalStatus ?? targetOrder.status)
    ) {
      activeTab.value = 'history';
    }
    await expandOrder(targetOrder);
  }

  function handleTabChange() {
    selectedOrderKeys.value = [];
  }

  function startCreate() {
    creating.value = true;
    supplementReason.value = '';
    supplementRef.value?.reset?.();
  }

  function cancelCreate() {
    creating.value = false;
    supplementReason.value = '';
    supplementRef.value?.reset?.();
  }

  function handleViewMaterialPlan() {
    if (!periodId.value) {
      createMessage.error('缺少项目分期 ID，无法查看用料清单');
      return;
    }
    previewPeriodId.value = periodId.value;
    openMaterialPreview(true);
  }

  async function handleSubmit() {
    let records: Recordable[] = [];
    try {
      records = supplementRef.value?.getData?.() || [];
    } catch (error: any) {
      createMessage.warning(error?.message || '请检查补料物料明细');
      return;
    }
    if (!records.length) {
      createMessage.warning('请先添加本次需要补充的物料');
      return;
    }
    const reason = supplementReason.value.trim();
    if (!reason) {
      createMessage.warning('请填写本张补料单的补料原因');
      return;
    }
    const planIdMap = new Map(planRecords.value.map((item: Recordable) => [String(item.materialId), item.id]));
    submitting.value = true;
    try {
      await addProjectMaterialApplies({
        apply: { periodId: periodId.value, applyReason: reason },
        items: records.map((item: Recordable) => ({
          ...(planIdMap.get(String(item.materialId)) ? { materialPlanId: planIdMap.get(String(item.materialId)) } : {}),
          materialId: item.materialId,
          materialCategory: item.materialCategory,
          materialName: item.materialName,
          materialCode: item.materialCode || item.code,
          brand: item.brand,
          model: item.model,
          applyQty: Number(item.plannedQty),
          unit: item.unit,
        })),
      });
      createMessage.success('补料申请已提交，等待审批');
      creating.value = false;
      activeTab.value = 'mine';
      supplementRef.value?.reset?.();
      supplementReason.value = '';
      await loadOrders();
      emit('success');
    } finally {
      submitting.value = false;
    }
  }

  function prepareApproval(approved: boolean, order?: SupplementOrder) {
    if (!canApprove.value) {
      createMessage.warning('当前账号无补料审批权限');
      return;
    }
    const selected = order ? [order] : pendingApprovalOrders.value.filter((item) => selectedOrderKeys.value.includes(item.orderKey));
    if (!selected.length) {
      createMessage.warning('请先选择需要审批的补料单');
      return;
    }
    pendingOrders.value = selected;
    approvalApproved.value = approved;
    approvalReason.value = '';
    approvalVisible.value = true;
  }

  async function submitApproval() {
    if (!canApprove.value) return;
    const reason = approvalReason.value.trim();
    if (!approvalApproved.value && !reason) {
      createMessage.warning('请填写驳回原因');
      return;
    }
    const ids = Array.from(new Set(pendingOrders.value.map((order) => order.applicationId).filter(Boolean)));
    if (!ids.length) {
      createMessage.warning('所选补料单缺少申请单 ID');
      return;
    }
    approving.value = true;
    try {
      const approvalPayload = { approved: approvalApproved.value, ...(reason ? { approvalReason: reason } : {}) };
      if (ids.length === 1) await approveProjectMaterialApply({ id: ids[0], ...approvalPayload });
      else await approveProjectMaterialAppliesBatch({ ids, ...approvalPayload });
      createMessage.success(approvalApproved.value ? '补料单审批已通过' : '补料单已驳回');
      approvalVisible.value = false;
      selectedOrderKeys.value = [];
      await loadOrders();
      activeTab.value = 'history';
      emit('success');
    } finally {
      approving.value = false;
    }
  }
</script>

<style lang="less" scoped>
  .material-supplement {
    &__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }

    &__project {
      color: #262626;
      font-size: 16px;
      font-weight: 600;
    }

    &__hint {
      margin-top: 4px;
      color: #595959;
      font-size: 13px;
    }

    &__notice,
    &__scope-tip {
      margin-bottom: 16px;
    }

    &__heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;

      > div {
        min-width: 0;
      }

      h3 {
        margin: 0;
        color: #262626;
        font-size: 16px;
        font-weight: 600;
      }

      span {
        display: block;
        margin-top: 4px;
        color: #595959;
        font-size: 13px;
      }
    }

    &__reason {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      margin-top: 18px;

      &-label {
        color: #262626;
        font-weight: 500;
        line-height: 32px;

        span {
          color: #ff4d4f;
        }
      }
    }

    &__form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 20px;
    }

    &__batch-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin: -4px 0 12px;

      span {
        margin-right: 4px;
        color: #595959;
      }
    }

    &__ellipsis {
      display: inline-block;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
    }

    &__detail-loading {
      padding: 20px;
      color: #595959;
      text-align: center;
    }

    &__confirm-tip {
      margin-bottom: 16px;
    }
  }

  @media (max-width: 768px) {
    .material-supplement {
      &__header,
      &__heading {
        flex-direction: column;
      }

      &__reason {
        grid-template-columns: 1fr;
        gap: 6px;
      }

      &__batch-actions {
        flex-wrap: wrap;
        justify-content: flex-start;
      }
    }
  }
</style>
