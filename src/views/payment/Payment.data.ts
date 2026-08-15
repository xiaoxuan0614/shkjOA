import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 回款管理 - 常量选项(墨刀原型)
 */

// 合同类型(墨刀批注: 贸易合同/维保合同/项目合同/维修合同)
export const contractTypeOptions = [
  { label: '贸易合同', value: '贸易合同' },
  { label: '维保合同', value: '维保合同' },
  { label: '项目合同', value: '项目合同' },
  { label: '维修合同', value: '维修合同' },
];

// 回款类型(墨刀: 预付款/到货款/验收款/质保金/尾款)
export const paybackTypeOptions = [
  { label: '预付款', value: '预付款' },
  { label: '到货款', value: '到货款' },
  { label: '验收款', value: '验收款' },
  { label: '质保金', value: '质保金' },
  { label: '尾款', value: '尾款' },
];

/**
 * 合同列表列(墨刀: 合同ID/合同类型/甲方名称/负责人/合同签订日期/关联项目ID/合同金额/已回款金额/未回款金额/操作)
 */
export const columns: BasicColumn[] = [
  { title: '合同ID', align: 'center', dataIndex: 'contractNo' },
  { title: '合同类型', align: 'center', dataIndex: 'contractType' },
  { title: '甲方名称', align: 'center', dataIndex: 'customerName' },
  { title: '负责人', align: 'center', dataIndex: 'owner' },
  { title: '合同签订日期', align: 'center', dataIndex: 'signDate' },
  { title: '关联项目ID', align: 'center', dataIndex: 'projectNo', customRender: ({ text }) => text || '—' },
  { title: '合同金额', align: 'center', dataIndex: 'contractAmount' },
  { title: '已回款金额', align: 'center', dataIndex: 'paidAmount' },
  { title: '未回款金额', align: 'center', dataIndex: 'unpaidAmount' },
];

/**
 * 合同列表搜索(墨刀: 合同类型/合同签订日期/甲方名称)
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '合同类型',
    field: 'contractType',
    component: 'Select',
    componentProps: { options: contractTypeOptions, placeholder: '请选择合同类型' },
  },
  {
    label: '合同签订日期',
    field: 'signDate',
    component: 'RangePicker',
    componentProps: {
      valueFormat: 'YYYY-MM-DD',
      placeholder: ['开始日期', '结束日期'],
    },
  },
  {
    label: '甲方名称',
    field: 'customerName',
    component: 'Input',
    componentProps: { placeholder: '请输入甲方名称' },
  },
];
