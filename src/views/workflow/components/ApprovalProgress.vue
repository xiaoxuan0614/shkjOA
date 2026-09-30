<template>
  <section class="approval-progress" aria-label="审批进程">
    <header class="progress-heading"
      ><h2>审批进程</h2><span>第 {{ instance.roundNo }} 轮 · {{ statusLabels[instance.status] || instance.status }}</span></header
    >
    <ol class="progress-list">
      <li v-for="(item, index) in instance.history" :key="index" class="progress-item" :class="tone(item.action)">
        <span class="progress-icon" aria-hidden="true"
          ><CheckOutlined v-if="tone(item.action) === 'success'" /><RollbackOutlined v-else-if="item.action === 'RETURN'" /><CloseOutlined
            v-else-if="tone(item.action) === 'danger'" /><UserOutlined v-else
        /></span>
        <div class="progress-content">
          <div class="progress-title"
            ><strong>{{ item.node_name || label(item.action) }}</strong
            ><time>{{ formatTime(item.created_at) }}</time></div
          >
          <div class="progress-meta"
            ><span v-if="item.actor_name || item.actor_id" class="person-chip"><UserOutlined />{{ item.actor_name || item.actor_id }}</span
            ><span class="action-status">{{ label(item.action) }}</span></div
          >
          <blockquote v-if="item.comment_text">{{ item.comment_text }}</blockquote>
        </div>
      </li>
      <li v-for="task in instance.tasks" :key="task.id" class="progress-item active">
        <span class="progress-icon" aria-hidden="true"><ClockCircleOutlined /></span>
        <div class="progress-content"
          ><div class="progress-title"
            ><strong>{{ task.name }}</strong
            ><span class="current-label">当前节点</span></div
          ><div class="progress-meta">
            <span class="person-chip" :aria-label="`待审批：${peopleNames(task.pendingUsers)}`"><UserOutlined />{{ peopleNames(task.pendingUsers) }}</span>
            <span class="action-status">{{ task.kind === 'WORK' ? '任务待完成' : '待审批' }}</span>
          </div
          ><p v-if="task.description" class="task-description">{{ task.description }}</p
          ><slot name="task" :task="task"
        /></div>
      </li>
      <li v-if="instance.status !== 'RUNNING'" class="progress-item" :class="instance.status === 'APPROVED' ? 'success' : 'muted'">
        <span class="progress-icon" aria-hidden="true"><CheckOutlined v-if="instance.status === 'APPROVED'" /><MinusOutlined v-else /></span
        ><div class="progress-content"
          ><strong>{{ instance.status === 'APPROVED' ? '审批完成' : '本轮已结束' }}</strong
          ><p class="action-status">{{ statusLabels[instance.status] || instance.status }}</p></div
        >
      </li>
    </ol>
    <a-empty v-if="!instance.history.length && !instance.tasks.length && instance.status === 'RUNNING'" description="暂无可显示的审批进程" />
    <p class="progress-note">展示本轮实际记录与当前任务，后续节点以流程实际流转为准。</p>
  </section>
</template>
<script setup lang="ts">
  import dayjs from 'dayjs';
  import { CheckOutlined, CloseOutlined, ClockCircleOutlined, RollbackOutlined, UserOutlined, MinusOutlined } from '@ant-design/icons-vue';
  import type { WorkflowInstance } from '../workflow.types';
  import { peopleNames } from '../instancePresentation';
  import { statusLabels } from '../workflow';
  defineProps<{ instance: WorkflowInstance }>();
  const labels: Record<string, string> = {
    START: '发起审批',
    SUBMIT: '提交申请',
    RESUBMIT: '重新提交',
    APPROVE: '已同意',
    AUTO_APPROVE: '自动通过',
    REJECT: '已驳回',
    RETURN: '已退回',
    WITHDRAW: '已撤回',
    COMPLETE: '任务已完成',
    TRANSFER: '转办',
    DELEGATE: '委托',
    RESOLVE: '完成委托',
    ADD_SIGN: '加签',
    REMOVE_SIGN: '减签',
    REASSIGN: '改派',
    EDIT_DATA: '修改表单',
    COMMENT: '评论',
  };
  const label = (action: string) => labels[action] || action;
  const tone = (action: string) =>
    ['APPROVE', 'AUTO_APPROVE', 'COMPLETE', 'START', 'SUBMIT', 'RESUBMIT'].includes(action)
      ? 'success'
      : ['REJECT', 'RETURN'].includes(action)
        ? 'danger'
        : action === 'WITHDRAW'
          ? 'muted'
          : 'info';
  function formatTime(value: string | number) {
    if (value == null || value === '') return '';
    const date = dayjs(value);
    return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : String(value);
  }
</script>
<style scoped>
  .approval-progress {
    margin-top: 28px;
    color: #303448;
  }
  .progress-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 24px;
  }
  .progress-heading h2 {
    font-size: 16px;
    margin: 0;
    font-weight: 600;
  }
  .progress-heading > span,
  .progress-note {
    font-size: 12px;
    color: #737b8c;
  }
  .progress-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .progress-item {
    position: relative;
    display: flex;
    gap: 16px;
    padding-bottom: 28px;
    --progress-color: #6370d7;
  }
  .progress-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 15px;
    top: 35px;
    bottom: 5px;
    width: 1px;
    background: #dce1ed;
  }
  .progress-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--progress-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .success {
    --progress-color: #179a65;
  }
  .danger {
    --progress-color: #d14343;
  }
  .active {
    --progress-color: #405bdb;
  }
  .muted {
    --progress-color: #858c9b;
  }
  .progress-content {
    flex: 1;
    min-width: 0;
    padding-top: 5px;
  }
  .progress-title {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  .progress-title strong {
    font-size: 14px;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .progress-title time {
    color: #737b8c;
    font-size: 12px;
    white-space: nowrap;
  }
  .progress-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 8px;
  }
  .person-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    background: #eef0ff;
    border-radius: 12px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .action-status {
    color: var(--progress-color);
    font-size: 12px;
    margin: 6px 0;
  }
  .current-label {
    font-size: 12px;
    color: #405bdb;
    background: #eef1ff;
    padding: 2px 8px;
    border-radius: 4px;
  }
  blockquote {
    margin: 10px 0 0;
    padding: 10px 12px;
    background: #f6f7fa;
    border-left: 2px solid #e0e4ec;
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .task-description {
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .progress-note {
    margin: 0 0 16px;
  }
  @media (max-width: 600px) {
    .progress-title {
      flex-wrap: wrap;
      gap: 4px;
    }
    .progress-title time {
      width: 100%;
    }
    .progress-heading {
      align-items: flex-start;
    }
    .progress-item {
      gap: 12px;
    }
  }
</style>
