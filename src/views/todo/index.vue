<template>
  <PageWrapper content-full-height>
    <a-card title="项目成员邀请" :bordered="false">
      <template #extra>
        <a-button type="primary" ghost :loading="invitationLoading" @click="refreshInvitations(true)">刷新</a-button>
      </template>
      <a-table row-key="id" :columns="columns" :data-source="invitations" :loading="invitationLoading" :pagination="false" :scroll="{ x: 820 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'project'">
            <div class="todo-invitation__project">{{ record.periodName || record.projectName || '—' }}</div>
            <div v-if="record.periodName && record.projectName" class="todo-invitation__secondary">{{ record.projectName }}</div>
          </template>
          <template v-else-if="column.key === 'manager'">{{ record.projectManagerName || '项目经理' }}</template>
          <template v-else-if="column.key === 'role'">{{ roleMap[String(record.memberRole)] || record.memberRole || '—' }}</template>
          <template v-else-if="column.key === 'status'"><a-tag color="processing">待确认</a-tag></template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" @click="openInvitation(record)">办理</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <ProjectBasicDrawer @register="registerDrawer" />
  </PageWrapper>
</template>

<script lang="ts" name="todo-list" setup>
  import { onMounted, ref } from 'vue';
  import { PageWrapper } from '/@/components/Page';
  import { useDrawer } from '/@/components/Drawer';
  import ProjectBasicDrawer from '/@/views/project/components/ProjectBasicDrawer.vue';
  import { loadDictOptions } from '/@/views/project/Project.data';
  import { ProjectInvitation, useProjectInvitations } from '/@/views/project/plan/useProjectInvitations';

  defineOptions({ name: 'ProjectInvitationTodo' });

  const { invitations, invitationLoading, refreshInvitations } = useProjectInvitations();
  const [registerDrawer, { openDrawer }] = useDrawer();
  const roleMap = ref<Recordable>({});
  const columns = [
    { title: '项目/分期', key: 'project', width: 240 },
    { title: '邀请人', key: 'manager', width: 150 },
    { title: '参与角色', key: 'role', width: 140 },
    { title: '邀请时间', dataIndex: 'inviteTime', width: 180 },
    { title: '状态', key: 'status', width: 100, align: 'center' },
    { title: '操作', key: 'action', width: 100, align: 'center', fixed: 'right' },
  ];

  function openInvitation(invitation: ProjectInvitation) {
    openDrawer(true, { record: invitation, invitation });
  }

  onMounted(async () => {
    const [roles] = await Promise.all([loadDictOptions('member_role'), refreshInvitations(true)]);
    roleMap.value = Object.fromEntries((roles || []).map((item) => [String(item.value), item.label]));
  });
</script>

<style lang="less" scoped>
  .todo-invitation {
    &__project {
      color: #262626;
      font-weight: 500;
    }

    &__secondary {
      margin-top: 2px;
      color: #8c8c8c;
      font-size: 12px;
    }
  }
</style>
