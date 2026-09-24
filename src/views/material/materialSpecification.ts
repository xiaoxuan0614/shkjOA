/** 列表仅显示摘要，完整参数在点击物料名称后的基本信息弹窗展示。 */
export function renderMaterialSpecification(value: unknown) {
  const fullText = String(value ?? '');
  if (!fullText.trim()) return '—';
  const characters = Array.from(fullText.trim());
  const preview = characters.slice(0, 10).join('') + (characters.length > 10 ? '...' : '');
  return preview;
}
