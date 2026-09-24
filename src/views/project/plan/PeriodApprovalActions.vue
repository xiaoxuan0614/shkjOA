<template>
  <div class="period-approval-actions">
    <a-button :loading="loading" :disabled="busy" @click="openHistory">审批记录</a-button>
    <a-button v-if="error" danger :disabled="busy" @click="refresh">审批信息加载失败，重试</a-button>
    <a-button v-if="canSubmit" type="primary" :disabled="disabled || loading || busy" @click="openAction('submit')">
      {{ state.legacy ? '重新提交审批' : '提交审批' }}
    </a-button>
    <template v-if="canApprove">
      <a-button danger :disabled="loading || busy" @click="openAction('reject')">驳回</a-button>
      <a-button type="primary" :disabled="loading || busy" @click="openAction('approve')">通过</a-button>
    </template>
    <a-button v-if="canWithdraw" :disabled="loading || busy" @click="openAction('withdraw')">撤回审批</a-button>
    <span v-if="!hideHint && hint" class="period-approval-actions__hint">{{ hint }}</span>
    <a-modal
      v-model:open="confirmOpen" :title="actionTitle" :ok-text="actionTitle" cancel-text="取消"
      :confirm-loading="busy" :mask-closable="false" :closable="!busy" :cancel-button-props="{ disabled: busy }" @ok="execute">
      <a-alert v-if="action === 'approve'" type="info" show-icon message="通过后项目进入筹备中，不会直接开始实施。" />
      <a-alert v-if="action === 'submit'" type="info" show-icon message="提交后计划资料锁定；需要修改时请先撤回。" />
      <a-alert v-if="action === 'withdraw'" type="warning" show-icon message="撤回后回到未开始，修改完成后需重新提交审批。" />
      <a-form v-if="action !== 'submit'" layout="vertical" class="period-approval-actions__reason">
        <a-form-item :label="action === 'withdraw' ? '撤回原因' : action === 'reject' ? '驳回原因' : '审批说明'" :required="action === 'reject'">
          <a-textarea v-model:value="reason" :rows="4" :maxlength="2000" show-count :disabled="busy" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-drawer v-model:open="historyOpen" title="分期计划审批记录" width="min(860px, 100vw)">
      <a-spin v-if="loading" tip="正在加载审批记录…" />
      <a-alert v-else-if="error" type="error" :message="error" show-icon>
        <template #action><a-button @click="refresh">重试</a-button></template>
      </a-alert>
      <template v-else>
        <p>当前计划：{{ getApprovalStatusMeta(period.approvalStatus).text }}。历史结果不代表当前计划仍有效。</p>
        <a-empty v-if="!history.length" description="暂无审批记录" />
        <a-collapse v-else>
          <a-collapse-panel v-for="row in history" :key="row.id" :header="`第${row.roundNo}轮 · ${getApprovalStatusMeta(row.approvalStatus).text}`">
            <a-descriptions :column="1" size="small" bordered>
              <a-descriptions-item label="提交人 / 时间">{{ row.submitUserName || '—' }} / {{ row.submitTime || '—' }}</a-descriptions-item>
              <a-descriptions-item label="审批人 / 时间">{{ row.approvalUserName || '—' }} / {{ row.approvalTime || '—' }}</a-descriptions-item>
              <a-descriptions-item label="审批说明 / 驳回原因"><span class="period-approval-actions__text">{{ row.approvalReason || '—' }}</span></a-descriptions-item>
              <a-descriptions-item label="撤回人 / 时间">{{ row.withdrawUserName || '—' }} / {{ row.withdrawTime || '—' }}</a-descriptions-item>
              <a-descriptions-item label="撤回原因"><span class="period-approval-actions__text">{{ row.withdrawReason || '—' }}</span></a-descriptions-item>
            </a-descriptions>
            <details class="period-approval-actions__reason">
              <summary>查看本轮提交快照（只读）</summary>
              <pre class="period-approval-actions__snapshot">{{ snapshotText(row.submittedSnapshot) }}</pre>
            </details>
          </a-collapse-panel>
        </a-collapse>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch, onBeforeUnmount } from 'vue';
  import { useUserStore } from '/@/store/modules/user';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
  import { readProjectMembership } from '../projectMembership';
  import { refreshTodos } from '/@/views/todo/useTodoCenter';
  import { getPeriodApprovalState, getPeriodApprovalHistory, submitPeriodApproval, approvePeriodPlan, withdrawPeriodApproval } from './PeriodApproval.api';
  import { PERIOD_APPROVE_PERMISSION, resolvePeriodApproval, parseApprovalSnapshot, type PeriodApprovalRecord } from './periodApproval';

  const props = withDefaults(defineProps<{
    periodId: string; approvalId?: string; allowSubmit?: boolean; allowApprove?: boolean; disabled?: boolean;
    beforeSubmit?: () => string | Promise<string>; hideHint?: boolean;
  }>(), { approvalId: '', allowSubmit: false, allowApprove: false, disabled: false });
  const emit = defineEmits(['changed', 'busy', 'summary', 'hint']);
  const userStore = useUserStore();
  const { hasPermission } = usePermission();
  const { createMessage } = useMessage();
  const period = ref<Recordable>({});
  const history = ref<PeriodApprovalRecord[]>([]);
  const manager = ref(false);
  const loading = ref(false);
  const ready = ref(false);
  const error = ref('');
  const busy = ref(false);
  const historyOpen = ref(false);
  const confirmOpen = ref(false);
  const reason = ref('');
  type Action = 'submit' | 'approve' | 'reject' | 'withdraw';
  const action = ref<Action>('submit');
  const expectedId = ref('');
  const actionTitle = computed(() => ({ submit: '提交审批', approve: '确认通过', reject: '确认驳回', withdraw: '确认撤回' }[action.value]));
  const userId = computed(() => String(userStore.getUserInfo?.id || ''));
  const admin = computed(() => userStore.getIdentity.roleCodes?.includes('admin'));
  const state = computed(() => resolvePeriodApproval(period.value, history.value));
  const stale = computed(() => !!props.approvalId && props.approvalId !== state.value.current?.id);
  const canSubmit = computed(() => ready.value && props.allowSubmit && (admin.value || manager.value) && state.value.canSubmit && !stale.value);
  const canApprove = computed(() => ready.value && props.allowApprove && (admin.value || hasPermission(PERIOD_APPROVE_PERMISSION)) && state.value.waiting && !stale.value);
  const canWithdraw = computed(() => ready.value && state.value.waiting && !stale.value &&
    (admin.value || (!!userId.value && state.value.current?.submitUserId === userId.value)));
  let sequence = 0;
  const hint = computed(() => !ready.value || loading.value || error.value ? '' : stale.value
    ? '该审批轮次已变化，请从最新待办重新进入'
    : state.value.legacy && !canSubmit.value ? '旧计划未建立审批轮次，请项目经理重新提交' : '');
  watch(hint, (value) => emit('hint', value), { immediate: true });
  function snapshotText(raw?: string) {
    const snapshot = parseApprovalSnapshot(raw);
    return snapshot ? JSON.stringify(snapshot, null, 2) : '快照内容缺失或格式不支持，不能作为可编辑计划使用。';
  }
  async function refresh() {
    const request = ++sequence;
    const id = props.periodId;
    ready.value = false;
    loading.value = true;
    error.value = '';
    emit('summary', { loading: true });
    try {
      if (!id) throw new Error('缺少项目分期 ID');
      const [detail, rows, membership] = await Promise.all([
        getPeriodApprovalState(id), getPeriodApprovalHistory(id),
        props.allowSubmit && !admin.value
          ? readProjectMembership(id, userId.value).catch(() => ({ manager: false }))
          : Promise.resolve({ manager: false }),
      ]);
      if (request !== sequence || id !== props.periodId) return false;
      if (String(detail?.id || '') !== id) throw new Error('项目分期信息不匹配，请刷新');
      period.value = detail;
      history.value = rows;
      manager.value = membership.manager;
      ready.value = true;
      emit('summary', { status: detail.approvalStatus, latest: [...rows].sort((a, b) => Number(b.roundNo) - Number(a.roundNo))[0] });
      return true;
    } catch (err: any) {
      if (request === sequence) {
        error.value = err?.message || '审批信息加载失败，请重试';
        emit('summary', { error: error.value });
      }
      return false;
    } finally { if (request === sequence) loading.value = false; }
  }
  function allowed() {
    return action.value === 'submit' ? canSubmit.value : action.value === 'withdraw' ? canWithdraw.value : canApprove.value;
  }
  async function openAction(next: Action) {
    if (busy.value || loading.value || props.disabled) return;
    action.value = next;
    if (!allowed()) return;
    if (next === 'submit') {
      const message = await props.beforeSubmit?.();
      if (message) return void createMessage.warning(message);
    }
    expectedId.value = state.value.current?.id || '';
    reason.value = '';
    confirmOpen.value = true;
  }
  async function execute() {
    if (busy.value || props.disabled) return;
    const text = reason.value.trim();
    if (action.value === 'reject' && !text) return void createMessage.warning('请填写驳回原因');
    if (text.length > 2000) return void createMessage.warning('原因不能超过 2000 字符');
    const id = props.periodId;
    const owner = userId.value;
    const session = userStore.getToken;
    let succeeded = false;
    busy.value = true;
    emit('busy', true);
    try {
      if (!await refresh()) throw new Error(error.value || '审批信息已变化，请刷新');
      if (id !== props.periodId || owner !== userId.value || session !== userStore.getToken || !allowed() || expectedId.value !== (state.value.current?.id || '')) {
        throw new Error('审批轮次或项目状态已变化，请刷新后重新操作');
      }
      if (action.value === 'submit') {
        const message = await props.beforeSubmit?.();
        if (message) throw new Error(message);
        if (id !== props.periodId || owner !== userId.value || session !== userStore.getToken) throw new Error('登录或项目上下文已变化，请重新操作');
        await submitPeriodApproval(id);
      } else {
        const data = { periodId: id, approvalId: expectedId.value, ...(text ? { approvalReason: text } : {}) };
        if (action.value === 'withdraw') await withdrawPeriodApproval(data);
        else await approvePeriodPlan({ ...data, approvalStatus: action.value === 'approve' ? '1' : '0' });
      }
      confirmOpen.value = false;
      succeeded = true;
      createMessage.success({ submit: '已提交审批', approve: '审批通过，项目进入筹备中', reject: '已驳回，项目回到未开始', withdraw: '已撤回，可修改后重新提交' }[action.value]);
    } catch (err: any) {
      createMessage.error(err?.message || '操作失败，请刷新确认状态');
    } finally {
      // 成功、业务拒绝及网络结果不确定时均重新读取；绝不自动重放写请求。
      await refresh();
      refreshTodos(true).catch(() => undefined);
      if (id === props.periodId && owner === userId.value) emit('changed', { period: ready.value ? period.value : null, succeeded });
      busy.value = false;
      emit('busy', false);
    }
  }
  function openHistory() { historyOpen.value = true; void refresh(); }
  watch(() => [props.periodId, userId.value, userStore.getToken, props.allowSubmit, JSON.stringify(userStore.getIdentity)], () => {
    confirmOpen.value = false;
    historyOpen.value = false;
    period.value = {};
    history.value = [];
    void refresh();
  }, { immediate: true });
  onBeforeUnmount(() => { sequence += 1; });
  defineExpose({ refresh });
</script>

<style scoped>
  .period-approval-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .period-approval-actions__hint { color: #595959; }
  .period-approval-actions__reason { margin-top: 16px; }
  .period-approval-actions__text, .period-approval-actions__snapshot { white-space: pre-wrap; overflow-wrap: anywhere; }
  .period-approval-actions__snapshot { max-height: 480px; overflow: auto; margin-top: 12px; }
</style>
