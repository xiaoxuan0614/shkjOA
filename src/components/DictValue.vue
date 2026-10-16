<template>
  <span class="dict-values"><template v-for="(item, index) in items" :key="index"><a-tag v-if="item.color" :color="item.color">{{ item.text }}</a-tag><span v-else>{{ item.text }}</span><span v-if="index < items.length - 1">、</span></template></span>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { initDictOptions } from '/@/utils/dict';
  const props = defineProps<{ value?: unknown; code?: string; options?: any[]; fallback?: string }>();
  const loaded = ref<any[]>([]);
  let sequence = 0;
  watch(() => [props.code, props.options], async () => {
    const seq = ++sequence;
    loaded.value = [];
    if (props.options || !props.code) return;
    try { const items = await initDictOptions(props.code); if (seq === sequence) loaded.value = items || []; } catch { /* 保留文字兜底 */ }
  }, { immediate: true });
  const items = computed(() => {
    const options = props.options || loaded.value;
    const values = Array.isArray(props.value) ? props.value : String(props.value ?? '').split(',');
    return values.map(value => {
      const match = options.find(item => String(item.value) === String(value));
      return { text: match?.text ?? match?.label ?? (props.fallback || (value == null || value === '' ? '—' : String(value))), color: match?.color || undefined };
    });
  });
</script>
<style scoped>
  .dict-values { white-space: normal; overflow-wrap: anywhere; }
  .dict-values :deep(.ant-tag) { margin-inline-end: 0; white-space: normal; }
</style>
