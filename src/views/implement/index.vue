<template>
  <div>
    <!-- 项目分期列表 -->
    <BasicTable @register="registerTable">
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" />
      </template>
      <!-- 字典字段 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'projectType'">
          {{ projectTypeMeta[record.projectType] || record.projectType || '—' }}
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <a-tag :color="getProjectStatusMeta(record.status).color">{{ getProjectStatusMeta(record.status).text }}</a-tag>
        </template>
      </template>
    </BasicTable>
  </div>
</template>

<script lang="ts" setup>
  import { onMounted, reactive, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { columns, searchFormSchema } from './Implement.data';
  import { implementProjectList } from './Implement.api';
  import { loadProjectStatusMap, loadProjectTypeMap, projectStatusMap, statusColorMap } from '../project/Project.data';

  defineOptions({ name: 'ImplementProjectList' });

  const router = useRouter();
  const { createMessage } = useMessage();
  const queryParam = reactive<any>({});
  const statusMeta = ref<Record<string, { text: string; color: string }>>({});
  const projectTypeMeta = ref<Record<string, string>>({});

  const { tableContext } = useListPage({
    tableProps: {
      title: '实施管理',
      api: implementProjectList,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
        fieldMapToTime: [],
      },
      actionColumn: {
        width: 90,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
    },
  });

  const [registerTable] = tableContext;

  /**
   * 进入项目实施详情，路由参数为项目分期 ID。
   */
  function handleDetail(record: Recordable) {
    const periodId = String(record.periodId || record.id || '');
    if (!periodId) {
      createMessage.error('缺少项目分期 ID，无法查看实施日志');
      return;
    }
    router.push({ path: `/implement/log/${periodId}` });
  }

  function getProjectStatusMeta(status: unknown) {
    const value = String(status || '');
    return (
      statusMeta.value[value] || {
        text: projectStatusMap[value] || value || '—',
        color: statusColorMap[value] || 'default',
      }
    );
  }

  /**
   * 操作栏：进入项目下全部工序的实施日志。
   */
  function getTableAction(record: Recordable) {
    return [
      {
        label: '详情',
        onClick: handleDetail.bind(null, record),
      },
    ];
  }

  onMounted(async () => {
    const [loadedStatusMeta, loadedProjectTypeMeta] = await Promise.all([loadProjectStatusMap(), loadProjectTypeMap()]);
    statusMeta.value = loadedStatusMeta;
    projectTypeMeta.value = loadedProjectTypeMeta;
  });
</script>
