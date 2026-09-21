import { defineComponent, markRaw, provide } from 'vue';
import type { PropType, VNode } from 'vue';
import { routeLocationKey } from 'vue-router';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

/** KeepAlive include 使用路由名；子页面组件名称不必与菜单 componentName 一致。 */
export function createTabPage(name: string) {
  return markRaw(defineComponent({
    name,
    props: {
      page: { type: Object as PropType<VNode>, required: true },
      context: { type: Object as PropType<RouteLocationNormalizedLoaded>, required: true },
    },
    setup(props) {
      // PageLayout 按 fullPath 分实例。后台实例不能跟随其他页签的 query 触发重置。
      provide(routeLocationKey, props.context);
      return () => props.page;
    },
  }));
}
