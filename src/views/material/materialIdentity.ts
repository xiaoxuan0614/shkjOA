import { loadDictMap } from './material.util';

// 同一批单元格只加载一次品牌字典，不逐行查询物料详情。
let brandRequest: ReturnType<typeof loadDictMap> | undefined;
export function loadMaterialBrandNames() {
  if (!brandRequest) brandRequest = loadDictMap('material_brand');
  return brandRequest;
}

export function materialIdentity(
  record: Record<string, any>, source: 'master' | 'detail' = 'detail', nameField = 'materialName',
  brands: Record<string, { text: string }> = {},
) {
  const rawBrand = String(record.brand ?? '').trim();
  const name = String(record[nameField] || '未命名物料').trim();
  const brand = String(record.brand_dictText || brands[rawBrand]?.text || rawBrand).trim();
  return {
    name,
    brand: brand && (name.endsWith(`（${brand}）`) || name.endsWith(`(${brand})`)) ? '' : brand,
    // 单据行的 id 不是物料 id，绝不能作为详情查询的回退。
    materialId: String((source === 'master' ? record.materialId || record.id : record.materialId) || ''),
  };
}
