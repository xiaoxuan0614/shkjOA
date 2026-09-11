<template>
  <div class="detail-member">
    <section class="detail-member__group" aria-labelledby="project-participant-title">
      <div class="detail-member__group-header">
        <div>
          <h3 id="project-participant-title" class="detail-member__title">参与人员</h3>
          <div class="detail-member__hint">项目内部参与成员及其承担的项目角色</div>
        </div>
        <a-space class="detail-member__actions" wrap>
          <a-tag color="blue">{{ members.length }} 人</a-tag>
          <a-button pre-icon="ant-design:reload-outlined" :loading="memberLoading" @click="loadMembers">刷新成员</a-button>
          <a-button type="primary" pre-icon="ant-design:user-add-outlined" @click="openInviteModal">邀请项目成员</a-button>
        </a-space>
      </div>

      <a-alert v-if="memberLoadFailed" message="参与人员加载失败" type="warning" show-icon>
        <template #action>
          <a-button size="small" @click="loadMembers">重新加载</a-button>
        </template>
      </a-alert>
      <a-table
        v-else
        :loading="memberLoading"
        :columns="memberColumns"
        :data-source="members"
        :row-key="(record) => record._key"
        :pagination="false"
        :locale="{ emptyText: '暂无参与人员' }"
        :scroll="{ x: 660 }"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">{{ record._index }}</template>
          <template v-else-if="column.key === 'memberRole'">
            <a-tag v-for="role in record.memberRoles" :key="role" color="blue">
              {{ memberRoleText(role) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'inviteStatus'">
            <a-tag v-for="status in record.inviteStatuses" :key="status" :color="inviteStatusMeta(status).color">
              {{ inviteStatusMeta(status).text }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </section>

    <section class="detail-member__group" aria-labelledby="project-outsource-title">
      <div class="detail-member__group-header">
        <div>
          <h3 id="project-outsource-title" class="detail-member__title">外协人员</h3>
          <div class="detail-member__hint">按外协单位展示人员数量、工时及联系人</div>
        </div>
        <a-tag>{{ outsources.length }} 条</a-tag>
      </div>

      <a-alert v-if="outsourceLoadFailed" message="外协人员加载失败" type="warning" show-icon>
        <template #action>
          <a-button size="small" @click="loadOutsources">重新加载</a-button>
        </template>
      </a-alert>
      <a-table
        v-else
        :loading="outsourceLoading"
        :columns="outsourceColumns"
        :data-source="outsources"
        :row-key="(record) => record._key"
        :pagination="false"
        :locale="{ emptyText: '暂无外协人员' }"
        :scroll="{ x: 900 }"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">{{ record._index }}</template>
          <template v-else-if="column.key === 'unitType'">{{ outsourceTypeText(record.unitType) }}</template>
          <template v-else-if="column.key === 'headcount'">{{ valueWithUnit(record.headcount, '人') }}</template>
          <template v-else-if="column.key === 'workHours'">{{ valueWithUnit(record.workHours, '小时') }}</template>
          <template v-else-if="column.key === 'text'">{{ record[column.dataIndex] || '—' }}</template>
        </template>
      </a-table>
    </section>

    <a-modal
      v-model:open="inviteModalOpen"
      class="detail-member__invite-modal"
      title="邀请项目成员"
      :width="520"
      ok-text="提交邀请"
      cancel-text="取消"
      :confirm-loading="inviteSubmitting"
      centered
      destroy-on-close
      @ok="submitInvite"
    >
      <div class="detail-member__invite-intro">
        <strong>选择成员及项目角色</strong>
        <span>一个成员可同时承担多个角色；已有角色不会重复邀请。</span>
      </div>
      <a-form layout="vertical">
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
  import { computed, reactive, ref, watch } from 'vue';
  import { loadUserOptions, type UserOption } from '/@/views/resource/userOptions';
  import { ajaxGetDictItems } from '/@/utils/dict';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getMemberOutsources, getMembers, inviteProjectMembers } from '../ProjectDetail.api';
  import { loadDictOptions } from '../../Project.data';

  const { createMessage } = useMessage();

  const props = defineProps<{
    projectId: string;
  }>();

  const members = ref<any[]>([]);
  const outsources = ref<any[]>([]);
  const roleOptions = ref<{ label: string; value: string }[]>([]);
  const userOptions = ref<UserOption[]>([]);
  const memberRoleMap = ref<Record<string, string>>({});
  const outsourceTypeMap = ref<Record<string, string>>({});
  const memberLoading = ref(false);
  const outsourceLoading = ref(false);
  const roleOptionsLoading = ref(false);
  const userOptionsLoading = ref(false);
  const memberLoadFailed = ref(false);
  const outsourceLoadFailed = ref(false);
  const inviteModalOpen = ref(false);
  const inviteSubmitting = ref(false);
  const inviteForm = reactive<{ roles: string[]; userId?: string }>({ roles: [] });
  const protectedRoleValues = new Set(['0', '1', '2']);
  const inviteRoleOptions = computed(() => roleOptions.value.filter((item) => !protectedRoleValues.has(String(item.value))));

  const memberColumns = [
    { title: '序号', key: 'index', width: 70 },
    { title: '成员名称', dataIndex: 'userName', width: 180 },
    { title: '成员角色', dataIndex: 'memberRole', key: 'memberRole', width: 260 },
    { title: '邀请状态', dataIndex: 'inviteStatus', key: 'inviteStatus', width: 150 },
  ];

  const outsourceColumns = [
    { title: '序号', key: 'index', width: 70 },
    { title: '外协单位', dataIndex: 'unitName', key: 'text', width: 210 },
    { title: '单位类型', dataIndex: 'unitType', key: 'unitType', width: 110 },
    { title: '人数', dataIndex: 'headcount', key: 'headcount', width: 100 },
    { title: '工时', dataIndex: 'workHours', key: 'workHours', width: 120 },
    { title: '联系人', dataIndex: 'contactPerson', key: 'text', width: 140 },
    { title: '联系电话', dataIndex: 'contactPhone', key: 'text', width: 150 },
  ];

  async function loadMembers(): Promise<boolean> {
    if (!props.projectId) {
      members.value = [];
      return false;
    }
    memberLoading.value = true;
    memberLoadFailed.value = false;
    try {
      const [memberResult, roleResult] = await Promise.allSettled([
        getMembers({ periodId: props.projectId, pageNo: 1, pageSize: 1000 }),
        loadDictOptions('member_role'),
      ]);
      if (memberResult.status === 'rejected') throw memberResult.reason;
      const payload: any = memberResult.value;
      const records = Array.isArray(payload) ? payload : payload?.records || [];
      members.value = mergeMembers(records);
      roleOptions.value = roleResult.status === 'fulfilled' ? roleResult.value : [];
      syncMemberRoleMap();
      return true;
    } catch {
      members.value = [];
      memberLoadFailed.value = true;
      return false;
    } finally {
      memberLoading.value = false;
    }
  }

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

  function syncMemberRoleMap() {
    memberRoleMap.value = Object.fromEntries(roleOptions.value.map((item) => [String(item.value), item.label]));
  }

  async function loadMemberRoleOptions() {
    if (roleOptionsLoading.value) return;
    roleOptionsLoading.value = true;
    try {
      const liveItems = normalizeRoleOptions(await ajaxGetDictItems('member_role', undefined, { joinTime: false }));
      roleOptions.value = liveItems.length ? liveItems : await loadDictOptions('member_role');
      syncMemberRoleMap();
      if (!roleOptions.value.length) createMessage.warning('member_role 字典暂无数据，请检查字典配置');
      else if (!inviteRoleOptions.value.length) createMessage.warning('member_role 字典中没有可邀请的项目角色');
    } catch {
      roleOptions.value = [];
      syncMemberRoleMap();
      createMessage.warning('成员角色加载失败，请重试');
    } finally {
      roleOptionsLoading.value = false;
    }
  }

  async function loadMemberUserOptions() {
    if (userOptionsLoading.value) return;
    userOptionsLoading.value = true;
    try {
      userOptions.value = await loadUserOptions(true);
      if (!userOptions.value.length) createMessage.warning('系统用户列表暂无可邀请成员');
    } catch {
      userOptions.value = [];
      createMessage.warning('系统用户列表加载失败，请重试');
    } finally {
      userOptionsLoading.value = false;
    }
  }

  async function openInviteModal() {
    inviteForm.roles = [];
    inviteForm.userId = undefined;
    inviteModalOpen.value = true;
    await Promise.all([loadMemberRoleOptions(), loadMemberUserOptions()]);
  }

  async function submitInvite() {
    if (!props.projectId) return createMessage.warning('缺少项目分期 ID，无法发送邀请');
    const selectedRoles = [...new Set(inviteForm.roles.map(String))];
    if (!selectedRoles.length) return createMessage.warning('请至少选择一个成员角色');
    if (!inviteForm.userId) return createMessage.warning('请选择成员');
    if (selectedRoles.some((role) => protectedRoleValues.has(role))) return createMessage.warning('该角色不允许通过邀请添加');

    const existingMember = members.value.find((item) => String(item.userId) === String(inviteForm.userId));
    const existingRoles = new Set((existingMember?.memberRoles || []).map(String));
    const rolesToInvite = selectedRoles.filter((role) => !existingRoles.has(role));
    if (!rolesToInvite.length) return createMessage.warning('该成员已拥有所选项目角色，请选择其他角色');
    if (!userOptions.value.some((item) => String(item.value) === String(inviteForm.userId))) {
      return createMessage.warning('未找到所选成员，请刷新用户列表后重试');
    }
    if (inviteSubmitting.value) return;

    inviteSubmitting.value = true;
    try {
      await inviteProjectMembers({
        periodId: props.projectId,
        records: [{ userId: inviteForm.userId, memberRole: rolesToInvite.join(',') }],
      });
      inviteModalOpen.value = false;
      const refreshed = await loadMembers();
      if (!refreshed) createMessage.warning('邀请已发送，但成员列表刷新失败，请点击“刷新成员”重试');
      else if (rolesToInvite.length < selectedRoles.length) createMessage.info('已跳过该成员已有角色，其余邀请已发送，成员列表已刷新');
      else createMessage.success('邀请已发送，成员列表已刷新');
    } catch (error: any) {
      createMessage.warning(error?.message || '成员邀请发送失败，请重试');
    } finally {
      inviteSubmitting.value = false;
    }
  }

  async function loadOutsources() {
    if (!props.projectId) {
      outsources.value = [];
      return;
    }
    outsourceLoading.value = true;
    outsourceLoadFailed.value = false;
    try {
      const [outsourceResult, typeResult] = await Promise.allSettled([
        getMemberOutsources({ periodId: props.projectId, pageNo: 1, pageSize: 1000 }),
        loadDictOptions('outsourcing_type'),
      ]);
      if (outsourceResult.status === 'rejected') throw outsourceResult.reason;
      const payload: any = outsourceResult.value;
      const records = Array.isArray(payload) ? payload : payload?.records || [];
      outsources.value = records.map((item: any, index: number) => ({
        ...item,
        _key: item.id || item.unitId || index,
        _index: index + 1,
        unitName: item.unitName || item.unit,
        headcount: item.headcount ?? item.peopleNum,
        workHours: item.workHours ?? item.hours,
        contactPerson: item.contactPerson || item.contact,
        contactPhone: item.contactPhone || item.phone,
      }));
      const typeOptions = typeResult.status === 'fulfilled' ? typeResult.value : [];
      outsourceTypeMap.value = Object.fromEntries(typeOptions.map((item: any) => [String(item.value), item.label]));
    } catch {
      outsources.value = [];
      outsourceLoadFailed.value = true;
    } finally {
      outsourceLoading.value = false;
    }
  }

  function memberRoleText(value: unknown) {
    const code = String(value ?? '').trim();
    return memberRoleMap.value[code] || code || '—';
  }

  function inviteStatusMeta(status: unknown) {
    const value = String(status ?? '2');
    if (value === '0') return { text: '拒绝', color: 'error' };
    if (value === '1') return { text: '接受', color: 'success' };
    return { text: '待接受', color: 'processing' };
  }

  function outsourceTypeText(value: unknown) {
    if (value == null || value === '') return '—';
    const fallback: Record<string, string> = { '0': '个人', '1': '企业' };
    return outsourceTypeMap.value[String(value)] || fallback[String(value)] || String(value);
  }

  function valueWithUnit(value: unknown, unit: string) {
    return value == null || value === '' ? '—' : `${value} ${unit}`;
  }

  function splitValues(value: unknown) {
    return String(value ?? '')
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function mergeMembers(records: any[]) {
    const grouped = new Map<string, any>();
    records.forEach((item, index) => {
      const key = String(item.userId || item.userName || item.id || index);
      const current = grouped.get(key) || {
        ...item,
        _key: key,
        memberRoles: [],
        inviteStatuses: [],
      };
      current.memberRoles = Array.from(new Set([...current.memberRoles, ...splitValues(item.memberRole)]));
      current.inviteStatuses = Array.from(new Set([...current.inviteStatuses, ...splitValues(item.inviteStatus ?? '2')]));
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).map((item, index) => ({ ...item, _index: index + 1 }));
  }

  watch(
    () => props.projectId,
    () => Promise.allSettled([loadMembers(), loadOutsources()]),
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .detail-member {
    &__group + &__group {
      margin-top: 24px;
    }

    &__group-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
    }

    &__title {
      margin: 0;
      color: @text-color;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.5;
    }

    &__hint {
      margin-top: 2px;
      color: @text-color-secondary;
      font-size: 13px;
      line-height: 1.5;
    }

    &__actions {
      justify-content: flex-end;
    }

    &__invite-intro {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 18px;
      padding: 12px 14px;
      color: @text-color-secondary;
      background: @background-color-light;
      border-radius: 6px;

      strong {
        color: @text-color;
      }
    }
  }

  @media (max-width: 576px) {
    .detail-member__group-header {
      flex-direction: column;
    }

    .detail-member__actions {
      justify-content: flex-start;
    }
  }
</style>
