<template>
  <div>
    <!-- 项目列表 -->
    <BasicTable @register="registerTable">
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
          <a-tag :color="statusMeta[record.status]?.color || statusColorMap[record.status] || 'default'">
            {{ statusMeta[record.status]?.text || projectStatusMap[record.status] || record.status || '—' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'contractStatus'">
          <a-tag :color="record.contractStatus ? 'success' : 'default'">
            {{ record.contractStatus ? '已签订' : '未签订' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'projectType'">
          {{ projectTypeMeta[record.projectType] || record.projectType || '—' }}
        </template>
      </template>
    </BasicTable>
    <!-- 计划审批弹窗(待立项) -->
    <PlanAuditModal @register="registerModal" @success="handlePlanAuditSuccess" />
  </div>
</template>

<script lang="ts" name="project-projectlist" setup>
  import { reactive, ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useModal } from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema, statusFlow, projectStatusMap, statusColorMap, loadProjectStatusMap, loadProjectTypeMap } from './Project.data';
  import { projectList, deleteProject, changePeriodStatus } from './Project.api';
  import { useMessage } from '/@/hooks/web/useMessage';
  import PlanAuditModal from './components/PlanAuditModal.vue';

  const router = useRouter();
  const { createMessage } = useMessage();

  // 合同签订弹窗
  const [registerModal, { openModal }] = useModal();

  // 状态字典映射(数据源 project_period_status, 加载失败回退 projectStatusMap)
  const statusMeta = ref<Recordable>({});
  // 项目类型字典映射(数据源 project_type)
  const projectTypeMeta = ref<Recordable>({});

  const queryParam = reactive<any>({});

  onMounted(async () => {
    statusMeta.value = await loadProjectStatusMap();
    projectTypeMeta.value = await loadProjectTypeMap();
  });

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
        width: 240,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
    },
  });

  const [registerTable, { reload }] = tableContext;

  /**
   * 新增事件: 跳转新增项目页
   */
  function handleAdd() {
    router.push('/project/apply');
  }

  /**
   * 编辑计划方案: 跳转六标签计划页
   */
  function handleAddPlan(record: Recordable) {
    router.push({ path: '/project/plan', query: { periodId: record.periodId } });
  }

  /**
   * 详情: 跳转项目详情页(8-tab), id 为分期ID
   */
  function handleDetail(record: Recordable) {
    router.push({ path: `/project/detail/${record.periodId || record.id}` });
  }

  /**
   * 编辑: 跳转新增项目页回显
   */
  function handleEdit(record: Recordable) {
    router.push({
      path: '/project/apply',
      query: { id: record.periodId || record.id, periodId: record.periodId, projectId: record.projectId },
    });
  }

  /**
   * 删除(后端仅允许删分期)
   */
  async function handleDelete(record: Recordable) {
    await deleteProject({ periodId: record.periodId || record.id });
    createMessage.success(`删除分期「${record.periodName || record.projectName}」成功`);
    reload();
  }

  /**
   * 计划审批成功回调
   */
  function handlePlanAuditSuccess() {
    reload();
  }

  /**
   * 状态推进: 前端传 periodId + status 给统一状态变更接口
   * act='contractSign': 跳转「合同信息」页面(合同提交后项目→筹备中)
   * act='planAudit': 打开「计划审批」弹窗(待立项→通过/驳回)
   */
  async function handleAdvance(record: Recordable, action: any) {
    if (action.act === 'contractSign') {
      router.push({
        path: '/project/contract',
        query: { periodId: record.periodId || record.id, projectId: record.projectId },
      });
      return;
    }
    if (action.act === 'planAudit') {
      openModal(true, { periodId: record.periodId || record.id, projectId: record.projectId });
      return;
    }
    await changePeriodStatus({ periodId: record.periodId || record.id, status: action.status });
    createMessage.success(`操作成功：${action.label}`);
    reload();
  }

  /**
   * 操作栏: 状态流转(按当前状态动态显示, 可多动作) + 编辑
   */
  function getTableAction(record: Recordable) {
    const flow = statusFlow[record.status];
    const actions = [];
    if (flow && flow.actions) {
      flow.actions.forEach((action) => {
        // 合同已签订: 不再显示「合同签订」按钮
        if (action.act === 'contractSign' && record.contractStatus) return;
        const item: Recordable = {
          label: action.label,
          auth: action.auth,
        };
        if (action.act === 'contractSign') {
          // 合同签订: 直接打开弹窗, 无确认框
          item.onClick = handleAdvance.bind(null, record, action);
        } else {
          item.popConfirm = {
            title: `确认执行「${action.label}」？`,
            confirm: handleAdvance.bind(null, record, action),
            placement: 'topLeft',
          };
        }
        actions.push(item);
      });
    }
    actions.push({
      label: '编辑',
      onClick: handleEdit.bind(null, record),
    });
    return actions;
  }

  /**
   * 下拉操作栏: 编辑计划方案(仅筹备中) + 详情 + 删除
   */
  function getDropDownAction(record: Recordable) {
    const actions = [];
    // 合同已签订(已签订/筹备中)即可创建计划
    if (record.contractStatus || record.status === 'PREPARING') {
      actions.push({
        label: '编辑计划方案',
        onClick: handleAddPlan.bind(null, record),
      });
    }
    actions.push(
      {
        label: '详情',
        onClick: handleDetail.bind(null, record),
      },
      {
        label: '删除',
        popConfirm: {
          title: '是否确认删除该分期？',
          confirm: handleDelete.bind(null, record),
          placement: 'topLeft',
        },
      }
    );
    return actions;
  }
</script>
