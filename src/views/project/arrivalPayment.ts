/** 两端一致：到货款以已保存的回款节点为准，不以金额或回款周期是否非零判断。 */
export function findArrivalPayment(records: unknown) {
  if (!Array.isArray(records)) return undefined;
  return records.find((item) => ['2', '到货款'].includes(String(item?.paymentNode ?? item?.node ?? '').trim()));
}

export function isArrivalStage(record: { status?: unknown; arrivalStatus?: unknown }) {
  return (
    Number(record.arrivalStatus) !== 1 &&
    ['PENDING_APPROVAL', 'IMPLEMENTING', 'DEBUGGING', 'DEBUG_COMPLETED'].includes(
      String(record.status ?? '')
        .trim()
        .toUpperCase()
    )
  );
}
