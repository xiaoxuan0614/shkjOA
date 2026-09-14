/** 验收报告沿用 JUpload 的逗号分隔路径约定，单文件历史值无需迁移。 */
export const ACCEPTANCE_REPORT_LIMIT = 3;
export const ACCEPTANCE_REPORT_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.doc,.docx,.xls,.xlsx';
const extensions = new Set(ACCEPTANCE_REPORT_ACCEPT.split(',').map((extension) => extension.slice(1)));

export function acceptanceFilePaths(value?: string): string[] {
  return [
    ...new Set(
      String(value || '')
        .split(',')
        .map((path) => path.trim())
        .filter(Boolean)
    ),
  ];
}

export function isAcceptanceReportFile(file: { name?: string }): boolean {
  return extensions.has(
    String(file.name || '')
      .split('.')
      .pop()
      ?.toLowerCase() || ''
  );
}
