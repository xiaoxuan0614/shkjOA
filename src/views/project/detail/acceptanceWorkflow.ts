import { getAcceptance, getProjectReworks } from './ProjectDetail.api';
import { projectDetail } from '../Project.api';
import { readProjectMembership } from '../projectMembership';
import { hasActiveRecheck, hasBlockingRework, isCurrentFailedAcceptance } from '/@/utils/acceptanceWorkflow';

export async function readAllAcceptancePages(fetchPage: (pageNo: number) => Promise<any>) {
  const all: any[] = [];
  for (let pageNo = 1; ; pageNo++) {
    const result = await fetchPage(pageNo);
    const rows = Array.isArray(result) ? result : result?.records;
    if (!Array.isArray(rows)) throw new Error('验收或返工记录响应异常，请刷新重试');
    all.push(...rows);
    if (Array.isArray(result) || !rows.length || (result.total != null ? all.length >= Number(result.total) : rows.length < 100)) return all;
  }
}

export const readAcceptanceReworks = (periodId: string) => readAllAcceptancePages((pageNo) => getProjectReworks({ periodId, pageNo, pageSize: 100 }));

export function latestAcceptance(rows: any[], _round: string) {
  const current = [...rows];
  const sources = new Set(current.map((row) => String(row.sourceAcceptanceId || '')));
  return current.sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || ''))).find((row) => !sources.has(String(row.id)));
}

/** 点击申请/保存前复查。最终并发互斥及授权仍由后端事务保证。 */
export async function assertAcceptanceApplication(
  periodId: string,
  userId: string,
  sourceId: string,
  mode: 'recheck' | 'rework',
  excludeReworkId = ''
) {
  const [project, access, internal, customer, reworks] = await Promise.all([
    projectDetail({ periodId }),
    readProjectMembership(periodId, userId),
    readAllAcceptancePages((pageNo) => getAcceptance({ periodId, acceptType: 'INTERNAL', pageNo, pageSize: 100 })),
    readAllAcceptancePages((pageNo) => getAcceptance({ periodId, acceptType: 'CUSTOMER', pageNo, pageSize: 100 })),
    readAcceptanceReworks(periodId),
  ]);
  const round = String(project.currentReworkId || '');
  const current = [latestAcceptance(internal, round), latestAcceptance(customer, round)].filter(Boolean);
  const source = current.find((row) => String(row.id) === sourceId);
  if (!['ACCEPTING', 'REACCEPTING'].includes(project.status) || !access.manager || !isCurrentFailedAcceptance(source, current))
    throw new Error('验收状态或项目经理资格已变化，请刷新后重试');
  if (hasBlockingRework(reworks, round, excludeReworkId)) throw new Error('当前轮已有施工返工申请，请先办理返工记录');
  if (mode === 'rework' && hasActiveRecheck(current)) throw new Error('当前轮复验进行中，暂不能申请施工返工');
  if (mode === 'rework' && reworks.some((row) => String(row.id) !== excludeReworkId && String(row.sourceAcceptanceId) === sourceId))
    throw new Error('该验收已有返工申请，请在原返工单中修改或重提');
}
