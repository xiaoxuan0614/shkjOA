import { FormSchema } from '/@/components/Table';

/**
 * 物料申请(出入库申请) - 申请信息表单
 * ⚠️ 字段与正式后端接口契约(StockApply)对齐：applyType(IN/OUT)/applyNo/applyUserName/deptName/useDate/remark
 */
export const applyFormSchema: FormSchema[] = [
  {
    label: '出入库类型',
    field: 'applyType',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'stock_apply_type', placeholder: '请选择出入库类型' },
    dynamicRules: () => [{ required: true, message: '请选择出入库类型!' }],
  },
  {
    label: '申请单号',
    field: 'applyNo',
    component: 'Input',
    componentProps: { placeholder: '请输入申请单号' },
  },
  {
    label: '申请人',
    field: 'applyUserName',
    component: 'Input',
    componentProps: { placeholder: '请输入申请人' },
    dynamicRules: () => [{ required: true, message: '请输入申请人!' }],
  },
  {
    label: '部门',
    field: 'deptName',
    component: 'Input',
    componentProps: { placeholder: '请输入部门名称' },
  },
  {
    label: '使用日期',
    field: 'useDate',
    component: 'DatePicker',
    componentProps: {
      valueFormat: 'YYYY-MM-DD',
      placeholder: '请选择使用日期',
    },
    dynamicRules: () => [{ required: true, message: '请选择使用日期!' }],
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 2 },
  },
];
