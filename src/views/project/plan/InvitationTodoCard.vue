<template>
  <a-card class="invitation-todo-card" :bordered="false">
    <template #title>
      <div class="invitation-todo-card__title">
        <span>我的待办</span>
        <a-badge :count="invitationTotal" :overflow-count="99" />
      </div>
    </template>
    <template #extra>
      <a-button type="link" :loading="invitationLoading" @click="refreshInvitations(true)">刷新</a-button>
    </template>

    <a-list :loading="invitationLoading" :data-source="invitations.slice(0, 5)">
      <template #renderItem="{ item }">
        <a-list-item>
          <template #actions>
            <a-button type="link" @click="openInvitation(item)">办理</a-button>
          </template>
          <a-list-item-meta>
            <template #title>{{ invitationName(item) }}</template>
            <template #description>
              {{ item.projectManagerName }}项目经理邀请你加入该项目
              <span class="invitation-todo-card__time">{{ item.inviteTime || item.createTime || '' }}</span>
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
      <template #empty>
        <a-empty :image="simpleImage" description="暂无待处理的项目邀请" />
      </template>
    </a-list>
  </a-card>

  <ProjectBasicDrawer @register="registerDrawer" />
</template>

<script lang="ts" setup>
  import { Empty } from 'ant-design-vue';
  import { onMounted } from 'vue';
  import { useDrawer } from '/@/components/Drawer';
  import ProjectBasicDrawer from '../components/ProjectBasicDrawer.vue';
  import { ProjectInvitation, useProjectInvitations } from './useProjectInvitations';

  const simpleImage = Empty.PRESENTED_IMAGE_SIMPLE;
  const { invitations, invitationTotal, invitationLoading, refreshInvitations } = useProjectInvitations();
  const [registerDrawer, { openDrawer }] = useDrawer();

  function invitationName(item: ProjectInvitation) {
    return item.periodName || item.projectName || '项目成员邀请';
  }

  function openInvitation(invitation: ProjectInvitation) {
    openDrawer(true, { record: invitation, invitation });
  }

  onMounted(() => refreshInvitations());
</script>

<style lang="less" scoped>
  .invitation-todo-card {
    &__title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    &__time {
      margin-left: 12px;
      color: #8c8c8c;
      white-space: nowrap;
    }

    :deep(.ant-card-body) {
      padding-top: 4px;
    }

    :deep(.ant-list-item-meta-title) {
      margin-bottom: 4px;
      font-weight: 500;
    }
  }

  @media (max-width: 576px) {
    .invitation-todo-card__time {
      display: block;
      margin: 4px 0 0;
    }
  }
</style>
