<template>
  <div>
    <a-select
      :value="value || []"
      mode="multiple"
      :options="options"
      :loading="loading"
      show-search
      :filter-option="false"
      :placeholder="placeholder || '搜索并选择'"
      :max-tag-count="3"
      allow-clear
      @search="search"
      @change="(ids) => emit('update:value', ids)"
      @focus="initialize"
    >
      <template #dropdownRender="{ menuNode }">
        <component :is="menuNode" />
        <div class="directory-footer">
          <a-button v-if="error" size="small" danger @mousedown.prevent @click="fetchPage(1)">加载失败，重试</a-button>
          <a-button v-else-if="hasMore" size="small" type="link" :loading="loading" @mousedown.prevent @click="fetchPage(page + 1)"
            >加载更多</a-button
          >
          <span v-else>可输入关键词查找</span>
        </div>
      </template>
    </a-select>
    <span v-if="error" role="alert" class="directory-error">{{ error }}</span>
  </div>
</template>
<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { directory } from '../Workflow.api';
  const props = defineProps<{ value?: string[]; kind: 'users' | 'roles' | 'departments' | 'positions'; placeholder?: string }>();
  const emit = defineEmits<{ (e: 'update:value', value: string[]): void }>();
  const entries = ref<{ value: string; label: string }[]>([]);
  const cache = new Map<string, string>();
  const resolved = ref(0);
  let resolveGeneration = 0;
  const loading = ref(false),
    error = ref(''),
    page = ref(1),
    total = ref(0);
  let query = '',
    generation = 0,
    initialized = false;
  let timer: ReturnType<typeof setTimeout>;
  const options = computed(() => {
    void resolved.value;
    const values = new Map(entries.value.map((entry) => [entry.value, entry.label]));
    for (const id of props.value || []) if (!values.has(id)) values.set(id, cache.get(id) || `已选 ${id}`);
    return [...values].map(([value, label]) => ({ value, label }));
  });
  const hasMore = computed(() => page.value * 30 < total.value);
  async function fetchPage(next: number) {
    const current = ++generation;
    loading.value = true;
    error.value = '';
    try {
      const result = await directory(props.kind, query, next);
      if (current !== generation) return;
      const rows = result.records.map((item) => ({ value: item.id, label: item.name || item.username || item.code || item.id }));
      rows.forEach((item) => cache.set(item.value, item.label));
      entries.value = next === 1 ? rows : [...entries.value, ...rows];
      page.value = next;
      total.value = result.total;
      initialized = true;
    } catch (e) {
      if (current === generation) error.value = (e as Error).message;
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  function search(value: string) {
    query = value.trim();
    generation++;
    clearTimeout(timer);
    timer = setTimeout(() => fetchPage(1), 250);
  }
  function initialize() {
    if (!initialized && !loading.value) fetchPage(1);
  }
  watch(
    () => [props.kind, ...(props.value || [])],
    async () => {
      const current = ++resolveGeneration;
      const missing = new Set((props.value || []).filter((id) => !cache.has(id)));
      if (!missing.size) return;
      try {
        let next = 1;
        let more = true;
        while (missing.size && more && current === resolveGeneration) {
          const result = await directory(props.kind, '', next);
          if (current !== resolveGeneration) return;
          for (const item of result.records) {
            cache.set(item.id, item.name || item.username || item.code || item.id);
            missing.delete(item.id);
          }
          resolved.value++;
          more = result.records.length > 0 && next * 30 < result.total;
          next++;
        }
        if (missing.size) error.value = '部分已选对象已失效或不可见，保留原标识，请核对后调整。';
      } catch (e) {
        if (current === resolveGeneration) error.value = (e as Error).message;
      }
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    resolveGeneration++;
    generation++;
    clearTimeout(timer);
  });
</script>
<style scoped>
  .ant-select {
    width: 100%;
  }
  .directory-footer {
    padding: 6px 12px;
    color: #595959;
    font-size: 12px;
  }
  .directory-error {
    color: #b42318;
    font-size: 12px;
  }
</style>
