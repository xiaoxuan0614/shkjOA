<template>
  <div class="material-draft-editor">
    <div class="material-draft-editor__header">
      <div class="material-draft-editor__heading">
        <a-button type="link" @click="goBack">返回</a-button>
        <div
          ><div class="material-draft-editor__title">{{ title }}</div
          ><div class="material-draft-editor__subtitle">{{ project.projectName || '—' }} / {{ project.periodName || '—' }}</div></div
        >
        <a-tag v-if="record.status != null">{{ statusMeta[String(record.status)]?.text || '—' }}</a-tag>
        <a-tag v-if="record.id">{{ Number(record.adopted) === 1 ? '已采用' : '未采用' }}</a-tag>
        <a-tag v-if="record.id">{{ Number(record.priced) === 1 ? '已定价' : '未定价' }}</a-tag>
      </div>
      <div class="material-draft-editor__actions">
        <a-button :disabled="saving" @click="reload">刷新</a-button>
        <a-button v-if="canUnlock" :disabled="saving" @click="unlockEditing">修改</a-button>
        <a-button v-if="canModify" :loading="saving" @click="save">{{ record.id ? '保存修改' : '保存草稿' }}</a-button>
        <a-popconfirm v-if="canSubmitSaved" title="确认提交已保存的报价内容审核？" @confirm="submit">
          <a-button type="primary" :loading="saving">提交审批</a-button>
        </a-popconfirm>
        <a-popconfirm v-if="loaded && caps.withdraw" title="撤回后恢复草稿并关闭审批待办，确认撤回？" @confirm="withdraw">
          <a-button :loading="saving">撤回审批</a-button>
        </a-popconfirm>
        <template v-if="reviewMode && loaded && caps.approve">
          <a-popconfirm title="确认通过技术审批？通过后由市场部主管维护比例和指导价。" @confirm="review('1')"
            ><a-button type="primary" :loading="saving">通过</a-button></a-popconfirm
          >
          <a-button danger :disabled="saving" @click="rejectOpen = true">驳回</a-button>
        </template>
        <a-popconfirm v-if="canPrice" title="按当前比例和终价确认整单定价？" @confirm="confirmPrice"
          ><a-button type="primary" :loading="saving">确认定价</a-button></a-popconfirm
        >
        <a-button v-if="loaded && access.canManage && hasPermission('plan:quotation:grant')" @click="grantOpen = true" :disabled="saving">报价授权</a-button>
        <a-button v-if="!simpleLoad && loaded && record.id" @click="historyOpen = true">操作记录</a-button>
      </div>
    </div>
    <a-alert class="material-draft-editor__notice" show-icon :type="error ? 'error' : 'info'" :message="error || notice" />
    <a-alert v-if="String(record.status) === '0'" class="material-draft-editor__notice" type="error" show-icon message="审批已驳回">
      <template #description>
        <span v-if="rejectionLoading" role="status">正在加载驳回原因…</span>
        <template v-else-if="rejectionLoadError">{{ rejectionLoadError }} <a-button type="link" @click="loadRejection">重试</a-button></template>
        <div v-else style="white-space: pre-wrap; overflow-wrap: anywhere">{{ rejectionReason || '未查询到明确的驳回原因，请联系审批人核实。' }}</div>
      </template>
    </a-alert>
    <div class="material-draft-editor__context">
      <div v-if="!detailOnly || candidateName"><span>报价单名称</span><a-input v-model:value="candidateName" aria-label="报价单名称" :disabled="!!record.id || !canModify || saving" :maxlength="100" /></div>
      <div><span>主项目名称</span>{{ project.projectName || '—' }}</div>
      <div><span>分期名称</span>{{ project.periodName || '—' }}</div>
    </div>
    <div v-if="loaded" class="material-draft-editor__content">
      <a-alert v-if="canPrice" type="info" show-icon message="成本价只读。指导价=成本价×（1+指导比例÷100），保留两位小数；调整比例会重新计算，也可手动修改指导价。默认比例未返回时请填写。" />
      <MaterialPlanTable
        :key="tableEpoch"
        ref="tableRef"
        :candidate-id="tableCandidateId"
        mode="quotation"
        quote-pricing
        paginated
        snapshot-only
        :editable="canModify && !saving"
        :structure-editable="!record.id || caps.structure"
        :cost-visible="true"
        :price-visible="showMarketPricing"
        :base-price-editable="canModify && (!record.id || caps.editBase)"
        :pricing-editable="canPrice"
        :combined-material-identity="viewOnly"
        :busy="saving"
        @loaded="restoreQuotationDraft"
      />
    </div>
    <a-modal v-model:open="rejectOpen" title="驳回报价" :confirm-loading="saving" @ok="review('0')">
      <a-form layout="vertical"
        ><a-form-item label="驳回原因" required :validate-status="rejectError ? 'error' : undefined" :help="rejectError"
          ><a-textarea v-model:value="rejectReason" :maxlength="500" :rows="3" /></a-form-item
      ></a-form>
    </a-modal>
    <QuotationGrantModal v-if="loaded && access.canManage && hasPermission('plan:quotation:grant')" v-model:open="grantOpen" :period-id="periodId" @success="reloadAccess" />
    <QuotationHistoryModal v-if="!simpleLoad" v-model:open="historyOpen" :period-id="periodId" :candidate-id="candidateId" />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, nextTick } from 'vue';
  import { useSessionDraft } from '/@/hooks/web/useSessionDraft';
  import { useRoute, useRouter } from 'vue-router';
  import { useUserStore } from '/@/store/modules/user';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { projectDetail } from '/@/views/project/Project.api';
  import MaterialPlanTable from '../components/MaterialPlanTable.vue';
  import QuotationGrantModal from './QuotationGrantModal.vue';
  import QuotationHistoryModal from './QuotationHistoryModal.vue';
  import { quotationListStatusMap as statusMeta } from '../Plan.data';
  import {
    addMaterialCandidate,
    editMaterialCandidateItems,
    candidateAction,
    getCandidateRecord,
    getQuotationAccess,
    getQuotationHistory,
  } from '../Plan.api';
  import { noQuotationAccess, quotationCapabilities, quotationListCapabilities, quotationVersion, assertQuotationVersion } from '../quotationGovernance';
  import { quotationPricePayload } from '../quotationPricing';
  import { findQuotationRejection } from '../quotationRejection';
  defineOptions({ name: 'ContractMaterialDraftEditor' });
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();
  const { hasPermission } = usePermission();
  const { createMessage } = useMessage();
  const periodId = String(route.query.periodId || route.params.id || '');
  const candidateId = ref(String(route.query.candidateId || ''));
  const tableCandidateId = ref(candidateId.value);
  const record = ref<Recordable>({});
  const project = ref<Recordable>({});
  const access = ref({ ...noQuotationAccess });
  const loaded = ref(false);
  const saving = ref(false);
  const error = ref('');
  const tableRef = ref();
  const tableEpoch = ref(0);
  const candidateName = ref(String(route.query.candidateName || ''));
  const rejectOpen = ref(false);
  const rejectReason = ref('');
  const rejectError = ref('');
  const rejectionReason = ref('');
  const rejectionLoading = ref(false);
  const rejectionLoadError = ref('');
  let rejectionSequence = 0;
  async function loadRejection() {
    const sequence = ++rejectionSequence;
    rejectionReason.value = '';
    rejectionLoadError.value = '';
    rejectionLoading.value = false;
    if (String(record.value.status) !== '0' || !candidateId.value) return;
    rejectionLoading.value = true;
    try {
      const entry = await findQuotationRejection(
        pageNo => getQuotationHistory({ periodId, candidateId: candidateId.value, pageNo, pageSize: 100 }),
        () => sequence === rejectionSequence
      );
      if (sequence === rejectionSequence) rejectionReason.value = String(entry?.reason || '').trim();
    } catch {
      if (sequence === rejectionSequence) rejectionLoadError.value = '驳回原因加载失败，请重试。';
    } finally {
      if (sequence === rejectionSequence) rejectionLoading.value = false;
    }
  }
  const grantOpen = ref(false);
  const historyOpen = ref(false);
  const editing = ref(route.query.mode === 'create');
  const needsRecovery = ref(false);
  let draftRestored = false;
  const quotationDraft = useSessionDraft<any>(`quotation:${periodId}:${candidateId.value || 'new'}`, () => {
    if (!editing.value || saving.value || !loaded.value || reviewMode.value || pricingMode.value) return undefined;
    return {
      id: candidateId.value, version: record.value.version,
      name: candidateName.value,
      rows: (tableRef.value?.getRows() || []).map((row: any) => Object.fromEntries(
        ['id', 'materialId', 'materialName', 'materialCode', 'materialCategory', 'brand', 'model', 'unit', 'unitId', '_unitValue', 'plannedQty', 'basePrice', 'remark'].map((field) => [field, row[field]])
      )),
    };
  });
  async function restoreQuotationDraft() {
    await nextTick();
    if (draftRestored || !loaded.value || !quotationDraft.isAlive() || reviewMode.value || pricingMode.value) return;
    draftRestored = true;
    const saved = quotationDraft.read();
    try {
      if (saved) {
        if (String(saved.id || '') !== candidateId.value) throw new Error('草稿已关联其他报价主单，请从报价列表打开该单，避免重复创建');
        if (candidateId.value) {
          const latest = await getCandidateRecord(periodId, candidateId.value);
          if (String(latest.version) !== String(saved.version)) throw new Error('报价版本已变化，未恢复旧草稿，请核对最新报价');
          record.value = latest;
          if (!canUnlock.value && !canModify.value) throw new Error('当前报价已不可编辑，未恢复草稿');
          editing.value = true;
          await nextTick();
        }
        if (canModify.value && Array.isArray(saved.rows)) {
          candidateName.value = saved.name || '';
          await tableRef.value?.restoreQuotationDraft(saved.rows);
        }
      }
    } catch (error: any) {
      quotationDraft.clear();
      createMessage.warning(error?.message || '报价草稿恢复失败，请核对');
    }
    quotationDraft.enable();
  }
  const reviewMode = computed(() => route.query.audit === '1');
  const pricingMode = computed(() => route.query.mode === 'price');
  const detailOnly = computed(() => route.query.mode === 'view' && !reviewMode.value);
  const editFromList = computed(() => route.query.mode === 'edit' && !reviewMode.value);
  const simpleLoad = computed(() => detailOnly.value || editFromList.value);
  const viewOnly = computed(() => !editing.value || reviewMode.value || pricingMode.value);
  const caps = computed(() => {
    if (!simpleLoad.value) return quotationCapabilities(record.value, access.value, userStore.getUserInfo, hasPermission);
    const list = quotationListCapabilities(record.value, hasPermission, userStore.getUserInfo);
    const structure = list.edit && String(record.value.adopted) !== '1';
    return { ...list, structure, editBase: structure, approve: false,
      price: quotationCapabilities(record.value, access.value, userStore.getUserInfo, hasPermission).price };
  });
  const canModify = computed(
    () => loaded.value && !viewOnly.value && (record.value.id ? caps.value.edit : hasPermission('plan:quotation:add'))
  );
  const canUnlock = computed(() => loaded.value && !canPrice.value && !editing.value && !reviewMode.value && !pricingMode.value && !!record.value.id && caps.value.structure);
  const canSubmitSaved = computed(() => loaded.value && !editing.value && !reviewMode.value && !pricingMode.value && !!record.value.id && caps.value.submit);
  function unlockEditing() {
    if (!canUnlock.value || saving.value) return;
    editing.value = true;
    quotationDraft.enable();
  }
  const canPrice = computed(() => loaded.value && !editing.value && !reviewMode.value && (pricingMode.value || simpleLoad.value) && caps.value.price);
  const showMarketPricing = computed(() => canPrice.value && String(record.value.status) === '1');
  const title = computed(() =>
    reviewMode.value ? '技术审批' : pricingMode.value ? '市场定价' : viewOnly.value ? '查看报价' : record.value.id ? '修改报价' : '新增报价'
  );
  const notice = computed(() => {
    if (canPrice.value) return '技术审批已通过，可维护指导比例和指导价并确认定价，成本价保持只读。';
    if (reviewMode.value) return '技术审批仅查看报价内容并操作通过或驳回；提价比例和指导价由市场部主管在审批通过后维护。';
    if (pricingMode.value) {
      return canPrice.value
        ? '技术审批通过后，填写全部明细的提价比例和指导价；确认定价后才可导出。'
        : '当前账号没有市场定价资格，提价比例和指导价已隐藏。';
    }
    if (!editing.value && !reviewMode.value && !pricingMode.value) return '当前为已保存的只读内容。需要调整请点击“修改”，保存后可提交审核。';
    if (String(record.value.status) === '2') return '待审批内容只读，仅原提交人可在审批前撤回。';
    if (Number(record.value.adopted) === 1) return '已采用：成本价、物料、单位、数量及明细增删均锁定。';
    return '提交前仅维护报价内容；提价比例和指导价在技术审批通过后由市场部主管维护。';
  });

  async function reloadAccess() {
    access.value = await getQuotationAccess(periodId);
  }
  async function reload() {
    if (saving.value) return;
    loaded.value = false;
    access.value = { ...noQuotationAccess };
    error.value = '';
    try {
      if (!periodId) throw new Error('缺少项目分期 ID，请从报价管理进入');
      if (route.query.mode !== 'create' && !candidateId.value) throw new Error('缺少候选清单 ID');
      if (simpleLoad.value) {
        const candidate = needsRecovery.value ? await getCandidateRecord(periodId, candidateId.value) : {
          id: candidateId.value, version: route.query.version == null ? undefined : quotationVersion(route.query.version),
          candidateName: String(route.query.candidateName || ''), status: String(route.query.status || ''),
          adopted: String(route.query.adopted ?? ''), priced: String(route.query.priced ?? ''), createBy: String(route.query.createBy || ''),
        };
        if (editFromList.value && !['0', '1'].includes(String(candidate.adopted))) throw new Error('缺少报价采用状态，请返回列表重新进入');
        project.value = (await projectDetail({ periodId })) || {};
        record.value = candidate;
        if (String(candidate.status) === '1') await reloadAccess();
        void loadRejection();
        candidateName.value = candidate.candidateName || '';
        editing.value = false;
        if (needsRecovery.value) await router.replace({ path: route.path, query: {
          mode: 'view', periodId, candidateId: candidateId.value, version: candidate.version,
          candidateName: candidate.candidateName, status: candidate.status,
          adopted: candidate.adopted, priced: candidate.priced, createBy: candidate.createBy,
        } });
        needsRecovery.value = false;
        tableCandidateId.value = candidateId.value;
        tableEpoch.value++;
        loaded.value = true;
        return;
      }
      const [p, permissions, candidate] = await Promise.all([
        projectDetail({ periodId }),
        getQuotationAccess(periodId),
        candidateId.value ? getCandidateRecord(periodId, candidateId.value) : Promise.resolve({}),
      ]);
      project.value = p || {};
      access.value = permissions;
      record.value = candidate;
      void loadRejection();
      if (candidate.candidateName) candidateName.value = candidate.candidateName;
      tableCandidateId.value = candidateId.value;
      tableEpoch.value++;
      loaded.value = true;
    } catch (e: any) {
      error.value = e?.message || '报价加载失败，请刷新；请确认后端报价治理版本已部署';
    }
  }
  async function verifyCurrent() {
    if (simpleLoad.value) {
      quotationVersion(record.value.version);
      if (String(record.value.status) === '1') await reloadAccess();
      return;
    }
    const permissions = await getQuotationAccess(periodId);
    access.value = permissions;
    if (!record.value.id) return;
    const latest = await getCandidateRecord(periodId, candidateId.value);
    assertQuotationVersion(record.value, latest);
    return latest;
  }
  async function persist() {
    await verifyCurrent();
    if (!canModify.value) throw new Error('当前报价状态或权限不允许修改');
    const name = candidateName.value.trim();
    if (!name) throw new Error('请输入报价单名称');
    const records = tableRef.value?.getData();
    if (!Array.isArray(records)) throw new Error('物料尚未加载完成');
    if (!record.value.id) {
      const created = await addMaterialCandidate({ periodId, candidateName: name }, false);
      if (!created?.id) {
        loaded.value = false;
        throw new Error('保存主单未返回 ID，请返回列表确认，勿重复新增');
      }
      // 先记住主单，明细失败重试也不会重复新增。
      record.value = created;
      candidateId.value = String(created.id);
      quotationVersion(created.version);
      await editMaterialCandidateItems({ candidateId: candidateId.value, version: created.version, records }, false);
    } else {
      await editMaterialCandidateItems({
        candidateId: candidateId.value,
        version: quotationVersion(record.value.version),
        records,
      }, false);
    }
    // 写入成功即锁定；回查失败时不得用旧版本再次保存或提交。
    editing.value = false;
    loaded.value = false;
    needsRecovery.value = true;
    quotationDraft.clear();
  }
  async function run(work: () => Promise<void>) {
    if (saving.value || !loaded.value) return;
    saving.value = true;
    error.value = '';
    try {
      await work();
    } catch (e: any) {
      error.value = e?.message || '操作失败，请刷新后重试';
      createMessage.error(error.value);
    } finally {
      saving.value = false;
    }
  }
  async function refreshAfterWrite() {
    loaded.value = false;
    needsRecovery.value = true;
    record.value = await getCandidateRecord(periodId, candidateId.value);
    void loadRejection();
    quotationVersion(record.value.version);
    candidateName.value = record.value.candidateName;
    if (tableCandidateId.value !== candidateId.value) {
      tableCandidateId.value = candidateId.value;
      tableEpoch.value++;
    } else await tableRef.value?.reload();
    if (!reviewMode.value && !pricingMode.value) await router.replace({ path: route.path, query: {
      mode: 'view', periodId, candidateId: candidateId.value, version: record.value.version,
      candidateName: record.value.candidateName, status: record.value.status,
      adopted: record.value.adopted, priced: record.value.priced, createBy: record.value.createBy,
    } });
    editing.value = false;
    needsRecovery.value = false;
    loaded.value = true;
  }
  async function save() {
    await run(async () => {
      await persist();
      await refreshAfterWrite();
      createMessage.success('报价已保存');
    });
  }
  async function submit() {
    await run(async () => {
      if (!hasPermission('plan:quotation:submit')) throw new Error('没有提交审批按钮权限');
      if (!canSubmitSaved.value) throw new Error('请先保存修改，再提交审核');
      await verifyCurrent();
      await candidateAction('submit', record.value);
      await refreshAfterWrite();
      createMessage.success('已提交报价审批');
    });
  }
  async function withdraw() {
    await run(async () => {
      await verifyCurrent();
      if (!caps.value.withdraw) throw new Error('当前不可撤回');
      await candidateAction('withdraw', record.value);
      await refreshAfterWrite();
      createMessage.success('已撤回为草稿');
    });
  }
  async function review(result: '0' | '1') {
    rejectError.value = '';
    if (result === '0' && !rejectReason.value.trim()) {
      rejectError.value = '请填写驳回原因';
      return;
    }
    await run(async () => {
      await verifyCurrent();
      if (!caps.value.approve) throw new Error('当前不可审批');
      await candidateAction('approve', record.value, { result, ...(result === '0' ? { reason: rejectReason.value.trim() } : {}) });
      rejectOpen.value = false;
      await refreshAfterWrite();
      createMessage.success(result === '1' ? '技术审批已通过，待市场部主管确认定价' : '技术审批已驳回');
    });
  }
  async function confirmPrice() {
    await run(async () => {
      await verifyCurrent();
      if (!caps.value.price) throw new Error('当前无定价资格');
      tableRef.value?.getData();
      const rows = tableRef.value?.getRows();
      if (!rows?.length) throw new Error('报价明细为空');
      const records = rows.map((row: any) => {
        if (!row.id) throw new Error('缺少明细 ID，请刷新');
        const values = quotationPricePayload(row, true);
        return { id: row.id, markupRate: values.markupRate, finalPrice: values.finalPrice };
      });
      await candidateAction('price', record.value, { records });
      await refreshAfterWrite();
      createMessage.success('整单定价已确认');
    });
  }
  function goBack() {
    router.push('/plan/material-draft');
  }
  onMounted(reload);
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
