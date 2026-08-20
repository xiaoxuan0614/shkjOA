import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';

/**
 * 项目管理 最小 mock(仅覆盖合同签订/审批验证所需)
 * 前缀: /jeecgboot
 *   GET  /project/project/projectPeriodList   项目分期分页列表
 *   GET  /project/project/projectPeriodDetail 项目分期详情
 *   POST /project/period/changeStatus         项目状态流转
 */

// 测试分期(未开始)
const periodStore: Record<string, any> = {
  '2089535920052830209': {
    periodId: '2089535920052830209',
    projectId: '2089535919834726401',
    projectNo: 'XM2089535919780200450',
    projectName: '0818主项目01',
    periodNo: 'YQ2089535919897640961',
    periodName: '0818主项目01一期工程',
    projectType: '1',
    projectLeaderName: '管理员',
    businessAttribute: '2,1',
    involvedProducts: '1,2',
    projectAddress: '天津市滨海新区新港街道京门大道390号华纳公寓',
    longitude: 117.7,
    latitude: 39.03,
    totalProgress: 0,
    status: 'NOT_STARTED',
    contractStatus: 1, // 合同状态: 待审批(由合同 mock 写入; 列表验证用)
    remark: 'mock',
  },
};

// 甲方客户
const customerList = [{ id: '2089535456431243266', customerName: '测试客户01', contactPerson: '刘经理', contactPhone: '18899909812', customerInfo: '333' }];

export default [
  // 甲方客户列表
  {
    url: `${sysUrl}/project/customer/list`,
    timeout: 100,
    method: 'get',
    response: () => resultPageSuccess(1, 1000, customerList),
  },
  // 项目文件库(合同物料清单文件选择)
  {
    url: `${sysUrl}/project/file/list`,
    timeout: 100,
    method: 'get',
    response: () =>
      resultPageSuccess(1, 200, [
        { id: 'file_1', fileName: '合同物料清单-闸口.xlsx', fileId: 'http://mock/合同物料清单-闸口.xlsx', fileType: '合同物料清单' },
        { id: 'file_2', fileName: '闸口设备清单-2026.xlsx', fileId: 'http://mock/闸口设备清单-2026.xlsx', fileType: '' },
        { id: 'file_3', fileName: '辅料清单.xlsx', fileId: 'http://mock/辅料清单.xlsx', fileType: '' },
      ]),
  },
  // 主项目列表
  {
    url: `${sysUrl}/project/project/list`,
    timeout: 100,
    method: 'get',
    response: () => resultPageSuccess(1, 1000, Object.values(periodStore).map((p) => ({ id: p.projectId, projectName: p.projectName }))),
  },
  // 项目分期分页列表
  {
    url: `${sysUrl}/project/project/projectPeriodList`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10 } = query;
      const records = Object.values(periodStore);
      return resultPageSuccess(pageNo, pageSize, records);
    },
  },
  // 项目分期详情(编辑回显)
  {
    url: `${sysUrl}/project/project/projectPeriodDetail`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const p = periodStore[query.periodId];
      return resultSuccess(p || null);
    },
  },
  // 项目状态流转
  {
    url: `${sysUrl}/project/period/status`,
    timeout: 200,
    method: 'post',
    response: ({ body }) => {
      const { periodId, status } = body;
      if (periodStore[periodId]) {
        periodStore[periodId].status = status;
      }
      return resultSuccess(null, { message: '状态已更新' });
    },
  },
] as MockMethod[];
