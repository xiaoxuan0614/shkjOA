<template>
  <ol v-if="Array.isArray(parsed) && parsed.length" class="snapshot-items">
    <li v-for="(item, index) in parsed" :key="index">
      <SnapshotContent :value="item" :path="`${path}[]`" :fields="fields" :permissions="permissions" />
    </li>
  </ol>
  <dl v-else-if="entries.length" class="snapshot-fields">
    <div v-for="entry in entries" :key="entry.key" class="snapshot-field">
      <dt>{{ entry.label }}</dt>
      <dd><SnapshotContent :value="entry.value" :path="entry.key" :fields="fields" :permissions="permissions" /></dd>
    </div>
  </dl>
  <span v-else class="snapshot-text">{{ parsed && typeof parsed === 'object' ? '—' : snapshotText(parsed, path) }}</span>
</template>
<script setup lang="ts">
  import { computed } from 'vue';
  import type { FormField } from '../workflow.types';
  import { snapshotEntries, snapshotText, snapshotValue } from '../snapshotPresentation';
  const props = withDefaults(defineProps<{ value: unknown; path?: string; fields?: FormField[]; permissions?: Record<string, string> }>(), {
    path: '', fields: () => [], permissions: () => ({}),
  });
  const parsed = computed(() => snapshotValue(props.value));
  const entries = computed(() => parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)
    ? snapshotEntries(parsed.value as Record<string, unknown>, props.path, props.fields, props.permissions) : []);
</script>
<style scoped>
  .snapshot-items { margin: 0; padding-left: 22px; }
  .snapshot-items > li + li { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color-split, #dcdee7); }
  .snapshot-fields { margin: 0; }
  .snapshot-field { display: grid; grid-template-columns: minmax(84px, 120px) minmax(0, 1fr); gap: 12px; padding: 6px 0; }
  .snapshot-field dt { color: #595959; font-weight: 400; }
  .snapshot-field dd { margin: 0; min-width: 0; }
  .snapshot-text, .snapshot-field { white-space: pre-wrap; overflow-wrap: anywhere; }
  @media (max-width: 600px) { .snapshot-field { grid-template-columns: 1fr; gap: 4px; } }
</style>
