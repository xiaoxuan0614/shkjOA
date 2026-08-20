import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import Mock from 'mockjs';

/**
 * 外协单位相关 mock 接口
 * 前缀: /jeecgboot
 * 对齐 apifox /project/outsourcingUnit(OaOutsourcingUnit):
 *   GET    /project/outsourcingUnit/list         分页列表(unitCode/unitName/status)
 *   POST   /project/outsourcingUnit/add          新增(unitCode 自动生成 WX0001)
 *   POST   /project/outsourcingUnit/edit         修改
 *   GET    /project/outsourcingUnit/queryById    详情(query: id)
 *   DELETE /project/outsourcingUnit/delete       删除(query: id)
 *   DELETE /project/outsourcingUnit/deleteBatch  批量删除(query: ids, 逗号分隔)
 */

// 外协单位名称样例
const unitNames = [
  '天津恒信外包服务有限公司',
  '天津华诚机电安装工程有限公司',
  '北京中联达信息技术有限公司',
  '天津亿鑫建筑工程有限公司',
  '山东鲁能安装服务有限公司',
  '天津港信电子科技有限公司',
];

// 编号生成(WX + 4位数字)
let unitSeq = 0;
function genUnitCode() {
  unitSeq += 1;
  return `WX${String(unitSeq).padStart(4, '0')}`;
}

function createUnitList(count = unitNames.length) {
  return Array.from({ length: count }).map((_, i) => {
    const idx = i + 1;
    return {
      id: idx,
      unitCode: `WX${String(idx).padStart(4, '0')}`,
      unitName: unitNames[i % unitNames.length],
      type: Mock.Random.pick(['单位', '单位', '个人']),
      contactPerson: Mock.Random.pick(['张伟', '李娜', '王强', '刘洋', '陈静']),
      contactPhone: `1${Mock.Random.pick(['3', '5', '7', '8', '9'])}${Mock.Random.string('number', 9)}`,
      address: Mock.Random.pick(['天津市滨海新区', '天津市和平区', '北京市朝阳区', '山东省青岛市']),
      invoiceTitle: '测试科技有限公司',
      invoiceTaxNo: Mock.Random.string('number', 18),
      invoiceBank: '中国工商银行天津分行',
      invoiceAccount: Mock.Random.string('number', 16),
      invoiceAddress: '天津市滨海新区',
      invoicePhone: '022-12345678',
      status: Mock.Random.pick([0, 0, 1]),
      remark: Mock.Random.csentence(5, 12),
      createTime: Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)'),
    };
  });
}

let unitList = createUnitList();
unitSeq = unitList.length;

export default [
  // 外协单位分页列表
  {
    url: `${sysUrl}/project/outsourcingUnit/list`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, unitCode, unitName, status } = query;
      let data = unitList;
      if (unitCode) data = data.filter((u) => u.unitCode.indexOf(unitCode) !== -1);
      if (unitName) data = data.filter((u) => u.unitName.indexOf(unitName) !== -1);
      if (status !== undefined && status !== '') data = data.filter((u) => String(u.status) === String(status));
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  // 新增外协单位(unitCode 自动生成)
  {
    url: `${sysUrl}/project/outsourcingUnit/add`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      const newItem = {
        ...body,
        id: unitList.length + 1,
        unitCode: genUnitCode(),
        createTime: Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)'),
      };
      unitList.unshift(newItem);
      return resultSuccess(newItem, { message: '新增成功' });
    },
  },
  // 编辑外协单位
  {
    url: `${sysUrl}/project/outsourcingUnit/edit`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      const idx = unitList.findIndex((u) => String(u.id) === String(body.id));
      if (idx !== -1) {
        unitList[idx] = { ...unitList[idx], ...body };
      }
      return resultSuccess(null, { message: '编辑成功' });
    },
  },
  // 外协单位详情
  {
    url: `${sysUrl}/project/outsourcingUnit/queryById`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const item = unitList.find((u) => String(u.id) === String(query.id));
      return resultSuccess(item || null);
    },
  },
  // 删除单个
  {
    url: `${sysUrl}/project/outsourcingUnit/delete`,
    timeout: 300,
    method: 'delete',
    response: ({ query }) => {
      unitList = unitList.filter((u) => String(u.id) !== String(query.id));
      return resultSuccess(null, { message: '删除成功' });
    },
  },
  // 批量删除(query: ids, 逗号分隔)
  {
    url: `${sysUrl}/project/outsourcingUnit/deleteBatch`,
    timeout: 300,
    method: 'delete',
    response: ({ query }) => {
      const ids = (query.ids || '').split(',').map(String);
      unitList = unitList.filter((u) => !ids.includes(String(u.id)));
      return resultSuccess(null, { message: '删除成功' });
    },
  },
] as MockMethod[];
