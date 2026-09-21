/** 两端一致：到货款以已保存的回款节点为准，不以金额或回款周期是否非零判断。 */
export function findArrivalPayment(records: unknown) {
  if (!Array.isArray(records)) return undefined;
  return records.find((item) => ['2', '到货款'].includes(String(item?.paymentNode ?? item?.node ?? '').trim()));
}

/** 项目类型使用字典显示值，避免假定后台字典编码。 */
export function isPhysicalProject(record: { projectType?: unknown }, typeNames: Record<string, string>) {
  const value = String(record.projectType ?? '').trim();
  return ['硬件', '软硬一体'].includes(typeNames[value] || value);
}

export function isSoftwareProject(record: { projectType?: unknown }, typeNames: Record<string, string>) {
  const value = String(record.projectType ?? '').trim();
  return (typeNames[value] || value) === '软件';
}

export function isArrivalStage(record: { status?: unknown; arrivalStatus?: unknown }) {
  return (
    Number(record.arrivalStatus) !== 1 &&
    ['IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED'].includes(
      String(record.status ?? '')
        .trim()
        .toUpperCase()
    )
  );
}
