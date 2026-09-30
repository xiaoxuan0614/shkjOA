<template>
  <BasicDrawer
    v-bind="$attrs"
    @register="register"
    title="确认工序实施进度"
    :width="1180"
    showFooter
    okText="完成"
    cancelText="取消"
    :okButtonProps="{ disabled: !selectedProcessId || loading || !!loadError }"
    :maskClosable="false"
    destroyOnClose
    @ok="handleComplete"
  >
    <a-alert
      class="process-completion__notice"
      type="info"
      show-icon
      message="请选择本次已完成的工序"
      description="未开始和进行中的工序均可选择；已完成工序仅供查看。最后一道工序完成后，系统将自动推进项目状态。"
    />

    <div v-if="projectName || periodName" class="process-completion__project">
      {{ projectName || '未命名项目' }}{{ periodName ? ` / ${periodName}` : '' }}
    </div>

    <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="process-completion__error">
      <template #action>
        <a-button size="small" @click="loadProcesses">重新加载</a-button>
      </template>
    </a-alert>

    <a-table
      v-else
      :columns="columns"
      :data-source="processes"
      :loading="loading"
      :pagination="false"
      :row-selection="rowSelection"
      :scroll="{ x: 1080 }"
      :locale="{ emptyText: '暂无可完成的工序' }"
      :row-class-name="getRowClassName"
      row-key="id"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'processName'">
          {{ getProcessName(record.processName) }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="getStatusMeta(record.status).color">{{ getStatusMeta(record.status).label }}</a-tag>
        </template>
        <template v-else-if="column.key === 'plannedDuration'">
          {{ getInclusiveDays(record.plannedStartTime, record.plannedEndTime) }}
        </template>
        <template v-else-if="column.key === 'actualStartTime'">
          {{ formatDate(record.actualStartTime) }}
        </template>
        <template v-else-if="column.key === 'elapsedDuration'">
          {{ getElapsedDays(record) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button type="link" size="small" @click="handleViewLogs(record)">详情</a-button>
        </template>
      </template>
    </a-table>
  </BasicDrawer>
  <a-modal
    v-model:open="returnOpen"
    title="该项目剩余物料待还库"
    :width="900"
    :footer="null"
    :mask-closable="false"
    :closable="!submitting"
    :keyboard="!submitting"
  >
    <a-alert type="warning" show-icon message="本次尚未完成工序，也未进入验收。请申请还料，或填写原因后强制提交。" />
    <p>以下按应还数量非零展示；应还数量未扣除已回库和异常处置，请结合待处置数量查看。</p>
    <a-alert v-if="returnError" type="error" :message="returnError" show-icon>
      <template #action><a-button size="small" @click="loadReturnMaterials">重试</a-button></template>
    </a-alert>
    <a-table
      :columns="returnColumns"
      :data-source="returnRows"
      :loading="returnLoading"
      row-key="materialId"
      :pagination="false"
      :scroll="{ x: 760, y: 300 }"
      size="small"
    />
    <a-form-item label="强制提交原因" required :validate-status="reasonError ? 'error' : undefined" :help="reasonError" style="margin-top: 16px">
      <a-textarea
        v-model:value="forceReason"
        :maxlength="200"
        :rows="3"
        show-count
        :disabled="submitting"
        placeholder="例如：现场暂存，预计明日归还（1至200字）"
      />
    </a-form-item>
    <a-space style="display: flex; justify-content: flex-end">
      <a-button :disabled="submitting" @click="returnOpen = false">取消</a-button>
      <a-button :disabled="submitting" @click="applyReturn">申请还料</a-button>
      <a-button type="primary" danger :loading="submitting" :disabled="returnLoading || !!returnError" @click="forceComplete">强制提交</a-button>
    </a-space>
  </a-modal>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import dayjs from 'dayjs';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { changeProjectProcessStatus, getProjectProcessDetail } from '../Project.api';
  import { loadProjectProcessStatusOptions, loadProjectWorkTypeOptions, projectProcessStatusOptions } from '../Project.data';
  import { getProjectBasic } from '../detail/ProjectDetail.api';
  import { readProjectMembership } from '../projectMembership';
  import { useUserStore } from '/@/store/modules/user';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { getProjectMaterialAccount } from '/@/views/material/return/Return.api';
  import { completionOutcome, forceCompletionPayload, loadCompletionMaterials } from '../processCompletion';
  import { unifyMaterialColumns } from '/@/views/material/materialTableColumns';

  const emit = defineEmits(['register', 'success']);
  const route = useRoute();
  const router = useRouter();
  const { createConfirm, createMessage } = useMessage();
  const user = useUserStore();
  const { hasPermission } = usePermission();
  const userId = computed(() => String(user.getUserInfo?.id || ''));
  const isManager = ref(false);
  const currentReworkId = ref('');
  const currentStatus = ref('');
  const submitting = ref(false);
  const returnOpen = ref(false),
    returnLoading = ref(false),
    returnError = ref('');
  const returnRows = ref<any[]>([]),
    blockedProcessId = ref(''),
    forceReason = ref(''),
    reasonError = ref('');
  const returnColumns = unifyMaterialColumns(
    [
      { title: '物料名称', dataIndex: 'materialName', width: 200, fixed: 'left' as const },
      { title: '编码', dataIndex: 'materialCode', width: 150 },
      { title: '单位', dataIndex: 'baseUnitName', width: 70 },
      { title: '应还数量', dataIndex: 'shouldReturnQty', width: 110 },
      { title: '已合格回库', dataIndex: 'actualReturnQty', width: 110 },
      { title: '待处置数量', dataIndex: 'remainingReturnQty', width: 110 },
    ],
    { source: 'detail', nameField: 'materialName' }
  );
  let returnSequence = 0;
  async function loadReturnMaterials() {
    const sequence = ++returnSequence;
    const id = periodId.value;
    returnLoading.value = true;
    returnError.value = '';
    returnRows.value = [];
    try {
      const rows = await loadCompletionMaterials((pageNo, pageSize) => getProjectMaterialAccount({ periodId: id, pageNo, pageSize }));
      if (sequence === returnSequence) returnRows.value = rows;
    } catch (error) {
      if (sequence === returnSequence) returnError.value = error instanceof Error ? error.message : '物料明细加载失败';
    } finally {
      if (sequence === returnSequence) returnLoading.value = false;
    }
  }
  async function applyReturn() {
    if (submitting.value) return;
    await router.push({ path: '/material/return', query: { periodId: periodId.value, from: route.fullPath } });
    returnOpen.value = false;
    closeDrawer();
  }
  async function forceComplete() {
    if (submitting.value || returnLoading.value || returnError.value || !blockedProcessId.value || !hasPermission('project:implement')) return;
    reasonError.value = '';
    let payload;
    try {
      payload = forceCompletionPayload(blockedProcessId.value, forceReason.value);
    } catch (error) {
      reasonError.value = (error as Error).message;
      return;
    }
    submitting.value = true;
    try {
      const result = await changeProjectProcessStatus(payload);
      if (completionOutcome(result) !== 'submitted') {
        createMessage.warning('工序尚未提交，请核对还料情况后重试');
        return;
      }
      returnOpen.value = false;
      closeDrawer();
      emit('success');
      createMessage.success('工序已完成；项目状态以服务端最新结果为准');
    } catch (error) {
      reasonError.value = error instanceof Error ? error.message : '强制提交失败，请重试';
    } finally {
      submitting.value = false;
    }
  }
  function selectable(record: Recordable, verifyIdentity = false) {
    return (
      hasPermission('project:implement') &&
      !!userId.value &&
      (!verifyIdentity || isManager.value || String(record.siteLeaderId || '') === userId.value) &&
      (!currentReworkId.value || String(record.reworkId || '') === currentReworkId.value) &&
      ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED', 'REWORKING'].includes(currentStatus.value) &&
      normalizeStatus(record.status) === 'IN_PROGRESS'
    );
  }

  const periodId = ref('');
  const projectName = ref('');
  const periodName = ref('');
  const processes = ref<Recordable[]>([]);
  const selectedProcessId = ref('');
  const loading = ref(false);
  const loadError = ref('');
  const statusMeta = ref<Record<string, { label: string; color: string }>>(
    Object.fromEntries(projectProcessStatusOptions.map((item) => [item.value, { label: item.label, color: item.color || 'default' }]))
  );
  const workTypeMeta = ref<Record<string, string>>({});

  const columns = [
    { title: '工序名称', dataIndex: 'processName', key: 'processName', width: 180, ellipsis: true },
    { title: '工序状态', dataIndex: 'status', key: 'status', width: 110, align: 'center' },
    { title: '计划周期（天）', key: 'plannedDuration', width: 130, align: 'center' },
    { title: '实际开始时间', dataIndex: 'actualStartTime', key: 'actualStartTime', width: 140, align: 'center' },
    { title: '已进行时长', key: 'elapsedDuration', width: 120, align: 'center' },
    { title: '现场负责人', dataIndex: 'siteLeaderName', width: 140, ellipsis: true },
    { title: '操作', key: 'action', width: 80, align: 'center', fixed: 'right' },
  ];

  const rowSelection = computed(() => ({
    type: 'radio',
    selectedRowKeys: selectedProcessId.value ? [selectedProcessId.value] : [],
    onChange: (keys: (string | number)[]) => {
      selectedProcessId.value = keys.length ? String(keys[0]) : '';
    },
    getCheckboxProps: (record: Recordable) => ({
      disabled: submitting.value || !selectable(record),
      name: `选择工序${getProcessName(record.processName)}`,
    }),
  }));

  const [register, { setDrawerProps, closeDrawer }] = useDrawerInner(async (data) => {
    returnSequence++;
    returnOpen.value = false;
    blockedProcessId.value = '';
    const record = data?.record || data || {};
    periodId.value = String(data?.periodId || record.periodId || record.id || '');
    projectName.value = record.projectName || '';
    periodName.value = record.periodName || '';
    currentReworkId.value = String(record.currentReworkId || '');
    currentStatus.value = String(record.periodStatus ?? record.status ?? '').toUpperCase();
    isManager.value = record._isArrivalManager === true && record._managerUserId === userId.value;
    selectedProcessId.value = '';
    processes.value = [];
    loadError.value = '';
    setDrawerProps({ confirmLoading: false });
    if (!periodId.value) {
      loadError.value = '缺少项目分期 ID，无法加载工序';
      return;
    }
    await loadProcesses();
  });

  function normalizeStatus(status: unknown) {
    return String(status || 'NOT_STARTED').toUpperCase();
  }

  function getStatusMeta(status: unknown) {
    const code = normalizeStatus(status);
    return statusMeta.value[code] || { label: String(status || '未开始'), color: 'default' };
  }

  function getProcessName(processName: unknown) {
    const value = String(processName ?? '');
    return workTypeMeta.value[value] || value || '—';
  }

  function parseDate(value: unknown) {
    if (!value) return null;
    const parsed = dayjs(String(value));
    return parsed.isValid() ? parsed.startOf('day') : null;
  }

  function getInclusiveDays(startValue: unknown, endValue: unknown) {
    const start = parseDate(startValue);
    const end = parseDate(endValue);
    if (!start || !end || end.isBefore(start)) return '—';
    return `${end.diff(start, 'day') + 1}天`;
  }

  function getElapsedDays(record: Recordable) {
    const start = parseDate(record.actualStartTime);
    if (!start) return '—';
    const end = parseDate(record.actualEndTime) || dayjs().startOf('day');
    if (end.isBefore(start)) return '—';
    return `${end.diff(start, 'day') + 1}天`;
  }

  function formatDate(value: unknown) {
    const parsed = parseDate(value);
    return parsed ? parsed.format('YYYY-MM-DD') : '—';
  }

  async function loadProcesses(verifyAccess = false) {
    if (!periodId.value) return;
    loading.value = true;
    loadError.value = '';
    selectedProcessId.value = '';
    try {
      const [detail, statusOptions, workTypeOptions]: any[] = await Promise.all([
        getProjectProcessDetail({ periodId: periodId.value }),
        loadProjectProcessStatusOptions(),
        loadProjectWorkTypeOptions(),
      ]);
      // 查看进度复用列表上下文；实际完成工序前才刷新身份和分期状态。
      if (verifyAccess === true) {
        const [access, period] = await Promise.all([
          readProjectMembership(periodId.value, userId.value),
          getProjectBasic({ periodId: periodId.value }),
        ]);
        isManager.value = access.manager;
        currentReworkId.value = String(period.currentReworkId || '');
        currentStatus.value = String(period.periodStatus ?? period.status ?? '').toUpperCase();
      }
      processes.value = Array.isArray(detail?.records) ? detail.records : [];
      statusMeta.value = Object.fromEntries(
        statusOptions.map((item: Recordable) => [String(item.value), { label: item.label, color: item.color || 'default' }])
      );
      workTypeMeta.value = Object.fromEntries(workTypeOptions.map((item: Recordable) => [String(item.value), String(item.label)]));
    } catch (error) {
      processes.value = [];
      loadError.value = '工序加载失败，请重新加载';
    } finally {
      loading.value = false;
    }
  }

  function getRowClassName(record: Recordable) {
    return normalizeStatus(record.status) === 'COMPLETED' ? 'process-completion__row--completed' : '';
  }

  function handleViewLogs(record: Recordable) {
    if (!periodId.value || !record.id) {
      createMessage.error('缺少项目分期或工序 ID，无法查看施工日志');
      return;
    }
    const returnTo = route.fullPath;
    closeDrawer();
    router.push({ path: `/implement/log/${periodId.value}`, query: { processId: String(record.id), returnTo } });
  }

  function handleComplete() {
    if (submitting.value || loading.value || loadError.value) return;
    const selected = processes.value.find((item) => String(item.id) === selectedProcessId.value);
    if (!selected || !selectable(selected)) {
      createMessage.warning('请选择本次已完成的工序');
      return;
    }
    createConfirm({
      iconType: 'warning',
      title: '确认完成工序',
      content: `确认将工序“${getProcessName(selected.processName)}”标记为已完成？`,
      okText: '确认完成',
      cancelText: '取消',
      onOk: async () => {
        if (submitting.value) return;
        submitting.value = true;
        const selectedId = selectedProcessId.value;
        setDrawerProps({ confirmLoading: true });
        try {
          await loadProcesses(true);
          const fresh = processes.value.find((item) => String(item.id) === selectedId);
          if (loadError.value || !fresh || !selectable(fresh, true)) return createMessage.warning('工序状态或操作资格已变化，请重新选择');
          const result = await changeProjectProcessStatus({ processId: selectedId, status: 'COMPLETED' });
          if (completionOutcome(result) === 'return-required') {
            blockedProcessId.value = selectedId;
            forceReason.value = '';
            reasonError.value = '';
            returnOpen.value = true;
            void loadReturnMaterials();
            return;
          }
          createMessage.success(`工序“${getProcessName(selected.processName)}”已完成`);
          closeDrawer();
          emit('success');
        } catch (error) {
          createMessage.error(error instanceof Error ? error.message : '工序提交失败，请重试');
        } finally {
          submitting.value = false;
          setDrawerProps({ confirmLoading: false });
        }
      },
    });
  }
</script>

<style lang="less" scoped>
  .process-completion {
    &__notice {
      margin-bottom: 16px;
    }

    &__project {
      margin-bottom: 12px;
      color: #262626;
      font-size: 15px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    &__error {
      margin-top: 8px;
    }
  }

  :deep(.process-completion__row--completed) {
    color: #8c8c8c;
    background: #fafafa;
  }

  :deep(.ant-table-cell) {
    font-variant-numeric: tabular-nums;
  }
</style>
