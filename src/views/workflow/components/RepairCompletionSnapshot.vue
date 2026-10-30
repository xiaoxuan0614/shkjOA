<template>
  <div class="completion-snapshot">
    <section v-for="group in sections" :key="group.key" :aria-label="group.title">
      <h3>{{ group.title }}</h3>
      <p v-if="group.key === 'fees' && noQuotation">无需报价</p>
      <template v-else-if="group.rows.length">
        <a-collapse v-if="group.key === 'work'" ghost>
          <a-collapse-panel key="records" header="展开维修记录及参与情况">
            <a-descriptions bordered :column="1" size="small">
              <a-descriptions-item v-for="row in group.rows" :key="row.field.key" :label="row.field.name"><BusinessSnapshotValue :field="row.field" :value="row.value" :fields="fields" :permissions="permissions" /></a-descriptions-item>
            </a-descriptions>
          </a-collapse-panel>
        </a-collapse>
        <a-descriptions v-else bordered :column="1" size="small">
          <a-descriptions-item v-for="row in group.rows" :key="row.field.key" :label="row.field.name"><BusinessSnapshotValue :field="row.field" :value="row.value" :fields="fields" :permissions="permissions" /></a-descriptions-item>
        </a-descriptions>
      </template>
    </section>
  </div>
</template>
<script setup lang="ts">
  import { computed } from 'vue';
  import type { FormField } from '../workflow.types';
  import { repairCompletionSections } from '../repairCompletionPresentation';
  import BusinessSnapshotValue from './BusinessSnapshotValue.vue';
  const props = defineProps<{ visible: Record<string, unknown>; fields: FormField[]; permissions?: Record<string, string>; noQuotation?: boolean }>();
  const sections = computed(() => repairCompletionSections(props.visible, props.fields, props.permissions, props.noQuotation)
    .filter(group => group.rows.length > 0 || (group.key === 'fees' && props.noQuotation)));
</script>
<style scoped>
  .completion-snapshot h3 { margin: 20px 0 12px; font-size: 15px; font-weight: 600; }
</style>
