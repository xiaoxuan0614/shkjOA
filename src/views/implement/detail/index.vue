<template>
  <ImplementLogDetailContent
    :key="`${periodId}:${logId}`"
    :period-id="periodId"
    :log-id="logId"
    :process-id="String(route.query.processId || '')"
    @back="goBack"
  />
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import ImplementLogDetailContent from '../components/ImplementLogDetailContent.vue';
  defineOptions({ name: 'ImplementLogDetail' });
  const route = useRoute();
  const router = useRouter();
  const periodId = computed(() => String(route.params.id || ''));
  const logId = computed(() => String(route.params.logId || ''));
  function goBack() {
    router.push(periodId.value ? { path: `/implement/log/${periodId.value}`, query: { processId: route.query.processId } } : '/implement/list');
  }
</script>
