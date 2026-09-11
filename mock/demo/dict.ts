import { resultSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';

/**
 * 数据字典 mock(开发/mock 模式用; 正式环境由后端 sys_dict 提供)
 * 接口: GET /sys/dict/getDictItems/{code}
 * 返回格式: [{ value, text, color? }]
 */
const dictStore: Record<string, { value: string; text: string; color?: string }[]> = {
  // 通用审批状态：计划方案、合同、项目用料、项目延期、出入库申请及明细
  approval_status: [
    { value: '-1', text: '待提交', color: 'default' },
    { value: '0', text: '驳回', color: 'error' },
    { value: '1', text: '审核通过', color: 'success' },
    { value: '2', text: '待审批', color: 'gold' },
    { value: '3', text: '已撤回', color: 'default' },
  ],
  // 系统待办类型
  todo_type: [
    { value: 'PROJECT_MEMBER_INVITATION', text: '项目成员邀请', color: '#13c2c2' },
    { value: 'PROJECT_PLAN_APPROVAL', text: '项目计划方案审批', color: '#1677ff' },
    { value: 'PROJECT_CONTRACT_APPROVAL', text: '项目合同审批', color: '#722ed1' },
    { value: 'PROJECT_MATERIAL_APPLY_APPROVAL', text: '项目用料申请审批', color: '#fa8c16' },
    { value: 'PROJECT_DELAY_APPROVAL', text: '项目延期审批', color: '#faad14' },
    { value: 'PROJECT_REWORK_APPROVAL', text: '项目返工审批', color: '#fa541c' },
    { value: 'PROJECT_INTERNAL_ACCEPTANCE', text: '项目内部验收', color: '#08979c' },
    { value: 'PROJECT_EXTERNAL_ACCEPTANCE', text: '项目外部验收', color: '#531dab' },
    { value: 'STOCK_OUT_APPROVAL', text: '出库申请审批', color: '#2f54eb' },
    { value: 'STOCK_OUT_EXECUTE', text: '出库执行待办，等待库管出库', color: '#52c41a' },
  ],
  // 合同类型
  contract_type: [
    { value: '项目合同', text: '项目合同' },
    { value: '维保合同', text: '维保合同' },
    { value: '无合同', text: '无合同' },
  ],
  // 外协单位状态: 0启用 / 1停用
  outsourcing_status: [
    { value: '0', text: '启用', color: 'success' },
    { value: '1', text: '停用', color: 'error' },
  ],
  // 外协单位类型: 0个人 / 1企业
  outsourcing_type: [
    { value: '0', text: '个人' },
    { value: '1', text: '企业' },
  ],
  // 回款项
  payback_node: [
    { value: '预付款', text: '预付款' },
    { value: '到货款', text: '到货款' },
    { value: '验收款', text: '验收款' },
    { value: '质保金', text: '质保金' },
    { value: '尾款', text: '尾款' },
    { value: '全款', text: '全款' },
  ],
  // 邀请状态: 0拒绝 / 1接受 / 其他待接受
  invite_status: [
    { value: '0', text: '拒绝', color: 'error' },
    { value: '1', text: '接受', color: 'success' },
    { value: '2', text: '待接受', color: 'processing' },
  ],
  // 项目用料候选清单状态
  project_material_candidate_status: [
    { value: '-1', text: '草稿', color: 'orange' },
    { value: '0', text: '驳回', color: 'error' },
    { value: '1', text: '通过', color: 'success' },
    { value: '2', text: '待处理（已提交）', color: 'processing' },
    { value: '3', text: '已采用', color: 'success' },
    { value: '4', text: '已作废', color: 'default' },
  ],
  // 参与人员角色：页面严格展示该字典配置的全部角色。
  member_role: [
    { value: '0', text: '项目负责人' },
    { value: '1', text: '现场负责人' },
    { value: '2', text: '技术负责人' },
    { value: '3', text: '施工人员' },
    { value: '4', text: '安全员' },
  ],
  // 工序名称
  work_type: [
    { value: '施工', text: '施工' },
    { value: '调试', text: '调试' },
  ],
  // 回款类型
  payback_type: [
    { value: '预付款', text: '预付款' },
    { value: '到货款', text: '到货款' },
    { value: '验收款', text: '验收款' },
    { value: '质保金', text: '质保金' },
    { value: '尾款', text: '尾款' },
  ],
  // 项目类型(value 为编码, 与后端存量一致)
  project_type: [
    { value: '1', text: '纯软件' },
    { value: '2', text: '纯硬件' },
    { value: '3', text: '软硬件一体化' },
  ],
  // 业务属性(value 为编码, 与后端存量一致)
  project_business_attr: [
    { value: '1', text: '新建建设' },
    { value: '2', text: '改造升级' },
    { value: '3', text: '维保服务' },
    { value: '4', text: '故障维修' },
    { value: '5', text: '备件供货' },
  ],
  // 涉及产品清单(value 为编码, 与后端存量一致)
  project_products: [
    { value: '1', text: '铅封机' },
    { value: '2', text: '智能闸口' },
    { value: '3', text: '定制系统' },
    { value: '4', text: '货代系统' },
    { value: '5', text: 'PDA' },
    { value: '6', text: '打印机' },
  ],
  // 项目分期状态
  project_period_status: [
    { value: 'NOT_STARTED', text: '未开始', color: 'default' },
    { value: 'PREPARING', text: '筹备中', color: 'gold' },
    { value: 'PENDING_APPROVAL', text: '待审批', color: 'processing' },
    { value: 'IMPLEMENTING', text: '实施中', color: 'blue' },
    { value: 'DEBUG_COMPLETED', text: '调试完成', color: 'cyan' },
    { value: 'IMPLEMENT_COMPLETED', text: '实施完成', color: 'blue' },
    { value: 'INTERNAL_ACCEPTING', text: '内部验收中', color: 'geekblue' },
    { value: 'ACCEPTING', text: '验收中', color: 'orange' },
    { value: 'WARRANTY', text: '质保中', color: 'purple' },
    { value: 'COMPLETED', text: '完结', color: 'success' },
    { value: 'CLOSED', text: '关闭', color: 'error' },
  ],
};

export default Object.entries(dictStore).map(([code, items]) => ({
  url: `${sysUrl}/sys/dict/getDictItems/${code}`,
  timeout: 100,
  method: 'get',
  response: () => resultSuccess(items),
})) as MockMethod[];
