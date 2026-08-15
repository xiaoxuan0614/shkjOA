import { BasicColumn, FormSchema } from '/@/components/Table';

/**
 * 出入库记录 - 列定义 / 搜索
 * 职责：申请出入库(跳转申请页) + 库管审批 + 出入库台账
 */

/**
 * 出入库申请搜索表单
 * 关联单号=项目分期编号(projectNo)
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '申请单号',
    field: 'applyNo',
    component: 'Input',
    componentProps: { placeholder: '请输入申请单号' },
  },
  {
    label: '业务类型',
    field: 'bizType',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'stock_apply_biz_type', placeholder: '请选择业务类型' },
  },
  {
    label: '审批状态',
    field: 'status',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'stock_apply_status', placeholder: '请选择审批状态' },
  },
  {
    label: '关联单号',
    field: 'projectNo',
    component: 'Input',
    componentProps: { placeholder: '请输入关联单号(分期编号)' },
  },
  {
    label: '项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '请输入项目名称' },
  },
];

/**
 * 出入库申请列表列(对齐后端 StockApply：bizType/executeStatus 已补)
 * status 英文码：PENDING 待审批 / PARTIAL_APPROVED 部分通过 / APPROVED 已通过 / REJECTED 已驳回 / WITHDRAWN 已撤回 / CANCELED 已取消
 */
export const applyColumns: BasicColumn[] = [
  {
    title: '申请单号',
    align: 'center',
    dataIndex: 'applyNo',
    width: 150,
  },
  {
    title: '业务类型',
    align: 'center',
    dataIndex: 'bizType',
    width: 90,
  },
  {
    title: '出入库',
    align: 'center',
    dataIndex: 'applyType',
    width: 90,
  },
  {
    title: '申请人',
    align: 'center',
    dataIndex: 'applyUserName',
    width: 100,
  },
  {
    title: '部门',
    align: 'center',
    dataIndex: 'deptName',
    width: 130,
  },
  {
    title: '使用日期',
    align: 'center',
    dataIndex: 'useDate',
    width: 105,
  },
  {
    title: '审批状态',
    align: 'center',
    dataIndex: 'status',
    width: 100,
  },
  {
    title: '执行状态',
    align: 'center',
    dataIndex: 'executeStatus',
    width: 105,
  },
  {
    title: '关联单号',
    align: 'center',
    dataIndex: 'projectNo',
    width: 130,
  },
  {
    title: '项目名称',
    align: 'center',
    dataIndex: 'projectName',
    width: 140,
  },
  {
    title: '备注',
    align: 'center',
    dataIndex: 'remark',
  },
];

/**
 * 出入库台账列(对齐 StockIoRecord)
 * 台账只回 materialId，物料编码/名称由列表包装层按物料主表缓存富化(enrichMaterialInfo)；
 * 来源 sourceType 走数据字典 stock_io_source_type(apply 申请 / manual 手动 / stocktake 盘存)。
 */
export const recordColumns: BasicColumn[] = [
  {
    title: '类型',
    align: 'center',
    dataIndex: 'ioType',
    width: 80,
  },
  {
    title: '物料编码',
    align: 'center',
    dataIndex: 'materialCode',
    width: 130,
  },
  {
    title: '物料名称',
    align: 'center',
    dataIndex: 'materialName',
    width: 160,
  },
  {
    title: '单位',
    align: 'center',
    dataIndex: 'unitName',
    width: 90,
  },
  {
    title: '数量',
    align: 'center',
    dataIndex: 'unitQty',
    width: 90,
  },
  {
    title: '基准数量',
    align: 'center',
    dataIndex: 'baseQty',
    width: 100,
  },
  {
    title: '金额',
    align: 'center',
    dataIndex: 'amount',
    width: 100,
  },
  {
    title: '变动前',
    align: 'center',
    dataIndex: 'beforeQty',
    width: 90,
  },
  {
    title: '变动后',
    align: 'center',
    dataIndex: 'afterQty',
    width: 90,
  },
  {
    title: '来源',
    align: 'center',
    dataIndex: 'sourceType',
    width: 90,
  },
  {
    title: '时间',
    align: 'center',
    dataIndex: 'createTime',
    width: 170,
  },
];
