const prefix = 'oa:project-create-draft:';
const attachments = new Map<string, File>();

export function projectCreateDraftKey(userId: string, tenantId: string, mode: string, parentId: string) {
  return prefix + JSON.stringify([userId, tenantId, mode, parentId]);
}
export function saveProjectCreateDraft(key: string, values: Record<string, unknown>, file?: File) {
  if (file) attachments.set(key, file);
  else attachments.delete(key);
  sessionStorage.setItem(key, JSON.stringify({ values, attachmentName: file?.name || '' }));
}
export function readProjectCreateDraft(key: string) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return undefined;
    const draft = JSON.parse(raw);
    if (!draft?.values || typeof draft.values !== 'object' || Array.isArray(draft.values)) return undefined;
    return { ...draft, file: attachments.get(key) };
  } catch { return undefined; }
}
export function removeProjectCreateDraft(key: string) {
  attachments.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* 浏览器存储可能被禁用。 */ }
}
export function clearProjectCreateDrafts() {
  attachments.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch { /* 不影响登录/退出。 */ }
}
