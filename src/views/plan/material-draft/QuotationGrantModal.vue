<template>
  <a-modal
    :open="open"
    title="报价单授权"
    width="min(920px, calc(100vw - 32px))"
    :footer="null"
    :mask-closable="!saving"
    :closable="!saving"
    @cancel="close"
  >
    <div class="quotation-grant">
      <div class="quotation-grant__context">
        <strong>{{ periodName || '当前分期' }}</strong>
        <span>授权范围：本分期的报价单</span>
      </div>
      <a-alert v-if="failed" type="error" :message="failed" show-icon>
        <template #action><a-button size="small" :disabled="saving" @click="loadGrants">重试</a-button></template>
      </a-alert>
      <div class="quotation-grant__workspace">
        <section ref="editorElement" class="quotation-grant__editor" aria-labelledby="grant-edit-heading">
          <h3 id="grant-edit-heading">{{ selectedGrant ? '编辑授权' : '新增授权' }}</h3>
          <a-form layout="vertical">
            <a-form-item label="授权用户" required>
              <a-select
                v-model:value="userId" show-search allow-clear placeholder="搜索姓名或账号"
                :options="selectionOptions" option-filter-prop="label" :loading="usersLoading"
                :disabled="loading || saving || !!failed" @dropdown-visible-change="openUsers" />
              <div v-if="usersError" role="alert">{{ usersError }} <a-button type="link" @click="loadUsers">重试</a-button></div>
            </a-form-item>
            <a-form-item label="授权权限" required>
              <div class="quotation-grant__permissions">
                <a-checkbox v-model:checked="canViewCost" :disabled="loading || saving || !!failed">查看成本价</a-checkbox>
                <a-checkbox v-model:checked="canViewQuote" :disabled="loading || saving || !!failed">查看指导价</a-checkbox>
                <a-checkbox v-model:checked="canRevise" :disabled="loading || saving || !!failed">合同签订</a-checkbox>
                <a-checkbox v-model:checked="canExport" :disabled="loading || saving || !!failed">导出</a-checkbox>
              </div>
            </a-form-item>
            <p class="quotation-grant__help">导出需同时勾选“查看指导价”。本页授权不授予报价审批或定价资格。</p>
          </a-form>
        </section>
        <section class="quotation-grant__members" aria-labelledby="grant-members-heading">
          <div class="quotation-grant__section-head"><h3 id="grant-members-heading">已授权人员</h3><span>{{ activeGrants.length }} 人</span></div>
          <a-spin :spinning="loading">
            <div v-if="activeGrants.length" class="quotation-grant__list">
              <article v-for="record in activeGrants" :key="record.userId" class="quotation-grant__person" :class="{ 'is-selected': String(record.userId) === userId }">
                <div class="quotation-grant__person-title"><strong>{{ record.userName || record.userId }}</strong>
                  <div class="quotation-grant__person-actions">
                    <a-button type="link" size="small" :disabled="saving || loading || !!failed" :aria-label="`编辑${record.userName || record.userId}的授权`" @click="editGrant(record)">编辑</a-button>
                    <a-popconfirm :title="`确认取消${record.userName || '该用户'}在本分期的报价授权？`" ok-text="取消授权" cancel-text="保留" :disabled="saving || loading || !!failed" @confirm="removeGrant(record)">
                      <a-button type="link" danger size="small" :disabled="saving || loading || !!failed">取消授权</a-button>
                    </a-popconfirm>
                  </div>
                </div>
                <div class="quotation-grant__tags"><a-tag v-for="permission in grantPermissions(record)" :key="permission">{{ permission }}</a-tag></div>
              </article>
            </div>
            <a-empty v-else :description="loading ? '正在加载授权…' : failed ? '授权暂不可用，请重试' : '暂无已授权人员'" />
          </a-spin>
        </section>
      </div>
      <div class="quotation-grant__footer">
        <span>权限按分期生效，具体操作仍受单据状态限制。</span>
        <div class="quotation-grant__save">
          <a-button :disabled="saving" @click="close">关闭</a-button>
          <a-button v-if="userId" :disabled="saving || loading" @click="userId = ''">取消选择</a-button>
          <a-button type="primary" preIcon="ant-design:check-outlined" :loading="saving" :disabled="loading || !!failed || !userId" @click="save">{{ selectedGrant ? '保存修改' : '添加授权' }}</a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getQuotationAccess, getQuotationGrants, saveQuotationGrant, getQuotationGrantUsers } from '../Plan.api';
  import { quotationVersion } from '../quotationGovernance';
  import { usePermission } from '/@/hooks/web/usePermission';
  const { hasPermission } = usePermission();
  const props = defineProps<{ open: boolean; periodId: string; periodName?: string }>();
  const emit = defineEmits(['update:open', 'success']);
  const { createMessage } = useMessage();
  const loading = ref(false),
    saving = ref(false),
    failed = ref(''),
    userId = ref('');
  const grants = ref<Recordable[]>([]);
  const version = ref(0);
  const canRevise = ref(false);
  const canExport = ref(false);
  const canViewCost = ref(false);
  const canViewQuote = ref(false);
  const activeGrants = computed(() => grants.value.filter(row => [row.canViewCost, row.canViewQuote, row.canViewRate, row.canEditPrice, row.canExport, row.canRevise].some(value => Number(value) === 1)));
  const userOptions = ref<{ label: string; value: string }[]>([]);
  const selectedGrant = computed(() => activeGrants.value.find(row => String(row.userId) === userId.value));
  const selectionOptions = computed(() => {
    const options = new Map(userOptions.value.map(row => [row.value, row]));
    grants.value.forEach(row => { if (!options.has(String(row.userId))) options.set(String(row.userId), { value: String(row.userId), label: row.userName || String(row.userId) }); });
    return [...options.values()];
  });
  const editorElement = ref<HTMLElement>();
  function editGrant(row: Recordable) {
    if (saving.value || loading.value || failed.value) return;
    userId.value = String(row.userId);
    editorElement.value?.scrollIntoView({ block: 'nearest' });
  }
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
    canRevise.value = Number(item?.canRevise) === 1;
    canExport.value = Number(item?.canExport) === 1;
    canViewCost.value = Number(item?.canViewCost) === 1;
    canViewQuote.value = Number(item?.canViewQuote) === 1;
  }
  watch(userId, applySelection);
  async function loadGrants() {
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
  }
  watch(() => [props.open, props.periodId], loadGrants, { immediate: true });
  async function save() {
    if (saving.value || loading.value || failed.value || !userId.value) return;
    const target = String(userId.value);
    if (target.includes(',')) return createMessage.warning('每次请选择一个用户');
    if (![canRevise.value, canExport.value, canViewCost.value, canViewQuote.value].some(Boolean)) return createMessage.warning('请至少选择一种权限；取消授权请删除已授权用户');
    if ((canRevise.value || canExport.value) && !canViewQuote.value) return createMessage.warning('修改或导出需要查看指导价，请先勾选“查看指导价”');
    await updateGrant(target, version.value, canRevise.value, canExport.value, canViewCost.value, canViewQuote.value);
  }
  function grantPermissions(record: Recordable) {
    return [Number(record.canViewCost) === 1 ? '查看成本' : '', Number(record.canViewQuote) === 1 ? '查看指导价' : '', Number(record.canRevise) === 1 ? '合同签订' : '', Number(record.canExport) === 1 ? '导出' : '', Number(record.canEditPrice) === 1 ? '历史价格修改授权' : '', Number(record.canViewRate) === 1 ? '历史比例授权' : ''].filter(Boolean);
  }
  async function removeGrant(row: Recordable) {
    if (saving.value || loading.value || failed.value) return;
    await updateGrant(String(row.userId), quotationVersion(row.version), false, false, false, false, true);
  }
  async function updateGrant(target: string, expectedVersion: number, canRevise: boolean, canExport: boolean, canViewCost: boolean, canViewQuote: boolean, revoke = false) {
    const payload = { periodId: props.periodId, userId: target, version: expectedVersion, canViewCost, canViewQuote, canRevise, canEditPrice: false, canExport,
      ...(revoke ? { canViewRate: false } : {}) };
    saving.value = true;
    try {
      if (!hasPermission('plan:quotation:grant') || !(await getQuotationAccess(props.periodId)).canManage) throw new Error('当前无报价授权管理权限');
      // grant 版本独立于报价版本；新用户只在完整授权列表中确认不存在后使用 0。
      const latest = await getQuotationGrants(props.periodId);
      if (!Array.isArray(latest)) throw new Error('授权列表加载失败');
      const current = latest.find((row) => String(row.userId) === target);
      if ((current ? quotationVersion(current.version) : 0) !== payload.version) throw new Error('授权已变化，请关闭后重新打开核对');
      // 兼容接口必填的独立价格权限；普通授权保留，仅删除用户授权时清除。
      payload.canEditPrice = !revoke && Number(current?.canEditPrice) === 1;
      await saveQuotationGrant(payload);
      createMessage.success(revoke ? '已删除授权' : '报价授权已保存');
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
<style scoped lang="less">
  .quotation-grant {
    max-height: calc(100dvh - 160px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    h3 { margin: 0 0 20px; font-size: 15px; font-weight: 600; }
    &__context { display: flex; flex: 0 0 auto; flex-direction: column; gap: 6px; padding-bottom: 20px; overflow-wrap: anywhere; }
    &__context strong { font-size: 16px; }
    &__context span, &__help, &__footer, &__section-head > span { color: @text-color-secondary; font-size: 13px; line-height: 1.6; }
    &__workspace { display: grid; min-height: 0; overflow-y: auto; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); border-top: 1px solid @border-color-base; }
    &__editor { padding: 24px 24px 24px 0; }
    &__members { min-width: 0; padding: 24px 0 24px 24px; border-left: 1px solid @border-color-base; }
    &__permissions { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 8px; }
    &__permissions :deep(.ant-checkbox-wrapper) { margin: 0; }
    &__save { display: flex; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    &__section-head { display: flex; justify-content: space-between; gap: 12px; }
    &__list { max-height: 340px; overflow-y: auto; }
    &__person { padding: 14px 12px; border-bottom: 1px solid @border-color-base; }
    &__person:first-child { padding-top: 4px; }
    &__person.is-selected { background: @item-active-bg; }
    &__person-title { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    &__person-title strong { min-width: 0; overflow-wrap: anywhere; }
    &__person-actions { display: flex; flex-shrink: 0; }
    &__tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    &__tags :deep(.ant-tag) { margin: 0; white-space: normal; }
    &__footer { display: flex; flex: 0 0 auto; justify-content: space-between; align-items: center; gap: 16px; border-top: 1px solid @border-color-base; padding-top: 16px; }
    @media (max-width: 640px) {
      &__workspace { grid-template-columns: 1fr; }
      &__editor { padding: 20px 0; }
      &__members { padding: 20px 0; border-left: 0; border-top: 1px solid @border-color-base; }
      &__person-title { flex-wrap: wrap; }
      &__footer { flex-direction: column; align-items: stretch; gap: 8px; }
    }
  }
</style>
