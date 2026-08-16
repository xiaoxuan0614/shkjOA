import { useUserStore } from '/@/store/modules/user';
import { initDictOptions } from '/@/utils/dict/index';
import { loadUserOptions } from '../resource/userOptions';

/**
 * 物料模块 - 当前用户信息工具
 * 依据接口文档：登录接口 /sys/login 返回 result.userInfo(含 id/departName/departIds) + result.departs[]。
 * 部门取值优先级：loginInfo.userInfo.departName → loginInfo.departs[0].departName → getUserInfo.departName
 *
 * ⚠️ 全局规定（当前操作人身份）：
 * 1. 当前用户身份在登录时已保存（auth 缓存：USER_INFO_KEY + LOGIN_INFO_KEY，本模块用 getCurrentUser() 统一读取）；
 * 2. 凡涉及审批/操作类提交，必须带当前操作人 id（字段名 approvalUserId = getCurrentUser().applyUserId）；
 * 3. 列表/详情展示用户时显示其姓名：后端回传姓名优先，缺省用 loadUserMap() 按 id 解析（/sys/user/list 全量）。
 */
export function getCurrentUser() {
  const userStore = useUserStore();
  const ui: any = userStore.getUserInfo || {};
  const loginInfo: any = userStore.getLoginInfo || {};
  const uiInfo = loginInfo.userInfo || {};
  const firstDepart = loginInfo.departs?.[0] || {};

  return {
    applyUserId: String(ui.id || ui.userId || uiInfo.id || ''),
    applyUserName: ui.realname || ui.username || uiInfo.realname || uiInfo.username || '',
    deptId: firstDepart.id || String(ui.departIds || uiInfo.departIds || '').split(',')[0] || '',
    deptName: uiInfo.departName || firstDepart.departName || ui.departName || '',
  };
}

/**
 * 加载后端数据字典（代码 → {text, color}）。
 * 数据源：后台「系统管理 → 数据字典」配置的 sys_dict；
 * 取值顺序：登录/用户信息接口返回的 sysAllDictItems（缓存）→ 实时调 /sys/dict/getDictItems/{code}。
 * 页面标签/下拉统一用这个，改后台字典（重新登录）即生效，不写死在前端。
 * @param code 字典编码（如 stock_apply_biz_type / material_category）
 */
const dictCache: Record<string, Record<string, { text: string; color: string }>> = {};
export async function loadDictMap(code: string): Promise<Record<string, { text: string; color: string }>> {
  if (dictCache[code]) return dictCache[code];
  try {
    const items: any[] = (await initDictOptions(code)) || [];
    dictCache[code] = Object.fromEntries(
      items.map((i) => [String(i.value), { text: i.text ?? i.label ?? '', color: i.color ?? '' }])
    );
  } catch (e) {
    dictCache[code] = {};
  }
  return dictCache[code];
}

/**
 * 把字典 map 转成 Select options（{ label, value }）
 */
export function dictToOptions(map: Record<string, { text: string; color: string }>): { label: string; value: string }[] {
  return Object.entries(map).map(([value, it]) => ({ label: it.text, value }));
}

let unitOptionsCache: { label: string; value: string }[] | null = null;
/**
 * 物料单位下拉选项（数据源：数据字典 inv_unit，不再前端写死）。
 * ⚠️ 单位存储/展示用单位名称(unitName/unit 存字典 text)；故下拉 label/value 均取字典 text，
 *    与后端契约一致（执行出入库时由 resolveDictUnitId 按 text 反查字典 value 上送）。
 * 改后台 inv_unit 字典 → 重新登录生效。
 */
export async function loadUnitOptions(): Promise<{ label: string; value: string }[]> {
  if (unitOptionsCache) return unitOptionsCache;
  const dict = await loadDictMap('inv_unit');
  unitOptionsCache = Object.values(dict).map((it) => ({ label: it.text, value: it.text }));
  return unitOptionsCache;
}

/**
 * 明细审批状态推算：从审批动态 approvalList 中取该明细的最新一条
 * 匹配方式：优先顶层 approval.itemId === 明细id；否则在 approval.items[] 里找 itemId === 明细id。
 * approve 三态：true 已通过 / false 已驳回 / null 待审批（无记录）。
 * 匹配不到且传入 fallbackStatus 时按整单兜底：APPROVED→通过、REJECTED→驳回
 * （整单审批时 approvalList 无明细级记录，靠整单状态兜底）。
 * @param itemId 明细ID(StockApplyItem.id)
 * @param approvalList queryById 返回的审批动态数组
 * @param fallbackStatus 整单状态(StockApply.status)
 */
export function calcItemApproval(
  itemId: string | number,
  approvalList?: any[],
  fallbackStatus?: string
): { approve: boolean | null; comment: string } {
  const list = Array.isArray(approvalList) ? approvalList : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const a: any = list[i] || {};
    // 1) 顶层 itemId 匹配
    if (a.itemId != null && String(a.itemId) === String(itemId)) {
      const approve = a.approve !== undefined ? a.approve : a.approvalResult === 'AGREE' ? true : a.approvalResult === 'REJECT' ? false : null;
      return { approve, comment: a.remark || a.approvalComment || '' };
    }
    // 2) items[] 里匹配
    const it = (Array.isArray(a.items) ? a.items : []).find((x: any) => x && String(x.itemId) === String(itemId));
    if (it) {
      return { approve: it.approve !== undefined ? it.approve : null, comment: it.remark || a.approvalComment || '' };
    }
  }
  // 3) 兜底：整单状态
  if (fallbackStatus === 'APPROVED') return { approve: true, comment: '' };
  if (fallbackStatus === 'REJECTED') return { approve: false, comment: '' };
  return { approve: null, comment: '' };
}

/**
 * 单位 ID 解析：按单位名称从数据字典 inv_unit 匹配取 value（字典里的单位ID）
 * 申请时明细只传单位名(unitName)，后端明细里的 unitId 不可靠，执行出入库统一以字典为准。
 * @param unitName 单位名称(明细 unitName)
 * @param fallbackId 匹配不到时的兜底(明细原 unitId)
 */
export async function resolveDictUnitId(
  unitName?: string,
  fallbackId?: string | number
): Promise<string | number | undefined> {
  if (!unitName) return fallbackId;
  const dict = await loadDictMap('inv_unit');
  const found = Object.entries(dict).find(([, it]) => it.text === unitName);
  return found ? found[0] : fallbackId;
}

/**
 * 用户 id → 姓名 映射（全量 /sys/user/list，模块级缓存）。
 * 列表/详情展示「审批人 / 执行人 / 申请人」姓名用：后端回传姓名优先，
 * 只回传 id 时用本映射解析（全局规定第 3 条）。
 */
let userMapCache: Record<string, string> | null = null;
export async function loadUserMap(): Promise<Record<string, string>> {
  if (userMapCache) return userMapCache;
  try {
    const opts = await loadUserOptions();
    userMapCache = Object.fromEntries(opts.map((o) => [o.value, o.label]));
  } catch (e) {
    userMapCache = {};
  }
  return userMapCache;
}

/**
 * 取用户姓名：按 id 从 userMap 缓存解析；解析不到返回兜底姓名。
 * 需先 await loadUserMap()（组件内常挂在 ref 上，模板直接取 ref[id]）
 */
export function resolveUserName(id?: string | number, fallback?: string): string {
  const name = id != null && userMapCache ? userMapCache[String(id)] : '';
  return name || fallback || '';
}

/**
 * 物料 id → 物料主表(含 materialCode/materialName/unit/stockQty/unitList...) 映射
 * （全量 /stock/material/list，模块级缓存）。
 * 台账/盘存记录等只回传 materialId 的列表，展示物料编码/名称/详情用。
 * 用法：组件内 await loadMaterialMap() 后，模板 `materialMap[record.materialId]?.materialName` 兜底。
 */
let materialMapCache: Record<string, any> | null = null;
export async function loadMaterialMap(): Promise<Record<string, any>> {
  if (materialMapCache) return materialMapCache;
  try {
    const { defHttp } = await import('/@/utils/http/axios');
    const res: any = await defHttp.get({ url: '/stock/material/list', params: { pageNo: 1, pageSize: 10000 } });
    const recs = res?.records || (Array.isArray(res) ? res : []);
    materialMapCache = Object.fromEntries((recs || []).map((m: any) => [m.id, m]));
  } catch (e) {
    materialMapCache = {};
  }
  return materialMapCache;
}

/**
 * 按物料 id 取物料信息；解析不到返回 null（需先 await loadMaterialMap()）。
 */
export function resolveMaterial(id?: string | number): any | null {
  const m = id != null && materialMapCache ? materialMapCache[String(id)] : null;
  return m || null;
}

/**
 * 台账/盘存记录富化：只回传 materialId 的列表，按物料主表缓存补 materialCode/materialName。
 * 需先 await loadMaterialMap()（本函数直接读模块级缓存，无额外请求）。
 * @param records 台账等列表记录(会就地挂 materialCode/materialName)
 */
export function enrichMaterialInfo(records?: any[]): any[] {
  (records || []).forEach((r: any) => {
    const m = r?.materialId != null ? materialMapCache?.[String(r.materialId)] : null;
    r.materialCode = m?.materialCode || r.materialCode || '';
    r.materialName = m?.materialName || r.materialName || '';
  });
  return records || [];
}
