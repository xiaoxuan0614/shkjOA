<template>
  <div class="detail-acceptance">
    <a-alert type="info" show-icon message="内部验收与外部验收由不同责任人并行办理" class="detail-acceptance__notice" />
    <a-alert v-if="identityError" type="warning" :message="identityError" show-icon>
      <template #action><a-button @click="loadIdentity">重试身份查询</a-button></template>
    </a-alert>

    <a-button
      v-if="!footerActions && canApplyNormal"
      type="primary"
      :loading="startingAcceptance"
      @click="handleStartAcceptance"
      >{{ normalApplicationLabel }}</a-button
    >
    <a-spin :spinning="loading">
      <a-empty v-if="!hasCurrentRound">
        <template #description>当前暂无验收记录；首次全部工序完成后自动进入验收，返工完成后由项目经理申请复审。</template>
      </a-empty>

      <div v-else class="detail-acceptance__grid" :class="{ 'detail-acceptance__grid--single': acceptanceCards.length === 1 }">
        <a-card v-for="card in acceptanceCards" :id="`acceptance-${card.type}`" :key="card.type" size="small" class="accept-card">
          <template #title>
            <div class="accept-card__title">
              <span>{{ card.title }}</span>
              <a-tag :color="getAcceptanceMeta(card.model).color">{{ getAcceptanceMeta(card.model).text }}</a-tag>
              <span v-if="lastRejected(card.type)?.remark" class="accept-card__rejection">最近驳回原因：{{ lastRejected(card.type).remark }}</span>
            </div>
          </template>

          <a-descriptions v-if="!canEdit(card.model, card.type)" :column="1" size="small">
            <a-descriptions-item label="办理责任">{{ responsibilityText(card.type) }}</a-descriptions-item>
            <a-descriptions-item label="验收负责人">{{ card.model.acceptLeaderName || '—' }}</a-descriptions-item>
            <a-descriptions-item v-if="card.type === 'CUSTOMER'" label="客户验收负责人">{{ card.model.acceptUnitLeader || '—' }}</a-descriptions-item>
            <a-descriptions-item v-if="card.type === 'CUSTOMER'" label="客户验收负责人角色">{{ customerRoleLabel(card.model.acceptUnitName) }}</a-descriptions-item>
            <a-descriptions-item label="验收日期">{{ formatAcceptanceDate(card.model.acceptEndDate) }}</a-descriptions-item>
            <a-descriptions-item v-if="card.model.remark && card.model.remark !== lastRejected(card.type)?.remark" label="验收说明">{{ card.model.remark }}</a-descriptions-item>
          </a-descriptions>
          <a-form v-else layout="vertical">
            <div class="accept-card__owner">
              <span>办理责任</span>
              <strong>{{ responsibilityText(card.type) }}</strong>
              <a-tag v-if="canOperate(card.type)" color="blue">当前账号可办理</a-tag>
            </div>
            <a-form-item label="验收负责人">
              <a-input :value="responsibleName(card.type)" disabled placeholder="提交时自动记录当前登录人" />
            </a-form-item>
            <a-form-item v-if="card.type === 'CUSTOMER'" label="客户验收负责人" required>
              <a-input
                v-model:value="card.model.acceptUnitLeader"
                :disabled="!canEdit(card.model, card.type)"
                placeholder="请输入客户方验收负责人姓名"
              />
            </a-form-item>
            <a-form-item v-if="card.type === 'CUSTOMER'" label="客户验收负责人角色">
              <a-select v-model:value="card.model.acceptUnitName" :options="customerRoleOptions" allow-clear placeholder="请选择客户方角色" />
            </a-form-item>
            <a-form-item label="验收日期" :required="canEdit(card.model, card.type)">
              <a-date-picker
                v-if="canEdit(card.model, card.type)"
                v-model:value="card.model.acceptDate"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                placeholder="请选择验收日期"
                style="width: 100%"
              />
              <a-input v-else :value="formatAcceptanceDate(card.model.acceptEndDate)" disabled />
            </a-form-item>

            <a-form-item label="验收结果" required>
              <a-select
                v-model:value="card.model.result"
                placeholder="请选择通过或不通过"
                :options="resultOptions"
                :disabled="!canEdit(card.model, card.type)"
              />
            </a-form-item>
            <template v-if="card.type === 'CUSTOMER'">
              <a-form-item label="负责人联系电话">
                <a-input v-model:value="card.model.acceptUnitPhone" placeholder="请输入负责人联系电话" :disabled="!canEdit(card.model, card.type)" />
              </a-form-item>
            </template>

            <a-form-item
              v-if="normalizeResult(card.model.result) === 'PASSED' || (!canEdit(card.model, card.type) && reportFiles(card.type).length)"
              label="验收文件"
              required
            >
              <div class="file-field">
                <a-upload
                  v-if="canEdit(card.model, card.type)"
                  :accept="ACCEPTANCE_REPORT_ACCEPT"
                  :multiple="false"
                  :show-upload-list="false"
                  :disabled="uploadBusy || internalLoading || customerLoading || attachmentCount(card.type) >= ACCEPTANCE_REPORT_LIMIT"
                  :before-upload="(file) => onReportUpload(card.type === 'INTERNAL' ? 'internal' : 'customer', file)"
                >
                  <a-button
                    size="small"
                    :loading="uploadingTarget === (card.type === 'INTERNAL' ? 'internal' : 'customer')"
                    :disabled="uploadBusy || internalLoading || customerLoading || attachmentCount(card.type) >= ACCEPTANCE_REPORT_LIMIT"
                    >上传验收文件</a-button
                  >
                </a-upload>
                <span v-if="canEdit(card.model, card.type)" class="file-field__empty" aria-live="polite">
                  附件共 {{ attachmentCount(card.type) }}/{{ ACCEPTANCE_REPORT_LIMIT }} 个（每类独立），每次上传一个；支持图片、Word、PDF、Excel
                </span>
                <span v-if="!reportFiles(card.type).length" class="file-field__empty">未上传</span>
                <div v-for="path in reportFiles(card.type)" :key="path" class="file-field__row">
                  <span class="file-field__name" :title="fileName(path)">{{ fileName(path) }}</span>
                  <a-button size="small" :aria-label="`预览 ${fileName(path)}`" @click="previewFileInModal(path)">预览</a-button>
                  <a-button
                    v-if="canEdit(card.model, card.type)"
                    size="small"
                    danger
                    :aria-label="`删除 ${fileName(path)}`"
                    :disabled="uploadBusy || internalLoading || customerLoading"
                    @click="removeAcceptanceFile(card.type, 'acceptanceFormFileId', path)"
                    >删除</a-button
                  >
                </div>
              </div>
            </a-form-item>

            <a-form-item
              v-if="normalizeResult(card.model.result) === 'FAILED' || card.model.remark"
              label="不通过原因"
              :required="normalizeResult(card.model.result) === 'FAILED'"
            >
              <a-textarea
                v-model:value="card.model.remark"
                placeholder="验收不通过时必须填写原因"
                :rows="3"
                :maxlength="500"
                show-count
                :disabled="!canEdit(card.model, card.type)"
              />
            </a-form-item>
            <div v-if="!footerActions && canComplete(card.model, card.type)" class="accept-card__submit">
              <span class="file-field__empty">附件及填写内容将在提交验收后保存。</span>
              <a-button
                type="primary"
                :disabled="uploadBusy || internalLoading || customerLoading"
                :loading="isCardLoading(card.type)"
                @click="handleComplete(card.type)"
                >提交验收结果</a-button
              >
            </div>
          </a-form>
        </a-card>
      </div>
    </a-spin>

    <div v-if="!footerActions && !loading && failedActionCards.length" class="detail-acceptance__failure-actions">
      <div v-for="card in failedActionCards" :key="card.type" class="accept-card__actions">
        <span>{{ card.title }}未通过：</span>
        <a-button
          v-if="canRequestRecheck(card.model)"
          :disabled="uploadBusy || internalLoading || customerLoading"
          @click="openRecheck(card.type)"
          >申请复审</a-button
        >
        <a-button
          v-if="canApplyRework(card.model)"
          danger
          :disabled="uploadBusy || internalLoading || customerLoading"
          @click="openRework(card.model, card.type)"
          >申请返工</a-button
        >
      </div>
    </div>
    <div v-if="!footerActions && !loading" class="detail-acceptance__history">
      <a-button @click="openHistory">查看详情</a-button>
    </div>
    <a-drawer v-model:open="historyOpen" title="验收详情" width="min(1440px, 96vw)" destroy-on-close>
      <a-tabs v-model:activeKey="historyTab">
        <a-tab-pane key="acceptance" tab="历史验收记录">
          <a-card size="small">
            <a-alert v-if="historyError" type="warning" :message="historyError">
              <template #action><a-button @click="loadHistoryPage(historyPage)">重试</a-button></template>
            </a-alert>
            <a-table
              class="acceptance-history-table"
              table-layout="fixed"
              :scroll="{ x: historyTableWidth }"
              :loading="historyLoading"
              @change="(page) => loadHistoryPage(page.current)"
              :columns="historyColumns"
              :data-source="historyRows"
              :row-key="(record) => `${record.acceptType}-${record.id}`"
              :pagination="{ current: historyPage, total: historyTotal, pageSize: 10, showSizeChanger: false }"
              size="small"
            >
              <template #emptyText><a-empty description="暂无历史验收记录" /></template>
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'acceptType'">{{ record.acceptType === 'INTERNAL' ? '内部验收' : '外部验收' }}</template>
                <template v-else-if="column.key === 'round'">{{ record.reworkId ? '返工复验' : '首次验收' }}</template>
                <template v-else-if="column.key === 'status'">
                  <a-tag :color="getAcceptanceMeta(record).color">{{ getAcceptanceMeta(record).text }}</a-tag>
                </template>
                <template v-else-if="column.key === 'result'">{{ resultText(record.result) }}</template>
                <template v-else-if="column.key === 'remark'">
                  <a-tooltip :title="record.remark"
                    ><span class="detail-acceptance__ellipsis">{{ record.remark || '—' }}</span></a-tooltip
                  >
                </template>
                <template v-else-if="column.key === 'files'">
                  <div v-for="field in ['completionReportFileId', 'acceptanceFormFileId']" :key="field">
                    <a-button
                      v-for="path in acceptanceFilePaths(record[field])"
                      :key="path"
                      type="link"
                      size="small"
                      :title="fileName(path)"
                      class="acceptance-history-file"
                      @click="previewFileInModal(path)"
                    >
                      {{ field === 'completionReportFileId' ? '验收报告' : '验收单' }}：{{ fileName(path) }}
                    </a-button>
                  </div>
                  <span v-if="!record.completionReportFileId && !record.acceptanceFormFileId">—</span>
                </template>
              </template>
            </a-table>
          </a-card>
        </a-tab-pane>
        <a-tab-pane key="rework" tab="返工记录">
          <DetailReworks v-if="historyOpen && reworkVisited" ref="reworkRecordsRef" :period-id="projectId" @open="openReworkRecord" />
        </a-tab-pane>
      </a-tabs>
    </a-drawer>

    <a-modal
      v-model:open="recheckOpen"
      :title="applicationMode === 'NORMAL' ? normalApplicationLabel : '申请复审'"
      ok-text="提交申请"
      :confirm-loading="recheckLoading"
      :closable="!recheckLoading"
      :mask-closable="false"
      :cancel-button-props="{ disabled: recheckLoading }"
      @ok="submitRecheck"
    >
      <a-alert type="info" show-icon :message="applicationMode === 'NORMAL' ? '选择本次申请类型；全部工序完成后方可申请，已通过结果保持不变。' : '仅重新办理当前不通过的验收；需要施工整改时请申请返工。'" />
      <a-form layout="vertical">
        <a-form-item label="验收类型（可多选）" required>
          <a-checkbox-group v-model:value="recheckTypes" :disabled="recheckLoading">
            <a-checkbox v-for="card in acceptanceCards" :key="card.type" :value="card.type" :disabled="!canSelectApplication(card.model)">
              {{ card.title }}（{{ getAcceptanceMeta(card.model).text }}）
            </a-checkbox>
          </a-checkbox-group>
        </a-form-item>
        <a-form-item label="申请原因" required
          ><a-textarea v-model:value="recheckReason" :rows="4" :maxlength="400" show-count :placeholder="applicationMode === 'NORMAL' ? '请填写申请原因（最多400字）' : '请说明无需施工整改、申请重新验收的原因（最多400字）'" :disabled="recheckLoading"
        /></a-form-item>
      </a-form>
    </a-modal>
    <ReworkDrawer @register="registerReworkDrawer" @success="handleReworkChanged" />
  </div>
</template>

<script lang="ts" setup>
  import { computed, nextTick, reactive, ref, watch } from 'vue';
  import dayjs from 'dayjs';
  import { getDictItems } from '/@/api/common/api';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { completeProjectAcceptance, getAcceptance, getAcceptanceLatestStatus, applyProjectAcceptance } from '../ProjectDetail.api';
  import { readCachedProjectMembership } from '../../projectMembership';
  import { readInternalAcceptanceAccess } from '../../internalAcceptanceAccess';
  import { isAllowedDocumentFile, uploadProjectDocument } from '/@/utils/documentUpload';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { ACCEPTANCE_REPORT_ACCEPT, ACCEPTANCE_REPORT_LIMIT, acceptanceFilePaths, isAcceptanceReportFile } from '../acceptanceFiles';
  import { useUserStore } from '/@/store/modules/user';
  import { refreshTodos } from '/@/views/todo/useTodoCenter';
  import { isAcceptanceHistory } from '/@/utils/acceptanceWorkflow';
  import ReworkDrawer from './ReworkDrawer.vue';
  import DetailReworks from './DetailReworks.vue';
  const historyOpen = ref(false);
  const historyTab = ref('acceptance');
  const reworkVisited = ref(false);
  watch(historyTab, (tab) => {
    if (tab === 'rework') reworkVisited.value = true;
  });
  function openHistory() {
    reworkVisited.value = false;
    historyTab.value = 'acceptance';
    historyOpen.value = true;
    void loadHistoryPage(historyPage.value);
  }
  const reworkRecordsRef = ref<InstanceType<typeof DetailReworks>>();
  function openReworkRecord(reworkId: string) {
    historyOpen.value = false;
    openReworkDrawer(true, { periodId: props.projectId, reworkId, project: props.project });
  }

  type AcceptanceType = 'INTERNAL' | 'CUSTOMER';
  type UploadTarget = 'internal' | 'customer' | 'acceptForm';

  const props = withDefaults(defineProps<{ projectId: string; project?: Recordable; initialReworkId?: string; initialApply?: boolean; initialRecheckType?: string; initialAcceptanceId?: string; operationOnly?: boolean; footerActions?: boolean }>(), {
    project: () => ({}),
    initialReworkId: '',
    operationOnly: false,
    footerActions: false,
  });
  const emit = defineEmits<{ changed: [action?: 'completed']; busyChange: [busy: boolean] }>();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const userStore = useUserStore();
  const [registerReworkDrawer, { openDrawer: openReworkDrawer }] = useDrawer();

  const startingAcceptance = ref(false);
  const applicationMode = ref<'NORMAL' | 'WITHOUT_RECTIFICATION'>('NORMAL');
  const recheckOpen = ref(false);
  const recheckReason = ref('');
  const recheckTypes = ref<AcceptanceType[]>([]);
  const recheckLoading = ref(false);
  const applicationReady = ref(false);
  const acceptedManager = ref(false);
  const identityReady = ref(false);
  const operationsMember = ref(false);
  const identityError = ref('');
  let identitySequence = 0;
  const loading = ref(false);
  const recordsReady = ref(false);
  const latestStatus = ref<Recordable>({});
  let loadSequence = 0;
  const internalLoading = ref(false);
  const customerLoading = ref(false);
  const uploadingTarget = ref<UploadTarget | ''>('');
  const uploadBusy = computed(() => Boolean(uploadingTarget.value));
  watch(
    [internalLoading, customerLoading, uploadBusy, recheckLoading],
    ([internalBusy, customerBusy, uploading, applying]) => emit('busyChange', internalBusy || customerBusy || uploading || applying),
    { flush: 'sync' }
  );
  const internalRecords = ref<Recordable[]>([]);
  const customerRecords = ref<Recordable[]>([]);
  let openedInitialRework = false;

  const resultOptions = [
    { label: '通过', value: 'PASSED' },
    { label: '不通过', value: 'FAILED' },
  ];
  const customerRoleOptions = ref<{ label: string; value: string }[]>([]);
  let customerRolesLoaded = false;
  let customerRolesLoading = false;
  async function loadCustomerRoles() {
    if (customerRolesLoaded || customerRolesLoading) return;
    customerRolesLoading = true;
    try {
      const response = await getDictItems('client_role');
      const rows = Array.isArray(response) ? response : response?.result;
      if (!Array.isArray(rows)) throw new Error('字典响应异常');
      customerRoleOptions.value = rows.map((item) => ({ label: String(item.text ?? item.label ?? item.value), value: String(item.value) }));
      customerRolesLoaded = true;
    } catch {
      createMessage.warning('客户验收角色字典加载失败，请重新打开重试');
    } finally {
      customerRolesLoading = false;
    }
  }
  const customerRoleLabel = (value: unknown) => customerRoleOptions.value.find((item) => item.value === String(value ?? ''))?.label || String(value || '—');
  const internal = reactive<Recordable>(emptyInternal());
  const customer = reactive<Recordable>(emptyCustomer());
  const acceptanceCards = computed(() =>
    [
      { type: 'INTERNAL' as const, title: '内部验收', model: internal },
      { type: 'CUSTOMER' as const, title: '外部验收', model: customer },
    ].filter((card) => !props.operationOnly || canOperate(card.type) || canRequestNormal(card.model) || canRequestRecheck(card.model) || canApplyRework(card.model))
  );
  const failedActionCards = computed(() => acceptanceCards.value.filter((card) => canRequestRecheck(card.model) || canApplyRework(card.model)));
  const submitActions = computed(() => loading.value ? [] : acceptanceCards.value
    .filter((card) => canComplete(card.model, card.type))
    .map((card) => ({ type: card.type, label: `提交${card.title}`, loading: isCardLoading(card.type) })));
  const submitDisabled = computed(() => loading.value || uploadBusy.value || internalLoading.value || customerLoading.value || recheckLoading.value);
  const secondaryActions = computed(() => {
    if (loading.value) return [];
    const disabled = submitDisabled.value || startingAcceptance.value;
    const actions = [{ key: 'history', label: '查看详情', disabled, danger: false, loading: false, onClick: openHistory }];
    if (canApplyNormal.value) {
      actions.push({ key: 'start', label: normalApplicationLabel.value, disabled, danger: false, loading: startingAcceptance.value, onClick: handleStartAcceptance });
    }
    if (failedActionCards.value.some((card) => canRequestRecheck(card.model))) {
      actions.push({ key: 'recheck', label: '申请复审', disabled, danger: false, loading: recheckLoading.value, onClick: () => openRecheck() });
    }
    if (failedActionCards.value.some((card) => canApplyRework(card.model))) {
      actions.push({ key: 'rework', label: '申请返工', disabled, danger: true, loading: false, onClick: openLatestRework });
    }
    return actions;
  });
  defineExpose({ submitActions, secondaryActions, submitDisabled, submit: handleComplete });
  const currentUserId = computed(() => String((userStore.getUserInfo as any)?.id || (userStore.getUserInfo as any)?.userId || ''));
  const currentUserName = computed(() => {
    const user: any = userStore.getUserInfo;
    return String(user?.realname || user?.realName || user?.username || '');
  });
  const hasCurrentRound = computed(() => Boolean(internal.id || customer.id));
  const historyRows = ref<Recordable[]>([]);
  const historyPage = ref(1),
    historyTotal = ref(0),
    historyLoading = ref(false),
    historyError = ref('');
  const historyCache = new Map<number, { records: Recordable[]; total: number }>();
  let historySequence = 0;
  async function loadHistoryPage(page = 1) {
    const sequence = ++historySequence;
    const periodId = props.projectId;
    historyLoading.value = true;
    historyError.value = '';
    try {
      let result = historyCache.get(page);
      if (!result) {
        const response = await getAcceptance({ periodId, pageNo: page, pageSize: 10 });
        if (sequence !== historySequence || periodId !== props.projectId) return;
        result = { records: normalizeRecords(response).filter(isAcceptanceHistory), total: Number(response?.total || 0) };
        historyCache.set(page, result);
      }
      historyRows.value = result.records;
      historyTotal.value = result.total;
      historyPage.value = page;
    } catch (error: any) {
      if (sequence === historySequence) historyError.value = error?.message || '历史验收记录加载失败';
    } finally {
      if (sequence === historySequence) historyLoading.value = false;
    }
  }
  const historyColumns = [
    { title: '验收类型', key: 'acceptType', width: 110 },
    { title: '验收轮次', key: 'round', width: 110 },
    { title: '状态', key: 'status', width: 110 },
    { title: '结果', key: 'result', width: 100 },
    { title: '验收负责人', width: 130, customRender: ({ record }) => record.acceptLeaderName || '—' },
    { title: '客户验收负责人', width: 140, customRender: ({ record }) => record.acceptType === 'CUSTOMER' ? record.acceptUnitLeader || '—' : '—' },
    { title: '客户负责人角色', width: 140, customRender: ({ record }) => record.acceptType === 'CUSTOMER' ? customerRoleLabel(record.acceptUnitName) : '—' },
    { title: '验收日期', dataIndex: 'acceptEndDate', width: 120, customRender: ({ text }) => formatAcceptanceDate(text) },
    { title: '验收说明', key: 'remark', width: 220 },
    { title: '验收附件', key: 'files', width: 240 },
  ].map((column) => ({ ...column, ellipsis: column.key !== 'files' }));
  const historyTableWidth = historyColumns.reduce((total, column) => total + column.width, 0);

  function emptyInternal() {
    return {
      id: '',
      sourceAcceptanceId: '',
      resubmitReason: '',
      acceptUnitLeader: '',
      acceptUnitPhone: '',
      acceptanceFormFileId: '',
      reworkId: '',
      acceptStatus: '',
      acceptLeaderId: undefined,
      acceptLeaderName: '',
      acceptDate: '',
      acceptEndDate: '',
      completionReportFileId: '',
      result: '',
      remark: '',
    };
  }

  function emptyCustomer() {
    return {
      id: '',
      sourceAcceptanceId: '',
      resubmitReason: '',
      reworkId: '',
      acceptStatus: '',
      acceptDate: '',
      acceptEndDate: '',
      acceptUnitLeader: '',
      acceptUnitPhone: '',
      acceptLeaderId: undefined,
      acceptLeaderName: '',
      completionReportFileId: '',
      acceptanceFormFileId: '',
      result: '',
      remark: '',
    };
  }

  function formatAcceptanceDate(value: unknown) {
    if (!value) return '—';
    const date = dayjs(String(value));
    return date.isValid() ? date.format('YYYY-MM-DD') : '—';
  }

  function normalizeResult(value: unknown): '' | 'PASSED' | 'FAILED' {
    const text = String(value || '').trim();
    const upper = text.toUpperCase();
    if (upper === 'PASSED' || text === '通过') return 'PASSED';
    if (upper === 'FAILED' || ['不通过', '未通过', '整改'].includes(text)) return 'FAILED';
    return '';
  }

  function resultText(value: unknown) {
    const result = normalizeResult(value);
    return result === 'PASSED' ? '通过' : result === 'FAILED' ? '不通过' : '—';
  }

  function resolveStatus(record: Recordable) {
    const status = String(record?.acceptStatus || '').toUpperCase();
    if (status) return status;
    if (normalizeResult(record?.result)) return 'COMPLETED';
    return record?.id ? 'NOT_STARTED' : '';
  }

  function getAcceptanceMeta(record: Recordable) {
    const summary = record === internal ? latestStatus.value.internal : record === customer ? latestStatus.value.customer : undefined;
    if (summary?.status) return {
      text: summary.statusText || summary.status,
      color: summary.status === 'PASSED' ? 'success' : summary.status === 'FAILED' ? 'error' : summary.status === 'NOT_APPLIED' ? 'default' : 'processing',
    };
    const status = resolveStatus(record);
    if (status === 'COMPLETED' && normalizeResult(record?.result) === 'PASSED') return { text: '已通过', color: 'success' };
    if (status === 'COMPLETED' && normalizeResult(record?.result) === 'FAILED') return { text: '未通过', color: 'error' };
    if (status === 'IN_PROGRESS') return { text: '验收中', color: 'processing' };
    if (status === 'CANCELLED') return { text: '已取消', color: 'default' };
    if (status === 'NOT_STARTED') return { text: '未开始', color: 'default' };
    return { text: '暂无记录', color: 'default' };
  }

  function canOperate(type: AcceptanceType) {
    return identityReady.value && !loading.value &&
      ['ACCEPTING', 'REACCEPTING', 'INTERNAL_ACCEPTING'].includes(String(props.project.status)) &&
      (type === 'INTERNAL' ? operationsMember.value : acceptedManager.value) &&
      resolveStatus(activeRecord(type)) === 'IN_PROGRESS' && hasPermission(type === 'INTERNAL' ? 'project:internalAccept' : 'project:accept');
  }

  async function loadIdentity() {
    const sequence = ++identitySequence;
    const periodId = props.projectId;
    const userId = currentUserId.value;
    identityReady.value = false;
    acceptedManager.value = false;
    operationsMember.value = false;
    identityError.value = '';
    if (!periodId || !userId) return;
    const needsManager = ['project:accept', 'project:acceptance:submit', 'project:rework:apply'].some(code => hasPermission(code));
    const [membership, internalAccess] = await Promise.allSettled([
      needsManager ? readCachedProjectMembership(periodId, userId, JSON.stringify([userStore.getToken, (userStore.getUserInfo as any).loginTenantId])) : Promise.resolve({ manager: false }),
      hasPermission('project:internalAccept') ? readInternalAcceptanceAccess(userStore.getIdentity) : Promise.resolve(false),
    ]);
    if (sequence !== identitySequence || periodId !== props.projectId || userId !== currentUserId.value) return;
    acceptedManager.value = membership.status === 'fulfilled' && membership.value.manager;
    operationsMember.value = internalAccess.status === 'fulfilled' && internalAccess.value;
    identityReady.value = true;
    if (membership.status === 'rejected') identityError.value = '项目经理身份查询失败，外部验收暂不可编辑，请重试';
    if (internalAccess.status === 'rejected') identityError.value += ' 运维负责部门资格查询失败，内部验收暂不可编辑，请重试';
  }

  function responsibilityText(type: AcceptanceType) {
    return type === 'INTERNAL' ? '运维部主管 / 系统管理员' : '本项目项目经理';
  }

  function responsibleName(type: AcceptanceType) {
    const record = activeRecord(type);
    if (canEdit(record, type)) return currentUserName.value;
    return String(record.acceptLeaderName || '—');
  }

  function assignResponsible(type: AcceptanceType) {
    const record = activeRecord(type);
    if (!currentUserId.value || !currentUserName.value) throw new Error('当前登录人信息缺失，请重新登录后提交');
    record.acceptLeaderId = currentUserId.value;
    record.acceptLeaderName = currentUserName.value;
    if (type === 'INTERNAL') record.acceptUnitLeader = currentUserName.value;
    else if (!String(record.acceptUnitLeader || '').trim()) throw new Error('请填写客户方验收负责人姓名');
  }

  function canEdit(record: Recordable, type: AcceptanceType) {
    return Boolean(record?.id) && !['COMPLETED', 'CANCELLED'].includes(resolveStatus(record)) && canOperate(type);
  }

  function canComplete(record: Recordable, type: AcceptanceType) {
    return canOperate(type) && resolveStatus(record) === 'IN_PROGRESS';
  }

  function canApplyRework(record: Recordable) {
    const summary = record === internal ? latestStatus.value.internal : record === customer ? latestStatus.value.customer : undefined;
    return !loading.value && recordsReady.value && latestStatus.value.canApplyRework === true && summary?.status === 'FAILED';
  }

  function activeRecord(type: AcceptanceType) {
    return type === 'INTERNAL' ? internal : customer;
  }

  function activeLoading(type: AcceptanceType) {
    return type === 'INTERNAL' ? internalLoading : customerLoading;
  }

  function isCardLoading(type: AcceptanceType) {
    return activeLoading(type).value;
  }

  function reportFiles(type: AcceptanceType) {
    return acceptanceFilePaths(activeRecord(type).acceptanceFormFileId);
  }

  const attachmentCount = (type: AcceptanceType) => reportFiles(type).length;

  type AcceptanceFileField = 'completionReportFileId' | 'acceptanceFormFileId';

  function removeAcceptanceFile(type: AcceptanceType, field: AcceptanceFileField, path?: string) {
    const record = activeRecord(type);
    if (uploadBusy.value || internalLoading.value || customerLoading.value || !canEdit(record, type)) return;
    record[field] = path
      ? acceptanceFilePaths(record[field])
          .filter((item) => item !== path)
          .join(',')
      : '';
  }

  async function onReportUpload(target: UploadTarget, file: any): Promise<boolean> {
    const type = target === 'internal' ? 'INTERNAL' : 'CUSTOMER';
    if (!file || uploadBusy.value || internalLoading.value || customerLoading.value || !canEdit(activeRecord(type), type)) return false;
    const isReport = target !== 'acceptForm';
    if (attachmentCount(type) >= ACCEPTANCE_REPORT_LIMIT) {
      createMessage.warning('验收附件合计最多 3 个文件，请先删除再添加');
      return false;
    }
    if (String(file.name || '').includes(',')) {
      createMessage.warning('文件名不能包含英文逗号，请重命名后上传');
      return false;
    }
    if (!(isReport ? isAcceptanceReportFile(file) : isAllowedDocumentFile(file))) {
      createMessage.warning(isReport ? '仅支持图片、Word、PDF、Excel 文件' : '仅支持 PDF、Word、Excel、PPT 文件');
      return false;
    }
    const periodId = props.projectId;
    const recordId = activeRecord(type).id;
    uploadingTarget.value = target;
    try {
      const { path } = await uploadProjectDocument(file, periodId);
      if (periodId !== props.projectId || recordId !== activeRecord(type).id) return false;
      const field: AcceptanceFileField = 'acceptanceFormFileId';
      if (path.includes(',')) throw new Error('上传返回的路径包含英文逗号，无法关联附件，请联系管理员');
      const value = isReport ? [...new Set([...reportFiles(type), path])].join(',') : path;
      activeRecord(type)[field] = value;
      createMessage.success('文件上传成功，可预览；提交验收后保存');
    } catch (error: any) {
      createMessage.error(error?.message || '上传失败，请重试');
    } finally {
      uploadingTarget.value = '';
    }
    return false;
  }

  function fileName(path?: string): string {
    const name =
      String(path || '')
        .split(/[?#]/)[0]
        .split(/[\\/]/)
        .pop() || '';
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  }

  function validateAcceptance(type: AcceptanceType, requireResult = false) {
    const record = activeRecord(type);
    if (!record.acceptDate || !dayjs(record.acceptDate).isValid()) throw new Error('请选择验收日期');
    if (!record.acceptLeaderId) throw new Error(`${responsibilityText(type)}信息缺失，无法办理验收`);
    if (normalizeResult(record.result) === 'PASSED' && attachmentCount(type) > ACCEPTANCE_REPORT_LIMIT)
      throw new Error('验收附件合计最多 3 个文件，请先删除多余附件');
    if (normalizeResult(record.result) === 'PASSED' && !attachmentCount(type))
      throw new Error('验收通过时请上传至少一个验收文件');
    if (requireResult && !normalizeResult(record.result)) throw new Error('请选择验收结果');
    if (requireResult && normalizeResult(record.result) === 'FAILED' && !String(record.remark || '').trim()) {
      throw new Error('验收不通过时必须填写原因');
    }
  }

  async function handleComplete(type: AcceptanceType) {
    const state = activeLoading(type);
    if (internalLoading.value || customerLoading.value || uploadBusy.value || !canComplete(activeRecord(type), type)) return;
    try {
      assignResponsible(type);
      validateAcceptance(type, true);
    } catch (error: any) {
      createMessage.warning(error.message);
      return;
    }
    const record = activeRecord(type);
    const result = normalizeResult(record.result) as 'PASSED' | 'FAILED';
    state.value = true;
    try {
      await completeProjectAcceptance({
        acceptanceId: String(record.id),
        periodId: props.projectId,
        acceptType: type,
        // 页面按日期录入；接口仍要求日期时间，后端需同步按日期粒度校验开始日期。
        acceptEndDate: `${dayjs(record.acceptDate).format('YYYY-MM-DD')} 00:00:00`,
        result,
        acceptUnitLeader: type === 'CUSTOMER' ? String(record.acceptUnitLeader).trim() : currentUserName.value,
        ...(type === 'CUSTOMER' ? { acceptUnitName: record.acceptUnitName || '', acceptUnitPhone: record.acceptUnitPhone || '' } : {}),
        acceptanceFormFileId: result === 'PASSED' ? record.acceptanceFormFileId || '' : '',
        remark: String(record.remark || '').trim(),
        ...(record.reworkId ? { reworkId: record.reworkId } : {}),
      });
      createMessage.success(`${type === 'INTERNAL' ? '内部' : '外部'}验收已完成`);
      historyCache.clear();
      if (!props.footerActions) await load(type);
      refreshTodos(true).catch(() => undefined);
      emit('changed', 'completed');
    } catch (error: any) {
      createMessage.error(error?.message || '完成验收失败，请重试');
    } finally {
      state.value = false;
    }
  }

  function normalizeRecords(payload: any) {
    const records = Array.isArray(payload) ? payload : payload?.records || [];
    return records
      .filter((record: any) => record?.id)
      .sort((a: any, b: any) => String(b.createTime || b.updateTime || '').localeCompare(String(a.createTime || a.updateTime || '')));
  }

  function applicationSummary(record: Recordable) {
    return record === internal ? latestStatus.value.internal : record === customer ? latestStatus.value.customer : undefined;
  }
  function lastRejected(type: AcceptanceType) {
    const summary = type === 'INTERNAL' ? latestStatus.value.internal : latestStatus.value.customer;
    return summary?.status === 'PASSED' ? null : summary?.lastRejectedAcceptance;
  }
  function canRequestRecheck(record: Recordable) {
    const summary = applicationSummary(record);
    return !loading.value && recordsReady.value &&
      latestStatus.value.canSubmitReacceptance === true && summary?.status === 'FAILED';
  }
  function canRequestNormal(record: Recordable) {
    const summary = applicationSummary(record);
    return !loading.value && recordsReady.value && latestStatus.value.canSubmitReacceptance === true &&
      summary?.status === 'PENDING_REACCEPTANCE';
  }
  const normalApplicationLabel = computed(() => [internal, customer].some(record =>
    applicationSummary(record)?.status === 'PENDING_REACCEPTANCE' && canRequestNormal(record)) ? '申请复审' : '申请验收');
  const canApplyNormal = computed(() => [internal, customer].some(canRequestNormal));
  let initialApplicationOpened = false;
  watch(() => [loading.value, identityReady.value, recordsReady.value], () => {
    if (!props.initialRecheckType || initialApplicationOpened || loading.value || !identityReady.value || !recordsReady.value) return;
    initialApplicationOpened = true;
    const type = props.initialRecheckType as AcceptanceType;
    if (!['INTERNAL', 'CUSTOMER'].includes(type)) return;
    const record = activeRecord(type);
    if (String(record.id) !== props.initialAcceptanceId || !canRequestRecheck(record)) {
      createMessage.warning('该提醒已处理或当前不可申请复验，请查看最新验收记录');
      return;
    }
    openRecheck(type);
  });
  watch(() => [loading.value, identityReady.value, canApplyNormal.value], () => {
    if (props.initialApply && !initialApplicationOpened && !loading.value && identityReady.value && canApplyNormal.value) {
      initialApplicationOpened = true;
      handleStartAcceptance();
    }
  });
  function canSelectApplication(record: Recordable) {
    return applicationMode.value === 'NORMAL' ? canRequestNormal(record) : canRequestRecheck(record);
  }

  function openRecheck(type?: AcceptanceType) {
    applicationMode.value = 'WITHOUT_RECTIFICATION';
    // 返工与验收是否互斥由 apply 接口校验，前端不依据返工列表拦截申请。
    const available = acceptanceCards.value.filter((card) => canRequestRecheck(card.model)).map((card) => card.type);
    if (!available.length) return;
    recheckTypes.value = type && available.includes(type) ? [type] : available;
    recheckReason.value = '';
    recheckOpen.value = true;
  }

  async function submitRecheck() {
    if (recheckLoading.value || internalLoading.value || customerLoading.value || uploadBusy.value) return;
    const selected = [...new Set(recheckTypes.value)];
    if (!selected.length || selected.some((type) => !canSelectApplication(activeRecord(type))))
      return createMessage.warning('请选择当前可申请的验收类型');
    const reason = recheckReason.value.trim();
    if (!reason || reason.length > 400) return createMessage.warning('请填写1至400字的申请原因');
    recheckLoading.value = true;
    let succeeded = false;
    try {
      const result = await applyProjectAcceptance({
        periodId: props.projectId, acceptTypes: selected, reason, applyMode: applicationMode.value,
      });
      if (!Array.isArray(result) || selected.some((type) => !result.some((row) => row?.id && row.acceptType === type))) {
        applicationReady.value = false;
        throw new Error('申请响应未确认，请重新打开查询最新记录，勿重复申请');
      }
      for (const type of selected) {
        const row = result.find((item) => item.acceptType === type);
        (type === 'INTERNAL' ? fillInternal : fillCustomer)(row);
        const rows = type === 'INTERNAL' ? internalRecords : customerRecords;
        rows.value = [row, ...rows.value.filter((item) => item.id !== row.id)];
      }
      succeeded = true;
      await load(selected.length === 1 ? selected[0] : undefined);
      recheckOpen.value = false;
      historyCache.clear();
      refreshTodos(true).catch(() => undefined);
      emit('changed');
      createMessage.success(selected.includes('CUSTOMER') ? '申请成功，请填写外部验收内容' : '申请成功，等待运维部验收');
    } catch (error: any) {
      createMessage.error(error?.message || '验收申请失败，输入已保留');
    } finally {
      recheckLoading.value = false;
      if (succeeded && selected.includes('CUSTOMER'))
        setTimeout(() => document.getElementById('acceptance-CUSTOMER')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    }
  }

  function openLatestRework() {
    const cards = failedActionCards.value.filter((card) => canApplyRework(card.model));
    const latest = normalizeRecords(cards.map((card) => card.model))[0];
    const card = cards.find((item) => item.model.id === latest?.id);
    if (card) void openRework(card.model, card.type);
    else createMessage.warning('当前没有可申请返工的失败验收，请刷新验收记录后重试');
  }

  function fillInternal(record: Recordable) {
    Object.assign(internal, emptyInternal(), record, {
      completionReportFileId: record.completionReportFileId || record.reportFileId || '',
      result: normalizeResult(record.result),
    });
  }

  function fillCustomer(record: Recordable) {
    Object.assign(customer, emptyCustomer(), record, { result: normalizeResult(record.result), acceptUnitName: record.acceptUnitName || undefined });
  }

  function handleStartAcceptance() {
    if (submitDisabled.value || !canApplyNormal.value) return;
    applicationMode.value = 'NORMAL';
    recheckTypes.value = acceptanceCards.value.filter((card) => canRequestNormal(card.model)).map((card) => card.type);
    recheckReason.value = '';
    recheckOpen.value = true;
  }

  async function load(type?: AcceptanceType) {
    void loadCustomerRoles();
    const sequence = ++loadSequence;
    const periodId = props.projectId;
    latestStatus.value = {};
    recordsReady.value = false;
    if (!periodId) return;
    loading.value = true;
    try {
      const result = await getAcceptanceLatestStatus(periodId);
      if (sequence !== loadSequence || periodId !== props.projectId) return;
      if (!result?.internal || !result?.customer) throw new Error('验收状态响应不完整，请重试');
      latestStatus.value = result;
      if (!type || type === 'INTERNAL') fillInternal(result.internal.acceptance || {});
      if (!type || type === 'CUSTOMER') fillCustomer(result.customer.acceptance || {});
      recordsReady.value = true;
    } catch (error: any) {
      if (sequence !== loadSequence || periodId !== props.projectId) return;
      if (!type) {
        recordsReady.value = false;
        internalRecords.value = [];
        customerRecords.value = [];
        fillInternal({});
        fillCustomer({});
      }
      createMessage.error(error?.message || '验收记录加载失败，请重试');
    } finally {
      if (sequence !== loadSequence || periodId !== props.projectId) return;
      loading.value = false;
      if (props.initialReworkId && !openedInitialRework) {
        openedInitialRework = true;
        await nextTick();
        openReworkDrawer(true, { periodId: props.projectId, reworkId: props.initialReworkId, project: props.project });
      }
    }
  }

  async function openRework(record: Recordable, type: AcceptanceType) {
    if (!canApplyRework(record)) {
      createMessage.warning('当前不可申请返工，请刷新验收信息后重试');
      return;
    }
    if (!record.id) {
      createMessage.warning('接口未返回返工来源验收记录，请刷新后重试');
      return;
    }
    openReworkDrawer(true, {
      periodId: props.projectId,
      project: props.project,
      sourceAcceptance: { ...record, acceptType: type },
      initialCreate: true,
    });
  }

  async function handleReworkChanged() {
    await load();
    await reworkRecordsRef.value?.load();
    refreshTodos(true).catch(() => undefined);
    emit('changed');
  }

  watch(
    () => [props.projectId, currentUserId.value, JSON.stringify(userStore.getIdentity), userStore.getToken, (userStore.getUserInfo as any).loginTenantId],
    () => {
      historyOpen.value = false;
      historySequence++;
      historyCache.clear();
      historyRows.value = [];
      historyPage.value = 1;
      historyTotal.value = 0;
      reworkVisited.value = false;
      openedInitialRework = false;
      recheckOpen.value = false;
      applicationReady.value = true;
      void loadIdentity();
      void load();
    },
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .acceptance-history-table {
    :deep(.ant-table-thead > tr > th),
    :deep(.ant-table-tbody > tr > td) {
      white-space: nowrap;
    }
    .acceptance-history-file {
      display: block;
      width: 100%;
      max-width: 100%;
      padding-inline: 0;
      overflow: hidden;
      text-align: left;
      :deep(span) {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
  .detail-acceptance {
    &__notice {
      margin-bottom: 16px;
    }
    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      &--single {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    &__failure-actions {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }
    &__history {
      margin-top: 16px;
    }
    &__ellipsis {
      display: inline-block;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: bottom;
    }

    .accept-card {
      &:deep(.ant-card-head) {
        background: var(--component-background, #fafafa);
      }
      &__rejection {
        min-width: 0;
        color: #cf1322;
        font-size: 14px;
        font-weight: 400;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      &__title,
      &__actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      &__submit {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }
      &__owner {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        color: #595959;
      }
    }

    .file-field {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      &__empty {
        color: #8c8c8c;
      }
      &__row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-width: 0;
      }
      &__name {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .file-tag {
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  @media (max-width: 1200px) {
    .detail-acceptance__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
