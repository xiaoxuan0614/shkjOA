import { h } from 'vue';
import { FormSchema } from '/@/components/Table';
import { MATERIAL_USAGE_TYPE, materialUsageTypeOptions } from '../material.constants';

/**
 * 领料申请 - 申请信息表单
 * 项目选择以 periodId 关联 StockApply
 * 使用人/部门默认当前操作人(页面注入)
 */
export const pickFormSchema: FormSchema[] = [
  {
    label: '维修单号',
    field: 'repairOrderNo',
    component: 'Input',
    componentProps: { placeholder: '请输入维修单号', maxlength: 100 },
    ifShow: ({ values }) => values.usageType === MATERIAL_USAGE_TYPE.MAINTENANCE,
    dynamicRules: ({ values }) =>
      values.usageType === MATERIAL_USAGE_TYPE.MAINTENANCE ? [{ required: true, whitespace: true, message: '请输入维修单号' }] : [],
  },
  {
    label: '用料类型',
    field: 'usageType',
    component: 'Select',
    defaultValue: MATERIAL_USAGE_TYPE.PROJECT,
    componentProps: {
      options: materialUsageTypeOptions,
      placeholder: '请选择用料类型',
      allowClear: false,
    },
    dynamicRules: () => [{ required: true, message: '请选择用料类型!' }],
  },
  {
    label: '项目名称',
    field: 'periodId',
    component: 'Select',
    componentProps: {
      showSearch: true,
      allowClear: true,
      optionLabelProp: 'label',
      filterOption: (input: string, option: any) =>
        [option.projectName, option.periodName].some((name) =>
          String(name || '')
            .toLowerCase()
            .includes(input.trim().toLowerCase())
        ),
      placeholder: '输入主项目名称/分期项目名称搜索',
      notFoundContent: '暂无符合条件的参与项目',
      options: [],
    },
    renderComponentContent: () => ({
      option: ({ projectName, periodName }: any) =>
        h('div', { style: { display: 'flex', gap: '12px', justifyContent: 'space-between', whiteSpace: 'normal' } }, [
          h('span', {}, projectName || '未命名项目'),
          h('span', { style: { color: '#8c8c8c' } }, periodName || '未命名分期'),
        ]),
    }),
    ifShow: ({ values }) => values.usageType === MATERIAL_USAGE_TYPE.PROJECT,
    dynamicRules: ({ values }) => (values.usageType === MATERIAL_USAGE_TYPE.PROJECT ? [{ required: true, message: '请选择项目分期!' }] : []),
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
