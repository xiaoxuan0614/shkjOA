<template>
  <div class="material-draft-editor">
    <div class="material-draft-editor__header">
      <div class="material-draft-editor__heading">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
        <div>
          <div class="material-draft-editor__title">{{ viewOnly ? '查看报价' : draftRecord.id ? '修改报价' : '新增报价' }}</div>
          <div class="material-draft-editor__subtitle"> {{ projectRecord.projectName || '—' }} / {{ projectRecord.periodName || '—' }} </div>
        </div>
        <a-tag :color="statusMeta[currentStatus]?.color || 'default'">
          {{ statusMeta[currentStatus]?.text || currentStatus }}
        </a-tag>
      </div>
      <div class="material-draft-editor__actions">
        <a-button v-if="canModify" v-auth="savePermission" :loading="saving" preIcon="ant-design:save-outlined" @click="handleSave">
          保存草稿
        </a-button>
        <a-popconfirm v-if="!locked && canLock" title="提交后等待领导审批，确定提交报价吗？" @confirm="handleLock">
          <a-button type="primary" :loading="saving">提交审批</a-button>
        </a-popconfirm>
      </div>
    </div>

    <a-alert
      class="material-draft-editor__notice"
      :type="noticeContent.type"
      show-icon
      :message="noticeContent.message"
      :description="noticeContent.description"
    />

    <div class="material-draft-editor__context">
      <div class="material-draft-editor__candidate-name">
        <span>报价单名称</span>
        <a-input v-model:value="candidateName" :disabled="!canModify" :maxlength="100" placeholder="请输入报价单名称" />
      </div>
      <div><span>主项目名称</span>{{ projectRecord.projectName || '—' }}</div>
      <div><span>分期项目名称</span>{{ projectRecord.periodName || '—' }}</div>
      <div><span>甲方名称</span>{{ projectRecord.customerName || projectRecord.partyAName || '—' }}</div>
    </div>

    <div class="material-draft-editor__content">
      <MaterialPlanTable ref="tableRef" :candidate-id="candidateId" :editable="canModify" mode="quotation" />
    </div>
  </div>
</template>

<script lang="ts">
  let pendingCreatedQuotation:
    | {
        candidateId: string;
        candidateName: string;
        savedRows: Array<Record<string, any>>;
        status: string;
        showSavedNotice: boolean;
      }
    | undefined;
</script>

<script lang="ts" name="contract-material-draft-editor" setup>
  import { computed, nextTick, onMounted, ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { projectDetail } from '/@/views/project/Project.api';
  import MaterialPlanTable from '../components/MaterialPlanTable.vue';
  import { loadQuotationStatusMap } from '../Plan.data';
  import {
    addMaterialCandidate,
    addMaterialCandidateItems,
    editMaterialCandidate,
    editMaterialCandidateItems,
    getMaterialCandidateItemList,
    getMaterialCandidateList,
    normalizeQuotationStatus,
    QUOTATION_STATUS_DRAFT,
    QUOTATION_STATUS_SUBMITTED,
    isQuotationEditable,
  } from '../Plan.api';

  defineOptions({ name: 'ContractMaterialDraftEditor' });

  const PERMISSIONS = {
    add: 'plan:quotation:add',
    edit: 'plan:quotation:edit',
    lock: 'plan:quotation:lock',
    unlock: 'plan:quotation:unlock',
  } as const;

  const route = useRoute();
  const router = useRouter();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  // 正式入口使用固定隐藏路由 + query；保留 params.id 仅兼容旧的静态链接。
  const periodId = String(route.query.periodId || route.params.id || '');
  const routeCandidateId = String(route.query.candidateId || '');
  const restoredCreatedQuotation = pendingCreatedQuotation?.candidateId === routeCandidateId ? pendingCreatedQuotation : undefined;
  if (restoredCreatedQuotation) pendingCreatedQuotation = undefined;
  const tableRef = ref();
  const projectRecord = ref<Recordable>({});
  const draftRecord = ref<Recordable>({});
  const candidateName = ref(String(route.query.candidateName || ''));
  const statusMeta = ref<Recordable>({});
  const saving = ref(false);
  const saveNotice = ref<Recordable>(
    restoredCreatedQuotation?.showSavedNotice
      ? {
          type: 'success',
          message: '报价草稿已保存',
          description: `“${restoredCreatedQuotation.candidateName}”已保存并回显 ${restoredCreatedQuotation.savedRows.length} 种物料，可继续修改或提交审批。`,
        }
      : undefined
  );
  const contextLoaded = ref(false);
  const candidateId = ref(routeCandidateId);
  const viewOnly = computed(() => route.query.mode === 'view');
  const locked = computed(() => !!draftRecord.value.id && !isQuotationEditable(draftRecord.value.status));
  const currentStatus = computed(() => draftRecord.value.status || QUOTATION_STATUS_DRAFT);
  const savePermission = computed(() => (draftRecord.value.id ? PERMISSIONS.edit : PERMISSIONS.add));
  const canModify = computed(() => contextLoaded.value && !viewOnly.value && !locked.value && hasPermission(savePermission.value));
  const canLock = computed(() => canModify.value);
  const noticeContent = computed(() => {
    if (saveNotice.value) return saveNotice.value;
    return {
      type: !viewOnly.value && locked.value ? 'success' : 'info',
      message: statusMeta.value[currentStatus.value]?.text || currentStatus.value,
      description: viewOnly.value
        ? '当前为报价详情，只能查看物料清单。'
        : locked.value
          ? '报价已提交、通过或采用，当前页面仅支持查看。'
          : canModify.value
            ? '填写物料后保存草稿，提交后等待领导审批；审批通过后锁定。'
            : '当前账号没有新增或修改报价的权限，仅支持查看。',
    };
  });

  async function getCandidateRecords() {
    const result: any = await getMaterialCandidateList({ periodId, pageNo: 1, pageSize: 1000 });
    return result?.records || result || [];
  }

  async function loadContext() {
    if (!periodId) {
      createMessage.error('报价页面缺少项目分期 ID，请从报价管理重新进入');
      goBack();
      return;
    }
    if ((route.query.mode === 'edit' || route.query.mode === 'view') && !routeCandidateId) {
      createMessage.error('报价页面缺少候选清单 ID，请从报价管理重新进入');
      goBack();
      return;
    }
    const [projectResult, candidateResult] = await Promise.allSettled([
      projectDetail({ periodId }),
      routeCandidateId ? getMaterialCandidateList({ periodId, pageNo: 1, pageSize: 1000 }) : Promise.resolve({ records: [] }),
    ]);
    projectRecord.value = projectResult.status === 'fulfilled' ? (projectResult.value as Recordable) || {} : {};
    const result: any = candidateResult.status === 'fulfilled' ? candidateResult.value : [];
    const records = result?.records || result || [];
    const candidate =
      records.find((item: any) => String(item.id) === routeCandidateId) ||
      (restoredCreatedQuotation
        ? {
            id: restoredCreatedQuotation.candidateId,
            periodId,
            candidateName: restoredCreatedQuotation.candidateName,
            status: restoredCreatedQuotation.status,
          }
        : undefined);
    if (routeCandidateId && !candidate) {
      createMessage.error('未找到对应报价记录，请返回报价管理后重试');
      goBack();
      return;
    }
    draftRecord.value = candidate ? { ...candidate, status: normalizeQuotationStatus(candidate.status) } : {};
    if (candidate?.candidateName) candidateName.value = candidate.candidateName;
    contextLoaded.value = true;
  }

  function buildCandidatePayload(status: string) {
    const name = candidateName.value.trim();
    if (!name) throw new Error('请输入报价单名称');
    return {
      ...(draftRecord.value.id ? { id: draftRecord.value.id } : {}),
      periodId,
      candidateName: name,
      status,
    };
  }

  async function resolveCandidateId(result: any, payload: Recordable) {
    const directId = result?.id ?? result?.result?.id;
    if (directId) return String(directId);
    if (typeof result === 'string' || typeof result === 'number') return String(result);
    const records = await getCandidateRecords();
    const matched = records.find((item: any) => item.candidateName === payload.candidateName && String(item.periodId) === periodId);
    return matched?.id ? String(matched.id) : '';
  }

  async function findCandidateByName(name: string) {
    const records = await getCandidateRecords();
    return records.find((item: any) => item.candidateName === name && String(item.periodId) === periodId);
  }

  async function refreshSavedCandidate(id: string) {
    const records = await getCandidateRecords();
    const savedRecord = records.find((item: any) => String(item.id) === id);
    if (!savedRecord) return;
    draftRecord.value = {
      ...draftRecord.value,
      ...savedRecord,
      id,
      status: normalizeQuotationStatus(savedRecord.status),
    };
    if (savedRecord.candidateName) candidateName.value = savedRecord.candidateName;
  }

  async function refreshSavedContent(savedItems: Recordable[] | undefined, submittedItems: Recordable[]) {
    const id = String(draftRecord.value.id || '');
    if (!id) throw new Error('报价主表已保存，但未取得候选清单 ID');
    candidateId.value = id;
    try {
      await refreshSavedCandidate(id);
    } catch {
      // 主表在 persistCandidate 中已有保存结果；主表刷新失败不应阻断明细回显。
    }
    await nextTick();
    let rowsToHydrate = Array.isArray(savedItems) && (savedItems.length || !submittedItems.length) ? savedItems : undefined;
    if (!rowsToHydrate) {
      try {
        const result: any = await getMaterialCandidateItemList({ candidateId: id, pageNo: 1, pageSize: 1000 });
        const persistedItems = result?.records || result || [];
        if (Array.isArray(persistedItems) && persistedItems.length) rowsToHydrate = persistedItems;
      } catch {
        // 保存成功后的即时查询暂不可用时，保留本次提交内容，避免页面被空结果清掉。
      }
    }
    await tableRef.value?.hydrateSavedQuotationRows?.(rowsToHydrate || submittedItems);
    return Number(tableRef.value?.getRowCount?.() || 0);
  }

  async function persistCandidate(status: string) {
    const payload = buildCandidatePayload(status);
    const isNew = !draftRecord.value.id;
    if (!isNew) {
      const latest = (await getCandidateRecords()).find((item: any) => String(item.id) === String(draftRecord.value.id));
      if (!latest || !isQuotationEditable(latest.status)) throw new Error('报价状态已变化，当前不可修改，请刷新确认');
    }
    const existing = isNew ? await findCandidateByName(payload.candidateName) : undefined;
    if (existing && normalizeQuotationStatus(existing.status) !== QUOTATION_STATUS_DRAFT) {
      throw new Error('同一分期已存在同名且非草稿状态的报价单，请更换报价单名称');
    }
    const result: any = existing
      ? existing
      : isNew
        ? await addMaterialCandidate({ periodId, candidateName: payload.candidateName }, false)
        : await editMaterialCandidate(payload, false);
    const id = draftRecord.value.id || (await resolveCandidateId(result, payload));
    if (!id) throw new Error('候选清单主表保存成功，但接口未返回候选清单 ID');
    draftRecord.value = {
      ...draftRecord.value,
      ...(result && typeof result === 'object' ? result : {}),
      ...payload,
      id,
      status: normalizeQuotationStatus(result?.status ?? status),
    };
    candidateName.value = payload.candidateName;
    return { created: isNew && !existing, shouldEnterEdit: isNew, id };
  }

  function getMaterialRecords(requireRows = false) {
    const records = tableRef.value?.getData?.() || [];
    if (requireRows && !records.length) throw new Error('请至少选择一种物料后再提交');
    return records;
  }

  async function saveMaterials(records: Recordable[], isNew: boolean) {
    if (!records.length && isNew) return [];
    const payload = { candidateId: draftRecord.value.id, records };
    const result: any = isNew ? await addMaterialCandidateItems(payload, false) : await editMaterialCandidateItems(payload, false);
    const candidates = [result, result?.records, result?.result, result?.result?.records, result?.data, result?.data?.records];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return undefined;
  }

  async function enterEditModeAfterCreate(id: string, savedRows: Recordable[], status: string, showSavedNotice = false) {
    pendingCreatedQuotation = {
      candidateId: id,
      candidateName: candidateName.value,
      savedRows,
      status,
      showSavedNotice,
    };
    try {
      await router.replace({ path: route.path, query: { mode: 'edit', periodId, candidateId: id } });
      return true;
    } catch {
      if (pendingCreatedQuotation?.candidateId === id) pendingCreatedQuotation = undefined;
      return false;
    }
  }

  async function handleSave() {
    if (!canModify.value || saving.value) return createMessage.warning('当前账号没有保存报价的权限');
    saving.value = true;
    try {
      const records = getMaterialRecords();
      const { created, shouldEnterEdit, id } = await persistCandidate(QUOTATION_STATUS_DRAFT);
      const savedItems = await saveMaterials(records, created);
      const savedRows = Array.isArray(savedItems) && (savedItems.length || !records.length) ? savedItems : records;
      if (shouldEnterEdit) {
        const switched = await enterEditModeAfterCreate(id, savedRows, QUOTATION_STATUS_DRAFT, true);
        if (switched) {
          createMessage.success('报价草稿已保存');
          return;
        }
      }
      const savedCount = await refreshSavedContent(savedItems, records);
      saveNotice.value = {
        type: 'success',
        message: '报价草稿已保存',
        description: `“${candidateName.value}”已保存并回显 ${savedCount} 种物料，可继续修改或提交审批。`,
      };
      createMessage.success('报价草稿已保存');
    } catch (error: any) {
      createMessage.error(error?.message || '保存失败，请重试');
    } finally {
      saving.value = false;
    }
  }

  async function handleLock() {
    if (!canLock.value || saving.value) return createMessage.warning('当前账号没有锁定报价的权限');
    saving.value = true;
    try {
      const records = getMaterialRecords(true);
      const draftResult = await persistCandidate(QUOTATION_STATUS_DRAFT);
      const savedItems = await saveMaterials(records, draftResult.created);
      await persistCandidate(QUOTATION_STATUS_SUBMITTED);
      const savedRows = Array.isArray(savedItems) && savedItems.length ? savedItems : records;
      const switched = draftResult.shouldEnterEdit ? await enterEditModeAfterCreate(draftResult.id, savedRows, QUOTATION_STATUS_SUBMITTED) : false;
      if (!switched) await refreshSavedContent(savedItems, records);
      saveNotice.value = undefined;
      createMessage.success('报价已提交，等待审批');
    } catch (error: any) {
      createMessage.error(error?.message || '提交失败，请重试');
    } finally {
      saving.value = false;
    }
  }

  function goBack() {
    router.push('/plan/material-draft');
  }

  onMounted(async () => {
    statusMeta.value = await loadQuotationStatusMap();
    await loadContext();
    if (restoredCreatedQuotation && contextLoaded.value) {
      candidateId.value = restoredCreatedQuotation.candidateId;
      await nextTick();
      await tableRef.value?.hydrateSavedQuotationRows?.(restoredCreatedQuotation.savedRows);
    }
  });
</script>

<style lang="less" scoped>
  .material-draft-editor {
    padding: 16px;

    &__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 14px 20px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(31, 35, 41, 0.06);
    }

    &__heading,
    &__actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    &__title {
      color: #262626;
      font-size: 18px;
      font-weight: 600;
      line-height: 26px;
    }

    &__subtitle {
      color: #595959;
      font-size: 13px;
      line-height: 20px;
    }

    &__context {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px 28px;
      margin-top: 8px;
      padding: 16px 20px;
      background: #fff;
      border-radius: 8px;

      div {
        min-width: 0;
        color: #262626;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      span {
        display: block;
        margin-bottom: 4px;
        color: #595959;
        font-size: 13px;
      }
    }

    &__notice {
      margin-top: 8px;
    }

    &__content {
      margin-top: 8px;
      padding: 20px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(31, 35, 41, 0.05);
    }

    @media (max-width: 900px) {
      &__header {
        align-items: flex-start;
        flex-direction: column;
      }

      &__context {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  }
</style>
