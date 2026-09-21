export const SESSION_DRAFT_PREFIX = 'oa:form-draft:v1:';
export function clearSessionDrafts() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(SESSION_DRAFT_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch { /* 禁用存储不阻断退出。 */ }
}
