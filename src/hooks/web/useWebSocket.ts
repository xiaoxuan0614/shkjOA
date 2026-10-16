// noinspection JSUnusedGlobalSymbols

import { useWebSocket, WebSocketResult } from '@vueuse/core';
import { getToken } from '/@/utils/auth';
import { isSessionExiting } from '/@/utils/http/axios/sessionRequests';

let result: WebSocketResult<any>;
const listeners = new Map();
let activeUrl = '';
let activeToken = '';
let generation = 0;
let connectedCallback: (() => void) | undefined;

/** domainUrl 已包含后端上下文路径（/shouhuiApi），不要重复拼接。 */
export function notificationWebSocketUrl(domainUrl: string, userId: string | number) {
  const base = domainUrl.replace(/\/+$/, '').replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  return `${base}/websocket/${encodeURIComponent(String(userId))}`;
}

/**
 * 开启 WebSocket 链接，全局只需执行一次
 * @param url
 */
export function connectWebSocket(url: string, onConnected?: () => void) {
  // 代码逻辑说明: v2.4.6 的 websocket 服务端，存在性能和安全问题。 #3278
  const token = (getToken() || '') as string;
  if (!token || isSessionExiting()) {
    result?.close();
    return;
  }
  if (result && activeUrl === url && activeToken === token) {
    if (onConnected) connectedCallback = onConnected;
    return result;
  }
  result?.close();
  activeUrl = url;
  activeToken = token;
  connectedCallback = onConnected;
  const current = ++generation;
  const isCurrent = () => current === generation && getToken() === token && !isSessionExiting();
  result = useWebSocket(url, {
    // 当前会话断线自动重连；退出、连接替换或身份不匹配后停止。
    autoReconnect: {
      retries: () => isCurrent(),
      delay : 5000
    },
    // 心跳检测
    heartbeat: {
      message: "ping",
      interval: 55000
    },
    protocols: [token],
    // 代码逻辑说明: [issues/6662] 演示系统socket总断，换一个写法
    onConnected: function () {
      if (isCurrent()) connectedCallback?.();
    },
    onDisconnected: function (_ws, event) {
      // 身份校验失败不能无限重试；重新登录后再建立新连接。
      if (current === generation && event.code === 1008) result?.close();
      console.debug('[WebSocket] 连接断开');
    },
    onError: function () {
      console.debug('[WebSocket] 连接发生错误');
    },
    onMessage: function (_ws, e) {
      if (!isCurrent()) return;
      try {
        // 代码逻辑说明: 【issues/1161】前端websocket因心跳导致监听不起作用---
        if (e.data === 'ping' || e.data === 'pong') {
          return;
        }
        const data = JSON.parse(e.data);
        if (!data || typeof data !== 'object' || Array.isArray(data)) return;
        for (const callback of listeners.keys()) {
          try {
            callback(data);
          } catch (err) {
            console.error(err);
          }
        }
      } catch {
        console.debug('[WebSocket] 忽略非 JSON 消息');
      }
    },
  });
  const close = result.close;
  result.close = (...args) => {
    if (current === generation) {
      generation++;
      activeUrl = '';
      activeToken = '';
      connectedCallback = undefined;
    }
    close(...args);
  };
  return result;
}

/**
 * 添加 WebSocket 消息监听
 * @param callback
 */
export function onWebSocket(callback: (data: object) => any) {
  if (!listeners.has(callback)) {
    if (typeof callback === 'function') {
      listeners.set(callback, null);
    } else {
      console.debug('[WebSocket] 添加 WebSocket 消息监听失败：传入的参数不是一个方法');
    }
  }
}

/**
 * 解除 WebSocket 消息监听
 *
 * @param callback
 */
export function offWebSocket(callback: (data: object) => any) {
  listeners.delete(callback);
}

export function useMyWebSocket() {
  return result;
}
