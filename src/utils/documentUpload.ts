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

/** 公共附件上传：biz 可选，成功后返回可供业务接口保存的路径。 */
export async function uploadDocument(file: File, biz?: string): Promise<{ path: string; response: any }> {
  const directory = String(biz || '').trim();
  const response = await uploadFile({ file, ...(directory ? { data: { biz: directory } } : {}) }, undefined);
  return { path: getUploadedDocumentPath(response), response };
}

/** 已有项目的附件按分期归档；新增项目请使用 uploadDocument(file, 'project')。 */
export async function uploadProjectDocument(file: File, periodId?: string): Promise<{ path: string; response: any }> {
  const biz = String(periodId || '').trim();
  if (!biz) throw new Error('缺少项目分期 ID，无法上传文件');
  return uploadDocument(file, biz);
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
