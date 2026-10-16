<template><FinanceDetail :period-id="periodId" @back="router.push('/payment/list')" /></template>
<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import FinanceDetail from '../FinanceDetail.vue';
  defineOptions({ name: 'PaymentDetailPage' });
  const route = useRoute(), router = useRouter();
  const periodId = computed(() => String(route.params.id || ''));
</script>
