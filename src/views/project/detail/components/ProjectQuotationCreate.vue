<template>
  <a-modal v-model:open="visible" title="新增报价" :ok-text="createdId ? '进入报价详情' : '创建并进入详情'" :confirm-loading="busy" :mask-closable="!busy" :closable="!busy" :keyboard="!busy" :cancel-button-props="{ disabled: busy }" :ok-button-props="{ disabled: uncertain || (!createdId && !allowed) }" @ok="submit">
    <a-alert v-if="error" type="error" show-icon :message="error" class="mb-3" />
    <a-form layout="vertical">
      <a-form-item label="报价单名称" required><a-input v-model:value="name" :maxlength="100" :disabled="busy || !!createdId || uncertain" placeholder="请输入报价单名称" @press-enter="submit" /></a-form-item>
    </a-form>
  </a-modal>
</template>
<script setup lang="ts">
  import { ref, watch, onBeforeUnmount, onDeactivated } from 'vue';
  import { useRouter } from 'vue-router';
  import { useUserStore } from '/@/store/modules/user';
  import { projectDetail } from '../../Project.api';
  import { addMaterialCandidate } from '/@/views/plan/Plan.api';
  import { createProjectQuotation } from '../quotationCreate';
  const props = defineProps<{ periodId: string; projectName: string; defaultName: string; allowed: boolean }>();
  const emit = defineEmits(['created']);
  const router = useRouter();
  const user = useUserStore();
  const visible = ref(false), busy = ref(false), uncertain = ref(false);
  const name = ref(''), error = ref(''), createdId = ref('');
  let generation = 0;
  function invalidate() { generation++; visible.value = false; }
  onBeforeUnmount(invalidate);
  onDeactivated(invalidate);
  watch(() => [props.periodId, user.getIdentity.userId], () => { generation++; visible.value = false; });
  function open() {
    if (!props.allowed || busy.value) return;
    name.value = props.defaultName; error.value = ''; createdId.value = ''; uncertain.value = false;
    visible.value = true;
  }
  async function submit() {
    if (busy.value || uncertain.value || (!createdId.value && !props.allowed)) return;
    const id = props.periodId, current = generation;
    busy.value = true; error.value = '';
    let sent = false;
    try {
      if (!createdId.value) {
        const created = await createProjectQuotation(id, name.value, {
          allowed: () => current === generation && props.allowed,
          readProject: params => projectDetail(params, true),
          add: params => { sent = true; return addMaterialCandidate(params, false); },
        });
        if (current !== generation) return;
        createdId.value = String(created.id);
        emit('created');
      }
      const failure = await router.push({ path: '/plan/material-draft/editor', query: { mode: 'edit', from: 'project-detail', continueCreated: '1', periodId: id, candidateId: createdId.value } });
      if (failure) throw new Error('报价已创建，页面跳转未完成，请点击进入报价详情');
      visible.value = false;
    } catch (e: any) {
      if (current !== generation) return;
      error.value = e?.message || '创建失败，请刷新报价列表确认后重试';
      if (sent && !createdId.value) { uncertain.value = true; emit('created'); }
    } finally { busy.value = false; }
  }
  defineExpose({ open });
</script>
