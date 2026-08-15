import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 往来客户 - 列表列
 * ⚠️ 字段与正式后端接口契约对齐(apifox /project/customer)：customerNo/customerName/contactPerson/contactPhone
 */
export const columns: BasicColumn[] = [
  {
    title: '客户编号',
    align: 'center',
    dataIndex: 'customerNo',
    width: 120,
  },
  {
    title: '客户名称',
    align: 'center',
    dataIndex: 'customerName',
  },
  {
    title: '客户联系人',
    align: 'center',
    dataIndex: 'contactPerson',
  },
  {
    title: '客户联系电话',
    align: 'center',
    dataIndex: 'contactPhone',
  },
  {
    title: '创建日期',
    align: 'center',
    dataIndex: 'createTime',
  },
];

/**
 * 往来客户 - 列表搜索表单
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '客户名称',
    field: 'customerName',
    component: 'Input',
    componentProps: { placeholder: '请输入客户名称' },
  },
  {
    label: '客户编号',
    field: 'customerNo',
    component: 'Input',
    componentProps: { placeholder: '请输入客户编号' },
  },
  {
    label: '创建日期',
    field: 'createTime',
    component: 'RangePicker',
    componentProps: {
      valueFormat: 'YYYY-MM-DD',
      placeholder: ['开始日期', '结束日期'],
    },
  },
];

/**
 * 往来客户 - 新增/编辑弹窗表单
 * 字段与正式后端对齐(OaCustomer)：customerNo/customerName/contactPerson/contactPhone/address/customerInfo/
 *   saleUserName(销售负责人)/maintenanceUserName(维保负责人)/customerManagerName(客户经理)/
 *   invoiceTitle/taxNo/bankName/bankAccount/invoiceAddress/invoicePhone/remark
 * 编号自动生成(禁手填)；负责人走用户选择器(loadUserOptions 注入)
 */
export const formSchema: FormSchema[] = [
  {
    label: '客户名称',
    field: 'customerName',
    component: 'Input',
    componentProps: { placeholder: '请输入客户名称' },
    dynamicRules: () => [{ required: true, message: '请输入客户名称!' }],
  },
  {
    label: '客户编号',
    field: 'customerNo',
    component: 'Input',
    componentProps: { placeholder: '新增后自动生成', disabled: true },
  },
  {
    label: '客户联系人',
    field: 'contactPerson',
    component: 'Input',
    componentProps: { placeholder: '请输入客户联系人' },
    dynamicRules: () => [{ required: true, message: '请输入客户联系人!' }],
  },
  {
    label: '客户联系电话',
    field: 'contactPhone',
    component: 'Input',
    componentProps: { placeholder: '请输入客户联系电话' },
    dynamicRules: () => [{ required: true, message: '请输入客户联系电话!' }],
  },
  {
    label: '客户地址',
    field: 'address',
    component: 'Input',
    componentProps: { placeholder: '请输入客户地址' },
  },
  {
    label: '销售负责人',
    field: 'saleUserId',
    component: 'Select',
    componentProps: {
      showSearch: true,
      allowClear: true,
      placeholder: '输入姓名模糊搜索',
      options: [],
      filterOption: false,
    },
  },
  {
    label: '',
    field: 'saleUserName',
    component: 'Input',
    show: false,
  },
  {
    label: '维保负责人',
    field: 'maintenanceUserId',
    component: 'Select',
    componentProps: {
      showSearch: true,
      allowClear: true,
      placeholder: '输入姓名模糊搜索',
      options: [],
      filterOption: false,
    },
  },
  {
    label: '',
    field: 'maintenanceUserName',
    component: 'Input',
    show: false,
  },
  {
    label: '客户经理',
    field: 'customerManagerId',
    component: 'Select',
    componentProps: {
      showSearch: true,
      allowClear: true,
      placeholder: '输入姓名模糊搜索',
      options: [],
      filterOption: false,
    },
  },
  {
    label: '',
    field: 'customerManagerName',
    component: 'Input',
    show: false,
  },
  {
    label: '开票抬头',
    field: 'invoiceTitle',
    component: 'Input',
    componentProps: { placeholder: '请输入开票抬头' },
  },
  {
    label: '税号',
    field: 'taxNo',
    component: 'Input',
    componentProps: { placeholder: '请输入税号' },
  },
  {
    label: '开户银行',
    field: 'bankName',
    component: 'Input',
    componentProps: { placeholder: '请输入开户银行' },
  },
  {
    label: '银行账号',
    field: 'bankAccount',
    component: 'Input',
    componentProps: { placeholder: '请输入银行账号' },
  },
  {
    label: '开票地址',
    field: 'invoiceAddress',
    component: 'Input',
    componentProps: { placeholder: '请输入开票地址' },
  },
  {
    label: '开票电话',
    field: 'invoicePhone',
    component: 'Input',
    componentProps: { placeholder: '请输入开票电话' },
  },
  {
    label: '客户信息',
    field: 'customerInfo',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入客户信息', rows: 2 },
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 3 },
  },
  // 主键隐藏字段
  {
    label: '',
    field: 'id',
    component: 'Input',
    show: false,
  },
];
