import { h } from 'vue';
import MaterialIdentityCell from './components/MaterialIdentityCell.vue';

/** 仅转换物料展示列，不改数据、业务渲染、权限或提交字段。 */
export function unifyMaterialColumns<T extends Record<string, any>>(
  columns: T[], options: { source?: 'master' | 'detail'; nameField?: string } = {},
): T[] {
  const identityKeys = new Set(['material', 'materialIdentity', 'materialName', 'materialCode', 'brand', options.nameField || 'materialName']);
  const remaining = columns.filter((column) => !identityKeys.has(String(column.key || column.dataIndex || '')));
  const identity = {
    title: '物料', key: 'unifiedMaterial', width: 220, fixed: 'left', align: 'left',
    customRender: ({ record }: { record: Record<string, any> }) => h(MaterialIdentityCell, { record, ...options }),
  };
  return [identity as unknown as T, ...remaining.map((column) =>
    ['action', 'remove'].includes(String(column.key || column.dataIndex || '')) ? { ...column, fixed: 'right' } : column,
  )];
}
