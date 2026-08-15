import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 库存管理 - 列表/搜索配置
 * 职责：展示所有在库物料的库存数量(以基准单位为准)，库管在此做手动入库/出库
 * 数据源：/stock/material/list（与物料管理同源，字段对齐 StockMaterial）
 */
export const columns: BasicColumn[] = [
  {
    title: '物料编码',
    align: 'center',
    dataIndex: 'materialCode',
    width: 160,
  },
  {
    title: '物料名称',
    align: 'center',
    dataIndex: 'materialName',
  },
  {
    title: '类别',
    align: 'center',
    dataIndex: 'materialCategory',
    width: 110,
  },
  {
    title: '基准单位',
    align: 'center',
    dataIndex: 'unit',
    width: 90,
  },
  {
    title: '库存数量',
    align: 'center',
    dataIndex: 'stockQty',
    width: 130,
    // 具体渲染在页面 bodyCell 中拼接基准单位后缀
  },
  {
    title: '安全库存',
    align: 'center',
    dataIndex: 'safetyStock',
    width: 100,
  },
  {
    title: '库存金额',
    align: 'center',
    dataIndex: 'stockAmount',
    width: 110,
  },
];

/**
 * 搜索表单
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '物料编码',
    field: 'materialCode',
    component: 'Input',
    componentProps: { placeholder: '请输入物料编码' },
  },
  {
    label: '物料名称',
    field: 'materialName',
    component: 'Input',
    componentProps: { placeholder: '请输入物料名称' },
  },
  {
    label: '类别',
    field: 'materialCategory',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'material_category', placeholder: '请选择类别' },
  },
];
