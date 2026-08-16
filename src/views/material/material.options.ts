import { defHttp } from '/@/utils/http/axios';

/**
 * 弹窗/抽屉「下拉数据首页预加载」缓存。
 *
 * 规则：主页面 onMounted 时预热第 1 页(pageSize=10)，弹窗/抽屉打开时读缓存直接展示，
 *      避免「打开弹窗才请求、每次打开重复请求」；输入模糊查询/翻页由组件自行服务端调用。
 * 失败返回空数组(不阻塞页面)，已加载成功后缓存(同页不重复请求)。
 */

let supplierPage1: Promise<{ label: string; value: string; id: string }[]> | null = null;
/** 供应商下拉首页预加载：/project/supplier/list 第 1 页 10 条 */
export function ensureSupplierOptions() {
  if (!supplierPage1) {
    supplierPage1 = defHttp
      .get({ url: '/project/supplier/list', params: { pageNo: 1, pageSize: 10 } })
      .then((res: any) => {
        const list = res?.records || (Array.isArray(res) ? res : []);
        return list.map((s: any) => ({ label: s.supplierName, value: s.supplierName, id: s.id }));
      })
      .catch(() => []);
  }
  return supplierPage1;
}

let periodPage1: Promise<any[]> | null = null;
/** 项目分期原始记录第 1 页预加载：/project/period/searchByName (keyword='' 第 1 页 10 条) */
export function ensurePeriodRecords() {
  if (!periodPage1) {
    periodPage1 = defHttp
      .get({ url: '/project/period/searchByName', params: { keyword: '', pageNo: 1, pageSize: 10 } })
      .then((res: any) => res?.records || (Array.isArray(res) ? res : []))
      .catch(() => []);
  }
  return periodPage1;
}
/** 采购订单分期下拉选项(预载首页映射，value=periodId/periodNo) */
export function ensurePeriodOptions() {
  return ensurePeriodRecords().then((list) =>
    list.map((r: any) => ({
      label: r.periodName,
      value: r.periodId || r.periodNo,
      projectId: r.projectId,
      projectName: r.projectName,
      periodName: r.periodName,
    }))
  );
}
/** 领料/还料页「分期项目」下拉选项映射(value=分期编号 periodNo，选择后带出主项目名称) */
export function mapPeriodNoOptions(list: any[]) {
  return (list || []).map((r: any) => ({
    label: r.periodName,
    value: r.periodNo, // 分期编号
    projectName: r.projectName, // 主项目名称(选择后带出显示)
    periodNo: r.periodNo,
  }));
}
