<template>
  <div class="plan-person">
    <!-- 参与人员信息 -->
    <div class="plan-person__group">
      <div class="plan-person__group-title" style="margin-top: 10px">
        <div>
          <span>参与人员信息</span>
          <span class="plan-person__hint">提交邀请后立即发送，可为同一成员选择多个项目角色</span>
        </div>
        <div class="plan-person__actions">
          <a-button size="small" preIcon="ant-design:reload-outlined" :loading="peopleLoading" :disabled="peopleLoading" @click="() => loadPeople()">
            刷新状态
          </a-button>
          <a-button v-if="canEditPersonPage" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="openInviteModal">
            添加成员
          </a-button>
        </div>
      </div>
      <a-table
        :loading="peopleLoading"
        :columns="personColumns"
        :data-source="personList"
        :row-key="(record) => record.id || record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #headerCell="{ column }">
          <span>
            {{ column.title }}
            <span v-if="column.required" class="plan-person__required" aria-hidden="true">*</span>
          </span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'role'">
            <a-tag color="blue">{{ formatMemberRoles(record.role) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'member'">
            {{ record.memberName || '—' }}
          </template>
          <template v-else-if="column.key === 'inviteStatus'">
            <a-tag :color="getInviteStatusMeta(record.inviteStatus).color">
              {{ getInviteStatusMeta(record.inviteStatus).text }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-popconfirm v-if="canDeleteMember(record)" title="确认删除该项目成员？" @confirm="deletePerson(record)">
              <a-button type="link" danger size="small">删除</a-button>
            </a-popconfirm>
            <span v-else class="plan-person__action-placeholder">—</span>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 外协配置 -->
    <div class="plan-person__group">
      <div class="plan-person__group-title">
        <span>外协配置</span>
        <a-button
          v-if="canEditOutsource && needsOutsource"
          type="primary"
          size="small"
          preIcon="ant-design:plus-outlined"
          :disabled="!canAddOutsourcing"
          :title="canAddOutsourcing ? '添加外协单位' : '所有可用外协单位均已添加'"
          @click="addOutsourcing"
        >
          添加
        </a-button>
      </div>
      <div class="plan-person__outsource-switch">
        <span class="plan-person__outsource-label">是否需要外协</span>
        <a-radio-group v-model:value="needsOutsource" :disabled="!canEditOutsource">
          <a-radio :value="false">否</a-radio>
          <a-radio :value="true">是</a-radio>
        </a-radio-group>
        <span class="plan-person__hint">选择“是”后可维护外协单位、人数和工时</span>
      </div>
      <a-table
        v-if="needsOutsource"
        :loading="outsourcingLoading"
        :columns="outsourcingColumns"
        :data-source="outsourcingList"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #headerCell="{ column }">
          <span>
            {{ column.title }}
            <span v-if="column.required" class="plan-person__required" aria-hidden="true">*</span>
          </span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'unit'">
            <UniqueRowSelect
              v-model="record.unitId"
              :rows="outsourcingList"
              :row="record"
              :options="outsourcingOptions"
              field="unitId"
              showSearch
              allowClear
              :disabled="!canEditOutsource"
              placeholder="请选择外协单位"
              @change="(value) => handleOutsourcingUnitChange(record, value)"
              :filter-option="(input: string, option: any) => (option?.label || '').toLowerCase().includes(input.toLowerCase())"
            />
          </template>
          <template v-else-if="column.key === 'peopleNum'">
            <a-input-number
              v-model:value="record.peopleNum"
              :min="1"
              :precision="0"
              placeholder="人数"
              style="width: 100%"
              :disabled="!canEditOutsource"
            />
          </template>
          <template v-else-if="column.key === 'hours'">
            <a-input-number v-model:value="record.hours" :min="0" placeholder="工时" style="width: 100%" :disabled="!canEditOutsource" />
          </template>
          <template v-else-if="column.key === 'contact'">
            <a-input v-model:value="record.contact" placeholder="联系人" :disabled="!canEditOutsource" />
          </template>
          <template v-else-if="column.key === 'phone'">
            <a-input v-model:value="record.phone" placeholder="联系方式" :disabled="!canEditOutsource" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="canEditOutsource" type="link" danger size="small" @click="removeOutsourcing(record._key)">删除</a-button>
            <span v-else>—</span>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal
      v-model:open="inviteModalOpen"
      class="member-invite-modal"
      title="邀请项目成员"
      :width="520"
      ok-text="提交邀请"
      cancel-text="取消"
      :confirm-loading="inviteSubmitting"
      centered
      destroy-on-close
      @ok="submitInvite"
    >
      <div class="member-invite-modal__intro">
        <strong>选择成员及项目角色</strong>
        <span>点击“提交邀请”会立即向该成员发送邀请；一个成员可同时承担多个角色。</span>
      </div>
      <a-form class="member-invite-modal__form" layout="vertical">
        <a-form-item label="项目角色" required>
          <a-select
            v-model:value="inviteForm.roles"
            mode="multiple"
            show-search
            allow-clear
            option-filter-prop="label"
            placeholder="请选择角色"
            :loading="roleOptionsLoading"
            :options="inviteRoleOptions"
          />
        </a-form-item>
        <a-form-item label="邀请成员" required>
          <a-select
            v-model:value="inviteForm.userId"
            show-search
            allow-clear
            option-filter-prop="label"
            placeholder="请输入姓名搜索并选择成员"
            :loading="userOptionsLoading"
            :options="userOptions"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, computed, unref, watch } from 'vue';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import { ajaxGetDictItems, getDictItemsByCode } from '/@/utils/dict';
  import { addPlanMembersBatch, deletePlanMembersBatch, getOutsourcingUnits, getPlanMembers, getPlanOutsources } from './Plan.api';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { UniqueRowSelect, useUniqueRowOptions, validateEditableRows } from '/@/components/EditableTable';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑; periodId 用于查询项目成员。
  const props = defineProps<{
    editable?: boolean;
    outsourceEditable?: boolean;
    periodId?: string;
  }>();
  const emit = defineEmits<{
    'persisted-change': [persisted: boolean];
    'members-change': [];
  }>();

  // 成员用户下拉
  const userOptions = ref<{ label: string; value: string }[]>([]);
  const userOptionsLoading = ref(false);

  // 列表回显使用 member_role 完整字典，邀请下拉过滤系统角色 0/1/2。
  const roleOptions = ref<{ label: string; value: string }[]>([]);
  const roleMeta = ref<Recordable>({});
  const roleOptionsLoading = ref(false);
  const roleOptionsLoadFailed = ref(false);
  const roleOptionsLoaded = ref(false);
  const protectedRoleValues = new Set(['0', '1', '2']);
  const inviteRoleOptions = computed(() => roleOptions.value.filter((item) => !protectedRoleValues.has(String(item.value))));
  let roleOptionsRequestSequence = 0;
  let roleOptionsPromise: Promise<boolean> | null = null;

  function normalizeRoleOptions(payload: any): { label: string; value: string }[] {
    let source = payload;
    for (let depth = 0; depth < 3 && source?.result && !Array.isArray(source); depth += 1) source = source.result;
    const items = Array.isArray(source) ? source : source?.records || source?.list || [];
    return items
      .map((item: any) => {
        const value = item.value ?? item.dictItemValue ?? item.code;
        const label = item.text ?? item.label ?? item.title ?? item.dictItemText ?? item.name;
        return value == null || label == null ? null : { value: String(value), label: String(label) };
      })
      .filter(Boolean) as { label: string; value: string }[];
  }

  async function loadMemberRoleOptions(force = false) {
    if (!force && roleOptionsLoaded.value) return true;
    if (roleOptionsPromise) return roleOptionsPromise;

    const requestSequence = ++roleOptionsRequestSequence;
    roleOptionsLoading.value = true;
    roleOptionsLoadFailed.value = false;
    const task = (async () => {
      try {
        // 每轮只请求一次实时字典；接口空数据时仅使用登录缓存兜底，不再发起第二次请求。
        const liveItems = normalizeRoleOptions(await ajaxGetDictItems('member_role', undefined, { joinTime: false }));
        const cachedItems = normalizeRoleOptions(getDictItemsByCode('member_role'));
        if (requestSequence !== roleOptionsRequestSequence) return false;
        roleOptions.value = liveItems.length ? liveItems : cachedItems;
        roleMeta.value = Object.fromEntries(roleOptions.value.map((item) => [String(item.value), item.label]));
        roleOptionsLoaded.value = true;
        if (!roleOptions.value.length) createMessage.warning('member_role 字典暂无数据，请检查字典配置');
        else if (!inviteRoleOptions.value.length) createMessage.warning('member_role 字典中没有 0、1、2 以外的可邀请角色');
        return true;
      } catch {
        if (requestSequence !== roleOptionsRequestSequence) return false;
        roleOptionsLoadFailed.value = true;
        roleOptionsLoaded.value = false;
        createMessage.warning('成员角色加载失败，请检查 member_role 字典后重试');
        return false;
      } finally {
        if (requestSequence === roleOptionsRequestSequence) roleOptionsLoading.value = false;
      }
    })();
    roleOptionsPromise = task;
    try {
      return await task;
    } finally {
      if (roleOptionsPromise === task) roleOptionsPromise = null;
    }
  }

  async function loadMemberUserOptions(force = false) {
    if (userOptionsLoading.value) return;
    userOptionsLoading.value = true;
    try {
      userOptions.value = await loadUserOptions(force);
      if (!userOptions.value.length) createMessage.warning('系统用户列表暂无可邀请成员');
    } catch {
      userOptions.value = [];
      createMessage.warning('系统用户列表加载失败，请重试');
    } finally {
      userOptionsLoading.value = false;
    }
  }

  // 参与人员
  const personColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '角色', key: 'role', width: 150 },
    { title: '成员', key: 'member' },
    { title: '邀请状态', key: 'inviteStatus', width: 100 },
    { title: '操作', key: 'action', width: 140, align: 'center' },
  ];
  const personList = ref<any[]>([]);
  const peopleLoading = ref(false);
  const peopleLoaded = ref(false);
  const peopleLoadFailed = ref(false);
  const memberMutationSavingCount = ref(0);
  let personSeed = 0;
  let peopleRequestSequence = 0;

  const inviteModalOpen = ref(false);
  const inviteForm = reactive<{ roles?: string[]; userId?: string }>({});
  const inviteSubmitting = ref(false);

  // 外协配置
  const outsourcingColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '外协单位', key: 'unit', required: true },
    { title: '人数', key: 'peopleNum', width: 100, required: true },
    { title: '工时', key: 'hours', width: 100, required: true },
    { title: '联系人', key: 'contact', width: 120 },
    { title: '联系方式', key: 'phone', width: 140 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const outsourcingList = ref<any[]>([]);
  const outsourcingOptions = ref<any[]>([]);
  const outsourcingLoading = ref(false);
  const outsourcingLoadFailed = ref(false);
  const outsourcingLoadSucceeded = ref(false);
  const outsourcingOptionsLoading = ref(false);
  const outsourcingOptionsLoadFailed = ref(false);
  const outsourcingOptionsLoaded = ref(false);
  const needsOutsource = ref(false);
  const memberActionsReady = computed(() => peopleLoaded.value && !peopleLoading.value && !peopleLoadFailed.value);
  const outsourceActionsReady = computed(
    () =>
      outsourcingLoadSucceeded.value &&
      outsourcingOptionsLoaded.value &&
      !outsourcingLoading.value &&
      !outsourcingLoadFailed.value &&
      !outsourcingOptionsLoading.value &&
      !outsourcingOptionsLoadFailed.value
  );
  const canEditPersonPage = computed(() => !!props.editable && !!props.outsourceEditable && memberActionsReady.value);
  const canEditOutsource = computed(() => !!props.editable && !!props.outsourceEditable && outsourceActionsReady.value);
  const { canAdd: canAddOutsourcing } = useUniqueRowOptions(outsourcingList, outsourcingOptions, { field: 'unitId' });
  let outsourcingSeed = 0;
  let initializationSequence = 0;
  let outsourcingRequestSequence = 0;
  let outsourcingOptionsRequestSequence = 0;
  let outsourcingOptionsPromise: Promise<boolean> | null = null;
  const persistedOutsourceSnapshot = ref('');

  const pageLoading = computed(() => peopleLoading.value || outsourcingLoading.value || outsourcingOptionsLoading.value || roleOptionsLoading.value);
  const pageLoadFailed = computed(
    () => peopleLoadFailed.value || outsourcingLoadFailed.value || outsourcingOptionsLoadFailed.value || roleOptionsLoadFailed.value
  );
  const pageSaving = computed(() => inviteSubmitting.value || memberMutationSavingCount.value > 0);
  const pageLoaded = computed(
    () => peopleLoaded.value && outsourcingLoadSucceeded.value && outsourcingOptionsLoaded.value && roleOptionsLoaded.value
  );

  function normalizePeriodId(value: unknown) {
    return String(value ?? '').trim();
  }

  function isCurrentPeriodRequest(periodId: string, initSequence: number) {
    return initSequence === initializationSequence && periodId === normalizePeriodId(props.periodId);
  }

  function getOutsourceSnapshot() {
    return JSON.stringify({
      needsOutsource: needsOutsource.value,
      records: needsOutsource.value ? mapOutsourceRecords(outsourcingList.value) : [],
    });
  }

  function getSubmissionState() {
    return {
      loading: pageLoading.value,
      loaded: pageLoaded.value,
      loadFailed: pageLoadFailed.value,
      saving: pageSaving.value,
      dirty: outsourcingLoadSucceeded.value && getOutsourceSnapshot() !== persistedOutsourceSnapshot.value,
    };
  }

  async function loadOutsourcingOptions(force = false) {
    if (!force && outsourcingOptionsLoaded.value) return true;
    if (outsourcingOptionsPromise) return outsourcingOptionsPromise;

    const requestSequence = ++outsourcingOptionsRequestSequence;
    outsourcingOptionsLoading.value = true;
    outsourcingOptionsLoadFailed.value = false;
    const task = (async () => {
      try {
        const res: any = await getOutsourcingUnits({ status: 0, pageNo: 1, pageSize: 1000 });
        if (requestSequence !== outsourcingOptionsRequestSequence) return false;
        const records = Array.isArray(res) ? res : res?.records || [];
        outsourcingOptions.value = records.map((item: any) => ({
          label: item.unitName,
          value: item.id,
          unitType: item.unitType,
          contactPerson: item.contactPerson,
          contactPhone: item.contactPhone,
        }));
        outsourcingOptionsLoaded.value = true;
        return true;
      } catch (error: any) {
        if (requestSequence !== outsourcingOptionsRequestSequence) return false;
        outsourcingOptionsLoadFailed.value = true;
        outsourcingOptionsLoaded.value = false;
        createMessage.warning(error?.message || '外协单位列表加载失败，请刷新后重试');
        return false;
      } finally {
        if (requestSequence === outsourcingOptionsRequestSequence) outsourcingOptionsLoading.value = false;
      }
    })();
    outsourcingOptionsPromise = task;
    try {
      return await task;
    } finally {
      if (outsourcingOptionsPromise === task) outsourcingOptionsPromise = null;
    }
  }

  function getMemberData() {
    return { personList: unref(personList) };
  }

  function getOutsourceData() {
    if (outsourcingLoading.value) throw new Error('外协配置仍在加载，暂不能保存，请稍候再试');
    if (!outsourcingLoadSucceeded.value) throw new Error('外协配置未加载成功，暂不能保存，请刷新页面后重试');
    if (!needsOutsource.value) return [];
    if (!outsourcingList.value.length) throw new Error('选择需要外协后，请至少添加 1 条外协配置');
    const issues = validateEditableRows(outsourcingList.value, {
      selectorField: 'unitId',
      selectorLabel: '外协单位',
      optionLabel: (value) => outsourcingOptions.value.find((item) => String(item.value) === String(value))?.label || String(value),
      rules: [
        {
          field: 'peopleNum',
          label: '人数',
          required: true,
          validate: (value) => (Number.isInteger(Number(value)) && Number(value) >= 1) || '人数必须是大于等于 1 的整数',
        },
        {
          field: 'hours',
          label: '工时',
          required: true,
          validate: (value) => (Number.isFinite(Number(value)) && Number(value) >= 0) || '工时不能小于 0',
        },
      ],
    });
    if (issues.length) throw new Error(issues[0].message);
    return unref(outsourcingList);
  }

  // 暴露给父级
  defineExpose({
    getData() {
      return {
        ...getMemberData(),
        outsourcingList: getOutsourceData(),
      };
    },
    getMemberData,
    getOutsourceData,
    getOutsourceRecords: () => mapOutsourceRecords(getOutsourceData()),
    getSubmissionState,
    setData(data: any) {
      personList.value = (data?.personList || []).map((item) => ({
        ...item,
        _key: ++personSeed,
        memberId: item.memberId,
        memberName: item.memberName || item.member || '',
      }));
      outsourcingList.value = (data?.outsourcingList || []).map((item) => ({ ...item, _key: ++outsourcingSeed }));
      needsOutsource.value = outsourcingList.value.length > 0;
    },
    reloadPeople: loadPeople,
    reloadOutsources: loadOutsources,
    reload: () => Promise.all([loadPeople(), loadOutsourcingOptions(true), loadOutsources()]),
  });

  async function loadPeople(periodId = normalizePeriodId(props.periodId), initSequence = initializationSequence) {
    const requestSequence = ++peopleRequestSequence;
    if (!periodId) {
      if (isCurrentPeriodRequest(periodId, initSequence)) {
        personList.value = [];
        peopleLoaded.value = false;
        peopleLoadFailed.value = false;
        peopleLoading.value = false;
      }
      return false;
    }
    peopleLoading.value = true;
    peopleLoaded.value = false;
    peopleLoadFailed.value = false;
    try {
      const result: any = await getPlanMembers({ periodId, pageNo: 1, pageSize: 1000 });
      if (requestSequence !== peopleRequestSequence || !isCurrentPeriodRequest(periodId, initSequence)) return false;
      const records = Array.isArray(result) ? result : result?.records || [];
      personSeed = 0;
      personList.value = records
        .filter((item: any) => !item.outsourcingFlag)
        .map((item: any) => ({
          ...item,
          _key: ++personSeed,
          role: item.memberRole,
          memberId: item.userId,
          memberName: item.userName || '',
        }));
      peopleLoaded.value = true;
      return true;
    } catch (error: any) {
      if (requestSequence === peopleRequestSequence && isCurrentPeriodRequest(periodId, initSequence)) {
        peopleLoadFailed.value = true;
        peopleLoaded.value = false;
        createMessage.warning(error?.message || '项目成员加载失败，请刷新后重试');
      }
      return false;
    } finally {
      if (requestSequence === peopleRequestSequence && isCurrentPeriodRequest(periodId, initSequence)) peopleLoading.value = false;
    }
  }

  async function loadOutsources(periodId = normalizePeriodId(props.periodId), initSequence = initializationSequence) {
    const requestSequence = ++outsourcingRequestSequence;
    if (!periodId) {
      if (isCurrentPeriodRequest(periodId, initSequence)) {
        outsourcingList.value = [];
        needsOutsource.value = false;
        outsourcingLoadFailed.value = false;
        outsourcingLoadSucceeded.value = false;
        outsourcingLoading.value = false;
        persistedOutsourceSnapshot.value = '';
        emit('persisted-change', false);
      }
      return false;
    }
    outsourcingLoading.value = true;
    outsourcingLoadFailed.value = false;
    outsourcingLoadSucceeded.value = false;
    try {
      const result: any = await getPlanOutsources({ periodId, pageNo: 1, pageSize: 1000 });
      if (requestSequence !== outsourcingRequestSequence || !isCurrentPeriodRequest(periodId, initSequence)) return false;
      const records = Array.isArray(result) ? result : result?.records || [];
      outsourcingSeed = 0;
      outsourcingList.value = records.map((item: any) => ({
        ...item,
        _key: ++outsourcingSeed,
        unitId: item.unitId,
        unit: item.unitName,
        peopleNum: item.headcount,
        hours: item.workHours,
        contact: item.contactPerson,
        phone: item.contactPhone,
      }));
      needsOutsource.value = outsourcingList.value.length > 0;
      outsourcingLoadSucceeded.value = true;
      persistedOutsourceSnapshot.value = getOutsourceSnapshot();
      emit('persisted-change', outsourcingList.value.length > 0);
      return true;
    } catch (error: any) {
      if (requestSequence === outsourcingRequestSequence && isCurrentPeriodRequest(periodId, initSequence)) {
        outsourcingLoadFailed.value = true;
        outsourcingLoadSucceeded.value = false;
        createMessage.warning(error?.message || '外协配置加载失败，请刷新后重试');
      }
      return false;
    } finally {
      if (requestSequence === outsourcingRequestSequence && isCurrentPeriodRequest(periodId, initSequence)) outsourcingLoading.value = false;
    }
  }

  async function initializePeriod(value: unknown) {
    const initSequence = ++initializationSequence;
    const periodId = normalizePeriodId(value);
    personList.value = [];
    outsourcingList.value = [];
    needsOutsource.value = false;
    peopleLoading.value = false;
    peopleLoaded.value = false;
    outsourcingLoading.value = false;
    peopleLoadFailed.value = false;
    outsourcingLoadFailed.value = false;
    outsourcingLoadSucceeded.value = false;
    persistedOutsourceSnapshot.value = '';
    emit('persisted-change', false);
    if (!periodId) return;

    await Promise.all([
      loadPeople(periodId, initSequence),
      loadOutsources(periodId, initSequence),
      loadOutsourcingOptions(),
      loadMemberRoleOptions(),
    ]);
  }

  watch(
    () => props.periodId,
    (periodId) => void initializePeriod(periodId),
    { immediate: true }
  );

  async function openInviteModal() {
    inviteForm.roles = [];
    inviteForm.userId = undefined;
    inviteModalOpen.value = true;
    await Promise.all([loadMemberRoleOptions(), loadMemberUserOptions(true)]);
  }

  function getInviteStatusMeta(status: unknown) {
    const value = String(status ?? '');
    if (value === '0') return { text: '拒绝', color: 'error' };
    if (value === '1') return { text: '接受', color: 'success' };
    return { text: '待接受', color: 'processing' };
  }

  function canDeleteMember(record: any) {
    if (!canEditPersonPage.value || splitMemberRoles(record.role).some((role) => protectedRoleValues.has(role))) return false;
    return !!record.id;
  }

  function splitMemberRoles(value: unknown) {
    return String(value ?? '')
      .split(/[,，、]/)
      .map((role) => role.trim())
      .filter(Boolean);
  }

  function formatMemberRoles(value: unknown) {
    const roles = splitMemberRoles(value);
    return roles.length ? roles.map((role) => roleMeta.value[role] || role).join('、') : '—';
  }

  async function submitInvite() {
    if (!canEditPersonPage.value) return createMessage.warning('当前不可编辑，或项目成员仍在加载，请稍后重试');
    if (!props.periodId) return createMessage.warning('缺少项目分期 ID，无法发送邀请');
    const selectedRoles = [...new Set((inviteForm.roles || []).map(String))];
    if (!selectedRoles.length) return createMessage.warning('请至少选择一个成员角色');
    if (!inviteForm.userId) return createMessage.warning('请选择成员');
    if (selectedRoles.some((role) => protectedRoleValues.has(role))) return createMessage.warning('角色 0、1、2 不允许通过邀请添加');
    const existingRoles = new Set(
      personList.value
        .filter((item) => String(item.memberId) === String(inviteForm.userId))
        .flatMap((item) => splitMemberRoles(item.memberRole ?? item.role))
    );
    const rolesToInvite = selectedRoles.filter((role) => !existingRoles.has(role));
    if (!rolesToInvite.length) {
      createMessage.warning('该成员已拥有所选项目角色，请选择其他角色');
      return;
    }
    const selectedUser = userOptions.value.find((item) => String(item.value) === String(inviteForm.userId));
    if (!selectedUser) return createMessage.warning('未找到所选成员，请刷新用户列表后重试');
    if (inviteSubmitting.value) return;
    inviteSubmitting.value = true;
    try {
      await addPlanMembersBatch({
        periodId: props.periodId,
        records: [{ userId: inviteForm.userId, memberRole: rolesToInvite.join(',') }],
      });
      await loadPeople();
      emit('members-change');
      inviteModalOpen.value = false;
      if (rolesToInvite.length < selectedRoles.length) createMessage.info('已跳过该成员已有的角色，其余邀请已发送');
    } catch (error: any) {
      createMessage.warning(error?.message || '成员邀请发送失败，请重试');
    } finally {
      inviteSubmitting.value = false;
    }
  }

  async function deletePerson(record: any) {
    if (!canDeleteMember(record)) return createMessage.warning('当前成员不可删除');
    memberMutationSavingCount.value += 1;
    try {
      await deletePlanMembersBatch({ ids: String(record.id) });
      await loadPeople();
      emit('members-change');
    } catch (error: any) {
      createMessage.warning(error?.message || '成员删除失败，请重试');
    } finally {
      memberMutationSavingCount.value = Math.max(0, memberMutationSavingCount.value - 1);
    }
  }

  // 添加外协
  function addOutsourcing() {
    if (!canAddOutsourcing.value) {
      createMessage.info('所有可用外协单位均已添加');
      return;
    }
    outsourcingList.value.push({
      _key: ++outsourcingSeed,
      unitId: undefined,
      unit: '',
      peopleNum: undefined,
      hours: undefined,
      contact: '',
      phone: '',
    });
  }

  function handleOutsourcingUnitChange(record: any, unitId?: string) {
    const normalizedUnitId = String(unitId ?? '').trim();
    const duplicated =
      !!normalizedUnitId && outsourcingList.value.some((item) => item._key !== record._key && String(item.unitId ?? '').trim() === normalizedUnitId);
    if (duplicated) {
      record.unitId = undefined;
      record.unit = '';
      record.unitType = undefined;
      record.contact = '';
      record.phone = '';
      createMessage.warning('该外协单位已在其他行选择，请选择其他单位');
      return;
    }
    const selected = outsourcingOptions.value.find((item) => String(item.value) === normalizedUnitId);
    record.unit = selected?.label || '';
    record.unitType = selected?.unitType;
    record.contact = selected?.contactPerson || '';
    record.phone = selected?.contactPhone || '';
  }

  // 移除外协
  function removeOutsourcing(key: number) {
    outsourcingList.value = outsourcingList.value.filter((p) => p._key !== key);
  }

  function mapOutsourceRecords(rows: any[]) {
    return rows.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      unitType: item.unitType,
      unitId: item.unitId,
      unitName: item.unit,
      headcount: item.peopleNum,
      workHours: item.hours,
      contactPerson: item.contact,
      contactPhone: item.phone,
    }));
  }
</script>

<style lang="less" scoped>
  .plan-person {
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

    &__hint {
      margin-inline-start: 12px;
      color: #595959;
      font-size: 13px;
      font-weight: 400;
    }

    &__actions {
      display: flex;
      gap: 8px;
    }

    &__action-placeholder {
      color: #bfbfbf;
    }

    &__required {
      margin-left: 4px;
      color: @error-color;
    }

    &__outsource-switch {
      display: flex;
      align-items: center;
      min-height: 40px;
      margin-bottom: 12px;
      padding: 8px 12px;
      background: #fafafa;
      border-radius: 6px;
    }

    &__outsource-label {
      margin-inline-end: 20px;
      color: #262626;
      font-weight: 500;
    }
  }

  .member-invite-modal {
    &__intro {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: -4px 0 22px;
      padding: 16px 18px;
      color: #595959;
      background: #f5f8ff;
      border-radius: 10px;

      strong {
        color: #1f1f1f;
        font-size: 15px;
        line-height: 1.5;
      }

      span {
        font-size: 13px;
        line-height: 1.6;
      }
    }

    &__form {
      :deep(.ant-form-item) {
        margin-bottom: 20px;
      }

      :deep(.ant-form-item:last-child) {
        margin-bottom: 4px;
      }

      :deep(.ant-form-item-label > label) {
        color: #262626;
        font-weight: 600;
      }

      :deep(.ant-select-selector) {
        min-height: 40px !important;
        align-items: center;
        border-radius: 8px !important;
      }
    }
  }
</style>
