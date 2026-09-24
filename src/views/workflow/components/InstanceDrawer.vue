<template>
  <a-drawer :open="open" title="审批详情" width="min(900px, 96vw)" :mask-closable="!busy" :closable="!busy" @close="emit('close')">
    <a-alert v-if="error" type="error" :message="error" show-icon
      ><template #action><a-button size="small" @click="load">重新读取</a-button></template></a-alert
    >
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-descriptions bordered :column="2"
          ><a-descriptions-item label="申请编号">{{ detail.businessId }}</a-descriptions-item
          ><a-descriptions-item label="状态">{{ statusLabels[detail.status] || detail.status }}</a-descriptions-item
          ><a-descriptions-item label="流程">{{ detail.processKey }}</a-descriptions-item
          ><a-descriptions-item label="版本 / 轮次">V{{ detail.version }} / 第{{ detail.roundNo }}轮</a-descriptions-item></a-descriptions
        >
        <a-alert v-if="metadataError" type="warning" :message="metadataError" show-icon />
        <h2>申请内容</h2
        ><a-descriptions bordered :column="1"
          ><a-descriptions-item
            v-for="(value, key) in visibleSnapshot"
            :key="key"
            :label="fields.find((field) => field.key === key)?.name || String(key)"
            ><span class="snapshot-value">{{
              fields.find((field) => field.key === key)?.type === 'attachment'
                ? '附件已上传（本版暂不支持查看）'
                : typeof value === 'object'
                  ? JSON.stringify(value, null, 2)
                  : String(value ?? '—')
            }}</span></a-descriptions-item
          ></a-descriptions
        >
        <h2>当前任务</h2><a-empty v-if="!detail.tasks.length" description="本轮无待处理任务" />
        <section v-for="task in detail.tasks" :key="task.id" class="task-section"
          ><strong>{{ task.name }}</strong
          ><p v-if="taskAction(task.id)?.reason" class="hint">{{ taskAction(task.id)?.reason }}</p>
          <a-space
            ><a-button
              v-for="action in taskButtons"
              :key="action.value"
              :type="action.value === 'APPROVE' ? 'primary' : 'default'"
              :danger="action.value === 'REJECT'"
              :disabled="busy || loading || !!error || !!metadataError || !taskAction(task.id)?.actions?.includes(action.value)"
              :title="taskAction(task.id)?.disabledActions?.[action.value]"
              @click="chooseAction(task.id, action.value)"
              >{{ action.label }}</a-button
            ></a-space
          >
          <p v-if="taskAction(task.id)?.actions?.some((a) => !['APPROVE', 'REJECT'].includes(a))" class="hint"
            >当前还存在高级办理动作，本期仅接入同意、驳回与撤回。</p
          >
        </section>
        <h2>审批记录</h2
        ><a-timeline
          ><a-timeline-item v-for="(item, index) in detail.history" :key="index"
            ><strong>{{ item.actor_name || item.actor_id }}</strong> · {{ actionLabels[item.action] || item.action
            }}<p>{{ item.node_name }} {{ item.comment_text }}</p
            ><small>{{ item.created_at }}</small></a-timeline-item
          ></a-timeline
        >
      </template>
    </a-spin>
    <template #footer
      ><div class="drawer-actions"
        ><a-button @click="load" :disabled="busy">刷新状态</a-button
        ><a-button v-if="actions?.canWithdraw" danger :disabled="busy || loading || !!error" @click="chooseAction(undefined, 'WITHDRAW')"
          >撤回申请</a-button
        ><a-button :disabled="busy" @click="emit('close')">关闭</a-button></div
      ></template
    >
    <a-modal
      v-model:open="confirmOpen"
      :title="`${actionLabels[pendingAction]}申请`"
      :confirm-loading="busy"
      :mask-closable="!busy"
      :closable="!busy"
      :cancel-button-props="{ disabled: busy }"
      ok-text="确认"
      cancel-text="取消"
      @ok="submitAction"
    >
      <a-form layout="vertical"
        ><a-form-item label="审批意见" :required="pendingAction === 'REJECT'"
          ><a-textarea v-model:value="comment" :maxlength="1000" :rows="4" :disabled="busy || !!pendingRequest" /></a-form-item></a-form
      ><a-alert v-if="actionError" type="error" :message="actionError" />
    </a-modal>
  </a-drawer>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { handleInstance, instanceActions, instanceDetail, instanceForm } from '../Workflow.api';
  import { newId, statusLabels } from '../workflow';
  import type { WorkflowInstance, InstanceActions, FormField } from '../workflow.types';
  const props = defineProps<{ open: boolean; instanceId: string }>();
  const emit = defineEmits(['close', 'processed']);
  const detail = ref<WorkflowInstance>(),
    actions = ref<InstanceActions>(),
    error = ref(''),
    loading = ref(false),
    busy = ref(false),
    confirmOpen = ref(false),
    comment = ref(''),
    actionError = ref('');
  const fields = ref<FormField[]>([]);
  const metadataError = ref('');
  const pendingRequest = ref<Parameters<typeof handleInstance>[0]>();
  const pendingAction = ref<'APPROVE' | 'REJECT' | 'WITHDRAW'>('APPROVE');
  let pendingTask: string | undefined,
    requestId = '',
    generation = 0;
  const taskButtons = [
    { value: 'APPROVE' as const, label: '同意' },
    { value: 'REJECT' as const, label: '驳回' },
  ];
  const actionLabels: Record<string, string> = { APPROVE: '同意', REJECT: '驳回', WITHDRAW: '撤回', START: '发起', SUBMIT: '提交' };
  // Resolve metadata paths against nested data, never expose extra snapshot keys.
  function fieldValue(data: unknown, path: string): unknown {
    const [head, ...tail] = path.split('.');
    const array = head.endsWith('[]');
    const key = array ? head.slice(0, -2) : head;
    if (!data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, key)) return undefined;
    const value = (data as Record<string, unknown>)[key];
    if (array) return Array.isArray(value) ? value.map((item) => (tail.length ? fieldValue(item, tail.join('.')) : item)) : undefined;
    return tail.length ? fieldValue(value, tail.join('.')) : value;
  }
  const visibleSnapshot = computed(() =>
    Object.fromEntries(
      fields.value
        .filter((field) => detail.value?.fieldPermissions?.[field.key] !== 'HIDDEN')
        .map((field) => [field.key, fieldValue(detail.value?.snapshot, field.key)])
    )
  );
  const taskAction = (id: string) => actions.value?.tasks?.find((t) => t.taskId === id);
  async function load() {
    if (!props.open || !props.instanceId || busy.value) return;
    const current = ++generation;
    loading.value = true;
    error.value = '';
    actions.value = undefined;
    fields.value = [];
    metadataError.value = '';
    try {
      const [data, allowed] = await Promise.all([instanceDetail(props.instanceId), instanceActions(props.instanceId)]);
      if (current !== generation) return;
      detail.value = data;
      actions.value = allowed;
      try {
        const schema = await instanceForm(props.instanceId);
        if (current !== generation) return;
        if (schema.instanceId !== data.id || schema.processKey !== data.processKey || schema.version !== data.version) throw new Error('版本不一致');
        fields.value = schema.fields;
        detail.value.fieldPermissions = schema.fieldPermissions;
        if (schema.fields.some((field) => field.type === 'attachment' && fieldValue(data.snapshot, field.key)))
          metadataError.value = '本申请包含附件，本版暂不能查看附件，已暂停办理，请使用支持附件的入口核对后处理。';
      } catch {
        if (current === generation)
          metadataError.value = '实例表单加载失败，已暂停办理。请重新读取；若持续失败，请确认后端已加载 instance/form 新接口。';
      }
    } catch (e) {
      if (current === generation) {
        error.value = (e as Error).message;
        detail.value = undefined;
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  function chooseAction(taskId: string | undefined, action: 'APPROVE' | 'REJECT' | 'WITHDRAW') {
    pendingTask = taskId;
    pendingAction.value = action;
    comment.value = '';
    actionError.value = '';
    requestId = newId('action');
    pendingRequest.value = undefined;
    confirmOpen.value = true;
  }
  async function submitAction() {
    if (busy.value) return;
    if (pendingAction.value === 'REJECT' && !comment.value.trim()) {
      actionError.value = '请填写驳回原因';
      return;
    }
    busy.value = true;
    actionError.value = '';
    try {
      pendingRequest.value ||= {
        instanceId: props.instanceId,
        taskId: pendingTask,
        requestId,
        action: pendingAction.value,
        comment: comment.value.trim(),
      };
      await handleInstance(pendingRequest.value);
      confirmOpen.value = false;
      emit('processed');
    } catch (e) {
      actionError.value = (e as Error).message;
    } finally {
      busy.value = false;
    }
    if (!confirmOpen.value) await load();
  }
  watch(
    () => [props.open, props.instanceId],
    () => {
      generation++;
      detail.value = undefined;
      actions.value = undefined;
      if (props.open) load();
    },
    { immediate: true }
  );
  onBeforeUnmount(() => generation++);
</script>
<style scoped>
  h2 {
    font-size: 16px;
    margin: 28px 0 16px;
  }
  .task-section {
    padding: 16px 0;
    border-bottom: 1px solid #eee;
  }
  .task-section strong {
    display: block;
    margin-bottom: 12px;
  }
  .hint {
    color: #595959;
    font-size: 12px;
  }
  .snapshot-value {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
