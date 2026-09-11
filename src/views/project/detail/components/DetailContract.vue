<template>
  <a-spin :spinning="loading">
    <a-result v-if="loadFailed" status="warning" title="合同信息加载失败" sub-title="请检查网络后重新加载">
      <template #extra>
        <a-button type="primary" @click="load">重新加载</a-button>
      </template>
    </a-result>

    <a-empty v-else-if="!hasContract" description="暂无合同信息" />

    <div v-else class="detail-contract">
      <section class="detail-contract__section" aria-labelledby="contract-main-title">
        <h3 id="contract-main-title" class="detail-contract__title">合同主信息</h3>
        <a-descriptions :column="{ xs: 1, sm: 1, md: 2, xl: 3 }" bordered size="middle">
          <a-descriptions-item label="合同编号">{{ contract.contractNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同名称">{{ contract.contractName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同类型">{{ contractTypeText }}</a-descriptions-item>
          <a-descriptions-item label="审批状态">
            <a-tag :color="contractStatusMeta.color">{{ contractStatusMeta.text }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="合同签订日期">{{ contract.contractSignedDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="计划交付日期">{{ contract.plannedDeliveryDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="项目金额">{{ formatAmount(contract.contractAmount) }}</a-descriptions-item>
          <a-descriptions-item label="累计已回款">{{ formatAmount(contract.receivedAmount) }}</a-descriptions-item>
          <a-descriptions-item label="质保期">
            {{ contract.warrantyPeriod != null ? `${contract.warrantyPeriod} 月` : '—' }}
          </a-descriptions-item>
          <a-descriptions-item label="质保结束日期">{{ contract.warrantyEndDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="销售负责人">{{ salesUserText }}</a-descriptions-item>
          <a-descriptions-item label="项目经理">{{ projectManagerText }}</a-descriptions-item>
          <a-descriptions-item label="合同附件" :span="3">
            <a-button
              v-if="contractFileId"
              type="link"
              size="small"
              preIcon="ant-design:eye-outlined"
              @click="previewFileInModal(contractFileId, contractFileName)"
            >
              预览：{{ contractFileName }}
            </a-button>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item label="合同货物清单" :span="3">
            <a-button
              v-if="materialFileId"
              type="link"
              size="small"
              preIcon="ant-design:eye-outlined"
              @click="previewFileInModal(materialFileId, materialFileName)"
            >
              预览：{{ materialFileName }}
            </a-button>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item v-if="contractStatusMeta.rejected" label="驳回原因" :span="3">
            {{ contract.approvalReason || '未填写驳回原因' }}
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="3">{{ contract.remark || '—' }}</a-descriptions-item>
        </a-descriptions>
      </section>

      <section class="detail-contract__section" aria-labelledby="contract-payment-title">
        <h3 id="contract-payment-title" class="detail-contract__title">回款计划</h3>
        <a-table
          :columns="paymentColumns"
          :data-source="paymentRows"
          :row-key="(record) => record.id || record._key"
          :pagination="false"
          :scroll="{ x: 1000 }"
          size="middle"
          bordered
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'index'">{{ record._key }}</template>
            <template v-else-if="column.key === 'paymentNode'">{{ getPaymentNodeText(record.paymentNode) }}</template>
            <template v-else-if="column.key === 'ratio'">{{ record.ratio != null ? `${record.ratio}%` : '—' }}</template>
            <template v-else-if="column.key === 'rollbackTime'">
              {{ `${record.rollbackTime == null ? 7 : record.rollbackTime} 天` }}
            </template>
            <template v-else-if="column.key === 'plannedAmount'">{{ formatAmount(record.plannedAmount) }}</template>
            <template v-else-if="column.key === 'actualAmount'">{{ formatAmount(record.actualAmount) }}</template>
            <template v-else-if="['plannedDate', 'paymentDate', 'remark'].includes(column.dataIndex)">
              {{ record[column.dataIndex] || '—' }}
            </template>
          </template>
        </a-table>
      </section>
    </div>
  </a-spin>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue';
  import { getContractDetail } from '../ProjectDetail.api';
  import { loadDictOptions } from '../../Project.data';
  import { loadUserOptions, type UserOption } from '/@/views/resource/userOptions';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';

  const props = defineProps<{
    projectId: string;
    project?: Recordable;
  }>();

  const loading = ref(false);
  const loadFailed = ref(false);
  const contract = ref<Recordable>({});
  const paymentRows = ref<Recordable[]>([]);
  const contractTypeMap = ref<Record<string, string>>({});
  const paymentNodeMap = ref<Record<string, string>>({});
  const userOptions = ref<UserOption[]>([]);
  let rowSeed = 0;
  let loadSequence = 0;

  const hasContract = computed(() => !!contract.value.id || !!contract.value.contractName);
  const contractStatusMeta = computed(() => getApprovalStatusMeta(contract.value.status));
  const contractTypeText = computed(() => mapDictionaryValue(contract.value.contractType, contractTypeMap.value));
  const salesUserText = computed(() => resolveSalesUserText());
  const projectManagerText = computed(() => resolveUserText(contract.value.projectManagerUserName, contract.value.projectManagerUserId));

  const contractFileId = computed(() => contract.value.contractFile?.fileId || contract.value.contractFileId || '');
  const contractFileName = computed(
    () => contract.value.contractFile?.fileName || contract.value.contractFileName || getFileName(contractFileId.value, '合同附件')
  );
  const materialFileId = computed(() => contract.value.materialFile?.fileId || contract.value.materialFileId || '');
  const materialFileName = computed(
    () => contract.value.materialFile?.fileName || contract.value.materialFileName || getFileName(materialFileId.value, '合同货物清单')
  );

  const paymentColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '回款项', dataIndex: 'paymentNode', key: 'paymentNode', width: 150 },
    { title: '比例', dataIndex: 'ratio', key: 'ratio', width: 100 },
    { title: '回款周期', dataIndex: 'rollbackTime', key: 'rollbackTime', width: 120 },
    { title: '计划回款金额', dataIndex: 'plannedAmount', key: 'plannedAmount', width: 150 },
    { title: '实际回款金额', dataIndex: 'actualAmount', key: 'actualAmount', width: 150 },
    { title: '计划回款日期', dataIndex: 'plannedDate', width: 140 },
    { title: '实际回款日期', dataIndex: 'paymentDate', width: 140 },
    { title: '备注', dataIndex: 'remark', width: 180 },
  ];

  async function load() {
    const periodId = props.projectId;
    if (!periodId) return;
    const currentSequence = ++loadSequence;
    loading.value = true;
    loadFailed.value = false;
    try {
      const [contractResult, contractTypeResult, paymentNodeResult, userResult] = await Promise.allSettled([
        getContractDetail({ periodId }),
        loadDictOptions('contract_type'),
        loadDictOptions('payback_node'),
        loadUserOptions(true),
      ]);
      if (currentSequence !== loadSequence) return;
      if (contractResult.status === 'rejected') throw contractResult.reason;
      const detail = contractResult.value || {};
      contract.value = detail;
      contractTypeMap.value = toOptionMap(contractTypeResult.status === 'fulfilled' ? contractTypeResult.value : []);
      paymentNodeMap.value = toOptionMap(paymentNodeResult.status === 'fulfilled' ? paymentNodeResult.value : []);
      userOptions.value = userResult.status === 'fulfilled' ? userResult.value : [];
      rowSeed = 0;
      paymentRows.value = (Array.isArray(detail.records) ? detail.records : []).map((record) => ({
        ...record,
        _key: ++rowSeed,
        paymentNode: record.paymentNode ?? record.node,
        plannedAmount: record.plannedAmount ?? record.amount,
      }));
    } catch {
      if (currentSequence !== loadSequence) return;
      contract.value = {};
      paymentRows.value = [];
      loadFailed.value = true;
    } finally {
      if (currentSequence === loadSequence) loading.value = false;
    }
  }

  function toOptionMap(options: any[]) {
    return Object.fromEntries((options || []).map((item) => [String(item.value), item.label || item.text || String(item.value)]));
  }

  function mapDictionaryValue(value: unknown, dictionary: Record<string, string>) {
    if (value == null || value === '') return '—';
    return dictionary[String(value)] || String(value);
  }

  function resolveUserText(snapshot: unknown, userId: unknown) {
    const name = String(snapshot || '').trim();
    if (name && name !== '-' && name !== '—') return name;
    if (userId == null || userId === '') return '—';
    return userOptions.value.find((item) => String(item.value) === String(userId))?.label || String(userId);
  }

  function resolveSalesUserText() {
    const salesUser = contract.value.salesUser || contract.value.saleUser || {};
    const project = props.project || {};
    const snapshots = [
      contract.value.salesUserName,
      contract.value.saleUserName,
      contract.value.salesUserRealName,
      contract.value.salesName,
      project.salesUserName,
      project.saleUserName,
      project.salesName,
      salesUser.realname,
      salesUser.realName,
      salesUser.name,
      salesUser.username,
    ];
    const snapshot = snapshots.map((item) => String(item || '').trim()).find((item) => item && item !== '-' && item !== '—');
    if (snapshot) return snapshot;

    const salesUserId =
      contract.value.salesUserId ?? contract.value.saleUserId ?? project.salesUserId ?? project.saleUserId ?? salesUser.id ?? salesUser.userId;
    if (salesUserId != null && salesUserId !== '') {
      const matched = userOptions.value.find(
        (item) => String(item.value) === String(salesUserId) || String(item.username || '') === String(salesUserId)
      );
      if (matched?.label) return matched.label;
    }

    const creator = contract.value.createBy ?? contract.value.createUser ?? contract.value.creator;
    if (creator != null && creator !== '') {
      const matched = userOptions.value.find((item) => String(item.username || '') === String(creator) || String(item.value) === String(creator));
      if (matched?.label) return matched.label;
      return String(creator);
    }
    return '—';
  }

  function getPaymentNodeText(value: unknown) {
    return mapDictionaryValue(value, paymentNodeMap.value);
  }

  function formatAmount(value: unknown) {
    if (value == null || value === '') return '—';
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toFixed(2)} 元` : `${value} 元`;
  }

  function getFileName(path: unknown, fallback: string) {
    const value = String(path || '');
    if (!value) return fallback;
    const rawName = value.split('/').pop() || fallback;
    try {
      return decodeURIComponent(rawName);
    } catch {
      return rawName;
    }
  }

  watch(() => props.projectId, load, { immediate: true });
</script>

<style lang="less" scoped>
  .detail-contract {
    &__section + &__section {
      margin-top: 20px;
    }

    &__title {
      margin: 0 0 12px;
      color: @text-color;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.5;
    }
  }
</style>
