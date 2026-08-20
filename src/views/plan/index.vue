<template>
  <div>
    <!-- 项目列表(计划方案入口) -->
    <BasicTable @register="registerTable">
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" />
      </template>
      <!-- 状态列 / 项目类型列(字典文本) -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="getStatusColor(record.status)">
            {{ statusMeta[record.status]?.text || record.status || '—' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'projectType'">
          {{ projectTypeMeta[record.projectType] || record.projectType || '—' }}
        </template>
      </template>
    </BasicTable>
  </div>
</template>

<script lang="ts" name="plan-projectlist" setup>
  import { reactive, ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema } from './Plan.data';
  import { planProjectList } from './Plan.api';
  import { loadProjectStatusMap, loadProjectTypeMap } from '../project/Project.data';

  const router = useRouter();
  const queryParam = reactive<any>({});

  // 状态字典映射(数据源 project_period_status, 加载失败回退硬编码)
  const statusMeta = ref<Recordable>({});
  // 项目类型字典映射(数据源 project_type)
  const projectTypeMeta = ref<Recordable>({});

  onMounted(async () => {
    statusMeta.value = await loadProjectStatusMap();
    projectTypeMeta.value = await loadProjectTypeMap();
  });

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
        fieldMapToTime: [],
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
   * 查看方案: 跳转方案详情页(按分期ID)
   */
  function handleDetail(record: Recordable) {
    router.push({ path: `/plan/detail/${record.periodId || record.id}` });
  }

  /**
   * 状态颜色(优先取字典 project_period_status 配置, 兜底硬编码)
   */
  function getStatusColor(status: string): string {
    if (statusMeta.value[status]?.color) return statusMeta.value[status].color;
    const map: Recordable = {
      NOT_STARTED: 'default',
      未开始: 'default',
      IMPLEMENTING: 'processing',
      实施中: 'processing',
      IMPLEMENT_COMPLETED: 'blue',
      实施完成: 'blue',
      WARRANTY: 'purple',
      质保中: 'purple',
      COMPLETED: 'success',
      完结: 'success',
      CLOSED: 'error',
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
