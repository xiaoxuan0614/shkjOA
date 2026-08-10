import { resultPageSuccess, resultSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import Mock from 'mockjs';

function createList(count = 50) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push(Mock.mock({
      id: i,
      projectid_dictText: 'PROJ-' + i,
      projectname_dictText: '@ctitle(6,10)项目',
      applytype: /采购申请|调拨申请|退货申请/,
      status: /待审核|已通过|已驳回/,
      text: '@cparagraph(1,2)',
      createBy: '@cname',
      createTime: '@datetime',
      sysOrgCode: /技术部|采购部|工程部|运维部|行政部/
    }));
  }
  return list;
}

export default [
  {
    url: `${sysUrl}/material/list`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10 } = query;
      const allData = createList(50);
      return resultPageSuccess(pageNo, pageSize, allData);
    }
  },
  {
    url: `${sysUrl}/material/detail`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { id } = query;
      return resultSuccess(Mock.mock({
        id: id || 1,
        projectid_dictText: 'PROJ-' + id,
        projectname_dictText: '@ctitle(6,10)项目',
        applytype: /采购申请|调拨申请|退货申请/,
        status: /待审核|已通过|已驳回/,
        text: '@cparagraph(1,2)',
        createBy: '@cname',
        createTime: '@datetime',
        sysOrgCode: /技术部|采购部|工程部|运维部|行政部/
      }));
    }
  },
  {
    url: `${sysUrl}/material/delete`,
    method: 'delete',
    response: () => resultSuccess(null, { message: '删除成功' })
  },
  {
    url: `${sysUrl}/material/batchDelete`,
    method: 'post',
    response: () => resultSuccess(null, { message: '批量删除成功' })
  },
  {
    url: `${sysUrl}/material/exportXls`,
    method: 'get',
    response: () => resultSuccess(null)
  },
  {
    url: `${sysUrl}/material/importExcel`,
    method: 'post',
    response: () => resultSuccess(null, { message: '导入成功' })
  }
] as MockMethod[];