import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

/**
 * 实施管理模块路由
 * 工序列表 + 查看日志 + 日志详情
 */
const implement: AppRouteModule = {
  path: '/implement',
  name: 'Implement',
  component: LAYOUT,
  redirect: '/implement/list',
  meta: { orderNo: 31, icon: 'ion:hammer-outline', title: '实施管理', ignoreAuth: false },
  children: [
    {
      path: 'list',
      name: 'ImplementList',
      component: () => import('/@/views/implement/index.vue'),
      meta: { title: '实施管理' },
    },
    {
      path: 'log/:id',
      name: 'ImplementLog',
      component: () => import('/@/views/implement/log/index.vue'),
      meta: {
        hideMenu: true,
        title: '查看日志',
        currentActiveMenu: '/implement/list',
      },
    },
    {
      path: 'log/:id/detail/:logId',
      name: 'ImplementLogDetail',
      component: () => import('/@/views/implement/detail/index.vue'),
      meta: {
        hideMenu: true,
        title: '日志详情',
        currentActiveMenu: '/implement/list',
      },
    },
  ],
};

export default implement;
