<template>
  <div class="duty-roster-page" :aria-busy="monthLoading || saving">
    <header class="page-heading">
      <div class="page-title">
        <div class="title-line">
          <h1>运维值班表</h1>
          <a-tag :color="isLocked ? 'green' : dirty ? 'orange' : 'blue'">{{ statusText }}</a-tag>
        </div>
      </div>
      <div class="heading-actions">
        <a-button :disabled="busy" @click="confirmDiscard(() => emit('back'))">返回列表</a-button>
        <a-button :disabled="busy" @click="refreshMonth"
          ><template #icon><Icon icon="ant-design:reload-outlined" /></template>刷新</a-button
        >
        <a-button v-if="canExport" :disabled="!isLocked || busy" :loading="exporting" @click="exportRoster">
          <template #icon><Icon icon="ant-design:export-outlined" /></template>导出 Excel
        </a-button>
        <a-button v-if="isLocked && canManage" type="primary" :disabled="busy" @click="startEditing">
          <template #icon><Icon icon="ant-design:edit-outlined" /></template>修改排班
        </a-button>
        <a-button v-else-if="canManage" type="primary" :disabled="!rosterRows.length || busy" :loading="saving" @click="saveRoster">
          <template #icon><Icon icon="ant-design:lock-outlined" /></template>保存并锁定
        </a-button>
      </div>
    </header>

    <section class="config-panel" aria-labelledby="config-title">
      <div class="section-heading">
        <h2 id="config-title">排班设置</h2>
      </div>
      <div class="config-grid">
        <div class="field month-field">
          <label for="duty-month">值班月份</label>
          <a-date-picker
            id="duty-month"
            :value="selectedMonth"
            picker="month"
            :allow-clear="false"
            :disabled="true"
            format="YYYY年MM月"
            @change="handleMonthChange"
          />
        </div>
        <div class="field rule-field">
          <label for="duty-rule">生成规则</label>
          <span v-if="isLocked" class="saved-setting">以已保存明细为准</span>
          <a-select
            v-else
            id="duty-rule"
            v-model:value="generationRule"
            :options="ruleOptions"
            :disabled="!editable"
            @change="handleGenerationRuleChange"
          />
        </div>
        <div class="field people-field">
          <label for="duty-people">参与人员</label>
          <a-select
            id="duty-people"
            :value="selectedUserIds"
            mode="multiple"
            show-search
            allow-clear
            option-filter-prop="label"
            :options="userOptions"
            :disabled="!editable || !usersReady"
            :loading="userLoading"
            :max-tag-count="'responsive'"
            placeholder="选择参与排班的运维人员"
            @change="handleSelectedUsersChange"
          />
          <a-button v-if="userError" type="link" :loading="userLoading" :disabled="saving" @click="loadUsers">重新加载人员</a-button>
        </div>
        <a-button
          class="generate-button"
          :disabled="!editable || !usersReady || !selectedUserIds.length || (generationRule === 'text' && !textRuleCanGenerate)"
          :loading="generating"
          @click="applyAutoRoster"
        >
          <template #icon><Icon icon="ant-design:calendar-outlined" /></template>{{ rosterRows.length ? '重新生成排班表' : '生成排班表' }}
        </a-button>
      </div>
      <div v-if="generationRule === 'text' && !isLocked" class="text-rule-panel">
        <div class="rule-input-area">
          <div class="rule-input-heading"><label for="duty-rule-text">填写排班逻辑</label></div>
          <p id="rule-writing-help" class="rule-writing-help">先选一个接近的模板，再修改人数和安排。写清平日、节假日、周末和夜班后是否休息。</p>
          <div class="rule-templates" aria-label="排班逻辑模板">
            <a-button
              v-for="example in ruleTemplates"
              :key="example.label"
              size="small"
              :disabled="!editable"
              @click="fillRuleExample(example.text)"
              >{{ example.label }}</a-button
            >
          </div>
          <a-textarea
            id="duty-rule-text"
            aria-describedby="rule-writing-help"
            v-model:value="ruleText"
            :rows="5"
            :maxlength="500"
            show-count
            :disabled="!editable"
            placeholder="例如：平时白班2人，夜班1人；节假日1人值24小时；夜班后休息一天；周末按平时排班。"
            @change="invalidateTextRule"
          />
          <div class="rule-input-footer"
            ><span>可用分号或换行分隔规则；指定人员、请假等安排可生成后手动调整。</span>
            <a-button :disabled="!editable || !usersReady || !selectedUserIds.length" :loading="checkingRule" @click="checkRuleText"
              >检查规则</a-button
            >
          </div>
        </div>
        <div class="rule-check-area" aria-live="polite">
          <h3>我理解的安排</h3>
          <ul v-if="ruleAnalysis?.summary.length" class="rule-summary-list">
            <li v-for="line in ruleAnalysis.summary" :key="line">{{ line }}</li>
          </ul>
          <p v-else class="rule-check-note">填写后点击“检查规则”，在这里核对系统理解的白夜班人数、兼任方式与休息要求。</p>
          <h3 class="feasibility-heading">能否排出来</h3>
          <p v-if="checkingRule" class="rule-check-note">正在检查参与人数、整月安排和跨月休息…</p>
          <ul v-else-if="ruleAnalysis?.errors.length" class="rule-error-list">
            <li v-for="error in ruleAnalysis.errors" :key="error">{{ error }}</li>
          </ul>
          <template v-else-if="textRuleCanGenerate && ruleAnalysis">
            <a-tag color="green">检查通过，可以生成</a-tag>
            <p class="rule-check-note"
              >已检查本月 {{ ruleAnalysis.rows?.length }} 天，按节假日安排
              {{ ruleAnalysis.holidayDates?.length || 0 }} 天。请核对以上理解，再点击“生成排班表”。</p
            >
            <p v-if="ruleAnalysis.holidayDates?.length" class="rule-holiday-dates">{{ ruleAnalysis.holidayDates.map(formatDate).join('、') }}</p>
          </template>
          <p v-else class="rule-check-note">检查通过后才能生成；生成后仍可逐日修改并保存。</p>
        </div>
      </div>
      <div v-if="rotationUsers.length" class="rotation-order">
        <span class="order-label">轮值顺序</span>
        <span v-for="(person, index) in rotationUsers" :key="person?.userId || index" class="person-order"
          ><span class="order-index">{{ index + 1 }}</span
          >{{ person?.name || '未命名人员' }}</span
        >
      </div>
    </section>

    <a-alert v-if="monthError" class="feedback" type="error" show-icon message="值班表加载失败" :description="monthError">
      <template #action><a-button size="small" :disabled="busy" @click="refreshMonth">重新加载</a-button></template>
    </a-alert>

    <section class="roster-panel" aria-labelledby="roster-title">
      <div class="table-heading">
        <div class="table-title"
          ><h2 id="roster-title">{{ selectedMonth.format('YYYY年M月') }}排班</h2><span class="day-count">{{ rosterRows.length }} 天</span></div
        >
      </div>
      <a-table
        v-if="rosterRows.length"
        :columns="columns"
        :data-source="rosterRows"
        :pagination="pagination"
        :loading="monthLoading"
        :scroll="{ x: 1060 }"
        :row-key="rowKey"
        size="middle"
        :row-class-name="rowClassName"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'date'"
            ><strong class="date-value">{{ formatDate(record.date) }}</strong></template
          >
          <template v-else-if="column.dataIndex === 'weekday'"
            ><span :class="{ 'weekend-text': isWeekend(record.date) }">{{ record.weekday || getWeekday(record.date) }}</span></template
          >
          <template v-else-if="column.dataIndex === 'dayUsers'">
            <a-select
              v-if="editable"
              :value="personIds(record.dayUsers)"
              mode="multiple"
              show-search
              allow-clear
              option-filter-prop="label"
              :options="participantOptions"
              :aria-label="`${record.date}白班人员`"
              placeholder="选择白班人员"
              @change="(values) => handleDayUsersChange(record, values)"
            />
            <span v-else class="saved-users">{{ personNames(record.dayUsers) }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'nightUser'">
            <a-select
              v-if="editable"
              :value="getNightUsers(record).map((person) => person.userId)"
              mode="multiple"
              show-search
              allow-clear
              option-filter-prop="label"
              :options="participantOptions"
              :aria-label="`${record.date}夜班人员`"
              placeholder="选择夜班人员"
              @change="(value) => handleNightUsersChange(record, value)"
            />
            <span v-else class="saved-users night-name">{{
              getNightUsers(record)
                .map((person) => person.name)
                .join('、') || '—'
            }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'restUser'">
            <span class="rest-name">{{
              getRestUsers(rotationUsers, record)
                .map((person) => person.name)
                .join('、') || '—'
            }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'phone'"
            ><span class="contact-phone" :class="{ 'empty-value': !getNightUsers(record).length }">{{
              getNightUsers(record)
                .map((person) => person.phone || '未维护电话')
                .join('、') || '—'
            }}</span></template
          >
        </template>
      </a-table>
      <div v-else class="empty-roster"
        ><a-spin :spinning="monthLoading"
          ><a-empty
            :description="
              monthError ? '暂时无法读取本月排班，请重新加载' : canManage ? '选择人员和生成规则，开始安排本月值班' : '本月暂无已保存的排班表'
            " /></a-spin
      ></div>
      <footer class="table-footer"
        ><span><Icon icon="ant-design:cloud-outlined" />数据保存到服务器，导出以已保存版本为准</span
        ><span v-if="savedVersion">版本 {{ savedVersion }}</span></footer
      >
    </section>
  </div>
</template>

<script lang="ts" setup>
  import { useDutyRosterPermissions } from './dutyRoster.permissions';
  import { computed, onMounted, ref } from 'vue';
  import dayjs, { type Dayjs } from 'dayjs';
  import { Modal } from 'ant-design-vue';
  import { Icon } from '/@/components/Icon';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { loadDutyRosterUsers, queryDutyRoster, saveDutyRoster } from './dutyRoster.api';
  import { parseDutyRule, checkTextDutyRule, type RuleCheck } from './dutyRoster.textRule';
  import { rotateDutyRoster, createDutyRosterPayload, getRestUsers, getNightUsers } from './dutyRoster.rules';
  import { exportDutyRosterExcel } from './dutyRosterExcel';
  import type { DutyPerson, DutyRosterDay, DutyRosterResult, GenerationRule } from './dutyRoster.store';

  defineOptions({ name: 'OperationDutyRoster' });

  const { createMessage } = useMessage();
  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const RULE_EXAMPLE = '平时白班2人，夜班1人；\n节假日1人值24小时；\n夜班后休息一天；周末按平时排班。';
  const ruleTemplates = [
    { label: '常规轮值', text: '平时白班2人，夜班1人；夜班后休息一天；周末按平时排班。' },
    { label: '节假日单人值班', text: RULE_EXAMPLE },
    { label: '多人夜班', text: '平时白班2人，夜班2人；夜班后休息一天；周末按平时排班。' },
  ];
  const ruleOptions = [
    { label: '自定义排班逻辑', value: 'text' },
    { label: '三人轮值 · 白班2人 / 夜班1人', value: 'rotation' },
    { label: '手动排班 · 生成空表', value: 'manual' },
  ];
  const columns = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '星期', dataIndex: 'weekday', width: 100 },
    { title: '白班人员', dataIndex: 'dayUsers', width: 300 },
    { title: '夜班人员', dataIndex: 'nightUser', width: 200 },
    { title: '休息人员', dataIndex: 'restUser', width: 190 },
    { title: '联系电话', dataIndex: 'phone', width: 160 },
  ];
  const props = defineProps<{ month?: string }>();
  const emit = defineEmits<{ (event: 'back'): void }>();
  const selectedMonth = ref<Dayjs>(dayjs(props.month).startOf('month'));
  const generationRule = ref<GenerationRule>('rotation');
  const ruleText = ref(RULE_EXAMPLE);
  const checkingRule = ref(false);
  const ruleAnalysis = ref<RuleCheck | null>(null);
  const checkedRuleContext = ref('');
  const rotationUsers = ref<(DutyPerson | null)[]>([]);
  const rosterRows = ref<DutyRosterDay[]>([]);
  const persons = ref<DutyPerson[]>([]);
  const usersReady = ref(false);
  const { canAdd, canEdit, canExport } = useDutyRosterPermissions();
  const monthSaved = ref(false);
  const monthReady = ref(false);
  const monthLoading = ref(false);
  const userLoading = ref(false);
  const generating = ref(false);
  const saving = ref(false);
  const exporting = ref(false);
  const isLocked = ref(false);
  const dirty = ref(false);
  const userError = ref('');
  const monthError = ref('');
  const savedVersion = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(10);
  let monthRequest = 0;
  let rowKeySeed = 0;
  const rowKeys = new WeakMap<DutyRosterDay, string>();
  const canManage = computed(() => (monthSaved.value ? canEdit.value : canAdd.value) && monthReady.value);
  const busy = computed(() => monthLoading.value || saving.value || generating.value || exporting.value || checkingRule.value);
  const editable = computed(() => canManage.value && !isLocked.value && !busy.value);
  const statusText = computed(() =>
    monthError.value
      ? '加载失败'
      : monthLoading.value
        ? '加载中'
        : isLocked.value
          ? '已保存 · 已锁定'
          : dirty.value
            ? '待保存'
            : rosterRows.value.length
              ? '编辑中'
              : '未生成'
  );
  const selectedUserIds = computed(() => personIds(rotationUsers.value));
  const ruleContext = computed(() => JSON.stringify([ruleText.value, selectedMonth.value.format('YYYY-MM'), rotationUsers.value]));
  const textRuleCanGenerate = computed(
    () => !!ruleAnalysis.value?.rows && !ruleAnalysis.value.errors.length && checkedRuleContext.value === ruleContext.value
  );
  const userOptions = computed(() => {
    const options = new Map<string, { value: string; label: string; disabled: boolean }>();
    rotationUsers.value.forEach((person) => {
      if (person?.userId) options.set(person.userId, { value: person.userId, label: person.name || person.userId, disabled: true });
    });
    persons.value.forEach((person) => {
      if (person.userId) options.set(person.userId, { value: person.userId, label: person.name || person.userId, disabled: false });
    });
    return [...options.values()];
  });
  const participantOptions = computed(() => {
    const options = new Map<string, { value: string; label: string; disabled: boolean }>();
    // 历史人员只用于回显，不能作为新增选项；更改生成配置也不清除既有明细。
    const snapshots = rosterRows.value.flatMap((row) => [...row.dayUsers, ...getNightUsers(row), ...(row.restUsers ?? [row.restUser])]);
    [...snapshots, ...rotationUsers.value].forEach((person) => {
      if (person?.userId)
        options.set(person.userId, {
          value: person.userId,
          label: person.name || person.userId,
          disabled: !selectedUserIds.value.includes(person.userId) || !persons.value.some((current) => current.userId === person.userId),
        });
    });
    return [...options.values()];
  });
  const pagination = computed(() => ({
    current: currentPage.value,
    pageSize: pageSize.value,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '31'],
    showTotal: (total: number) => `共 ${total} 天`,
    onChange: handlePageChange,
  }));

  function personIds(users: (DutyPerson | null)[]) {
    return users.flatMap((person) => (person?.userId ? [person.userId] : []));
  }
  function personNames(users: (DutyPerson | null)[]) {
    return (
      users
        .map((person) => person?.name)
        .filter(Boolean)
        .join('、') || '—'
    );
  }
  function findPerson(id?: string): DutyPerson | null {
    const person = persons.value.find((item) => item.userId === id) || rotationUsers.value.find((item) => item?.userId === id);
    return person ? { ...person } : null;
  }
  function handlePageChange(page: number, size: number) {
    currentPage.value = size === pageSize.value ? page : 1;
    pageSize.value = size;
  }
  function markDirty() {
    if (editable.value) dirty.value = true;
  }
  function rowKey(row: DutyRosterDay) {
    let key = rowKeys.get(row);
    if (!key) {
      key = `${row.date}-${++rowKeySeed}`;
      rowKeys.set(row, key);
    }
    return key;
  }
  function getWeekday(date: string) {
    return WEEKDAYS[dayjs(date).day()];
  }
  function formatDate(date: string) {
    return dayjs(date).format('M月D日');
  }
  function isWeekend(date: string) {
    return [0, 6].includes(dayjs(date).day());
  }
  function rowClassName(row: DutyRosterDay) {
    return isWeekend(row.date) ? 'weekend-row' : '';
  }
  function buildMonthRows(): DutyRosterDay[] {
    return Array.from({ length: selectedMonth.value.daysInMonth() }, (_, index) => {
      const date = selectedMonth.value.date(index + 1).format('YYYY-MM-DD');
      return { date, weekday: getWeekday(date), dayUsers: [], nightUser: null, restUser: null };
    });
  }
  function applyResult(result: DutyRosterResult) {
    rotationUsers.value = result.rotationUsers;
    rosterRows.value = result.days;
    savedVersion.value = result.version;
    monthSaved.value = result.saved;
    isLocked.value = result.saved;
    dirty.value = false;
  }
  async function applyMonth(month: Dayjs) {
    const request = ++monthRequest;
    invalidateTextRule();
    selectedMonth.value = month.startOf('month');
    currentPage.value = 1;
    monthLoading.value = true;
    monthReady.value = false;
    monthError.value = '';
    rosterRows.value = [];
    rotationUsers.value = [];
    isLocked.value = false;
    savedVersion.value = 0;
    dirty.value = false;
    try {
      const result = await queryDutyRoster(selectedMonth.value.format('YYYY-MM'));
      if (request !== monthRequest) return;
      applyResult(result);
      monthReady.value = true;
      if (!result.saved && persons.value.length === 3) rotationUsers.value = persons.value.map((person) => ({ ...person }));
    } catch (error) {
      if (request === monthRequest) monthError.value = (error as Error).message;
    } finally {
      if (request === monthRequest) monthLoading.value = false;
    }
  }
  function confirmDiscard(onOk: () => void) {
    if (!dirty.value) {
      onOk();
      return;
    }
    Modal.confirm({
      title: '放弃未保存的调整？',
      content: '当前修改尚未保存，继续后会丢失。',
      okText: '放弃修改并继续',
      cancelText: '继续编辑',
      onOk,
    });
  }
  function handleMonthChange(value: Dayjs | null) {
    if (value && !busy.value)
      confirmDiscard(() => {
        void applyMonth(value);
      });
  }
  function refreshMonth() {
    if (!busy.value)
      confirmDiscard(() => {
        void applyMonth(selectedMonth.value);
      });
  }
  function startEditing() {
    if (canManage.value && !busy.value) isLocked.value = false;
  }
  function handleSelectedUsersChange(values: string[]) {
    if (!editable.value) return;
    rotationUsers.value = values.map(findPerson).filter((person): person is DutyPerson => !!person);
    invalidateTextRule();
    // 配置只影响下一次生成，不删改已经人工调整的每日明细。
    markDirty();
  }
  function invalidateTextRule() {
    ruleAnalysis.value = null;
    checkedRuleContext.value = '';
  }
  function handleGenerationRuleChange() {
    invalidateTextRule();
    markDirty();
  }
  function fillRuleExample(text: string) {
    if (editable.value) {
      ruleText.value = text;
      invalidateTextRule();
    }
  }
  async function checkRuleText() {
    if (!editable.value || !usersReady.value) return;
    const parsed = parseDutyRule(ruleText.value);
    const context = ruleContext.value;
    invalidateTextRule();
    if (parsed.errors.length) {
      ruleAnalysis.value = parsed;
      return;
    }
    const selected = rotationUsers.value.filter((person): person is DutyPerson => !!person?.userId);
    if (selected.some((person) => !persons.value.some((current) => current.userId === person.userId))) {
      ruleAnalysis.value = { errors: ['参与人员包含已不属于运维部的成员，请先重新选择人员'], summary: [] };
      return;
    }
    checkingRule.value = true;
    try {
      const previousMonth = selectedMonth.value.subtract(1, 'month');
      const previous = await queryDutyRoster(previousMonth.format('YYYY-MM'));
      const lastNight = getNightUsers(previous.days.find((row) => row.date === previousMonth.endOf('month').format('YYYY-MM-DD')))
        .map((person) => person.userId!)
        .filter(Boolean);
      const result = checkTextDutyRule(
        ruleText.value,
        buildMonthRows(),
        selected,
        lastNight,
        previous.days
          .find((row) => row.date === previousMonth.endOf('month').format('YYYY-MM-DD'))
          ?.dayUsers.map((person) => person?.userId || '')
          .filter(Boolean) || []
      );
      if (context !== ruleContext.value) return;
      ruleAnalysis.value = result;
      checkedRuleContext.value = context;
    } catch (error) {
      ruleAnalysis.value = { errors: [`无法完成上月衔接检查：${(error as Error).message}`], summary: [] };
    } finally {
      checkingRule.value = false;
    }
  }
  async function generateRoster() {
    if (!editable.value || !usersReady.value) return;
    const selected = rotationUsers.value.filter((person): person is DutyPerson => !!person?.userId);
    if (!selected.length) {
      createMessage.warning('请先选择参与排班的运维人员');
      return;
    }
    generating.value = true;
    try {
      const baseRows = buildMonthRows();
      if (generationRule.value === 'text') {
        if (!textRuleCanGenerate.value) throw new Error('请先检查排班逻辑，检查通过后再生成');
        rosterRows.value = JSON.parse(JSON.stringify(ruleAnalysis.value!.rows));
      } else if (generationRule.value === 'rotation') {
        if (selected.length !== 3) throw new Error('三人轮值需要选择3人，其他人数请使用自定义排班');
        const previousMonth = selectedMonth.value.subtract(1, 'month');
        const previous = await queryDutyRoster(previousMonth.format('YYYY-MM'));
        const previousNights = getNightUsers(previous.days.find((row) => row.date === previousMonth.endOf('month').format('YYYY-MM-DD')));
        if (previousNights.length > 1) throw new Error('上月末有多人夜班，请使用文字规则检查跨月休息安排');
        const lastNight = previousNights[0]?.userId;
        rosterRows.value = rotateDutyRoster(baseRows, selected, lastNight);
      } else {
        rosterRows.value = baseRows;
      }
      currentPage.value = 1;
      dirty.value = true;
      createMessage.success('排班表已生成，可按实际情况逐日调整');
    } catch (error) {
      createMessage.error((error as Error).message);
    } finally {
      generating.value = false;
    }
  }
  function applyAutoRoster() {
    if (!editable.value) return;
    if (rosterRows.value.length) {
      Modal.confirm({
        title: '重新生成本月排班？',
        content: '生成结果会替换当前表格，包括已手动调整的内容。',
        okText: '重新生成',
        cancelText: '保留当前排班',
        onOk: generateRoster,
      });
    } else {
      void generateRoster();
    }
  }
  function handleDayUsersChange(row: DutyRosterDay, values: string[]) {
    if (editable.value) {
      row.dayUsers = values.map(findPerson).filter((person): person is DutyPerson => !!person);
      markDirty();
    }
  }
  function handleNightUsersChange(row: DutyRosterDay, value?: string | string[]) {
    if (editable.value) {
      row.nightUsers = (Array.isArray(value) ? value : value ? [value] : []).map(findPerson).filter((person): person is DutyPerson => !!person);
      row.nightUser = row.nightUsers[0] || null;
      markDirty();
    }
  }
  async function saveRoster() {
    if (!editable.value || !rosterRows.value.length) return;
    const payload = createDutyRosterPayload(selectedMonth.value.format('YYYY-MM'), savedVersion.value, rotationUsers.value, rosterRows.value);
    saving.value = true;
    try {
      const result = await saveDutyRoster(payload);
      applyResult(result);
      createMessage.success('排班表已保存并锁定');
    } catch (error) {
      createMessage.error((error as Error).message || '保存失败，请稍后重试');
    } finally {
      saving.value = false;
    }
  }
  async function exportRoster() {
    if (!canExport.value) return;
    if (!isLocked.value || busy.value) return;
    exporting.value = true;
    try {
      await exportDutyRosterExcel(selectedMonth.value.format('YYYY-MM'));
      createMessage.success('Excel 已导出');
    } catch (error) {
      createMessage.error((error as Error).message);
    } finally {
      exporting.value = false;
    }
  }
  async function loadUsers() {
    userLoading.value = true;
    usersReady.value = false;
    userError.value = '';
    try {
      const result = await loadDutyRosterUsers();
      persons.value = result.persons;
      usersReady.value = true;
      if (!isLocked.value && !rotationUsers.value.length && !dirty.value && persons.value.length === 3)
        rotationUsers.value = persons.value.map((person) => ({ ...person }));
      if (!persons.value.length) userError.value = '运维部暂无可选人员，请联系管理员配置部门成员';
    } catch (error) {
      userError.value = (error as Error).message;
      persons.value = [];
    } finally {
      userLoading.value = false;
    }
  }
  onMounted(() => {
    void loadUsers();
    void applyMonth(selectedMonth.value).then(() => {
      if (canManage.value) startEditing();
    });
  });
</script>

<style lang="less" scoped>
  .duty-roster-page {
    min-height: 100%;
    padding: 24px;
    color: #253248;
    background: #f4f6f9;
  }
  .page-heading,
  .title-line,
  .heading-actions,
  .section-heading,
  .table-heading,
  .table-title,
  .table-footer {
    display: flex;
    align-items: center;
  }
  .page-heading {
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }
  .title-line {
    flex-wrap: wrap;
    gap: 12px;
  }
  h1 {
    margin: 0;
    color: #172b46;
    font-size: 24px;
    line-height: 1.4;
    font-weight: 600;
  }
  .title-line :deep(.ant-tag) {
    margin: 0;
  }
  .page-title p {
    margin: 7px 0 0;
    color: #596a80;
    font-size: 14px;
    line-height: 1.6;
  }
  .heading-actions {
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 8px;
  }
  .config-panel,
  .roster-panel {
    border: 1px solid #e2e7ef;
    border-radius: 12px;
    background: #fff;
  }
  .config-panel {
    padding: 22px 24px 18px;
  }
  .section-heading {
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }
  h2 {
    margin: 0;
    color: #25364e;
    font-size: 16px;
    line-height: 1.5;
    font-weight: 600;
  }
  .section-note,
  .label-hint,
  .table-hint {
    color: #596a80;
    font-size: 13px;
  }
  .config-grid {
    display: grid;
    grid-template-columns: 190px minmax(240px, 1fr) minmax(260px, 1.4fr) auto;
    align-items: end;
    gap: 18px;
  }
  .field {
    min-width: 0;
  }
  .saved-setting {
    display: flex;
    align-items: center;
    min-height: 32px;
    color: #596a80;
    font-size: 14px;
  }
  .field label {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
    color: #34445a;
    font-size: 14px;
    font-weight: 500;
  }
  .label-hint {
    font-size: 12px;
    font-weight: 400;
  }
  .field :deep(.ant-select),
  .field :deep(.ant-picker) {
    width: 100%;
  }
  .generate-button {
    color: #165dca;
    border-color: #b8d2f5;
    background: #f3f8ff;
  }
  .text-rule-panel {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 24px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #edf0f5;
  }
  .rule-writing-help {
    color: #596a80;
    font-size: 13px;
    line-height: 1.7;
    margin: 0 0 12px;
  }
  .rule-templates {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }
  .rule-check-area .feasibility-heading {
    margin-top: 20px;
  }
  .rule-input-heading,
  .rule-input-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .rule-input-heading {
    margin-bottom: 8px;
  }
  .rule-input-heading label {
    color: #34445a;
    font-size: 14px;
    font-weight: 500;
  }
  .rule-input-footer {
    margin-top: 24px;
  }
  .rule-input-footer > span,
  .rule-check-note,
  .rule-holiday-dates {
    color: #596a80;
    font-size: 12px;
    line-height: 1.8;
  }
  .rule-input-footer :deep(.ant-btn) {
    flex-shrink: 0;
  }
  .rule-check-area {
    padding: 16px 18px;
    border-radius: 8px;
    background: #f7f9fc;
  }
  .rule-check-area h3 {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 500;
    color: #25364e;
  }
  .rule-summary-list,
  .rule-error-list {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    line-height: 1.9;
  }
  .rule-summary-list {
    color: #34445a;
  }
  .rule-error-list {
    color: #a54416;
  }
  .rule-check-note {
    margin: 10px 0 0;
  }
  .rule-holiday-dates {
    margin: 4px 0 0;
  }
  .rule-description,
  .rotation-order {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 13px;
    line-height: 1.7;
  }
  .rule-description {
    flex-wrap: nowrap;
    align-items: flex-start;
    margin-top: 14px;
    color: #596a80;
  }
  .rule-description > span:last-child {
    min-width: 0;
    flex: 1;
  }
  .rule-description :deep(.app-iconify) {
    color: #2764ac;
    flex-shrink: 0;
  }
  .rotation-order {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #edf0f5;
    gap: 10px 16px;
  }
  .order-label {
    color: #596a80;
  }
  .person-order {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #34445a;
  }
  .order-index {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: #1b5ca9;
    background: #edf4fc;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .feedback {
    margin-top: 16px;
  }
  .roster-panel {
    margin-top: 20px;
    overflow: hidden;
  }
  .table-heading {
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding: 20px 24px;
  }
  .table-title {
    gap: 10px;
  }
  .day-count {
    padding: 2px 9px;
    border-radius: 5px;
    color: #53647b;
    background: #f0f3f7;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .table-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :deep(.ant-table-thead > tr > th) {
    color: #4b5b70;
    font-size: 13px;
    font-weight: 500;
    background: #f7f9fc;
    border-top: 1px solid #edf0f5;
  }
  :deep(.ant-table-tbody > tr > td) {
    padding-top: 13px;
    padding-bottom: 13px;
    border-bottom-color: #edf0f5;
  }
  :deep(.ant-table-cell .ant-select) {
    width: 100%;
  }
  :deep(.ant-table-pagination.ant-pagination) {
    margin: 18px 24px;
  }
  :deep(.weekend-row > td) {
    background: #fafbfd;
  }
  .weekend-text {
    color: #526d95;
  }
  .date-value {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .saved-users {
    color: #25364e;
  }
  .night-name {
    color: #195eac;
  }
  .rest-name,
  .empty-value {
    color: #68778b;
  }
  .contact-phone {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .empty-roster {
    padding: 52px 24px;
  }
  .table-footer {
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding: 13px 24px;
    border-top: 1px solid #edf0f5;
    color: #596a80;
    background: #fafbfd;
    font-size: 12px;
  }
  .table-footer > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  :deep(:focus-visible) {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }
  ::selection {
    color: #153d72;
    background: #d9eaff;
  }
  @media (max-width: 1200px) {
    .config-grid {
      grid-template-columns: 190px minmax(230px, 1fr);
    }
    .people-field {
      grid-column: 1;
    }
    .generate-button {
      justify-self: start;
    }
    .page-heading {
      align-items: flex-start;
      flex-wrap: wrap;
    }
  }
  @media (max-width: 800px) {
    .text-rule-panel {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
  }
  @media (max-width: 640px) {
    .duty-roster-page {
      padding: 14px;
    }
    .page-heading {
      gap: 14px;
      margin-bottom: 18px;
    }
    h1 {
      font-size: 22px;
    }
    .heading-actions {
      width: 100%;
    }
    .heading-actions > :deep(.ant-btn) {
      flex: 1;
    }
    .config-panel {
      padding: 18px;
    }
    .config-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
    .people-field {
      grid-column: auto;
    }
    .generate-button {
      width: 100%;
    }
    .table-heading {
      align-items: flex-start;
      padding: 18px;
    }
    .table-hint {
      line-height: 1.6;
    }
    .table-footer {
      padding: 12px 18px;
    }
  }
</style>
