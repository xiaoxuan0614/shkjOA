import type { PaginationProps } from 'ant-design-vue';

/** Presentation only; callers retain page state, page size and event handlers. */
export function withPagination<T extends Partial<PaginationProps>>(config: T): T & { size: 'small' };
export function withPagination(config: false): false;
export function withPagination(config: Partial<PaginationProps> | false): (Partial<PaginationProps> & { size: 'small' }) | false;
export function withPagination(config: Partial<PaginationProps> | false) {
  return config === false ? false : { ...config, size: 'small' as const };
}
