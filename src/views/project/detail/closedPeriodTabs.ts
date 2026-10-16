import type { DetailTabKey } from './detailTabs';
import { getPlan, getMembers, getPositions, getFiles, getAcceptance, getMaterialAccounts } from './ProjectDetail.api';
import { getPlanProcessDetail } from '../plan/Plan.api';

/** 仅关闭项目读取已有资料；单项失败不伪装成空数据，调用方提供重试提示。 */
export async function readClosedPeriodTabs(periodId: string) {
  const params = { periodId, pageNo: 1, pageSize: 1 };
  const probes: [DetailTabKey, () => Promise<any>][] = [
    ['plan', () => getPlan(params, true)],
    ['member', () => getMembers(params)],
    ['position', () => getPositions(params)],
    ['file', () => getFiles(params)],
    ['acceptance', () => getAcceptance(params)],
    ['material', () => getMaterialAccounts(params)],
    ['plan', () => getPlanProcessDetail({ periodId })],
  ];
  const tabs = new Set<DetailTabKey>();
  let failed = false;
  // 限制并发，避免进入已关闭项目时瞬间放大请求。
  for (let offset = 0; offset < probes.length; offset += 3) {
    await Promise.all(probes.slice(offset, offset + 3).map(async ([key, read]) => {
      try {
        const result = await read();
        const rows = Array.isArray(result) ? result : result?.records;
        if (!Array.isArray(rows)) throw new Error('历史资料响应格式异常');
        if (rows.some(row => row.periodId && String(row.periodId) !== periodId)) throw new Error('历史资料分期不匹配');
        if (rows.length) tabs.add(key);
        if (key === 'plan' && rows.some(row => ['IN_PROGRESS', 'COMPLETED'].includes(row.status))) tabs.add('implement');
      } catch { failed = true; }
    }));
  }
  // 成员/位置/工序等本身也是计划资料；不据此开放验收、施工等未发生阶段。
  if (tabs.has('member') || tabs.has('position')) tabs.add('plan');
  return { tabs: [...tabs], failed };
}
