const indexKey = 'oa:tab-draft-owners:v1';
type Lease = { open: boolean; key: string; path: string; cleanup?: () => void };
const leases = new Set<Lease>();
const cleanups = new Map<string, () => void>();
function readOwners(): Record<string, string> {
  try {
    const value = JSON.parse(sessionStorage.getItem(indexKey) || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch { return {}; }
}
function writeOwners(owners: Record<string, string>) {
  try { sessionStorage.setItem(indexKey, JSON.stringify(owners)); } catch { /* Storage may be disabled. */ }
}
function remove(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* Closing a tab must still work. */ }
}

/** Ownership survives refresh; a revoked lease can never write after tab close. */
export function bindTabDraft(path: string, key: string, cleanup?: () => void) {
  const owners = readOwners();
  // Discard legacy orphan drafts once, not when an existing open tab remounts.
  if (owners[key] !== path) remove(key);
  owners[key] = path;
  writeOwners(owners);
  const lease: Lease = { path, key, open: true, cleanup };
  if (cleanup) cleanups.set(key, cleanup);
  leases.add(lease);
  return { isOpen: () => lease.open, release: () => { lease.open = false; leases.delete(lease); } };
}

export function closeTabDrafts(paths: string[]) {
  const targets = new Set(paths.map(path => path.split('?')[0].split('#')[0]));
  const owners = readOwners();
  for (const [key, path] of Object.entries(owners)) {
    if (targets.has(path)) {
      remove(key);
      cleanups.get(key)?.();
      cleanups.delete(key);
      delete owners[key];
    }
  }
  for (const lease of leases) {
    if (!targets.has(lease.path)) continue;
    lease.open = false;
    remove(lease.key);
    cleanups.get(lease.key)?.();
    cleanups.delete(lease.key);
    leases.delete(lease);
  }
  writeOwners(owners);
}

export function clearTabDrafts() {
  closeTabDrafts([...Object.values(readOwners()), ...[...leases].map(lease => lease.path)]);
  remove(indexKey);
}
