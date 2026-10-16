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
        <div class="detail-contract__heading">
          <h3 id="contract-main-title" class="detail-contract__title">合同主信息</h3>
          <a-button v-if="canEdit" type="primary" preIcon="ant-design:edit-outlined" :disabled="loading || withdrawing" @click="editContract">修改重提</a-button>
          <a-popconfirm v-if="canWithdraw" title="撤回后可修改合同并重新提交，确认撤回？" ok-text="确认撤回" cancel-text="取消" :disabled="withdrawing || loading" @confirm="withdraw">
            <a-button danger preIcon="ant-design:rollback-outlined" :loading="withdrawing" :disabled="loading">撤回申请</a-button>
          </a-popconfirm>
        </div>
        <a-descriptions :column="{ xs: 1, sm: 1, md: 2, xl: 3 }" bordered size="middle">
          <a-descriptions-item label="合同编号">{{ contract.contractNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同名称">{{ contract.contractName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同类型"><DictValue code="contract_type" :value="contract.contractType" :fallback="contractTypeText" /></a-descriptions-item>
          <a-descriptions-item label="审批状态">
            <a-tag :color="contractStatusMeta.color">{{ contractStatusMeta.text }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="合同签订日期">{{ contract.contractSignedDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="计划交付日期">{{ contract.plannedDeliveryDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="项目金额">{{ formatAmount(contract.contractAmount) }}</a-descriptions-item>
          <a-descriptions-item label="质保期">
            {{ contract.warrantyPeriod != null ? `${contract.warrantyPeriod} 月` : '—' }}
          </a-descriptions-item>
          <a-descriptions-item label="销售负责人">{{ salesUserText }}</a-descriptions-item>
          <a-descriptions-item label="合同附件" :span="3">
            <a-space v-if="contractAttachments.length" direction="vertical" size="small">
              <a-button
                v-for="file in contractAttachments"
                :key="file.fileId"
                type="link"
                size="small"
                preIcon="ant-design:eye-outlined"
                @click="previewFileInModal(file.fileId, file.fileName)"
              >
                预览：{{ file.fileName }}
              </a-button>
            </a-space>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item label="合同清单" :span="3">
            <a-button v-if="contract.materialSnapshot || contract.materialCandidateId" type="link" :disabled="loading" @click="openQuotationPreview">
              {{ contract.materialSnapshot?.candidateName || '查看合同清单' }}
            </a-button>
            <span v-else>暂无合同清单</span>
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
          :scroll="{ x: 580 }"
          size="middle"
          bordered
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'index'">{{ record._key }}</template>
            <template v-else-if="column.key === 'paymentNode'"><DictValue code="payback_node" :value="record.paymentNode" :fallback="record.paymentNode_dictText || record.node_dictText || getPaymentNodeText(record.paymentNode)" /></template>
            <template v-else-if="column.key === 'ratio'">{{ record.ratio != null ? `${record.ratio}%` : '—' }}</template>
            <template v-else-if="column.key === 'rollbackTime'">
              {{ `${record.rollbackTime == null ? 7 : record.rollbackTime} 天` }}
            </template>
            <template v-else-if="column.key === 'plannedAmount'">{{ formatAmount(record.plannedAmount) }}</template>
          </template>
        </a-table>
      </section>
    </div>
  </a-spin>
  <a-drawer :open="quotationPreviewOpen" title="合同清单预览（合同快照）" width="min(1400px, 96vw)" @close="quotationPreviewOpen = false">
    <QuotationSnapshotPreview v-if="quotationPreviewOpen" :quotation="contract.materialSnapshot ?? null" material-only hide-amounts />
  </a-drawer>
</template>

<script lang="ts" setup>
  import { expandContractAttachments } from '../../contract/contractAttachments';
  import DictValue from '/@/components/DictValue.vue';
  import { computed, ref, watch, onDeactivated, onBeforeUnmount } from 'vue';
  import QuotationSnapshotPreview from '../../contract/QuotationSnapshotPreview.vue';
  import { getContractDetail } from '../ProjectDetail.api';
  import { loadDictOptions } from '../../Project.data';
  import type { UserOption } from '/@/views/resource/userOptions';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
  import { useUserStore } from '/@/store/modules/user';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { changeContractStatus } from '/@/views/payment/Payment.api';
  import { refreshTodos } from '/@/views/todo/useTodoCenter';
  import { canWithdrawDetailContract, canEditDetailContract } from '../contractWithdrawal';

  const props = defineProps<{
    projectId: string;
    project?: Recordable;
    allowWithdraw?: boolean;
  }>();
  const emit = defineEmits(['changed', 'edit']);
  const userStore = useUserStore();
  const { createMessage } = useMessage();
  const withdrawing = ref(false);
  const canWithdraw = computed(() => props.allowWithdraw && !loadFailed.value && canWithdrawDetailContract(contract.value, userStore.getUserInfo));
  const canEdit = computed(() => props.allowWithdraw && !loadFailed.value && canEditDetailContract(contract.value, userStore.getUserInfo));
  function editContract() {
    if (!canEdit.value || loading.value || withdrawing.value) return;
    emit('edit');
  }
  async function withdraw() {
    if (withdrawing.value || loading.value || !canWithdraw.value) return;
    const periodId = props.projectId, contractId = contract.value.id, request = loadSequence;
    const token = userStore.getToken;
    withdrawing.value = true;
    try {
      const latest = await getContractDetail({ periodId });
      if (request !== loadSequence || periodId !== props.projectId || token !== userStore.getToken) return;
      if (latest?.id !== contractId || !canWithdrawDetailContract(latest, userStore.getUserInfo)) {
        createMessage.warning('合同状态或提交人已变化，请刷新后查看');
        await load(); return;
      }
      await changeContractStatus({ periodId, status: '3', approvalReason: '' });
      if (request !== loadSequence || periodId !== props.projectId || token !== userStore.getToken) return;
      contract.value = { ...contract.value, status: '3' };
      createMessage.success('合同已撤回，可修改后重新提交');
      await load();
      emit('changed');
      refreshTodos(true).catch(() => createMessage.warning('合同已撤回，待办刷新失败，请稍后刷新'));
    } catch (error: any) {
      if (periodId === props.projectId && token === userStore.getToken) createMessage.error(error?.message || '撤回失败，请刷新后重试');
    } finally { withdrawing.value = false; }
  }

  const loading = ref(false);
  const quotationPreviewOpen = ref(false);
  function openQuotationPreview() {
    if (loading.value || loadFailed.value || !hasContract.value) return;
    quotationPreviewOpen.value = true;
  }
  onDeactivated(() => { quotationPreviewOpen.value = false; });
  onBeforeUnmount(() => { loadSequence++; quotationPreviewOpen.value = false; });
  const loadFailed = ref(false);
  const contract = ref<Recordable>({});
  const paymentRows = ref<Recordable[]>([]);
  const contractAttachments = ref<Recordable[]>([]);
  const contractTypeMap = ref<Record<string, string>>({});
  const paymentNodeMap = ref<Record<string, string>>({});
  const userOptions = ref<UserOption[]>([]);
  let rowSeed = 0;
  let loadSequence = 0;

  const hasContract = computed(() => !!contract.value.id || !!contract.value.contractName);
  const contractStatusMeta = computed(() => getApprovalStatusMeta(contract.value.status));
  const contractTypeText = computed(() => mapDictionaryValue(contract.value.contractType, contractTypeMap.value));
  const salesUserText = computed(() => resolveSalesUserText());

  const paymentColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '回款项', dataIndex: 'paymentNode', key: 'paymentNode', width: 150 },
    { title: '比例', dataIndex: 'ratio', key: 'ratio', width: 100 },
    { title: '回款周期', dataIndex: 'rollbackTime', key: 'rollbackTime', width: 120 },
    { title: '计划回款金额', dataIndex: 'plannedAmount', key: 'plannedAmount', width: 150 },
  ];

  async function load() {
    quotationPreviewOpen.value = false;
    const currentSequence = ++loadSequence;
    const periodId = props.projectId;
    if (!periodId) {
      contract.value = {};
      paymentRows.value = [];
      contractAttachments.value = [];
      loading.value = false;
      return;
    }
    loading.value = true;
    loadFailed.value = false;
    try {
      const [contractResult, fileResult, contractTypeResult, paymentNodeResult, userResult] = await Promise.allSettled([
        getContractDetail({ periodId }),
        Promise.resolve([]),
        loadDictOptions('contract_type'),
        loadDictOptions('payback_node'),
        Promise.resolve([]),
      ]);
      if (currentSequence !== loadSequence) return;
      if (contractResult.status === 'rejected') throw contractResult.reason;
      const detail = contractResult.value || {};
      contract.value = detail;
      const filePage: any = fileResult.status === 'fulfilled' ? fileResult.value : {};
      const files = (Array.isArray(filePage) ? filePage : filePage?.records || []).filter(
        (item: Recordable) => String(item.fileType || '') === 'CONTRACT_ATTACHMENT' && item.fileId
      );
      contractAttachments.value = expandContractAttachments(
        files.length && !detail?.contractFileId
          ? files
          : [
              { fileId: detail.contractFileId || detail.contractFile?.fileId, fileName: detail.contractFile?.fileName || detail.contractFileName },
              { fileId: detail.materialFile?.fileId || detail.materialFileId, fileName: detail.materialFile?.fileName || detail.materialFileName },
            ]
              .filter((item) => item.fileId)
              .map((item) => ({ ...item, fileName: item.fileName || getFileName(item.fileId, '合同附件') }))
      );
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
      contractAttachments.value = [];
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
    &__heading {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
      .detail-contract__title { margin: 0; }
    }
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
