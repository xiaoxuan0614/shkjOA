<template>
  <a-drawer :open="open" title="历史轮次" width="min(800px, 96vw)" @close="emit('close')">
    <p>仅展示你有权读取的轮次，点击查看该轮原始表单和审批记录。</p>
    <a-alert v-if="error" type="error" :message="error"
      ><template #action><a-button @click="load">重试</a-button></template></a-alert
    >
    <a-table
      :columns="columns"
      :data-source="rows"
      row-key="id"
      :loading="loading"
      :pagination="{ current: page, pageSize: 10, total, showSizeChanger: false }"
      @change="
        (p) => {
          page = p.current || 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">{{ processName(record) }}</template>
        <template v-else-if="column.key === 'round'">第 {{ record.roundNo }} 轮<br />{{ roundLabel(record.latestRound) }}</template>
        <template v-else-if="column.key === 'status'">{{ statusLabels[record.status] || record.status }}</template>
        <template v-else-if="column.key === 'version'">V{{ record.version }}</template>
        <a-button v-else-if="column.key === 'action'" type="link" @click="emit('select', record.id)">查看本轮</a-button>
      </template>
    </a-table>
  </a-drawer>
</template>
<script setup lang="ts">
  import { ref, watch, onBeforeUnmount } from 'vue';
  import { instanceRounds } from '../Workflow.api';
  import type { WorkflowInstance } from '../workflow.types';
  import { processName, roundLabel } from '../instancePresentation';
  import { statusLabels } from '../workflow';
  const props = defineProps<{ open: boolean; instanceId: string; refreshKey?: number }>();
  const emit = defineEmits<{ (e: 'close'): void; (e: 'select', id: string): void }>();
  const rows = ref<WorkflowInstance[]>([]),
    page = ref(1),
    total = ref(0),
    loading = ref(false),
    error = ref('');
  let generation = 0;
  const columns = [
    { title: '流程', key: 'name' },
    { title: '申请轮次', key: 'round' },
    { title: '流程版本', key: 'version' },
    { title: '状态', key: 'status' },
    { title: '操作', key: 'action' },
  ];
  async function load() {
    if (!props.open || !props.instanceId) return;
    const current = ++generation;
    loading.value = true;
    error.value = '';
    rows.value = [];
    try {
      const result = await instanceRounds(props.instanceId, page.value);
      if (current !== generation) return;
      rows.value = result.records;
      total.value = result.total;
    } catch (e) {
      if (current === generation) {
        error.value = (e as Error).message;
        total.value = 0;
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  watch(
    () => [props.open, props.instanceId],
    () => {
      generation++;
      page.value = 1;
      rows.value = [];
      total.value = 0;
      if (props.open) load();
    },
    { immediate: true }
  );
  watch(
    () => props.refreshKey,
    () => {
      if (props.open) load();
    }
  );
  onBeforeUnmount(() => generation++);
</script>
