import type { AppRouteRecordRaw } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

// 说明：出入库申请明细已回归「抽屉」形式（material/components/ApplyDetailDrawer.vue），
// 不再需要独立详情页路由。如需新增隐藏路由，在此追加。
export const staticRoutesList: AppRouteRecordRaw[] = [
  {
    path: '/account',
    name: 'PersonalAccountLayout',
    component: LAYOUT,
    redirect: '/system/usersetting',
    meta: { title: '账户管理', hideMenu: true },
    children: [
      {
        path: '/system/usersetting',
        name: 'PersonalAccountSetting',
        component: () => import('/@/views/system/usersetting/UserSetting.vue'),
        meta: { title: '账户管理', hideMenu: true },
      },
    ],
  },
];
