import { h } from 'vue';
import { Modal } from 'ant-design-vue';
import { getFileAccessHttpUrl } from '/@/utils/common/compUtils';
import FilePreviewContent from '/@/components/FilePreview/FilePreviewContent.vue';

type PreviewSource =
  | string
  | File
  | {
      name?: string;
      fileName?: string;
      fileId?: string;
      url?: string;
      originFileObj?: File;
      response?: { message?: string };
    };

const PREVIEW_EXTENSIONS = new Set(['bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp', 'pdf', 'docx', 'xls', 'xlsx', 'pptx']);

function getFileName(path?: string) {
  if (!path) return '文件';
  const name = path.split(/[\\/]/).pop() || path;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function getExtension(name?: string) {
  return (name?.split('?')[0].split('#')[0].split('.').pop() || '').toLowerCase();
}

function getRemotePath(source: PreviewSource) {
  if (typeof source === 'string') return source;
  if (source instanceof File) return '';
  return source.response?.message || source.fileId || source.url || '';
}

function getRawFile(source: PreviewSource) {
  if (source instanceof File) return source;
  return typeof source === 'object' ? source.originFileObj : undefined;
}

function getDisplayName(source: PreviewSource, fallbackName?: string) {
  if (fallbackName) return fallbackName;
  if (typeof source === 'string') return getFileName(source);
  return source.name || source.fileName || getFileName(getRemotePath(source));
}

function renderPreviewModal(source: string | File, fileName: string, extension: string) {
  Modal.info({
    title: `文件预览：${fileName}`,
    icon: null,
    width: 1200,
    centered: true,
    closable: true,
    keyboard: true,
    maskClosable: true,
    okText: '关闭',
    content: h(FilePreviewContent, { source, fileName, extension }),
  });
}

/**
 * 在站内弹窗中预览文件，不创建外链或下载入口。
 * 文件内容在浏览器内读取并渲染，避免公网预览服务无法访问内网文件。
 */
export function previewFileInModal(source: PreviewSource, fallbackName?: string) {
  const rawFile = getRawFile(source);
  const remotePath = getRemotePath(source);
  const fileName = getDisplayName(source, fallbackName);
  const displayExtension = getExtension(fileName);
  const sourceExtension = getExtension(rawFile?.name || remotePath);
  const extension = PREVIEW_EXTENSIONS.has(displayExtension) ? displayExtension : sourceExtension || displayExtension;

  if (rawFile && !remotePath) {
    renderPreviewModal(rawFile, fileName, extension);
    return;
  }

  if (!remotePath) {
    Modal.warning({ title: '暂时无法预览', content: '未获取到文件地址，请刷新页面后重试。' });
    return;
  }

  const fullUrl = /^(https?:|blob:|data:)/i.test(remotePath) ? remotePath : getFileAccessHttpUrl(remotePath);
  renderPreviewModal(fullUrl, fileName, extension);
}
