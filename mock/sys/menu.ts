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
      component: 'material/goods/index',  // 页面组件路径，对应 src/views/material/goods/index.vue(物料基本维护)
      meta: {
        // hideMenu: true,            // 开启=true：该子页面不在侧边栏渲染菜单；注释掉则显示子菜单项
        title: '物料基本维护',          // 该子页面菜单/浏览器标签标题
        // currentActiveMenu: '/material', // 父路由已经是/material，不需要手动指定高亮菜单
        icon: 'bx:bx-list',           // 子菜单图标
      },
    },
    {
      path: 'stock',          // 子路由路径，完整url：/material/stock
      name: 'MaterialStock',          // 子路由name，全局唯一
      component: 'material/stock/index',  // 页面组件路径，对应 src/views/material/stock/index.vue(库存数量+盘存)
      meta: {
        // hideMenu: true,            // 开启=true：该子页面不在侧边栏渲染菜单；注释掉则显示子菜单项
        title: '库存管理',             // 该子页面菜单/浏览器标签标题
        // currentActiveMenu: '/material', // 父路由已经是/material，不需要手动指定高亮菜单
        icon: 'bx:bx-cube',           // 子菜单图标
      },
    },
    {
      path: 'record',         // 子路由路径，完整url：/material/record
      name: 'MaterialRecord',         // 子路由name，全局唯一
      component: 'material/record/index',  // 页面组件路径，对应 src/views/material/record/index.vue(库管审批/出入库/台账)
      meta: {
        // hideMenu: true,            // 开启=true：该子页面不在侧边栏渲染菜单；注释掉则显示子菜单项
        title: '出入库管理',           // 该子页面菜单/浏览器标签标题
        // currentActiveMenu: '/material', // 父路由已经是/material，不需要手动指定高亮菜单
        icon: 'bx:bx-book-open',      // 子菜单图标
      },
    },
    {
      path: 'pick',           // 子路由路径，完整url：/material/pick
      name: 'MaterialPick',           // 子路由name，全局唯一
      component: 'material/pick/index',  // 页面组件路径，对应 src/views/material/pick/index.vue(领料申请)
      meta: {
        hideMenu: true,               // 不显示在侧边栏，由「出入库管理」页按钮进入
        title: '领料申请',             // 浏览器标签标题
        currentActiveMenu: '/material/record', // 高亮「出入库管理」
        icon: 'bx:bx-log-out',        // 子菜单图标
      },
    },
    {
      path: 'return',         // 子路由路径，完整url：/material/return
      name: 'MaterialReturn',         // 子路由name，全局唯一
      component: 'material/return/index',  // 页面组件路径，对应 src/views/material/return/index.vue(还料申请)
      meta: {
        hideMenu: true,               // 不显示在侧边栏，由「出入库管理」页按钮进入
        title: '还料申请',             // 浏览器标签标题
        currentActiveMenu: '/material/record', // 高亮「出入库管理」
        icon: 'bx:bx-log-in',         // 子菜单图标
      },
    },
    {
      path: 'purchase',       // 子路由路径，完整url：/material/purchase
      name: 'MaterialPurchase',       // 子路由name，全局唯一
      component: 'material/purchase/index',  // 页面组件路径，对应 src/views/material/purchase/index.vue(采购入库)
      meta: {
        // hideMenu: true,            // 开启=true：该子页面不在侧边栏渲染菜单；注释掉则显示子菜单项
        title: '采购入库',             // 该子页面菜单/浏览器标签标题
        icon: 'bx:bx-cart-add',       // 子菜单图标
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
      path: 'detail/:id',
      name: 'ProjectDetail',
      component: 'project/detail/index',
      meta: {
        hideMenu: true,
        title: '项目详情',
        currentActiveMenu: '/project/list',
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

/// ========== 新增资源管理父路由(车辆管理 / 往来客户) ==========
const resourceRoute = {
  path: '/resource',
  name: 'Resource',
  component: 'LAYOUT',
  redirect: '/resource/vehicle',
  meta: {
    title: '资源管理',
    icon: 'bx:bx-folder',
  },
  children: [
    {
      path: 'vehicle',
      name: 'ResourceVehicle',
      component: 'resource/vehicle/index',
      meta: {
        title: '车辆管理',
        icon: 'bx:bx-box',
      },
    },
    {
      path: 'vehicle/detail/:id',
      name: 'ResourceVehicleDetail',
      component: 'resource/vehicle/detail/index',
      meta: {
        hideMenu: true,
        title: '车辆详情',
        currentActiveMenu: '/resource/vehicle',
      },
    },
    {
      path: 'customer',
      name: 'ResourceCustomer',
      component: 'resource/customer/index',
      meta: {
        title: '往来客户',
        icon: 'bx:bx-group',
      },
    },
    {
      path: 'supplier',
      name: 'ResourceSupplier',
      component: 'resource/supplier/index',
      meta: {
        title: '供应商管理',
        icon: 'bx:bx-store',
      },
    },
  ],
};

/// ========== 已实现模块的 mock 菜单(计划方案管理/实施管理/回款管理) ==========
function buildBusinessRoutes() {
  // 计划方案管理: 列表 + 方案详情(hidden)
  const planRoute = {
    path: '/plan',
    name: 'Plan',
    component: 'LAYOUT',
    redirect: '/plan/list',
    meta: { title: '计划方案管理', icon: 'bx:bx-file' },
    children: [
      { path: 'list', name: 'PlanList', component: 'plan/index', meta: { title: '计划方案管理' } },
      {
        path: 'detail/:id',
        name: 'PlanDetail',
        component: 'plan/detail/index',
        meta: { hideMenu: true, title: '方案详情', currentActiveMenu: '/plan/list' },
      },
    ],
  };
  // 实施管理: 工序列表 + 查看日志 + 日志详情(hidden)
  const implementRoute = {
    path: '/implement',
    name: 'Implement',
    component: 'LAYOUT',
    redirect: '/implement/list',
    meta: { title: '实施管理', icon: 'bx:bx-wrench' },
    children: [
      { path: 'list', name: 'ImplementList', component: 'implement/index', meta: { title: '实施管理' } },
      {
        path: 'log/:id',
        name: 'ImplementLog',
        component: 'implement/log/index',
        meta: { hideMenu: true, title: '查看日志', currentActiveMenu: '/implement/list' },
      },
      {
        path: 'log/:id/detail/:logId',
        name: 'ImplementLogDetail',
        component: 'implement/detail/index',
        meta: { hideMenu: true, title: '日志详情', currentActiveMenu: '/implement/list' },
      },
    ],
  };
  // 回款管理: 合同列表 + 合同详情(hidden)
  const paymentRoute = {
    path: '/payment',
    name: 'Payment',
    component: 'LAYOUT',
    redirect: '/payment/list',
    meta: { title: '回款管理', icon: 'bx:bx-money' },
    children: [
      { path: 'list', name: 'PaymentList', component: 'payment/index', meta: { title: '回款管理' } },
      {
        path: 'detail/:id',
        name: 'PaymentDetail',
        component: 'payment/detail/index',
        meta: { hideMenu: true, title: '回款记录', currentActiveMenu: '/payment/list' },
      },
    ],
  };
  return [planRoute, implementRoute, paymentRoute];
}

/// ========== 设计稿其余一级菜单(占位) ==========
function buildPlaceholderRoutes() {
  const defs = [
    { path: '/file', name: 'File', title: '文件管理', icon: 'bx:bx-folder', redirect: '/file/list', child: 'file/list', childName: 'FileList' },
    { path: '/report', name: 'Report', title: '数据报表', icon: 'bx:bx-bar-chart', redirect: '/report/list', child: 'report/list', childName: 'ReportList' },
    { path: '/operation', name: 'Operation', title: '运维管理', icon: 'bx:bx-cog', redirect: '/operation/list', child: 'operation/list', childName: 'OperationList' },
  ];
  return defs.map((d) => ({
    path: d.path,
    name: d.name,
    component: 'LAYOUT',
    redirect: d.redirect,
    meta: { title: d.title, icon: d.icon },
    children: [
      {
        path: 'list',
        name: d.childName,
        component: 'placeholder/index',
        meta: { title: d.title },
      },
    ],
  }));
}

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
          // ✅这里加入 materialRoute、projectRoute、resourceRoute、已实现模块及设计稿其余占位菜单
          menu = [
            dashboardRoute,
            materialRoute,
            projectRoute,
            resourceRoute,
            ...buildBusinessRoutes(),
            ...buildPlaceholderRoutes(),
            authRoute,
            levelRoute,
            sysRoute,
            linkRoute,
          ];
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
        // 按钮权限码：页面 v-auth / 操作栏 auth 依据此列表放行
        codeList: [
          '1000',
          '3000',
          '5000',
          'mtl:materiallist:add',
          'mtl:materiallist:edit',
          'mtl:materiallist:delete',
          'mtl:materiallist:deleteBatch',
          'mtl:materiallist:exportXls',
          'mtl:materiallist:importExcel',
          // 物料管理(goods)按钮权限
          'mtl:goods:add',
          'mtl:goods:edit',
          'mtl:goods:delete',
          'mtl:goods:deleteBatch',
          'mtl:goods:io',
          // 项目管理(project)生命周期流转按钮权限(角色顺序权限)
          'project:plan',
          'project:implement',
          'project:internalAccept',
          'project:accept',
          'project:warranty',
        ],
      });
    },
  },
] as MockMethod[];