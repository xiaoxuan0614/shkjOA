<template>
  <a-modal :open="open" title="申请延期" :confirm-loading="saving" :ok-button-props="{ disabled: loading || !!error || !allowed }" :mask-closable="!saving" :closable="!saving" :cancel-button-props="{ disabled: saving }" @cancel="close" @ok="submit">
    <a-alert v-if="error" type="error" show-icon :message="error" class="mb-3"><template #action><a-button :disabled="saving" @click="load">重试</a-button></template></a-alert>
    <a-spin :spinning="loading">
      <a-form layout="vertical">
        <a-form-item label="延期工序" required><a-select v-model:value="processId" :options="options" :disabled="saving" placeholder="请选择当前轮次未完成工序" /></a-form-item>
        <a-form-item label="原计划完成日期">{{ selected?.plannedEndTime?.slice(0, 10) || '—' }}</a-form-item>
        <a-form-item label="预计完成日期" required><a-date-picker v-model:value="expectedEndTime" value-format="YYYY-MM-DD" :disabled="saving" /></a-form-item>
        <a-form-item label="延期原因" required><a-textarea v-model:value="delayReason" :rows="3" :maxlength="500" :disabled="saving" /></a-form-item>
      </a-form>
      <a-empty v-if="!loading && !error && !rows.length" description="当前轮次没有可延期的工序" />
    </a-spin>
  </a-modal>
</template>
<script setup lang="ts">
  import { computed, ref, watch, onBeforeUnmount, onDeactivated } from 'vue';
  import dayjs from 'dayjs';
  import { createDelay, readDelayProcesses } from '../../Delay.api';
  import { projectDetail } from '../../Project.api';
  import { readProjectMembership } from '../../projectMembership';
  import { loadProjectWorkTypeOptions } from '../../Project.data';
  import { useUserStore } from '/@/store/modules/user';
  import { useMessage } from '/@/hooks/web/useMessage';
  const props = defineProps<{ open: boolean; project: Record<string, any>; allowed: boolean }>();
  const emit = defineEmits(['update:open', 'success']);
  const user = useUserStore(), { createMessage } = useMessage();
  const loading = ref(false), saving = ref(false), error = ref('');
  const rows = ref<any[]>([]), names = ref<Record<string, string>>({});
  const processId = ref<string>(), expectedEndTime = ref<string>(), delayReason = ref('');
  const selected = computed(() => rows.value.find(row => String(row.id) === processId.value));
  const options = computed(() => rows.value.map(row => ({ value: String(row.id), label: names.value[row.processName] || row.processName || '未命名工序' })));
  let generation = 0;
  function eligibleProcesses(all: any[], project: Record<string, any>) {
    return all.filter(row => row.id && String(row.periodId) === String(project.periodId) && String(row.delFlag ?? '0') === '0'
      && ['NOT_STARTED', 'IN_PROGRESS'].includes(row.status) && row.plannedEndTime
      && String(row.reworkId || '') === String(project.currentReworkId || ''));
  }
  function close() { if (!saving.value) emit('update:open', false); }
  async function load() {
    if (!props.open || !props.allowed) return;
    const seq = ++generation, id = String(props.project.periodId);
    error.value = ''; loading.value = true; rows.value = [];
    try {
      const [all, dict] = await Promise.all([readDelayProcesses(id), loadProjectWorkTypeOptions()]);
      if (seq !== generation) return;
      rows.value = eligibleProcesses(all, props.project);
      names.value = Object.fromEntries(dict.map(item => [String(item.value), item.label]));
    } catch (e: any) { if (seq === generation) error.value = e?.message || '工序读取失败'; }
    finally { if (seq === generation) loading.value = false; }
  }
  async function submit() {
    if (saving.value || loading.value || !props.allowed || error.value) return;
    if (!selected.value || !expectedEndTime.value || !delayReason.value.trim()) return createMessage.warning('请选择工序、预计完成日期并填写延期原因');
    const id = String(props.project.periodId), seq = generation, uid = String(user.getIdentity.userId || '');
    saving.value = true;
    try {
      const [latest, membership, all] = await Promise.all([projectDetail({ periodId: id }, true), readProjectMembership(id, uid), readDelayProcesses(id)]);
      if (seq !== generation || !props.open || !props.allowed || uid !== String(user.getIdentity.userId || '')) return;
      if (!membership.manager || String(latest?.periodId) !== id || !['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED', 'REWORKING'].includes(latest.status)) throw new Error('项目状态或项目经理身份已变化，请刷新');
      const process = eligibleProcesses(all, latest).find(row => String(row.id) === processId.value);
      if (!process) throw new Error('工序已变化，请重新打开申请');
      if (!dayjs(expectedEndTime.value).isValid() || !dayjs(expectedEndTime.value).isAfter(dayjs(String(process.plannedEndTime).slice(0, 10)), 'day')) throw new Error('预计完成日期必须晚于原计划完成日期');
      await createDelay({ periodId: id, processId: String(process.id), expectedEndTime: expectedEndTime.value, delayReason: delayReason.value.trim() });
      if (seq !== generation) return;
      createMessage.success('延期申请已提交'); emit('update:open', false); emit('success');
    } catch (e: any) { if (seq === generation) createMessage.error(e?.message || '延期申请失败，请核对后重试'); }
    finally { saving.value = false; }
  }
  watch(() => [props.open, props.project.periodId, props.allowed, user.getToken], () => {
    generation++; rows.value = []; processId.value = undefined; expectedEndTime.value = undefined; delayReason.value = ''; error.value = ''; loading.value = false;
    if (props.open && props.allowed) void load(); else if (props.open) emit('update:open', false);
  }, { immediate: true });
  onBeforeUnmount(() => { generation++; });
  onDeactivated(() => { generation++; emit('update:open', false); });
</script>
