import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';
import { projectDisplayName } from '../project/projectListFilters';
import { isImplementProjectStatus } from './implementScope';
import {
  loadProjectProcessStatusOptions,
  loadProjectStatusOptions,
  loadProjectTypeOptions,
  projectProcessStatusOptions,
} from '../project/Project.data';

/**
 * 实施管理 - 项目分期列表 + 工序日志。
 */

export const workStatusOptions = projectProcessStatusOptions;

// 工序状态(字典 project_process_status)
export const loadWorkStatusOptions = loadProjectProcessStatusOptions;

export const loadImplementProjectStatusOptions = async () =>
  (await loadProjectStatusOptions()).filter((item) => isImplementProjectStatus(item.value));

/**
 * 项目分期列表列（后端 projectPeriodList 字段）。
 */
export const columns: BasicColumn[] = [
  { title: '项目名称', dataIndex: 'projectName', width: 260, ellipsis: true, customRender: ({ record }) => projectDisplayName(record) },
  { title: '客户名称', dataIndex: 'customerName', width: 190, ellipsis: true },
  { title: '项目类型', align: 'center', dataIndex: 'projectType', width: 130 },
  { title: '项目状态', align: 'center', dataIndex: 'status', width: 120 },
  { title: '计划验收日期', align: 'center', dataIndex: 'plannedAcceptanceDate', width: 140 },
];

/**
 * 项目分期列表搜索（与 projectPeriodList 契约一致）。
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '项目名称',
    field: 'keyword',
    component: 'Input',
    componentProps: { placeholder: '请输入项目名称关键词' },
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
    component: 'ApiSelect',
    componentProps: { api: loadProjectTypeOptions, placeholder: '请选择项目类型' },
  },
  {
    label: '状态',
    field: 'status',
    component: 'ApiSelect',
    componentProps: { api: loadImplementProjectStatusOptions, placeholder: '实施中及后续阶段', allowClear: true },
  },
];
