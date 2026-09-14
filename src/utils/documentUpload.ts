import { uploadFile } from '/@/api/common/api';

/** 业务附件统一允许的文档类型。 */
export const DOCUMENT_UPLOAD_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';

const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

export function isAllowedDocumentFile(file: { name?: string } | null | undefined): boolean {
  const extension = String(file?.name || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  return !!extension && ALLOWED_DOCUMENT_EXTENSIONS.has(extension);
}

/**
 * 项目域文档统一上传。
 * biz 按后端约定传项目分期 ID，便于服务端按分期归档文件。
 */
export async function uploadProjectDocument(file: File, periodId?: string): Promise<{ path: string; response: any }> {
  const biz = String(periodId || '').trim();
  if (!biz) throw new Error('缺少项目分期 ID，无法上传文件');

  const response = await uploadFile({ file, data: { biz } }, undefined);
  return { path: getUploadedDocumentPath(response), response };
}

/** 校验统一上传接口响应，并固定从成功响应的 message 读取文件路径。 */
export function getUploadedDocumentPath(response: any): string {
  // 公共上传实际返回 code=0；兼容原有 code=200，仍要求明确成功，避免将错误文案当作路径。
  const code = response?.code;
  const isSuccessCode = code === 0 || code === '0' || code === 200 || code === '200';
  if (!response || response.success !== true || !isSuccessCode) {
    throw new Error(String(response?.message || '文件上传失败，请重试'));
  }
  const path = String(response?.message || '').trim();
  if (!path) throw new Error('上传接口未返回文件路径');
  return path;
}
