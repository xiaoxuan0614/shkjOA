import { BasicColumn, FormSchema } from '/@/components/Table';

/**
 * 供应商管理 - 列定义 / 表单
 * ⚠️ 对齐接口文档 OaSupplier：supplierNo/supplierName/contactPerson/contactPhone/address/bankName/bankAccount/remark
 */

/** 列表列定义 */
export const columns: BasicColumn[] = [
  {
    title: '供应商编号',
    align: 'center',
    dataIndex: 'supplierNo',
    width: 130,
  },
  {
    title: '供应商名称',
    align: 'center',
    dataIndex: 'supplierName',
    width: 200,
  },
  {
    title: '联系人',
    align: 'center',
    dataIndex: 'contactPerson',
    width: 100,
  },
  {
    title: '联系电话',
    align: 'center',
    dataIndex: 'contactPhone',
    width: 140,
  },
  {
    title: '地址',
    align: 'center',
    dataIndex: 'address',
  },
  {
    title: '开户银行',
    align: 'center',
    dataIndex: 'bankName',
    width: 130,
  },
  {
    title: '银行账号',
    align: 'center',
    dataIndex: 'bankAccount',
    width: 180,
  },
  {
    title: '创建时间',
    align: 'center',
    dataIndex: 'createTime',
    width: 170,
  },
];

/** 搜索表单 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '供应商名称',
    field: 'supplierName',
    component: 'Input',
    componentProps: { placeholder: '请输入供应商名称' },
  },
  {
    label: '联系人',
    field: 'contactPerson',
    component: 'Input',
    componentProps: { placeholder: '请输入联系人' },
  },
];

/** 新增/编辑表单 */
export const formSchema: FormSchema[] = [
  {
    label: '供应商编号',
    field: 'supplierNo',
    component: 'Input',
    componentProps: { placeholder: '新增后自动生成', disabled: true },
  },
  {
    label: '供应商名称',
    field: 'supplierName',
    component: 'Input',
    componentProps: { placeholder: '请输入供应商名称' },
    dynamicRules: () => [{ required: true, message: '请输入供应商名称!' }],
  },
  {
    label: '对接人',
    field: 'liaisonUserId',
    component: 'Select',
    componentProps: {
      showSearch: true,
      allowClear: true,
      placeholder: '输入姓名模糊搜索',
      options: [], // 输入后模糊加载(SupplierModal onSearch 注入)
      filterOption: false,
    },
  },
  {
    label: '',
    field: 'liaisonUserName',
    component: 'Input',
    show: false,
  },
  {
    label: '联系人',
    field: 'contactPerson',
    component: 'Input',
    componentProps: { placeholder: '请输入联系人' },
  },
  {
    label: '联系电话',
    field: 'contactPhone',
    component: 'Input',
    componentProps: { placeholder: '请输入联系电话' },
  },
  {
    label: '地址',
    field: 'address',
    component: 'Input',
    componentProps: { placeholder: '请输入地址' },
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
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 2 },
  },
  // 主键隐藏字段(编辑回显 id，保存时更新而非新增)
  {
    label: '',
    field: 'id',
    component: 'Input',
    show: false,
  },
];
