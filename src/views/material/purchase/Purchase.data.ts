import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 采购入库 - 列定义 / 表单
 * ⚠️ 对齐接口文档「采购订单」/project/purchaseOrder：orderNo/projectId/periodId/supplierId/supplierName/orderDate/expectedArrivalDate/totalAmount/status
 */

/** 采购订单列表列 */
export const purchaseColumns: BasicColumn[] = [
  { title: '采购单号', align: 'center', dataIndex: 'orderNo', width: 160 },
  { title: '供应商', align: 'center', dataIndex: 'supplierName', width: 160 },
  { title: '分期项目', align: 'center', dataIndex: 'periodName', width: 140 },
  { title: '下单日期', align: 'center', dataIndex: 'orderDate', width: 110 },
  { title: '总金额', align: 'center', dataIndex: 'totalAmount', width: 110 },
  { title: '状态', align: 'center', dataIndex: 'status', width: 100 },
  { title: '创建人', align: 'center', dataIndex: 'createBy', width: 100 },
  { title: '创建时间', align: 'center', dataIndex: 'createTime', width: 170 },
];

/**
 * 采购订单列表搜索表单
 * orderNo 采购单号(输入) / supplierName 供应商(远程模糊) / periodName 分期项目(远程模糊) / status 状态(数据字典 purchase_order_status)
 * 供应商/分期下拉选项由页面注入(预载首页 + 输入后服务端模糊查询，与 PurchaseModal 一致)
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '采购单号',
    field: 'orderNo',
    component: 'Input',
    componentProps: { placeholder: '请输入采购单号' },
  },
  {
    label: '供应商',
    field: 'supplierName',
    component: 'Select',
    componentProps: {
      placeholder: '选择供应商',
      showSearch: true,
      allowClear: true,
      filterOption: false, // 远程模糊搜索
      options: [], // 页面 onMounted 注入
    },
  },
  {
    label: '分期项目',
    field: 'periodName',
    component: 'Select',
    componentProps: {
      placeholder: '选择分期项目',
      showSearch: true,
      allowClear: true,
      filterOption: false, // 远程模糊搜索
      options: [], // 页面 onMounted 注入
    },
  },
  {
    label: '状态',
    field: 'status',
    component: 'JDictSelectTag',
    componentProps: { dictCode: 'purchase_order_status', placeholder: '请选择状态' },
  },
];

/** 采购订单表单(订单头) */
export const purchaseFormSchema: FormSchema[] = [
  {
    label: '供应商',
    field: 'supplierName',
    component: 'Select',
    componentProps: {
      placeholder: '输入供应商名称模糊搜索',
      showSearch: true,
      allowClear: true,
      options: [], // 输入后模糊加载(PurchaseModal onSearch 注入)
      filterOption: false,
    },
    dynamicRules: () => [{ required: true, message: '请选择供应商!' }],
  },
  {
    label: '分期项目',
    field: 'periodId',
    component: 'Select',
    componentProps: {
      showSearch: true,
      allowClear: true,
      filterOption: false, // 远程模糊搜索
      placeholder: '输入分期项目名称模糊搜索，自动带出编号',
      options: [], // 远程加载(弹窗 onSearch 注入)
    },
    dynamicRules: () => [{ required: true, message: '请选择分期项目!' }],
  },
  {
    label: '项目名称',
    field: 'projectName',
    component: 'Input',
    componentProps: { placeholder: '选择分期项目后自动带出', disabled: true },
  },
  {
    label: '下单日期',
    field: 'orderDate',
    component: 'DatePicker',
    componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择下单日期' },
  },
  {
    label: '预计到货',
    field: 'expectedArrivalDate',
    component: 'DatePicker',
    componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择预计到货日期' },
  },
  {
    label: '采购备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 2 },
  },
];
