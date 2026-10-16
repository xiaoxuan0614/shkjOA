import type { Router } from 'vue-router';

/** 整页加载登录页，避免路由已更新但旧应用卸载/渲染状态导致空白。 */
export async function navigateAfterLogout(router: Router, loginPath: string) {
  const target = { path: loginPath };
  // resolve兼容base/hash；replace不保留已退出的当前业务页历史项。
  window.location.replace(router.resolve(target).href);
}
