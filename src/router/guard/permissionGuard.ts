import type { Router, RouteRecordRaw } from 'vue-router';

import { usePermissionStoreWithOut } from '/@/store/modules/permission';

import { PageEnum } from '/@/enums/pageEnum';
import { useUserStoreWithOut } from '/@/store/modules/user';

import { PAGE_NOT_FOUND_ROUTE } from '/@/router/routes/basic';

import { RootRoute } from '/@/router/routes';

import { PAGE_NOT_FOUND_NAME_404 } from '/@/router/constant';

const LOGIN_PATH = PageEnum.BASE_LOGIN;

//分享免登录路由
const SYS_FILES_PATH = PageEnum.SYS_FILES_PATH;

// 邮件中的跳转地址,对应此路由,携带token免登录直接去办理页面
const TOKEN_LOGIN = PageEnum.TOKEN_LOGIN;

const ROOT_PATH = RootRoute.path;

// 代码逻辑说明: [VUEN-2472]分享免登录------------
const whitePathList: PageEnum[] = [LOGIN_PATH, SYS_FILES_PATH, TOKEN_LOGIN ];

export function createPermissionGuard(router: Router) {
  const userStore = useUserStoreWithOut();
  const permissionStore = usePermissionStoreWithOut();

  // 自定义首页跳转次数
  let homePathJumpCount = 0;

  router.beforeEach(async (to, from) => {
    if (
      // 【#6861】跳转到自定义首页的逻辑，只跳转一次即可
      homePathJumpCount < 1 &&
      from.path === ROOT_PATH &&
      to.path === PageEnum.BASE_HOME &&
      userStore.getUserInfo.homePath &&
      userStore.getUserInfo.homePath !== PageEnum.BASE_HOME
    ) {
      homePathJumpCount++;
      return userStore.getUserInfo.homePath;
    }

    const token = userStore.getToken;

    // Whitelist can be directly entered
    if (whitePathList.includes(to.path as PageEnum)) {
      if (to.path === LOGIN_PATH && token) {
        const isSessionTimeout = userStore.getSessionTimeout;

        //TODO vben默认写法，暂时不知目的，有问题暂时先注释掉
        //await userStore.afterLoginAction();

        try {
          if (!isSessionTimeout) {
            return (to.query?.redirect as string) || '/';
          }
        } catch {}
      }
      return true;
    }

    // token does not exist
    if (!token) {
      // You can access without permission. You need to set the routing meta.ignoreAuth to true
      if (to.meta.ignoreAuth) {
        return true;
      }

      // 代码逻辑说明: [issues/I5BG1I]vue3 Auth2未实现------------
      let path = LOGIN_PATH;
      if (whitePathList.includes(to.path as PageEnum)) {
        // 在免登录白名单，直接进入
        return true;
      }
      // redirect login page
      const redirectData: { path: string; replace: boolean; query?: Recordable<string> } = {
        path: path,
        replace: true,
      };

      // 代码逻辑说明: 【QQYUN-4713】登录代码调整逻辑有问题，改造待观察--
      if (to.fullPath) {
        let getFullPath = to.fullPath;
        if(getFullPath=='/' || getFullPath=='/500' || getFullPath=='/400' || getFullPath=='/login?redirect=/' || getFullPath=='/login?redirect=/login?redirect=/'){
          return;
        }

        redirectData.query = {
          ...redirectData.query,
          // 代码逻辑说明: 修复登录成功后，没有正确重定向的问题
          redirect: to.fullPath,

        };
      }
      return redirectData;
    }

    // Jump to the 404 page after processing the login
    if (from.path === LOGIN_PATH && to.name === PAGE_NOT_FOUND_NAME_404 && to.fullPath !== (userStore.getUserInfo.homePath || PageEnum.BASE_HOME)) {
      return userStore.getUserInfo.homePath || PageEnum.BASE_HOME;
    }

    // 代码逻辑说明: 【QQYUN-8572】表格行选择卡顿问题（customRender中字典引起的）
    if (userStore.getLastUpdateTime === 0) {
      userStore.setAllDictItemsByLocal();
    }
    if (permissionStore.getIsDynamicAddedRoute) {
      return true;
    }

    // 构建后台菜单路由
    const routes = await permissionStore.buildRoutesAction();
    routes.forEach((route) => {
      router.addRoute(route as unknown as RouteRecordRaw);
    });

    router.addRoute(PAGE_NOT_FOUND_ROUTE as unknown as RouteRecordRaw);
    permissionStore.setDynamicAddedRoute(true);
    // 代码逻辑说明: 【issues/7500】vue-router4.5.0版本路由name:PageNotFound同名导致登录进不去
    if (to.name === PAGE_NOT_FOUND_NAME_404) {
      // 动态添加路由后，此处应当重定向到fullPath，否则会加载404页面内容
      return { path: to.fullPath, replace: true, query: to.query };
    } else {
      const redirectPath = (from.query.redirect || to.path) as string;
      const redirect = decodeURIComponent(redirectPath);
      const nextData = to.path === redirect ? { ...to, replace: true } : { path: redirect };
      return nextData;
    }
  });
}
