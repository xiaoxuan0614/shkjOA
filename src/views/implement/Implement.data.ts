import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 实施管理 - 常量
 */

// 工序状态(墨刀: 进行中/未开始/已延期/已完成)
export const workStatusOptions = [
  { label: '未开始', value: '未开始' },
  { label: '进行中', value: '进行中' },
  { label: '已延期', value: '已延期' },
  { label: '已完成', value: '已完成' },
];

/**
 * 工序列表列(墨刀: 项目名称/工序名称/现场负责人/计划开始时间/计划完成时间/计划工时/剩余工期/状态/操作)
 */
export const columns: BasicColumn[] = [
  { title: '项目名称', align: 'center', dataIndex: 'projectName' },
  { title: '工序名称', align: 'center', dataIndex: 'workName' },
  { title: '现场负责人', align: 'center', dataIndex: 'owner' },
  { title: '计划开始时间', align: 'center', dataIndex: 'planStart' },
  { title: '计划完成时间', align: 'center', dataIndex: 'planEnd' },
  { title: '计划工时', align: 'center', dataIndex: 'planHours' },
  {
    title: '剩余工期',
    align: 'center',
    dataIndex: 'remainingDays',
    customRender: ({ text }) => {
      const n = Number(text);
      if (Number.isNaN(n)) return '—';
      return n < 0 ? `${n} 天` : `${n} 天`;
    },
  },
  { title: '状态', align: 'center', dataIndex: 'status' },
];

/**
 * 工序列表搜索(墨刀: 工序名称/计划开始时间/状态)
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '工序名称',
    field: 'workName',
    component: 'Input',
    componentProps: { placeholder: '请输入工序名称' },
  },
  {
    label: '计划开始时间',
    field: 'planStart',
    component: 'RangePicker',
    componentProps: {
      valueFormat: 'YYYY-MM-DD',
      placeholder: ['开始日期', '结束日期'],
    },
  },
  {
    label: '状态',
    field: 'status',
    component: 'Select',
    componentProps: { options: workStatusOptions, placeholder: '请选择状态' },
  },
];
