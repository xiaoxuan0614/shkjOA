<template>
  <DutyRosterEditor v-if="month" :key="month" :month="month" @back="router.push('/operation/list')" />
  <a-empty v-else description="请选择排班月份">
    <a-button @click="router.push('/operation/list')">返回列表</a-button>
  </a-empty>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import DutyRosterEditor from './DutyRosterEditor.vue';

  defineOptions({ name: 'OperationDutyRosterDetail' });
  const route = useRoute();
  const router = useRouter();
  const month = computed(() => {
    const value = route.query.month;
    return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : '';
  });
</script>
