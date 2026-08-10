import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 项目管理 - 常量选项
 * TODO: 这些字典后续统一配置到系统字典, 前端先写死
 */

// 涉及产品清单(多选)
export const productOptions = [
  { label: '铅封机', value: '铅封机' },
  { label: '智能闸口', value: '智能闸口' },
  { label: '定制系统', value: '定制系统' },
  { label: '货代系统', value: '货代系统' },
  { label: 'PDA', value: 'PDA' },
  { label: '打印机', value: '打印机' },
];

// 项目类型(多选)
export const projectTypeOptions = [
  { label: '纯软件', value: '纯软件' },
  { label: '纯硬件', value: '纯硬件' },
  { label: '软硬件一体化', value: '软硬件一体化' },
];

// 合同类型(单选)
export const contractTypeOptions = [
  { label: '贸易合同', value: '贸易合同' },
  { label: '维保合同', value: '维保合同' },
  { label: '维修合同', value: '维修合同' },
  { label: '项目合同', value: '项目合同' },
];

// 业务属性(多选)
export const businessAttrOptions = [
  { label: '新建建设', value: '新建建设' },
  { label: '改造升级', value: '改造升级' },
  { label: '维保服务', value: '维保服务' },
  { label: '故障维修', value: '故障维修' },
  { label: '备件供货', value: '备件供货' },
];

// 项目状态(列表展示/搜索)
export const projectStatusOptions = [
  { label: '未开始', value: '未开始' },
  { label: '筹备', value: '筹备' },
  { label: '实施中', value: '实施中' },
  { label: '待验收', value: '待验收' },
  { label: '质保中', value: '质保中' },
  { label: '完结', value: '完结' },
  { label: '关闭', value: '关闭' },
];

// 项目负责人(后续接用户接口)
export const managerOptions = [
  { label: '张小刀', value: '张小刀' },
  { label: '李建国', value: '李建国' },
  { label: '王海峰', value: '王海峰' },
  { label: '赵敏', value: '赵敏' },
];

/**
 * 列表列
 */
export const columns: BasicColumn[] = [
  {
    title: '项目ID',
    align: 'center',
    dataIndex: 'projectNo',
  },
  {
    title: '项目名称',
    align: 'center',
    dataIndex: 'projectName',
  },
  {
    title: '项目类型',
    align: 'center',
    dataIndex: 'projectType',
  },
  {
    title: '甲方名称',
    align: 'center',
    dataIndex: 'customerName',
  },
  {
    title: '项目负责人',
    align: 'center',
    dataIndex: 'manager',
  },
  {
    title: '状态',
    align: 'center',
    dataIndex: 'status',
  },
  {
    title: '合同签订日期',
    align: 'center',
    dataIndex: 'contractDate',
  },
];

/**
 * 列表搜索表单
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '项目ID',
    field: 'projectNo',
    component: 'Input',
    componentProps: { placeholder: '请输入项目ID' },
  },
  {
    label: '项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '请输入项目名称' },
  },
  {
    label: '客户名称',
    field: 'customerName',
    component: 'Input',
    componentProps: { placeholder: '请输入客户名称' },
  },
  {
    label: '项目类型',
    field: 'projectType',
    component: 'Select',
    componentProps: { options: projectTypeOptions, placeholder: '请选择项目类型' },
  },
  {
    label: '项目负责人',
    field: 'manager',
    component: 'Select',
    componentProps: { options: managerOptions, placeholder: '请选择项目负责人' },
  },
  {
    label: '状态',
    field: 'status',
    component: 'Select',
    componentProps: { options: projectStatusOptions, placeholder: '请选择状态' },
  },
];

/**
 * 新增/编辑项目 - 基本信息表单
 */
export const projectFormSchema: FormSchema[] = [
  {
    label: '项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '请输入项目名称' },
    dynamicRules: () => [{ required: true, message: '请输入项目名称!' }],
  },
  {
    label: '项目类型',
    field: 'projectType',
    component: 'Select',
    componentProps: {
      mode: 'multiple',
      options: projectTypeOptions,
      placeholder: '请选择项目类型',
    },
    dynamicRules: () => [{ required: true, message: '请选择项目类型!' }],
  },
  {
    label: '项目负责人',
    field: 'manager',
    component: 'Select',
    componentProps: { options: managerOptions, placeholder: '请选择项目负责人' },
    dynamicRules: () => [{ required: true, message: '请选择项目负责人!' }],
  },
  {
    label: '业务属性',
    field: 'businessAttr',
    component: 'Select',
    componentProps: {
      mode: 'multiple',
      options: businessAttrOptions,
      placeholder: '请选择业务属性',
    },
    dynamicRules: () => [{ required: true, message: '请选择业务属性!' }],
  },
  {
    label: '涉及产品清单',
    field: 'products',
    component: 'Select',
    componentProps: {
      mode: 'multiple',
      options: productOptions,
      placeholder: '请选择涉及产品',
    },
    dynamicRules: () => [{ required: true, message: '请选择涉及产品清单!' }],
  },
  {
    label: '甲方名称',
    field: 'customerId',
    component: 'Select',
    componentProps: {
      showSearch: true,
      optionFilterProp: 'label',
      placeholder: '请选择客户',
    },
    // 选客户后带出联系人/电话/甲方信息(在页面里 watch 处理)
    dynamicRules: () => [{ required: true, message: '请选择甲方名称!' }],
  },
  {
    label: '甲方联系人',
    field: 'contact',
    component: 'Input',
    componentProps: { placeholder: '请输入甲方联系人' },
    dynamicRules: () => [{ required: true, message: '请输入甲方联系人!' }],
  },
  {
    label: '甲方联系电话',
    field: 'phone',
    component: 'Input',
    componentProps: { placeholder: '请输入甲方联系电话' },
    dynamicRules: () => [{ required: true, message: '请输入甲方联系电话!' }],
  },
  {
    label: '甲方信息',
    field: 'customerInfo',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入甲方信息', rows: 3 },
  },
  {
    label: '附件',
    field: 'attachment',
    component: 'Upload',
    componentProps: { placeholder: '请上传附件' },
  },
  {
    label: '项目需求',
    field: 'requirement',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入项目需求', rows: 3 },
    dynamicRules: () => [{ required: true, message: '请输入项目需求!' }],
  },
  {
    label: '项目地址',
    field: 'address',
    component: 'Input',
    componentProps: { placeholder: '请输入项目地址' },
    dynamicRules: () => [{ required: true, message: '请输入项目地址!' }],
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 3 },
  },
];
