import { FilterXSS } from 'xss';

const htmlFilter = new FilterXSS({ stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'] });

/** Sanitize at the final HTML rendering boundary, after Markdown/emoji conversion. */
export function sanitizeHtml(value: unknown): string {
  return htmlFilter.process(typeof value === 'string' ? value : '');
}

/** Trust only the configured API path; never forward authentication to attachment hosts. */
export function trustedFileUrl(source: string, pageUrl: string, bases: string[]) {
  const url = new URL(source, pageUrl);
  if (url.username || url.password || !['https:', 'http:', 'blob:'].includes(url.protocol)) {
    throw new Error('文件地址无效');
  }
  const trusted = url.protocol !== 'blob:' && bases.filter(Boolean).some((base) => {
    const allowed = new URL(base, pageUrl);
    const prefix = allowed.pathname.replace(/\/$/, '');
    return url.origin === allowed.origin && (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
  });
  return { url: url.href, trusted };
}
