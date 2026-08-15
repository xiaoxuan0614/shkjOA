<template>
  <a-card>
    <a-result :title="`${title} · 功能开发中`" sub-title="该模块设计稿尚未提供，待确认需求后开发。" />
  </a-card>
</template>

<script lang="ts" name="placeholder-page" setup>
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';

  const route = useRoute();
  const title = computed(() => (route.meta?.title as string) || '模块');
</script>
