import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useUserStore } from '/@/store/modules/user';
import { usePermission } from '/@/hooks/web/usePermission';
import { getMaterialCandidateList, getQuotationAccess } from '/@/views/plan/Plan.api';
import { isApprovalApproved } from '/@/utils/approvalStatus';

/** 项目详情合同通过后不再提供授权入口；其他条件保持原规则。 */
export function useQuotationGrant(periodId: Ref<string>, ready: Ref<boolean>, contractStatus?: Ref<unknown>) {
  const user = useUserStore();
  const { hasPermission } = usePermission();
  const allowed = ref(false), loading = ref(false), error = ref(''), open = ref(false);
  const eligible = computed(() => ready.value && !isApprovalApproved(contractStatus?.value) && !!periodId.value && !!user.getIdentity.userId && hasPermission('plan:quotation:grant'));
  const visible = computed(() => eligible.value && (allowed.value || !!error.value));
  let sequence = 0;
  async function load() {
    const request = ++sequence, id = periodId.value;
    error.value = '';
    if (!eligible.value) { allowed.value = false; loading.value = false; return false; }
    loading.value = true;
    try {
      const access = await getQuotationAccess(id);
      if (request !== sequence) return false;
      if (!access.canManage) { allowed.value = false; return false; }
      // 只检查是否存在报价，不取所有分页，也不逐张查询权限。
      const page = await getMaterialCandidateList({ periodId: id, pageNo: 1, pageSize: 1 });
      if (request !== sequence) return false;
      if (!Array.isArray(page?.records)) throw new Error('报价列表格式异常');
      allowed.value = page.records.some(row => !!row.id && String(row.periodId) === id);
      return allowed.value;
    } catch (e: any) {
      if (request === sequence) { allowed.value = false; error.value = e?.message || '报价授权权限加载失败'; }
      return false;
    } finally { if (request === sequence) loading.value = false; }
  }
  async function handleOpen() {
    if (loading.value) return;
    if (await load()) open.value = true;
  }
  watch(() => [eligible.value, periodId.value, user.getToken], () => {
    open.value = false; allowed.value = false; void load();
  }, { immediate: true, flush: 'sync' });
  onBeforeUnmount(() => { sequence++; });
  return { visible, loading, error, open, handleOpen };
}
