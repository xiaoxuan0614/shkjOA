<template>
  <div>
    <BasicTable @register="registerTable">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="statusMeta[record.status]?.color || 'default'">{{ statusMeta[record.status]?.text || '待接受' }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <template v-if="record.status !== '1'">
            <a-button type="link" size="small" @click="handleAccept(record)">同 意</a-button>
            <a-button type="link" danger size="small" @click="handleReject(record)">拒 绝</a-button>
          </template>
          <span v-else>已接收</span>
        </template>
      </template>
    </BasicTable>
  </div>
</template>

<script lang="ts" name="todo-list" setup>
  import { reactive, ref, onMounted } from 'vue';
  import { BasicTable } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { invitationList, acceptInvitation, rejectInvitation } from '/@/views/project/plan/Invite.api';
  import { loadDictOptions } from '/@/views/project/Project.data';

  const { createMessage } = useMessage();
  const queryParam = reactive<any>({});
  // 邀请状态字典(invite_status: 0待接受/1已接收)
  const statusMeta = ref<Recordable>({ '0': { text: '待接受', color: 'default' }, '1': { text: '已接收', color: 'success' } });

  onMounted(async () => {
    try {
      const items: any[] = (await loadDictOptions('invite_status')) || [];
      statusMeta.value = Object.fromEntries(items.map((i) => [String(i.value), { text: i.label, color: i.color || 'default' }]));
    } catch {
      // 兜底
    }
  });

  const columns = [
    { title: '项目/分期', key: 'periodName', dataIndex: 'periodName' },
    { title: '邀约人', dataIndex: 'inviterName' },
    { title: '成员', dataIndex: 'memberName' },
    { title: '角色', dataIndex: 'role' },
    { title: '状态', key: 'status', dataIndex: 'status' },
    { title: '操作', key: 'action', width: 140, align: 'center' },
  ];

  const { tableContext } = useListPage({
    tableProps: {
      title: '站内待办（邀约）',
      api: invitationList,
      columns,
      canResize: true,
      beforeFetch: (params) => Object.assign(params, queryParam),
    },
  });

  const [registerTable, { reload }] = tableContext;

  async function handleAccept(record: Recordable) {
    await acceptInvitation({ id: record.id });
    createMessage.success(`已同意「${record.periodName || record.memberName}」邀约`);
    reload();
  }

  async function handleReject(record: Recordable) {
    await rejectInvitation({ id: record.id });
    createMessage.success('已拒绝邀约');
    reload();
  }
</script>
