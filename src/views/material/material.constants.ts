export const MATERIAL_USAGE_TYPE = {
  PROJECT: 'PROJECT',
  MAINTENANCE: 'MAINTENANCE',
  LABOR_PROTECTION: 'LABOR_PROTECTION',
} as const;

export const materialUsageTypeOptions = [
  { label: '项目用料', value: MATERIAL_USAGE_TYPE.PROJECT },
  { label: '维修用料', value: MATERIAL_USAGE_TYPE.MAINTENANCE },
  { label: '劳保用品领取', value: MATERIAL_USAGE_TYPE.LABOR_PROTECTION },
];

export const getMaterialUsageTypeText = (value?: string) => materialUsageTypeOptions.find((item) => item.value === value)?.label || value || '—';
