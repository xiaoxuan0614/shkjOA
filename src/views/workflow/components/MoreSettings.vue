<template>
  <div class="more-page"
    ><section class="more-sheet" aria-label="更多配置">
      <a-tabs v-model:activeKey="tab" class="more-tabs">
        <a-tab-pane key="notifications" tab="通知配置">
          <h2>通知类型设置</h2>
          <table class="notification-table"
            ><tbody
              ><tr v-for="item in notifications" :key="item[0]">
                <th scope="row">{{ item[1] }}</th
                ><td>{{ item[2] }}</td
                ><td class="switch-cell"
                  ><a-switch
                    size="small"
                    :checked="eventEnabled(item[0])"
                    :disabled="!capabilities"
                    :aria-label="item[1] + '通知'"
                    @change="(v) => setEvent(item[0], !!v)"
                /></td> </tr></tbody
          ></table>
          <h2 class="channel-heading">通知方式</h2>
          <a-checkbox-group
            :value="settings.channels || ['SITE']"
            :disabled="!capabilities"
            @change="(v) => update({ channels: v.map(String) })"
            class="channels"
          >
            <a-checkbox value="EMAIL" disabled>邮件（未接通）</a-checkbox><a-checkbox value="WECHAT" disabled>微信公众号（未接通）</a-checkbox
            ><a-checkbox value="SITE">站内信</a-checkbox>
          </a-checkbox-group>
          <a-button v-if="settings.channels?.some((c) => c !== 'SITE')" type="link" @click="update({ channels: ['SITE'] })"
            >将旧通知方式改为仅站内信</a-button
          >
        </a-tab-pane>
        <a-tab-pane key="other" tab="其他配置">
          <section class="setting-group"
            ><h2>节点超时提醒</h2
            ><a-checkbox-group
              :value="settings.reminderHours || []"
              :disabled="!capabilities"
              class="vertical-options"
              @change="(v) => update({ reminderHours: v.map(Number) })"
              ><a-checkbox v-for="h in [24, 48, 96]" :key="h" :value="h">到达节点{{ h }}小时</a-checkbox></a-checkbox-group
            ><p class="scope-note">节点单独设置的超时分钟优先；提醒不会自动通过审批。</p></section
          >
          <section class="setting-group"
            ><h2>发起人权限</h2><a-checkbox disabled :checked="false">c（尚未定义，不启用）</a-checkbox>
            <a-radio-group
              :value="settings.withdrawMode || 'ANYTIME'"
              :disabled="!capabilities"
              class="vertical-options"
              @change="(e) => update({ withdrawMode: e.target.value })"
              ><a-radio value="ANYTIME">审批结束前允许撤回</a-radio><a-radio value="BEFORE_FIRST_APPROVAL">首次审批或任务完成前允许撤回</a-radio
              ><a-radio value="DISABLED">不允许撤回</a-radio></a-radio-group
            >
          </section>
          <section class="setting-group"
            ><h2>审批人去重规则</h2
            ><a-radio-group
              :value="settings.duplicateApproval || 'EVERY_NODE'"
              :disabled="!capabilities"
              class="vertical-options"
              @change="(e) => update({ duplicateApproval: e.target.value })"
              ><a-radio value="APPROVED_BEFORE">同一轮相同数据已通过，其余自动同意</a-radio><a-radio value="CONSECUTIVE">仅连续节点时自动同意</a-radio
              ><a-radio value="EVERY_NODE">每个节点都需要审批人审批</a-radio></a-radio-group
            ></section
          >
          <a-button
            v-if="settings.undefinedInitiatorOption || settings.autoCompleteNextMonthDay != null"
            type="link"
            @click="update({ undefinedInitiatorOption: false, autoCompleteNextMonthDay: null })"
            >清除不支持的旧配置</a-button
          >
          <section class="setting-group"
            ><h2>超时自动完成</h2><a-checkbox disabled :checked="false">次月自动完成（尚未定义，不启用）</a-checkbox></section
          >
        </a-tab-pane>
        <a-tab-pane key="printing" tab="打印配置"
          ><a-alert type="info" message="审批详情可读取有权限的打印数据。当前不支持配置打印模板；节点按钮配置可控制打印权限。"
        /></a-tab-pane>
      </a-tabs>
      <p class="scope-note">关闭待办通知不影响待办记录。邮件、公众号、回调和次月自动完成尚未接通。</p>
    </section></div
  >
</template>
<script setup lang="ts">
  import { ref, computed, inject } from 'vue';
  import type { DesignerCapabilities, WorkflowSettings } from '../workflow.types';
  const props = defineProps<{ value?: WorkflowSettings }>();
  const emit = defineEmits<{ (e: 'update:value', value: WorkflowSettings): void }>();
  const capabilities = inject<import('vue').Ref<DesignerCapabilities | null>>('workflowCapabilities', ref(null));
  const settings = computed(() => props.value || {});
  const tab = ref('notifications');
  function update(patch: Partial<WorkflowSettings>) {
    emit('update:value', { ...settings.value, ...patch });
  }
  function eventEnabled(key: string) {
    return settings.value.notifications?.[key] ?? key !== 'TASK';
  }
  function setEvent(key: string, value: boolean) {
    update({ notifications: { ...settings.value.notifications, [key]: value } });
  }
  const notifications = [
    ['TASK', '待办', '产生新的待办时通知该节点负责人'],
    ['RESULT', '申请结果', '流程结束后通知发起人'],
    ['CC', '抄送', '通知抄送接收者，关闭仍保留抄送记录'],
    ['RETURN', '退回', '通知退回目标负责人或发起人'],
    ['REMIND', '催办', '通知当前待办负责人'],
    ['COMMENT', '评论', '通知被提及的已有参与者'],
    ['TIMEOUT', '超时提醒', '按节点激活时间触发提醒'],
    ['ESCALATION', '升级通知', '通知节点设置的超时升级接收人'],
    ['NOTICE', '通知节点', '按通知节点配置投递消息'],
  ];
</script>
<style scoped>
  .more-page {
    background: #f7f8fc;
    padding: 16px 24px 28px;
    min-height: 640px;
  }
  .more-sheet {
    width: 100%;
    max-width: 780px;
    min-height: 740px;
    margin: 0 auto;
    padding: 0 28px 24px;
    background: #fff;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    color: #303448;
    font-size: 13px;
  }
  .more-tabs {
    flex: 1;
  }
  .more-tabs :deep(.ant-tabs-nav) {
    margin: 0 0 28px;
  }
  .more-tabs :deep(.ant-tabs-nav::before) {
    border: 0;
  }
  .more-tabs :deep(.ant-tabs-tab) {
    padding: 18px 0 10px;
    font-size: 13px;
  }
  .more-tabs :deep(.ant-tabs-tab + .ant-tabs-tab) {
    margin-left: 52px;
  }
  .more-tabs :deep(.ant-tabs-tab-btn) {
    color: #737c94;
  }
  .more-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
    color: #6266dc;
  }
  .more-tabs :deep(.ant-tabs-ink-bar) {
    background: #7371e6;
  }
  h2 {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 16px;
    line-height: 20px;
  }
  h2 span {
    color: #737c94;
    font-weight: 400;
    margin-left: 6px;
  }
  .notification-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    line-height: 20px;
  }
  .notification-table th,
  .notification-table td {
    border: 1px solid #eceef3;
    padding: 7px 4px;
    text-align: left;
  }
  .notification-table th {
    width: 104px;
    background: #f7f8fc;
    font-weight: 400;
  }
  .notification-table .switch-cell {
    width: 112px;
    text-align: center;
  }
  .notification-table :deep(.ant-switch-checked) {
    background: #24c989;
    opacity: 1;
  }
  .channel-heading {
    margin-top: 24px;
  }
  .channels {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  }
  .setting-group {
    margin-bottom: 24px;
  }
  .vertical-options {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  .more-sheet :deep(.ant-checkbox-wrapper),
  .more-sheet :deep(.ant-radio-wrapper) {
    font-size: 13px;
    margin: 0;
    line-height: 20px;
  }
  .more-sheet :deep(.ant-checkbox-disabled + span),
  .more-sheet :deep(.ant-radio-disabled + span) {
    color: #303448;
  }
  .more-sheet :deep(.ant-checkbox-disabled.ant-checkbox-checked .ant-checkbox-inner) {
    background: #7371e6;
    border-color: #7371e6;
  }
  .more-sheet :deep(.ant-checkbox-disabled.ant-checkbox-checked .ant-checkbox-inner::after) {
    border-color: white;
  }
  .more-sheet :deep(.ant-radio-disabled.ant-radio-checked .ant-radio-inner) {
    background: #fff;
    border-color: #7371e6;
  }
  .more-sheet :deep(.ant-radio-disabled.ant-radio-checked .ant-radio-inner::after) {
    background: #7371e6;
  }
  .timeout-option {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .timeout-option .ant-input {
    width: 112px;
    font-size: 12px;
  }
  .preview-label {
    color: #626b7d;
    font-size: 12px;
  }
  .scope-note {
    font-size: 12px;
    color: #626b7d;
    line-height: 1.7;
    margin: 40px 0 0;
  }
  .print-empty {
    margin-top: 80px;
  }
  @media (max-width: 760px) {
    .more-page {
      padding: 12px;
    }
    .more-sheet {
      padding: 0 16px 20px;
      min-height: 680px;
    }
    .more-tabs :deep(.ant-tabs-tab + .ant-tabs-tab) {
      margin-left: 28px;
    }
    .notification-table th {
      width: 64px;
    }
    .notification-table .switch-cell {
      width: 44px;
    }
  }
</style>
