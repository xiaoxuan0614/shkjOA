import { downloadByData } from '/@/utils/file/download';
import { downloadDutyRoster } from './dutyRoster.api';

/** 只导出服务器保存版本，不重新计算当前页面的班次。 */
export async function exportDutyRosterExcel(month: string) {
  const blob = await downloadDutyRoster(month);
  downloadByData(blob, `${month}运维值班表.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
