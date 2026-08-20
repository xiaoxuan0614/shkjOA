import { resultSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';

/**
 * 数据字典 mock(开发/mock 模式用; 正式环境由后端 sys_dict 提供)
 * 接口: GET /sys/dict/getDictItems/{code}
 * 返回格式: [{ value, text, color? }]
 */
const dictStore: Record<string, { value: string; text: string; color?: string }[]> = {
  // 合同类型
  contract_type: [
    { value: '项目合同', text: '项目合同' },
    { value: '维保合同', text: '维保合同' },
    { value: '无合同', text: '无合同' },
  ],
  // 合同状态: 0驳回 / 1待审批 / 2已通过
  contract_status: [
    { value: '0', text: '驳回', color: 'error' },
    { value: '1', text: '待审批', color: 'gold' },
    { value: '2', text: '已通过', color: 'success' },
  ],
  // 外协单位状态: 0启用 / 1停用
  outsourcing_status: [
    { value: '0', text: '启用', color: 'success' },
    { value: '1', text: '停用', color: 'error' },
  ],
  // 外协单位类型: 个人 / 单位
  outsourcing_type: [
    { value: '单位', text: '单位' },
    { value: '个人', text: '个人' },
  ],
  // 回款节点
  payback_node: [
    { value: '预付款', text: '预付款' },
    { value: '到货款', text: '到货款' },
    { value: '验收款', text: '验收款' },
    { value: '质保金', text: '质保金' },
    { value: '尾款', text: '尾款' },
    { value: '全款', text: '全款' },
  ],
  // 邀请状态: 0待接受 / 1已接收
  invite_status: [
    { value: '0', text: '待接受', color: 'default' },
    { value: '1', text: '已接收', color: 'success' },
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
    { value: 'PENDING_APPROVAL', text: '待立项', color: 'processing' },
    { value: 'IMPLEMENTING', text: '实施中', color: 'blue' },
    { value: 'DEBUG_COMPLETED', text: '调试完成', color: 'cyan' },
    { value: 'IMPLEMENT_COMPLETED', text: '实施完成', color: 'blue' },
    { value: 'INTERNAL_ACCEPTING', text: '内部验收中', color: 'geekblue' },
    { value: 'ACCEPTING', text: '客户验收中', color: 'orange' },
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
