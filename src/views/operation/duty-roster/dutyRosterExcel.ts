import ExcelJS from 'exceljs';
import type { Dayjs } from 'dayjs';
import { downloadByData } from '/@/utils/file/download';
import type { DutyRosterRow, DutyRosterUserSnapshot } from './dutyRoster.store';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

function names(userIds: string[], getUser: (userId: string) => DutyRosterUserSnapshot | undefined) {
  return userIds.map((userId) => getUser(userId)?.label || userId).join(' ');
}

export async function exportDutyRosterExcel(month: Dayjs, rows: DutyRosterRow[], getUser: (userId: string) => DutyRosterUserSnapshot | undefined) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '首汇科技管理平台';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('值班表', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  worksheet.columns = [
    { key: 'date', width: 14 },
    { key: 'weekday', width: 14 },
    { key: 'dayShift', width: 30 },
    { key: 'nightShift', width: 22 },
    { key: 'phone', width: 20 },
  ];
  worksheet.mergeCells('A1:E1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `${month.year()}年${month.month() + 1}月 值班表`;
  titleCell.font = { name: '宋体', size: 18, bold: true, color: { argb: 'FF000000' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.border = BORDER;
  worksheet.getRow(1).height = 36;

  const header = worksheet.getRow(2);
  header.values = ['时间', '星期', '早班', '夜班', '联系电话'];
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { name: '宋体', size: 14, bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDER;
  });

  rows.forEach((item) => {
    const contact = item.contactUserId ? getUser(item.contactUserId) : undefined;
    const date = month.date(Number(item.date.slice(-2)));
    const row = worksheet.addRow([
      `${date.month() + 1}月${date.date()}日`,
      item.weekday,
      names(item.dayUserIds, getUser),
      names(item.nightUserIds, getUser),
      contact?.phone || '',
    ]);
    row.height = 25;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '宋体', size: 12, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = BORDER;
    });
  });

  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  worksheet.headerFooter.oddFooter = '&C第 &P 页，共 &N 页';
  const buffer = await workbook.xlsx.writeBuffer();
  downloadByData(buffer as BlobPart, `${month.year()}年${month.month() + 1}月运维值班表.xlsx`, XLSX_MIME_TYPE);
}
