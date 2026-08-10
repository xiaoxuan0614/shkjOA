<template>
  <div>
    <!-- 项目列表 -->
    <BasicTable @register="registerTable" :rowSelection="rowSelection">
      <!-- 插槽:table标题 -->
      <template #tableTitle>
        <a-button type="primary" @click="handleAdd" preIcon="ant-design:plus-outlined"> 新增</a-button>
      </template>
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" :dropDownActions="getDropDownAction(record)" />
      </template>
      <!-- 字段回显插槽 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="getStatusColor(record.status)">{{ record.status }}</a-tag>
        </template>
      </template>
    </BasicTable>
  </div>
</template>

<script lang="ts" name="project-projectlist" setup>
  import { reactive } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema } from './Project.data';
  import { projectList } from './Project.api';
  import { useMessage } from '/@/hooks/web/useMessage';

  const router = useRouter();
  const { createMessage } = useMessage();

  const queryParam = reactive<any>({});

  // 注册table数据
  const { tableContext } = useListPage({
    tableProps: {
      title: '项目管理',
      api: projectList,
      columns,
      canResize: true,
      formConfig: {
        schemas: searchFormSchema,
        autoSubmitOnEnter: true,
        showAdvancedButton: true,
        fieldMapToTime: [],
      },
      actionColumn: {
        width: 180,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
    },
  });

  const [registerTable] = tableContext;

  /**
   * 新增事件: 跳转新增项目页
   */
  function handleAdd() {
    router.push('/project/apply');
  }

  /**
   * 新增计划方案: 跳转六标签计划页
   */
  function handleAddPlan(record: Recordable) {
    router.push({ path: '/project/plan', query: { projectId: record.id } });
  }

  /**
   * 详情: 跳转计划页只读查看
   */
  function handleDetail(record: Recordable) {
    router.push({ path: '/project/plan', query: { projectId: record.id, readonly: '1' } });
  }

  /**
   * 编辑: 跳转新增项目页回显
   */
  function handleEdit(record: Recordable) {
    router.push({ path: '/project/apply', query: { id: record.id } });
  }

  /**
   * 删除(占位)
   */
  function handleDelete(record: Recordable) {
    createMessage.info(`删除项目「${record.projectName}」功能待接入`);
  }

  /**
   * 状态颜色
   */
  function getStatusColor(status: string): string {
    const map = {
      未开始: 'default',
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
   * 操作栏: 编辑 + 新增计划方案
   */
  function getTableAction(record: Recordable) {
    return [
      {
        label: '编辑',
        onClick: handleEdit.bind(null, record),
      },
      {
        label: '新增计划方案',
        onClick: handleAddPlan.bind(null, record),
      },
    ];
  }

  /**
   * 下拉操作栏: 详情 + 删除
   */
  function getDropDownAction(record: Recordable) {
    return [
      {
        label: '详情',
        onClick: handleDetail.bind(null, record),
      },
      {
        label: '删除',
        popConfirm: {
          title: '是否确认删除',
          confirm: handleDelete.bind(null, record),
          placement: 'topLeft',
        },
      },
    ];
  }
</script>
