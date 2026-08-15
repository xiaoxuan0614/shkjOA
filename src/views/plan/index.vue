<template>
  <div>
    <!-- 项目列表(计划方案入口) -->
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

<script lang="ts" name="plan-projectlist" setup>
  import { reactive } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema } from './Plan.data';
  import { planProjectList } from './Plan.api';

  const router = useRouter();
  const queryParam = reactive<any>({});

  const { tableContext } = useListPage({
    tableProps: {
      title: '计划方案管理',
      api: planProjectList,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
        fieldMapToTime: [['contractDate', ['contractDate_begin', 'contractDate_end'], 'YYYY-MM-DD']],
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
   * 查看方案: 跳转方案详情页
   */
  function handleDetail(record: Recordable) {
    router.push({ path: `/plan/detail/${record.id}` });
  }

  /**
   * 状态颜色
   */
  function getStatusColor(status: string): string {
    const map: Recordable = {
      筹备: 'blue',
      实施中: 'processing',
      待验收: 'orange',
      质保中: 'purple',
      完结: 'success',
      关闭: 'error',
    };
    return map[status] || 'default';
  }

  /**
   * 操作栏: 查看方案
   */
  function getTableAction(record: Recordable) {
    return [
      {
        label: '查看方案',
        onClick: handleDetail.bind(null, record),
      },
    ];
  }
</script>
