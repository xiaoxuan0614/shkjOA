/** 合同多文件字段按英文逗号拆分，预览始终使用单个原始上传路径。 */
export function expandContractAttachments(records: Recordable[]): Recordable[] {
  return records.flatMap((record) => {
    const paths = String(record?.fileId || record?.url || '')
      .split(',')
      .map((path) => path.trim())
      .filter(Boolean);
    const names = String(record?.fileName || '').split(',');
    return paths.map((fileId, index) => ({
      ...record,
      fileId,
      fileName: (names.length === paths.length ? names[index].trim() : '') || fileId.split('/').pop() || '合同附件',
    }));
  });
}
