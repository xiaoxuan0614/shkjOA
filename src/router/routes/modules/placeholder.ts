import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

/**
 * 设计稿侧边栏中的其余一级菜单(占位)
 * 文件管理 / 数据报表 / 运维管理
 * 说明: 计划方案管理/实施管理/回款管理 已在独立路由文件实现(plan.ts/implement.ts/payment.ts), 此处仅保留暂无设计稿的占位
 */

// 文件管理
const file: AppRouteModule = {
  path: '/file',
  name: 'File',
  component: LAYOUT,
  redirect: '/file/list',
  meta: { orderNo: 22, icon: 'ion:folder-outline', title: '文件管理', ignoreAuth: false },
  children: [
    {
      path: 'list',
      name: 'FileList',
      component: () => import('/@/views/placeholder/index.vue'),
      meta: { title: '文件管理' },
    },
  ],
};

// 数据报表
const report: AppRouteModule = {
  path: '/report',
  name: 'Report',
  component: LAYOUT,
  redirect: '/report/list',
  meta: { orderNo: 50, icon: 'ion:stats-chart-outline', title: '数据报表', ignoreAuth: false },
  children: [
    {
      path: 'list',
      name: 'ReportList',
      component: () => import('/@/views/placeholder/index.vue'),
      meta: { title: '数据报表' },
    },
  ],
};

// 运维管理
const operation: AppRouteModule = {
  path: '/operation',
  name: 'Operation',
  component: LAYOUT,
  redirect: '/operation/list',
  meta: { orderNo: 60, icon: 'ion:settings-outline', title: '运维管理', ignoreAuth: false },
  children: [
    {
      path: 'list',
      name: 'OperationList',
      component: () => import('/@/views/placeholder/index.vue'),
      meta: { title: '运维管理' },
    },
  ],
};

export default [file, report, operation];
