<template>
  <a-card class="todo-center-card" :bordered="false">
    <template #title>
      <div class="todo-center-card__title"><span>我的待办</span><a-badge :count="todoTotal" :overflow-count="99" /></div>
    </template>
    <template #extra>
      <a-button type="link" :loading="todoLoading" @click="refreshTodos(true)">刷新</a-button>
    </template>
    <a-list class="todo-center-card__list" :loading="todoLoading" :data-source="todos">
      <template #renderItem="{ item }">
        <a-list-item>
          <div class="todo-center-card__row">
            <a-tag class="todo-center-card__type" :color="todoTypeColor(item.todoType)">{{ todoTypeText(item.todoType) }}</a-tag>
            <span class="todo-center-card__summary">{{ item.summary || '—' }}</span>
            <span class="todo-center-card__applicant"
              >申请人：{{ item.applyUserName?.trim() || item.realName?.trim() || item.createBy?.trim() || '—' }}</span
            >
            <span class="todo-center-card__time">{{ item.createTime || item.updateTime || '—' }}</span>
          </div>
          <template #actions><a-button type="link" @click="actionHostRef?.openTodo(item)">查看详情</a-button></template>
        </a-list-item>
      </template>
      <template #empty><a-empty :image="simpleImage" description="暂无待办" /></template>
    </a-list>
  </a-card>
  <TodoActionHost ref="actionHostRef" @processed="refreshTodos(true)" />
</template>

<script lang="ts" setup>
  import { Empty } from 'ant-design-vue';
  import { onMounted, ref } from 'vue';
  import TodoActionHost from './TodoActionHost.vue';
  import { todoTypeColor, todoTypeText, useTodoCenter } from '../useTodoCenter';

  const simpleImage = Empty.PRESENTED_IMAGE_SIMPLE;
  const actionHostRef = ref();
  const { todos, todoTotal, todoLoading, refreshTodos } = useTodoCenter();

  onMounted(() => refreshTodos());
</script>

<style lang="less" scoped>
  .todo-center-card {
    &__title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    &__summary {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__list {
      max-height: 420px;
      overflow-y: auto;
    }

    &__row {
      display: flex;
      min-width: 0;
      flex: 1;
      align-items: center;
      gap: 12px;
    }

    &__type {
      flex: 0 0 auto;
      margin-inline-end: 0;
      white-space: nowrap;
    }

    &__time {
      color: #595959;
      white-space: nowrap;
    }
    &__applicant {
      flex: 0 1 180px;
      min-width: 0;
      color: #595959;
      overflow-wrap: anywhere;
    }
    :deep(.ant-card-body) {
      padding-top: 4px;
    }
  }
  @media (max-width: 576px) {
    .todo-center-card__row {
      flex-wrap: wrap;
      gap: 6px 8px;
    }

    .todo-center-card__summary {
      flex-basis: calc(100% - 100px);
    }

    .todo-center-card__time {
      width: 100%;
    }
    .todo-center-card__applicant {
      flex-basis: 100%;
    }
  }
</style>
