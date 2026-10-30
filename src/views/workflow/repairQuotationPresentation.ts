import Big from 'big.js';
import { snapshotValue } from './snapshotPresentation';

export function repairQuotationPresentation(visible: Record<string, unknown>, permissions: Record<string, string> = {}) {
  const allowed = (path: string) => !Object.entries(permissions).some(([key, value]) => {
    const normalized = key.replace(/\[\]/g, '');
    return value === 'HIDDEN' && (path === normalized || path.startsWith(`${normalized}.`));
  });
  const read = (path: string): any => {
    if (!allowed(path)) return undefined;
    if (Object.prototype.hasOwnProperty.call(visible, path)) return snapshotValue(visible[path]);
    const parts = path.split('.');
    let value: any = visible;
    for (let length = parts.length - 1; length > 0; length--) {
      const prefix = parts.slice(0, length).join('.');
      if (Object.prototype.hasOwnProperty.call(visible, prefix)) { value = snapshotValue(visible[prefix]); parts.splice(0, length); break; }
    }
    for (const part of parts) value = snapshotValue(value)?.[part];
    return snapshotValue(value);
  };
  const first = (paths: string[]) => paths.map(read).find(value => value !== undefined && value !== null && value !== '');
  const info = [
    { label: '故障范围', paths: ['form.scope.faultScope'] },
  ].filter(row => row.paths.some(allowed)).map(row => ({ label: row.label, value: first(row.paths) ?? '—' }));
  const columns = [
    { title: '报价项目', dataIndex: 'itemName' }, { title: '数量', dataIndex: 'quantity' },
    { title: '单价（元）', dataIndex: 'unitPrice' }, { title: '金额（元）', dataIndex: 'lineAmount' },
  ].filter(column => allowed(`form.items.${column.dataIndex}`));
  const source = read('form.items');
  const completePrice = ['quantity', 'unitPrice', 'lineAmount'].every(key => allowed(`form.items.${key}`));
  let total = new Big(0), complete = Array.isArray(source) && source.length > 0 && completePrice;
  const items = (Array.isArray(source) ? source : []).map((item, index) => {
    const row: Record<string, unknown> = { key: index };
    for (const column of columns) row[column.dataIndex] = item?.[column.dataIndex] ?? '—';
    if (completePrice) {
      try {
        if (item?.quantity == null || item?.unitPrice == null || new Big(item.quantity).lte(0) || new Big(item.unitPrice).lt(0)) throw Error();
        const amount = new Big(item.quantity).times(item.unitPrice).round(2, Big.roundHalfUp);
        row.unitPrice = new Big(item.unitPrice).toFixed(2); row.lineAmount = amount.toFixed(2); total = total.plus(amount);
      } catch { complete = false; row.lineAmount = '—'; }
    }
    return row;
  });
  return { info, columns, items, total: complete ? total.toFixed(2) : undefined, showItems: allowed('form.items') };
}
