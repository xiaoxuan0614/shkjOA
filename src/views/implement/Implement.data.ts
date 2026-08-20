import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';
import { loadDictOptions } from '../project/Project.data';

/**
 * 实施管理 - 常量(字段对齐后端 /project/process 项目工序)
 * 状态下拉走字典(work_status), 加载失败回退硬编码
 */

// 工序状态(兜底: 字典 work_status 加载失败时用)
export const workStatusOptions = [
  { label: '未开始', value: '未开始' },
  { label: '进行中', value: '进行中' },
  { label: '已延期', value: '已延期' },
  { label: '已完成', value: '已完成' },
];

// 工序状态(字典 work_status)
export const loadWorkStatusOptions = () => loadDictOptions('work_status', workStatusOptions);

/**
 * 工序列表列(后端 project_process 字段)
 */
export const columns: BasicColumn[] = [
  { title: '工序名称', align: 'center', dataIndex: 'processName' },
  { title: '现场负责人', align: 'center', dataIndex: 'siteLeaderName' },
  { title: '计划开始时间', align: 'center', dataIndex: 'plannedStartTime' },
  { title: '计划完成时间', align: 'center', dataIndex: 'plannedEndTime' },
  { title: '计划工时', align: 'center', dataIndex: 'plannedHours' },
  { title: '实际开始时间', align: 'center', dataIndex: 'actualStartTime' },
  { title: '实际完成时间', align: 'center', dataIndex: 'actualEndTime' },
  { title: '状态', align: 'center', dataIndex: 'status' },
];

/**
 * 工序列表搜索(后端支持字段)
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '工序名称',
    field: 'processName',
    component: 'Input',
    componentProps: { placeholder: '请输入工序名称' },
  },
  {
    label: '状态',
    field: 'status',
    component: 'ApiSelect',
    componentProps: { api: loadWorkStatusOptions, placeholder: '请选择状态' },
  },
];
