<template>
  <a-drawer
    :open="open"
    title="审批详情"
    width="min(900px, 96vw)"
    :mask-closable="!busy && !uploading"
    :closable="!busy && !uploading"
    @close="emit('close')"
  >
    <a-alert v-if="error" type="error" :message="error" show-icon
      ><template #action><a-button size="small" @click="load">重新读取</a-button></template></a-alert
    >
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-descriptions bordered :column="2"
          ><a-descriptions-item label="申请编号">{{ detail.businessId }}</a-descriptions-item
          ><a-descriptions-item label="状态">{{ statusLabels[detail.status] || detail.status }}</a-descriptions-item
          ><a-descriptions-item label="流程">{{ processName(detail) }}</a-descriptions-item
          ><a-descriptions-item label="流程版本">V{{ detail.version }}</a-descriptions-item
          ><a-descriptions-item label="申请轮次"
            >第 {{ detail.roundNo }} 轮 · {{ roundLabel(detail.latestRound) }}</a-descriptions-item
          ></a-descriptions
        >
        <a-alert v-if="metadataError" type="warning" :message="metadataError" show-icon />
        <a-alert v-if="detail.businessType === 'PROJECT_CONTRACT'" type="info" message="合同快照只读；驳回或撤回后，请由原发起人从项目合同页面修改并重新提交。" />
        <h2>申请内容</h2
        ><a-descriptions bordered :column="1"
          ><a-descriptions-item
            v-for="(value, key) in visibleSnapshot"
            :key="key"
            :label="fields.find((field) => field.key === key)?.name || String(key)"
            ><BusinessSnapshotValue v-if="detail.businessType === 'PROJECT_CONTRACT'" :field="fields.find((f) => f.key === key)" :value="value" />
            <span v-else class="snapshot-value">{{
              fields.find((field) => field.key === key)?.type === 'attachment'
                ? '附件已上传（本版暂不支持查看）'
                : typeof value === 'object'
                  ? JSON.stringify(value, null, 2)
                  : String(value ?? '—')
            }}</span></a-descriptions-item
          ></a-descriptions
        >
        <ApprovalProgress :instance="detail">
          <template #task="{ task }">
            <p v-if="taskAction(task.id)?.reason" class="hint">{{ taskAction(task.id)?.reason }}</p>
            <a-space
              ><a-button
                v-for="action in taskButtons.filter(
                  (a) => (!['APPROVE', 'REJECT', 'COMPLETE'].includes(a.value) || task.canHandle) && taskAction(task.id)?.actions?.includes(a.value) && (task.kind !== 'WORK' || !['APPROVE', 'REJECT'].includes(a.value)) && (detail.businessType !== 'PROJECT_CONTRACT' || a.value !== 'EDIT_DATA')
                )"
                :key="action.value"
                :type="action.value === 'APPROVE' ? 'primary' : 'default'"
                :danger="action.value === 'REJECT'"
                :disabled="busy || loading || !!error || !!metadataError || !taskAction(task.id)?.actions?.includes(action.value)"
                :title="taskAction(task.id)?.disabledActions?.[action.value]"
                @click="chooseAction(task.id, action.value)"
                >{{ action.label }}</a-button
              ></a-space
            >
          </template>
        </ApprovalProgress>
      </template>
    </a-spin>
    <template #footer
      ><div class="drawer-actions"
        ><a-button @click="load" :disabled="busy">刷新状态</a-button
        ><a-button v-if="actions?.canWithdraw" danger :disabled="busy || loading || !!error" @click="chooseAction(undefined, 'WITHDRAW')"
          >撤回申请</a-button
        ><a-button :disabled="busy || loading || !!error" @click="openComment">评论</a-button
        ><a-button :disabled="busy || loading || !!error" @click="openPrint">打印</a-button
        ><a-button
          v-if="actions?.canResubmit && detail?.businessType === 'WORKFLOW_FORM'"
          :disabled="busy || loading || !!metadataError"
          @click="chooseAction(undefined, 'RESUBMIT')"
          >修改重提</a-button
        ><a-button :disabled="busy" @click="emit('close')">关闭</a-button></div
      ></template
    >
    <a-modal
      v-model:open="confirmOpen"
      :title="actionLabels[pendingAction] || pendingAction"
      :confirm-loading="busy"
      :ok-button-props="{
        disabled: uploading || (pendingAction === 'RETURN' && (!!returnTargetError || !availableReturnOptions.some((o) => o.value === targetNode))),
      }"
      :mask-closable="!busy && !uploading"
      :closable="!busy && !uploading"
      :cancel-button-props="{ disabled: busy || uploading }"
      ok-text="确认"
      cancel-text="取消"
      @ok="submitAction"
    >
      <a-config-provider :component-disabled="busy || !!pendingRequest"
        ><a-form layout="vertical">
          <a-form-item v-if="pendingAction === 'RETURN'" label="退回目标" required
            ><a-select v-model:value="targetNode" :disabled="busy || !!pendingRequest" :options="availableReturnOptions"
          /></a-form-item>
          <a-alert v-if="pendingAction === 'RETURN' && returnTargetError" type="warning" :message="returnTargetError" />
          <p v-if="pendingAction === 'RETURN' && targetNode === 'START'">退回发起人会结束本轮，修改重提将创建新轮次。</p>
          <a-form-item v-if="['TRANSFER', 'DELEGATE', 'ADD_SIGN', 'REASSIGN'].includes(pendingAction)" label="接收人员" required
            ><DirectorySelect v-model:value="targetUsers" kind="users"
          /></a-form-item>
          <a-form-item v-if="pendingAction === 'REMOVE_SIGN'" label="减签人员" required
            ><a-select
              v-model:value="targetUsers"
              mode="multiple"
              :options="(taskAction(pendingTask || '')?.removableUserIds || []).map((value) => ({ value, label: participantNames[value] || value }))"
          /></a-form-item>
          <a-form-item v-if="pendingAction === 'COMMENT'" label="提及已有参与者"
            ><a-select
              v-model:value="targetUsers"
              mode="multiple"
              :options="Object.entries(participantNames).map(([value, label]) => ({ value, label }))"
          /></a-form-item>
          <RequestForm
            v-if="['EDIT_DATA', 'RESUBMIT'].includes(pendingAction)"
            :fields="editFields"
            :permissions="editPermissions"
            v-model:value="editData"
            :disabled="busy || !!pendingRequest"
            @uploading="(v) => (uploading = v)" />
          <a-alert
            v-if="pendingAction === 'RESUBMIT' && detail?.businessType !== 'WORKFLOW_FORM'"
            type="warning"
            message="此业务请从原业务页面修改后重新提交。" />
          <a-form-item label="审批意见" :required="!['APPROVE', 'COMPLETE', 'RESUBMIT'].includes(pendingAction)"
            ><a-textarea
              v-model:value="comment"
              :maxlength="1000"
              :rows="4"
              :disabled="busy || !!pendingRequest" /></a-form-item></a-form></a-config-provider
      ><a-alert v-if="pendingRequest && !busy" type="warning" message="本次提交结果尚未确认，再次确认会使用相同请求重试；请勿重复发起。" /><a-alert
        v-if="actionError"
        type="error"
        :message="actionError"
      />
    </a-modal>
    <InstancePrint :data="printData" :open="printOpen" @close="printOpen = false" />
  </a-drawer>
</template>
<script setup lang="ts">
  import BusinessSnapshotValue from './BusinessSnapshotValue.vue';
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import {
    commentInstance,
    editInstanceData,
    operateTask,
    printInstance,
    resubmitInstance,
    handleInstance,
    instanceActions,
    instanceDetail,
    instanceForm,
  } from '../Workflow.api';
  import DirectorySelect from './DirectorySelect.vue';
  import RequestForm from './RequestForm.vue';
  import InstancePrint from './InstancePrint.vue';
  import ApprovalProgress from './ApprovalProgress.vue';
  import { processName, roundLabel, returnOptions } from '../instancePresentation';
  import { newId, statusLabels } from '../workflow';
  import type { WorkflowInstance, InstanceActions, FormField } from '../workflow.types';
  const props = defineProps<{ open: boolean; instanceId: string }>();
  const emit = defineEmits(['close', 'processed', 'resubmitted']);
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
  const pendingRequest = ref<Record<string, any>>();
  const pendingAction = ref('APPROVE');
  const targetNode = ref(''),
    targetUsers = ref<string[]>([]),
    editData = ref<Record<string, any>>({}),
    uploading = ref(false);
  const printOpen = ref(false),
    printData = ref<Awaited<ReturnType<typeof printInstance>>>();
  const participantNames = computed(() => {
    const names: Record<string, string> = {};
    if (detail.value?.initiatorId) names[detail.value.initiatorId] = '发起人';
    for (const item of detail.value?.history || []) if (item.actor_id) names[item.actor_id] = item.actor_name || item.actor_id;
    return names;
  });
  const editFields = computed(() =>
    pendingAction.value === 'EDIT_DATA'
      ? fields.value.filter((f) => taskAction(pendingTask.value || '')?.editableFields?.includes(f.key))
      : fields.value
  );
  const editPermissions = computed(() =>
    pendingAction.value === 'EDIT_DATA'
      ? Object.fromEntries(editFields.value.map((f) => [f.key, 'EDITABLE' as const]))
      : detail.value?.fieldPermissions || {}
  );

  const pendingTask = ref<string>();
  let requestId = '',
    generation = 0;
  const taskButtons = [
    { value: 'APPROVE' as const, label: '同意' },
    { value: 'REJECT' as const, label: '驳回' },
    ...Object.entries({
      COMPLETE: '完成任务',
      RETURN: '退回',
      TRANSFER: '转办',
      DELEGATE: '委托',
      RESOLVE: '完成委托',
      ADD_SIGN: '加签',
      REMOVE_SIGN: '减签',
      REASSIGN: '改派',
      EDIT_DATA: '修改表单',
    }).map(([value, label]) => ({ value, label })),
  ];
  const actionLabels: Record<string, string> = {
    APPROVE: '同意',
    REJECT: '驳回',
    WITHDRAW: '撤回',
    START: '发起',
    SUBMIT: '提交',
    COMPLETE: '完成任务',
    RETURN: '退回',
    TRANSFER: '转办',
    DELEGATE: '委托',
    RESOLVE: '完成委托',
    ADD_SIGN: '加签',
    REMOVE_SIGN: '减签',
    REASSIGN: '改派',
    EDIT_DATA: '修改表单',
    RESUBMIT: '修改并重新提交',
    COMMENT: '评论',
    AUTO_APPROVE: '自动通过',
  };
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
        if (data.businessType !== 'PROJECT_CONTRACT' && schema.fields.some((field) => field.type === 'attachment' && fieldValue(data.snapshot, field.key)))
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
  const availableReturnOptions = computed(() => returnOptions(taskAction(pendingTask.value || '')));
  const returnTargetError = computed(() => {
    const task = taskAction(pendingTask.value || '');
    if (!task?.actions?.includes('RETURN')) return '当前任务不允许退回，请刷新状态';
    if (!Array.isArray(task.returnTargetOptions)) return '退回目标信息暂不可用，请刷新后重试';
    return availableReturnOptions.value.length ? '' : '当前没有可选退回目标';
  });
  watch(availableReturnOptions, (options) => {
    if (!options.some((o) => o.value === targetNode.value)) targetNode.value = '';
  });
  async function chooseAction(taskId: string | undefined, action: string) {
    if (busy.value || loading.value) return;
    if (action === 'RETURN') {
      const current = generation;
      busy.value = true;
      error.value = '';
      try {
        const fresh = await instanceActions(props.instanceId);
        if (current !== generation) return;
        actions.value = fresh;
      } catch (e) {
        if (current === generation) {
          actions.value = undefined;
          error.value = (e as Error).message;
        }
        return;
      } finally {
        busy.value = false;
      }
    }
    pendingTask.value = taskId;
    targetNode.value = '';
    targetUsers.value = [];
    editData.value = JSON.parse(JSON.stringify(detail.value?.snapshot || {}));
    pendingAction.value = action;
    comment.value = '';
    actionError.value = '';
    requestId = newId('action');
    pendingRequest.value = undefined;
    confirmOpen.value = true;
  }
  function openComment() {
    chooseAction(undefined, 'COMMENT');
  }
  async function openPrint() {
    error.value = '';
    busy.value = true;
    try {
      const result = await printInstance(props.instanceId);
      if (result.instance.id !== props.instanceId || result.form.instanceId !== props.instanceId || result.form.version !== result.instance.version)
        throw new Error('打印数据版本不一致');
      printData.value = result;
      printOpen.value = true;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      busy.value = false;
    }
  }
  async function submitAction() {
    if (busy.value || uploading.value) return;
    const action = pendingAction.value;
    if (!pendingRequest.value && ['APPROVE', 'REJECT', 'COMPLETE'].includes(action) && !detail.value?.tasks.some(task => task.id === pendingTask.value && task.canHandle)) {
      actionError.value = '当前任务不可由你办理，请刷新';
      return;
    }
    if (!pendingRequest.value && pendingTask.value && !taskAction(pendingTask.value)?.actions.includes(action)) {
      actionError.value = '当前任务不允许此操作，请刷新';
      return;
    }
    if (action === 'REMOVE_SIGN' && targetUsers.value.some((id) => !taskAction(pendingTask.value || '')?.removableUserIds?.includes(id))) {
      actionError.value = '请选择可减签人员';
      return;
    }
    if (action === 'COMMENT' && targetUsers.value.length > 100) {
      actionError.value = '最多提及100人';
      return;
    }
    if (!['APPROVE', 'COMPLETE', 'RESUBMIT'].includes(action) && !comment.value.trim()) {
      actionError.value = '请填写意见或原因';
      return;
    }
    if (action === 'RETURN' && (returnTargetError.value || !availableReturnOptions.value.some((o) => o.value === targetNode.value))) {
      actionError.value = '请选择合法退回目标';
      return;
    }
    if (['TRANSFER', 'DELEGATE', 'REASSIGN'].includes(action) && targetUsers.value.length !== 1) {
      actionError.value = '请选择一名接收人员';
      return;
    }
    if (['ADD_SIGN', 'REMOVE_SIGN'].includes(action) && !targetUsers.value.length) {
      actionError.value = '请选择人员';
      return;
    }
    if (['EDIT_DATA', 'RESUBMIT'].includes(action)) {
      if (detail.value?.businessType === 'PROJECT_CONTRACT') {
        actionError.value = '合同字段只读，请由原发起人在合同页面修改重提';
        return;
      }
      if (action === 'RESUBMIT' && detail.value?.businessType !== 'WORKFLOW_FORM') {
        actionError.value = '请从原业务页面重新提交';
        return;
      }
      if (editFields.value.some((f) => !['string', 'number', 'boolean', 'date', 'attachment'].includes(f.type) || /[.\[\]]/.test(f.key))) {
        actionError.value = '此表单含复杂字段，暂不支持在此修改';
        return;
      }
      const missing = editFields.value.find(
        (f) => f.required && editPermissions.value[f.key] !== 'HIDDEN' && (editData.value[f.key] == null || editData.value[f.key] === '')
      );
      if (missing) {
        actionError.value = `请填写${missing.name}`;
        return;
      }
    }
    busy.value = true;
    actionError.value = '';
    try {
      const base = { instanceId: props.instanceId, requestId, comment: comment.value.trim() };
      if (!pendingRequest.value) {
        if (['APPROVE', 'REJECT', 'WITHDRAW', 'COMPLETE'].includes(action)) pendingRequest.value = { ...base, taskId: pendingTask.value, action };
        else if (action === 'COMMENT') pendingRequest.value = { ...base, mentionUserIds: [...targetUsers.value] };
        else if (action === 'RESUBMIT')
          pendingRequest.value = { instanceId: props.instanceId, requestId, data: JSON.parse(JSON.stringify(editData.value)) };
        else if (action === 'EDIT_DATA')
          pendingRequest.value = {
            ...base,
            taskId: pendingTask.value,
            data: Object.fromEntries(editFields.value.map((f) => [f.key, editData.value[f.key]])),
          };
        else
          pendingRequest.value = {
            ...base,
            taskId: pendingTask.value,
            operation: action,
            ...(action === 'RETURN' ? { targetNodeKey: targetNode.value } : { userIds: [...targetUsers.value] }),
          };
      }
      const payload = pendingRequest.value;
      if (['APPROVE', 'REJECT', 'WITHDRAW', 'COMPLETE'].includes(action)) await handleInstance(payload as Parameters<typeof handleInstance>[0]);
      else if (action === 'COMMENT') await commentInstance(payload as Parameters<typeof commentInstance>[0]);
      else if (action === 'RESUBMIT') {
        const result = await resubmitInstance(payload as Parameters<typeof resubmitInstance>[0]);
        emit('resubmitted', result.id);
      } else if (action === 'EDIT_DATA') await editInstanceData(payload as Parameters<typeof editInstanceData>[0]);
      else await operateTask(payload as Parameters<typeof operateTask>[0]);
      confirmOpen.value = false;
      emit('processed');
    } catch (e) {
      actionError.value = (e as Error).message;
    } finally {
      busy.value = false;
    }
    if (!confirmOpen.value || action === 'RETURN') await load();
  }
  watch(
    () => [props.open, props.instanceId],
    () => {
      generation++;
      detail.value = undefined;
      actions.value = undefined;
      confirmOpen.value = false;
      printOpen.value = false;
      pendingRequest.value = undefined;
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
