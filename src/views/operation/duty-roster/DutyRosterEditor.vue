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
        <a-button v-else-if="canManage && wizardStep === 3" type="primary" :disabled="!rosterRows.length || busy" :loading="saving" @click="saveRoster">
          <template #icon><Icon icon="ant-design:lock-outlined" /></template>保存并锁定
        </a-button>
      </div>
    </header>

    <nav class="wizard-heading" aria-label="排班步骤">
      <a-steps size="small" :current="wizardStep" :items="wizardItems" @change="goToStep" />
      <p class="wizard-caption">第 {{ wizardStep + 1 }} / 4 步 · {{ wizardDescriptions[wizardStep] }}</p>
    </nav>
    <section v-show="wizardStep < 3" class="config-panel" aria-labelledby="config-title">
      <div class="section-heading">
        <div><h2 id="config-title">{{ wizardTitles[wizardStep] }}</h2></div>
        <a-tag>{{ rotationUsers.length }} 人参与</a-tag>
      </div>

      <div v-show="wizardStep === 0" class="config-grid">
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
          <label for="duty-rule">排班方式</label>
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

      </div>
      <div v-if="wizardStep === 1 && generationRule === 'text' && !isLocked" class="simple-rules">
        <div class="rule-section">
          <h3>每天人数 <span>0 表示不安排该班次</span></h3>
          <div class="demand-row"><strong>工作日</strong><label>白班 <a-input-number v-model:value="ruleForm.day" aria-label="工作日白班人数" :min="0" :max="100" :precision="0" :disabled="!editable" @change="invalidateTextRule" /> 人</label><label>夜班 <a-input-number v-model:value="ruleForm.night" aria-label="工作日夜班人数" :min="0" :max="100" :precision="0" :disabled="!editable" @change="invalidateTextRule" /> 人</label></div>
          <div class="demand-row"><strong>周末</strong><label>白班 <a-input-number v-model:value="ruleForm.weekendDay" aria-label="周末白班人数" :min="0" :max="100" :precision="0" :disabled="!editable" @change="invalidateTextRule" /> 人</label><label>夜班 <a-input-number v-model:value="ruleForm.weekendNight" aria-label="周末夜班人数" :min="0" :max="100" :precision="0" :disabled="!editable" @change="invalidateTextRule" /> 人</label></div>
          <div class="demand-row"><strong>节假日</strong><a-checkbox v-model:checked="ruleForm.holidays" :disabled="!editable" @change="invalidateTextRule">识别法定假日与调休</a-checkbox><a-select v-if="ruleForm.holidays" v-model:value="ruleForm.holidaySeparate" aria-label="节假日人数设置" :disabled="!editable" :options="[{label:'沿用周末人数',value:false},{label:'单独设置人数',value:true}]" @change="invalidateTextRule" /></div>
          <div v-if="ruleForm.holidays && ruleForm.holidaySeparate" class="demand-row"><strong>假日人数</strong><label>白班 <a-input-number v-model:value="ruleForm.holidayDay" aria-label="节假日白班人数" :min="0" :max="100" :precision="0" :disabled="!editable" @change="invalidateTextRule" /> 人</label><label>夜班 <a-input-number v-model:value="ruleForm.holidayNight" aria-label="节假日夜班人数" :min="0" :max="100" :precision="0" :disabled="!editable" @change="invalidateTextRule" /> 人</label></div>
          <p class="inline-note">{{ ruleForm.holidays ? '法定放假按假日安排，调休上班按工作日安排。' : '按自然星期区分工作日和周末。' }}</p>
        </div>
        <div class="rule-section">
          <h3>休息与班次</h3>
          <div class="demand-row"><strong>夜班后</strong><a-radio-group v-model:value="ruleForm.nightRest" :disabled="!editable" :options="[{label:'不休息',value:'none'},{label:'次日上午休息',value:'morning'},{label:'次日全天休息',value:'full'}]" @change="invalidateTextRule" /></div>
          <div v-if="ruleForm.nightRest==='morning'" class="demand-row"><strong>上午缺岗</strong><a-select v-model:value="ruleForm.coverMorning" aria-label="上午休息补班方式" :disabled="!editable" :options="[{label:'不补人，下午正常上班',value:false},{label:'另排人员补足上午人数',value:true}]" @change="invalidateTextRule" /></div>
          <p v-if="ruleForm.nightRest==='morning'" class="inline-note">{{ ruleForm.coverMorning ? '白班人数为上午在岗人数；昨夜夜班人员下午返岗，因此白班名单可能多于设定人数。' : '昨夜夜班人员若排入次日白班，计入白班人数，上午休息、下午上班。' }}</p>
          <p v-if="ruleForm.nightRest==='full'" class="inline-note">昨夜夜班人员次日白班、夜班均不安排；缺人会提示，不自动减少人数。</p>
          <div class="demand-row"><strong>同日白夜班</strong><a-radio-group v-model:value="ruleForm.overlap" :disabled="!editable" :options="[{label:'允许同一人',value:true},{label:'必须不同人',value:false}]" @change="invalidateTextRule" /></div>
        </div>

      </div>
      <div v-if="wizardStep === 2 && generationRule === 'text' && !isLocked">
        <a-collapse :active-key="['exceptions']" ghost class="exception-section"><a-collapse-panel key="exceptions" :header="`指定日期例外（${ruleForm.exceptions.length}条）`">
          <p class="inline-note">指定日期优先于节假日及周末，休息规则仍生效。选择同一天即可设置单日例外。</p>
          <div v-for="(exception,index) in ruleForm.exceptions" :key="index" class="exception-row">
            <a-range-picker v-model:value="exception.dates" value-format="YYYY-MM-DD" :aria-label="`特殊日期第${index+1}条范围`" :disabled="!editable" @change="invalidateTextRule" />
            <label>白班 <a-input-number v-model:value="exception.day" :aria-label="`特殊日期第${index+1}条白班人数`" :min="0" :max="100" :precision="0" :disabled="!editable" @change="invalidateTextRule" /></label>
            <label>夜班 <a-input-number v-model:value="exception.night" :aria-label="`特殊日期第${index+1}条夜班人数`" :min="0" :max="100" :precision="0" :disabled="!editable" @change="invalidateTextRule" /></label>
            <a-button type="link" danger :disabled="!editable" @click="ruleForm.exceptions.splice(index,1);invalidateTextRule()">移除</a-button>
          </div>
          <a-button :disabled="!editable" @click="ruleForm.exceptions.push({dates:[],day:1,night:1});invalidateTextRule()">添加特殊日期</a-button>
        </a-collapse-panel></a-collapse>
      </div>
      <p v-if="wizardStep > 0 && generationRule === 'rotation'" class="rule-description">按选人顺序轮值：工作日白班4人不占轮次，夜班取1人；周末白班、夜班各依次取1人。昨晚夜班人员次日上午休息、下午上班，不补人。首次从第1人开始；有上月末夜班时接着往后排。生成后可手动修改。</p>
      <div v-if="wizardStep === 0 && rotationUsers.length" class="order-panel">
        <h3>轮值顺序 <a-tag>{{ rotationUsers.length }} 人</a-tag></h3>
        <p class="section-note">按编号循环，前移 / 后移可调整顺序。全员白班不占轮次，其余班次先白班后夜班。</p>
        <ol class="ordered-people">
          <li v-for="(person,index) in rotationUsers" :key="person?.userId || index">
            <span class="order-index">{{ index + 1 }}</span><strong>{{ person?.name || '未命名人员' }}</strong>
            <span v-if="editable" class="order-actions"><a-button size="small" :disabled="index===0" :aria-label="`${person?.name}前移一位`" @click="movePerson(index,-1)">前移</a-button><a-button size="small" :disabled="index===rotationUsers.length-1" :aria-label="`${person?.name}后移一位`" @click="movePerson(index,1)">后移</a-button></span>
          </li>
        </ol>
        <div v-if="generationRule==='text'" class="demand-row"><strong>本月起排</strong><a-radio-group v-model:value="ruleForm.start" :disabled="!editable" :options="[{label:'接着上月排',value:'continue'},{label:'指定起排人员',value:'person'}]" @change="invalidateTextRule" /><a-select v-if="ruleForm.start==='person'" v-model:value="ruleForm.startUserId" aria-label="起排人员" placeholder="选择起排人员" :disabled="!editable" :options="rotationUsers.filter(Boolean).map(p=>({label:p?.name,value:p?.userId}))" @change="invalidateTextRule" /></div>
        <p class="inline-note">{{ rotationStartHint }}</p>
      </div>
      <div v-if="wizardStep === 2 && generationRule==='text' && !isLocked" class="rule-review" aria-live="polite">
        <p>{{ ruleSummary }}</p><p class="inline-note">规则用于本次生成。服务器目前只保存每日人员，重新打开时不会恢复这些规则或半天休息标记。</p>
        <a-alert v-if="ruleAnalysis?.errors.length" type="warning" show-icon :message="ruleAnalysis.errors.join('；')" />
        <p v-if="textRuleCanGenerate" class="check-success">已检查 {{ ruleAnalysis?.rows?.length }} 天，可以生成。生成后可逐日修改，保存不受生成规则限制。</p>
        <div class="review-actions"><a-button :disabled="!editable || !usersReady || !selectedUserIds.length" :loading="checkingRule" @click="checkRuleText">检查规则</a-button><a-checkbox v-model:checked="ruleConfirmed" :disabled="!editable || !textRuleCanGenerate">已核对规则</a-checkbox><a-button type="primary" :disabled="!editable || !textRuleCanGenerate || !ruleConfirmed" :loading="generating" @click="applyAutoRoster">{{ rosterRows.length ? '重新生成排班' : '生成排班' }}</a-button></div>
      </div>
      <p v-if="wizardStep > 0 && generationRule === 'manual'" class="inline-note">手动排班将生成本月空表，下一步逐日选择白班、夜班人员，无需填写生成规则。</p>
      <div class="wizard-actions">
        <a-button v-if="wizardStep > 0" :disabled="busy" @click="goToStep(wizardStep - 1)">上一步</a-button>
        <span class="wizard-spacer" />
        <a-button v-if="rosterRows.length" :disabled="busy" @click="goToStep(3)">返回现有排班</a-button>
        <a-button v-if="wizardStep < 2" type="primary" :disabled="busy || !selectedUserIds.length || !usersReady" @click="goToStep(wizardStep + 1)">下一步：{{ wizardTitles[wizardStep + 1] }}</a-button>
        <a-button v-if="wizardStep === 2 && generationRule !== 'text'" type="primary" :disabled="!editable || !usersReady || !selectedUserIds.length" :loading="generating" @click="applyAutoRoster">{{ rosterRows.length ? '重新生成排班' : '生成排班' }}</a-button>
      </div>
    </section>

    <a-alert v-if="monthError" class="feedback" type="error" show-icon message="值班表加载失败" :description="monthError">
      <template #action><a-button size="small" :disabled="busy" @click="refreshMonth">重新加载</a-button></template>
    </a-alert>

    <a-alert v-if="boundaryError" class="feedback" type="warning" :message="boundaryError" show-icon />
    <section v-show="wizardStep === 3" class="roster-panel" aria-labelledby="roster-title">
      <div class="table-heading"><a-button v-if="canManage && !isLocked" :disabled="busy" @click="goToStep(0)">返回设置人员与规则</a-button>
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
        :scroll="{ x: 1260 }"
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
          <template v-else-if="column.dataIndex === 'morningRest'"><span class="rest-name">{{ appliedNightRest === null ? '未记录休息规则' : boundaryError && record.date.endsWith('-01') ? '待确认上月末夜班' : personNames(morningRest(record)) }}</span></template>
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
  import type { RuleCheck } from './dutyRoster.textRule';
  import { defaultAdvancedRule, advancedSummary, checkAdvancedRule } from './dutyRoster.advancedRule';
  import { rotateDutyRoster, createDutyRosterPayload, getRestUsers, getNightUsers, getMorningRestUsers } from './dutyRoster.rules';
  import { exportDutyRosterExcel } from './dutyRosterExcel';
  import type { DutyPerson, DutyRosterDay, DutyRosterResult, GenerationRule } from './dutyRoster.store';

  defineOptions({ name: 'OperationDutyRoster' });

  const { createMessage } = useMessage();
  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const ruleOptions = [
    { label: '自定义规则', value: 'text' },
    { label: '四人轮值 · 工作日白4夜1 / 周末白1夜1', value: 'rotation' },
    { label: '手动排班 · 生成空表', value: 'manual' },
  ];
  const columns = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '星期', dataIndex: 'weekday', width: 100 },
    { title: '白班人员', dataIndex: 'dayUsers', width: 300 },
    { title: '夜班人员', dataIndex: 'nightUser', width: 200 },
    { title: '全天休息人员', dataIndex: 'restUser', width: 190 },
    { title: '上午休息 · 下午上班', dataIndex: 'morningRest', width: 200 },
    { title: '联系电话', dataIndex: 'phone', width: 160 },
  ];
  const props = defineProps<{ month?: string }>();
  const emit = defineEmits<{ (event: 'back'): void }>();
  const selectedMonth = ref<Dayjs>(dayjs(props.month).startOf('month'));
  const generationRule = ref<GenerationRule>('text');
  const ruleForm = ref(defaultAdvancedRule());
  const appliedNightRest = ref<'none' | 'morning' | 'full' | null>(null);
  const ruleSummary = computed(() => advancedSummary(ruleForm.value));
  const checkingRule = ref(false);
  const ruleAnalysis = ref<RuleCheck | null>(null);
  const checkedRuleContext = ref('');
  const ruleConfirmed = ref(false);
  const wizardStep = ref(0);
  const wizardTitles = ['人员与顺序', '日常人数与休息', '特殊日期与核对', '排班调整与保存'];
  const wizardDescriptions = ['选择参与人员，确定轮值顺序', '设置工作日、周末及夜班后休息', '补充特殊日期，检查后生成', '逐日调整实际安排，确认后保存'];
  const wizardItems = computed(() => wizardTitles.map((title,index) => ({ title, disabled: busy.value || (isLocked.value && index !== 3) || (index === 3 && !rosterRows.value.length && !monthSaved.value) || (index > 0 && index < 3 && !selectedUserIds.value.length) })));
  function goToStep(index: number) {
    if (index < 0 || index > 3 || wizardItems.value[index].disabled) return;
    wizardStep.value = index;
  }
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
  const previousLastRow = ref<DutyRosterDay>();
  const boundaryError = ref('');
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
  const ruleContext = computed(() => JSON.stringify([ruleForm.value, selectedMonth.value.format('YYYY-MM'), rotationUsers.value]));
  const rotationStartHint = computed(() => {
    if (generationRule.value === 'manual') return '手动排班无需自动轮值，名单仅用于选择参与人员。';
    if (generationRule.value==='text' && ruleForm.value.start==='person') return `从${rotationUsers.value.find(p=>p?.userId===ruleForm.value.startUserId)?.name || '指定人员（待选择）'}开始；上月夜班后的休息仍然生效。`;
    if (boundaryError.value) return '上月数据读取失败，检查成功后再确认起始人员。';
    const last = getNightUsers(previousLastRow.value).at(-1);
    const index = rotationUsers.value.findIndex(person => !!last?.userId && person?.userId === last.userId);
    if (index >= 0) return `上月最后一名夜班人员为${last?.name}，本月从${rotationUsers.value[(index + 1) % rotationUsers.value.length]?.name}接着排。`;
    return `没有可衔接的上月末夜班人员时，从第1位${rotationUsers.value[0]?.name || ''}开始；以检查结果为准。`;
  });
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
  function morningRest(row: DutyRosterDay) {
    if (appliedNightRest.value !== 'morning') return [];
    const previousDate = dayjs(row.date).subtract(1, 'day').format('YYYY-MM-DD');
    return getMorningRestUsers(row, rosterRows.value.find(day => day.date === previousDate) || (previousLastRow.value?.date === previousDate ? previousLastRow.value : undefined));
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
    wizardStep.value = result.saved || result.days.length ? 3 : 0;
    dirty.value = false;
  }
  async function applyMonth(month: Dayjs) {
    const request = ++monthRequest;
    invalidateTextRule();
    selectedMonth.value = month.startOf('month');
    appliedNightRest.value = null;
    currentPage.value = 1;
    monthLoading.value = true;
    wizardStep.value = 0;
    monthReady.value = false;
    monthError.value = '';
    rosterRows.value = [];
    previousLastRow.value = undefined; boundaryError.value = '';
    rotationUsers.value = [];
    isLocked.value = false;
    savedVersion.value = 0;
    dirty.value = false;
    try {
      const result = await queryDutyRoster(selectedMonth.value.format('YYYY-MM'));
      if (request !== monthRequest) return;
      applyResult(result);
      monthReady.value = true;
      try {
        const previousMonth = selectedMonth.value.subtract(1, 'month');
        const previous = await queryDutyRoster(previousMonth.format('YYYY-MM'));
        if (request !== monthRequest) return;
        previousLastRow.value = previous.days.find(row => row.date === previousMonth.endOf('month').format('YYYY-MM-DD'));
      } catch (error) {
        if (request === monthRequest) boundaryError.value = `上月末班次读取失败，月初半天休息暂无法确认：${(error as Error).message}`;
      }
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
  function movePerson(index: number, direction: number) {
    if (!editable.value || index + direction < 0 || index + direction >= rotationUsers.value.length) return;
    const next = [...rotationUsers.value];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    rotationUsers.value = next;
    invalidateTextRule(); markDirty();
  }
  function invalidateTextRule() {
    ruleAnalysis.value = null;
    checkedRuleContext.value = '';
    ruleConfirmed.value = false;
  }
  function handleGenerationRuleChange() {
    invalidateTextRule();
    markDirty();
  }
  async function checkRuleText() {
    if (!editable.value || !usersReady.value) return;
    const context = ruleContext.value;
    invalidateTextRule();
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
      previousLastRow.value = previous.days.find(row => row.date === previousMonth.endOf('month').format('YYYY-MM-DD'));
      boundaryError.value = '';
      const result = checkAdvancedRule(
        ruleForm.value,
        buildMonthRows(),
        selected,
        lastNight
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
        if (!textRuleCanGenerate.value || !ruleConfirmed.value) throw new Error('请先检查人数和轮值顺序，确认后再生成排班');
        rosterRows.value = JSON.parse(JSON.stringify(ruleAnalysis.value!.rows));
        appliedNightRest.value = ruleForm.value.nightRest;
      } else if (generationRule.value === 'rotation') {
        if (selected.length !== 4) throw new Error('四人轮值需要选择4人，生成后可手动修改每天人数');
        const previousMonth = selectedMonth.value.subtract(1, 'month');
        const previous = await queryDutyRoster(previousMonth.format('YYYY-MM'));
        previousLastRow.value = previous.days.find((row) => row.date === previousMonth.endOf('month').format('YYYY-MM-DD'));
        boundaryError.value = '';
        const previousNights = getNightUsers(previousLastRow.value);
        const lastNight = previousNights.at(-1)?.userId;
        rosterRows.value = rotateDutyRoster(baseRows, selected, lastNight);
        appliedNightRest.value = 'morning';
      } else {
        rosterRows.value = baseRows;
        appliedNightRest.value = null;
      }
      currentPage.value = 1;
      dirty.value = true;
      wizardStep.value = 3;
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
      const selectedOrder = rotationUsers.value;
      applyResult(result);
      rotationUsers.value = selectedOrder.map(person => result.rotationUsers.find(saved => saved?.userId === person?.userId) || person);
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
  .wizard-heading { padding:18px 22px;background:#fff;border:1px solid #e2e7ef;border-radius:10px;margin-bottom:16px; }
  .wizard-caption { margin:14px 0 0;color:#667085;font-size:13px; }
  .wizard-actions { display:flex;align-items:center;gap:12px;border-top:1px solid #edf0f5;margin-top:20px;padding-top:18px;flex-wrap:wrap; }
  .wizard-spacer { flex:1; }
  @media(max-width:640px){.wizard-heading{padding:14px}.wizard-spacer{display:none}}

  .simple-rules { border-top:1px solid #edf0f5; }
  .rule-section { padding:18px 0;border-bottom:1px solid #edf0f5; }
  .rule-section h3 { font-size:15px;margin:0 0 14px;font-weight:600; }
  .rule-section h3 span { font-size:12px;font-weight:400;color:#667085;margin-left:10px; }
  .demand-row,.exception-row { display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin:10px 0; }
  .demand-row>strong { width:90px;flex-shrink:0;font-weight:500; }
  .demand-row label,.exception-row label { display:flex;align-items:center;gap:8px; }
  .demand-row :deep(.ant-input-number),.exception-row :deep(.ant-input-number) { width:76px; }
  .demand-row :deep(.ant-select) { min-width:185px; }
  .inline-note { color:#667085;font-size:13px;line-height:1.7;margin:8px 0; }
  .rule-review { margin-top:18px;border-top:1px solid #edf0f5;padding-top:16px; }
  .rule-review>p { font-size:13px;line-height:1.8; }
  .review-actions { display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:12px; }
  .check-success { color:#237b4b; }
  .exception-section { margin-top:10px; }
  .order-panel { background:transparent!important;border:0!important;border-bottom:1px solid #edf0f5!important;padding:16px 0!important;margin-top:0!important; }
  .ordered-people { display:flex!important;flex-wrap:wrap; }
  .ordered-people li { padding:8px 10px!important; }
  @media(max-width:640px){.demand-row,.exception-row{gap:10px}.demand-row>strong{width:100%}.review-actions{gap:10px}}

  .shift-count-grid { display:grid;grid-template-columns:minmax(100px,1fr) 1fr 1fr;gap:14px;align-items:center;margin:16px 0; }
  .shift-count-grid small { display:block;color:#596a80;font-size:12px; }
  .shift-count-grid :deep(.ant-input-number) { width:100%; }
  .order-panel { margin-top:22px;padding:18px;background:#f7f9fc;border:1px solid #e2e7ef;border-radius:8px; }
  .order-panel h3 { margin:0 0 8px;font-size:15px; }
  .ordered-people { list-style:none;padding:0;margin:14px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px; }
  .ordered-people li { display:flex;align-items:center;gap:10px;background:white;border:1px solid #e2e7ef;padding:12px;border-radius:6px; }
  .order-actions { display:flex;gap:6px;margin-left:auto; }
  .order-start { color:#25364e;margin:12px 0 6px; }

  .roster-steps { max-width: 880px; margin: 10px 0 26px; }
  .section-heading .section-note { margin: 6px 0 0; }
  .check-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .check-heading h3 { margin: 0; }
  .confirm-generation { display: grid; gap: 14px; margin-top: 22px; padding-top: 18px; border-top: 1px solid #dce5ee; }
  .order-move { border: 0; border-radius: 4px; background: #edf4fc; color: #1b5ca9; min-width: 28px; min-height: 28px; cursor: pointer; }
  .order-move:disabled { opacity: .35; cursor: default; }

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
