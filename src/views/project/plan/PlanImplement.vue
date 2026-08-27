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
                  :disabled="!editable"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                  placeholder="请选择计划验收日期"
                />
              </a-tooltip>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="planInfo.remark" :disabled="!editable" placeholder="请输入备注" :rows="2" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <!-- 标题2: 工序计划 -->
    <div class="plan-implement__group">
      <div class="plan-implement__group-title">
        <span>工序计划</span>
        <a-button v-if="editable" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addProcess">添加</a-button>
      </div>
      <a-table
        :loading="processLoading"
        :columns="processColumns"
        :data-source="processList"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'name'">
            <a-select v-model:value="record.name" :disabled="!editable" placeholder="请选择工序" style="width: 100%" :options="workTypeOptions" />
          </template>
          <template v-else-if="column.key === 'leader'">
            <a-select
              v-model:value="record.leader"
              :disabled="!editable"
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
              :disabled="!editable"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              placeholder="计划开始"
            />
          </template>
          <template v-else-if="column.key === 'endTime'">
            <a-date-picker
              v-model:value="record.endTime"
              :disabled="!editable"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              placeholder="计划完成"
            />
          </template>
          <template v-else-if="column.key === 'hours'">
            <span class="plan-implement__hours">{{ getProcessHours(record) == null ? '—' : `${getProcessHours(record)} h` }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="editable" type="link" danger size="small" @click="removeProcess(record._key)">删除</a-button>
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
  import { computed, ref, reactive, unref, onMounted, watch } from 'vue';
  import dayjs from 'dayjs';
  import { getPlanMembers, getPlanProcesses } from './Plan.api';
  import { initDictOptions } from '/@/utils/dict/index';
  import { useMessage } from '/@/hooks/web/useMessage';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑; periodId 用于现场负责人(已接收成员)
  const props = defineProps<{
    editable?: boolean;
    periodId?: string;
    plannedAcceptanceDate?: string;
    plannedAcceptanceRemark?: string;
  }>();
  const emit = defineEmits<{ 'persisted-change': [persisted: boolean] }>();

  // 工序名称下拉(字典 work_type: 施工/调试)
  const workTypeOptions = ref<{ label: string; value: string }[]>([]);
  // 现场负责人下拉(接口: 分期 + 邀请状态=1)
  const leaderOptions = ref<{ label: string; value: string }[]>([]);

  onMounted(async () => {
    workTypeOptions.value = (await initDictOptions('work_type')) || [];
  });

  /** 现场负责人 = 该项目已接受邀请的参与成员，按用户去重。 */
  async function loadLeaders() {
    if (!props.periodId) return;
    try {
      const res: any = await getPlanMembers({ periodId: props.periodId, inviteStatus: 1, pageNo: 1, pageSize: 100 });
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
    } catch {
      leaderOptions.value = [];
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
    { title: '工序名称', key: 'name', width: 140 },
    { title: '现场负责人', key: 'leader', width: 160 },
    { title: '计划开始时间', key: 'startTime', width: 150 },
    { title: '计划完成时间', key: 'endTime', width: 150 },
    { title: '计划工时', key: 'hours', width: 110 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const processList = ref<any[]>([]);
  const hasPersistedProcesses = ref(false);
  const processLoading = ref(false);
  let processSeed = 0;

  function getProcessHours(record: any) {
    if (!record.startTime || !record.endTime) return null;
    const start = dayjs(record.startTime).startOf('day');
    const end = dayjs(record.endTime).startOf('day');
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) return null;
    return end.diff(start, 'day') * 8;
  }

  const processDateRange = computed(() => {
    if (!processList.value.length) return null;
    if (processList.value.some((item) => !item.startTime || !item.endTime)) return null;
    const starts = processList.value.map((item) => dayjs(item.startTime)).filter((date) => date.isValid());
    const ends = processList.value.map((item) => dayjs(item.endTime)).filter((date) => date.isValid());
    if (!starts.length || !ends.length || starts.length !== processList.value.length || ends.length !== processList.value.length) return null;
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

  // 暴露给父级(计划信息 + 工序表行)
  defineExpose({
    getData() {
      if (!planInfo.acceptanceDate) throw new Error('请选择计划验收日期');
      const invalid = processList.value.find((item) => !item.name || !item.leader || !item.startTime || !item.endTime);
      if (invalid) throw new Error('请完整填写工序名称、现场负责人、计划开始时间和计划完成时间');
      const invalidRange = processList.value.find((item) => dayjs(item.endTime).isBefore(dayjs(item.startTime)));
      if (invalidRange) throw new Error(`工序「${invalidRange.name}」的计划完成时间不能早于开始时间`);
      return {
        ...unref(planInfo),
        isUpdate: hasPersistedProcesses.value,
        processList: processList.value.map((item, index) => ({
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
      if (data) {
        Object.assign(planInfo, {
          acceptanceDate: data.acceptanceDate,
          fileId: data.fileId || '',
          fileName: data.fileName || '',
          remark: data.remark ?? '',
        });
      }
      processList.value = (data?.processList || []).map((item) => ({ ...item, _key: ++processSeed }));
      hasPersistedProcesses.value = processList.value.some((item) => !!item.id);
    },
    reload: () => Promise.all([loadLeaders(), loadProcesses()]),
  });

  async function loadProcesses() {
    if (!props.periodId) {
      processList.value = [];
      hasPersistedProcesses.value = false;
      emit('persisted-change', false);
      return;
    }
    processLoading.value = true;
    try {
      const result: any = await getPlanProcesses({ periodId: props.periodId, pageNo: 1, pageSize: 1000 });
      const records = Array.isArray(result) ? result : result?.records || [];
      processSeed = 0;
      hasPersistedProcesses.value = records.length > 0;
      emit('persisted-change', hasPersistedProcesses.value);
      processList.value = records.map((item: any) => ({
        ...item,
        _key: ++processSeed,
        name: item.processName,
        leader: item.siteLeaderId || item.siteLeaderName,
        startTime: item.plannedStartTime,
        endTime: item.plannedEndTime,
      }));
    } catch (error: any) {
      processList.value = [];
      hasPersistedProcesses.value = false;
      createMessage.warning(error?.message || '实施计划加载失败，请刷新后重试');
    } finally {
      processLoading.value = false;
    }
  }

  watch(
    () => props.periodId,
    () => Promise.all([loadLeaders(), loadProcesses()]),
    { immediate: true }
  );

  watch(
    () => [props.plannedAcceptanceDate, props.plannedAcceptanceRemark],
    ([acceptanceDate, remark]) => {
      planInfo.acceptanceDate = acceptanceDate || undefined;
      planInfo.remark = remark || '';
    },
    { immediate: true }
  );

  // 添加工序
  function addProcess() {
    processList.value.push({ _key: ++processSeed, name: undefined, leader: undefined, startTime: undefined, endTime: undefined });
  }

  // 移除工序
  function removeProcess(key: number) {
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
  }
</style>
