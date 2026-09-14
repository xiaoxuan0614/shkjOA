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
  function selectable(record: Recordable) {
    return hasPermission('project:implement') && !!userId.value &&
      (isManager.value || String(record.siteLeaderId || '') === userId.value) &&
      (!currentReworkId.value || String(record.reworkId || '') === currentReworkId.value) &&
      ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED', 'REWORKING'].includes(currentStatus.value) &&
      normalizeStatus(record.status) === 'IN_PROGRESS';
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
    const record = data?.record || data || {};
    periodId.value = String(data?.periodId || record.periodId || record.id || '');
    projectName.value = record.projectName || '';
    periodName.value = record.periodName || '';
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

  async function loadProcesses() {
    if (!periodId.value) return;
    loading.value = true;
    loadError.value = '';
    selectedProcessId.value = '';
    try {
      const [detail, statusOptions, workTypeOptions, access, period]: any[] = await Promise.all([
        getProjectProcessDetail({ periodId: periodId.value }),
        loadProjectProcessStatusOptions(),
        loadProjectWorkTypeOptions(),
        readProjectMembership(periodId.value, userId.value),
        getProjectBasic({ periodId: periodId.value }),
      ]);
      isManager.value = access.manager;
      currentReworkId.value = String(period.currentReworkId || '');
      currentStatus.value = String(period.periodStatus ?? period.status ?? '').toUpperCase();
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
          await loadProcesses();
          const fresh = processes.value.find((item) => String(item.id) === selectedId);
          if (loadError.value || !fresh || !selectable(fresh)) return createMessage.warning('工序状态或操作资格已变化，请重新选择');
          await changeProjectProcessStatus({ processId: selectedId, status: 'COMPLETED' });
          createMessage.success(`工序“${getProcessName(selected.processName)}”已完成`);
          closeDrawer();
          emit('success');
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
