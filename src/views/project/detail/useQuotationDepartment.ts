import { ref, watch } from 'vue';
import { useUserStore } from '/@/store/modules/user';
import { defHttp } from '/@/utils/http/axios';
import { canViewProjectQuotation } from './quotationDepartment';

export function useQuotationDepartment() {
  const userStore = useUserStore();
  const allowed = ref(false);
  watch(
    () => [userStore.getToken, userStore.getIdentity.userId, userStore.getIdentity.departmentIds.join(',')],
    async (_, __, onCleanup) => {
      let cancelled = false;
      onCleanup(() => { cancelled = true; });
      allowed.value = false;
      const { userId, departmentIds } = userStore.getIdentity;
      if (!userId || !departmentIds.length) return;
      // 登录信息包含完整部门名时直接复用；只有缺失名称才按所属部门ID补查。
      const cached: any[] = userStore.getLoginInfo.departs || [];
      const complete = departmentIds.every(id => cached.some(row => String(row.id) === id && (row.departName || row.title)));
      try {
        const departments = complete ? cached : await defHttp.get(
          { url: '/sys/sysDepart/queryTreeList', params: { ids: departmentIds.join(',') } },
          { errorMessageMode: 'none' }
        );
        if (!cancelled && Array.isArray(departments)) allowed.value = canViewProjectQuotation(departmentIds, departments);
      } catch {
        // 无法确认所属部门时不挂载报价组件，不请求报价数据。
      }
    },
    { immediate: true }
  );
  return allowed;
}
