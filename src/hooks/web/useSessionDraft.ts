import { onBeforeUnmount, onDeactivated, onActivated } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useUserStore } from '/@/store/modules/user';
import { useMessage } from '/@/hooks/web/useMessage';
import { SESSION_DRAFT_PREFIX } from '/@/utils/sessionDraftStorage';

/** 由业务页面显式选择可缓存输入，不缓存权限、审批状态或后端版本。 */
export function useSessionDraft<T>(scope: string, snapshot: () => T | undefined) {
  const user = useUserStore();
  const { createMessage } = useMessage();
  const token = user.getToken;
  const identity = () => JSON.stringify([user.getUserInfo?.id, (user.getUserInfo as any)?.loginTenantId]);
  const owner = identity();
  const key = SESSION_DRAFT_PREFIX + owner + ':' + scope;
  let ready = false, initialized = false, disposed = false, warned = false;
  const sameOwner = () => token === user.getToken && owner === identity();
  function read(): T | undefined {
    if (!sameOwner()) return;
    try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : undefined; }
    catch { return undefined; }
  }
  function persist() {
    if (!ready || !sameOwner()) return;
    try {
      const values = snapshot();
      if (values !== undefined) sessionStorage.setItem(key, JSON.stringify(values));
    } catch {
      if (!warned) createMessage.warning('会话草稿缓存不可用，请保存后再离开页面');
      warned = true;
    }
  }
  function clear() {
    ready = false;
    try { sessionStorage.removeItem(key); } catch { /* 无缓存可清理。 */ }
  }
  function enable() { if (!disposed && sameOwner()) { ready = true; initialized = true; } }
  onActivated(() => { if (initialized) enable(); });
  onBeforeRouteLeave(() => { persist(); });
  onDeactivated(persist);
  window.addEventListener('pagehide', persist);
  onBeforeUnmount(() => {
    persist(); disposed = true;
    window.removeEventListener('pagehide', persist);
  });
  return { read, persist, clear, enable, isAlive: () => !disposed && sameOwner() };
}
