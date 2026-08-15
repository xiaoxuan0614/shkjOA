<template>
  <div>
    <!-- 工序列表 -->
    <BasicTable @register="registerTable">
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" />
      </template>
      <!-- 状态列 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="getStatusColor(record.status)">{{ record.status }}</a-tag>
        </template>
      </template>
    </BasicTable>
  </div>
</template>

<script lang="ts" name="implement-worklist" setup>
  import { reactive } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema } from './Implement.data';
  import { implementList } from './Implement.api';

  const router = useRouter();
  const queryParam = reactive<any>({});

  const { tableContext } = useListPage({
    tableProps: {
      title: '实施管理',
      api: implementList,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
        fieldMapToTime: [['planStart', ['planStart_begin', 'planStart_end'], 'YYYY-MM-DD']],
      },
      actionColumn: {
        width: 120,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
    },
  });

  const [registerTable] = tableContext;

  /**
   * 查看日志: 跳转某工序的日志列表页
   */
  function handleViewLog(record: Recordable) {
    router.push({ path: `/implement/log/${record.id}` });
  }

  /**
   * 状态颜色
   */
  function getStatusColor(status: string): string {
    const map: Recordable = {
      未开始: 'default',
      进行中: 'processing',
      已延期: 'error',
      已完成: 'success',
    };
    return map[status] || 'default';
  }

  /**
   * 操作栏: 查看日志
   */
  function getTableAction(record: Recordable) {
    return [
      {
        label: '查看日志',
        onClick: handleViewLog.bind(null, record),
      },
    ];
  }
</script>
