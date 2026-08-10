import { resultSuccess, resultError, getRequestToken, requestParams, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import { createFakeUserList } from './user';
import { PageEnum } from '/@/enums/pageEnum';

// 仪表盘路由
const dashboardRoute = {
  path: '/dashboard',
  name: 'Dashboard',
  component: 'LAYOUT',
  redirect: PageEnum.BASE_HOME,
  meta: {
    title: 'routes.dashboard.dashboard',
    hideChildrenInMenu: true,
    icon: 'bx:bx-home',
  },
  children: [
    {
      path: 'analysis',
      name: 'Analysis',
      component: '/dashboard/Analysis/index',
      meta: {
        hideMenu: true,
        hideBreadcrumb: true,
        title: 'routes.dashboard.analysis',
        currentActiveMenu: '/dashboard',
        icon: 'bx:bx-home',
      },
    },
    {
      path: 'workbench',
      name: 'Workbench',
      component: '/dashboard/workbench/index',
      meta: {
        title: 'routes.dashboard.workbench',
        currentActiveMenu: '/dashboard',
        icon: 'bx:bx-home',
      },
    },
  ],
};

/// ========== 新增材料管理父路由 ==========
const materialRoute = {
  path: '/material',                  // 一级路由访问路径：/material
  name: 'Material',                   // 路由name标识，必须唯一
  component: 'LAYOUT',                // 使用框架自带布局容器（包含侧边栏、头部面包屑）
  redirect: '/material/list',         // 访问父路由时，自动重定向跳转到子页面 /material/list
  meta: {
    title: '物料管理',                 // 侧边栏父菜单显示文字（这里直接写中文，不走i18n国际化）
    icon: 'bx:bx-box',                // 父菜单图标，来自boxicons图标库
  },
  children: [                         // 子路由数组
    {
      path: 'list',           // 子路由路径，完整url：/material/list
      name: 'MaterialList',           // 子路由name，全局唯一
      component: 'material/index',    // 页面组件路径，对应 src/views/material/index.vue
      meta: {
        // hideMenu: true,            // 开启=true：该子页面不在侧边栏渲染菜单；注释掉则显示子菜单项
        title: '物料管理',             // 该子页面菜单/浏览器标签标题
        // currentActiveMenu: '/material', // 父路由已经是/material，不需要手动指定高亮菜单
        icon: 'bx:bx-list',           // 子菜单图标
      },
    },
    {
      path: 'apply',          // 子路由路径，完整url：/material/apply
      name: 'MaterialApply',          // 子路由name，全局唯一
      component: 'material/apply/MaterialApply',  // 页面组件路径，对应 src/views/material/apply/MaterialApply.vue
      meta: {
        hideMenu: true,               // 不显示在侧边栏，通过列表页按钮跳转进入
        title: '物料申请',             // 浏览器标签标题
        currentActiveMenu: '/material', // 高亮父菜单
      },
    },
  ],
};

/// ========== 新增项目管理父路由 ==========
const projectRoute = {
  path: '/project',
  name: 'Project',
  component: 'LAYOUT',
  redirect: '/project/list',
  meta: {
    title: '项目管理',
    icon: 'bx:bx-folder',
  },
  children: [
    {
      path: 'list',
      name: 'ProjectList',
      component: 'project/index',
      meta: {
        title: '项目管理',
        icon: 'bx:bx-folder',
      },
    },
    {
      path: 'apply',
      name: 'ProjectApply',
      component: 'project/apply/ProjectApply',
      meta: {
        hideMenu: true,
        title: '新增项目',
        currentActiveMenu: '/project',
      },
    },
    {
      path: 'plan',
      name: 'ProjectPlan',
      component: 'project/plan/ProjectPlan',
      meta: {
        hideMenu: true,
        title: '新增计划方案',
        currentActiveMenu: '/project',
      },
    },
  ],
};

const backRoute = {
  path: 'back',
  name: 'PermissionBackDemo',
  meta: {
    title: 'routes.demo.permission.back',
  },
  children: [
    {
      path: 'page',
      name: 'BackAuthPage',
      component: '/demo/permission/back/index',
      meta: {
        title: 'routes.demo.permission.backPage',
      },
    },
    {
      path: 'btn',
      name: 'BackAuthBtn',
      component: '/demo/permission/back/Btn',
      meta: {
        title: 'routes.demo.permission.backBtn',
      },
    },
  ],
};

const authRoute = {
  path: '/permission',
  name: 'Permission',
  component: 'LAYOUT',
  redirect: '/permission/front/page',
  meta: {
    icon: 'carbon:user-role',
    title: 'routes.demo.permission.permission',
  },
  children: [backRoute],
};

const levelRoute = {
  path: '/level',
  name: 'Level',
  component: 'LAYOUT',
  redirect: '/level/menu1/menu1-1',
  meta: {
    icon: 'carbon:user-role',
    title: 'routes.demo.level.level',
  },
  children: [
    {
      path: 'menu1',
      name: 'Menu1Demo',
      meta: {
        title: 'Menu1',
      },
      children: [
        {
          path: 'menu1-1',
          name: 'Menu11Demo',
          meta: {
            title: 'Menu1-1',
          },
          children: [
            {
              path: 'menu1-1-1',
              name: 'Menu111Demo',
              component: '/demo/level/Menu111',
              meta: {
                title: 'Menu111',
              },
            },
          ],
        },
        {
          path: 'menu1-2',
          name: 'Menu12Demo',
          component: '/demo/level/Menu12',
          meta: {
            title: 'Menu1-2',
          },
        },
      ],
    },
    {
      path: 'menu2',
      name: 'Menu2Demo',
      component: '/demo/level/Menu2',
      meta: {
        title: 'Menu2',
      },
    },
  ],
};

const sysRoute = {
  path: '/system',
  name: 'System',
  component: 'LAYOUT',
  redirect: '/system/account',
  meta: {
    icon: 'ion:settings-outline',
    title: 'routes.demo.system.moduleName',
  },
  children: [
    {
      path: 'account',
      name: 'AccountManagement',
      meta: {
        title: 'routes.demo.system.account',
        ignoreKeepAlive: true,
      },
      component: '/demo/system/account/index',
    },
    {
      path: 'account_detail/:id',
      name: 'AccountDetail',
      meta: {
        hideMenu: true,
        title: 'routes.demo.system.account_detail',
        ignoreKeepAlive: true,
        showMenu: false,
        currentActiveMenu: '/system/account',
      },
      component: '/demo/system/account/AccountDetail',
    },
    {
      path: 'role',
      name: 'RoleManagement',
      meta: {
        title: 'routes.demo.system.role',
        ignoreKeepAlive: true,
      },
      component: '/demo/system/role/index',
    },
    {
      path: 'menu',
      name: 'MenuManagement',
      meta: {
        title: 'routes.demo.system.menu',
        ignoreKeepAlive: true,
      },
      component: '/demo/system/menu/index',
    },
    {
      path: 'dept',
      name: 'DeptManagement',
      meta: {
        title: 'routes.demo.system.dept',
        ignoreKeepAlive: true,
      },
      component: '/demo/system/dept/index',
    },
    {
      path: 'changePassword',
      name: 'ChangePassword',
      meta: {
        title: 'routes.demo.system.password',
        ignoreKeepAlive: true,
      },
      component: '/demo/system/password/index',
    },
  ],
};

const linkRoute = {
  path: '/link',
  name: 'Link',
  component: 'LAYOUT',
  meta: {
    icon: 'ion:tv-outline',
    title: 'routes.demo.iframe.frame',
  },
  children: [
    {
      path: 'doc',
      name: 'Doc',
      meta: {
        title: 'routes.demo.iframe.doc',
        frameSrc: 'https://vvbin.cn/doc-next/',
      },
    },
    {
      path: 'https://vvbin.cn/doc-next/',
      name: 'DocExternal',
      component: 'LAYOUT',
      meta: {
        title: 'routes.demo.iframe.docExternal',
      },
    },
  ],
};

export default [
  {
    url: `${sysUrl}/sys/permission/getUserPermissionByToken`,
    timeout: 1000,
    method: 'get',
    response: (request: any) => {
      const token = getRequestToken(request);
      const id = '1';
      let menu: Object[];
      switch (id) {
        case '1':
          dashboardRoute.redirect = dashboardRoute.path + '/' + dashboardRoute.children[0].path;
          // ✅这里加入 materialRoute、projectRoute
          menu = [dashboardRoute, materialRoute, projectRoute, authRoute, levelRoute, sysRoute, linkRoute];
          break;
        case '2':
          dashboardRoute.redirect = dashboardRoute.path + '/' + dashboardRoute.children[1].path;
          // ✅角色2也加上材料菜单
          menu = [dashboardRoute, materialRoute, authRoute, levelRoute, linkRoute];
          break;
        default:
          menu = [];
      }

      return resultSuccess({
        menu: menu,
        codeList: ['1000', '3000', '5000'],
      });
    },
  },
] as MockMethod[];