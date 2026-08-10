import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import Mock from 'mockjs';

/**
 * 物料申请相关 mock 接口
 * 前缀: /jeecgboot  (与现有 material.ts 一致)
 * 接口:
 *   GET  /material/categoryTree     大类树(抽屉左侧)
 *   GET  /material/selectList       物料选择列表(抽屉表格, 支持筛选/分页)
 *   POST /material/apply/save       保存申请
 *   POST /material/apply/submit     发起申请
 */

// 大类(物料类别)定义, 与大类编码一一对应
const categories = [
  { categoryCode: 'ZN', categoryName: '智能闸口' },
  { categoryCode: 'DB', categoryName: '地磅材料' },
  { categoryCode: 'CL', categoryName: '材料类' },
  { categoryCode: 'QT', categoryName: '其他配件' },
];

// 物料种子数据: 只维护商品级字段, 其余字段由 Mock.js 生成
const materialSeeds = [
  { categoryCode: 'ZN', name: '箱号识别摄像头', model: 'V8312', brand: '研华' },
  { categoryCode: 'ZN', name: '车牌识别摄像头', model: 'V8312', brand: '定制' },
  { categoryCode: 'ZN', name: '补光灯', model: 'V8312', brand: '国产' },
  { categoryCode: 'ZN', name: '激光单元', model: 'V8312', brand: '国产' },
  { categoryCode: 'ZN', name: '串口服务器', model: '8525', brand: '明睿达' },
  { categoryCode: 'ZN', name: '称重传感器', model: 'IPC-HFW8400X', brand: '亚洲视觉' },
  { categoryCode: 'ZN', name: '称重显示仪', model: 'DS-TCG405', brand: '海康威视' },
  { categoryCode: 'ZN', name: '接线盒', model: 'PA-TS', brand: '希尔光学' },
  { categoryCode: 'DB', name: '检定费', model: '3米', brand: '绿联' },
  { categoryCode: 'DB', name: 'USB打印机线', model: '3米', brand: '绿联' },
  { categoryCode: 'DB', name: 'HDMI高清线', model: '1.5米', brand: '绿联' },
  { categoryCode: 'DB', name: 'VGA视频线', model: '1.5米', brand: '束瑞' },
  { categoryCode: 'DB', name: '触屏控制线', model: '定制', brand: '定制' },
  { categoryCode: 'CL', name: '全天候防护罩', model: '定制', brand: '首汇' },
  { categoryCode: 'CL', name: '龙门架', model: '定制', brand: '首汇' },
  { categoryCode: 'CL', name: '防雷器', model: '定制', brand: '国产' },
  { categoryCode: 'CL', name: '光纤收发器', model: '8525', brand: '明睿达' },
  { categoryCode: 'QT', name: '电源适配器', model: '12V2A', brand: '明纬' },
  { categoryCode: 'QT', name: '网线', model: '超五类', brand: '国产' },
  { categoryCode: 'QT', name: '水晶头', model: 'RJ45', brand: '国产' },
];

// 供应商池
const suppliers = [
  { supplierName: '广州智能设备有限公司', supplierCode: 'SUP-1001' },
  { supplierName: '海康威视华南代理', supplierCode: 'SUP-1002' },
  { supplierName: '绿联数码批发', supplierCode: 'SUP-1003' },
  { supplierName: '首汇机电', supplierCode: 'SUP-1004' },
  { supplierName: '明睿达科技', supplierCode: 'SUP-1005' },
];

// 仓库池
const warehouses = [
  { warehouseName: '一号仓库', warehouseCode: 'WH-01' },
  { warehouseName: '二号仓库', warehouseCode: 'WH-02' },
  { warehouseName: '辅材仓库', warehouseCode: 'WH-03' },
];

// 生成物料列表
function createMaterialList(count = 100) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    const seed = materialSeeds[i % materialSeeds.length];
    const category = categories.find((c) => c.categoryCode === seed.categoryCode) || categories[0];
    const supplier = suppliers[i % suppliers.length];
    const warehouse = warehouses[i % warehouses.length];
    list.push(
      Mock.mock({
        id: i,
        categoryCode: seed.categoryCode,
        categoryName: category.categoryName,
        goodsCode: 'GD' + String(1000 + i),
        goodsName: seed.name,
        model: seed.model,
        brand: seed.brand,
        mainUnit: /台|个|米|根|套|条|件/,
        status: /在库|在库|在库|已停用/,
        stock: '@integer(1, 1000)',
        batchNo: 'B' + String(2000 + i),
        price: '@float(50, 2000, 2, 2)',
        warehouseName: warehouse.warehouseName,
        warehouseCode: warehouse.warehouseCode,
        supplierName: supplier.supplierName,
        supplierCode: supplier.supplierCode,
      })
    );
  }
  return list;
}

const materialList = createMaterialList(100);

// 树节点(含物料子节点, 用于抽屉左侧树直接点选物料)
function createCategoryTree() {
  return categories.map((c, idx) => {
    const children = materialList
      .filter((m) => m.categoryCode === c.categoryCode)
      .slice(0, 8)
      .map((m) => ({
        id: m.id,
        title: m.goodsName,
        key: String(m.id),
        categoryCode: c.categoryCode,
        goodsCode: m.goodsCode,
      }));
    return {
      id: 'cat-' + idx,
      title: c.categoryName,
      key: c.categoryCode,
      categoryCode: c.categoryCode,
      children,
    };
  });
}

export default [
  // 大类树
  {
    url: `${sysUrl}/material/categoryTree`,
    timeout: 300,
    method: 'get',
    response: () => resultSuccess(createCategoryTree()),
  },
  // 物料选择列表(抽屉表格)
  {
    url: `${sysUrl}/material/selectList`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, categoryCode, name, model, brand } = query;
      let data = materialList;
      // 大类过滤
      if (categoryCode) {
        data = data.filter((m) => m.categoryCode === categoryCode);
      }
      // 关键字过滤
      if (name) {
        data = data.filter((m) => m.goodsName.indexOf(name) !== -1);
      }
      if (model) {
        data = data.filter((m) => m.model.indexOf(model) !== -1);
      }
      if (brand) {
        data = data.filter((m) => m.brand === brand);
      }
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  // 保存申请
  {
    url: `${sysUrl}/material/apply/save`,
    timeout: 300,
    method: 'post',
    response: () => resultSuccess(null, { message: '保存成功' }),
  },
  // 发起申请
  {
    url: `${sysUrl}/material/apply/submit`,
    timeout: 300,
    method: 'post',
    response: () => resultSuccess(null, { message: '发起申请成功' }),
  },
  // 新增物料(写入物料列表, 抽屉下次即可选中)
  {
    url: `${sysUrl}/material/add`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      const maxId = materialList.reduce((m, item) => Math.max(m, item.id), 0);
      const category = categories.find((c) => c.categoryName === body.categoryName) || categories[0];
      materialList.unshift({
        id: maxId + 1,
        categoryCode: category.categoryCode,
        categoryName: body.categoryName,
        goodsCode: body.goodsCode,
        goodsName: body.goodsName,
        model: body.model || '',
        brand: body.brand || '',
        mainUnit: '台',
        status: '在库',
        stock: body.stock || 0,
        batchNo: 'B' + String(3000 + maxId),
        price: 0,
        warehouseName: '一号仓库',
        warehouseCode: 'WH-01',
        supplierName: '',
        supplierCode: '',
      });
      return resultSuccess(null, { message: '新增物料成功' });
    },
  },
] as MockMethod[];
