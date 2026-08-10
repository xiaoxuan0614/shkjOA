import { FormSchema } from '/@/components/Table';

/**
 * 物料申请 - 申请信息表单
 */
export const applyFormSchema: FormSchema[] = [
  {
    label: '申请类型',
    field: 'applyType',
    component: 'Select',
    componentProps: {
      options: [
        { label: '项目用料', value: 'project' },
        { label: '设备领用', value: 'device' },
        { label: '耗材领用', value: 'consumable' },
      ],
      placeholder: '请选择申请类型',
    },
    dynamicRules: () => {
      return [{ required: true, message: '请选择申请类型!' }];
    },
  },
  {
    label: '关联单号',
    field: 'applyNo',
    component: 'Input',
    componentProps: {
      placeholder: '请输入关联单号',
    },
  },
  {
    label: '使用时间',
    field: 'useTime',
    component: 'DatePicker',
    componentProps: {
      showTime: true,
      valueFormat: 'YYYY-MM-DD HH:mm:ss',
      placeholder: '请选择使用时间',
    },
    dynamicRules: () => {
      return [{ required: true, message: '请选择使用时间!' }];
    },
  },
  {
    label: '备注',
    field: 'remark',
    component: 'Input',
    componentProps: {
      placeholder: '请输入备注',
    },
  },
];

