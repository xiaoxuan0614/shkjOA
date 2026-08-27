<template>
  <a-modal v-model:open="open" title="项目成员邀请" :width="520" :mask-closable="false" centered destroy-on-close>
    <div v-if="currentInvitation" class="project-invitation-modal">
      <div class="project-invitation-modal__icon">
        <Icon icon="ant-design:mail-outlined" :size="28" />
      </div>
      <div class="project-invitation-modal__content">
        <p class="project-invitation-modal__message">
          <strong>{{ currentInvitation.projectManagerName }}</strong>
          邀请你加入
          <strong>{{ invitationProjectName(currentInvitation) }}</strong>
          项目。
        </p>
        <p class="project-invitation-modal__meta">邀请时间：{{ currentInvitation.inviteTime || currentInvitation.createTime || '—' }}</p>
        <a-tag v-if="invitations.length > 1" color="processing">还有 {{ invitations.length - 1 }} 条待处理邀请</a-tag>
      </div>
    </div>

    <template #footer>
      <a-button @click="open = false">稍后处理</a-button>
      <a-button @click="showDetail">查看详情</a-button>
      <a-button danger :loading="responding === '0'" :disabled="!!responding" @click="respond('0')">拒绝</a-button>
      <a-button type="primary" :loading="responding === '1'" :disabled="!!responding" @click="respond('1')">同意</a-button>
    </template>
  </a-modal>

  <ProjectBasicDrawer @register="registerDrawer" @invitation-processed="showNextInvitation" />
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue';
  import { Icon } from '/@/components/Icon';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import ProjectBasicDrawer from '../components/ProjectBasicDrawer.vue';
  import { ProjectInvitation, useProjectInvitations } from './useProjectInvitations';

  const { createMessage } = useMessage();
  const { invitations, refreshInvitations, handleInvitation } = useProjectInvitations();
  const [registerDrawer, { openDrawer }] = useDrawer();
  const open = ref(false);
  const responding = ref<'' | '0' | '1'>('');
  const currentInvitation = computed(() => invitations.value[0]);

  function invitationProjectName(invitation: ProjectInvitation) {
    return invitation.periodName || invitation.projectName || '当前';
  }

  async function respond(status: '0' | '1') {
    if (!currentInvitation.value || responding.value) return;
    responding.value = status;
    try {
      await handleInvitation(currentInvitation.value.id, status);
      createMessage.success(status === '1' ? '已同意项目邀请' : '已拒绝项目邀请');
      showNextInvitation();
    } finally {
      responding.value = '';
    }
  }

  function showDetail() {
    if (!currentInvitation.value) return;
    open.value = false;
    openDrawer(true, { record: currentInvitation.value, invitation: currentInvitation.value });
  }

  function showNextInvitation() {
    open.value = invitations.value.length > 0;
  }

  onMounted(async () => {
    try {
      await refreshInvitations();
      showNextInvitation();
    } catch {
      // 邀请加载失败不阻断用户进入系统。
    }
  });
</script>

<style lang="less" scoped>
  .project-invitation-modal {
    display: flex;
    gap: 16px;
    padding: 8px 0;

    &__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 52px;
      height: 52px;
      color: #1677ff;
      background: #e6f4ff;
      border-radius: 50%;
    }

    &__content {
      min-width: 0;
    }

    &__message {
      margin: 2px 0 8px;
      color: #262626;
      font-size: 16px;
      line-height: 1.75;
    }

    &__meta {
      margin: 0 0 10px;
      color: #8c8c8c;
      font-size: 13px;
    }
  }
</style>
