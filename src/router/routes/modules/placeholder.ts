import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

/**
 * 设计稿侧边栏中的其余一级菜单
 * 文件管理 / 数据报表仍为占位，运维管理已接入值班表
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
      component: () => import('/@/views/operation/duty-roster/index.vue'),
      meta: { title: '运维值班表' },
    },
    {
      path: 'reports',
      name: 'OperationReportRecords',
      component: () => import('/@/views/operation/reports/index.vue'),
      meta: { title: '报修记录', ignoreKeepAlive: true },
    },
    {
      path: 'repairs',
      name: 'OperationRepairRecords',
      component: () => import('/@/views/operation/repair/index.vue'),
      meta: { title: '维修记录', ignoreKeepAlive: true },
    },
    {
      path: 'inspection-preview',
      name: 'InspectionMockPreview',
      component: () => import('/@/views/operation/inspection/index.vue'),
      meta: { title: '巡检管理', ignoreKeepAlive: true },
    },
    {
      path: 'maintenance-preview',
      name: 'MaintenanceManagement',
      component: () => import('/@/views/operation/maintenance/index.vue'),
      meta: { title: '维保管理', ignoreKeepAlive: true },
    },
    {
      path: 'detail',
      name: 'OperationDutyRosterDetail',
      component: () => import('/@/views/operation/duty-roster/detail.vue'),
      meta: { title: '值班表详情', hideMenu: true, ignoreKeepAlive: true, currentActiveMenu: '/operation/list' },
    },
  ],
};

export default [file, report, operation];
