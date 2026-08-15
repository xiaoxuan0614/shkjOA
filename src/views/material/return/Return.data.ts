import { FormSchema } from '/@/components/Table';

/**
 * 还料申请 - 申请信息表单
 * 字段对齐 StockApply（扩展：projectNo/projectName/bizType/returnUser）
 * 使用人/部门默认当前操作人(页面注入)
 */
export const returnFormSchema: FormSchema[] = [
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
  },
  {
    label: '部门',
    field: 'deptName',
    component: 'Input',
    componentProps: { disabled: true },
  },
  {
    label: '还料人',
    field: 'returnUser',
    component: 'Input',
    componentProps: { placeholder: '请输入还料人' },
    dynamicRules: () => [{ required: true, message: '请输入还料人!' }],
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 2 },
  },
];

/**
 * 可还料列表 mock（按项目；正式对接还料列表接口 /stock/apply/returnList 后替换）
 * canReturn = 可还数量(后端算)，returnQty = 本次还料数量(前端不可超 canReturn，后端兜底)
 */
export const returnListMock: Recordable = {
  XM20260001: [
    { materialId: '1', materialName: '水泥', materialCategory: '材料类', brand: '海螺', model: 'P.O42.5', unitName: '吨', canReturn: 5, returnQty: 5 },
    { materialId: '2', materialName: '螺纹钢筋', materialCategory: '材料类', brand: '沙钢', model: 'HRB400E', unitName: '吨', canReturn: 3, returnQty: 3 },
  ],
  XM20260002: [
    { materialId: '3', materialName: '六角螺栓', materialCategory: '其他配件', brand: '晋亿', model: 'M8*30', unitName: '个', canReturn: 200, returnQty: 200 },
  ],
  XM20260003: [],
};
