import type { AppRouteModule } from '/@/router/types';
import { LAYOUT } from '/@/router/constant';

// 静态模式入口；BACK 模式需要正式菜单返回对应组件，不替代后端授权。
const workflow: AppRouteModule = {
  path: '/workflow',
  name: 'Workflow',
  component: LAYOUT,
  redirect: '/workflow/models',
  meta: { title: '审批中心', icon: 'ant-design:apartment-outlined', orderNo: 80 },
  children: [
    {
      path: 'models',
      name: 'WorkflowModels',
      component: () => import('/@/views/workflow/index.vue'),
      meta: { title: '审批流程配置', ignoreKeepAlive: true },
    },
    {
      path: 'applications',
      name: 'WorkflowApplications',
      component: () => import('/@/views/workflow/applications.vue'),
      meta: { title: '通用审批申请', ignoreKeepAlive: true },
    },
  ],
};
export default workflow;
