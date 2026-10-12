import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';
import { projectDisplayName } from '../project/projectListFilters';
import { loadDictOptions, loadProjectStatusOptions, loadProjectTypeOptions, loadProductOptions } from '../project/Project.data';

/**
 * 计划方案管理 - 常量选项(字段对齐后端 /project/project 项目分期列表)
 * ⚠️ 下拉统一走字典(project_period_status / project_type 等), 不硬编码
 */

/**
 * 项目/分期列表列(projectPeriodList)
 */
export const columns: BasicColumn[] = [
  { title: '项目名称', align: 'center', dataIndex: 'projectName', customRender: ({ record }) => projectDisplayName(record) },
  { title: '项目类型', align: 'center', dataIndex: 'projectType' },
  { title: '项目负责人', align: 'center', dataIndex: 'projectLeaderName' },
  { title: '状态', align: 'center', dataIndex: 'status' },
];

/**
 * 项目/分期列表搜索
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '项目名称',
    field: 'keyword',
    component: 'Input',
    componentProps: { placeholder: '请输入项目名称关键词' },
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
export const loadQuotationYesNoOptions = () => loadDictOptions('yes_no_status');

export const loadQuotationStatusMap = async (): Promise<Record<string, { text: string; color?: string }>> => {
  const options = await loadQuotationStatusOptions();
  return Object.fromEntries(options.map((item) => [String(item.value), { text: item.label, color: item.color }]));
};

export const quotationColumns: BasicColumn[] = [
  { title: '项目名称', align: 'center', dataIndex: 'projectName', customRender: ({ record }) => projectDisplayName(record) },
  { title: '客户名称', align: 'center', dataIndex: 'customerName', width: 200, ellipsis: true, customRender: ({ text }) => String(text ?? '').trim() || '—' },
  { title: '项目对接人', align: 'center', dataIndex: 'projectLiaisonUserName', width: 130, ellipsis: true, customRender: ({ text }) => String(text ?? '').trim() || '—' },
  { title: '项目类型', align: 'center', dataIndex: 'projectType', width: 130 },
  { title: '涉及产品', align: 'center', dataIndex: 'involvedProducts', width: 200, ellipsis: true },
  { title: '报价单名称', align: 'center', dataIndex: 'candidateName' },
  { title: '最后更新人', align: 'center', dataIndex: 'lastUpdatedBy', width: 130 },
  { title: '审批状态', align: 'center', dataIndex: 'status', width: 100 },
  { title: '采用状态', align: 'center', dataIndex: 'adopted', width: 100 },
];

export const quotationSearchFormSchema: FormSchema[] = [
  { label: '项目名称', field: 'keyword', component: 'Input', componentProps: { placeholder: '请输入项目或分期名称关键词', allowClear: true } },
  { label: '客户名称', field: 'customerName', component: 'Input', componentProps: { placeholder: '请输入客户名称关键词', allowClear: true } },
  { label: '项目类型', field: 'projectType', component: 'ApiSelect', componentProps: { api: loadProjectTypeOptions, placeholder: '全部项目类型', allowClear: true } },
  { label: '涉及产品', field: 'involvedProducts', component: 'ApiSelect', helpMessage: '按所选产品完整组合精确匹配', componentProps: { api: loadProductOptions, mode: 'multiple', placeholder: '请选择完整产品组合', allowClear: true, maxTagCount: 'responsive' } },
  {
    label: '审批状态',
    field: 'status',
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: '全部审批状态',
      options: [
        { label: '草稿', value: '-1' },
        { label: '驳回', value: '0' },
        { label: '通过', value: '1' },
        { label: '待处理', value: '2' },
        { label: '已作废', value: '4' },
      ],
    },
  },
  {
    label: '采用状态',
    field: 'adopted',
    component: 'ApiSelect',
    componentProps: {
      allowClear: true,
      placeholder: '全部采用状态',
      api: loadQuotationYesNoOptions,
    },
  },
];

/** 审批状态按候选生命周期契约显示，与采用/定价字典分开。 */
export const quotationListStatusMap: Record<string, { text: string; color: string }> = {
  '-1': { text: '草稿', color: 'default' },
  '0': { text: '驳回', color: 'error' },
  '1': { text: '通过', color: 'success' },
  '2': { text: '待处理', color: 'processing' },
  '4': { text: '已作废', color: 'default' },
};
