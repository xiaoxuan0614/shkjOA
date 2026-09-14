export const MATERIAL_USAGE_TYPE = {
  PROJECT: 'PROJECT',
  MAINTENANCE: 'MAINTENANCE',
  LABOR_PROTECTION: 'LABOR_PROTECTION',
} as const;

export const materialUsageTypeOptions = [
  { label: '项目', value: MATERIAL_USAGE_TYPE.PROJECT },
  { label: '维修', value: MATERIAL_USAGE_TYPE.MAINTENANCE },
  { label: '劳保', value: MATERIAL_USAGE_TYPE.LABOR_PROTECTION },
];

export const getMaterialUsageTypeText = (value?: string) => materialUsageTypeOptions.find((item) => item.value === value)?.label || value || '—';
