<template>
  <div>
    <a-select :value="value || undefined" :options="options" :disabled="disabled" :loading="loading" show-search allow-clear option-filter-prop="label" placeholder="请选择单位" aria-required="true" :aria-label="label" style="width: 100%" @dropdown-visible-change="open" @change="change" />
    <div v-if="error" role="alert" class="unit-error">{{ error }}<a-button type="link" size="small" :disabled="disabled || loading" @click="load">重试</a-button></div>
  </div>
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { initDictOptions } from '/@/utils/dict';
  const props = defineProps<{ value?: string; disabled?: boolean; label?: string }>();
  const emit = defineEmits<{ change: [value: string] }>();
  const items = ref<{ label: string; value: string }[]>([]);
  const loading = ref(false), loaded = ref(false), error = ref('');
  const options = computed(() => props.value && !items.value.some(item => item.value === props.value)
    ? [{ label: props.value, value: props.value }, ...items.value] : items.value);
  async function load() {
    if (loading.value || props.disabled) return;
    loading.value = true; error.value = '';
    try {
      const result = await initDictOptions('inv_unit');
      if (!Array.isArray(result)) throw new Error('invalid units');
      const names = result.map(item => String(item.text ?? item.label ?? '').trim()).filter(Boolean);
      items.value = [...new Set(names)].map(name => ({ label: name, value: name }));
      loaded.value = items.value.length > 0;
      if (!loaded.value) error.value = '单位字典暂无选项';
    } catch { error.value = '单位加载失败'; }
    finally { loading.value = false; }
  }
  function open(visible: boolean) { if (visible && !loaded.value) void load(); }
  function change(value?: string) { if (!props.disabled) emit('change', value || ''); }
</script>
<style scoped>
  .unit-error { color: #cf1322; font-size: 12px; }
</style>
