<template>
  <BasicDrawer
    v-bind="$attrs"
    @register="register"
    title="项目基本信息"
    :width="760"
    :show-footer="Boolean(invitation.id)"
    :show-cancel-btn="false"
    :show-ok-btn="false"
    destroy-on-close
  >
    <div v-if="loadError" class="project-basic-drawer__error">
      <a-alert type="error" show-icon :message="loadError" />
    </div>

    <div v-if="hasDetail" class="project-basic-drawer">
      <section class="project-basic-drawer__section">
        <h3>主项目信息</h3>
        <a-descriptions :column="descriptionColumns" bordered size="middle">
          <a-descriptions-item label="项目编号">{{ detail.projectNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="主项目名称">{{ detail.projectName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="甲方名称">{{ detail.customerName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="项目类型">{{ projectTypeText || '—' }}</a-descriptions-item>
          <a-descriptions-item label="甲方信息" :span="2">{{ detail.customerInfo || '—' }}</a-descriptions-item>
        </a-descriptions>
      </section>

      <section class="project-basic-drawer__section">
        <h3>分期与对接信息</h3>
        <a-descriptions :column="descriptionColumns" bordered size="middle">
          <a-descriptions-item label="分期编号">{{ detail.periodNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="分期项目名称">{{ detail.periodName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="项目状态">
            <a-tag :color="projectStatus.color">{{ projectStatus.text }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="合同状态">
            <a-tag :color="contractStatus.color">{{ contractStatus.text }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="项目对接人">{{ detail.projectLiaisonUserName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="甲方联系人">{{ detail.contactPerson || '—' }}</a-descriptions-item>
          <a-descriptions-item label="联系电话">{{ detail.contactPhone || '—' }}</a-descriptions-item>
          <a-descriptions-item label="业务属性">{{ businessAttributeText || '—' }}</a-descriptions-item>
          <a-descriptions-item label="涉及产品" :span="2">{{ involvedProductsText || '—' }}</a-descriptions-item>
        </a-descriptions>
      </section>

      <section class="project-basic-drawer__section">
        <h3>实施信息</h3>
        <a-descriptions :column="1" bordered size="middle">
          <a-descriptions-item label="项目地址">{{ detail.projectAddress || '—' }}</a-descriptions-item>
          <a-descriptions-item label="项目需求">{{ detail.projectRequirement || '—' }}</a-descriptions-item>
          <a-descriptions-item label="备注">{{ detail.remark || '—' }}</a-descriptions-item>
        </a-descriptions>
      </section>
    </div>

    <a-empty v-else-if="!loadError" description="暂无项目基本信息" />

    <template #appendFooter>
      <a-button danger :loading="responding === '0'" :disabled="Boolean(responding)" @click="respondToInvitation('0')">拒绝</a-button>
      <a-button type="primary" :loading="responding === '1'" :disabled="Boolean(responding)" @click="respondToInvitation('1')">同意</a-button>
    </template>
  </BasicDrawer>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
  import { projectDetail } from '../Project.api';
  import { loadDictOptions, loadProjectStatusMap, loadProjectTypeMap, projectStatusMap } from '../Project.data';
  import { ProjectInvitation, useProjectInvitations } from '../plan/useProjectInvitations';

  const emit = defineEmits(['register', 'invitation-processed']);
  const { createMessage } = useMessage();
  const { handleInvitation } = useProjectInvitations();

  const detail = ref<Recordable>({});
  const invitation = ref<Partial<ProjectInvitation>>({});
  const responding = ref<'' | '0' | '1'>('');
  const loadError = ref('');
  const projectTypeMap = ref<Recordable>({});
  const statusMap = ref<Record<string, { text: string; color: string }>>({});
  const businessAttributeMap = ref<Recordable>({});
  const involvedProductsMap = ref<Recordable>({});
  const descriptionColumns = { xs: 1, sm: 1, md: 2 };

  const hasDetail = computed(() => Boolean(detail.value.projectId || detail.value.periodId || detail.value.projectName));
  const projectTypeText = computed(() => projectTypeMap.value[String(detail.value.projectType)] || detail.value.projectType || '');
  const projectStatus = computed(() => {
    const value = String(detail.value.status || '');
    return statusMap.value[value] || { text: projectStatusMap[value] || value || '—', color: 'default' };
  });
  const contractStatus = computed(() => getApprovalStatusMeta(detail.value.contractStatus));
  const businessAttributeText = computed(() => mapMultipleValues(detail.value.businessAttribute, businessAttributeMap.value));
  const involvedProductsText = computed(() => mapMultipleValues(detail.value.involvedProducts, involvedProductsMap.value));

  const [register, { setDrawerProps, closeDrawer }] = useDrawerInner(async (data) => {
    const record = data?.record || {};
    const periodId = record.periodId || record.id;
    invitation.value = data?.invitation || {};
    responding.value = '';
    detail.value = { ...record };
    loadError.value = '';
    if (!periodId) {
      loadError.value = '缺少项目分期 ID，无法加载基本信息';
      return;
    }

    setDrawerProps({ loading: true });
    try {
      const [result, typeMap, loadedStatusMap, businessOptions, productOptions] = await Promise.all([
        projectDetail({ periodId }),
        loadProjectTypeMap(),
        loadProjectStatusMap(),
        loadDictOptions('project_business_attr'),
        loadDictOptions('project_products'),
      ]);
      detail.value = { ...record, ...(result || {}) };
      projectTypeMap.value = typeMap;
      statusMap.value = loadedStatusMap;
      businessAttributeMap.value = Object.fromEntries(businessOptions.map((item) => [String(item.value), item.label]));
      involvedProductsMap.value = Object.fromEntries(productOptions.map((item) => [String(item.value), item.label]));
    } catch (error: any) {
      loadError.value = error?.message || '项目基本信息加载失败，请关闭后重试';
    } finally {
      setDrawerProps({ loading: false });
    }
  });

  function mapMultipleValues(value: unknown, valueMap: Recordable) {
    if (value == null || value === '') return '';
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => valueMap[item] || item)
      .join('、');
  }

  async function respondToInvitation(status: '0' | '1') {
    const memberId = invitation.value.id;
    if (!memberId || responding.value) return;
    responding.value = status;
    try {
      await handleInvitation(memberId, status);
      createMessage.success(status === '1' ? '已同意项目邀请' : '已拒绝项目邀请');
      emit('invitation-processed', status);
      closeDrawer();
    } finally {
      responding.value = '';
    }
  }
</script>

<style lang="less" scoped>
  .project-basic-drawer {
    &__error {
      margin-bottom: 20px;
    }

    &__section {
      & + & {
        margin-top: 28px;
      }

      h3 {
        margin: 0 0 12px;
        color: #262626;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.5;
      }

      :deep(.ant-descriptions-item-label) {
        width: 128px;
        color: #595959;
        font-weight: 500;
      }

      :deep(.ant-descriptions-item-content) {
        color: #262626;
        overflow-wrap: anywhere;
      }
    }
  }

  @media (max-width: 768px) {
    .project-basic-drawer__section {
      :deep(.ant-descriptions-view table) {
        table-layout: fixed;
      }

      :deep(.ant-descriptions-item-label) {
        width: 108px;
      }
    }
  }
</style>
