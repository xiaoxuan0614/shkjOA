<template>
  <BasicDrawer v-bind="$attrs" @register="register" title="申请明细" :width="1000">
    <div v-if="detail.applyNo || detail.id" class="apply-detail">
      <!-- 申请头信息(申请单号/业务类型/方向/审批状态/执行状态等，queryById) -->
      <a-descriptions :column="3" size="small" bordered class="apply-detail__desc">
        <a-descriptions-item label="申请单号">{{ detail.applyNo || '—' }}</a-descriptions-item>
        <a-descriptions-item label="业务类型">
          <a-tag :color="dictColor(bizMap, detail.bizType)">{{ dictText(bizMap, detail.bizType) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="出入库方向">
          <a-tag :color="dictColor(typeMap, detail.applyType)">{{ dictText(typeMap, detail.applyType) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="审批状态">
          <a-tag :color="dictColor(statusMap, detail.status)">{{ dictText(statusMap, detail.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="执行状态">
          <a-tag :color="dictColor(execMap, detail.executeStatus)">{{ dictText(execMap, detail.executeStatus) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="申请人">{{ detail.applyUserName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="部门">{{ detail.deptName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="项目">{{ detail.projectName || detail.projectNo || '—' }}</a-descriptions-item>
        <a-descriptions-item v-if="detail.supplierName" label="供应商">{{ detail.supplierName }}</a-descriptions-item>
        <a-descriptions-item v-if="detail.returnUser" label="还料人">{{ detail.returnUser }}</a-descriptions-item>
        <a-descriptions-item v-if="detail.expressNo" label="快递单号">{{ detail.expressNo }}</a-descriptions-item>
        <a-descriptions-item v-if="detail.totalAmount != null" label="采购总价">￥{{ detail.totalAmount }}</a-descriptions-item>
        <a-descriptions-item label="使用日期">{{ detail.useDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="创建人">{{ detail.createBy || '—' }}</a-descriptions-item>
        <a-descriptions-item label="创建时间">{{ detail.createTime || '—' }}</a-descriptions-item>
        <a-descriptions-item label="备注" :span="3">{{ detail.remark || '—' }}</a-descriptions-item>
      </a-descriptions>

      <!-- 物料明细 / 审批记录 分页列表 -->
      <a-tabs v-model:activeKey="tabKey" @change="handleTabChange">
        <a-tab-pane key="items" tab="物料明细" forceRender>
          <BasicTable @register="registerItemsTable">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'applyQty'">
                {{ record.applyQty ?? record.unitQty ?? 0 }}
              </template>
              <template v-else-if="column.dataIndex === 'status'">
                <a-tag :color="dictColor(itemStatusMap, record.status)">{{ dictText(itemStatusMap, record.status) }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'executeStatus'">
                <a-tag :color="dictColor(execMap, record.executeStatus)">{{ dictText(execMap, record.executeStatus) }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'executeUserName'">
                <!-- 全局规定第 3 条：id 对应人名展示，后端姓名优先 -->
                {{ userMap[record.executeUserId] || record.executeUserName || '—' }}
              </template>
            </template>
          </BasicTable>
        </a-tab-pane>
        <a-tab-pane key="approvals" tab="审批记录" forceRender>
          <BasicTable @register="registerApprovalsTable">
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'approvalResult'">
                <a-tag :color="dictColor(resultMap, record.approvalResult)">{{ dictText(resultMap, record.approvalResult) }}</a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'approvalUserName'">
                <!-- 全局规定第 3 条：id 对应人名展示，后端姓名优先 -->
                {{ userMap[record.approvalUserId] || record.approvalUserName || '—' }}
              </template>
            </template>
          </BasicTable>
        </a-tab-pane>
      </a-tabs>
    </div>
    <div v-else class="apply-detail__empty">未获取到申请明细</div>
  </BasicDrawer>
</template>

<script lang="ts" name="mtl-apply-detail-drawer" setup>
  import { ref, nextTick } from 'vue';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { BasicTable } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { queryById, queryItems, queryApprovals } from '../record/StockApply.api';
  import { loadDictMap, loadUserMap } from '../material.util';

  // 只读明细抽屉，无对外事件(register 由 useDrawerInner 提供)
  defineEmits(['register']);

  const detail = ref<any>({});
  const applyId = ref<string>('');
  const tabKey = ref('items');

  // 后端数据字典(系统管理→数据字典 配置，前端只读展示，不写死)
  type DictMap = Record<string, { text: string; color: string }>;
  const bizMap = ref<DictMap>({});
  const typeMap = ref<DictMap>({});
  const statusMap = ref<DictMap>({});
  const execMap = ref<DictMap>({});
  const itemStatusMap = ref<DictMap>({});
  const resultMap = ref<DictMap>({});
  const dictText = (m: DictMap, v: string) => (v ? m[v]?.text || v : '—');
  const dictColor = (m: DictMap, v: string) => m[v]?.color || undefined;

  const [register, { setDrawerProps }] = useDrawerInner(async (data) => {
    detail.value = {};
    const id = data?.record?.id;
    if (!id) return;
    applyId.value = String(id);
    setDrawerProps({ loading: true });
    try {
      // 详情字段缺失时用列表行数据兜底
      const res: any = await queryById({ id });
      detail.value = { ...(data.record || {}), ...(res || {}) };
      // 正文由 v-if="detail.xxx" 控制，需等表格挂载注册后再 reload(否则 getTableInstance 未注册，首次请求丢失)
      await nextTick();
      // 打开时刷新两个分页列表
      await Promise.all([reloadItems(), reloadApprovals()]);
    } finally {
      setDrawerProps({ loading: false });
    }
  });

  // 打开时加载字典
  loadDictMap('stock_apply_biz_type').then((m) => (bizMap.value = m));
  loadDictMap('stock_apply_type').then((m) => (typeMap.value = m));
  loadDictMap('stock_apply_status').then((m) => (statusMap.value = m));
  loadDictMap('stock_execute_status').then((m) => (execMap.value = m));
  loadDictMap('stock_item_status').then((m) => (itemStatusMap.value = m));
  loadDictMap('approval_result').then((m) => (resultMap.value = m));

  // 用户 id → 姓名(审批人/执行人展示；全局规定第 3 条：列表展示 id 对应的人名)
  const userMap = ref<Record<string, string>>({});
  loadUserMap().then((m) => (userMap.value = m));

  // 物料明细分页列表(出入库申请-明细分页列表 /stock/apply/items)
  const itemColumns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 150 },
    { title: '类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 90 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 90 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 110 },
    { title: '单位', dataIndex: 'unitName', key: 'unitName', width: 70 },
    { title: '申请数量', key: 'applyQty', width: 90 },
    { title: '审批状态', dataIndex: 'status', key: 'status', width: 100 },
    { title: '已执行数量', dataIndex: 'executedQty', key: 'executedQty', width: 90 },
    { title: '执行状态', dataIndex: 'executeStatus', key: 'executeStatus', width: 100 },
    { title: '执行人', dataIndex: 'executeUserName', key: 'executeUserName', width: 100 },
    { title: '执行时间', dataIndex: 'executeTime', key: 'executeTime', width: 150 },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
  ];

  const { tableContext: itemsCtx } = useListPage({
    tableProps: {
      api: (params) => queryItems({ ...params, applyId: applyId.value }),
      columns: itemColumns,
      // 抽屉内不展示查询表单/表格设置；immediate:false 避免打开前发请求
      useSearchForm: false,
      showTableSetting: false,
      canResize: false,
      immediate: false,
    },
  });
  const [registerItemsTable, { reload: reloadItems }] = itemsCtx;

  // 审批记录分页列表(出入库申请-审批记录分页列表 /stock/apply/approvals)
  const approvalColumns = [
    // { title: '审批节点', dataIndex: 'nodeName', key: 'nodeName', width: 120 },
    { title: '审批物料', dataIndex: 'materialName', key: 'materialName', width: 150 },
    { title: '审批人', dataIndex: 'approvalUserName', key: 'approvalUserName', width: 100 },
    { title: '审批结果', dataIndex: 'approvalResult', key: 'approvalResult', width: 100 },
    { title: '审批备注', dataIndex: 'approvalComment', key: 'approvalComment' },
    { title: '审批时间', dataIndex: 'approvalTime', key: 'approvalTime', width: 160 },
  ];

  const { tableContext: approvalsCtx } = useListPage({
    tableProps: {
      api: (params) => queryApprovals({ ...params, applyId: applyId.value }),
      columns: approvalColumns,
      useSearchForm: false,
      showTableSetting: false,
      canResize: false,
      immediate: false,
    },
  });
  const [registerApprovalsTable, { reload: reloadApprovals }] = approvalsCtx;

  /** tab 切换：切回该页时刷新 */
  function handleTabChange(key: string) {
    if (key === 'items') reloadItems();
    if (key === 'approvals') reloadApprovals();
  }
</script>

<style lang="less" scoped>
  .apply-detail {
    &__desc {
      margin-bottom: 8px;
    }

    &__empty {
      color: #999;
      text-align: center;
      padding: 40px 0;
    }
  }
</style>
