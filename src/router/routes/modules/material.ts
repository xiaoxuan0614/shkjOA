import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

const material: AppRouteModule = {
  path: '/material',
  name: 'Material',
  component: LAYOUT,
  redirect: '/material/list',
  meta: {
    orderNo: 20,
    icon: 'ion:cube-outline',
    title: '物料管理',
    // 关键！部分版本需要这个标记才会渲染侧边菜单
    ignoreAuth: false,
  },
  children: [
    {
      path: 'list',
      name: 'MaterialList',
      component: () => import('/@/views/material/goods/index.vue'),
      meta: {
        title: '物料基本维护',
      },
    },
    {
      path: 'stock',
      name: 'MaterialStock',
      component: () => import('/@/views/material/stock/index.vue'),
      meta: {
        title: '库存管理',
      },
    },
    {
      path: 'stocktake',
      name: 'MaterialStocktake',
      component: () => import('/@/views/material/stocktake/index.vue'),
      meta: {
        title: '盘存记录',
      },
    },
    {
      path: 'record',
      name: 'MaterialRecord',
      component: () => import('/@/views/material/record/index.vue'),
      meta: {
        title: '出入库管理',
      },
    },
    {
      path: 'pick',
      name: 'MaterialPick',
      component: () => import('/@/views/material/pick/index.vue'),
      meta: {
        title: '领料申请',
        hideMenu: true,
      },
    },
    {
      path: 'return',
      name: 'MaterialReturn',
      component: () => import('/@/views/material/return/index.vue'),
      meta: {
        title: '还料申请',
        hideMenu: true,
      },
    },
    {
      path: 'purchase',
      name: 'MaterialPurchase',
      component: () => import('/@/views/material/purchase/index.vue'),
      meta: {
        title: '采购入库',
      },
    },
    {
      path: 'apply',
      name: 'MaterialApply',
      component: () => import('/@/views/material/apply/MaterialApply.vue'),
      meta: {
        title: '物料申请',
        hideMenu: true,
      },
    },
  ],
};

export default material;