import { defineComponent, h } from 'vue';
import { Pagination } from 'ant-design-vue';
import { withPagination } from './config';

/** Pass through listeners, v-model updates, slots and native props exactly once. */
export const BasicPagination = defineComponent({
  name: 'BasicPagination',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(Pagination, withPagination(attrs), slots);
  },
});

export { withPagination } from './config';
