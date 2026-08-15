import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import Mock from 'mockjs';

/**
 * 实施管理 mock 接口
 * 前缀: /jeecgboot
 * 接口:
 *   GET /implement/work/list      工序分页列表
 *   GET /implement/work/detail    工序详情(顶部信息, 含延期原因)
 *   GET /implement/log/list       某工序的实施日志分页
 *   GET /implement/log/detail     单条实施日志详情
 */

// 工序状态
const workStatus = ['未开始', '进行中', '已延期', '已完成'];

// 工序列表(墨刀示例数据, 含已延期)
const workList = [
  { id: 1, projectName: '项目1', workName: '调试阶段', owner: '张三', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: 5, status: '进行中' },
  { id: 2, projectName: '项目1', workName: '安装阶段', owner: '张三', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: 5, status: '进行中' },
  { id: 3, projectName: '项目2', workName: '调试阶段', owner: '张三', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: 5, status: '未开始' },
  { id: 4, projectName: '项目2', workName: '安装阶段', owner: '张三', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: -1, status: '已延期', delayReason: '连续下雨无法施工', delayEndTime: '2025-10-28' },
  { id: 5, projectName: '项目3', workName: '调试阶段', owner: '张三', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: -2, status: '已延期', delayReason: '设备未到货', delayEndTime: '2025-10-30' },
  { id: 6, projectName: '项目3', workName: '安装阶段', owner: '李四', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: 0, status: '已完成' },
  { id: 7, projectName: '项目4', workName: '调试阶段', owner: '张三', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: 0, status: '已完成' },
  { id: 8, projectName: '项目5', workName: '调试阶段', owner: '张三', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: 3, status: '未开始' },
  { id: 9, projectName: '项目5', workName: '安装阶段', owner: '张三', planStart: '2025-10-09', planEnd: '2025-10-14', planHours: '48', remainingDays: 3, status: '进行中' },
];

// 各工序的实施日志
function buildLogs(workId: number) {
  const count = workId % 3 + 1;
  return Array.from({ length: count }).map((_, i) => ({
    id: workId * 100 + i + 1,
    workId,
    implementDate: Mock.mock('@date(yyyy-MM-dd)'),
    submitBy: Mock.Random.pick(['张三', '李四', '王五']),
    workHours: `${Mock.Random.integer(1, 8)}h`,
    position: '进闸口',
    content: Mock.Random.pick(['地磅配件', '闸机安装', '系统调试']),
    photos: '',
  }));
}

// 日志详情
function buildLogDetail(id: number) {
  return {
    id,
    workName: '设备调试',
    implementDate: '2025-10-10',
    position: '进闸口',
    workHours: '5h',
    content: '地磅配件',
    owner: '张三',
    outsourcingHours: '3h',
    vehicle: '津K12345',
    vehicleKm: '15km',
    materialBrief: '使用地磅配件 5 件',
    photos: '',
    members: [
      { name: '李四', checkIn: '2025-10-10 09:00:00', checkOut: '2025-10-10 13:00:00', content: '参与调试', score: 15 },
      { name: '王五', checkIn: '2025-10-10 09:00:00', checkOut: '2025-10-10 13:00:00', content: '参与调试', score: 15 },
    ],
  };
}

export default [
  {
    url: `${sysUrl}/implement/work/list`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, workName, status, planStart_begin, planStart_end } = query;
      let data = workList;
      if (workName) data = data.filter((w) => w.workName.indexOf(workName) !== -1);
      if (status) data = data.filter((w) => w.status === status);
      if (planStart_begin && planStart_end) {
        data = data.filter((w) => w.planStart >= planStart_begin && w.planStart <= planStart_end);
      }
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  {
    url: `${sysUrl}/implement/work/detail`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const item = workList.find((w) => String(w.id) === String(query.id)) || workList[0];
      return resultSuccess({ ...item });
    },
  },
  {
    url: `${sysUrl}/implement/log/list`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, workId } = query;
      const list = buildLogs(Number(workId) || 1);
      return resultPageSuccess(pageNo, pageSize, list);
    },
  },
  {
    url: `${sysUrl}/implement/log/detail`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => resultSuccess(buildLogDetail(Number(query.id) || 1)),
  },
] as MockMethod[];
