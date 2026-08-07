import { defHttp } from "/@/utils/http/axios";

enum Api {
  userEdit='/sys/user/login/setting/userEdit',
  getUserData='/sys/user/login/setting/getUserData',
  queryNameByCodes='/sys/position/queryByCodes',
  updateMobile='/sys/user/updateMobile',
  updateUserPassword='/sys/user/passwordChange',
  //更改手机号
  changePhone = '/sys/user/changePhone',
  //用户注销
  userLogOff = '/sys/user/userLogOff',
  //没有绑定手机号用的修改密码请求地址
  updatePasswordNotBindPhone = '/sys/user/updatePasswordNotBindPhone',
}

/**
 * 用户编辑
 * @param params
 */
export const userEdit = (params) => {
  return defHttp.post({ url: Api.userEdit, params },{ isTransformResponse:false });
}

/**
 * 获取用户信息
 * @param params
 */
export const getUserData = () => {
  return defHttp.get({ url: Api.getUserData },{ isTransformResponse:false });
}

/**
 * 获取多个职务信息
 * @param params
 */
export const queryNameByCodes = (params) => {
  return defHttp.get({ url: Api.queryNameByCodes, params },{isTransformResponse:false});
}

/**
 * 修改手机号
 * @param params
 */
export const updateMobile = (params) => {
  return defHttp.put({ url: Api.updateMobile, params },{isTransformResponse:false});
}

/**
 * 修改密码
 * @param params
 */
export const updateUserPassword = (params) => {
  return defHttp.get({ url: Api.updateUserPassword, params },{isTransformResponse:false});
}

/**
 * 修改密码
 * @param params
 */
export const updatePasswordNotBindPhone = (params) => {
  return defHttp.put({ url: Api.updatePasswordNotBindPhone, params },{ isTransformResponse:false, joinParamsToUrl: true });
}

/**
 * 更改手机号
 * @param params
 */
export const changePhone = (params) => {
  return defHttp.put({ url: Api.changePhone, params },{ joinParamsToUrl: true, isTransformResponse: false });
};

/**
 * 用户注销
 * @param params
 */
export const userLogOff = (params) => {
  return defHttp.put({ url: Api.userLogOff, params },{ isTransformResponse:false });
}
