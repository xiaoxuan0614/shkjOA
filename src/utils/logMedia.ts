/** 日志媒体只在展示时补静态前缀，业务保存仍使用上传返回的原路径。 */
export function logMediaUrl(value: unknown, resolvePath: (path: string) => string): string {
  const source = String(value || '').trim().replace(/\\/g, '/');
  if (!source) return '';
  if (/^(https?:\/\/|\/\/|blob:|data:|file:|wxfile:)/i.test(source)) return source;
  const path = source
    .replace(/^\/+/, '')
    .replace(/^(?:shouhuiApi\/)?sys\/common\/static\//i, '')
    .replace(/^static\//i, '');
  return resolvePath(path);
}

export function isLogVideo(value: string): boolean {
  return /\.(mp4|mov|m4v|webm|ogg|ogv|avi|3gp)(?:[?#]|$)/i.test(value);
}

