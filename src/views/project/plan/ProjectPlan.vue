<template>
  <div class="project-plan">
    <!-- 第1部分: 顶部工具栏(位置信息改为行内保存，不显示保存本页) -->
    <div class="project-plan__toolbar">
      <div class="project-plan__toolbar-left">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="handleCancel">返回</a-button>
        <span class="project-plan__toolbar-title">{{ pageTitle }}</span>
        <a-button class="project-plan__detail-button" size="small" preIcon="ant-design:info-circle-outlined" @click="handleBasicDetail">
          详情
        </a-button>
      </div>
      <div class="project-plan__toolbar-right">
        <template v-if="editable">
          <a-button
            v-if="currentTabSave"
            :preIcon="currentTabEditing ? 'ant-design:file-done-outlined' : 'ant-design:edit-outlined'"
            :loading="currentTabSaving"
            :disabled="submitting || tabSaveBusy"
            @click="handleSaveCurrentTab"
          >
            {{ currentTabEditing ? '保存本页' : '修改' }}
          </a-button>
          <a-button type="primary" preIcon="ant-design:audit-outlined" :loading="submitting" :disabled="tabSaveBusy" @click="handleSubmitAudit">
            提交审批
          </a-button>
        </template>
        <a-tag v-else-if="permissionLoaded" color="default">仅合同审批指定的项目经理可编辑</a-tag>
      </div>
    </div>

    <!-- 第2部分: 内容盒子(与工具栏间隔 5px) -->
    <div class="project-plan__content">
      <a-tabs v-model:activeKey="activeKey">
        <a-tab-pane key="file" tab="方案文件">
          <PlanFileMgmt :editable="editable" :period-id="periodId" />
        </a-tab-pane>
        <a-tab-pane key="material" tab="用料计划">
          <PlanMaterial
            ref="materialRef"
            :period-id="periodId"
            :editable="editable && tabEditing.material"
            @persisted-change="handleMaterialPersistedChange"
          />
        </a-tab-pane>
        <a-tab-pane key="person" tab="人员配置">
          <PlanPerson ref="personRef" :editable="editable" :outsource-editable="editable && tabEditing.person" :period-id="periodId" />
        </a-tab-pane>
        <a-tab-pane key="implement" tab="实施计划">
          <PlanImplement
            ref="implementRef"
            :editable="editable && tabEditing.implement"
            :period-id="periodId"
            :planned-acceptance-date="projectRecord.plannedAcceptanceDate"
            :planned-acceptance-remark="projectRecord.plannedAcceptanceRemark"
            @persisted-change="handleImplementPersistedChange"
          />
        </a-tab-pane>
        <a-tab-pane key="position" tab="位置信息">
          <PlanPosition :editable="editable" :period-id="periodId" />
        </a-tab-pane>
        <a-tab-pane key="payment" tab="回款计划">
          <PlanPayment :period-id="periodId" />
        </a-tab-pane>
      </a-tabs>
    </div>
    <ProjectBasicDrawer @register="registerProjectBasicDrawer" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, computed, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { useDrawer } from '/@/components/Drawer';
  import { useUserStore } from '/@/store/modules/user';
  import PlanFileMgmt from './PlanFileMgmt.vue';
  import PlanMaterial from './PlanMaterial.vue';
  import PlanPerson from './PlanPerson.vue';
  import PlanImplement from './PlanImplement.vue';
  import PlanPosition from './PlanPosition.vue';
  import PlanPayment from './PlanPayment.vue';
  import ProjectBasicDrawer from '../components/ProjectBasicDrawer.vue';
  import { projectDetail, changePeriodStatus } from '../Project.api';
  import { addPlanProcessesBatch, editPlanOutsourcesBatch, editPlanProcessesBatch } from './Plan.api';
  import { editPlanMaterialBatch } from '/@/views/plan/Plan.api';
  import { contractDetail } from '/@/views/payment/Payment.api';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();
  const userStore = useUserStore();
  const [registerProjectBasicDrawer, { openDrawer: openProjectBasicDrawer }] = useDrawer();

  // 当前标签
  const activeKey = ref('file');

  const contractRecord = ref<Recordable>({});
  const permissionLoaded = ref(false);
  const currentUserId = computed(() => {
    const user: any = userStore.getUserInfo;
    return String(user?.id ?? user?.userId ?? '');
  });
  // 只有合同审批时指定的项目经理可编写计划。
  const editable = computed(
    () =>
      route.query.mode !== 'view' &&
      permissionLoaded.value &&
      !!currentUserId.value &&
      String(contractRecord.value.projectManagerUserId ?? '') === currentUserId.value
  );

  // 分期ID(项目已存在, 各子资源均以 periodId 关联)
  const periodId = route.query?.periodId as string | undefined;

  const pageTitle = computed(() => (editable.value ? '编辑计划方案' : '查看计划方案'));

  // 项目记录(头部上下文 + 回款自动带出)
  const projectRecord = ref<Recordable>({});

  function handleBasicDetail() {
    if (!periodId) {
      createMessage.warning('缺少项目分期 ID，无法查看项目详情');
      return;
    }
    openProjectBasicDrawer(true, { record: { ...projectRecord.value, periodId } });
  }

  // 子组件引用
  const materialRef = ref();
  const personRef = ref();
  const implementRef = ref();
  const tabSaving = reactive({ material: false, person: false, implement: false });
  const tabEditing = reactive({ material: false, person: false, implement: false });
  const tabSaveBusy = computed(() => Object.values(tabSaving).some(Boolean));
  const tabSaveHandlers = {
    material: saveMaterialTab,
    person: savePersonTab,
    implement: saveImplementTab,
  };
  type SavableTab = keyof typeof tabSaveHandlers;
  const currentTabKey = computed<SavableTab | undefined>(() =>
    Object.prototype.hasOwnProperty.call(tabSaveHandlers, activeKey.value) ? (activeKey.value as SavableTab) : undefined
  );
  const currentTabSave = computed<(() => Promise<unknown>) | undefined>(() => {
    const key = currentTabKey.value;
    return key ? tabSaveHandlers[key] : undefined;
  });
  const currentTabSaving = computed(() => {
    const key = currentTabKey.value;
    return key ? tabSaving[key] : false;
  });
  const currentTabEditing = computed(() => {
    const key = currentTabKey.value;
    return key ? tabEditing[key] : false;
  });

  function handleSaveCurrentTab() {
    const key = currentTabKey.value;
    if (!key) return;
    if (!tabEditing[key]) {
      tabEditing[key] = true;
      return;
    }
    return tabSaveHandlers[key]();
  }

  function handleMaterialPersistedChange(persisted: boolean) {
    tabEditing.material = !persisted;
  }

  function handleImplementPersistedChange(persisted: boolean) {
    tabEditing.implement = !persisted;
  }

  function saveProcessRecords(implementData: any) {
    const payload = {
      periodId,
      plannedAcceptanceDate: implementData.acceptanceDate,
      plannedAcceptanceRemark: implementData.remark || null,
      records: implementData.processList || [],
    };
    return implementData.isUpdate ? editPlanProcessesBatch(payload) : addPlanProcessesBatch(payload);
  }

  async function runTabSave(key: keyof typeof tabSaving, label: string, action: () => Promise<unknown>, reload: () => Promise<unknown>) {
    if (!editable.value) {
      createMessage.warning('仅合同审批指定的项目经理可保存计划');
      return false;
    }
    if (!periodId) {
      createMessage.warning('缺少项目分期 ID，无法保存');
      return false;
    }
    if (tabSaving[key] || submitting.value) return false;
    tabSaving[key] = true;
    try {
      await action();
      await reload();
      createMessage.success(`${label}已保存`);
      return true;
    } catch (error: any) {
      createMessage.warning(error?.message || `${label}保存失败，请重试`);
      return false;
    } finally {
      tabSaving[key] = false;
    }
  }

  function saveMaterialTab() {
    return runTabSave(
      'material',
      '用料计划',
      async () => editPlanMaterialBatch({ periodId, records: (await materialRef.value?.getData?.()) || [] }),
      async () => materialRef.value?.reload?.()
    );
  }

  async function savePersonTab() {
    const saved = await runTabSave(
      'person',
      '外协配置',
      async () => editPlanOutsourcesBatch({ periodId, records: personRef.value?.getOutsourceRecords?.() || [] }),
      async () => personRef.value?.reloadOutsources?.()
    );
    if (saved) tabEditing.person = false;
  }

  function saveImplementTab() {
    return runTabSave(
      'implement',
      '实施计划',
      async () => {
        const data = implementRef.value?.getData?.() || {};
        await saveProcessRecords(data);
      },
      async () => implementRef.value?.reload?.()
    );
  }

  /**
   * 加载项目信息(头部上下文/回款自动带出)
   */
  async function loadContext() {
    if (!periodId) {
      permissionLoaded.value = true;
      return;
    }
    const [projectResult, contractResult] = await Promise.allSettled([projectDetail({ periodId }), contractDetail({ periodId })]);
    const project = projectResult.status === 'fulfilled' ? (projectResult.value as Recordable) || {} : {};
    const contract = contractResult.status === 'fulfilled' ? (contractResult.value as Recordable) || {} : {};

    contractRecord.value = contract;
    projectRecord.value = { ...project, ...contract };

    if (projectResult.status === 'rejected') createMessage.warning('项目基本信息加载失败，部分固定信息暂无法显示');
    if (contractResult.status === 'rejected') createMessage.warning('合同信息加载失败，计划页已转为只读');
    permissionLoaded.value = true;
  }

  /**
   * 提交审批只负责项目状态流转，不再隐式保存任何页签数据。
   */
  const submitting = ref(false);
  async function handleSubmitAudit() {
    if (!periodId || !editable.value) return;
    submitting.value = true;
    try {
      await changePeriodStatus({ periodId, status: 'PENDING_APPROVAL' });
      createMessage.success('计划已提交审批，项目进入「待立项」');
      router.push('/project/list');
    } finally {
      submitting.value = false;
    }
  }

  /**
   * 取消
   */
  function handleCancel() {
    router.push('/project/list');
  }

  onMounted(() => {
    loadContext();
  });
</script>

<style lang="less" scoped>
  .project-plan {
    padding: 16px;

    // 第1部分: 顶部工具栏
    &__toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fff;
      border-radius: 8px;
      padding: 10px 20px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      margin-bottom: 5px; // 与内容盒子的间隔

      &-left {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      &-title {
        font-weight: 600;
        font-size: 16px;
        color: #333;
      }

      &-right {
        display: flex;
        gap: 8px;
      }
    }

    &__detail-button {
      margin-inline-start: 6px;
    }

    // 第2部分: 内容盒子(tab 栏与内容分开)
    &__content {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      overflow: hidden;

      // tab 栏: 独立色条 + 底部分隔线, 与内容明显分开
      :deep(.ant-tabs-nav) {
        margin-bottom: 0;
        padding: 0 16px;
        background: #fafafa;
        border-bottom: 1px solid #e8e8e8;

        &::before {
          border-bottom: none;
        }
      }

      :deep(.ant-tabs-tab) {
        padding: 12px 20px;
        font-weight: 500;
        margin: 0 4px;
        border: none !important;
        background: transparent !important;
        border-radius: 0 !important;

        &.ant-tabs-tab-active {
          color: #1890ff;
          font-weight: 600;
        }
      }

      :deep(.ant-tabs-ink-bar) {
        background: #1890ff;
        height: 3px;
      }

      // 内容区: 独立留白
      :deep(.ant-tabs-content-holder) {
        padding: 20px;
      }
    }
  }
</style>
