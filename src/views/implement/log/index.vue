<template>
  <div class="implement-log">
    <a-card class="implement-log__card">
      <div class="implement-log__header">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
        <div class="implement-log__heading">
          <div class="implement-log__title">项目实施日志</div>
          <div class="implement-log__subtitle">按工序查看当前项目分期的全部实施记录</div>
        </div>
      </div>

      <a-spin :spinning="loading">
        <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="implement-log__error">
          <template #action>
            <a-button size="small" @click="loadProjectImplementation">重新加载</a-button>
          </template>
        </a-alert>

        <template v-else>
          <a-descriptions class="implement-log__project" :column="3" bordered size="middle">
            <a-descriptions-item label="项目名称">
              {{ project.projectName || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="分期名称">
              {{ project.periodName || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="项目状态">
              <a-tag :color="getProjectStatusMeta(project.status).color">
                {{ getProjectStatusMeta(project.status).text }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="项目编号">
              {{ project.projectNo || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="客户名称">
              {{ project.customerName || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="项目类型">
              {{ projectTypeMeta[String(project.projectType || '')] || project.projectType || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="计划验收日期">
              {{ processPlan.plannedAcceptanceDate || project.plannedAcceptanceDate || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="项目对接人">
              {{ project.projectLiaisonUserName || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="销售负责人">
              {{ ownerLoadError ? '加载失败' : contractOwners.salesUserName || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="项目经理">
              {{ ownerLoadError ? '加载失败' : contractOwners.projectManagerUserName || '—' }}
            </a-descriptions-item>
            <a-descriptions-item label="工序数量">{{ processes.length }} 道</a-descriptions-item>
          </a-descriptions>

          <a-alert v-if="ownerLoadError" type="warning" show-icon message="销售负责人和项目经理加载失败">
            <template #action><a-button size="small" @click="loadContractOwners">重试</a-button></template>
          </a-alert>

          <div class="implement-log__section-heading">
            <div>
              <div class="implement-log__section-title">工序日志</div>
              <div class="implement-log__section-description">展开工序后查看该工序的实施日期、人员、工时和现场记录</div>
            </div>
          </div>

          <a-empty v-if="!processes.length" description="当前项目分期尚未配置实施工序" class="implement-log__empty" />

          <a-collapse
            v-else
            v-model:activeKey="activeProcessKeys"
            class="implement-log__processes"
            :destroyInactivePanel="true"
            @change="handleCollapseChange"
          >
            <a-collapse-panel v-for="process in processes" :key="String(process.id)">
              <template #header>
                <div class="process-heading">
                  <div class="process-heading__primary">
                    <span class="process-heading__name">{{ getProcessName(process.processName) }}</span>
                    <a-tag :color="getProcessStatusMeta(process.status).color">
                      {{ getProcessStatusMeta(process.status).label }}
                    </a-tag>
                  </div>
                  <div class="process-heading__meta">
                    <span>现场负责人：{{ process.siteLeaderName || '—' }}</span>
                    <span>计划周期：{{ formatDateRange(process.plannedStartTime, process.plannedEndTime) }}</span>
                    <span>计划工时：{{ formatHours(process.plannedHours) }}</span>
                  </div>
                </div>
              </template>

              <a-alert
                v-if="getLogState(process.id).error"
                type="error"
                show-icon
                :message="getLogState(process.id).error"
                class="process-logs__error"
              >
                <template #action>
                  <a-button size="small" @click="loadProcessLogs(process.id)">重新加载</a-button>
                </template>
              </a-alert>

              <a-table
                v-else
                :columns="logColumns"
                :data-source="getLogState(process.id).records"
                :loading="getLogState(process.id).loading"
                :pagination="getLogPagination(process.id)"
                :row-key="(record) => record.id"
                :scroll="{ x: 1230 }"
                size="middle"
                bordered
                :locale="{ emptyText: '该工序暂无实施日志' }"
                @change="handleLogTableChange(process.id, $event)"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'logDate'">
                    {{ getSignInDate(record.signInTime) }}
                  </template>
                  <template v-else-if="column.key === 'hours'">
                    {{ formatLogHours(record) }}
                  </template>
                  <template v-else-if="column.key === 'location'">
                    {{ record.implementLocationName || '—' }}
                  </template>
                  <template v-else-if="column.key === 'workContent'">
                    <a-tooltip :title="record.workContent || '—'">
                      <span class="process-logs__content">{{ truncateWorkContent(record.workContent) }}</span>
                    </a-tooltip>
                  </template>
                  <template v-else-if="column.key === 'action'">
                    <a-button type="link" size="small" @click="handleDetail(record, process.id)">详情</a-button>
                  </template>
                </template>
              </a-table>
            </a-collapse-panel>
          </a-collapse>
        </template>
      </a-spin>
    </a-card>
  </div>
</template>

<script lang="ts" setup>
  import { onMounted, reactive, ref } from 'vue';
  import { getContractDetail } from '../../project/detail/ProjectDetail.api';
  import { formatLogHours } from '../logDisplay';
  import { useRoute, useRouter } from 'vue-router';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { implementProcessDetail, implementProjectDetail, logList } from '../Implement.api';
  import { loadWorkStatusOptions, workStatusOptions } from '../Implement.data';
  import { loadProjectStatusMap, loadProjectTypeMap, loadProjectWorkTypeOptions, projectStatusMap, statusColorMap } from '../../project/Project.data';

  defineOptions({ name: 'ImplementProjectLog' });

  interface ProcessLogState {
    records: Recordable[];
    loading: boolean;
    loaded: boolean;
    error: string;
    pageNo: number;
    pageSize: number;
    total: number;
    requestId: number;
  }

  const route = useRoute();
  const router = useRouter();
  const { createMessage } = useMessage();
  const periodId = String(route.params.id || '');

  const loading = ref(false);
  const loadError = ref('');
  const contractOwners = ref<Recordable>({});
  const ownerLoadError = ref(false);

  async function loadContractOwners() {
    contractOwners.value = {};
    ownerLoadError.value = false;
    try {
      contractOwners.value = (await getContractDetail({ periodId })) || {};
    } catch {
      ownerLoadError.value = true;
    }
  }
  const project = ref<Recordable>({});
  const processPlan = ref<Recordable>({});
  const processes = ref<Recordable[]>([]);
  const activeProcessKeys = ref<string[]>([]);
  const logStates = reactive<Record<string, ProcessLogState>>({});
  const processStatusMeta = ref<Record<string, { label: string; color: string }>>(
    Object.fromEntries(workStatusOptions.map((item) => [String(item.value), { label: item.label, color: item.color || 'default' }]))
  );
  const projectStatusMeta = ref<Record<string, { text: string; color: string }>>({});
  const projectTypeMeta = ref<Record<string, string>>({});
  const workTypeMeta = ref<Record<string, string>>({});

  const logColumns = [
    { title: '实施日期', dataIndex: 'signInTime', key: 'logDate', width: 120, align: 'center' },
    { title: '提交人', dataIndex: 'submitterName', key: 'submitterName', width: 110, align: 'center' },
    { title: '签到时间', dataIndex: 'signInTime', key: 'signInTime', width: 170, align: 'center' },
    { title: '签退时间', dataIndex: 'signOutTime', key: 'signOutTime', width: 170, align: 'center' },
    { title: '工时', dataIndex: 'hours', key: 'hours', width: 170, align: 'center' },
    { title: '实施位置', dataIndex: 'implementLocationName', key: 'location', width: 150, ellipsis: true },
    { title: '实施内容', dataIndex: 'workContent', key: 'workContent', width: 260 },
    { title: '操作', key: 'action', width: 80, align: 'center', fixed: 'right' },
  ];

  function createLogState(): ProcessLogState {
    return {
      records: [],
      loading: false,
      loaded: false,
      error: '',
      pageNo: 1,
      pageSize: 10,
      total: 0,
      requestId: 0,
    };
  }

  function getLogState(processId: unknown) {
    const key = String(processId || '');
    logStates[key] ||= createLogState();
    return logStates[key];
  }

  async function loadProjectImplementation() {
    if (!periodId) {
      loadError.value = '缺少项目分期 ID，无法加载实施日志';
      return;
    }
    loading.value = true;
    loadError.value = '';
    try {
      const [projectData, planData, statusOptions, statusMap, typeMap, workTypeOptions]: any[] = await Promise.all([
        implementProjectDetail({ periodId }),
        implementProcessDetail({ periodId }),
        loadWorkStatusOptions(),
        loadProjectStatusMap(),
        loadProjectTypeMap(),
        loadProjectWorkTypeOptions(),
        loadContractOwners(),
      ]);

      project.value = projectData || {};
      processPlan.value = planData || {};
      processes.value = Array.isArray(planData?.records) ? planData.records : [];
      processStatusMeta.value = Object.fromEntries(
        statusOptions.map((item: Recordable) => [String(item.value), { label: item.label, color: item.color || 'default' }])
      );
      projectStatusMeta.value = statusMap || {};
      projectTypeMeta.value = typeMap || {};
      workTypeMeta.value = Object.fromEntries(workTypeOptions.map((item: Recordable) => [String(item.value), String(item.label)]));

      Object.keys(logStates).forEach((key) => delete logStates[key]);
      processes.value.forEach((process) => {
        logStates[String(process.id)] = createLogState();
      });

      const requestedProcessId = String(route.query.processId || '');
      const initialProcess = processes.value.find((item) => String(item.id) === requestedProcessId) || processes.value[0];
      activeProcessKeys.value = initialProcess?.id ? [String(initialProcess.id)] : [];
      if (initialProcess?.id) await loadProcessLogs(initialProcess.id);
    } catch (error) {
      project.value = {};
      processPlan.value = {};
      processes.value = [];
      activeProcessKeys.value = [];
      loadError.value = '项目实施信息加载失败，请重新加载';
    } finally {
      loading.value = false;
    }
  }

  async function loadProcessLogs(processId: unknown, pageNo?: number, pageSize?: number) {
    const key = String(processId || '');
    if (!key) return;
    const state = getLogState(key);
    const nextPageNo = pageNo || state.pageNo || 1;
    const nextPageSize = pageSize || state.pageSize || 10;
    const requestId = state.requestId + 1;
    state.requestId = requestId;
    state.loading = true;
    state.error = '';
    try {
      const res: any = await logList({ processId: key, pageNo: nextPageNo, pageSize: nextPageSize });
      if (state.requestId !== requestId) return;
      const records = Array.isArray(res?.records) ? res.records : Array.isArray(res) ? res : [];
      state.records = records;
      state.pageNo = Number(res?.current || nextPageNo);
      state.pageSize = Number(res?.size || nextPageSize);
      state.total = Number(res?.total ?? records.length);
      state.loaded = true;
    } catch (error) {
      if (state.requestId !== requestId) return;
      state.records = [];
      state.total = 0;
      state.loaded = true;
      state.error = '该工序的实施日志加载失败，请重新加载';
    } finally {
      if (state.requestId === requestId) state.loading = false;
    }
  }

  function handleCollapseChange(keys: string | number | Array<string | number>) {
    const normalizedKeys = Array.isArray(keys) ? keys.map(String) : keys ? [String(keys)] : [];
    activeProcessKeys.value = normalizedKeys;
    normalizedKeys.forEach((key) => {
      const state = getLogState(key);
      if (!state.loaded && !state.loading) loadProcessLogs(key);
    });
  }

  function getLogPagination(processId: unknown) {
    const state = getLogState(processId);
    return {
      current: state.pageNo,
      pageSize: state.pageSize,
      total: state.total,
      showSizeChanger: true,
      pageSizeOptions: ['10', '20', '50'],
      showTotal: (total: number) => `共 ${total} 条`,
    };
  }

  function handleLogTableChange(processId: unknown, pagination: Recordable) {
    const state = getLogState(processId);
    const nextPageSize = Number(pagination?.pageSize || state.pageSize);
    const nextPageNo = nextPageSize === state.pageSize ? Number(pagination?.current || 1) : 1;
    loadProcessLogs(processId, nextPageNo, nextPageSize);
  }

  function goBack() {
    const returnTo = String(route.query.returnTo || '');
    router.push(returnTo.startsWith('/') ? returnTo : '/implement/list');
  }

  function handleDetail(record: Recordable, processId: unknown) {
    if (!record?.id) {
      createMessage.error('缺少日志 ID，无法查看详情');
      return;
    }
    router.push({
      path: `/implement/log/${periodId}/detail/${record.id}`,
      query: { processId: String(processId || record.processId || '') },
    });
  }

  function getProjectStatusMeta(status: unknown) {
    const value = String(status || '');
    return (
      projectStatusMeta.value[value] || {
        text: projectStatusMap[value] || value || '—',
        color: statusColorMap[value] || 'default',
      }
    );
  }

  function getProcessStatusMeta(status: unknown) {
    const value = String(status || '');
    return processStatusMeta.value[value] || { label: value || '未开始', color: 'default' };
  }

  function getProcessName(processName: unknown) {
    const value = String(processName ?? '');
    return workTypeMeta.value[value] || value || '—';
  }

  function formatDateRange(start: unknown, end: unknown) {
    if (!start && !end) return '—';
    return `${start || '—'} 至 ${end || '—'}`;
  }

  function formatHours(value: unknown) {
    return value === null || value === undefined || value === '' ? '—' : `${value}h`;
  }

  function getSignInDate(value: unknown) {
    return String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '—';
  }

  function truncateWorkContent(value: unknown) {
    const content = String(value || '');
    const characters = Array.from(content);
    return characters.length > 15 ? `${characters.slice(0, 15).join('')}...` : content || '—';
  }

  onMounted(loadProjectImplementation);
</script>

<style lang="less" scoped>
  .implement-log {
    padding: 16px;

    &__card {
      min-height: calc(100vh - 132px);
      background: #fff;
      border-radius: 4px;
    }

    &__header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 20px;
    }

    &__heading {
      min-width: 0;
      padding-top: 2px;
    }

    &__title {
      color: #262626;
      font-size: 18px;
      font-weight: 600;
      line-height: 1.5;
    }

    &__subtitle,
    &__section-description {
      color: #8c8c8c;
      font-size: 13px;
      line-height: 1.6;
    }

    &__error {
      margin-bottom: 16px;
    }

    &__project {
      margin-bottom: 24px;
    }

    &__section-heading {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    &__section-title {
      color: #262626;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.6;
    }

    &__empty {
      padding: 48px 0;
      border: 1px dashed #d9d9d9;
      border-radius: 4px;
    }

    &__processes {
      background: transparent;
    }
  }

  .process-heading {
    display: flex;
    min-width: 0;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-right: 12px;

    &__primary {
      display: flex;
      min-width: 0;
      align-items: center;
      gap: 8px;
    }

    &__name {
      overflow: hidden;
      color: #262626;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__meta {
      display: flex;
      min-width: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px 20px;
      color: #595959;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
  }

  .process-logs {
    &__error {
      margin-bottom: 12px;
    }

    &__content {
      display: inline-block;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: bottom;
      white-space: nowrap;
    }
  }

  :deep(.ant-collapse-header) {
    align-items: center !important;
  }

  :deep(.ant-table-cell) {
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 900px) {
    .process-heading {
      align-items: flex-start;
      flex-direction: column;

      &__meta {
        justify-content: flex-start;
      }
    }
  }
</style>
