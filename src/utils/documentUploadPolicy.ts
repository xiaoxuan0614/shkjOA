export const DOCUMENT_UPLOAD_ACCEPT = '.docx,.pdf,.xls,.xlsx';
export const DOCUMENT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_UPLOAD_HINT = '支持 DOCX、PDF、Excel（XLS/XLSX），单文件不超过 20 MB；请勿只修改文件后缀。上传后可预览，加密或损坏的文件请先另存为无密码的标准文件。';
const extensions = new Set(['docx', 'pdf', 'xls', 'xlsx']);
export const documentExtension = (name = '') => name.split('.').pop()?.toLowerCase() || '';
export function isAllowedDocumentFile(file: { name?: string } | null | undefined): boolean {
  return extensions.has(documentExtension(file?.name));
}

/** 上传前的格式/容器检查，不代替服务端校验或完整渲染。 */
export async function validateDocumentFile(file: File): Promise<void> {
  if (!isAllowedDocumentFile(file)) throw new Error('仅支持 DOCX、PDF、Excel（XLS/XLSX），请另存为支持的格式后上传');
  if (!file.size) throw new Error('文件为空，请重新选择');
  if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) throw new Error('单个文件不能超过 20 MB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = documentExtension(file.name);
  const ascii = new TextDecoder('latin1');
  const invalid = () => new Error('文件实际格式与后缀不符、已加密或内容不完整，请在 Office/WPS 中另存为标准格式后上传');
  if (ext === 'pdf') {
    if (!ascii.decode(bytes.slice(0, 1024)).includes('%PDF-') || !ascii.decode(bytes.slice(-4096)).includes('%%EOF')) throw invalid();
    if (/\/Encrypt\b/.test(ascii.decode(bytes))) throw new Error('暂不支持加密 PDF，请解除密码保护后上传');
    return;
  }
  if (ext === 'xls') {
    const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!signature.every((b, i) => bytes[i] === b)) throw invalid();
    const text = new TextDecoder('utf-16le').decode(bytes);
    if (!/(?:Workbook|Book)\u0000/.test(text) || /WordDocument\u0000|EncryptedPackage\u0000/.test(text)) throw invalid();
    return;
  }
  // 读取 ZIP 中央目录，不能仅凭 PK 文件头把普通 ZIP 当作 DOCX/XLSX。
  const view = new DataView(bytes.buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) throw invalid();
  let offset = view.getUint32(end + 16, true);
  const count = view.getUint16(end + 10, true);
  const names = new Set<string>();
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50 || (view.getUint16(offset + 8, true) & 1)) throw invalid();
    const length = view.getUint16(offset + 28, true);
    const next = offset + 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    if (next > end) throw invalid();
    const local = view.getUint32(offset + 42, true);
    if (local + 30 > view.getUint32(end + 16, true) || view.getUint32(local, true) !== 0x04034b50) throw invalid();
    expanded += view.getUint32(offset + 24, true);
    if (expanded > 100 * 1024 * 1024) throw new Error('文件解压后过大，无法安全预览，请精简文件后上传');
    names.add(new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length)));
    offset = next;
  }
  if (!names.has('[Content_Types].xml') || !names.has(ext === 'docx' ? 'word/document.xml' : 'xl/workbook.xml')) throw invalid();
}
