export function purchaseProjectOption(row: any) {
  const projectName = String(row.projectName || '').trim();
  const periodName = String(row.periodName || '').trim();
  return {
    label: [projectName, periodName].filter(Boolean).join('-') || String(row.periodId),
    value: String(row.periodId),
    projectId: row.projectId,
    projectName,
    periodName,
  };
}

export function filterPurchaseProject(input: string, option: any) {
  return String(option?.label || '').toLowerCase().includes(input.trim().toLowerCase());
}

/** 详情只保证返回 ID；仅复用同一分期列表行的展示名称。 */
export function purchaseEditProjectOption(detail: any, record: any) {
  const samePeriod = String(detail.periodId) === String(record.periodId);
  return purchaseProjectOption({
    ...detail,
    projectName: detail.projectName || (samePeriod ? record.projectName : ''),
    periodName: detail.periodName || (samePeriod ? record.periodName : ''),
  });
}

/** 全部分页加载，不把首页或失败后的部分结果当作完整选项。 */
export async function loadPurchaseProjects(query, isCurrent = () => true) {
  const options = new Map<string, ReturnType<typeof purchaseProjectOption>>();
  let received = 0;
  for (let pageNo = 1; ; pageNo++) {
    const data = await query({ pageNo, pageSize: 100 });
    if (!isCurrent()) return [];
    if (!Array.isArray(data?.records)) throw new Error('项目列表格式异常');
    const rows = data.records;
    const previousSize = options.size;
    rows.forEach((row) => {
      if (row.periodId) options.set(String(row.periodId), purchaseProjectOption(row));
    });
    received += rows.length;
    if (!rows.length || (data.total != null && received >= Number(data.total)) ||
      (data.total == null && rows.length < 100)) return [...options.values()];
    if (options.size === previousSize) throw new Error('项目分页未前进');
  }
}
