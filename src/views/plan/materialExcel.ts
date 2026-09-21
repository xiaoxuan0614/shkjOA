import ExcelJS from 'exceljs';
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
  const rows: Recordable[] = record.records;
  if (!rows.length) throw new Error('报价没有可导出的明细');
  rows.forEach((row) => decimalPrice(row.finalPrice, '每项物料的终价'));
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('物料清单');
  worksheet.columns = [
    { header: '物料编码', key: 'materialCode', width: 20 },
    { header: '物料类别', key: 'materialCategory', width: 18 },
    { header: '物料名称', key: 'materialName', width: 24 },
    { header: '品牌', key: 'brand', width: 18 },
    { header: '型号', key: 'model', width: 20 },
    { header: '数量', key: 'quantity', width: 14 },
    { header: '单位', key: 'unit', width: 14 },
    { header: '终价（单价）', key: 'finalPrice', width: 18 },
  ];
  rows.forEach((item) => {
    worksheet.addRow({
      materialCode: item.materialCode || '',
      materialCategory: item.materialCategory || '',
      materialName: item.materialName || '',
      brand: item.brand || '',
      model: item.model || '',
      quantity: Number(item.quantity ?? item.plannedQty) || '',
      unit: item.unit || '',
      finalPrice: Number(item.finalPrice),
    });
  });
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1677FF' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.height = 24;
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: 'A1', to: 'H1' };
  worksheet.getColumn('finalPrice').numFmt = '0.00';
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: 'middle' };
  });

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
