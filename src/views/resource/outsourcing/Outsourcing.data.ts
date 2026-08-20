import { BasicColumn, FormSchema } from '/@/components/Table';
import { initDictOptions } from '/@/utils/dict/index';

/**
 * 外协单位 - 列定义 / 表单
 * 对齐 apifox OaOutsourcingUnit:
 *   unitCode/unitName/contactPerson/contactPhone/address/
 *   invoiceTitle/invoiceTaxNo/invoiceBank/invoiceAccount/invoiceAddress/invoicePhone/
 *   status(0启用/1停用)/remark
 * ⚠️ 下拉统一走字典 outsourcing_status
 */

/** 外协单位状态下拉(字典 outsourcing_status) */
export const loadOutsourcingStatusOptions = () => initDictOptions('outsourcing_status');

/** 外协单位类型下拉(字典 outsourcing_type: 个人/单位) */
export const loadOutsourcingTypeOptions = () => initDictOptions('outsourcing_type');

/** 外协单位状态展示兜底(字典加载失败时用) */
const statusFallbackMap: Record<string, { text: string; color: string }> = {
  '0': { text: '启用', color: 'success' },
  '1': { text: '停用', color: 'error' },
};

/** 外协单位状态 value → { text, color }(数据源: outsourcing_status, 失败回退兜底) */
export const loadOutsourcingStatusMap = async (): Promise<Record<string, { text: string; color: string }>> => {
  try {
    const items: any[] = (await initDictOptions('outsourcing_status')) || [];
    if (items.length) {
      return Object.fromEntries(items.map((i) => [String(i.value), { text: i.text ?? i.label ?? '', color: i.color ?? 'default' }]));
    }
  } catch (e) {
    // ignore
  }
  return statusFallbackMap;
};

/** 列表列定义 */
export const columns: BasicColumn[] = [
  {
    title: '外协单位编号',
    align: 'center',
    dataIndex: 'unitCode',
    width: 140,
  },
  {
    title: '外协单位名称',
    align: 'center',
    dataIndex: 'unitName',
    width: 220,
  },
  {
    title: '类型',
    align: 'center',
    dataIndex: 'type',
    width: 90,
    customRender: ({ text }) => text || '—',
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
    title: '状态',
    align: 'center',
    dataIndex: 'status',
    width: 90,
  },
  {
    title: '备注',
    align: 'center',
    dataIndex: 'remark',
    customRender: ({ text }) => text || '—',
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
    label: '单位编号',
    field: 'unitCode',
    component: 'Input',
    componentProps: { placeholder: '请输入外协单位编号' },
  },
  {
    label: '单位名称',
    field: 'unitName',
    component: 'Input',
    componentProps: { placeholder: '请输入外协单位名称' },
  },
  {
    label: '类型',
    field: 'type',
    component: 'ApiSelect',
    componentProps: { api: loadOutsourcingTypeOptions, placeholder: '请选择类型', allowClear: true },
  },
  {
    label: '状态',
    field: 'status',
    component: 'ApiSelect',
    componentProps: { api: loadOutsourcingStatusOptions, placeholder: '请选择状态', allowClear: true },
  },
];

/** 新增/编辑表单 */
export const formSchema: FormSchema[] = [
  {
    label: '单位编号',
    field: 'unitCode',
    component: 'Input',
    componentProps: { placeholder: '新增后自动生成', disabled: true },
  },
  {
    label: '单位名称',
    field: 'unitName',
    component: 'Input',
    componentProps: { placeholder: '请输入外协单位名称' },
    dynamicRules: () => [{ required: true, message: '请输入外协单位名称!' }],
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
    label: '状态',
    field: 'status',
    component: 'Switch',
    componentProps: {
      checkedValue: 0,
      unCheckedValue: 1,
      checkedChildren: '启用',
      unCheckedChildren: '停用',
    },
  },
  {
    label: '类型',
    field: 'type',
    component: 'ApiSelect',
    componentProps: { api: loadOutsourcingTypeOptions, placeholder: '请选择类型' },
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 2 },
  },
  // 开票信息(个人类型可不填)
  {
    label: '开票信息',
    field: 'invoiceDivider',
    component: 'Divider',
    componentProps: { orientation: 'left', plain: true },
  },
  {
    label: '开票抬头',
    field: 'invoiceTitle',
    component: 'Input',
    componentProps: { placeholder: '请输入开票抬头' },
  },
  {
    label: '税号',
    field: 'invoiceTaxNo',
    component: 'Input',
    componentProps: { placeholder: '请输入税号' },
  },
  {
    label: '开户银行',
    field: 'invoiceBank',
    component: 'Input',
    componentProps: { placeholder: '请输入开户银行' },
  },
  {
    label: '银行账号',
    field: 'invoiceAccount',
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
  // 主键隐藏字段(编辑回显 id，保存时更新而非新增)
  {
    label: '',
    field: 'id',
    component: 'Input',
    show: false,
  },
];
