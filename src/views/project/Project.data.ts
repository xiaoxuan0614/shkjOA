import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';
import { initDictOptions } from '/@/utils/dict/index';
import { getApprovalStatusMeta } from '/@/utils/approvalStatus';
import { projectDisplayName } from './projectListFilters';

export const PROJECT_ATTACHMENT_ACCEPT = '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,image/*';
const PROJECT_ATTACHMENT_DOCUMENT_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf']);
const PROJECT_ATTACHMENT_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tif', 'tiff', 'heic', 'heif']);

export function isProjectAttachmentFile(file: File) {
  const extension = String(file?.name || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  return (
    String(file?.type || '').startsWith('image/') ||
    (!!extension && (PROJECT_ATTACHMENT_DOCUMENT_EXTENSIONS.has(extension) || PROJECT_ATTACHMENT_IMAGE_EXTENSIONS.has(extension)))
  );
}

/**
 * 项目管理 - 下拉选项统一走数据字典(sys_dict)
 * ⚠️ 原则: 所有「类型/状态/属性」下拉不再硬编码, 一律由字典配置驱动
 *   project_type / project_business_attr / project_products / project_period_status / contract_type
 * 字段以 apifox 项目模块接口为准（/project/project、/project/period、/project/acceptance）
 */

/**
 * 项目分期状态(字段为后端 period.status 值)
 * 生命周期: 未开始 → 合同/计划审批 → 实施中 → 全部工序完成后由后端推进待验收
 * → 验收阶段(内部验收 + 外部验收并行) → 两项通过后自动进入质保 → 项目完结；失败可返工复验
 * 关闭为例外终态
 * ✅ 状态字典编码已确认: project_period_status(后端 sys_dict)
 *    状态码/文案以后端字典为准; 下方 map 仅为展示兜底(字典加载失败/未知状态时使用)
 */
export const projectStatusMap: Recordable = {
  NOT_STARTED: '未开始',
  PREPARING: '筹备中',
  PENDING_APPROVAL: '待审批',
  IMPLEMENTING: '实施中',
  DEBUGGING: '调试中',
  // 兼容历史数据；新接口已改用 DEBUGGING。
  DEBUG_COMPLETED: '调试完成',
  IMPLEMENT_COMPLETED: '实施完成',
  PENDING_ACCEPT: '待验收',
  INTERNAL_ACCEPTING: '内部验收中',
  ACCEPTING: '验收中',
  REWORKING: '返工中',
  WARRANTY: '质保中',
  COMPLETED: '完结',
  CLOSED: '关闭',
};

// 状态字典映射缓存(value → { text, color })
let statusMapCache: Record<string, { text: string; color: string }> | null = null;

/**
 * 项目分期状态字典 value → { text, color }(数据源: project_period_status)
 * 列表/详情状态标签展示用; 字典加载失败时回退 projectStatusMap + statusColorMap
 */
export const loadProjectStatusMap = async (): Promise<Record<string, { text: string; color: string }>> => {
  if (statusMapCache) return statusMapCache;
  try {
    const items: any[] = (await initDictOptions('project_period_status')) || [];
    statusMapCache = Object.fromEntries(
      items.map((i) => [String(i.value), { text: i.text ?? i.label ?? '', color: i.color ?? statusColorMap[String(i.value)] ?? 'default' }])
    );
  } catch (e) {
    statusMapCache = null;
  }
  if (!statusMapCache || !Object.keys(statusMapCache).length) {
    statusMapCache = Object.fromEntries(
      Object.entries(projectStatusMap).map(([value, text]) => [value, { text, color: statusColorMap[value] || 'default' }])
    );
  }
  return statusMapCache;
};

/**
 * 通用字典选项加载器(数据源: 后端 sys_dict), 搜索/表单下拉用
 * 状态码/文案以后端字典为准; 字典加载失败时回退 fallback 选项
 */
export const loadDictOptions = async (
  code: string,
  fallback: { label: string; value: string; color?: string }[] = []
): Promise<{ label: string; value: string; color?: string }[]> => {
  try {
    const items: any[] = (await initDictOptions(code)) || [];
    if (items.length) {
      return items.map((i) => ({ label: i.text ?? i.label, value: i.value, color: i.color }));
    }
  } catch (e) {
    // ignore, 走兜底
  }
  return fallback;
};

/** 工序状态字典；接口只接受英文状态码，中文仅用于展示。 */
export const projectProcessStatusOptions = [
  { label: '未开始', value: 'NOT_STARTED', color: 'default' },
  { label: '进行中', value: 'IN_PROGRESS', color: 'processing' },
  { label: '已完成', value: 'COMPLETED', color: 'success' },
];

export const loadProjectProcessStatusOptions = () => loadDictOptions('project_process_status', projectProcessStatusOptions);

// 工序名称(字典 work_type，接口 processName 保存字典值)
export const loadProjectWorkTypeOptions = () => loadDictOptions('work_type');

// 项目状态(字典 project_period_status)
export const loadProjectStatusOptions = () =>
  loadDictOptions(
    'project_period_status',
    Object.entries(projectStatusMap).map(([value, label]) => ({ value, label: String(label) }))
  );

// 项目类型(字典 project_type)
export const loadProjectTypeOptions = () => loadDictOptions('project_type');

// 项目类型字典 value → text(列表「项目类型」列展示用; 失败回退原始值)
export const loadProjectTypeMap = async (): Promise<Record<string, string>> => {
  try {
    const items: any[] = (await initDictOptions('project_type')) || [];
    if (items.length) {
      return Object.fromEntries(items.map((i) => [String(i.value), i.text ?? i.label ?? '']));
    }
  } catch (e) {
    // ignore
  }
  return {};
};

// 业务属性(字典 project_business_attr, 多选)
export const loadBusinessAttrOptions = () => loadDictOptions('project_business_attr');

// 涉及产品清单(字典 project_products, 多选)
export const loadProductOptions = () => loadDictOptions('project_products');

/**
 * 项目状态流转配置：普通 action 传 periodId + status → /project/period/status，
 * 验收提交和返工执行由各自专用接口处理。
 * - 普通 action: { label, status, auth } → 调状态流转接口
 * - act='contractSign': 跳转「合同信息」页面(合同提交后待审批，审批通过后项目→筹备中)
 * - act='planAudit': 打开「计划审批」(通过→实施中, 驳回→筹备中)
 * 生命周期: 未开始 →(合同提交/审批)→ 筹备中 →(计划提交审批)→ 待审批 →(计划审批通过)→ 实施中
 *   → 逐道工序完成 → 待验收 → 验收(内/外并行) → 质保 → 完结；失败验收可进入返工后复验
 * ⚠️ status 为前端约定, 后端提供 status 接口后需对齐状态码
 */
export const statusFlow: Recordable = {
  NOT_STARTED: {
    actions: [{ label: '合同签订', act: 'contractSign', auth: 'project:contract' }],
  },
  // 筹备中: 无流转按钮, 项目经理通过「编辑计划方案」进入计划页创建/提交审批
  PREPARING: {
    actions: [],
  },
  PENDING_APPROVAL: {
    actions: [{ label: '计划审批', act: 'planAudit', auth: 'project:plan:audit' }],
  },
  IMPLEMENTING: {
    actions: [{ label: '实施完成', act: 'processComplete', auth: 'project:implement' }],
  },
  DEBUGGING: {
    actions: [{ label: '实施完成', act: 'processComplete', auth: 'project:implement' }],
  },
  // 兼容历史数据；新接口不再生成 DEBUG_COMPLETED。
  DEBUG_COMPLETED: {
    actions: [{ label: '实施完成', act: 'processComplete', auth: 'project:implement' }],
  },
  // 当前轮全部工序完成进入待验收；开始验收入口在列表统一处理。
  IMPLEMENT_COMPLETED: { actions: [] },
  PENDING_ACCEPT: { actions: [] },
  INTERNAL_ACCEPTING: { actions: [] },
  ACCEPTING: { actions: [] },
  // 返工审批通过后复用实施工序完成抽屉；最后一道完成后由后端推进验收。
  REWORKING: {
    actions: [{ label: '返工进度', act: 'processComplete', auth: 'project:implement' }],
  },
  WARRANTY: { actions: [{ label: '项目完结', status: 'COMPLETED', auth: 'project:warranty' }] },
  COMPLETED: null,
  CLOSED: null,
};

// 状态颜色
export const statusColorMap: Recordable = {
  NOT_STARTED: 'default',
  PREPARING: 'gold',
  PENDING_APPROVAL: 'processing',
  IMPLEMENTING: 'blue',
  DEBUGGING: 'cyan',
  DEBUG_COMPLETED: 'cyan',
  IMPLEMENT_COMPLETED: 'blue',
  PENDING_ACCEPT: 'gold',
  INTERNAL_ACCEPTING: 'geekblue',
  ACCEPTING: 'orange',
  REWORKING: 'volcano',
  WARRANTY: 'purple',
  COMPLETED: 'success',
  CLOSED: 'error',
};

/**
 * 列表列(项目管理新增页面-分页列表 projectPeriodList)
 */
export const columns: BasicColumn[] = [
  {
    title: '项目名称',
    align: 'center',
    dataIndex: 'projectName',
    customRender: ({ record }) => projectDisplayName(record),
  },
  {
    title: '项目类型',
    align: 'center',
    dataIndex: 'projectType',
    customRender: ({ text }) => text || '—',
  },
  {
    title: '甲方名称',
    align: 'center',
    dataIndex: 'customerName',
  },
  {
    title: '项目对接人',
    align: 'center',
    dataIndex: 'projectLiaisonUserName',
  },
  {
    title: '项目经理',
    align: 'center',
    dataIndex: 'projectManagerName',
    width: 120,
    customRender: ({ text }) => String(text ?? '').trim() || '-',
  },
  {
    title: '进度(%)',
    align: 'center',
    dataIndex: 'totalProgress',
    customRender: ({ text }) => text ?? '—',
  },
  {
    title: '项目状态',
    align: 'center',
    dataIndex: 'status',
    customRender: ({ text }) => text || '—',
  },
  {
    title: '到货状态',
    align: 'center',
    dataIndex: 'arrivalStatus',
    width: 100,
  },
  {
    title: '合同状态',
    align: 'center',
    dataIndex: 'contractStatus',
    customRender: ({ text }) => text ?? '—',
  },
];

/**
 * 列表搜索表单
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '请输入主项目名称关键词', allowClear: true },
  },
  {
    label: '项目经理',
    field: 'projectManagerName',
    component: 'Input',
    componentProps: { placeholder: '请输入项目经理姓名', allowClear: true },
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
    componentProps: { api: loadProjectTypeOptions, placeholder: '全部项目类型', allowClear: true, mode: 'multiple', maxTagCount: 'responsive' },
  },
  {
    label: '项目状态',
    field: 'status',
    component: 'ApiSelect',
    componentProps: {
      api: loadProjectStatusOptions,
      mode: 'multiple',
      maxTagCount: 'responsive',
      placeholder: '全部项目状态',
      allowClear: true,
      showSearch: true,
      optionFilterProp: 'label',
    },
  },
  {
    label: '到货状态',
    field: 'arrivalStatus',
    component: 'Select',
    componentProps: {
      placeholder: '全部到货状态',
      mode: 'multiple',
      maxTagCount: 'responsive',
      allowClear: true,
      options: [
        { label: '未到货', value: 0 },
        { label: '已到货', value: 1 },
      ],
    },
  },
  {
    label: '合同状态',
    field: 'contractStatus',
    component: 'Select',
    componentProps: {
      placeholder: '全部合同状态',
      mode: 'multiple',
      maxTagCount: 'responsive',
      allowClear: true,
      options: ['-1', '0', '1', '2', '3'].map((value) => ({ value, label: getApprovalStatusMeta(value).text })),
    },
  },
];

/**
 * 新增/编辑项目 - 基本信息表单(字段对齐后端 projectPeriodDetail / addProjectPeriod)
 * 所属主项目(projectId): 选择了则本记录作为该主项目下的「期」项目; 不选则新建主项目
 */
export const projectFormSchema: FormSchema[] = [
  {
    label: '所属主项目',
    field: 'projectId',
    component: 'Select',
    componentProps: {
      allowClear: true,
      showSearch: true,
      optionFilterProp: 'label',
      placeholder: '不选则本记录作为主项目',
    },
    helpMessage: '选择已有主项目，则本记录作为该主项目下的「期」项目；不选则新建主项目',
  },
  {
    label: '主项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '请输入主项目名称' },
    dynamicRules: () => [{ required: true, whitespace: true, message: '请输入主项目名称!' }],
  },
  {
    label: '分期名称',
    field: 'periodName',
    component: 'Input',
    componentProps: { placeholder: '请输入分期名称（如：一期工程）' },
    // 项目创建完成后(id 存在)不可修改分期名称
    dynamicDisabled: ({ model }) => !!model.id,
    dynamicRules: () => [{ required: true, message: '请输入分期名称!' }],
  },
  {
    label: '项目类型',
    field: 'projectType',
    component: 'ApiSelect',
    componentProps: { api: loadProjectTypeOptions, placeholder: '请选择项目类型' },
    dynamicRules: () => [{ required: true, message: '请选择项目类型!' }],
  },
  {
    label: '项目对接人',
    field: 'projectLiaisonUserId',
    component: 'Select',
    helpMessage: '客户洽谈对接人，默认为当前操作人，可修改。',
    componentProps: { showSearch: true, optionFilterProp: 'label', placeholder: '请选择项目对接人' },
    dynamicRules: () => [{ required: true, message: '请选择项目对接人!' }],
  },
  {
    label: '业务属性',
    field: 'businessAttribute',
    component: 'ApiSelect',
    componentProps: {
      api: loadBusinessAttrOptions,
      mode: 'multiple',
      placeholder: '请选择业务属性',
    },
    dynamicRules: () => [{ required: true, message: '请选择业务属性!' }],
  },
  {
    label: '涉及产品清单',
    field: 'involvedProducts',
    component: 'ApiSelect',
    componentProps: {
      api: loadProductOptions,
      mode: 'multiple',
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
    field: 'contactPerson',
    component: 'Input',
    componentProps: { placeholder: '请输入甲方联系人' },
    dynamicRules: () => [{ required: true, message: '请输入甲方联系人!' }],
  },
  {
    label: '甲方联系电话',
    field: 'contactPhone',
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
    field: 'attachmentFileId',
    component: 'Input',
    slot: 'attachment',
    helpMessage: '可选择一个 Word、PPT、Excel、PDF 或图片文件，保存项目时一并上传',
  },
  {
    label: '项目需求',
    field: 'projectRequirement',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入项目需求', rows: 3 },
    dynamicRules: () => [{ required: true, message: '请输入项目需求!' }],
  },
  {
    label: '项目地址',
    field: 'projectAddress',
    component: 'AMapLocationSelect',
    colProps: { span: 24 },
    componentProps: {
      placeholder: '请选择项目地址',
      inline: false,
      mapHeight: '280px',
      // 回显经纬度在 ProjectApply.loadDetail 里通过 updateSchema 注入
      lng: null,
      lat: null,
    },
    dynamicRules: () => [{ required: true, message: '请输入项目地址!' }],
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 3 },
  },
  // 主键隐藏字段: 编辑回显后 model 里有 id(periodId)，用于判定「已创建」
  {
    label: '',
    field: 'id',
    component: 'Input',
    show: false,
  },
  {
    label: '',
    field: 'periodId',
    component: 'Input',
    show: false,
  },
  // 项目地址经高德搜索带出的经纬度(隐藏, 随保存提交)
  {
    label: '',
    field: 'longitude',
    component: 'InputNumber',
    show: false,
  },
  {
    label: '',
    field: 'latitude',
    component: 'InputNumber',
    show: false,
  },
];
