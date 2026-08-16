/**
 * 全局禁用浏览器输入自动填充下拉（autocomplete="off"）。
 *
 * 背景：Chrome/Edge 会记住用户在同页填过的值，点进输入框/开始输入时弹「之前填过的值」下拉。
 * 业务要求所有输入框直接输入、不弹历史值下拉，故统一给 <input>/<textarea> 加 autocomplete="off"。
 *
 * 覆盖范围：全系统所有输入框，含弹窗/抽屉/表格内动态渲染的（用 MutationObserver 监听新节点）。
 * 跳过：
 * - 密码框(type=password)：保留浏览器密码管理器（已有的密码框配了 autocomplete="new-password"）
 * - 已显式设置 autocomplete 的元素（如 new-password），不覆盖
 *
 * 用法：main.ts 在 app.mount 后调用一次 `setupAutocompleteOff(document.body)`。
 */
export function setupAutocompleteOff(root: ParentNode = document.body): MutationObserver | null {
  if (typeof MutationObserver === 'undefined') return null;

  const setOff = (el: Element) => {
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    const input = el as HTMLInputElement;
    if (input.type === 'password') return; // 密码框保留密码管理器
    if (input.hasAttribute('autocomplete')) return; // 已显式设置的不覆盖
    input.setAttribute('autocomplete', 'off');
  };

  const scan = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    setOff(el);
    el.querySelectorAll?.('input, textarea').forEach(setOff);
  };

  // 初始已存在的输入框
  root.querySelectorAll?.('input, textarea').forEach(setOff);

  // 监听后续动态新增（弹窗/抽屉/表格渲染）
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) m.addedNodes.forEach(scan);
  });
  observer.observe(root, { childList: true, subtree: true });

  return observer;
}
