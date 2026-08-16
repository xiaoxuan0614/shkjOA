<template>
  <div class="record-page">
    <a-tabs v-model:activeKey="activeKey" @change="handleTabChange">
      <!-- 出入库申请：领料/还料/采购 申请记录，库管审批/出库/入库/拒绝/挂起 + 申请人撤回/删除/修改 -->
      <a-tab-pane key="apply" tab="出入库申请">
        <BasicTable @register="registerApplyTable" :rowSelection="rowSelection">
          <template #tableTitle>
            <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handlePick">领料申请</a-button>
            <a-button type="primary" preIcon="ant-design:reload-outlined" @click="handleReturn">还料申请</a-button>
            <a-button v-if="selectedKeys.length" preIcon="ant-design:check-circle-outlined" @click="handleBatchApprove">批量审批</a-button>
            <a-button v-if="selectedKeys.length" @click="handleBatchOut">批量出库</a-button>
            <a-button v-if="selectedKeys.length" @click="handleBatchIn">批量入库</a-button>
            <a-button danger @click="handleBatchDelete">批量删除</a-button>
          </template>
          <template #action="{ record }">
            <TableAction :actions="getApplyActions(record)" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'bizType'">
              <a-tag :color="dictColor(bizMap, record.bizType)">{{ dictText(bizMap, record.bizType) }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'applyType'">
              <a-tag :color="dictColor(typeMap, record.applyType)">{{ dictText(typeMap, record.applyType) }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag :color="dictColor(statusMap, getStatusText(record))">{{ dictText(statusMap, getStatusText(record)) }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'executeStatus'">
              <a-tag :color="dictColor(execMap, record.executeStatus)">{{ dictText(execMap, record.executeStatus) }}</a-tag>
            </template>
          </template>
        </BasicTable>
      </a-tab-pane>

      <!-- 出入库台账(forceRender: 首次切 tab 时 handleTabChange 立即 reload，需表格已挂载注册) -->
      <a-tab-pane key="record" tab="出入库台账" forceRender>
        <BasicTable @register="registerRecordTable">
          <template #action="{ record }">
            <TableAction :actions="getRecordActions(record)" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'ioType'">
              <a-tag :color="dictColor(typeMap, record.ioType)">{{ dictText(typeMap, record.ioType) }}</a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'sourceType'">
              <a-tag :color="dictColor(sourceMap, record.sourceType)">{{ dictText(sourceMap, record.sourceType) }}</a-tag>
            </template>
          </template>
        </BasicTable>
      </a-tab-pane>
    </a-tabs>

    <!-- 明细逐条审批弹窗 -->
    <ApproveModal @register="registerApproveModal" @success="handleSuccess" />
    <!-- 整单批量审批弹窗 -->
    <BatchApproveModal @register="registerBatchApproveModal" @success="handleSuccess" />
    <!-- 出入库执行弹窗(明细维度) -->
    <StockExecuteModal @register="registerStockExecuteModal" @success="handleSuccess" />
    <!-- 出入库台账详情弹窗(该条台账涉及物料的全部详情) -->
    <IoRecordDetailModal @register="registerRecordDetailModal" />
    <!-- 申请明细抽屉(申请头 + 物料明细分页 + 审批记录分页) -->
    <ApplyDetailDrawer @register="registerDetailDrawer" />
  </div>
</template>

<script lang="ts" name="mtl-record" setup>
  import { ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useDrawer } from '/@/components/Drawer';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { applyColumns, recordColumns, searchFormSchema } from './data';
  import { list as listApply, queryItems, cancelApply, deleteApply, deleteBatchApply, executeApply } from './StockApply.api';
  import { list as listRecord } from './IoRecord.api';
  import { getCurrentUser, loadDictMap, loadMaterialMap, enrichMaterialInfo } from '../material.util';
  import ApproveModal from './components/ApproveModal.vue';
  import BatchApproveModal from './components/BatchApproveModal.vue';
  import StockExecuteModal from './components/StockExecuteModal.vue';
  import IoRecordDetailModal from './components/IoRecordDetailModal.vue';
  import ApplyDetailDrawer from '../components/ApplyDetailDrawer.vue';

  const router = useRouter();
  const { createMessage, createConfirm } = useMessage();
  const activeKey = ref('apply');

  // 当前登录人(判断"我的申请")
  const currentUser = getCurrentUser();

  // 后端数据字典（后台「系统管理→数据字典」配置，改后重新登录生效）
  // 状态码：PENDING 待审批 / PARTIAL_APPROVED 部分通过 / APPROVED 已通过 / REJECTED 已驳回 / WITHDRAWN 已撤回 / CANCELED 已取消
  type DictMap = Record<string, { text: string; color: string }>;
  const bizMap = ref<DictMap>({});
  const typeMap = ref<DictMap>({});
  const statusMap = ref<DictMap>({});
  const execMap = ref<DictMap>({});
  // 台账来源(apply 申请 / manual 手动 / stocktake 盘存)
  const sourceMap = ref<DictMap>({});
  onMounted(async () => {
    bizMap.value = await loadDictMap('stock_apply_biz_type');
    typeMap.value = await loadDictMap('stock_apply_type');
    statusMap.value = await loadDictMap('stock_apply_status');
    execMap.value = await loadDictMap('stock_execute_status');
    sourceMap.value = await loadDictMap('stock_io_source_type');
  });
  const dictText = (m: DictMap, v: string) => (v ? m[v]?.text || v : '—');
  const dictColor = (m: DictMap, v: string) => m[v]?.color || undefined;

  // 出入库申请表
  const { tableContext: applyCtx } = useListPage({
    tableProps: {
      title: '出入库申请',
      api: listApply,
      columns: applyColumns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
      },
      actionColumn: { width: 240, fixed: 'right' },
    },
  });
  const [registerApplyTable, { reload: reloadApply, setLoading: setApplyLoading }, { rowSelection, selectedRowKeys, selectedRows }] =
    applyCtx;

  // 出入库台账表
  const { tableContext: recordCtx } = useListPage({
    tableProps: {
      title: '出入库台账',
      api: listRecordWithMaterial,
      columns: recordColumns,
      canResize: true,
      actionColumn: { width: 90, fixed: 'right' },
    },
  });
  const [registerRecordTable, { reload: reloadRecord }] = recordCtx;

  // 台账物料富化：台账只回 materialId，按物料主表缓存补 物料编码/名称(listRecordWithMaterial 用)
  let materialMapLoaded = false;
  async function ensureMaterialMap() {
    if (materialMapLoaded) return;
    materialMapLoaded = true;
    try {
      await loadMaterialMap();
    } catch (e) {
      // 失败不阻塞列表，物料编码/名称留空
    }
  }

  /**
   * 台账列表包装：按 materialId 富化 物料编码/物料名称
   */
  async function listRecordWithMaterial(params: any) {
    await ensureMaterialMap();
    const res: any = await listRecord(params);
    const records = res?.records || (Array.isArray(res) ? res : []);
    enrichMaterialInfo(records);
    return res;
  }

  // 明细逐条审批弹窗
  const [registerApproveModal, { openModal }] = useModal();
  // 整单批量审批弹窗
  const [registerBatchApproveModal, { openModal: openBatchApproveModal }] = useModal();
  // 出入库执行弹窗(明细维度：勾选/部分出库/改数量/留痕/还料三层数量)
  const [registerStockExecuteModal, { openModal: openStockExecuteModal }] = useModal();
  // 申请明细抽屉(申请头 + 物料明细分页 + 审批记录分页)
  const [registerDetailDrawer, { openDrawer: openDetailDrawer }] = useDrawer();
  // 出入库台账详情弹窗(该条台账涉及物料的全部详情)
  const [registerRecordDetailModal, { openModal: openRecordDetailModal }] = useModal();

  const selectedKeys = selectedRowKeys;

  /** 领料申请：跳转领料申请页 */
  function handlePick() {
    router.push('/material/pick');
  }

  /** 还料申请：跳转还料申请页 */
  function handleReturn() {
    router.push('/material/return');
  }

  /** 查看申请明细(抽屉：申请头 + 物料明细 + 审批记录两个分页列表) */
  function handleDetail(record: Recordable) {
    openDetailDrawer(true, { record });
  }

  /** 台账详情：查看该条出入库记录涉及的物料全部详情(物料主表 + 单位换算 + 本次变动) */
  function handleRecordDetail(record: Recordable) {
    openRecordDetailModal(true, { record });
  }

  /** 台账行操作 */
  function getRecordActions(record) {
    return [{ label: '详情', onClick: handleRecordDetail.bind(null, record) }];
  }

  /** 审批/拒绝：打开弹窗(明细逐条 通过/驳回/暂不处理) */
  function handleApprove(record: Recordable) {
    openModal(true, { record });
  }

  /** 批量审批：勾选多条申请，整单批量 通过/驳回 */
  function handleBatchApprove() {
    openBatchApproveModal(true, { rows: selectedRows.value });
  }

  /** 是否当前登录人自己的申请(按 applyUserId，回退按申请人姓名) */
  function isMyApply(record: any) {
    if (currentUser.applyUserId && record.applyUserId) return record.applyUserId === currentUser.applyUserId;
    return !!record.applyUserName && record.applyUserName === currentUser.applyUserName;
  }

  /** 撤回：自己的待审批申请，库管未出库前可撤回(调 cancel，状态置「已撤回」) */
  function handleWithdraw(record: Recordable) {
    createConfirm({
      iconType: 'warning',
      title: '撤回申请',
      content: `确认撤回申请「${record.applyNo}」？撤回后状态变为「已撤回」，可修改后重新提交。`,
      onOk: () => cancelApply(record.id).then(handleSuccess),
    });
  }

  /** 删除：自己的 待审批/已撤回/已驳回/已取消 申请 */
  function handleDeleteApply(record: Recordable) {
    createConfirm({
      iconType: 'warning',
      title: '删除申请',
      content: `确认删除申请「${record.applyNo}」？删除后不可恢复。`,
      onOk: () => deleteApply(record.id).then(handleSuccess),
    });
  }

  /** 批量删除：仅删除自己的 待审批/已撤回 申请，其余跳过 */
  function handleBatchDelete() {
    const rows = (selectedRows.value || []).filter(
      (r: any) => isMyApply(r) && ['PENDING', 'WITHDRAWN'].includes(r.status)
    );
    if (!rows.length) {
      createMessage.warning('请勾选自己「待审批/已撤回」的申请');
      return;
    }
    const skipped = (selectedRows.value || []).length - rows.length;
    createConfirm({
      iconType: 'warning',
      title: '批量删除',
      content: `确认删除选中的 ${rows.length} 条申请？${skipped ? `（另有 ${skipped} 条非本人/不可删除已跳过）` : ''}`,
      onOk: () => deleteBatchApply(rows.map((r: any) => r.id)).then(handleSuccess),
    });
  }

  /** 修改：已撤回/已驳回的申请跳回对应申请页编辑(applyId)并重新提交 */
  function handleEditApply(record: Recordable) {
    const base = record.bizType === 'RETURN' ? '/material/return' : '/material/pick';
    router.push(`${base}?applyId=${record.id}`);
  }

  /** 出库/入库：打开出入库执行弹窗(明细维度：勾选部分/改数量/留痕/还料三层数量) */
  function openExecute(record: Recordable) {
    openStockExecuteModal(true, { record });
  }

  /** 批量出库(选中领料申请，逐条查明细后循环出库) */
  async function handleBatchOut() {
    await handleBatchIo('OUT');
  }

  /** 批量入库(选中还料申请，逐条查明细后循环入库) */
  async function handleBatchIn() {
    await handleBatchIo('IN');
  }

  /**
   * 批量出库/入库：选中记录逐条查明细分页接口(queryItems)，只处理「已通过/部分通过」的对应方向申请；
   * 每张申请一次 executeApply(已通过明细 → 剩余可执行数=申请−已执行 executedQty)；跳过已执行完的
   */
  async function handleBatchIo(ioType: 'IN' | 'OUT') {
    const rows = selectedRows.value;
    if (!rows?.length) {
      createMessage.warning('请先勾选申请');
      return;
    }
    const expectType = ioType === 'OUT' ? 'OUT' : 'IN';
    setApplyLoading(true);
    try {
      let count = 0;
      let skip = 0;
      for (const row of rows) {
        // 已通过 / 部分通过 的对应方向申请(状态码=后端英文码)
        if (!['APPROVED', 'PARTIAL_APPROVED'].includes(row.status) || row.applyType !== expectType) {
          skip++;
          continue;
        }
        // 明细分页接口(executedQty 已执行数直接返回，不再聚台账)；只执行已通过明细(status=APPROVED)
        const res: any = await queryItems({ applyId: row.id, pageNo: 1, pageSize: 500 });
        const records = res?.records || res || [];
        const items = records
          .filter((it: any) => it.status === 'APPROVED')
          .map((it: any) => {
            const applied = Number(it.applyQty ?? it.unitQty ?? 0);
            const executed = Number(it.executedQty ?? 0);
            return { itemId: it.id, executeQty: Math.max(applied - executed, 0) };
          })
          .filter((i: any) => i.executeQty > 0);
        if (!items.length) continue;
        await executeApply({ applyId: row.id, itemIds: items.map((i: any) => i.itemId), items });
        count++;
      }
      if (skip) createMessage.warning(`${skip} 条非「已通过${ioType === 'OUT' ? '领料' : '还料'}」申请已跳过`);
      createMessage.success(ioType === 'OUT' ? `批量出库完成，共执行 ${count} 张申请` : `批量入库完成，共执行 ${count} 张申请`);
      handleSuccess();
    } finally {
      setApplyLoading(false);
    }
  }

  /** 行操作(明细 + 库管动作 + 申请人动作)；状态码=后端英文码 PENDING/APPROVED/REJECTED/CANCELED */
  function getApplyActions(record) {
    const actions = [{ label: '明细', onClick: handleDetail.bind(null, record) }];
    const isMine = isMyApply(record);

    if (record.status === 'PENDING') {
      // 仅待审批显示审批按钮
      actions.push({ label: '审批', onClick: handleApprove.bind(null, record) });
      // 申请人：库管未出库前可撤回
      if (isMine) actions.push({ label: '撤回', onClick: handleWithdraw.bind(null, record) });
    } else if (record.status === 'PARTIAL_APPROVED') {
      // 部分通过：可执行已通过明细(部分已生效，不再审批)
      if (record.bizType === 'PICK' || record.applyType === 'OUT') actions.push({ label: '出库', onClick: openExecute.bind(null, record) });
      else actions.push({ label: '入库', onClick: openExecute.bind(null, record) });
    } else if (record.status === 'APPROVED') {
      // 领料=PICK 出库；还料=RETURN / 采购=PURCHASE 入库(回退 applyType)
      if (record.bizType === 'PICK' || record.applyType === 'OUT') actions.push({ label: '出库', onClick: openExecute.bind(null, record) });
      else actions.push({ label: '入库', onClick: openExecute.bind(null, record) });
    }

    // 申请人：已撤回/待审批/已驳回 可修改申请单后重新提交
    if (isMine && ['WITHDRAWN', 'REJECTED'].includes(record.status)) {
      actions.push({ label: '修改', onClick: handleEditApply.bind(null, record) });
    }
    // 申请人：待审批/已撤回 可删除（已驳回不可删）
    if (isMine && ['PENDING', 'WITHDRAWN'].includes(record.status)) {
      actions.push({ label: '删除', onClick: handleDeleteApply.bind(null, record) });
    }
    return actions;
  }

  /** 状态展示 */
  function getStatusText(record) {
    return record.status || '—';
  }

  /** 成功回调：刷新申请列表；台账仅在其 tab 激活时刷新(未激活的 tab 表格未挂载，调用会报错) */
  function handleSuccess() {
    reloadApply();
    if (activeKey.value === 'record') reloadRecord();
  }

  /** tab 切换：切到台账时刷新 */
  function handleTabChange(key: string) {
    if (key === 'record') reloadRecord();
  }
</script>

<style lang="less" scoped>
  .record-page {
    padding: 4px;
  }
</style>
