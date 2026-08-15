import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 计划方案管理 - 常量选项(与墨刀原型一致)
 */

// 项目类型
export const projectTypeOptions = [
  { label: '智能闸口', value: '智能闸口' },
  { label: '车载系统', value: '车载系统' },
  { label: '铅封机', value: '铅封机' },
  { label: '360环视', value: '360环视' },
  { label: '环保', value: '环保' },
];

// 项目状态
export const projectStatusOptions = [
  { label: '筹备', value: '筹备' },
  { label: '实施中', value: '实施中' },
  { label: '待验收', value: '待验收' },
  { label: '质保中', value: '质保中' },
  { label: '完结', value: '完结' },
  { label: '关闭', value: '关闭' },
];

// 负责人
export const managerOptions = [
  { label: '张小刀', value: '张小刀' },
  { label: '李建国', value: '李建国' },
  { label: '王海峰', value: '王海峰' },
  { label: '赵敏', value: '赵敏' },
];

// 回款类型
export const paybackTypeOptions = [
  { label: '预付款', value: '预付款' },
  { label: '到货款', value: '到货款' },
  { label: '验收款', value: '验收款' },
  { label: '质保金', value: '质保金' },
  { label: '尾款', value: '尾款' },
];

/**
 * 项目列表列(墨刀: 项目ID/项目名称/项目类型/项目负责人/项目状态/合同签订日期/操作)
 */
export const columns: BasicColumn[] = [
  { title: '项目ID', align: 'center', dataIndex: 'projectNo' },
  { title: '项目名称', align: 'center', dataIndex: 'projectName' },
  { title: '项目类型', align: 'center', dataIndex: 'projectType' },
  { title: '项目负责人', align: 'center', dataIndex: 'manager' },
  { title: '项目状态', align: 'center', dataIndex: 'status' },
  { title: '合同签订日期', align: 'center', dataIndex: 'contractDate' },
];

/**
 * 项目列表搜索
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
    label: '项目类型',
    field: 'projectType',
    component: 'Select',
    componentProps: { options: projectTypeOptions, placeholder: '请选择项目类型' },
  },
  {
    label: '项目状态',
    field: 'status',
    component: 'Select',
    componentProps: { options: projectStatusOptions, placeholder: '请选择项目状态' },
  },
  {
    label: '合同签订日期',
    field: 'contractDate',
    component: 'RangePicker',
    componentProps: {
      valueFormat: 'YYYY-MM-DD',
      placeholder: ['开始日期', '结束日期'],
    },
  },
];
