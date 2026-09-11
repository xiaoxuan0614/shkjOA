<template>
  <div class="plan-implement">
    <!-- 标题1: 计划信息 -->
    <div class="plan-implement__group">
      <div class="plan-implement__group-title">计划信息</div>
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="计划验收日期" required>
              <a-tooltip title="全部验收完成的预估时间">
                <a-date-picker
                  v-model:value="planInfo.acceptanceDate"
                  :disabled="!canEditPlan"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                  placeholder="请选择计划验收日期"
                />
              </a-tooltip>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="planInfo.remark" :disabled="!canEditPlan" placeholder="请输入备注" :rows="2" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <!-- 标题2: 工序计划 -->
    <div class="plan-implement__group">
      <div class="plan-implement__group-title">
        <span>工序计划</span>
        <a-button
          v-if="editable"
          type="primary"
          size="small"
          preIcon="ant-design:plus-outlined"
          :disabled="!canEditPlan || !canAddProcess"
          :title="canEditPlan && canAddProcess ? '添加工序' : !canEditPlan ? '实施计划加载完成后才能添加' : '所有可用工序均已添加'"
          @click="addProcess"
        >
          添加
        </a-button>
      </div>
      <a-table
        :loading="pageLoading"
        :columns="processColumns"
        :data-source="processList"
        :row-key="(record) => record?._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #headerCell="{ column }">
          <span>
            {{ column.title }}
            <span v-if="column.required" class="plan-implement__required" aria-hidden="true">*</span>
          </span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'name'">
            <UniqueRowSelect
              v-model="record.name"
              :rows="processList"
              :row="record"
              :options="workTypeOptions"
              field="name"
              :disabled="!canEditPlan"
              placeholder="请选择工序"
            />
          </template>
          <template v-else-if="column.key === 'leader'">
            <a-select
              v-model:value="record.leader"
              :disabled="!canEditPlan"
              placeholder="请选择现场负责人"
              style="width: 100%"
              show-search
              option-filter-prop="label"
              :options="leaderOptions"
            />
          </template>
          <template v-else-if="column.key === 'startTime'">
            <a-date-picker
              v-model:value="record.startTime"
              :disabled="!canEditPlan"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              placeholder="计划开始"
            />
          </template>
          <template v-else-if="column.key === 'endTime'">
            <a-date-picker
              v-model:value="record.endTime"
              :disabled="!canEditPlan"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              placeholder="计划完成"
            />
          </template>
          <template v-else-if="column.key === 'hours'">
            <span class="plan-implement__hours">{{ getProcessHours(record) == null ? '—' : `${getProcessHours(record)} h` }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="editable" type="link" danger size="small" :disabled="!canEditPlan" @click="removeProcess(record._key)">删除</a-button>
          </template>
        </template>
      </a-table>
      <div class="plan-implement__total-hours" aria-live="polite">
        <span class="plan-implement__total-hours-label">总工时</span>
        <strong>{{ totalWorkHours == null ? '—' : `${totalWorkHours} h` }}</strong>
        <span class="plan-implement__total-hours-rule">
          {{ totalWorkHours == null ? '请补全工序的计划开始与完成时间' : `（${latestEndDate} - ${earliestStartDate}）× 8h` }}
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, reactive, unref, watch } from 'vue';
  import dayjs from 'dayjs';
  import { getPlanMembers, getPlanProcessDetail } from './Plan.api';
  import { initDictOptions } from '/@/utils/dict/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { UniqueRowSelect, useUniqueRowOptions, validateEditableRows } from '/@/components/EditableTable';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑; periodId 用于现场负责人(前端从分期成员中过滤已接受记录)
  const props = defineProps<{
    editable?: boolean;
    periodId?: string;
  }>();
  const emit = defineEmits<{ 'persisted-change': [persisted: boolean] }>();

  // 工序名称下拉(字典 work_type: 施工/调试)
  const workTypeOptions = ref<{ label: string; value: string }[]>([]);
  const workTypeLoading = ref(false);
  const workTypeLoaded = ref(false);
  const workTypeLoadFailed = ref(false);
  // 现场负责人下拉(接口: 分期 + 邀请状态=1)
  const leaderOptions = ref<{ label: string; value: string }[]>([]);
  const leaderLoading = ref(false);
  const leaderLoaded = ref(false);
  const leaderLoadFailed = ref(false);

  async function loadWorkTypes() {
    if (workTypeLoaded.value) return true;
    workTypeLoading.value = true;
    workTypeLoadFailed.value = false;
    try {
      workTypeOptions.value = (await initDictOptions('work_type')) || [];
      workTypeLoaded.value = true;
      return true;
    } catch (error: any) {
      workTypeOptions.value = [];
      workTypeLoaded.value = false;
      workTypeLoadFailed.value = true;
      createMessage.warning(error?.message || '工序字典加载失败，请刷新后重试');
      return false;
    } finally {
      workTypeLoading.value = false;
    }
  }

  /** 现场负责人 = 该项目已接受邀请的参与成员，按用户去重。 */
  async function loadLeaders() {
    const requestSequence = ++leaderLoadSequence;
    const periodId = props.periodId;
    if (!periodId) {
      leaderOptions.value = [];
      leaderLoading.value = false;
      leaderLoaded.value = false;
      leaderLoadFailed.value = false;
      return false;
    }
    leaderLoading.value = true;
    leaderLoaded.value = false;
    leaderLoadFailed.value = false;
    try {
      const res: any = await getPlanMembers({ periodId, pageNo: 1, pageSize: 1000 });
      if (requestSequence !== leaderLoadSequence || periodId !== props.periodId) return false;
      const records = res?.records || res || [];
      const seen = new Set<string>();
      leaderOptions.value = (records || [])
        .filter((member: any) => String(member.inviteStatus) === '1')
        .map((member: any) => {
          const label = member.memberName || member.userName || member.realname || '';
          const value = member.userId || member.memberId || member.id || label;
          return label && value ? { label: String(label), value: String(value) } : null;
        })
        .filter((option): option is { label: string; value: string } => {
          if (!option || seen.has(option.value)) return false;
          seen.add(option.value);
          return true;
        });
      leaderLoaded.value = true;
      return true;
    } catch (error: any) {
      if (requestSequence === leaderLoadSequence && periodId === props.periodId) {
        leaderOptions.value = [];
        leaderLoadFailed.value = true;
        createMessage.warning(error?.message || '现场负责人加载失败，请刷新后重试');
      }
      return false;
    } finally {
      if (requestSequence === leaderLoadSequence && periodId === props.periodId) leaderLoading.value = false;
    }
  }

  // 计划信息(计划验收日期 + 实施计划文件 + 备注)
  const planInfo = reactive<any>({
    acceptanceDate: undefined,
    fileId: '',
    fileName: '',
    remark: '',
  });

  // 工序计划表
  const processColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '工序名称', key: 'name', width: 140, required: true },
    { title: '现场负责人', key: 'leader', width: 160, required: true },
    { title: '计划开始时间', key: 'startTime', width: 150, required: true },
    { title: '计划完成时间', key: 'endTime', width: 150, required: true },
    { title: '计划工时', key: 'hours', width: 110 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const processList = ref<any[]>([]);
  const hasPersistedProcesses = ref(false);
  const processLoading = ref(false);
  const processLoaded = ref(false);
  const processLoadFailed = ref(false);
  const processSaving = ref(false);
  const savedProcessSignature = ref('');
  const { canAdd: canAddProcess } = useUniqueRowOptions(processList, workTypeOptions, { field: 'name' });
  let processSeed = 0;
  let processLoadSequence = 0;
  let leaderLoadSequence = 0;
  let loadedPeriodId = '';

  const pageLoading = computed(() => processLoading.value || leaderLoading.value || workTypeLoading.value);
  const pageLoaded = computed(() => processLoaded.value && leaderLoaded.value && workTypeLoaded.value);
  const pageLoadFailed = computed(() => processLoadFailed.value || leaderLoadFailed.value || workTypeLoadFailed.value);
  const canEditPlan = computed(() => !!props.editable && pageLoaded.value && !pageLoading.value && !pageLoadFailed.value && !processSaving.value);

  function isProcessRow(item: unknown): item is Record<string, any> {
    return !!item && typeof item === 'object' && !Array.isArray(item);
  }

  function normalizeProcessRows(value: unknown) {
    return Array.isArray(value) ? value.filter(isProcessRow) : [];
  }

  function getProcessHours(record?: Record<string, any>) {
    if (!record?.startTime || !record?.endTime) return null;
    const start = dayjs(record.startTime).startOf('day');
    const end = dayjs(record.endTime).startOf('day');
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) return null;
    return end.diff(start, 'day') * 8;
  }

  const processDateRange = computed(() => {
    const rows = normalizeProcessRows(processList.value);
    if (!rows.length || rows.length !== processList.value.length) return null;
    if (rows.some((item) => !item.startTime || !item.endTime)) return null;
    const starts = rows.map((item) => dayjs(item.startTime)).filter((date) => date.isValid());
    const ends = rows.map((item) => dayjs(item.endTime)).filter((date) => date.isValid());
    if (!starts.length || !ends.length || starts.length !== rows.length || ends.length !== rows.length) return null;
    const earliest = starts.reduce((min, date) => (date.isBefore(min) ? date : min));
    const latest = ends.reduce((max, date) => (date.isAfter(max) ? date : max));
    return { earliest, latest };
  });

  const totalWorkHours = computed(() => {
    if (!processDateRange.value) return null;
    const days = processDateRange.value.latest.startOf('day').diff(processDateRange.value.earliest.startOf('day'), 'day');
    return Math.max(days, 0) * 8;
  });

  const earliestStartDate = computed(() => processDateRange.value?.earliest.format('YYYY-MM-DD') || '');
  const latestEndDate = computed(() => processDateRange.value?.latest.format('YYYY-MM-DD') || '');

  function createProcessSignature() {
    return JSON.stringify({
      acceptanceDate: planInfo.acceptanceDate || null,
      remark: planInfo.remark || '',
      records: normalizeProcessRows(processList.value).map((item) => ({
        id: item.id || null,
        processName: item.name || null,
        siteLeaderId: item.leader || null,
        plannedStartTime: item.startTime || null,
        plannedEndTime: item.endTime || null,
        actualStartTime: item.actualStartTime || null,
        actualEndTime: item.actualEndTime || null,
        status: item.status || null,
        sortNo: item.sortNo ?? null,
        remark: item.remark || '',
      })),
    });
  }

  const processDirty = computed(() => processLoaded.value && createProcessSignature() !== savedProcessSignature.value);

  function assertProcessLoadedForWrite() {
    if (pageLoading.value) throw new Error('实施计划仍在加载，请稍后再保存');
    if (!pageLoaded.value || pageLoadFailed.value) {
      throw new Error('实施计划加载失败，为避免覆盖原数据，请刷新后重试');
    }
  }

  // 暴露给父级(计划信息 + 工序表行)
  defineExpose({
    getData() {
      assertProcessLoadedForWrite();
      if (!planInfo.acceptanceDate) throw new Error('请选择计划验收日期');
      const rows = normalizeProcessRows(processList.value);
      if (rows.length !== processList.value.length) throw new Error('工序列表存在无效数据，请删除后重新添加');
      const issues = validateEditableRows(rows, {
        selectorField: 'name',
        selectorLabel: '工序名称',
        optionLabel: (value) => workTypeOptions.value.find((option) => String(option.value) === String(value))?.label || String(value),
        rules: [
          {
            field: 'leader',
            label: '现场负责人',
            required: true,
            validate: (value) =>
              leaderOptions.value.some((option) => String(option.value) === String(value)) || '请选择当前项目已接受邀请的现场负责人',
          },
          {
            field: 'startTime',
            label: '计划开始时间',
            required: true,
            validate: (value) => dayjs(value as string).isValid() || '请选择有效的计划开始时间',
          },
          {
            field: 'endTime',
            label: '计划完成时间',
            required: true,
            validate: (value, row) => {
              if (!dayjs(value as string).isValid()) return '请选择有效的计划完成时间';
              return !row.startTime || !dayjs(value as string).isBefore(dayjs(row.startTime)) || '计划完成时间不能早于计划开始时间';
            },
          },
        ],
      });
      if (issues.length) throw new Error(issues[0].message);
      return {
        ...unref(planInfo),
        isUpdate: hasPersistedProcesses.value,
        processList: rows.map((item, index) => ({
          ...(item.id ? { id: item.id } : {}),
          processName: item.name,
          siteLeaderId: item.leader,
          siteLeaderName: leaderOptions.value.find((option) => String(option.value) === String(item.leader))?.label || item.siteLeaderName || '',
          plannedStartTime: item.startTime,
          plannedEndTime: item.endTime,
          plannedHours: getProcessHours(item),
          actualStartTime: item.actualStartTime,
          actualEndTime: item.actualEndTime,
          status: item.status,
          sortNo: item.sortNo ?? index + 1,
          remark: item.remark,
        })),
      };
    },
    setData(data: any) {
      processLoadSequence += 1;
      processLoading.value = false;
      if (data) {
        Object.assign(planInfo, {
          acceptanceDate: data.acceptanceDate,
          fileId: data.fileId || '',
          fileName: data.fileName || '',
          remark: data.remark ?? '',
        });
      }
      processList.value = normalizeProcessRows(data?.processList).map((item) => ({ ...item, _key: ++processSeed }));
      hasPersistedProcesses.value = processList.value.some((item) => !!item.id);
      processLoaded.value = true;
      processLoadFailed.value = false;
      loadedPeriodId = String(props.periodId || '');
      savedProcessSignature.value = createProcessSignature();
    },
    reload: loadProcesses,
    reloadLeaders: loadLeaders,
    setSubmissionSaving(value: boolean) {
      processSaving.value = !!value;
    },
    getSubmissionState() {
      return {
        loading: pageLoading.value,
        loaded: pageLoaded.value,
        loadFailed: pageLoadFailed.value,
        saving: processSaving.value,
        dirty: processDirty.value,
        hasData: hasPersistedProcesses.value,
        sequence: processLoadSequence,
      };
    },
  });

  async function loadProcesses() {
    const requestSequence = ++processLoadSequence;
    const periodId = props.periodId;
    if (!periodId) {
      processList.value = [];
      Object.assign(planInfo, { acceptanceDate: undefined, remark: '' });
      hasPersistedProcesses.value = false;
      processLoading.value = false;
      processLoaded.value = false;
      processLoadFailed.value = false;
      savedProcessSignature.value = '';
      loadedPeriodId = '';
      emit('persisted-change', false);
      return;
    }
    if (loadedPeriodId !== String(periodId)) {
      processList.value = [];
      Object.assign(planInfo, { acceptanceDate: undefined, remark: '' });
      hasPersistedProcesses.value = false;
      savedProcessSignature.value = '';
    }
    processLoading.value = true;
    processLoaded.value = false;
    processLoadFailed.value = false;
    try {
      const result: any = await getPlanProcessDetail({ periodId });
      if (requestSequence !== processLoadSequence) return;
      const records = normalizeProcessRows(result?.records);
      processSeed = 0;
      hasPersistedProcesses.value = records.length > 0;
      planInfo.acceptanceDate = result?.plannedAcceptanceDate || undefined;
      planInfo.remark = result?.plannedAcceptanceRemark || '';
      processList.value = records.map((item: any) => ({
        ...item,
        _key: ++processSeed,
        name: item.processName,
        leader: item.siteLeaderId || item.siteLeaderName,
        startTime: item.plannedStartTime,
        endTime: item.plannedEndTime,
      }));
      loadedPeriodId = String(periodId);
      processLoaded.value = true;
      savedProcessSignature.value = createProcessSignature();
      emit('persisted-change', hasPersistedProcesses.value);
    } catch (error: any) {
      if (requestSequence === processLoadSequence) {
        processLoadFailed.value = true;
        processLoaded.value = false;
        createMessage.warning(error?.message || '实施计划加载失败，请刷新后重试');
      }
    } finally {
      if (requestSequence === processLoadSequence) processLoading.value = false;
    }
  }

  watch(
    () => props.periodId,
    () => {
      void Promise.all([loadWorkTypes(), loadLeaders(), loadProcesses()]);
    },
    { immediate: true }
  );

  // 添加工序
  function addProcess() {
    if (!canEditPlan.value) {
      createMessage.warning('实施计划加载完成后才能添加工序');
      return;
    }
    if (!canAddProcess.value) {
      createMessage.info('所有可用工序均已添加');
      return;
    }
    processList.value.push({ _key: ++processSeed, name: undefined, leader: undefined, startTime: undefined, endTime: undefined });
  }

  // 移除工序
  function removeProcess(key: number) {
    if (!canEditPlan.value) {
      createMessage.warning('实施计划加载完成后才能删除工序');
      return;
    }
    processList.value = processList.value.filter((p) => p._key !== key);
  }
</script>

<style lang="less" scoped>
  .plan-implement {
    &__group {
      margin-bottom: 16px;

      &-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
      }
    }

    &__total-hours {
      display: flex;
      justify-content: flex-end;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 8px;
      min-height: 48px;
      padding: 12px 16px;
      color: #262626;
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-top: 0;

      strong {
        color: #1677ff;
        font-size: 18px;
        font-variant-numeric: tabular-nums;
      }

      &-label {
        font-weight: 600;
      }

      &-rule {
        color: #595959;
        font-size: 12px;
        text-align: end;
      }
    }

    &__hours {
      color: #262626;
      font-variant-numeric: tabular-nums;
    }

    &__required {
      margin-inline-start: 2px;
      color: #ff4d4f;
    }
  }
</style>
