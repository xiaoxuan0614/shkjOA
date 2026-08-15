import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

/**
 * 资源管理模块路由(车辆管理 / 往来客户)
 * 注意: BACK 权限模式下,正式环境菜单由后端菜单表返回,本文件仅用于 mock 模式与开发兜底
 */
const resource: AppRouteModule = {
  path: '/resource',
  name: 'Resource',
  component: LAYOUT,
  redirect: '/resource/vehicle',
  meta: {
    orderNo: 40,
    icon: 'ion:cube-outline',
    title: '资源管理',
    ignoreAuth: false,
  },
  children: [
    {
      path: 'vehicle',
      name: 'ResourceVehicle',
      component: () => import('/@/views/resource/vehicle/index.vue'),
      meta: {
        title: '车辆管理',
      },
    },
    {
      path: 'vehicle/detail/:id',
      name: 'ResourceVehicleDetail',
      component: () => import('/@/views/resource/vehicle/detail/index.vue'),
      meta: {
        hideMenu: true,
        title: '车辆详情',
        currentActiveMenu: '/resource/vehicle',
      },
    },
    {
      path: 'customer',
      name: 'ResourceCustomer',
      component: () => import('/@/views/resource/customer/index.vue'),
      meta: {
        title: '往来客户',
      },
    },
    {
      path: 'supplier',
      name: 'ResourceSupplier',
      component: () => import('/@/views/resource/supplier/index.vue'),
      meta: {
        title: '供应商管理',
      },
    },
  ],
};

export default resource;
