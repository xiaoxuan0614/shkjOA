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
          <a-button size="small" preIcon="ant-design:reload-outlined" @click="loadPeople">刷新状态</a-button>
          <a-button v-if="editable" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="openInviteModal">添加成员</a-button>
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
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'role'">
            <a-tag color="blue">{{ roleMeta[String(record.role)] || record.role || '—' }}</a-tag>
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
        <a-button v-if="canEditOutsource" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addOutsourcing">添加</a-button>
      </div>
      <a-table
        :loading="outsourcingLoading"
        :columns="outsourcingColumns"
        :data-source="outsourcingList"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'unit'">
            <a-select
              v-model:value="record.unitId"
              showSearch
              allowClear
              :disabled="!canEditOutsource"
              placeholder="请选择外协单位"
              style="width: 100%"
              :options="outsourcingOptions"
              @change="(value: string) => handleOutsourcingUnitChange(record, value)"
              :filter-option="(input: string, option: any) => (option?.label || '').toLowerCase().includes(input.toLowerCase())"
            />
          </template>
          <template v-else-if="column.key === 'peopleNum'">
            <a-input-number v-model:value="record.peopleNum" :min="0" placeholder="人数" style="width: 100%" :disabled="!canEditOutsource" />
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
  import { ref, reactive, computed, unref, onMounted, watch } from 'vue';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import { loadDictOptions } from '../Project.data';
  import { ajaxGetDictItems } from '/@/utils/dict';
  import { addPlanMembersBatch, deletePlanMembersBatch, getOutsourcingUnits, getPlanMembers, getPlanOutsources } from './Plan.api';
  import { useMessage } from '/@/hooks/web/useMessage';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑; periodId 用于查询项目成员。
  const props = defineProps<{
    editable?: boolean;
    outsourceEditable?: boolean;
    periodId?: string;
  }>();

  onMounted(async () => {
    await Promise.all([loadOutsourcingOptions(), loadMemberRoleOptions()]);
    await loadOutsources();
  });

  async function loadOutsourcingOptions() {
    try {
      const res: any = await getOutsourcingUnits({ status: 0, pageNo: 1, pageSize: 1000 });
      const records = res?.records || res || [];
      outsourcingOptions.value = (records || []).map((item: any) => ({
        label: item.unitName,
        value: item.id,
        unitType: item.unitType,
        contactPerson: item.contactPerson,
        contactPhone: item.contactPhone,
      }));
    } catch (error: any) {
      outsourcingOptions.value = [];
      createMessage.warning(error?.message || '外协单位列表加载失败，请刷新后重试');
    }
  }

  // 成员用户下拉
  const userOptions = ref<{ label: string; value: string }[]>([]);
  const userOptionsLoading = ref(false);

  // 列表回显使用 member_role 完整字典，邀请下拉过滤系统角色 0/1/2。
  const roleOptions = ref<{ label: string; value: string }[]>([]);
  const roleMeta = ref<Recordable>({});
  const roleOptionsLoading = ref(false);
  const protectedRoleValues = new Set(['0', '1', '2']);
  const inviteRoleOptions = computed(() => roleOptions.value.filter((item) => !protectedRoleValues.has(String(item.value))));

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

  async function loadMemberRoleOptions() {
    if (roleOptionsLoading.value) return;
    roleOptionsLoading.value = true;
    try {
      // 直接读取实时字典，避免登录时缓存了空的 member_role 后一直不再请求后端。
      const liveItems = normalizeRoleOptions(await ajaxGetDictItems('member_role', undefined, { joinTime: false }));
      roleOptions.value = liveItems.length ? liveItems : await loadDictOptions('member_role');
      roleMeta.value = Object.fromEntries(roleOptions.value.map((item) => [String(item.value), item.label]));
      if (!roleOptions.value.length) createMessage.warning('member_role 字典暂无数据，请检查字典配置');
      else if (!inviteRoleOptions.value.length) createMessage.warning('member_role 字典中没有 0、1、2 以外的可邀请角色');
    } catch {
      roleOptions.value = [];
      roleMeta.value = {};
      createMessage.warning('成员角色加载失败，请检查 member_role 字典后重试');
    } finally {
      roleOptionsLoading.value = false;
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
  let personSeed = 0;

  const inviteModalOpen = ref(false);
  const inviteForm = reactive<{ roles?: string[]; userId?: string }>({});
  const inviteSubmitting = ref(false);

  // 外协配置
  const outsourcingColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '外协单位', key: 'unit' },
    { title: '人数', key: 'peopleNum', width: 100 },
    { title: '工时', key: 'hours', width: 100 },
    { title: '联系人', key: 'contact', width: 120 },
    { title: '联系方式', key: 'phone', width: 140 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const outsourcingList = ref<any[]>([]);
  const outsourcingOptions = ref<any[]>([]);
  const outsourcingLoading = ref(false);
  const canEditOutsource = computed(() => !!props.outsourceEditable);
  let outsourcingSeed = 0;

  function getMemberData() {
    return { personList: unref(personList) };
  }

  function getOutsourceData() {
    const invalidOutsource = outsourcingList.value.find((item) => !item.unitId);
    if (invalidOutsource) throw new Error('请选择外协单位');
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
    setData(data: any) {
      personList.value = (data?.personList || []).map((item) => ({
        ...item,
        _key: ++personSeed,
        memberId: item.memberId,
        memberName: item.memberName || item.member || '',
      }));
      outsourcingList.value = (data?.outsourcingList || []).map((item) => ({ ...item, _key: ++outsourcingSeed }));
    },
    reloadPeople: loadPeople,
    reloadOutsources: loadOutsources,
    reload: () => Promise.all([loadPeople(), loadOutsourcingOptions(), loadOutsources()]),
  });

  async function loadPeople() {
    if (!props.periodId) {
      personList.value = [];
      return;
    }
    peopleLoading.value = true;
    try {
      const result: any = await getPlanMembers({ periodId: props.periodId, pageNo: 1, pageSize: 1000 });
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
    } catch (error: any) {
      personList.value = [];
      createMessage.warning(error?.message || '项目成员加载失败，请刷新后重试');
    } finally {
      peopleLoading.value = false;
    }
  }

  watch(() => props.periodId, loadPeople, { immediate: true });

  async function loadOutsources() {
    if (!props.periodId) {
      outsourcingList.value = [];
      return;
    }
    outsourcingLoading.value = true;
    try {
      const result: any = await getPlanOutsources({ periodId: props.periodId, pageNo: 1, pageSize: 1000 });
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
    } catch (error: any) {
      outsourcingList.value = [];
      createMessage.warning(error?.message || '外协配置加载失败，请刷新后重试');
    } finally {
      outsourcingLoading.value = false;
    }
  }

  watch(
    () => props.periodId,
    () => Promise.all([loadOutsourcingOptions(), loadOutsources()])
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
    if (!props.editable || protectedRoleValues.has(String(record.role))) return false;
    return !!record.id;
  }

  async function submitInvite() {
    if (!props.periodId) return createMessage.warning('缺少项目分期 ID，无法发送邀请');
    const selectedRoles = [...new Set((inviteForm.roles || []).map(String))];
    if (!selectedRoles.length) return createMessage.warning('请至少选择一个成员角色');
    if (!inviteForm.userId) return createMessage.warning('请选择成员');
    if (selectedRoles.some((role) => protectedRoleValues.has(role))) return createMessage.warning('角色 0、1、2 不允许通过邀请添加');
    const existingRoles = new Set(
      personList.value.filter((item) => String(item.memberId) === String(inviteForm.userId)).map((item) => String(item.memberRole ?? item.role))
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
        records: rolesToInvite.map((memberRole) => ({ userId: inviteForm.userId, memberRole })),
      });
      await loadPeople();
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
    try {
      await deletePlanMembersBatch({ ids: String(record.id) });
      await loadPeople();
    } catch (error: any) {
      createMessage.warning(error?.message || '成员删除失败，请重试');
    }
  }

  // 添加外协
  function addOutsourcing() {
    outsourcingList.value.push({ _key: ++outsourcingSeed, unitId: undefined, unit: '', peopleNum: 0, hours: 0, contact: '', phone: '' });
  }

  function handleOutsourcingUnitChange(record: any, unitId: string) {
    const selected = outsourcingOptions.value.find((item) => String(item.value) === String(unitId));
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
