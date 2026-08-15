import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

/**
 * 计划方案管理模块路由
 * 项目列表 + 方案详情(项目信息/实施计划/用料计划/位置信息/回款计划)
 */
const plan: AppRouteModule = {
  path: '/plan',
  name: 'Plan',
  component: LAYOUT,
  redirect: '/plan/list',
  meta: { orderNo: 21, icon: 'ion:document-text-outline', title: '计划方案管理', ignoreAuth: false },
  children: [
    {
      path: 'list',
      name: 'PlanList',
      component: () => import('/@/views/plan/index.vue'),
      meta: { title: '计划方案管理' },
    },
    {
      path: 'detail/:id',
      name: 'PlanDetail',
      component: () => import('/@/views/plan/detail/index.vue'),
      meta: {
        hideMenu: true,
        title: '方案详情',
        currentActiveMenu: '/plan/list',
      },
    },
  ],
};

export default plan;
