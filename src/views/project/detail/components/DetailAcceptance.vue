<template>
  <div class="detail-acceptance">
    <a-alert
      type="info"
      show-icon
      message="内部验收与外部验收由不同责任人并行办理"
      description="当前轮全部工序完成后进入待验收，点击开始验收后，内部与外部验收并行办理。两项都通过时自动进入质保，任一项不通过可申请返工。"
      class="detail-acceptance__notice"
    />

    <a-button
      v-if="project.status === 'PENDING_ACCEPT' && canStartAcceptance()"
      type="primary"
      :loading="startingAcceptance"
      @click="handleStartAcceptance"
      >开始验收</a-button
    >
    <a-spin :spinning="loading">
      <a-empty v-if="!hasCurrentRound">
        <template #description>当前暂无验收记录；全部工序完成后，在待验收阶段点击开始验收。</template>
      </a-empty>

      <div v-else class="detail-acceptance__grid" :class="{ 'detail-acceptance__grid--single': acceptanceCards.length === 1 }">
        <a-card v-for="card in acceptanceCards" :key="card.type" size="small" class="accept-card">
          <template #title>
            <div class="accept-card__title">
              <span>{{ card.title }}</span>
              <a-tag :color="getAcceptanceMeta(card.model).color">{{ getAcceptanceMeta(card.model).text }}</a-tag>
            </div>
          </template>
          <template #extra>
            <div class="accept-card__actions">
              <a-button v-if="card.type === 'INTERNAL' && canRequestRecheck(card.model)" size="small" @click="openRecheck">申请重新内验</a-button>
              <a-button v-if="canApplyRework(card.model)" danger size="small" @click="openRework(card.model, card.type)">申请返工</a-button>
            </div>
          </template>

          <a-form layout="vertical">
            <div class="accept-card__owner">
              <span>办理责任</span>
              <strong>{{ responsibilityText(card.type) }}</strong>
              <a-tag v-if="canOperate(card.type)" color="blue">当前账号可办理</a-tag>
            </div>
            <a-form-item label="验收负责人">
              <a-input :value="responsibleName(card.type)" disabled placeholder="提交时自动记录当前登录人" />
            </a-form-item>
            <a-form-item label="验收日期" :required="canEdit(card.model, card.type)">
              <a-date-picker
                v-if="canEdit(card.model, card.type)"
                v-model:value="card.model.acceptDate"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD HH:mm:ss"
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
              :label="card.type === 'INTERNAL' ? '验收报告' : '竣工报告（验收报告）'"
              required
            >
              <div class="file-field">
                <a-upload
                  v-if="canEdit(card.model, card.type)"
                  :accept="ACCEPTANCE_REPORT_ACCEPT"
                  :multiple="false"
                  :show-upload-list="false"
                  :disabled="uploadBusy || internalLoading || customerLoading || reportFiles(card.type).length >= ACCEPTANCE_REPORT_LIMIT"
                  :before-upload="(file) => onReportUpload(card.type === 'INTERNAL' ? 'internal' : 'customer', file)"
                >
                  <a-button
                    size="small"
                    :loading="uploadingTarget === (card.type === 'INTERNAL' ? 'internal' : 'customer')"
                    :disabled="uploadBusy || internalLoading || customerLoading || reportFiles(card.type).length >= ACCEPTANCE_REPORT_LIMIT"
                    >上传{{ card.type === 'INTERNAL' ? '验收报告' : '外部验收报告' }}</a-button
                  >
                </a-upload>
                <span v-if="canEdit(card.model, card.type)" class="file-field__empty" aria-live="polite">
                  {{ reportFiles(card.type).length }}/{{ ACCEPTANCE_REPORT_LIMIT }} 个，每次上传一个；支持图片、Word、PDF、Excel
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
                    @click="removeAcceptanceFile(card.type, 'completionReportFileId', path)"
                    >删除</a-button
                  >
                </div>
              </div>
            </a-form-item>

            <a-form-item
              v-if="
                card.type === 'CUSTOMER' &&
                (normalizeResult(card.model.result) === 'PASSED' || (!canEdit(card.model, card.type) && card.model.acceptanceFormFileId))
              "
              label="验收单"
            >
              <div class="file-field">
                <a-upload
                  v-if="canEdit(card.model, card.type) && !card.model.acceptanceFormFileId"
                  :accept="DOCUMENT_UPLOAD_ACCEPT"
                  :show-upload-list="false"
                  :disabled="uploadBusy || internalLoading || customerLoading"
                  :before-upload="(file) => onReportUpload('acceptForm', file)"
                >
                  <a-button size="small" :loading="uploadingTarget === 'acceptForm'" :disabled="uploadBusy || internalLoading || customerLoading"
                    >上传验收单</a-button
                  >
                </a-upload>
                <span v-if="!card.model.acceptanceFormFileId" class="file-field__empty">未上传</span>
                <a-tag
                  v-else
                  :key="card.type + (card.model.completionReportFileId || card.model.acceptanceFormFileId)"
                  :closable="canEdit(card.model, card.type) && !uploadBusy && !internalLoading && !customerLoading"
                  class="file-tag"
                  @close.prevent="removeAcceptanceFile(card.type, 'acceptanceFormFileId')"
                  >{{ fileName(card.model.acceptanceFormFileId) }}</a-tag
                >
                <a-button v-if="card.model.acceptanceFormFileId" size="small" @click="previewFileInModal(card.model.acceptanceFormFileId)"
                  >预览</a-button
                >
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
            <div v-if="canComplete(card.model, card.type)" class="accept-card__submit">
              <span class="file-field__empty">附件及填写内容将在提交验收后保存。</span>
              <a-button
                type="primary"
                :disabled="uploadBusy || internalLoading || customerLoading"
                :loading="isCardLoading(card.type)"
                @click="handleComplete(card.type)"
                >提交验收</a-button
              >
            </div>
          </a-form>
        </a-card>
      </div>
    </a-spin>

    <a-card v-if="!operationOnly" title="历次验收记录" size="small" class="detail-acceptance__history">
      <a-table
        :columns="historyColumns"
        :data-source="historyRows"
        :row-key="(record) => `${record.acceptType}-${record.id}`"
        :pagination="false"
        :scroll="{ x: 1160 }"
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
                @click="previewFileInModal(path)"
              >
                {{ field === 'completionReportFileId' ? '验收报告' : '验收单' }}：{{ fileName(path) }}
              </a-button>
            </div>
            <span v-if="!record.completionReportFileId && !record.acceptanceFormFileId">—</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="canApplyRework(record)" type="link" danger size="small" @click="openRework(record, record.acceptType)">申请返工</a-button>
            <span v-else>—</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="recheckOpen"
      title="申请重新内部验收"
      ok-text="提交申请"
      :confirm-loading="internalLoading"
      :closable="!internalLoading"
      :mask-closable="false"
      :cancel-button-props="{ disabled: internalLoading }"
      @ok="submitRecheck"
    >
      <a-alert type="info" show-icon message="提交后直接开始重新内验，外部验收结果保持不变。" />
      <a-form layout="vertical">
        <a-form-item label="原不通过原因"
          ><span>{{ internal.remark || '—' }}</span></a-form-item
        >
        <a-form-item label="申请原因" required
          ><a-textarea v-model:value="recheckReason" :rows="4" placeholder="请说明无需施工整改、申请重新内验的原因" :disabled="internalLoading"
        /></a-form-item>
      </a-form>
    </a-modal>
    <ReworkDrawer @register="registerReworkDrawer" @success="handleReworkChanged" />
  </div>
</template>

<script lang="ts" setup>
  import { computed, nextTick, reactive, ref, watch } from 'vue';
  import dayjs from 'dayjs';
  import { useAcceptanceAccess } from '../../useAcceptanceAccess';
  import { changePeriodStatus } from '../../Project.api';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { completeProjectAcceptance, getAcceptance, getMembers, submitAcceptanceRecheck } from '../ProjectDetail.api';
  import { DOCUMENT_UPLOAD_ACCEPT, isAllowedDocumentFile, uploadProjectDocument } from '/@/utils/documentUpload';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { ACCEPTANCE_REPORT_ACCEPT, ACCEPTANCE_REPORT_LIMIT, acceptanceFilePaths, isAcceptanceReportFile } from '../acceptanceFiles';
  import { useUserStore } from '/@/store/modules/user';
  import { refreshTodos } from '/@/views/todo/useTodoCenter';
  import ReworkDrawer from './ReworkDrawer.vue';

  type AcceptanceType = 'INTERNAL' | 'CUSTOMER';
  type UploadTarget = 'internal' | 'customer' | 'acceptForm';

  const props = withDefaults(defineProps<{ projectId: string; project?: Recordable; initialReworkId?: string; operationOnly?: boolean }>(), {
    project: () => ({}),
    initialReworkId: '',
    operationOnly: false,
  });
  const emit = defineEmits<{ changed: []; busyChange: [busy: boolean] }>();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const userStore = useUserStore();
  const [registerReworkDrawer, { openDrawer: openReworkDrawer }] = useDrawer();

  const { canOperateAcceptance, canStartAcceptance } = useAcceptanceAccess();
  const startingAcceptance = ref(false);
  const recheckOpen = ref(false);
  const recheckReason = ref('');
  const acceptedManager = ref(false);
  const loading = ref(false);
  const internalLoading = ref(false);
  const customerLoading = ref(false);
  const uploadingTarget = ref<UploadTarget | ''>('');
  const uploadBusy = computed(() => Boolean(uploadingTarget.value));
  watch(
    [internalLoading, customerLoading, uploadBusy],
    ([internalBusy, customerBusy, uploading]) => emit('busyChange', internalBusy || customerBusy || uploading),
    { flush: 'sync' }
  );
  const internalRecords = ref<Recordable[]>([]);
  const customerRecords = ref<Recordable[]>([]);
  let openedInitialRework = false;

  const resultOptions = [
    { label: '通过', value: 'PASSED' },
    { label: '不通过', value: 'FAILED' },
  ];
  const internal = reactive<Recordable>(emptyInternal());
  const customer = reactive<Recordable>(emptyCustomer());
  const acceptanceCards = computed(() =>
    [
      { type: 'INTERNAL' as const, title: '内部验收', model: internal },
      { type: 'CUSTOMER' as const, title: '外部验收', model: customer },
    ].filter((card) => !props.operationOnly || canOperate(card.type) || (card.type === 'INTERNAL' && canRequestRecheck(card.model)))
  );
  const currentUserId = computed(() => String((userStore.getUserInfo as any)?.id || (userStore.getUserInfo as any)?.userId || ''));
  const currentUserName = computed(() => {
    const user: any = userStore.getUserInfo;
    return String(user?.realname || user?.realName || user?.username || '');
  });
  const projectManagerId = computed(() => String(props.project?.projectManagerUserId || props.project?.projectManagerId || ''));
  const hasCurrentRound = computed(() => Boolean(internal.id || customer.id));
  const currentReworkId = computed(() =>
    String(props.project?.currentReworkId || internal.reworkId || customer.reworkId || props.initialReworkId || '')
  );
  const historyRows = computed(() =>
    [
      ...internalRecords.value.map((record) => ({ ...record, acceptType: 'INTERNAL' })),
      ...customerRecords.value.map((record) => ({ ...record, acceptType: 'CUSTOMER' })),
    ].sort((a, b) => String(b.updateTime || b.createTime || '').localeCompare(String(a.updateTime || a.createTime || '')))
  );
  const historyColumns = [
    { title: '验收类型', key: 'acceptType', width: 110 },
    { title: '验收轮次', key: 'round', width: 110 },
    { title: '状态', key: 'status', width: 110 },
    { title: '结果', key: 'result', width: 100 },
    { title: '验收负责人', width: 130, customRender: ({ record }) => record.acceptUnitLeader || record.acceptLeaderName || '—' },
    { title: '验收日期', dataIndex: 'acceptEndDate', width: 120, customRender: ({ text }) => formatAcceptanceDate(text) },
    { title: '验收说明', key: 'remark', width: 220 },
    { title: '验收附件', key: 'files', width: 240 },
    { title: '操作', key: 'action', width: 100, fixed: 'right' },
  ];

  function emptyInternal() {
    return {
      id: '',
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
    const status = resolveStatus(record);
    if (status === 'COMPLETED' && normalizeResult(record?.result) === 'PASSED') return { text: '已通过', color: 'success' };
    if (status === 'COMPLETED' && normalizeResult(record?.result) === 'FAILED') return { text: '未通过', color: 'error' };
    if (status === 'IN_PROGRESS') return { text: '验收中', color: 'processing' };
    if (status === 'CANCELLED') return { text: '已取消', color: 'default' };
    if (status === 'NOT_STARTED') return { text: '未开始', color: 'default' };
    return { text: '暂无记录', color: 'default' };
  }

  function canOperate(type: AcceptanceType) {
    return canOperateAcceptance(type, projectManagerId.value);
  }

  function responsibilityText(type: AcceptanceType) {
    return type === 'INTERNAL' ? '运维部门经理' : '本项目项目经理';
  }

  function responsibleName(type: AcceptanceType) {
    const record = activeRecord(type);
    if (canEdit(record, type)) return currentUserName.value;
    return String(record.acceptUnitLeader || record.acceptLeaderName || '—');
  }

  function assignResponsible(type: AcceptanceType) {
    const record = activeRecord(type);
    if (!currentUserId.value || !currentUserName.value) throw new Error('当前登录人信息缺失，请重新登录后提交');
    record.acceptLeaderId = currentUserId.value;
    record.acceptLeaderName = currentUserName.value;
    record.acceptUnitLeader = currentUserName.value;
  }

  function canEdit(record: Recordable, type: AcceptanceType) {
    return Boolean(record?.id) && !['COMPLETED', 'CANCELLED'].includes(resolveStatus(record)) && canOperate(type);
  }

  function canComplete(record: Recordable, type: AcceptanceType) {
    return canOperate(type) && resolveStatus(record) === 'IN_PROGRESS';
  }

  function canApplyRework(record: Recordable) {
    return (
      Boolean(record?.id) &&
      [internal.id, customer.id].includes(record.id) &&
      ![internal, customer].some((item) => item.sourceAcceptanceId && resolveStatus(item) === 'IN_PROGRESS') &&
      resolveStatus(record) === 'COMPLETED' &&
      normalizeResult(record.result) === 'FAILED' &&
      hasPermission('project:rework:apply')
    );
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
    return acceptanceFilePaths(activeRecord(type).completionReportFileId);
  }

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
    if (isReport && reportFiles(type).length >= ACCEPTANCE_REPORT_LIMIT) {
      createMessage.warning('验收报告最多上传 3 个文件，请先删除再添加');
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
      const field: AcceptanceFileField = target === 'acceptForm' ? 'acceptanceFormFileId' : 'completionReportFileId';
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
    if (reportFiles(type).length > ACCEPTANCE_REPORT_LIMIT) throw new Error('验收报告最多保留 3 个文件，请先删除多余附件');
    if (normalizeResult(record.result) === 'PASSED' && type === 'INTERNAL' && !record.completionReportFileId)
      throw new Error('内部验收必须由运维部门经理上传验收报告');
    if (normalizeResult(record.result) === 'PASSED' && type === 'CUSTOMER' && !record.completionReportFileId)
      throw new Error('外部验收必须由本项目项目经理上传验收报告');
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
        acceptEndDate: dayjs(record.acceptDate).startOf('day').format('YYYY-MM-DD HH:mm:ss'),
        result,
        acceptUnitLeader: currentUserName.value,
        acceptUnitPhone: record.acceptUnitPhone || '',
        completionReportFileId: result === 'PASSED' ? record.completionReportFileId || '' : '',
        ...(type === 'CUSTOMER' ? { acceptanceFormFileId: result === 'PASSED' ? record.acceptanceFormFileId || '' : '' } : {}),
        remark: String(record.remark || '').trim(),
        ...(currentReworkId.value ? { reworkId: currentReworkId.value } : {}),
      });
      createMessage.success(`${type === 'INTERNAL' ? '内部' : '外部'}验收已完成`);
      await load();
      refreshTodos(true).catch(() => undefined);
      emit('changed');
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

  function chooseCurrent(records: Recordable[]) {
    const round = String(props.project?.currentReworkId || props.initialReworkId || '');
    const current = records.filter((record) => String(record.reworkId || '') === round);
    const sources = new Set(current.map((record) => String(record.sourceAcceptanceId || '')));
    return current.find((record) => !sources.has(String(record.id))) || {};
  }

  function canRequestRecheck(record: Recordable) {
    return (
      props.project.status === 'ACCEPTING' &&
      acceptedManager.value &&
      hasPermission('project:acceptance:submit') &&
      record.id === internal.id &&
      resolveStatus(record) === 'COMPLETED' &&
      normalizeResult(record.result) === 'FAILED'
    );
  }

  function openRecheck() {
    recheckReason.value = '';
    recheckOpen.value = true;
  }

  async function submitRecheck() {
    if (internalLoading.value || !canRequestRecheck(internal)) return;
    const reason = recheckReason.value.trim();
    if (!reason) return createMessage.warning('请填写重新内验申请原因');
    internalLoading.value = true;
    try {
      const result = await submitAcceptanceRecheck({ periodId: props.projectId, sourceAcceptanceId: String(internal.id), reason });
      if (!result?.id) throw new Error('接口未返回新验收记录，请刷新确认，勿重复申请');
      // 直接采用新记录 ID，不复制原失败结论和附件，也不改动外部验收草稿。
      fillInternal(result);
      internalRecords.value = [result, ...internalRecords.value.filter((item) => item.id !== result.id)];
      recheckOpen.value = false;
      createMessage.success('重新内部验收已开始');
      refreshTodos(true).catch(() => undefined);
    } catch (error: any) {
      createMessage.error(error?.message || '重新内验申请失败');
    } finally {
      internalLoading.value = false;
    }
  }

  async function loadManager() {
    const periodId = props.projectId;
    acceptedManager.value = false;
    try {
      let pageNo = 1;
      while (true) {
        const result = await getMembers({ periodId, pageNo, pageSize: 100 });
        if (periodId !== props.projectId) return;
        const records = Array.isArray(result) ? result : result?.records || [];
        if (
          records.some(
            (item) =>
              String(item.userId) === currentUserId.value &&
              String(item.inviteStatus) === '1' &&
              Number(item.delFlag || 0) === 0 &&
              String(item.memberRole)
                .split(',')
                .map((role) => role.trim())
                .includes('2')
          )
        ) {
          acceptedManager.value = true;
          return;
        }
        if (Array.isArray(result) || records.length < 100 || pageNo * 100 >= Number(result.total)) return;
        pageNo++;
      }
    } catch {
      createMessage.warning('项目经理身份加载失败，暂无法申请重新内验，请刷新重试');
    }
  }

  function fillInternal(record: Recordable) {
    Object.assign(internal, emptyInternal(), record, {
      completionReportFileId: record.completionReportFileId || record.reportFileId || '',
      result: normalizeResult(record.result),
    });
  }

  function fillCustomer(record: Recordable) {
    Object.assign(customer, emptyCustomer(), record, { result: normalizeResult(record.result) });
  }

  async function handleStartAcceptance() {
    if (startingAcceptance.value || !canStartAcceptance() || props.project.status !== 'PENDING_ACCEPT') return;
    startingAcceptance.value = true;
    try {
      await changePeriodStatus({ periodId: props.projectId, status: 'PENDING_ACCEPT' });
      createMessage.success('验收已启动');
      await load();
      refreshTodos(true).catch(() => undefined);
      emit('changed');
    } catch {
      // 请求层已提示错误，保留待验收入口供重试。
    } finally {
      startingAcceptance.value = false;
    }
  }

  async function load() {
    if (!props.projectId) return;
    loading.value = true;
    try {
      const [internalResult, customerResult]: any[] = await Promise.all([
        getAcceptance({ periodId: props.projectId, acceptType: 'INTERNAL', pageNo: 1, pageSize: 100 }),
        getAcceptance({ periodId: props.projectId, acceptType: 'CUSTOMER', pageNo: 1, pageSize: 100 }),
      ]);
      internalRecords.value = normalizeRecords(internalResult);
      customerRecords.value = normalizeRecords(customerResult);
      fillInternal(chooseCurrent(internalRecords.value));
      fillCustomer(chooseCurrent(customerRecords.value));
      if (props.initialReworkId && !openedInitialRework) {
        openedInitialRework = true;
        await nextTick();
        openReworkDrawer(true, { periodId: props.projectId, reworkId: props.initialReworkId, project: props.project });
      }
    } catch (error: any) {
      internalRecords.value = [];
      customerRecords.value = [];
      fillInternal({});
      fillCustomer({});
      createMessage.error(error?.message || '验收记录加载失败，请重试');
    } finally {
      loading.value = false;
    }
  }

  function openRework(record: Recordable, type: AcceptanceType) {
    openReworkDrawer(true, {
      periodId: props.projectId,
      project: props.project,
      sourceAcceptance: { ...record, acceptType: type },
      initialCreate: true,
    });
  }

  async function handleReworkChanged() {
    await load();
    emit('changed');
  }

  watch(
    () => props.projectId,
    () => {
      openedInitialRework = false;
      recheckOpen.value = false;
      void loadManager();
      void load();
    },
    { immediate: true }
  );
</script>

<style lang="less" scoped>
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
