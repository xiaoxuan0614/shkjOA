<template>
  <a-modal
    :open="open"
    title="本分期报价授权"
    :width="600"
    :footer="null"
    :mask-closable="!saving"
    :closable="!saving"
    @cancel="close"
  >
    <a-alert v-if="failed" type="error" :message="failed" show-icon />
    <a-form layout="vertical" style="margin-top: 16px">
      <a-form-item label="授权用户" required>
        <div class="authorize-row">
          <a-select
          v-model:value="userId" show-search allow-clear placeholder="搜索姓名或账号选择用户"
          :options="userOptions" option-filter-prop="label" :loading="usersLoading"
          :disabled="loading || saving || !!failed" class="authorize-select" @dropdown-visible-change="openUsers" />
          <a-button type="primary" :loading="saving" :disabled="loading || !!failed || !userId" @click="save">授权</a-button>
        </div>
        <div v-if="usersError" role="alert">{{ usersError }} <a-button type="link" @click="loadUsers">重试</a-button></div>
      </a-form-item>
      <a-form-item label="授权权限" required>
        <a-checkbox v-model:checked="canEditPrice" :disabled="loading || saving || !!failed">修改</a-checkbox>
        <a-checkbox v-model:checked="canExport" :disabled="loading || saving || !!failed">导出</a-checkbox>
      </a-form-item>
    </a-form>
    <a-form layout="vertical">
      <a-form-item label="已授权用户">
        <a-select mode="multiple" :value="activeGrants.map(record => String(record.userId))" :open="false" :show-search="false"
          :disabled="saving || loading || !!failed" :loading="loading" placeholder="暂无已授权用户" style="width: 100%">
          <template #tagRender="{ value }">
            <a-tag :closable="!saving && !loading && !failed" @close="event => removeSelectedGrant(event, String(value))">
              {{ grantLabel(String(value)) }}
            </a-tag>
          </template>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getQuotationAccess, getQuotationGrants, saveQuotationGrant, getQuotationGrantUsers } from '../Plan.api';
  import { quotationVersion } from '../quotationGovernance';
  import { usePermission } from '/@/hooks/web/usePermission';
  const { hasPermission } = usePermission();
  const props = defineProps<{ open: boolean; periodId: string }>();
  const emit = defineEmits(['update:open', 'success']);
  const { createMessage } = useMessage();
  const loading = ref(false),
    saving = ref(false),
    failed = ref(''),
    userId = ref('');
  const grants = ref<Recordable[]>([]);
  const version = ref(0);
  const canEditPrice = ref(false);
  const canExport = ref(false);
  const activeGrants = computed(() => grants.value.filter(row => [row.canViewPrice, row.canEditPrice, row.canExport].some(value => Number(value) === 1)));
  const userOptions = ref<{ label: string; value: string }[]>([]);
  const usersLoading = ref(false);
  const usersError = ref('');
  let usersSequence = 0;
  function openUsers(open: boolean) {
    if (open && !userOptions.value.length) void loadUsers();
  }
  async function loadUsers() {
    if (usersLoading.value) return;
    const request = ++usersSequence;
    usersLoading.value = true;
    usersError.value = '';
    const options = new Map<string, { label: string; value: string }>();
    try {
      let received = 0;
      for (let page = 1; ; page++) {
        const data = await getQuotationGrantUsers(page);
        if (request !== usersSequence) return;
        const rows = data == null ? [] : data.records;
        if (!Array.isArray(rows)) throw new Error('用户列表格式异常');
        const previous = options.size;
        rows.forEach(row => {
          if (row.id) options.set(String(row.id), { value: String(row.id), label: [row.realname, row.username].filter(Boolean).join('（') + (row.realname && row.username ? '）' : '') });
        });
        received += rows.length;
        if (!rows.length || (data.total != null ? received >= Number(data.total) : rows.length < 100)) break;
        if (options.size === previous) throw new Error('用户分页未前进');
      }
      userOptions.value = [...options.values()];
    } catch {
      if (request === usersSequence) usersError.value = '用户加载失败，请重试';
    } finally {
      if (request === usersSequence) usersLoading.value = false;
    }
  }
  let sequence = 0;
  function close() {
    if (!saving.value) emit('update:open', false);
  }
  function applySelection() {
    const item = grants.value.find((row) => String(row.userId) === String(userId.value));
    version.value = item ? quotationVersion(item.version) : 0;
    canEditPrice.value = Number(item?.canEditPrice) === 1;
    canExport.value = Number(item?.canExport) === 1;
  }
  watch(userId, applySelection);
  watch(
    () => [props.open, props.periodId],
    async () => {
      const request = ++sequence;
      usersSequence++;
      usersLoading.value = false;
      userOptions.value = [];
      if (!props.open) return;
      loading.value = true;
      failed.value = '';
      userId.value = '';
      grants.value = [];
      applySelection();
      try {
        const access = await getQuotationAccess(props.periodId);
        if (!access.canManage || !hasPermission('plan:quotation:grant')) throw new Error('当前无报价授权管理权限');
        if (request !== sequence) return;
        void loadUsers();
        const rows = await getQuotationGrants(props.periodId);
        if (!Array.isArray(rows)) throw new Error('授权列表格式不正确');
        rows.forEach((row) => quotationVersion(row.version));
        if (request === sequence) grants.value = rows;
      } catch (e: any) {
        if (request === sequence) failed.value = e?.message || '授权加载失败';
      } finally {
        if (request === sequence) loading.value = false;
      }
    },
    { immediate: true }
  );
  async function save() {
    if (saving.value || loading.value || failed.value || !userId.value) return;
    const target = String(userId.value);
    if (target.includes(',')) return createMessage.warning('每次请选择一个用户');
    if (!canEditPrice.value && !canExport.value) return createMessage.warning('请至少选择一种权限；取消授权请删除已授权用户');
    await updateGrant(target, version.value, canEditPrice.value, canExport.value);
  }
  function grantLabel(id: string) {
    const record = grants.value.find(row => String(row.userId) === id);
    if (!record) return id;
    const permissions = [Number(record.canEditPrice) === 1 ? '修改' : '', Number(record.canExport) === 1 ? '导出' : '', Number(record.canViewPrice) === 1 && Number(record.canEditPrice) !== 1 ? '查看' : ''].filter(Boolean);
    return `${record.userName || record.userId}（${permissions.join('、')}）`;
  }
  function removeSelectedGrant(event: Event, id: string) {
    event.preventDefault();
    const record = grants.value.find(row => String(row.userId) === id);
    if (record) void removeGrant(record);
  }
  async function removeGrant(row: Recordable) {
    if (saving.value || loading.value || failed.value) return;
    await updateGrant(String(row.userId), quotationVersion(row.version), false, false);
  }
  async function updateGrant(target: string, expectedVersion: number, canEditPrice: boolean, canExport: boolean) {
    const payload = { periodId: props.periodId, userId: target, version: expectedVersion, canViewPrice: canEditPrice, canEditPrice, canExport };
    saving.value = true;
    try {
      if (!hasPermission('plan:quotation:grant') || !(await getQuotationAccess(props.periodId)).canManage) throw new Error('当前无报价授权管理权限');
      // grant 版本独立于报价版本；新用户只在完整授权列表中确认不存在后使用 0。
      const latest = await getQuotationGrants(props.periodId);
      if (!Array.isArray(latest)) throw new Error('授权列表加载失败');
      const current = latest.find((row) => String(row.userId) === target);
      if ((current ? quotationVersion(current.version) : 0) !== payload.version) throw new Error('授权已变化，请关闭后重新打开核对');
      await saveQuotationGrant(payload);
      createMessage.success(canEditPrice || canExport ? '报价授权已保存' : '已删除授权');
      userId.value = '';
      emit('success');
      try {
        const refreshed = await getQuotationGrants(props.periodId);
        if (!Array.isArray(refreshed)) throw new Error('授权列表格式不正确');
        refreshed.forEach(row => quotationVersion(row.version));
        grants.value = refreshed;
      } catch {
        failed.value = '操作已成功，但列表刷新失败，请关闭后重新打开核对';
      }
    } catch (e: any) {
      createMessage.error(e?.message || '授权保存失败');
    } finally {
      saving.value = false;
    }
  }
</script>
<style scoped>
  .authorize-row { display: flex; align-items: center; gap: 8px; }
  .authorize-select { flex: 1; min-width: 0; }
  .authorize-row > .ant-btn { flex-shrink: 0; }
  .authorized-users { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; max-height: 240px; overflow: auto; }
  .authorized-users :deep(.ant-tag) { margin: 0; white-space: normal; overflow-wrap: anywhere; }
  .remove-user { border: 0; background: transparent; color: inherit; cursor: pointer; margin-left: 4px; padding: 0 4px; }
  .remove-user:disabled { cursor: not-allowed; opacity: .45; }
</style>
