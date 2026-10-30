import { reactive, computed, onBeforeUnmount } from 'vue';
import { type Data, type Transport, beijingDate, nextDate, timeRange, assignmentPlan, batchCandidates, requestId, formatTime, reasonText } from './restAssignment';

export function useRestManager(api: Transport, onChanged: ()=>void = ()=>{}) {
  const today=beijingDate();
  const s=reactive({loading:false,busy:false,error:'',message:'',options:null as Data|null,tab:'rest',calendar:null as Data|null,
    form:{userId:'',startDate:today,startTime:'08:00',endDate:today,endTime:'12:00',remark:''},
    preview:null as Data|null,choices:{} as Record<string,string>,selected:[] as string[],batchTarget:'',confirmOpen:false,
    pending:null as {path:string;body:Data;kind:string}|null,uncertain:false,result:null as Data|null,
    history:[] as Data[],historyPage:0,historyTotal:0,historyLoading:false,historyDate:'',historyUser:'',detail:null as Data|null,cancelReason:'',cancelOpen:false,
    schedules:[] as Data[],schedulePage:0,scheduleTotal:0,scanned:0,scheduleLoading:false,scheduleFilter:'WAIT_DISPATCH',scheduleFailures:[] as string[],
    editing:null as Data|null,scheduleForm:{startDate:today,startTime:'09:00',endDate:today,endTime:'10:00',reason:''},scheduleSaving:false,scheduleUncertain:false,
    now:Date.now(),
  });
  let alive=true,previewSeq=0,calendarSeq=0,historySeq=0,scheduleSeq=0;
  let previewTimer:ReturnType<typeof setTimeout>|undefined;
  const clock=setInterval(()=>{s.now=Date.now();},1000);
  onBeforeUnmount(()=>{alive=false;previewSeq++;calendarSeq++;historySeq++;scheduleSeq++;clearInterval(clock);clearTimeout(previewTimer);});
  const canManage=computed(()=>s.options?.canManage===true);
  const enabled=computed(()=>canManage.value&&s.options?.pool?.status==='ENABLED');
  const locked=computed(()=>s.busy||s.uncertain||s.scheduleSaving||s.scheduleUncertain);
  const members=computed<Data[]>(()=>[...(s.options?.members||[])].sort((a,b)=>a.position-b.position));
  const items=computed<Data[]>(()=>s.preview?.items||[]);
  const candidates=computed(()=>batchCandidates(items.value,s.selected));
  const ready=computed(()=>enabled.value&&!locked.value&&!s.loading&&s.preview?.canConfirm===true&&!!s.preview?.previewToken&&Date.parse(s.preview.expiresAt)>s.now);
  const name=(id:string)=>members.value.find(p=>p.userId===id)?.name||'姓名未提供';
  const fail=(e:any)=>{s.error=e?.message||e?.errMsg||'请求失败，请重试';};
  function invalidate(){previewSeq++;clearTimeout(previewTimer);s.preview=null;s.loading=false;s.confirmOpen=false;s.result=null;}
  function formChanged(){if(locked.value)return;invalidate();s.choices={};s.selected=[];s.error='';void calendar();}
  function period(kind:string){if(locked.value)return;s.form.endDate=s.form.startDate;s.form.startTime=kind==='afternoon'?'13:00':kind==='all'?'00:00':'08:00';s.form.endTime=kind==='afternoon'?'18:00':kind==='all'?'00:00':'12:00';if(kind==='all')s.form.endDate=nextDate(s.form.startDate);formChanged();}
  async function init(){s.loading=true;s.error='';try{const r=await api('GET','/repair/rest/options');if(typeof r.canManage!=='boolean'||(r.canManage===true&&!Array.isArray(r.members)))throw new Error('权限配置响应格式异常');if(alive)s.options=r;}catch(e){if(alive)fail(e);}finally{if(alive)s.loading=false;}if(canManage.value)await calendar();}
  async function calendar(){if(!canManage.value)return;const seq=++calendarSeq;try{const r=await api('GET','/repair/rest/calendar',{date:s.form.startDate});if(alive&&seq===calendarSeq)s.calendar=r;}catch(e){if(alive&&seq===calendarSeq){s.calendar=null;fail(e);}}}
  async function preview(){if(!enabled.value||locked.value)return;const seq=++previewSeq;s.loading=true;s.error='';s.confirmOpen=false;s.result=null;s.preview=null;
    try{if(!members.value.some(p=>p.userId===s.form.userId))throw new Error('请选择固定轮值人员');const range=timeRange(s.form);const assignments=Object.entries(s.choices).filter(([,id])=>id).map(([orderId,targetUserId])=>({orderId,mode:'MANUAL',targetUserId}));
      const r=await api('POST','/repair/rest/preview',{userId:s.form.userId,...range,assignments});
      if(!Array.isArray(r.items)||typeof r.canConfirm!=='boolean')throw new Error('预览响应格式异常');
      if(alive&&seq===previewSeq){s.preview=r;const ids=new Set(r.items.map((i:Data)=>i.orderId));s.choices=Object.fromEntries(Object.entries(s.choices).filter(([id])=>ids.has(id)));s.selected=s.selected.filter(id=>ids.has(id));}
    }catch(e){if(alive&&seq===previewSeq)fail(e);}finally{if(alive&&seq===previewSeq)s.loading=false;}
  }
  function choose(ids:string[],target=''){if(locked.value||s.loading)return;const rows=items.value.filter(i=>ids.includes(i.orderId));if(target&&rows.some(i=>!(i.eligibleCandidates||[]).some((p:Data)=>p.userId===target&&p.canAssign===true))){s.error='所选人员并非每张单都可接收，请分别指定';return;}
    rows.forEach(i=>{if(target)s.choices[i.orderId]=target;else delete s.choices[i.orderId];});s.selected=[];s.batchTarget='';invalidate();s.loading=true;previewTimer=setTimeout(()=>void preview(),200);
  }
  function toggle(id:string){s.selected=s.selected.includes(id)?s.selected.filter(x=>x!==id):[...s.selected,id];}
  function toggleAll(){s.selected=s.selected.length===items.value.length?[]:items.value.map(i=>i.orderId);}
  function openConfirm(){if(ready.value)s.confirmOpen=true;}
  async function sendPending(){if(!s.pending||s.busy)return;s.busy=true;s.error='';s.uncertain=false;const pending=s.pending;
    try{const r=await api('POST',pending.path,pending.body);if(pending.kind==='confirm'&&(!r.restId||!Array.isArray(r.assignments)))throw new Error('提交响应不完整，请核对结果');if(pending.kind==='cancel'&&r.rest?.id!==pending.body.id)throw new Error('取消响应不匹配，请核对结果');if(!alive)return;s.pending=null;s.result=r;s.message=pending.kind==='cancel'?'休息已取消，已转派工单保持不变':'休息已保存，转派已生效';s.confirmOpen=false;s.cancelOpen=false;s.detail=null;invalidate();s.result=r;onChanged();void calendar();if(s.tab==='history')void history(true);
    }catch(e:any){if(!alive)return;fail(e);if(e?.definite && e?.errorCode!=='REQUEST_REUSED'){s.pending=null;s.uncertain=false;s.confirmOpen=false;invalidate();s.error+='；请重新查询或预览后确认';}else{s.uncertain=true;s.error+='；结果尚未确认，请保持原请求重试，勿重复创建';}}
    finally{if(alive)s.busy=false;}
  }
  async function confirm(){if(s.pending)return sendPending();if(!ready.value)return;s.pending={path:'/repair/rest/confirm',kind:'confirm',body:JSON.parse(JSON.stringify({userId:s.form.userId,...timeRange(s.form),assignments:assignmentPlan(items.value,s.choices),previewToken:s.preview!.previewToken,requestId:requestId(),remark:s.form.remark}))};await sendPending();}
  async function history(reset=false){if(!canManage.value||s.historyLoading)return;const seq=++historySeq,page=reset?1:s.historyPage+1;s.historyLoading=true;s.error='';if(reset){s.history=[];s.historyPage=0;}
    try{const r=await api('GET','/repair/rest/list',{pageNo:page,pageSize:20,...(s.historyDate?{from:s.historyDate,to:s.historyDate}:{}),...(s.historyUser?{userId:s.historyUser}:{})});if(!Array.isArray(r.records))throw new Error('休息列表返回异常');if(alive&&seq===historySeq){s.history=reset?r.records:[...s.history,...r.records];s.historyPage=page;s.historyTotal=r.total;}}
    catch(e){if(alive&&seq===historySeq)fail(e);}finally{if(alive&&seq===historySeq)s.historyLoading=false;}
  }
  async function viewRest(id:string){if(locked.value)return;s.error='';try{const r=await api('GET','/repair/rest/detail',{id});if(alive){s.detail=r;s.cancelReason='';s.cancelOpen=false;}}catch(e){if(alive)fail(e);}}
  async function cancel(){if(locked.value||!canManage.value||!s.detail?.rest)return;const rest=s.detail.rest;if(!Number.isInteger(rest.version)){s.error='休息记录缺少版本，请重新查看详情';return;}if(!s.cancelReason.trim()){s.error='请填写取消原因';return;}if(rest.status!=='VALID'||Date.parse(rest.endAt)<=Date.now()){s.error='只能取消未结束的有效休息';return;}s.pending={path:'/repair/rest/cancel',kind:'cancel',body:{id:rest.id,version:rest.version,requestId:requestId(),reason:s.cancelReason.trim()}};await sendPending();}
  async function schedules(reset=false){if(!enabled.value||s.scheduleLoading||locked.value)return;const seq=++scheduleSeq,page=reset?1:s.schedulePage+1;s.scheduleLoading=true;s.error='';if(reset){s.schedules=[];s.scanned=0;s.schedulePage=0;s.scheduleFailures=[];}
    try{const r=await api('GET','/repair/order/list',{scope:'ALL',workStatus:'PENDING',pageNo:page,pageSize:10});if(!Array.isArray(r.records))throw new Error('工单列表返回异常');const accepted:Data[]=[],failed:string[]=[];
      // 当前列表契约没有调度字段或筛选：每页受控并发读详情，不把无负责人猜成待调度。
      for(let i=0;i<r.records.length;i+=3){await Promise.all(r.records.slice(i,i+3).map(async(row:Data)=>{try{const d=await api('GET','/repair/order/detail',{id:row.id});if(!d.order||d.order.id!==row.id)throw new Error('详情不匹配');if(d.order.dispatchStatus===s.scheduleFilter)accepted.push({...row,...d.order});}catch{failed.push(row.orderNo||row.id);}}));if(!alive||seq!==scheduleSeq)return;}
      if(alive&&seq===scheduleSeq){const existing=new Map(s.schedules.map(x=>[x.id,x]));accepted.forEach(x=>existing.set(x.id,x));s.schedules=[...existing.values()];s.scanned+=r.records.length;s.scheduleTotal=r.total;s.schedulePage=page;s.scheduleFailures.push(...failed);}
    }catch(e){if(alive&&seq===scheduleSeq)fail(e);}finally{if(alive&&seq===scheduleSeq)s.scheduleLoading=false;}
  }
  async function editSchedule(id:string){if(!enabled.value||locked.value)return;s.error='';s.scheduleSaving=true;try{const d=await api('GET','/repair/order/detail',{id});if(!d.order||d.order.id!==id||!Number.isInteger(d.order.version))throw new Error('未取得当前工单版本，请刷新');if(['PROCESSING','COMPLETED','CLOSED'].includes(d.order.workStatus))throw new Error('该状态不允许设置预计执行时间');
      const order=d.order,start=formatTime(order.schedule?.plannedStartAt),end=formatTime(order.schedule?.plannedEndAt);s.editing=order;s.scheduleForm={startDate:start==='未设置'?beijingDate():start.slice(0,10),startTime:start==='未设置'?'09:00':start.slice(11,16),endDate:end==='未设置'?beijingDate():end.slice(0,10),endTime:end==='未设置'?'10:00':end.slice(11,16),reason:''};s.scheduleUncertain=false;
    }catch(e){fail(e);}finally{s.scheduleSaving=false;}}
  async function saveSchedule(){if(!enabled.value||locked.value||!s.editing)return;s.error='';try{const range=timeRange(s.scheduleForm);if(!s.scheduleForm.reason.trim())throw new Error('请填写设置或调整原因');s.scheduleSaving=true;const r=await api('POST','/repair/order/schedule',{orderId:s.editing.id,plannedStartAt:range.startAt,plannedEndAt:range.endAt,version:s.editing.version,reason:s.scheduleForm.reason.trim()});if(!['ASSIGNED','WAIT_DISPATCH'].includes(r.dispatchStatus))throw new Error('计划保存响应不完整，请核对工单');s.message=r.dispatchStatus==='ASSIGNED'?'执行时间已保存，工单已分配':'执行时间已保存，当前仍待调度';s.editing=null;invalidate();onChanged();}catch(e:any){fail(e);if(s.scheduleSaving&&!e?.definite){s.scheduleUncertain=true;s.error+='；保存结果不确定，请先读取最新工单核对，不要重复提交';}}finally{s.scheduleSaving=false;}if(!s.scheduleUncertain)void schedules(true);}
  async function reconcileSchedule(){if(!s.editing||s.scheduleSaving)return;s.scheduleSaving=true;try{const d=await api('GET','/repair/order/detail',{id:s.editing.id});if(d.order?.id!==s.editing.id)throw new Error('详情不匹配');s.editing=d.order;s.scheduleUncertain=false;s.message=`最新计划：${formatTime(d.order.schedule?.plannedStartAt)} 至 ${formatTime(d.order.schedule?.plannedEndAt)}；请核对后决定是否调整`;onChanged();}catch(e){fail(e);}finally{s.scheduleSaving=false;}}
  function switchTab(tab:string){if(locked.value)return;s.tab=tab;s.error='';if(tab==='history')void history(true);if(tab==='schedule')void schedules(true);}
  return {s,canManage,enabled,locked,members,items,candidates,ready,name,init,calendar,formChanged,period,preview,choose,toggle,toggleAll,openConfirm,confirm,sendPending,history,viewRest,cancel,schedules,editSchedule,saveSchedule,reconcileSchedule,switchTab,formatTime,reasonText};
}
