import { resultSuccess, resultPageSuccess, sysUrl } from '../_util';
import { MockMethod } from 'vite-plugin-mock';
import Mock from 'mockjs';

/**
 * 车辆管理相关 mock 接口
 * 前缀: /jeecgboot
 * 接口:
 *   GET  /resource/vehicle/list           车辆分页列表
 *   GET  /resource/vehicle/queryById      车辆详情(详情页头部/编辑回显)
 *   POST /resource/vehicle/add            新增车辆
 *   POST /resource/vehicle/edit           编辑车辆
 *   DELETE /resource/vehicle/delete       删除单个
 *   DELETE /resource/vehicle/deleteBatch  批量删除
 *   GET  /resource/vehicle/drive/list     使用(行车)记录分页
 *   GET  /resource/vehicle/fuel/list      加油记录分页
 *   GET  /resource/vehicle/maintenance/list 保养记录分页
 */

// 车辆状态
const vehicleStatus = ['可用', '保养中', '维修中', '停用'];
const drivers = ['张三', '李四', '王五'];

// 生成车辆列表
function createVehicleList(count = 8) {
  return Array.from({ length: count }).map((_, i) => {
    const idx = i + 1;
    return {
      id: idx,
      plateNo: `津${Mock.Random.pick(['A', 'B', 'C'])}${Mock.Random.string('number', 5)}`,
      owner: drivers[idx % drivers.length],
      status: vehicleStatus[idx % vehicleStatus.length],
      remark: Mock.Random.csentence(6, 14),
      lastUseTime: Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)'),
      lastFuelTime: idx % 2 === 0 ? Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)') : '',
      lastMaintenanceTime: idx % 3 === 0 ? Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)') : '',
      createTime: Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)'),
    };
  });
}

let vehicleList = createVehicleList(8);

// 生成某车辆的三类记录
function createRecords(vehicleId: number) {
  const drive = Array.from({ length: 8 }).map((_, i) => ({
    id: vehicleId * 100 + i + 1,
    vehicleId,
    reason: Mock.Random.pick(['出差', '送货', '巡检', '客户拜访']),
    driver: drivers[i % drivers.length],
    driveTime: Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)'),
    duration: `${Mock.Random.integer(1, 48)}h`,
    mileage: `${Mock.Random.integer(10, 500)}km`,
    destination: Mock.Random.pick(['天津港', '大连', '北京', '青岛']),
    photos: '',
  }));
  const fuel = Array.from({ length: 6 }).map((_, i) => ({
    id: vehicleId * 1000 + i + 1,
    vehicleId,
    driver: drivers[i % drivers.length],
    fuelAmount: `${Mock.Random.integer(20, 60)}L`,
    amount: `${Mock.Random.integer(100, 500)}元`,
    payType: Mock.Random.pick(['加油主卡', '加油副卡', '自费']),
    location: '天津市滨海新区保税区',
    fuelTime: Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)'),
    photos: '',
  }));
  const maintenance = Array.from({ length: 5 }).map((_, i) => ({
    id: vehicleId * 10000 + i + 1,
    vehicleId,
    submitBy: drivers[i % drivers.length],
    maintenanceDate: Mock.mock('@date(yyyy-MM-dd)'),
    nextMaintenanceTime: Mock.mock('@date(yyyy-MM-dd)'),
    price: `${Mock.Random.integer(200, 2000)}元`,
    remark: Mock.Random.csentence(5, 12),
    location: '天津市滨海新区保养厂',
    photos: '',
  }));
  return { drive, fuel, maintenance };
}

// 预生成各车辆记录
const recordMap: Recordable = {};
vehicleList.forEach((v) => {
  recordMap[v.id] = createRecords(v.id);
});

// 简单分页
function paginate(list: any[], pageNo: number, pageSize: number) {
  const start = (pageNo - 1) * pageSize;
  return {
    records: list.slice(start, start + pageSize),
    total: list.length,
  };
}

export default [
  // 车辆分页列表
  {
    url: `${sysUrl}/resource/vehicle/list`,
    timeout: 300,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, plateNo, owner, status } = query;
      let data = vehicleList;
      if (plateNo) data = data.filter((v) => v.plateNo.indexOf(plateNo) !== -1);
      if (owner) data = data.filter((v) => v.owner === owner);
      if (status) data = data.filter((v) => v.status === status);
      return resultPageSuccess(pageNo, pageSize, data);
    },
  },
  // 车辆详情
  {
    url: `${sysUrl}/resource/vehicle/queryById`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const item = vehicleList.find((v) => String(v.id) === String(query.id)) || vehicleList[0];
      return resultSuccess({ ...item });
    },
  },
  // 新增车辆
  {
    url: `${sysUrl}/resource/vehicle/add`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      const newItem = {
        ...body,
        id: vehicleList.length + 1,
        lastUseTime: '',
        lastFuelTime: '',
        lastMaintenanceTime: '',
        createTime: Mock.mock('@datetime(yyyy-MM-dd HH:mm:ss)'),
      };
      vehicleList.unshift(newItem);
      recordMap[newItem.id] = createRecords(newItem.id);
      return resultSuccess(newItem, { message: '新增成功' });
    },
  },
  // 编辑车辆
  {
    url: `${sysUrl}/resource/vehicle/edit`,
    timeout: 300,
    method: 'post',
    response: ({ body }) => {
      const idx = vehicleList.findIndex((v) => String(v.id) === String(body.id));
      if (idx !== -1) {
        vehicleList[idx] = { ...vehicleList[idx], ...body };
      }
      return resultSuccess(null, { message: '编辑成功' });
    },
  },
  // 删除单个
  {
    url: `${sysUrl}/resource/vehicle/delete`,
    timeout: 300,
    method: 'delete',
    response: ({ query }) => {
      vehicleList = vehicleList.filter((v) => String(v.id) !== String(query.id));
      return resultSuccess(null, { message: '删除成功' });
    },
  },
  // 批量删除
  {
    url: `${sysUrl}/resource/vehicle/deleteBatch`,
    timeout: 300,
    method: 'delete',
    response: ({ data }) => {
      const ids = (data?.ids || []).map(String);
      vehicleList = vehicleList.filter((v) => !ids.includes(String(v.id)));
      return resultSuccess(null, { message: '删除成功' });
    },
  },
  // 使用(行车)记录分页
  {
    url: `${sysUrl}/resource/vehicle/drive/list`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, vehicleId, keyword, date_begin, date_end } = query;
      let list = recordMap[vehicleId]?.drive || [];
      if (keyword) list = list.filter((r) => r.reason.indexOf(keyword) !== -1 || r.driver.indexOf(keyword) !== -1);
      if (date_begin && date_end) list = list.filter((r) => r.driveTime >= date_begin && r.driveTime <= date_end + ' 23:59:59');
      const { records, total } = paginate(list, pageNo, pageSize);
      return resultSuccess({ records, total });
    },
  },
  // 加油记录分页
  {
    url: `${sysUrl}/resource/vehicle/fuel/list`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, vehicleId, keyword, date_begin, date_end } = query;
      let list = recordMap[vehicleId]?.fuel || [];
      if (keyword) list = list.filter((r) => r.driver.indexOf(keyword) !== -1);
      if (date_begin && date_end) list = list.filter((r) => r.fuelTime >= date_begin && r.fuelTime <= date_end + ' 23:59:59');
      const { records, total } = paginate(list, pageNo, pageSize);
      return resultSuccess({ records, total });
    },
  },
  // 保养记录分页
  {
    url: `${sysUrl}/resource/vehicle/maintenance/list`,
    timeout: 200,
    method: 'get',
    response: ({ query }) => {
      const { pageNo = 1, pageSize = 10, vehicleId, keyword, date_begin, date_end } = query;
      let list = recordMap[vehicleId]?.maintenance || [];
      if (keyword) list = list.filter((r) => r.submitBy.indexOf(keyword) !== -1);
      if (date_begin && date_end) list = list.filter((r) => r.maintenanceDate >= date_begin && r.maintenanceDate <= date_end);
      const { records, total } = paginate(list, pageNo, pageSize);
      return resultSuccess({ records, total });
    },
  },
] as MockMethod[];
