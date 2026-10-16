<template>
  <div>
    <!-- 项目列表 -->
    <BasicTable @register="registerTable">
      <!-- 插槽:table标题 -->
      <template #tableTitle>
        <a-button v-if="hasPermission('project:add')" type="primary" @click="handleAdd" preIcon="ant-design:plus-outlined"> 新增</a-button>
      </template>
      <!-- 操作栏 -->
      <template #action="{ record }">
        <TableAction v-bind="getProjectActionLayout(record)" />
      </template>
      <!-- 字段回显插槽 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'customerName'">
          <a-tooltip :title="record.customerName || undefined" :trigger="['hover', 'focus']">
            <span class="project-customer-name" :tabindex="record.customerName ? 0 : undefined">{{ record.customerName || '—' }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="column.dataIndex === 'priced'">
          <a-tag v-if="quotationYesNoMeta[String(record.priced)]" :color="quotationYesNoMeta[String(record.priced)].color || 'default'">
            {{ quotationYesNoMeta[String(record.priced)].label }}
          </a-tag>
          <span v-else>—</span>
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <a-tag :color="statusMeta[record.status]?.color || statusColorMap[record.status] || 'default'">
            {{ statusMeta[record.status]?.text || projectStatusMap[record.status] || record.status || '—' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'contractStatus'">
          <a-tag :color="getApprovalStatusMeta(record.contractStatus).color">
            {{ getApprovalStatusMeta(record.contractStatus).text }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'arrivalStatus'">
          <span v-if="isSoftwareProject(record, projectTypeMeta)">—</span>
          <a-tag v-else :color="Number(record.arrivalStatus) === 1 ? 'success' : 'default'">
            {{ Number(record.arrivalStatus) === 1 ? '已到货' : '未到货' }}
          </a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'projectType'">
          {{ projectTypeMeta[record.projectType] || record.projectType || '—' }}
        </template>
        <template v-else-if="column.dataIndex === 'projectLiaisonUserName'">
          {{ getProjectLiaisonName(record) }}
        </template>
      </template>
    </BasicTable>
    <a-modal
      v-model:open="createProjectModalOpen"
      title="选择新增项目类型"
      ok-text="进入填写"
      cancel-text="取消"
      :confirm-loading="mainProjectLoading"
      :ok-button-props="{ disabled: createProjectMode === 'period' && !selectedMainProjectId }"
      :mask-closable="false"
      @ok="handleCreateProjectConfirm"
    >
      <div class="project-create-mode">
        <a-radio-group v-model:value="createProjectMode" class="project-create-mode__options">
          <label class="project-create-mode__option" :class="{ active: createProjectMode === 'project' }">
            <a-radio value="project">新建主项目</a-radio>
            <span>创建一个全新的主项目，并同时填写首个分期信息。</span>
          </label>
          <label class="project-create-mode__option" :class="{ active: createProjectMode === 'period' }">
            <a-radio value="period">已有主项目下新增分期</a-radio>
            <span>先选择所属主项目，再填写本次新增的分期信息。</span>
          </label>
        </a-radio-group>

        <a-form-item v-if="createProjectMode === 'period'" label="所属主项目" html-for="create-parent-project" label-align="left" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }" required class="project-create-mode__parent">
          <a-select
            id="create-parent-project"
            v-model:value="selectedMainProjectId"
            show-search
            :filter-option="false"
            placeholder="请选择主项目或输入分期名称搜索"
            :options="mainProjectOptions"
            :loading="mainProjectLoading"
            :not-found-content="mainProjectLoading ? '加载中…' : mainProjectError || '暂无匹配主项目，请更换关键词'"
            @dropdown-visible-change="mainProjectSearch.open"
            @search="mainProjectSearch.search"
            @popup-scroll="handleMainProjectScroll"
          />
          <a-alert v-if="mainProjectError" type="error" :message="mainProjectError" show-icon>
            <template #action><a-button size="small" @click="mainProjectSearch.retry">重试</a-button></template>
          </a-alert>
        </a-form-item>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts" name="project-projectlist" setup>
  import { reactive, ref, onMounted, onBeforeUnmount, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { columns, searchFormSchema, projectStatusMap, statusColorMap, loadProjectStatusMap, loadProjectTypeMap, loadDictOptions } from './Project.data';
  import { projectList, searchPeriod, deleteProject } from './Project.api';
  import { useMainProjectSearch } from './mainProjectSearch';
  import { projectActionLayout } from './projectActionLayout';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { isSoftwareProject } from './arrivalPayment';


  const router = useRouter();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  // 状态字典映射(数据源 project_period_status, 加载失败回退 projectStatusMap)
  const statusMeta = ref<Recordable>({});
  // 项目类型字典映射(数据源 project_type)
  const projectTypeMeta = ref<Recordable>({});
  const quotationYesNoMeta = ref<Recordable>({});
  // 项目对接人姓名映射；接口姓名快照为空时按用户 ID 补齐。
  const liaisonNameMap = ref<Recordable>({});
  let liaisonOptionsPromise: Promise<{ label: string; value: string }[]> | null = null;

  const queryParam = reactive<any>({});
  const createProjectModalOpen = ref(false);
  const createProjectMode = ref<'project' | 'period'>('project');
  const selectedMainProjectId = ref<string>();
  const mainProjectSearch = useMainProjectSearch(searchPeriod, () => selectedMainProjectId.value);
  const { options: mainProjectOptions, loading: mainProjectLoading, error: mainProjectError } = mainProjectSearch;
  watch(createProjectModalOpen, (open) => { if (!open) mainProjectSearch.close(); }, { flush: 'sync' });
  onBeforeUnmount(mainProjectSearch.close);
  function handleMainProjectScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 16) void mainProjectSearch.loadMore();
  }

  async function loadLiaisonOptions() {
    liaisonOptionsPromise ||= loadUserOptions().catch(() => []);
    const users = await liaisonOptionsPromise;
    liaisonNameMap.value = users.reduce((map, user) => {
      map[user.value] = user.label;
      return map;
    }, {} as Recordable);
    return users;
  }

  function getProjectLiaisonUserId(record: Recordable) {
    return record.projectLiaisonUserId ?? record.projectLiaisonId ?? record.projectLeaderId;
  }

  function getProjectLiaisonName(record: Recordable) {
    const snapshot = record.projectLiaisonUserName || record.projectLiaisonName || record.projectLeaderName;
    if (snapshot && snapshot !== '—') return snapshot;
    return liaisonNameMap.value[String(getProjectLiaisonUserId(record) ?? '')] || '—';
  }

  onMounted(async () => {
    const [loadedStatusMeta, loadedProjectTypeMeta, yesNoOptions] = await Promise.all([loadProjectStatusMap(), loadProjectTypeMap(), loadDictOptions('yes_no_status'), loadLiaisonOptions()]);
    quotationYesNoMeta.value = Object.fromEntries(yesNoOptions.map(item => [String(item.value), { label: item.label, color: item.color }]));
    statusMeta.value = loadedStatusMeta;
    projectTypeMeta.value = loadedProjectTypeMeta;
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
        showAdvancedButton: false,
        fieldMapToTime: [],
      },
      actionColumn: {
        width: 160,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },

    },
  });

  const [registerTable, { reload }] = tableContext;

  /** 新增前先明确是新建主项目，还是给已有主项目新增分期。 */
  async function handleAdd() {
    if (!hasPermission('project:add')) {
      createMessage.warning('暂无新增项目权限，请联系管理员授权');
      return;
    }
    createProjectMode.value = 'project';
    selectedMainProjectId.value = undefined;
    createProjectModalOpen.value = true;
    mainProjectSearch.reset();
  }

  function handleCreateProjectConfirm() {
    if (!hasPermission('project:add')) {
      createProjectModalOpen.value = false;
      createMessage.warning('暂无新增项目权限，请联系管理员授权');
      return;
    }
    if (createProjectMode.value === 'period' && !selectedMainProjectId.value) {
      createMessage.warning('请选择所属主项目');
      return;
    }
    const parent = mainProjectOptions.value.find((item) => item.value === selectedMainProjectId.value);
    if (createProjectMode.value === 'period' && !parent?.customerId) {
      createMessage.warning('所选主项目未返回客户ID，请先维护甲方信息后重新选择');
      return;
    }
    createProjectModalOpen.value = false;
    router.push({
      path: '/project/apply',
      query: createProjectMode.value === 'period'
        ? { mode: 'period', parentProjectId: parent!.value, parentProjectName: parent!.label, parentCustomerId: parent!.customerId }
        : { mode: 'project' },
    });
  }


  function handleDetail(record: Recordable) {
    const periodId = record.periodId || record.id;
    if (!periodId) { createMessage.error('缺少项目分期 ID'); return; }
    router.push(`/project/detail/${periodId}`);
  }

  /** 删除(后端仅允许删分期) */
  async function handleDelete(record: Recordable) {
    await deleteProject({ periodId: record.periodId || record.id });
    createMessage.success(`删除分期「${record.periodName || record.projectName}」成功`);
    reload();
  }

  /**
   * 操作栏: 状态流转(项目创建后仅允许从详情页编辑基本信息)
   */
  function getProjectActionLayout(record: Recordable) {
    return projectActionLayout([...getTableAction(record), ...getDropDownAction(record)], hasPermission);
  }

  function getTableAction(record: Recordable) {
    return [{ label: '详情', onClick: handleDetail.bind(null, record) }];
  }

  /** 下拉操作栏：详情、业务辅助操作、关闭与删除。 */
  function getDropDownAction(record: Recordable) {
    const actions: Recordable[] = [
      {
        label: '删除',
        popConfirm: {
          title: '是否确认删除该分期？',
          confirm: handleDelete.bind(null, record),
          placement: 'topLeft',
        },
      },
    ];
    return actions;
  }
</script>

<style lang="less" scoped>
  .project-customer-name {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .project-create-mode {
    &__options {
      display: grid;
      gap: 12px;
      width: 100%;
    }

    &__option {
      display: grid;
      gap: 6px;
      padding: 14px 16px;
      border: 1px solid #d9d9d9;
      border-radius: 8px;
      cursor: pointer;
      transition:
        border-color 0.2s,
        background-color 0.2s;

      &.active {
        border-color: #1890ff;
        background: #e6f7ff;
      }

      > span {
        padding-left: 24px;
        color: #595959;
        line-height: 1.6;
      }
    }

    &__parent {
      margin-top: 20px;
      margin-bottom: 0;

      :deep(.ant-form-item-label) {
        padding: 0 0 8px;
        text-align: left;
      }

      :deep(.ant-form-item-label > label) {
        height: auto;
      }

      :deep(.ant-select) {
        width: 100%;
      }
    }
  }
</style>
