import { FormSchema } from '/@/components/Table';

/**
 * 领料申请 - 申请信息表单
 * 字段对齐 StockApply（扩展：projectNo/projectName/bizType）
 * 使用人/部门默认当前操作人(页面注入)
 */
export const pickFormSchema: FormSchema[] = [
  {
    label: '分期项目',
    field: 'projectNo',
    component: 'Select',
    componentProps: {
      showSearch: true,
      allowClear: true,
      filterOption: false, // 远程模糊搜索
      placeholder: '输入分期项目名称模糊搜索，自动带出编号',
      options: [], // 远程加载(页面 onSearch 注入)
    },
  },
  {
    label: '项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '选择分期项目后自动带出', disabled: true },
    dynamicRules: () => [{ required: true, message: '请选择分期项目带出项目名称!' }],
  },
  {
    label: '使用人',
    field: 'applyUserName',
    component: 'Input',
    componentProps: { disabled: true },
    dynamicRules: () => [{ required: true, message: '使用人必填!' }],
  },
  {
    label: '部门',
    field: 'deptName',
    component: 'Input',
    componentProps: { disabled: true },
  },
  {
    label: '使用时间',
    field: 'useDate',
    component: 'DatePicker',
    componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择使用时间' },
    dynamicRules: () => [{ required: true, message: '请选择使用时间!' }],
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '备注（库存不足时标注「待采购」）', rows: 2 },
  },
];
