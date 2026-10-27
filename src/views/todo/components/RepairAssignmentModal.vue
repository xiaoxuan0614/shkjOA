<template>
  <a-modal :open="visible" title="指定内协人员" :closable="!busy && !pending" :mask-closable="false" :keyboard="!busy && !pending" :footer="null" @cancel="visible = false">
    <a-spin :spinning="loading">
      <a-alert type="info" message="审批已通过，请指定本部门人员。关闭后可从指定人员待办继续办理。" style="margin-bottom:16px" />
      <p v-if="remaining.length">还有 {{ remaining.length }} 个部门待指定，将依次办理。</p>
      <a-alert v-if="error" type="error" :message="error" show-icon style="margin-bottom:16px" />
      <a-button v-if="!options && !loading" @click="load">重新加载人员</a-button>
      <template v-if="options">
        <a-descriptions :column="1">
          <a-descriptions-item label="受邀部门">{{ options.departmentName }}</a-descriptions-item>
          <a-descriptions-item label="需要协助原因：">{{ options.reason || '—' }}</a-descriptions-item>
        </a-descriptions>
        <label for="repair-assignment-members">参与人员（必选，最多20人）</label>
        <a-select id="repair-assignment-members" v-model:value="chosen" mode="multiple" show-search option-filter-prop="label" :options="options.members" :disabled="busy || !!pending" placeholder="搜索并选择本部门人员" style="width:100%;margin-top:8px" />
        <p v-if="!options.members.length" style="margin-top:8px">当前部门暂无可指定人员。</p>
      </template>
    </a-spin>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:24px">
      <a-button :disabled="busy || !!pending" @click="visible = false">取消</a-button>
      <a-button type="primary" :loading="busy" :disabled="loading || !options || !chosen.length || chosen.length > 20" @click="submit">{{ pending ? '重试本次指派' : '确认指定' }}</a-button>
    </div>
  </a-modal>
</template>
<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { assignmentOptions, assignMembers, type AssignmentOptions, type AssignmentRequest, type AssignmentTarget } from '../repairAssignment';
const emit = defineEmits(['processed']);
const visible = ref(false), loading = ref(false), busy = ref(false), error = ref('');
const options = ref<AssignmentOptions>(), chosen = ref<string[]>([]), pending = ref<AssignmentRequest>();
const remaining = ref<AssignmentTarget[]>([]);
let target: AssignmentTarget, generation = 0;
onBeforeUnmount(() => { generation++; });
async function load() {
  const current = ++generation;
  loading.value = true; error.value = ''; options.value = undefined;
  try { const data = await assignmentOptions(target); if (current === generation) options.value = data; }
  catch (e: any) { if (current === generation) error.value = e.message || '人员加载失败'; }
  finally { if (current === generation) loading.value = false; }
}
function open(next: AssignmentTarget) {
  if (busy.value || pending.value) return;
  remaining.value = []; target = next; chosen.value = []; visible.value = true; void load();
}
function openMany(targets: AssignmentTarget[]) {
  if (!targets.length || busy.value || pending.value) return;
  open(targets[0]); remaining.value = targets.slice(1);
}
async function submit() {
  if (busy.value || loading.value || !options.value) return;
  if (!pending.value) {
    if (!chosen.value.length || chosen.value.length > 20 || new Set(chosen.value).size !== chosen.value.length || chosen.value.some(id => !options.value!.members.some(m => m.value === id))) { error.value = '请选择1至20名本部门人员'; return; }
    pending.value = { ...target, requestId: `assign-${Date.now()}-${Math.random().toString(36).slice(2)}`, assignedUserIds: [...chosen.value] };
  }
  busy.value = true; error.value = '';
  try {
    await assignMembers(pending.value); pending.value = undefined; emit('processed');
    const next = remaining.value.shift();
    if (next) { target = next; chosen.value = []; await load(); }
    else visible.value = false;
  }
  catch (e: any) { error.value = e.message || '指派结果未确认，请重试本次请求'; if (e.definite) pending.value = undefined; }
  finally { busy.value = false; }
}
defineExpose({ open, openMany });
</script>
