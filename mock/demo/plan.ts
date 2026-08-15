import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';

/**
 * 计划方案管理 mock 接口
 * 前缀: /jeecgboot
 * 接口:
 *   GET /plan/project/list      项目分页列表
 *   GET /plan/detail            方案详情(项目信息/实施计划/用料计划/位置信息/回款计划 五合一)
 *   GET /plan/material/list     用料计划(申请清单)
 *   GET /plan/position/list     实施位置
 *   POST /plan/save             保存方案
 */

// 项目列表
const projectList = [
  { id: 1, projectNo: 'XM000001', projectName: 'XXXX智能闸口项目', projectType: '智能闸口', manager: '张小刀', status: '筹备', contractDate: '2025-10-10' },
  { id: 2, projectNo: 'XM000002', projectName: 'XXXX智能闸口项目', projectType: '车载系统', manager: '张小刀', status: '筹备', contractDate: '2025-10-10' },
  { id: 3, projectNo: 'XM000003', projectName: 'XXXX智能闸口项目', projectType: '铅封机', manager: '张小刀', status: '筹备', contractDate: '2025-10-10' },
  { id: 4, projectNo: 'XM000004', projectName: 'XXXX智能闸口项目', projectType: '360环视', manager: '张小刀', status: '实施中', contractDate: '2025-10-10' },
  { id: 5, projectNo: 'XM000005', projectName: 'XXXX智能闸口项目', projectType: '环保', manager: '张小刀', status: '待验收', contractDate: '2025-10-10' },
  { id: 6, projectNo: 'XM000006', projectName: 'XXXX智能闸口项目', projectType: '智能闸口', manager: '张小刀', status: '质保中', contractDate: '2025-10-10' },
];

// 方案详情
const planDetail = {
  projectNo: 'XM000001',
  projectName: 'XXXX智能闸口项目',
  customerName: '海鸥科技有限公司',
  contact: '张小刀',
  phone: '12312312345',
  manager: '张小刀',
  projectType: '智能闸口',
  requirement: '项目需求描述项目需求描述项目需求描述项目需求描述项目需求描述',
  address: '天津市滨海新区保税区域',
  contractType: '项目合同',
  contractAmount: '10000000',
  contractDate: '2025-10-10',
  warranty: '1年',
  plan: {
    owner: '张经理',
    participants: '张三、李四、王五',
    outsourcingUnit: '天津外协单位有限公司',
    outsourcingCount: '3人',
    outsourcingHours: '20h',
    implementStart: '2025-10-10',
    implementEnd: '2025-10-24',
    totalHours: '100h',
    planDoc: '实施计划.docx',
    remark: '我是备注我是备注',
    schedule: [
      { seq: 1, workName: '安装阶段', owner: '张三', startTime: '2025-10-10', endTime: '2025-10-18', hours: '100h' },
      { seq: 2, workName: '调试阶段', owner: '张三', startTime: '2025-10-12', endTime: '2025-10-24', hours: '100h' },
    ],
    positions: [
      { seq: 1, name: '进闸口', lng: 23, lat: 112, description: '我是位置描述' },
      { seq: 2, name: '出闸口', lng: 23, lat: 112, description: '我是位置描述' },
    ],
    paybackPlan: [
      { seq: 1, type: '预付款', amount: 100000, planDate: '2025-10-10' },
      { seq: 2, type: '到货款', amount: 100000, planDate: '2025-10-10' },
      { seq: 3, type: '验收款', amount: 100000, planDate: '2025-10-10' },
      { seq: 4, type: '质保金', amount: 100000, planDate: '2025-10-10' },
      { seq: 5, type: '尾款', amount: 100000, planDate: '2025-10-10' },
    ],
  },
};

// 用料计划(申请清单)
const materialList = [
  { id: 1, category: '智能闸口', name: '称重传感器', brand: '亚洲视觉', model: 'IPC-HFW8400X-AVTSRE4-1T', stock: 99999, applyQty: 3, unit: '个', expressNo: 'SF201420121010' },
  { id: 2, category: '智能闸口', name: '车牌识别摄像头', brand: '定制', model: 'V8312', stock: 50, applyQty: 2, unit: '个', expressNo: 'SF201420121011' },
  { id: 3, category: '材料类', name: '触摸屏', brand: '国产', model: '21寸', stock: 20, applyQty: 1, unit: '台', expressNo: 'SF201420121012' },
];

// 实施位置
const positions = [
  { id: 1, name: '进闸口', lng: 23, lat: 112, description: '我是位置描述' },
  { id: 2, name: '出闸口', lng: 23, lat: 112, description: '我是位置描述' },
];

export default [
  {
    url: `${sysUrl}/plan/project/list`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, projectNo, projectName, projectType, status } = query;
      let data = projectList;
      if (projectNo) data = data.filter((p) => p.projectNo.indexOf(projectNo) !== -1);
      if (projectName) data = data.filter((p) => p.projectName.indexOf(projectName) !== -1);
      if (projectType) data = data.filter((p) => p.projectType === projectType);
      if (status) data = data.filter((p) => p.status === status);
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  {
    url: `${sysUrl}/plan/detail`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const item = projectList.find((p) => String(p.id) === String(query.id)) || projectList[0];
      return resultSuccess({ ...item, ...planDetail, plan: { ...planDetail.plan } });
    },
  },
  {
    url: `${sysUrl}/plan/material/list`,
    timeout: 200,
    method: 'get',
    response: () => resultSuccess(materialList),
  },
  {
    url: `${sysUrl}/plan/position/list`,
    timeout: 200,
    method: 'get',
    response: () => resultSuccess(positions),
  },
  {
    url: `${sysUrl}/plan/save`,
    timeout: 300,
    method: 'post',
    response: () => resultSuccess(null, { message: '方案保存成功' }),
  },
] as MockMethod[];
