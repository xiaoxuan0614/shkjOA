import ExcelJS from 'exceljs';
import Big from 'big.js';
import { downloadByData } from '/@/utils/file/download';
import { decimalPrice } from './quotationPricing';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const HEADER_ALIASES = {
  materialCode: ['物料编码', '编码', 'materialcode'],
  materialCategory: ['物料类别', '物料分类', 'materialcategory'],
  materialName: ['物料名称', '名称', 'materialname'],
  brand: ['品牌', 'brand'],
  model: ['型号', '规格型号', 'model'],
  plannedQty: ['计划数量', '数量', 'plannedqty', 'quantity'],
  unit: ['单位', 'unit'],
  remark: ['备注', 'remark'],
} as const;

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[\s_\-（）()]/g, '')
    .toLowerCase();
}

function getCellText(cell: ExcelJS.Cell) {
  return String(cell.text ?? cell.value ?? '').trim();
}

function safeFileName(value: unknown) {
  return String(value || '报价物料清单').replace(/[\\/:*?"<>|]/g, '_');
}

// 只接收 exportData 的受控结果，不使用普通明细接口或物料库补充价格。
export async function exportCandidateMaterials(record: Recordable) {
  if (!record?.candidateId || !Array.isArray(record.records)) throw new Error('导出数据不完整');
  if (!Array.isArray(record.serviceFees)) throw new Error('服务费导出数据不完整，请刷新后重试');
  const fees: Recordable[] = record.serviceFees;
  const rows: Recordable[] = [...record.records, ...fees.map((fee, index) => ({
    materialName: fee.name, specificationParams: fee.description, quantity: fee.quantity, unit: fee.unit,
    finalPrice: fee.guidePrice, remark: fee.remark, serialNo: index + 1,
  }))];
  if (!rows.length) throw new Error('报价没有可导出的明细');
  rows.forEach((row) => {
    decimalPrice(row.finalPrice, '每项物料的终价');
    if (!decimalPrice(row.quantity, '每项物料的数量', 4).gt(0)) throw new Error('每项物料的数量必须大于0');
  });
  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  const worksheet = workbook.addWorksheet('报价清单');
  worksheet.columns = [6, 24, 18, 24, 62, 10, 8, 16, 18, 18].map((width) => ({ width }));
  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').value = record.candidateName || '项目报价清单';
  worksheet.getRow(2).values = ['序号', '名称', '品牌', '型号', '规格参数', '数量', '单位', '单价（元）', '小计（元）', '备注'];
  let total = new Big(0);
  rows.forEach((item, index) => {
    const n = index + 3 + (fees.length && index >= record.records.length ? 1 : 0);
    if (fees.length && index === record.records.length) {
      worksheet.mergeCells(`A${n - 1}:J${n - 1}`);
      worksheet.getCell(`A${n - 1}`).value = '服务费';
      worksheet.getRow(n - 1).height = 26;
    }
    const subtotal = new Big(item.quantity).times(item.finalPrice).round(2, Big.roundHalfUp);
    total = total.plus(subtotal);
    // 仅使用受控导出字段；单位未返回时留空，不从其他接口补查。
    const row = worksheet.getRow(n);
    row.values = [item.serialNo ?? index + 1, item.materialName || null, item.brand || null, item.model || null, item.specificationParams || null,
      Number(item.quantity), item.unit || null, Number(item.finalPrice),
      { formula: `ROUND(F${n}*H${n},2)`, result: Number(subtotal) }, item.remark || null];
    const lines = Math.max(...[item.materialName, item.brand, item.model, item.specificationParams, item.remark].map((value, i) =>
      String(value || '').split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).reduce((len, char) => len + (/[^\x00-\xff]/.test(char) ? 2 : 1), 0) / [24, 18, 24, 62, 18][i])), 0)));
    row.height = Math.min(409, Math.max(30, lines * 16 + 8));
  });
  const totalRow = rows.length + 3 + (fees.length ? 1 : 0);
  worksheet.mergeCells(`A${totalRow}:H${totalRow}`);
  worksheet.getCell(`A${totalRow}`).value = '合计';
  worksheet.getCell(`I${totalRow}`).value = { formula: `SUM(I3:I${totalRow - 1})`, result: Number(total) };
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: '宋体', size: 10.5 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = Object.fromEntries(['top', 'bottom', 'left', 'right'].map((edge) => [edge, { style: 'thin', color: { argb: 'FF000000' } }]));
    });
  });
  for (let n = 3; n < totalRow; n++) {
    for (const col of [5, 10]) worksheet.getCell(n, col).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  }
  for (const n of [1, 2, totalRow]) {
    worksheet.getRow(n).height = n === 1 ? 30 : 26;
    worksheet.getRow(n).font = { name: '宋体', size: n === 1 ? 14 : 10.5, bold: true };
  }
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
  worksheet.getColumn(6).numFmt = '0.00';
  worksheet.getColumn(8).numFmt = '#,##0.00';
  worksheet.getColumn(9).numFmt = '#,##0.00';
  worksheet.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];
  worksheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: '1:2', printArea: `A1:J${totalRow}` };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadByData(buffer as BlobPart, `${safeFileName(record.candidateName)}.xlsx`, XLSX_MIME_TYPE);
}

export async function parseMaterialPlanExcel(file: File) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await file.arrayBuffer()) as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel 文件中没有可读取的工作表');

  let headerRowNumber = 0;
  const columnMap: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  const maxHeaderRows = Math.min(5, worksheet.rowCount);
  for (let rowNumber = 1; rowNumber <= maxHeaderRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.eachCell((cell, columnNumber) => {
      const normalized = normalizeHeader(getCellText(cell));
      Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
        if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
          columnMap[field as keyof typeof HEADER_ALIASES] = columnNumber;
        }
      });
    });
    if (columnMap.materialCode && columnMap.plannedQty) {
      headerRowNumber = rowNumber;
      break;
    }
  }
  if (!headerRowNumber) throw new Error('未识别到“物料编码”和“计划数量/数量”表头');

  const records: Recordable[] = [];
  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const get = (field: keyof typeof HEADER_ALIASES) => {
      const column = columnMap[field];
      return column ? getCellText(row.getCell(column)) : '';
    };
    const materialCode = get('materialCode');
    const quantityText = get('plannedQty').replace(/,/g, '');
    if (!materialCode && !quantityText) continue;
    const plannedQty = Number(quantityText);
    if (!materialCode) throw new Error(`第 ${rowNumber} 行缺少物料编码`);
    if (!(plannedQty > 0)) throw new Error(`第 ${rowNumber} 行计划数量必须大于 0`);
    records.push({
      materialCode,
      materialCategory: get('materialCategory'),
      materialName: get('materialName'),
      brand: get('brand'),
      model: get('model'),
      plannedQty,
      unit: get('unit'),
      remark: get('remark'),
      _excelRowNumber: rowNumber,
    });
  }
  if (!records.length) throw new Error('Excel 文件中没有可导入的物料数据');
  return records;
}
