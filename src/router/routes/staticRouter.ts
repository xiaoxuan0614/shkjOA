import type { AppRouteRecordRaw } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

export const quotationDetailFallback: AppRouteRecordRaw = {
  path: '/quotation-detail-layout',
  name: 'QuotationDetailFallbackLayout',
  component: LAYOUT,
  meta: { title: '报价详情', hideMenu: true },
  children: [{
    path: '/plan/material-draft/editor',
    name: 'ContractMaterialDraftEditor',
    component: () => import('/@/views/plan/material-draft/editor.vue'),
    meta: { title: '报价详情', hideMenu: true, ignoreKeepAlive: true, currentActiveMenu: '/plan/material-draft' },
  }],
};

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
