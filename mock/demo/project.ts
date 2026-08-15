import { resultSuccess, resultPageSuccess, resultError, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import Mock from 'mockjs';

/**
 * 项目管理相关 mock 接口
 * 前缀: /jeecgboot
 * 接口:
 *   GET  /project/list            项目分页列表
 *   GET  /project/detail          项目详情(编辑回显)
 *   POST /project/add             新增项目
 *   POST /project/edit            编辑项目
 *   GET  /project/customerList    客户信息列表(甲方选择带出)
 *   GET  /project/mainProjectList 主项目列表(创建项目时选择所属主项目)
 *   POST /project/plan/save       保存计划(六标签整体提交)
 */

// 项目状态字典(与列表搜索一致)
// 生命周期: 创建(未开始) → 计划(筹备) → 实施开始(实施中) → 实施完成 → 内部验收 → 客户验收 → 质保中 → 质保结束(完结)；关闭为例外终态
const projectStatus = ['未开始', '筹备', '实施中', '实施完成', '内部验收', '客户验收', '质保中', '完结', '关闭'];

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

// 生成项目列表(含主项目 + 期项目两层结构)
function createProjectList(count = 6) {
  const list = [];
  let id = 1;
  for (let i = 1; i <= count; i++) {
    const customer = customers[i % customers.length];
    const product = products[i % products.length];
    const mainName = customer.name.substring(0, 4) + product + '项目';
    // 主项目(parentId = 0)
    list.push({
      id: id,
      parentId: 0,
      mainProjectName: mainName,
      projectNo: 'XM' + String(100000 + id),
      projectName: mainName,
      projectType: projectTypes[i % projectTypes.length],
      customerId: customer.id,
      customerName: customer.name,
      manager: managers[i % managers.length],
      // 主项目从「未开始」开始(i-1 取模)，保证生命周期全链路可演示
      status: projectStatus[(i - 1) % projectStatus.length],
      contractDate: Mock.mock('@date(yyyy-MM-dd)'),
    });
    id++;
    // 该主项目下挂两期
    for (let j = 1; j <= 2; j++) {
      list.push({
        id: id,
        parentId: id - 1,
        mainProjectName: mainName,
        projectNo: 'XM' + String(100000 + id),
        projectName: `${j === 1 ? '一期' : '二期'}工程`,
        projectType: projectTypes[(i + j) % projectTypes.length],
        customerId: customer.id,
        customerName: customer.name,
        manager: managers[(i + j) % managers.length],
        status: projectStatus[(i + j) % projectStatus.length],
        contractDate: Mock.mock('@date(yyyy-MM-dd)'),
      });
      id++;
    }
  }
  return list;
}

// 用 let 以便 mock 接口(新增/编辑)能往内存数组写入
let projectList = createProjectList(6);

export default [
  // 项目分页列表
  {
    url: `${sysUrl}/project/list`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, projectNo, projectName, mainProjectName, customerName, projectType, manager, status } = query;
      let data = projectList;
      if (projectNo) data = data.filter((p) => p.projectNo.indexOf(projectNo) !== -1);
      if (projectName) data = data.filter((p) => p.projectName.indexOf(projectName) !== -1);
      if (mainProjectName) data = data.filter((p) => (p.mainProjectName || '').indexOf(mainProjectName) !== -1);
      if (customerName) data = data.filter((p) => p.customerName.indexOf(customerName) !== -1);
      if (projectType) data = data.filter((p) => p.projectType === projectType);
      if (manager) data = data.filter((p) => p.manager === manager);
      if (status) data = data.filter((p) => p.status === status);
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  // 项目详情
  // 返回真实列表项, 并补充详情页头部/基本信息展示字段
  {
    url: `${sysUrl}/project/detail`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { id } = query;
      const item =
        projectList.find((p) => String(p.id) === String(id)) ||
        projectList[0] || {
          projectNo: 'XM000001',
          projectName: '示例项目',
        };
      return resultSuccess({
        ...item,
        progress: item.progress ?? 50,
        deliverDate: item.deliverDate ?? '2025-12-09',
        receivedAmount: item.receivedAmount ?? 100000,
        warranty: item.warranty ?? '1年',
        contractAmount: item.contractAmount ?? 1000000,
        requirement: item.requirement ?? '',
        address: item.address ?? '',
        attachment: item.attachment ?? '',
      });
    },
  },
  // 新增项目
  {
    url: `${sysUrl}/project/add`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      const newItem = { ...body, id: projectList.length + 1 };
      projectList.unshift(newItem);
      return resultSuccess(newItem, { message: '新增成功' });
    },
  },
  // 编辑项目
  {
    url: `${sysUrl}/project/edit`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      const idx = projectList.findIndex((p) => String(p.id) === String(body.id));
      if (idx !== -1) {
        projectList[idx] = { ...projectList[idx], ...body };
      }
      return resultSuccess(null, { message: '编辑成功' });
    },
  },
  // 客户信息列表(甲方选择带出)
  {
    url: `${sysUrl}/project/customerList`,
    timeout: 200,
    method: 'get',
    response: () => resultSuccess(customers),
  },
  // 主项目列表(创建项目时选择所属主项目)
  {
    url: `${sysUrl}/project/mainProjectList`,
    timeout: 200,
    method: 'get',
    response: () => resultSuccess(projectList.filter((p) => Number(p.parentId) === 0)),
  },
  // 项目分期/项目名称模糊搜索(领料/还料/采购选项目单号↔名称，输入名称带出编号)
  {
    url: `${sysUrl}/project/period/searchByName`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { keyword = '', pageNo = 1, pageSize = 20 } = query;
      let data = projectList;
      if (keyword) data = data.filter((p) => (p.projectName || '').indexOf(keyword) !== -1);
      const list = data.map((p) => ({ periodNo: p.projectNo, periodName: p.projectName }));
      return resultPageSuccess(pageNo, pageSize, list);
    },
  },
  // 状态流转推进：按生命周期顺序推进到下一状态，不能跳步/回退
  {
    url: `${sysUrl}/project/status/advance`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      const { id, targetStatus } = body;
      const item = projectList.find((p) => String(p.id) === String(id));
      if (!item) return resultError('项目不存在');
      const flowMap = {
        未开始: '筹备',
        筹备: '实施中',
        实施中: '实施完成',
        实施完成: '内部验收',
        内部验收: '客户验收',
        客户验收: '质保中',
        质保中: '完结',
      };
      const expect = flowMap[item.status];
      if (!expect) return resultError(`当前状态「${item.status}」无下一状态，无法推进`);
      if (String(targetStatus) !== expect) return resultError(`只能推进到下一状态「${expect}」，不能跳步/回退`);
      item.status = targetStatus;
      return resultSuccess(null, { message: `状态已推进到「${targetStatus}」` });
    },
  },
  // 保存计划(六标签整体提交)
  {
    url: `${sysUrl}/project/plan/save`,
    timeout: 300,
    method: 'post',
    response: () => resultSuccess(null, { message: '计划保存成功' }),
  },
] as MockMethod[];
