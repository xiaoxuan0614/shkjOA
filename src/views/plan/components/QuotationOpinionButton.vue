<template>
  <a-button type="link" size="small" :disabled="disabled" @click="show">审批意见</a-button>
  <a-modal v-model:open="open" title="审批意见" :width="480" :mask-closable="false" :ok-button-props="{ disabled: disabled || draft.length > 100 }" @ok="confirm">
    <p>{{ name }}</p>
    <a-textarea v-model:value="draft" aria-label="审批意见" placeholder="选填，最多100字" :maxlength="100" show-count :rows="4" :disabled="disabled" />
    <p v-if="draft.length > 100" role="alert">已有意见超过100字，请调整后确认。</p>
  </a-modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  const props = defineProps<{ value?: string | null; name?: string; disabled?: boolean }>();
  const emit = defineEmits<{ change: [value: string] }>();
  const open = ref(false);
  const draft = ref('');
  function show() {
    if (props.disabled) return;
    draft.value = props.value ?? '';
    open.value = true;
  }
  function confirm() {
    if (props.disabled || draft.value.length > 100) return;
    emit('change', draft.value);
    open.value = false;
  }
  watch(() => props.disabled, disabled => { if (disabled) open.value = false; });
</script>
