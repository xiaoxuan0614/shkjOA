// In-memory only: never persist tokens or dictionary results across sessions.
let scope = '';
let generation = 0;
const results = new Map<string, { value: any[]; expires: number }>();
const pending = new Map<string, Promise<any[]>>();

export function clearDictRequestCache() {
  generation++;
  results.clear();
  pending.clear();
}

export function cachedDictRequest(session: string, code: string, fetcher: () => Promise<any[]>): Promise<any[]> {
  if (session !== scope) {
    clearDictRequestCache();
    scope = session;
  }
  const hit = results.get(code);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
  const running = pending.get(code);
  if (running) return running;
  const started = generation;
  const request = Promise.resolve().then(fetcher).then((value) => {
    if (!Array.isArray(value)) throw new Error('字典数据格式异常');
    if (started === generation) {
      // Empty dictionaries are cached too, but can recover more quickly after maintenance.
      results.set(code, { value, expires: Date.now() + (value.length ? 300000 : 30000) });
    }
    return value;
  }).finally(() => {
    if (pending.get(code) === request) pending.delete(code);
  });
  pending.set(code, request);
  return request;
}
