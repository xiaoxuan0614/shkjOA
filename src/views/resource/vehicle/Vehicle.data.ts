import type { BasicColumn, FormSchema } from '/@/components/Table';

export const vehicleStatusOptions = ['空闲', '使用中', '保养中'].map((value) => ({ label: value, value }));
export const driveModeOptions = [
  { label: 'GPS 模式', value: 'GPS' },
  { label: '车主模式', value: 'OWNER' },
];
export function getStatusColor(status: string) {
  return ({ 空闲: 'success', 使用中: 'processing', 保养中: 'warning' } as Record<string, string>)[status] || 'default';
}
export const columns: BasicColumn[] = [
  { title: '车牌号', dataIndex: 'plateNumber' },
  { title: '负责人', dataIndex: 'principal' },
  { title: '状态', dataIndex: 'status' },
  ...[
    ['最近使用时间', 'latestUseTime'],
    ['最近加油时间', 'latestRefuelTime'],
    ['最近保养时间', 'latestMaintainTime'],
  ].map(([title, dataIndex]) => ({ title, dataIndex, customRender: ({ text }) => text || '—' })),
];
export const searchFormSchema: FormSchema[] = [
  { label: '车牌号', field: 'plateNumber', component: 'Input' },
  { label: '负责人', field: 'principal', component: 'Input' },
  { label: '状态', field: 'status', component: 'Select', componentProps: { options: vehicleStatusOptions, allowClear: true } },
];
export const formSchema: FormSchema[] = [
  { label: '车牌号', field: 'plateNumber', component: 'Input', rules: [{ required: true, whitespace: true, message: '请输入车牌号' }] },
  {
    label: '负责人',
    field: 'principal',
    component: 'Input',
    componentProps: { placeholder: '请输入负责人姓名' },
    rules: [{ required: true, whitespace: true, message: '请输入负责人姓名' }],
  },
  { label: '行车模式', field: 'driveMode', component: 'Select', componentProps: { options: driveModeOptions } },
  { label: '当前里程', field: 'currentMileage', component: 'InputNumber', componentProps: { min: 0, addonAfter: '公里', style: { width: '100%' } } },
  { label: '', field: 'vehicleId', component: 'Input', show: false },
];
export const driveColumns: BasicColumn[] = [
  { title: '用车原因', dataIndex: 'useReason' },
  { title: '驾驶员', dataIndex: 'driver' },
  { title: '开始时间', dataIndex: 'driveStartTime' },
  { title: '结束时间', dataIndex: 'driveEndTime' },
  { title: '驾驶时长', dataIndex: 'driveDuration' },
  { title: '行驶公里', dataIndex: 'mileage' },
  { title: '目的地', dataIndex: 'destination' },
];
export const fuelColumns: BasicColumn[] = [
  { title: '驾驶员', dataIndex: 'driver' },
  { title: '加油量（升）', dataIndex: 'refuelLiter' },
  { title: '金额', dataIndex: 'amount' },
  { title: '付款方式', dataIndex: 'payType' },
  { title: '加油地点', dataIndex: 'refuelAddress' },
  { title: '加油时间', dataIndex: 'refuelTime' },
];
export const maintenanceColumns: BasicColumn[] = [
  { title: '提交人', dataIndex: 'submitter' },
  { title: '保养日期', dataIndex: 'maintainDate' },
  { title: '下次保养时间', dataIndex: 'nextMaintainDate' },
  { title: '价格', dataIndex: 'price' },
  { title: '说明', dataIndex: 'remark' },
  { title: '保养地点', dataIndex: 'maintainAddress' },
];
