/**
 * 在线表单(online)关联表列配置 Hook
 * 【online低代码设计器已移除】此Hook为JLinkTableCard组件提供最小化的列配置处理能力，
 * 兼容后端 /online/cgform/api/getColumns 返回的列结构。
 */
import { ref } from 'vue';
import { getFileAccessHttpUrl } from '/@/utils/common/compUtils';
import dayjs from 'dayjs';

/**
 * 处理列配置
 */
export function useTableColumns(onlineTableContext, extConfigJson) {
  // 表格列
  const columns = ref<any[]>([]);

  /**
   * 处理后端返回的列配置
   * @param columnResult
   */
  function handleColumnResult(columnResult) {
    if (!columnResult || !Array.isArray(columnResult)) {
      columns.value = [];
      return;
    }
    columns.value = columnResult.map((col: any) => {
      let item: any = {
        title: col.dbFieldName,
        dataIndex: col.dbFieldName,
        width: col.width || 120,
        key: col.id,
      };
      if (col.dbType) {
        item.dbType = col.dbType;
      }
      if (col.javaType) {
        item.javaType = col.javaType;
      }
      return item;
    });
  }

  // 下载文件
  function downloadRowFile(text) {
    if (text) {
      window.open(getFileAccessHttpUrl(text), '_blank');
    }
  }

  // 图片预览
  function getImgView(text) {
    return text ? getFileAccessHttpUrl(text) : '';
  }

  // 图片预览弹窗
  function viewOnlineCellImage(text) {
    if (text) {
      const url = getFileAccessHttpUrl(text);
      window.open(url, '_blank');
    }
  }

  // 省市区显示
  function getPcaText(text) {
    return text || '';
  }

  // 日期格式化
  function getFormatDate(text) {
    if (!text) {
      return '';
    }
    return dayjs(text).format('YYYY-MM-DD HH:mm:ss');
  }

  // 跳转组件配置
  const hrefComponent = ref<any>({});

  return {
    columns,
    downloadRowFile,
    getImgView,
    getPcaText,
    getFormatDate,
    handleColumnResult,
    hrefComponent,
    viewOnlineCellImage,
  };
}
