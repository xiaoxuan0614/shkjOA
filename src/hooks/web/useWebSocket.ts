// noinspection JSUnusedGlobalSymbols

import { useWebSocket, WebSocketResult } from '@vueuse/core';
import { getToken } from '/@/utils/auth';

let result: WebSocketResult<any>;
const listeners = new Map();

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
  if (!token) return;
  result = useWebSocket(url, {
    // 自动重连 (遇到错误最多重复连接10次)
    autoReconnect: {
      retries : 10,
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
      if (getToken() === token) onConnected?.();
    },
    onDisconnected: function () {
      console.debug('[WebSocket] 连接断开');
    },
    onError: function () {
      console.debug('[WebSocket] 连接发生错误');
    },
    onMessage: function (_ws, e) {
      if (getToken() !== token) return;
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
