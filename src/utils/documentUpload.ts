import { uploadFile } from '/@/api/common/api';
import { validateDocumentFile } from './documentUploadPolicy';
export { DOCUMENT_UPLOAD_ACCEPT, DOCUMENT_UPLOAD_HINT, isAllowedDocumentFile, validateDocumentFile } from './documentUploadPolicy';

/** 业务附件统一允许的文档类型。 */

/** 公共附件上传：biz 可选，成功后返回可供业务接口保存的路径。 */
export async function uploadDocument(file: File, biz?: string, allowImages = false): Promise<{ path: string; response: any }> {
  // 此函数也被项目/验收的图片附件复用；只有明确的图片扩展名保留原入口。
  if (!(allowImages && /\.(jpe?g|png|gif|bmp|webp|svg|tiff?|heic|heif)$/i.test(file.name))) await validateDocumentFile(file);
  const directory = String(biz || '').trim();
  const response = await uploadFile({ file, ...(directory ? { data: { biz: directory } } : {}) }, undefined);
  return { path: getUploadedDocumentPath(response), response };
}

/** 已有项目的附件按分期归档；新增项目请使用 uploadDocument(file, 'project')。 */
export async function uploadProjectDocument(file: File, periodId?: string, allowImages = false): Promise<{ path: string; response: any }> {
  const biz = String(periodId || '').trim();
  if (!biz) throw new Error('缺少项目分期 ID，无法上传文件');
  return uploadDocument(file, biz, allowImages);
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
