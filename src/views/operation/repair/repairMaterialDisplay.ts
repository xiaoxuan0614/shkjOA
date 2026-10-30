import type { Row } from './repair.api';
export const materialKey = (row: Row) => JSON.stringify([row.materialId, row.baseUnitId]);
export function quantity(value: unknown) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? String(Number(value)) : '—';
}
export function materialInfo(row: Row, links: Row[]) {
  // Resolve the exact source first; never mix historical units for the same material.
  const source = links.find(link => row.pickLinkId && link.id === row.pickLinkId);
  const matches = links.filter(link => link.materialId === row.materialId && link.baseUnitId === row.baseUnitId);
  const link = source || (matches.length === 1 ? matches[0] : undefined);
  let snapshot = link?.material || row.material;
  if (typeof snapshot === 'string') { try { snapshot = JSON.parse(snapshot); } catch { snapshot = {}; } }
  return {
    name: row.materialName || link?.materialName || snapshot?.materialName || '未提供物料名称',
    code: row.materialCode || snapshot?.materialCode || '',
    model: row.model || link?.model || snapshot?.model || '',
    unit: row.baseUnitName || link?.baseUnitName || snapshot?.baseUnitName || '—',
  };
}
export const materialStates: Record<string, string> = { PICK: '领料', RETURN: '还料', DRAFT: '草稿', PENDING_CONFIRM: '待确认', CONFIRMED: '已确认', VOIDED: '已作废', DAMAGE: '损坏', LOSS: '遗失' };
