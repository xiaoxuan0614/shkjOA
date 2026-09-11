import { FormSchema } from '/@/components/Table';
import { MATERIAL_USAGE_TYPE } from '../material.constants';

/**
 * 还料申请 - 申请信息表单
 * 字段对齐 StockApply（项目还料固定 usageType=PROJECT，并以 periodId 关联项目分期）
 * 还料人/部门默认当前操作人(页面 initUserInfo 注入)
 */
export const returnFormSchema: FormSchema[] = [
  {
    label: '选择类型',
    field: 'usageType',
    component: 'Select',
    defaultValue: MATERIAL_USAGE_TYPE.PROJECT,
    componentProps: {
      options: [{ label: '项目', value: MATERIAL_USAGE_TYPE.PROJECT }],
      allowClear: false,
      disabled: true,
    },
    dynamicRules: () => [{ required: true, message: '请选择还料类型!' }],
  },
  {
    label: '选择项目',
    field: 'periodId',
    component: 'Select',
    componentProps: {
      showSearch: true,
      allowClear: true,
      filterOption: false,
      placeholder: '请选择当前参与的项目，可按名称、编号或 ID 搜索',
      options: [],
    },
    dynamicRules: () => [{ required: true, message: '请选择参与项目!' }],
  },
  {
    label: '项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '选择分期项目后自动带出', disabled: true },
    dynamicRules: () => [{ required: true, message: '请选择项目带出项目名称!' }],
  },
  {
    label: '还料人',
    field: 'applyUserName',
    component: 'Input',
    componentProps: { disabled: true },
    // 还料人自动取当前用户(页面 initUserInfo 注入)；项目还料提交时由后端按当前用户派生 returnUser。
  },
  {
    label: '部门',
    field: 'deptName',
    component: 'Input',
    componentProps: { disabled: true },
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 2 },
  },
];
