<template>
  <div class="more-page">
    <section class="more-sheet" aria-label="更多配置">
      <a-tabs v-model:activeKey="tab" class="more-tabs">
        <template #rightExtra><span class="preview-label">原稿预览 · 尚未接入</span></template>
        <a-tab-pane key="notifications" tab="通知配置">
          <h2>通知类型设置</h2>
          <table class="notification-table" aria-label="通知类型设置（原稿预览）">
            <tbody
              ><tr v-for="item in notifications" :key="item[0]">
                <th scope="row">{{ item[0] }}</th
                ><td>{{ item[1] }}</td>
                <td class="switch-cell"><a-switch size="small" :checked="true" disabled :aria-label="item[0] + '通知，尚未接入'" /></td> </tr
            ></tbody>
          </table>
          <h2 class="channel-heading">通知方式</h2>
          <div class="channels"
            ><a-checkbox :checked="true" disabled>邮件</a-checkbox><a-checkbox disabled>微信公众号</a-checkbox
            ><a-checkbox disabled>站内信</a-checkbox></div
          >
        </a-tab-pane>
        <a-tab-pane key="other" tab="其他配置">
          <section class="setting-group"
            ><h2>节点超时提醒</h2
            ><div class="vertical-options">
              <a-checkbox v-for="hours in [24, 48, 96]" :key="hours" :checked="hours === 24" disabled>到达节点{{ hours }}小时</a-checkbox>
            </div></section
          >
          <section class="setting-group"
            ><h2>发起人权限</h2
            ><div class="vertical-options">
              <a-checkbox :checked="true" disabled><span title="原稿此处显示为 c，完整文案待确认">c</span></a-checkbox>
              <a-checkbox disabled>审批结束前可随意撤销</a-checkbox>
            </div></section
          >
          <section class="setting-group"
            ><h2>审批人去重规则 <span>同一个审批人在同流程多节点内出现</span></h2>
            <a-radio-group value="once" disabled class="vertical-options"
              ><a-radio value="once">审批一次通过后，其余自动同意</a-radio><a-radio value="adjacent">仅连续节点时自动同意</a-radio
              ><a-radio value="each">每个节点都需要审批人审批</a-radio></a-radio-group
            >
          </section>
          <section class="setting-group"
            ><h2>超时自动完成</h2
            ><div class="vertical-options">
              <div class="timeout-option"
                ><a-checkbox :checked="true" disabled>超时后自动完成</a-checkbox><span>次月</span
                ><a-input placeholder="请输入次月日期" disabled aria-label="次月自动完成日期"
              /></div>
              <a-checkbox disabled>不自动</a-checkbox>
            </div></section
          >
        </a-tab-pane>
        <a-tab-pane key="printing" tab="打印配置"><a-empty class="print-empty" description="尚未提供打印配置设计稿" /></a-tab-pane>
      </a-tabs>
      <p class="scope-note">原稿预览：选中状态不代表已生效。这些全局规则尚未接入，暂不可修改；不会随流程发布。</p>
    </section>
  </div>
</template>
<script setup lang="ts">
  import { ref } from 'vue';
  const tab = ref('notifications');
  const notifications = [
    ['待办', '当节点有新的待办事项时（含转交），对该节点负责人进行通知'],
    ['申请结果', '流程结束后，对该流程发起人进行申请结果通知，包含：已通过、已拒绝'],
    ['抄送', '当有新的抄送时，对节点中设置的抄送人员进行通知'],
    ['退回', '当已办或者申请被退回时，对被退回的节点负责人或者发起人进行通知'],
    ['催办', '被催办事，对当前流程节点负责人进行通知'],
    ['评论', '对在评论中被@的成员进行通知'],
    ['超时提醒', '待办中的超时提醒条件出发后，对指定人进行通知'],
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
