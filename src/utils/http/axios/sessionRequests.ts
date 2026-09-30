import { CanceledError } from 'axios';

let generation = 0;
let exiting = false;
const pending = new Map<any, () => void>();
const endListeners = new Set<() => void>();
export function onSessionEnd(callback: () => void) {
  endListeners.add(callback);
  return () => { endListeners.delete(callback); };
}
export const isSessionExiting = () => exiting;

export function invalidateSessionRequests(leaving: boolean) {
  generation++;
  exiting = leaving;
  for (const cancel of pending.values()) cancel();
  pending.clear();
  if (leaving) endListeners.forEach((callback) => callback());
}

// Exact public authentication routes only; never whitelist all /sys requests.
function publicRequest(config: any) {
  const path = new URL(config.url || '', 'http://local').pathname;
  return config.requestOptions?.withToken === false || /\/sys\/(login|phoneLogin|sms)$/.test(path)
    || /\/sys\/randomImage\/[^/]+$/.test(path)
    || /\/sys\/user\/(register|checkOnlyUser|phoneVerification|passwordChange)$/.test(path);
}
export const logoutRequest = (config: any) => /\/sys\/logout$/.test(new URL(config?.url || '', 'http://local').pathname);

export function stampSessionRequest(config: any) {
  config.__sessionGeneration = generation;
}

export function guardSessionRequest(config: any, token: unknown) {
  if (publicRequest(config) || logoutRequest(config)) return;
  if (config.__sessionGeneration === undefined) stampSessionRequest(config);
  if (exiting || !token || config.__sessionGeneration !== generation) throw new CanceledError('请求所属会话已结束', config);
  const controller = new AbortController();
  const previous = config.signal;
  const abort = () => controller.abort();
  if (previous?.aborted) abort();
  else previous?.addEventListener('abort', abort, { once: true });
  config.signal = controller.signal;
  config.__sessionCleanup = () => previous?.removeEventListener('abort', abort);
  pending.set(config, abort);
}

export function finishSessionRequest(config: any) {
  if (!config) return;
  pending.delete(config);
  config.__sessionCleanup?.();
  if (!publicRequest(config) && !logoutRequest(config)
    && (exiting || config.__sessionGeneration !== generation)) throw new CanceledError('请求所属会话已结束', config);
}
