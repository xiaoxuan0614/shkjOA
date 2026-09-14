<template>
  <TodoCenterCard class="analysis-todo-center" />
</template>

<script lang="ts" setup>
  import TodoCenterCard from '/@/views/todo/components/TodoCenterCard.vue';

  defineOptions({ name: 'DashboardAnalysis' });
</script>

<style lang="less" scoped>
  .analysis-todo-center {
    margin: 16px;
  }
</style>
