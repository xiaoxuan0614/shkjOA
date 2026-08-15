import { resultSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import Mock from 'mockjs';

/**
 * 项目详情(8-tab)相关 mock 接口
 * 前缀: /jeecgboot
 * 接口:
 *   GET /project/detail/plan           计划方案(实施计划/进度安排/人员配置)
 *   GET /project/detail/member         项目成员
 *   GET /project/detail/position       实施位置
 *   GET /project/detail/implement      实施记录
 *   GET /project/detail/implement/log  实施记录-查看日志
 *   GET /project/detail/acceptance     验收记录
 *   GET /project/detail/file           项目文件
 *   GET /project/detail/material       用料清单
 *   GET /project/detail/activity       项目动态(右侧时间线)
 * 注意: /project/detail(基本信息)在 project.ts 中返回真实列表项
 */

// 项目基本信息
const project = {
  id: 1,
  projectNo: 'XM000001',
  projectName: '天津港智能化闸口建设项目',
  mainProjectName: '天津港智能化闸口建设项目',
  projectType: '软硬件一体化',
  customerName: '天津港航智能科技有限公司',
  contact: '李经理',
  phone: '13800001234',
  manager: '张小刀',
  warranty: '1年',
  contractAmount: 1000000,
  receivedAmount: 100000,
  status: '实施中',
  progress: 50,
  contractDate: '2025-10-10',
  deliverDate: '2025-12-09',
  address: '天津市滨海新区XX路101号',
  requirement: '本项目为天津港智能闸口系统建设，包含车牌识别、箱号识别、地磅对接等模块。',
  attachment: '需求文档.docx',
  remark: '项目备注信息',
};

// 计划方案
const plan = {
  implementStart: '2025-10-10',
  implementEnd: '2025-10-24',
  totalHours: '100h',
  planDoc: '实施计划.docx',
  remark: '备注信息',
  owner: '张经理',
  participants: '张三、李四、王五',
  outsourcingUnit: '天津外协单位有限公司',
  outsourcingCount: '3人',
  outsourcingHours: '20h',
  schedule: [
    { seq: 1, workName: '安装阶段', owner: '张三', startTime: '2025-10-10', endTime: '2025-10-18', hours: '100h' },
    { seq: 2, workName: '调试阶段', owner: '张三', startTime: '2025-10-12', endTime: '2025-10-24', hours: '100h' },
  ],
};

// 项目成员
const members = [
  { id: 1, name: '张经理', role: '项目负责人' },
  { id: 2, name: '陈经理', role: '现场负责人' },
  { id: 3, name: '李四', role: '参与人员' },
  { id: 4, name: '王五', role: '验收负责人' },
];

// 实施位置
const positions = [
  { id: 1, name: '进闸口', lng: '116.103', lat: '24.27', description: '入口闸机位置' },
  { id: 2, name: '出闸口', lng: '116.105', lat: '24.28', description: '出口闸机位置' },
];

// 实施记录
const implementRecords = [
  {
    id: 1,
    workName: '调试阶段',
    owner: '张三',
    planStart: '2025-10-11',
    planEnd: '2025-10-15',
    planHours: '48h',
    remainingDays: '4天',
    status: '未开始',
  },
  {
    id: 2,
    workName: '安装阶段',
    owner: '张三',
    planStart: '2025-10-09',
    planEnd: '2025-10-14',
    planHours: '120h',
    remainingDays: '3天',
    status: '进行中',
  },
];

// 实施日志(查看日志弹窗)
function buildLog(id: number) {
  return {
    id,
    workName: '调试阶段',
    owner: '张三',
    implementDate: '2025-10-10',
    workHours: '5h',
    position: '进闸口',
    submitBy: '张三',
    photos: '',
    vehicle: '津K12345',
    vehicleKm: '15km',
    materialBrief: '使用地磅配件 5 件',
    timeline: [
      { content: '张三 提交了调试阶段实施记录，工时 5h，实施位置进闸口', time: '2025-10-10 10:00:00' },
      { content: '张三 修改了实施记录，工时调整为 5h', time: '2025-10-10 11:00:00' },
      { content: '李四 补充了现场照片', time: '2025-10-10 12:00:00' },
    ],
    members: [
      { name: '李四', checkIn: '2025-10-10 09:00:00', checkOut: '2025-10-10 13:00:00', content: '参与调试', score: 15 },
      { name: '王五', checkIn: '2025-10-10 09:00:00', checkOut: '2025-10-10 13:00:00', content: '参与调试', score: 15 },
    ],
  };
}

// 验收记录(含内部验收；保存接口只改对象属性，用 const 即可)
const acceptance = {
  // ---- 正式验收 ----
  acceptanceDate: '2025-12-10',
  completeDate: '2025-11-30',
  unitOwner: '张经理',
  unitPhone: '1231231122',
  acceptOwner: '陈经理',
  status: '已验收',
  completionReport: '竣工报告.docx',
  acceptanceDoc: '验收单.docx',
  // ---- 内部验收(实施完成→验收完成 之间，上传照片+填写内部验收负责人) ----
  internalOwner: '李四', // 内部验收负责人
  internalDate: '2025-11-18', // 内部验收日期
  internalPhotos: '', // 内部验收照片(逗号分隔的地址/dataURL)
};

// 项目文件
const files = [
  { id: 1, fileType: '实施方案', fileName: '实施方案.docx', createBy: '陈经理', createTime: '2025-10-09 18:00:00' },
  { id: 2, fileType: '技术方案', fileName: '技术方案.pdf', createBy: '小刘', createTime: '2025-10-09 18:00:00' },
  { id: 3, fileType: '施工方案', fileName: '施工图纸.dwg', createBy: '张三', createTime: '2025-10-09 18:00:00' },
];

// 用料清单
const materials = [
  { category: '智能闸口', name: '箱号识别摄像头', brand: '研华', model: 'V8312', unit: '个', purchaseQty: 1, planQty: 1, actualQty: 1 },
  { category: '智能闸口', name: '车牌识别摄像头', brand: '定制', model: 'V8312', unit: '个', purchaseQty: 2, planQty: 2, actualQty: 2 },
  { category: '智能闸口', name: '补光灯', brand: '国产', model: 'V8312', unit: '台', purchaseQty: 3, planQty: 3, actualQty: 3 },
  { category: '地磅配件', name: '壁挂主机', brand: '霍尼韦尔', model: '8525', unit: '台', purchaseQty: 1, planQty: 1, actualQty: 1 },
  { category: '材料类', name: '21寸高亮显示触摸屏', brand: '国产', model: 'V8312', unit: '个', purchaseQty: 1, planQty: 1, actualQty: 1 },
  { category: '其他小件', name: '小票打印机', brand: '明睿达', model: '8525', unit: '台', purchaseQty: 1, planQty: 1, actualQty: 1 },
];

// 项目动态
const activities = [
  { content: '张三 新增了项目【天津港智能化闸口建设项目】', time: '2025-10-10 10:00:00' },
  { content: '张三 提交了方案【实施计划方案】', time: '2025-10-10 10:00:00' },
  { content: '张经理 提交的方案【实施计划方案】审批通过', time: '2025-10-10 10:00:00' },
  { content: '张三 提交了合同', time: '2025-10-10 10:00:00' },
  { content: '张小刀 提交的合同审批通过', time: '2025-10-10 10:00:00' },
  { content: '张小刀 新增了项目工序【安装阶段】', time: '2025-10-10 10:00:00' },
  { content: '张三 新增了实施日志', time: '2025-10-10 10:00:00' },
  { content: '张小刀 新增了实施位置', time: '2025-10-10 10:00:00' },
];

export default [
  { url: `${sysUrl}/project/detail/plan`, timeout: 200, method: 'get', response: () => resultSuccess({ ...plan }) },
  { url: `${sysUrl}/project/detail/member`, timeout: 200, method: 'get', response: () => resultSuccess(members) },
  { url: `${sysUrl}/project/detail/position`, timeout: 200, method: 'get', response: () => resultSuccess(positions) },
  { url: `${sysUrl}/project/detail/implement`, timeout: 200, method: 'get', response: () => resultSuccess(implementRecords) },
  {
    url: `${sysUrl}/project/detail/implement/log`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => resultSuccess(buildLog(Number(query.id) || 1)),
  },
  { url: `${sysUrl}/project/detail/acceptance`, timeout: 200, method: 'get', response: () => resultSuccess({ ...acceptance }) },
  // 保存内部验收信息(负责人/日期/照片)
  {
    url: `${sysUrl}/project/detail/acceptance/save`,
    timeout: 200,
    method: 'post',
    response: ({ body }) => {
      const { internalOwner, internalDate, internalPhotos } = body;
      if (internalOwner !== undefined) acceptance.internalOwner = internalOwner;
      if (internalDate !== undefined) acceptance.internalDate = internalDate;
      if (internalPhotos !== undefined) acceptance.internalPhotos = internalPhotos;
      return resultSuccess(null, { message: '内部验收信息保存成功' });
    },
  },
  { url: `${sysUrl}/project/detail/file`, timeout: 200, method: 'get', response: () => resultSuccess(files) },
  { url: `${sysUrl}/project/detail/material`, timeout: 200, method: 'get', response: () => resultSuccess(materials) },
  { url: `${sysUrl}/project/detail/activity`, timeout: 200, method: 'get', response: () => resultSuccess(activities) },
] as MockMethod[];
