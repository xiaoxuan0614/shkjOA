import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

/**
 * 回款管理模块路由
 * 合同列表 + 合同详情(回款记录) + 编辑合同(弹窗)
 */
const payment: AppRouteModule = {
  path: '/payment',
  name: 'Payment',
  component: LAYOUT,
  redirect: '/payment/list',
  meta: { orderNo: 32, icon: 'ion:wallet-outline', title: '回款管理', ignoreAuth: false },
  children: [
    {
      path: 'list',
      name: 'PaymentList',
      component: () => import('/@/views/payment/index.vue'),
      meta: { title: '回款管理' },
    },
    {
      path: 'detail/:id',
      name: 'PaymentDetail',
      component: () => import('/@/views/payment/detail/index.vue'),
      meta: {
        hideMenu: true,
        title: '回款记录',
        currentActiveMenu: '/payment/list',
      },
    },
  ],
};

export default payment;
