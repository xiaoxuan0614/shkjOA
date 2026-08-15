import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';

/**
 * 车辆状态字典(与设计稿一致)
 */
export const vehicleStatusOptions = [
  { label: '可用', value: '可用' },
  { label: '保养中', value: '保养中' },
  { label: '维修中', value: '维修中' },
  { label: '停用', value: '停用' },
];

/**
 * 负责人选项(后续接用户接口, 先写死)
 */
export const driverOptions = [
  { label: '张三', value: '张三' },
  { label: '李四', value: '李四' },
  { label: '王五', value: '王五' },
];

/**
 * 车辆列表列
 */
export const columns: BasicColumn[] = [
  {
    title: '序号',
    align: 'center',
    dataIndex: 'id',
    width: 70,
  },
  {
    title: '车牌号',
    align: 'center',
    dataIndex: 'plateNo',
  },
  {
    title: '负责人',
    align: 'center',
    dataIndex: 'owner',
  },
  {
    title: '状态',
    align: 'center',
    dataIndex: 'status',
  },
  {
    title: '最近使用时间',
    align: 'center',
    dataIndex: 'lastUseTime',
    customRender: ({ text }) => text || '—',
  },
  {
    title: '最近加油时间',
    align: 'center',
    dataIndex: 'lastFuelTime',
    customRender: ({ text }) => text || '—',
  },
  {
    title: '最近保养时间',
    align: 'center',
    dataIndex: 'lastMaintenanceTime',
    customRender: ({ text }) => text || '—',
  },
];

/**
 * 车辆列表搜索
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '车牌号',
    field: 'plateNo',
    component: 'Input',
    componentProps: { placeholder: '请输入车牌号' },
  },
  {
    label: '负责人',
    field: 'owner',
    component: 'Select',
    componentProps: { options: driverOptions, placeholder: '请选择负责人' },
  },
  {
    label: '状态',
    field: 'status',
    component: 'Select',
    componentProps: { options: vehicleStatusOptions, placeholder: '请选择状态' },
  },
];

/**
 * 车辆新增/编辑弹窗表单(设计稿: 车牌号* / 状态* / 负责人*)
 */
export const formSchema: FormSchema[] = [
  {
    label: '车牌号',
    field: 'plateNo',
    component: 'Input',
    componentProps: { placeholder: '请输入车牌号' },
    dynamicRules: () => [{ required: true, message: '请输入车牌号!' }],
  },
  {
    label: '状态',
    field: 'status',
    component: 'Select',
    componentProps: { options: vehicleStatusOptions, placeholder: '请选择状态' },
    dynamicRules: () => [{ required: true, message: '请选择状态!' }],
  },
  {
    label: '负责人',
    field: 'owner',
    component: 'Select',
    componentProps: { options: driverOptions, placeholder: '请选择负责人' },
    dynamicRules: () => [{ required: true, message: '请选择负责人!' }],
  },
  {
    label: '备注',
    field: 'remark',
    component: 'InputTextArea',
    componentProps: { placeholder: '请输入备注', rows: 3 },
  },
  // 主键隐藏字段
  {
    label: '',
    field: 'id',
    component: 'Input',
    show: false,
  },
];

/* ================= 车辆详情页 - 三类记录列 ================= */

/**
 * 使用(行车)记录列
 * 设计稿: 用车原因 / 驾驶员 / 驾车时间 / 驾驶时长 / 行驶公里 / 目的地 / 操作
 */
export const driveColumns: BasicColumn[] = [
  { title: '用车原因', align: 'center', dataIndex: 'reason' },
  { title: '驾驶员', align: 'center', dataIndex: 'driver' },
  { title: '驾车时间', align: 'center', dataIndex: 'driveTime' },
  { title: '驾驶时长', align: 'center', dataIndex: 'duration' },
  { title: '行驶公里', align: 'center', dataIndex: 'mileage' },
  { title: '目的地', align: 'center', dataIndex: 'destination' },
];

/**
 * 加油记录列
 * 设计稿: 驾驶员 / 加油量 / 金额 / 付款方式 / 加油地点 / 加油时间 / 操作
 */
export const fuelColumns: BasicColumn[] = [
  { title: '驾驶员', align: 'center', dataIndex: 'driver' },
  { title: '加油量', align: 'center', dataIndex: 'fuelAmount' },
  { title: '金额', align: 'center', dataIndex: 'amount' },
  { title: '付款方式', align: 'center', dataIndex: 'payType' },
  { title: '加油地点', align: 'center', dataIndex: 'location' },
  { title: '加油时间', align: 'center', dataIndex: 'fuelTime' },
];

/**
 * 保养记录列
 * 设计稿: 提交人 / 保养日期 / 下次保养时间 / 价格 / 说明 / 保养地点 / 操作
 */
export const maintenanceColumns: BasicColumn[] = [
  { title: '提交人', align: 'center', dataIndex: 'submitBy' },
  { title: '保养日期', align: 'center', dataIndex: 'maintenanceDate' },
  { title: '下次保养时间', align: 'center', dataIndex: 'nextMaintenanceTime' },
  { title: '价格', align: 'center', dataIndex: 'price' },
  { title: '说明', align: 'center', dataIndex: 'remark' },
  { title: '保养地点', align: 'center', dataIndex: 'location' },
];
