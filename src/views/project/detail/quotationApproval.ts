import { quotationDetailCapabilities } from '/@/views/plan/quotationGovernance';

export function canApprovePeriodQuotation(stage: unknown, periodId: string, candidate: any, access: any, hasPermission: (code: string) => boolean) {
  return stage === 'NOT_STARTED' && !!periodId && !!candidate?.id
    && String(candidate.periodId) === periodId && candidate.version != null
    && quotationDetailCapabilities(candidate, access, {}, hasPermission).approve;
}

export function canPricePeriodQuotation(stage: unknown, periodId: string, candidate: any, access: any, hasPermission: (code: string) => boolean) {
  return stage === 'NOT_STARTED' && !!periodId && !!candidate?.id
    && String(candidate.periodId) === periodId && candidate.version != null
    && candidate.approvalRoute !== 'MARKET' && String(candidate.priced) === '0'
    && quotationDetailCapabilities(candidate, access, {}, hasPermission).price;
}
