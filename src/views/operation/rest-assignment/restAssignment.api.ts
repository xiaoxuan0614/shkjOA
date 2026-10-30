import { defHttp } from '/@/utils/http/axios';
import { resultOf, type Transport } from './restAssignment';
const options={isTransformResponse:false,errorMessageMode:'none' as const};
export const restApi:Transport=async(method,url,data)=>{
  try{return resultOf(await (method==='GET'?defHttp.get({url,params:data},options):defHttp.post({url,params:data},options)));}
  catch(e:any){const body=e?.response?.data;if(body?.success===false)throw Object.assign(new Error(body.message||'请求失败'),{definite:true,errorCode:body.errorCode,code:body.code});throw e;}
};
