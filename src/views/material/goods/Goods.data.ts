import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 物料库存 - 列表/搜索/常量字典配置
 *
 * ⚠️ 字段与正式后端接口契约(StockMaterial)对齐：
 *    materialCode 物料编码 / materialName 物料名称 / materialCategory 物料类别
 *    brand 品牌 / model 型号 / unit 基准单位 / stockQty 库存数量(以基准单位为准)
 *    unitPrice 基准单位单价 / stockAmount 库存金额 / safetyStock 安全库存 / remark 备注
 *    子表 unitList: unitName 单位名称 / isBaseUnit 是否基准单位 / conversionQty 换算系数
 * 说明：
 * 1. 单位(unitOptions)当前使用静态选项；
 *    后续单位在字典里维护后，可将「单位」选择控件换成 JSelectDict(dict: 'unit')，直接对接字典。
 */

/**
 * 单位选项（后续在字典里维护，届时替换为字典加载即可）
 */
export const unitOptions = [
  { label: '个', value: '个' },
  { label: '箱', value: '箱' },
  { label: '件', value: '件' },
  { label: '套', value: '套' },
  { label: '台', value: '台' },
  { label: '支', value: '支' },
  { label: '公斤', value: '公斤' },
  { label: '吨', value: '吨' },
  { label: '米', value: '米' },
  { label: '升', value: '升' },
];

/**
 * 列表列定义(与 StockMaterial 字段对齐)
 */
export const columns: BasicColumn[] = [
  {
    title: '物料编码',
    align: 'center',
    dataIndex: 'materialCode',
    width: 160,
  },
  {
    title: '物料名称',
    align: 'center',
    dataIndex: 'materialName',
  },
  {
    title: '类别',
    align: 'center',
    dataIndex: 'materialCategory',
    width: 110,
  },
  {
    title: '品牌',
    align: 'center',
    dataIndex: 'brand',
    width: 110,
  },
  {
    title: '型号',
    align: 'center',
    dataIndex: 'model',
    width: 110,
  },
  {
    title: '基准单位',
    align: 'center',
    dataIndex: 'unit',
    width: 90,
  },
  {
    title: '基准单价',
    align: 'center',
    dataIndex: 'unitPrice',
    width: 100,
  },
  {
    title: '库存数量',
    align: 'center',
    dataIndex: 'stockQty',
    width: 120,
    // 具体渲染在页面 bodyCell 中拼接基准单位后缀，见 goods/index.vue
  },
  {
    title: '安全库存',
    align: 'center',
    dataIndex: 'safetyStock',
    width: 100,
  },
  {
    title: '创建时间',
    align: 'center',
    dataIndex: 'createTime',
    width: 180,
  },
];

/**
 * 搜索表单
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '物料编码',
    field: 'materialCode',
    component: 'Input',
    componentProps: { placeholder: '请输入物料编码' },
    // colProps: { span: 6 },
  },
  {
    label: '物料名称',
    field: 'materialName',
    component: 'Input',
    componentProps: { placeholder: '请输入物料名称' },
    // colProps: { span: 6 },
  },
  {
    label: '类别',
    field: 'materialCategory',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'material_category', placeholder: '请选择类别' },
    // colProps: { span: 6 },
  },
  {
    label: '品牌',
    field: 'brand',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'material_brand', placeholder: '请选择品牌' },
    // colProps: { span: 6 },
  },
];

/**
 * 新增/编辑物料 - 表单字段(与 StockMaterial 对齐)
 */
export const formSchema: FormSchema[] = [
  {
    label: '物料名称',
    field: 'materialName',
    component: 'Input',
    componentProps: { placeholder: '请输入物料名称' },
    dynamicRules: () => [{ required: true, message: '请输入物料名称!' }],
  },
  {
    label: '类别',
    field: 'materialCategory',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'material_category', placeholder: '请选择类别' },
    dynamicRules: () => [{ required: true, message: '请选择类别!' }],
  },
  {
    label: '物料编码',
    field: 'materialCode',
    component: 'Input',
    componentProps: { placeholder: '系统自动生成', disabled: true },
    // 编码由 mock 的 generateCode 接口自动生成(正式后端可自行生成)，新增时自动填充、编辑时只读
  },
  {
    label: '品牌',
    field: 'brand',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'material_brand', placeholder: '请选择品牌' },
  },
  {
    label: '型号(规格)',
    field: 'model',
    component: 'Input',
    componentProps: { placeholder: '请输入型号(规格)' },
    dynamicRules: () => [{ required: true, message: '请输入型号(规格)!' }],
  },
  {
    label: '基准单价',
    field: 'unitPrice',
    component: 'InputNumber',
    componentProps: { placeholder: '请输入基准单位单价', min: 0, precision: 2, style: { width: '100%' } },
  },
  {
    label: '安全库存',
    field: 'safetyStock',
    component: 'InputNumber',
    componentProps: { placeholder: '请输入安全库存', min: 0, style: { width: '100%' } },
  },
  {
    label: '初始库存',
    field: 'stockQty',
    component: 'InputNumber',
    componentProps: { placeholder: '请输入初始库存(基准单位)', min: 0, style: { width: '100%' } },
    // 新增时可填初始库存；编辑时由页面动态禁用(库存变动统一走「出入库」)
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 2 },
  },
  // 主键隐藏字段
  {
    label: '',
    field: 'id',
    component: 'Input',
    show: false,
  },
  // 乐观锁版本号(隐藏，编辑时随表单回传)
  {
    label: '',
    field: 'version',
    component: 'InputNumber',
    show: false,
  },
];
