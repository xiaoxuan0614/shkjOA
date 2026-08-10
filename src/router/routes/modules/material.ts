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
      component: () => import('/@/views/material/materialList.vue'),
      meta: {
        title: '物料列表',
      },
    },
    {
      path: 'apply',
      name: 'MaterialApply',
      component: () => import('/@/views/material/apply/MaterialApply.vue'),
      meta: {
        title: '物料申请',
      },
    },
  ],
};

export default material;