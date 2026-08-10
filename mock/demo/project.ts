import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import Mock from 'mockjs';

/**
 * 项目管理相关 mock 接口
 * 前缀: /jeecgboot
 * 接口:
 *   GET  /project/list         项目分页列表
 *   GET  /project/detail       项目详情(编辑回显)
 *   POST /project/add          新增项目
 *   POST /project/edit         编辑项目
 *   GET  /project/customerList 客户信息列表(甲方选择带出)
 *   POST /project/plan/save    保存计划(六标签整体提交)
 */

// 项目状态字典(与列表搜索一致)
const projectStatus = ['未开始', '筹备', '实施中', '待验收', '质保中', '完结', '关闭'];

// 客户信息池(模拟客户信息页面已建好的客户)
const customers = [
  { id: 1, name: '天津港航智能科技有限公司', contact: '张经理', phone: '13800001234', info: '港口智能化系统建设客户，已合作多个智能闸口项目' },
  { id: 2, name: '大连远洋物流有限公司', contact: '李经理', phone: '13800005678', info: '物流园区信息化客户，涉及货代系统与定制系统' },
  { id: 3, name: '锦州鑫三利重工有限公司', contact: '王工', phone: '13800009012', info: '重工行业客户，主要采购铅封机与PDA设备' },
  { id: 4, name: '青岛海信智能设备公司', contact: '赵总', phone: '13800003456', info: '设备集成商客户，批量采购打印机与智能闸口' },
];

// 项目负责人池
const managers = ['张小刀', '李建国', '王海峰', '赵敏'];

// 涉及产品(与前端常量保持一致, 仅用于 mock 展示)
const products = ['铅封机', '智能闸口', '定制系统', '货代系统', 'PDA', '打印机'];

// 项目类型
const projectTypes = ['纯软件', '纯硬件', '软硬件一体化'];

// 生成项目列表
function createProjectList(count = 20) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    const customer = customers[i % customers.length];
    const product = products[i % products.length];
    list.push(
      Mock.mock({
        id: i,
        projectNo: 'XM' + String(100000 + i),
        projectName: customer.name.substring(0, 4) + product + '项目',
        projectType: projectTypes[i % projectTypes.length],
        customerId: customer.id,
        customerName: customer.name,
        manager: managers[i % managers.length],
        status: projectStatus[i % projectStatus.length],
        contractDate: '@date(yyyy-MM-dd)',
      })
    );
  }
  return list;
}

const projectList = createProjectList(20);

export default [
  // 项目分页列表
  {
    url: `${sysUrl}/project/list`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, projectNo, projectName, customerName, projectType, manager, status } = query;
      let data = projectList;
      if (projectNo) data = data.filter((p) => p.projectNo.indexOf(projectNo) !== -1);
      if (projectName) data = data.filter((p) => p.projectName.indexOf(projectName) !== -1);
      if (customerName) data = data.filter((p) => p.customerName.indexOf(customerName) !== -1);
      if (projectType) data = data.filter((p) => p.projectType === projectType);
      if (manager) data = data.filter((p) => p.manager === manager);
      if (status) data = data.filter((p) => p.status === status);
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  // 项目详情
  {
    url: `${sysUrl}/project/detail`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { id } = query;
      const item = projectList.find((p) => String(p.id) === String(id)) || projectList[0];
      return resultSuccess({ ...item });
    },
  },
  // 新增项目
  {
    url: `${sysUrl}/project/add`,
    timeout: 300,
    method: 'post',
    response: () => resultSuccess(null, { message: '新增成功' }),
  },
  // 编辑项目
  {
    url: `${sysUrl}/project/edit`,
    timeout: 300,
    method: 'post',
    response: () => resultSuccess(null, { message: '编辑成功' }),
  },
  // 客户信息列表(甲方选择带出)
  {
    url: `${sysUrl}/project/customerList`,
    timeout: 200,
    method: 'get',
    response: () => resultSuccess(customers),
  },
  // 保存计划(六标签整体提交)
  {
    url: `${sysUrl}/project/plan/save`,
    timeout: 300,
    method: 'post',
    response: () => resultSuccess(null, { message: '计划保存成功' }),
  },
] as MockMethod[];
