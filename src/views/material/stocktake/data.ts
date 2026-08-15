import { BasicColumn, FormSchema } from '/@/components/Table';

/**
 * 盘存记录 - 列定义 / 搜索
 *
 * 数据源：出入库台账(/stock/ioRecord/list)按 sourceType=stocktake 过滤。
 * 后端盘存接口(POST /stock/ioRecord/takeStock)按「实际库存 vs 系统实时库存」差异生成盘盈/盘亏台账：
 *   盘盈=IN 入库记录(差异>0)、盘亏=OUT 出库记录(差异<0)；beforeQty=盘点前系统库存、afterQty=盘点后实际库存。
 * 物料编码/名称由物料主表(/stock/material/list)按 materialId 富化(台账只回 materialId)。
 */

export const searchFormSchema: FormSchema[] = [
  {
    label: '盘存单号',
    field: 'sourceNo',
    component: 'Input',
    componentProps: { placeholder: '请输入盘存单号(为空自动生成)' },
  },
];

export const columns: BasicColumn[] = [
  {
    title: '盘存单号',
    align: 'center',
    dataIndex: 'sourceNo',
    width: 150,
  },
  {
    title: '物料编码',
    align: 'center',
    dataIndex: 'materialCode',
    width: 130,
  },
  {
    title: '物料名称',
    align: 'center',
    dataIndex: 'materialName',
    width: 160,
  },
  {
    title: '单位',
    align: 'center',
    dataIndex: 'unitName',
    width: 80,
  },
  {
    title: '盘点前库存',
    align: 'center',
    dataIndex: 'beforeQty',
    width: 100,
  },
  {
    title: '盘点后库存',
    align: 'center',
    dataIndex: 'afterQty',
    width: 100,
  },
  {
    title: '差异',
    align: 'center',
    dataIndex: 'diff',
    width: 100,
    helpMessage: '差异 = 盘点后库存 − 盘点前库存；正数盘盈，负数盘亏',
  },
  {
    title: '盘存时间',
    align: 'center',
    dataIndex: 'createTime',
    width: 170,
  },
  {
    title: '备注',
    align: 'center',
    dataIndex: 'remark',
  },
];
