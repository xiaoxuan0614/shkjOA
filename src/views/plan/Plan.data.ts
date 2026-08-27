import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';
import { loadDictOptions, loadProjectStatusOptions, loadProjectTypeOptions } from '../project/Project.data';

/**
 * 计划方案管理 - 常量选项(字段对齐后端 /project/project 项目分期列表)
 * ⚠️ 下拉统一走字典(project_period_status / project_type 等), 不硬编码
 */

/**
 * 项目/分期列表列(projectPeriodList)
 */
export const columns: BasicColumn[] = [
  { title: '项目编号', align: 'center', dataIndex: 'projectNo' },
  { title: '主项目名称', align: 'center', dataIndex: 'projectName' },
  { title: '分期名称', align: 'center', dataIndex: 'periodName' },
  { title: '项目类型', align: 'center', dataIndex: 'projectType' },
  { title: '项目负责人', align: 'center', dataIndex: 'projectLeaderName' },
  { title: '状态', align: 'center', dataIndex: 'status' },
];

/**
 * 项目/分期列表搜索
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '主项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '请输入主项目名称' },
  },
  {
    label: '分期名称',
    field: 'periodName',
    component: 'Input',
    componentProps: { placeholder: '请输入分期名称' },
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
    componentProps: { api: loadProjectStatusOptions, placeholder: '请选择状态' },
  },
];

/** 项目用料候选清单状态：直接使用后端字典编码及状态值。 */
export const loadQuotationStatusOptions = () => loadDictOptions('project_material_candidate_status');

export const loadQuotationStatusMap = async (): Promise<Record<string, { text: string; color?: string }>> => {
  const options = await loadQuotationStatusOptions();
  return Object.fromEntries(options.map((item) => [String(item.value), { text: item.label, color: item.color }]));
};

export const quotationColumns: BasicColumn[] = [
  { title: '主项目名称', align: 'center', dataIndex: 'projectName' },
  { title: '分期项目名称', align: 'center', dataIndex: 'periodName' },
  { title: '报价单名称', align: 'center', dataIndex: 'candidateName' },
  { title: '分期项目ID', align: 'center', dataIndex: 'periodId', width: 190 },
  { title: '最后更新人', align: 'center', dataIndex: 'lastUpdatedBy', width: 130 },
  { title: '状态', align: 'center', dataIndex: 'status', width: 100 },
];

export const quotationSearchFormSchema: FormSchema[] = [
  { label: '主项目名称', field: 'projectName', component: 'Input', componentProps: { placeholder: '请输入主项目名称' } },
  { label: '分期项目名称', field: 'periodName', component: 'Input', componentProps: { placeholder: '请输入分期项目名称' } },
  { label: '报价单名称', field: 'candidateName', component: 'Input', componentProps: { placeholder: '请输入报价单名称' } },
  { label: '分期项目ID', field: 'periodId', component: 'Input', componentProps: { placeholder: '请输入分期项目ID' } },
  {
    label: '状态',
    field: 'status',
    component: 'ApiSelect',
    componentProps: { api: loadQuotationStatusOptions, placeholder: '请选择状态' },
  },
];
