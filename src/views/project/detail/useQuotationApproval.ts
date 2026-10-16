import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '/@/store/modules/user';
import { usePermission } from '/@/hooks/web/usePermission';
import { useMessage } from '/@/hooks/web/useMessage';
import { getCandidateRecord, getMaterialCandidateList, getQuotationAccess } from '/@/views/plan/Plan.api';
import { getProjectBasic } from './ProjectDetail.api';
import { canApprovePeriodQuotation, canPricePeriodQuotation } from './quotationApproval';

// 审批和待定价共用加载、选择及点击前复核流程，不改变报价详情的实际办理权限。
export function useQuotationApproval(periodId: Ref<string>, project: Ref<any>, ready: Ref<boolean>, action: 'approve' | 'price' = 'approve') {
  const user = useUserStore();
  const router = useRouter();
  const { hasPermission } = usePermission();
  const { createMessage } = useMessage();
  const pricing = action === 'price';
  const label = pricing ? '定价' : '审批';
  const status = pricing ? '1' : '2';
  const canEnter = pricing ? canPricePeriodQuotation : canApprovePeriodQuotation;
  const hasEntryPermission = () => pricing ? hasPermission('plan:quotation:price')
    : (hasPermission('plan:quotation:technicalApprove') || hasPermission('plan:quotation:lock'));
  const records = ref<Recordable[]>([]), loading = ref(false), error = ref(''), open = ref(false), navigating = ref(false);
  const eligible = computed(() => ready.value && project.value.status === 'NOT_STARTED' && !!periodId.value && !!user.getIdentity.userId
    && hasEntryPermission());
  const visible = computed(() => eligible.value && (records.value.length > 0 || !!error.value));
  let generation = 0;
  async function load(preserveVisible = false) {
    const request = ++generation, id = periodId.value;
    if (!preserveVisible) records.value = [];
    error.value = '';
    if (!eligible.value) { records.value = []; loading.value = false; return; }
    loading.value = true;
    try {
      const candidates: Recordable[] = [];
      let pageNo = 1, pages = 1;
      do {
        const page = await getMaterialCandidateList({ periodId: id, status, pageNo, pageSize: 100 });
        if (request !== generation) return;
        if (!Array.isArray(page?.records)) throw new Error('报价列表格式异常');
        candidates.push(...page.records);
        pages = Number(page.pages || Math.ceil(Number(page.total || 0) / Number(page.size || 100)) || 1);
        pageNo++;
      } while (pageNo <= pages);
      const pending = [...new Map(candidates.filter(row => String(row.periodId) === id && String(row.status) === status
        && row.id && (pricing ? row.approvalRoute !== 'MARKET' && String(row.priced) === '0'
          : hasPermission(row.approvalRoute === 'MARKET' ? 'plan:quotation:lock' : 'plan:quotation:technicalApprove')))
        .map(row => [String(row.id), row])).values()];
      const allowed: Recordable[] = [];
      for (let offset = 0; offset < pending.length; offset += 3) {
        const batch = await Promise.all(pending.slice(offset, offset + 3).map(async row => {
          const access = await getQuotationAccess(id, String(row.id));
          return canEnter(project.value.status, id, row, access, hasPermission) ? row : null;
        }));
        if (request !== generation) return;
        allowed.push(...batch.filter((row): row is Recordable => row !== null));
      }
      records.value = allowed;
    } catch (e: any) {
      if (request === generation) { records.value = []; error.value = e?.message || `报价${label}权限加载失败`; }
    } finally { if (request === generation) loading.value = false; }
  }
  async function enter(row: Recordable) {
    if (!eligible.value || navigating.value || loading.value) return;
    const id = periodId.value, request = generation;
    navigating.value = true;
    try {
      const [current, candidate, access] = await Promise.all([
        getProjectBasic({ periodId: id }), getCandidateRecord(id, String(row.id)), getQuotationAccess(id, String(row.id)),
      ]);
      if (request !== generation || !eligible.value) return;
      if (String(current?.periodId) !== id || !canEnter(current.status, id, candidate, access, hasPermission)) {
        createMessage.warning(`分期、报价状态或${label}权限已变化，请刷新后查看`);
        open.value = false; await load(); return;
      }
      open.value = false;
      await router.push({ path: '/plan/material-draft/editor', query: { ...(pricing ? { mode: 'price' } : { mode: 'view', audit: '1' }), from: 'project-detail', periodId: id, candidateId: String(candidate.id) } });
    } catch (e: any) { if (request === generation) createMessage.error(e?.message || `报价${label}打开失败`); }
    finally { navigating.value = false; }
  }
  async function handleOpen() {
    if (loading.value || navigating.value) return;
    await load(true);
    if (error.value || !eligible.value) return;
    if (records.value.length === 1) await enter(records.value[0]);
    else if (records.value.length) open.value = true;
    else createMessage.info(`当前没有可${label}的报价单`);
  }
  watch(() => [eligible.value, periodId.value, ready.value, user.getToken,
    hasPermission('plan:quotation:technicalApprove'), hasPermission('plan:quotation:lock'), hasPermission('plan:quotation:price')], () => {
    open.value = false; void load();
  }, { immediate: true, flush: 'sync' });
  onBeforeUnmount(() => { generation++; });
  return { records, loading, error, open, navigating, visible, handleOpen, enter };
}
