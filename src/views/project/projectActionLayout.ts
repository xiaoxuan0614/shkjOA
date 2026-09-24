import type { ActionItem } from '/@/components/Table';

/** 仅项目列表使用：按实际可见操作计数，不改变回调、禁用和二次确认。 */
export function projectActionLayout(items: ActionItem[], hasPermission: (code?: string | string[]) => boolean) {
  const visible = items.filter((item) => {
    if (!hasPermission(item.auth)) return false;
    return typeof item.ifShow === 'function' ? item.ifShow(item) : item.ifShow !== false;
  });
  return visible.length > 3
    ? { actions: visible.slice(0, 2), dropDownActions: visible.slice(2) }
    : { actions: visible, dropDownActions: [] };
}
