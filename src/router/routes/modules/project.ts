import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

const project: AppRouteModule = {
  path: '/project',
  name: 'Project',
  component: LAYOUT,
  redirect: '/project/list',
  meta: {
    orderNo: 30,
    icon: 'ion:folder-open-outline',
    title: '项目管理',
    ignoreAuth: false,
  },
  children: [
    {
      path: 'list',
      name: 'ProjectList',
      component: () => import('/@/views/project/index.vue'),
      meta: {
        title: '项目管理',
      },
    },
    {
      path: 'detail/:id',
      name: 'ProjectDetail',
      component: () => import('/@/views/project/detail/index.vue'),
      meta: {
        hideMenu: true,
        title: '项目详情',
        currentActiveMenu: '/project/list',
      },
    },
    {
      path: 'apply',
      name: 'ProjectApply',
      component: () => import('/@/views/project/apply/ProjectApply.vue'),
      meta: {
        title: '新增项目',
      },
    },
    {
      path: 'plan',
      name: 'ProjectPlan',
      component: () => import('/@/views/project/plan/ProjectPlan.vue'),
      meta: {
        title: '新增计划方案',
      },
    },
  ],
};

export default project;
