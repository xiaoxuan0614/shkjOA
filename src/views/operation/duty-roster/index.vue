<template>
  <div class="duty-roster-page">
    <section class="roster-toolbar" aria-labelledby="duty-roster-title">
      <div class="toolbar-heading">
        <div>
          <h1 id="duty-roster-title">运维值班表</h1>
          <p>按月生成早晚班安排，逐日调整后保存并导出正式 Excel。</p>
        </div>
        <a-tag :color="dirty ? 'orange' : 'green'">{{ dirty ? '有未保存修改' : savedAtText }}</a-tag>
      </div>

      <div class="toolbar-grid">
        <a-form-item label="值班月份" :colon="false">
          <a-date-picker :value="selectedMonth" picker="month" :allow-clear="false" format="YYYY年MM月" @change="handleMonthChange" />
        </a-form-item>
        <a-form-item label="启用班次" :colon="false">
          <a-checkbox-group v-model:value="enabledShifts" :options="shiftOptions" @change="handleShiftChange" />
        </a-form-item>
        <a-form-item label="早班默认人数" :colon="false">
          <a-input-number v-model:value="dayStaffCount" :min="1" :max="20" :disabled="!dayEnabled" @change="markDirty" />
        </a-form-item>
        <a-form-item label="夜班默认人数" :colon="false">
          <a-input-number v-model:value="nightStaffCount" :min="1" :max="20" :disabled="!nightEnabled" @change="markDirty" />
        </a-form-item>
      </div>

      <div class="participant-row">
        <a-form-item label="参与排班人员" class="participant-field" :colon="false">
          <a-select
            :value="selectedUserIds"
            mode="multiple"
            show-search
            allow-clear
            option-filter-prop="label"
            :options="availableUserOptions"
            :loading="userLoading"
            :max-tag-count="'responsive'"
            placeholder="请选择参与本月排班的系统用户"
            @change="handleSelectedUsersChange"
          />
        </a-form-item>
        <div class="toolbar-actions">
          <a-button :disabled="!selectedUserIds.length || !enabledShifts.length" @click="applyAutoRoster">
            <template #icon><Icon icon="ant-design:sync-outlined" /></template>
            自动排班
          </a-button>
          <a-button type="primary" @click="saveRoster">
            <template #icon><Icon icon="ant-design:save-outlined" /></template>
            保存值班表
          </a-button>
          <a-button @click="exportRoster">
            <template #icon><Icon icon="ant-design:file-excel-outlined" /></template>
            导出 Excel
          </a-button>
        </div>
      </div>

      <a-alert type="info" show-icon message="当前保存范围" description="值班表暂存于当前浏览器；后端补充值班表接口后可切换为账号级、跨设备共享。" />
    </section>

    <section class="roster-table-section" aria-label="月度值班安排">
      <div class="table-summary">
        <span>{{ selectedMonth.format('YYYY年MM月') }} · {{ rosterRows.length }} 天</span>
        <span>已选 {{ selectedUserIds.length }} 人</span>
        <span v-if="incompleteShiftCount" class="summary-warning">{{ incompleteShiftCount }} 个班次待安排</span>
        <span v-else class="summary-complete">班次已完整安排</span>
      </div>

      <a-table
        :columns="columns"
        :data-source="rosterRows"
        :pagination="false"
        :scroll="{ x: 1040 }"
        row-key="date"
        bordered
        size="middle"
        :row-class-name="rowClassName"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'date'">
            <strong>{{ formatDate(record.date) }}</strong>
          </template>
          <template v-else-if="column.dataIndex === 'weekday'">
            <span :class="{ 'weekend-text': isWeekend(record.date) }">{{ record.weekday }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'dayUserIds'">
            <a-select
              v-if="dayEnabled"
              :value="record.dayUserIds"
              mode="multiple"
              show-search
              option-filter-prop="label"
              :options="participantOptions"
              placeholder="选择早班人员"
              @change="(values) => handleDayUsersChange(record, values)"
            />
            <span v-else class="disabled-shift">本月未启用</span>
          </template>
          <template v-else-if="column.dataIndex === 'nightUserIds'">
            <a-select
              v-if="nightEnabled"
              :value="record.nightUserIds"
              mode="multiple"
              show-search
              option-filter-prop="label"
              :options="participantOptions"
              placeholder="选择夜班人员"
              @change="(values) => handleNightUsersChange(record, values)"
            />
            <span v-else class="disabled-shift">本月未启用</span>
          </template>
          <template v-else-if="column.dataIndex === 'contact'">
            <template v-if="nightEnabled && record.nightUserIds.length">
              <a-select
                :value="record.contactUserId"
                :options="getContactOptions(record)"
                option-filter-prop="label"
                placeholder="选择夜班联系人"
                @change="(value) => handleContactChange(record, value)"
              />
              <span class="contact-phone">{{ getContactPhone(record) || '该用户未维护手机号' }}</span>
            </template>
            <span v-else class="disabled-shift">{{ nightEnabled ? '请先选择夜班人员' : '本月未启用夜班' }}</span>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue';
  import dayjs, { type Dayjs } from 'dayjs';
  import { Modal } from 'ant-design-vue';
  import { Icon } from '/@/components/Icon';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { loadUserOptions, type UserOption } from '/@/views/resource/userOptions';
  import { exportDutyRosterExcel } from './dutyRosterExcel';
  import {
    loadDutyRosterDraft,
    saveDutyRosterDraft,
    type DutyRosterDraft,
    type DutyRosterRow,
    type DutyRosterUserSnapshot,
    type DutyShift,
  } from './dutyRoster.store';

  defineOptions({ name: 'OperationDutyRoster' });

  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const shiftOptions = [
    { label: '早班', value: 'day' },
    { label: '夜班', value: 'night' },
  ];
  const columns = [
    { title: '日期', dataIndex: 'date', width: 120 },
    { title: '星期', dataIndex: 'weekday', width: 110 },
    { title: '早班人员', dataIndex: 'dayUserIds', width: 280 },
    { title: '夜班人员', dataIndex: 'nightUserIds', width: 250 },
    { title: '夜班联系人 / 电话', dataIndex: 'contact', width: 280 },
  ];

  const { createMessage } = useMessage();
  const selectedMonth = ref<Dayjs>(dayjs().startOf('month'));
  const enabledShifts = ref<DutyShift[]>(['day', 'night']);
  const dayStaffCount = ref(2);
  const nightStaffCount = ref(1);
  const selectedUserIds = ref<string[]>([]);
  const rosterRows = ref<DutyRosterRow[]>([]);
  const userOptions = ref<UserOption[]>([]);
  const savedUserSnapshots = ref<DutyRosterUserSnapshot[]>([]);
  const userLoading = ref(false);
  const dirty = ref(false);
  const savedAt = ref('');

  const dayEnabled = computed(() => enabledShifts.value.includes('day'));
  const nightEnabled = computed(() => enabledShifts.value.includes('night'));
  const savedAtText = computed(() => (savedAt.value ? `已保存 ${dayjs(savedAt.value).format('MM-DD HH:mm')}` : '尚未保存'));
  const availableUserOptions = computed(() => {
    const merged = new Map<string, UserOption>();
    savedUserSnapshots.value.forEach((item) => merged.set(item.value, item));
    userOptions.value.forEach((item) => merged.set(item.value, item));
    return Array.from(merged.values());
  });
  const participantOptions = computed(() =>
    selectedUserIds.value.map((userId) => {
      const user = getUser(userId);
      return { label: user?.label || userId, value: userId };
    })
  );
  const incompleteShiftCount = computed(() =>
    rosterRows.value.reduce((total, row) => {
      if (dayEnabled.value && !row.dayUserIds.length) total += 1;
      if (nightEnabled.value && !row.nightUserIds.length) total += 1;
      return total;
    }, 0)
  );

  function buildMonthRows(month: Dayjs) {
    return Array.from({ length: month.daysInMonth() }, (_, index): DutyRosterRow => {
      const date = month.date(index + 1);
      return {
        date: date.format('YYYY-MM-DD'),
        weekday: WEEKDAYS[date.day()],
        dayUserIds: [],
        nightUserIds: [],
        contactUserId: undefined,
      };
    });
  }

  function getUser(userId: string): DutyRosterUserSnapshot | undefined {
    return availableUserOptions.value.find((item) => item.value === userId);
  }

  function applyMonth(month: Dayjs) {
    selectedMonth.value = month.startOf('month');
    const monthKey = selectedMonth.value.format('YYYY-MM');
    const draft = loadDutyRosterDraft(monthKey);
    const baseRows = buildMonthRows(selectedMonth.value);
    if (draft) {
      enabledShifts.value = draft.enabledShifts;
      dayStaffCount.value = draft.dayStaffCount;
      nightStaffCount.value = draft.nightStaffCount;
      selectedUserIds.value = draft.selectedUserIds;
      savedUserSnapshots.value = draft.userSnapshots || [];
      const rowMap = new Map(draft.rows.map((row) => [row.date, row]));
      rosterRows.value = baseRows.map((row) => ({ ...row, ...rowMap.get(row.date) }));
      savedAt.value = draft.savedAt;
    } else {
      enabledShifts.value = ['day', 'night'];
      dayStaffCount.value = 2;
      nightStaffCount.value = 1;
      selectedUserIds.value = [];
      savedUserSnapshots.value = [];
      rosterRows.value = baseRows;
      savedAt.value = '';
    }
    dirty.value = false;
  }

  function handleMonthChange(value: Dayjs | null) {
    if (!value) return;
    if (!dirty.value) {
      applyMonth(value);
      return;
    }
    Modal.confirm({
      title: '切换月份？',
      content: '当前月份有未保存修改，切换后这些修改会丢失。',
      okText: '仍然切换',
      cancelText: '继续编辑',
      onOk: () => applyMonth(value),
    });
  }

  function markDirty() {
    dirty.value = true;
  }

  function handleShiftChange() {
    rosterRows.value.forEach((row) => {
      if (!dayEnabled.value) row.dayUserIds = [];
      if (!nightEnabled.value) {
        row.nightUserIds = [];
        row.contactUserId = undefined;
      }
    });
    markDirty();
  }

  function handleSelectedUsersChange(values: string[]) {
    selectedUserIds.value = values;
    const allowed = new Set(values);
    rosterRows.value.forEach((row) => {
      row.dayUserIds = row.dayUserIds.filter((userId) => allowed.has(userId));
      row.nightUserIds = row.nightUserIds.filter((userId) => allowed.has(userId));
      if (!row.contactUserId || !row.nightUserIds.includes(row.contactUserId)) row.contactUserId = row.nightUserIds[0];
    });
    markDirty();
  }

  function takeUsers(start: number, count: number, excluded: string[] = []) {
    const users = selectedUserIds.value;
    const excludedSet = new Set(excluded);
    const result: string[] = [];
    for (let offset = 0; offset < users.length && result.length < count; offset += 1) {
      const userId = users[(start + offset) % users.length];
      if (!excludedSet.has(userId) && !result.includes(userId)) result.push(userId);
    }
    for (let offset = 0; offset < users.length && result.length < count; offset += 1) {
      const userId = users[(start + offset) % users.length];
      if (!result.includes(userId)) result.push(userId);
    }
    return result;
  }

  function applyAutoRoster() {
    if (!selectedUserIds.value.length) {
      createMessage.warning('请先选择参与排班人员');
      return;
    }
    rosterRows.value.forEach((row, index) => {
      const dayStart = index * dayStaffCount.value;
      row.dayUserIds = dayEnabled.value ? takeUsers(dayStart, dayStaffCount.value) : [];
      const nightStart = index * nightStaffCount.value + dayStaffCount.value;
      row.nightUserIds = nightEnabled.value ? takeUsers(nightStart, nightStaffCount.value, row.dayUserIds) : [];
      row.contactUserId = row.nightUserIds[0];
    });
    markDirty();
    const requested = (dayEnabled.value ? dayStaffCount.value : 0) + (nightEnabled.value ? nightStaffCount.value : 0);
    if (requested > selectedUserIds.value.length) {
      createMessage.warning('参与人数少于单日排班人数，部分人员会在同一天兼任早班和夜班');
    } else {
      createMessage.success('已按人员顺序生成整月值班表，可继续逐日调整');
    }
  }

  function handleDayUsersChange(row: DutyRosterRow, values: string[]) {
    row.dayUserIds = values;
    markDirty();
  }

  function handleNightUsersChange(row: DutyRosterRow, values: string[]) {
    row.nightUserIds = values;
    if (!row.contactUserId || !values.includes(row.contactUserId)) row.contactUserId = values[0];
    markDirty();
  }

  function handleContactChange(row: DutyRosterRow, value: string) {
    row.contactUserId = value;
    markDirty();
  }

  function getContactOptions(row: DutyRosterRow) {
    return row.nightUserIds.map((userId) => {
      const user = getUser(userId);
      const phone = user?.phone ? ` · ${user.phone}` : ' · 未维护手机号';
      return { value: userId, label: `${user?.label || userId}${phone}` };
    });
  }

  function getContactPhone(row: DutyRosterRow) {
    return row.contactUserId ? getUser(row.contactUserId)?.phone : '';
  }

  function getUserSnapshots() {
    return selectedUserIds.value.map((userId) => {
      const user = getUser(userId);
      return { value: userId, label: user?.label || userId, username: user?.username, phone: user?.phone };
    });
  }

  function saveRoster() {
    if (!enabledShifts.value.length) {
      createMessage.warning('请至少启用一个班次');
      return;
    }
    const draft: DutyRosterDraft = {
      version: 1,
      month: selectedMonth.value.format('YYYY-MM'),
      enabledShifts: [...enabledShifts.value],
      dayStaffCount: dayStaffCount.value,
      nightStaffCount: nightStaffCount.value,
      selectedUserIds: [...selectedUserIds.value],
      userSnapshots: getUserSnapshots(),
      rows: rosterRows.value,
      savedAt: new Date().toISOString(),
    };
    try {
      saveDutyRosterDraft(draft);
      savedUserSnapshots.value = draft.userSnapshots;
      savedAt.value = draft.savedAt;
      dirty.value = false;
      const suffix = incompleteShiftCount.value ? `，仍有 ${incompleteShiftCount.value} 个班次待安排` : '';
      createMessage.success(`值班表已保存到当前浏览器${suffix}`);
    } catch (error) {
      console.error(error);
      createMessage.error('保存失败，请检查浏览器是否允许使用本地存储');
    }
  }

  async function exportRoster() {
    try {
      await exportDutyRosterExcel(selectedMonth.value, rosterRows.value, getUser);
      createMessage.success('Excel 已导出');
    } catch (error) {
      console.error(error);
      createMessage.error('Excel 导出失败，请稍后重试');
    }
  }

  function formatDate(date: string) {
    const value = dayjs(date);
    return `${value.month() + 1}月${value.date()}日`;
  }

  function isWeekend(date: string) {
    return [0, 6].includes(dayjs(date).day());
  }

  function rowClassName(record: DutyRosterRow) {
    return isWeekend(record.date) ? 'weekend-row' : '';
  }

  onMounted(async () => {
    applyMonth(selectedMonth.value);
    userLoading.value = true;
    try {
      userOptions.value = await loadUserOptions();
    } catch (error) {
      console.error(error);
      createMessage.warning('系统用户加载失败，已保存人员仍可回显，请稍后刷新重试');
    } finally {
      userLoading.value = false;
    }
  });
</script>

<style lang="less" scoped>
  .duty-roster-page {
    min-height: 100%;
    padding: 16px;
    background: #f4f6f9;
    color: #1f2937;
  }

  .roster-toolbar,
  .roster-table-section {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06);
  }

  .roster-toolbar {
    padding: 20px;
  }

  .toolbar-heading,
  .participant-row,
  .table-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .toolbar-heading {
    align-items: flex-start;
    margin-bottom: 20px;
  }

  h1 {
    margin: 0 0 6px;
    color: #172033;
    font-size: 24px;
    line-height: 1.35;
  }

  p {
    margin: 0;
    color: #5c667a;
  }

  .toolbar-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(160px, 1fr));
    gap: 12px 20px;
  }

  :deep(.ant-form-item) {
    margin-bottom: 16px;
  }

  .participant-row {
    align-items: flex-end;
    margin-bottom: 16px;
  }

  .participant-field {
    flex: 1;
    min-width: 320px;
    margin-bottom: 0 !important;
  }

  .participant-field :deep(.ant-select) {
    width: 100%;
  }

  .toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom: 1px;
  }

  .roster-table-section {
    margin-top: 16px;
    padding: 0 20px 20px;
    overflow: hidden;
  }

  .table-summary {
    justify-content: flex-start;
    min-height: 54px;
    color: #5c667a;
    font-size: 14px;
  }

  .summary-warning {
    color: #b45309;
  }

  .summary-complete {
    color: #237804;
  }

  :deep(.ant-table-thead > tr > th) {
    color: #273248;
    font-weight: 600;
    background: #f6f8fb;
  }

  :deep(.ant-table-cell .ant-select) {
    width: 100%;
  }

  :deep(.weekend-row > td) {
    background: #fffaf0 !important;
  }

  .weekend-text {
    color: #ad6800;
    font-weight: 600;
  }

  .disabled-shift {
    color: #7a8496;
  }

  .contact-phone {
    display: block;
    margin-top: 5px;
    color: #475569;
    font-variant-numeric: tabular-nums;
  }

  :deep(:focus-visible) {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }

  @media (max-width: 1100px) {
    .toolbar-grid {
      grid-template-columns: repeat(2, minmax(180px, 1fr));
    }

    .participant-row {
      align-items: stretch;
      flex-direction: column;
    }
  }

  @media (max-width: 640px) {
    .duty-roster-page {
      padding: 10px;
    }

    .roster-toolbar,
    .roster-table-section {
      border-radius: 10px;
    }

    .toolbar-heading,
    .table-summary {
      align-items: flex-start;
      flex-direction: column;
    }

    .toolbar-grid {
      grid-template-columns: 1fr;
    }

    .participant-field {
      min-width: 0;
      width: 100%;
    }

    .toolbar-actions > .ant-btn {
      flex: 1;
    }

    .table-summary {
      gap: 6px;
      padding: 12px 0;
    }
  }
</style>
