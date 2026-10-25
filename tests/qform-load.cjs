// Bounded classroom-load check. Run explicitly; never included in npm test.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const config=require('../web/config.json'),Lesson=require('../web/src/core.js');
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/src/keyboard.js'),'utf8'),{Lesson});
const session='loadtest-'+new Date().toISOString().replace(/\D/g,'').slice(0,14);
const stages=[{students:10,seconds:20},{students:25,seconds:30},{students:40,seconds:60}];
const records=[],startedAt=new Date().toISOString();let stopped='',failures=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));
const percentile=(values,p)=>values.length?values.slice().sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]:0;
const round=n=>Math.round(n*10)/10;
function summary(items){const times=items.map(r=>r.ms);return {requests:items.length,success:items.filter(r=>r.status>=200&&r.status<300).length,
  statuses:items.reduce((all,r)=>(all[r.status]=(all[r.status]||0)+1,all),{}),p50ms:round(percentile(times,.5)),p95ms:round(percentile(times,.95)),p99ms:round(percentile(times,.99)),maxMs:round(Math.max(0,...times)),responseBytes:items.reduce((sum,r)=>sum+r.bytes,0)};}
async function request(kind,method,suffix,body,stage){
  if(stopped)return;
  const start=performance.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  let status=0,bytes=0,ownStates,rateHeaders={};
  try{
    const response=await fetch(`https://qiuform.qiuzizhao.com/api/${config[kind].taskId}${suffix}`,{
      method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:controller.signal});
    status=response.status;const text=await response.text();bytes=Buffer.byteLength(text);
    for(const [key,value] of response.headers)if(/retry-after|ratelimit/i.test(key))rateHeaders[key]=value;
    if(response.ok){const data=JSON.parse(text);if(data.ok===false)status=500;
      if(method==='GET'&&suffix==='/state')ownStates=Object.keys(data.states||{}).filter(k=>k.startsWith(session+':')).length;
    }
  }catch(error){status=error.name==='AbortError'?'timeout':'network-error';}
  finally{clearTimeout(timer);}
  const record={stage,kind,method,endpoint:suffix.startsWith('/state/')?'state-write':suffix,ms:round(performance.now()-start),status,bytes,...(ownStates!==undefined?{ownStates}:{}),...(Object.keys(rateHeaders).length?{rateHeaders}:{})};records.push(record);
  if(status===429)stopped='服务器返回429，已立即停止，不重试';
  else if(!(status>=200&&status<300)&&++failures>=3)stopped='累计3个失败，已停止';
  const recent=records.slice(-12);if(recent.length===12&&percentile(recent.map(r=>r.ms),.5)>3000)stopped='最近请求中位耗时超过3秒，已停止';
  if(records.length>=1500)stopped='达到1500请求上限，已停止';
  return record;
}
async function actor(kind,id,deadline,stage){
  const interval=kind==='coloring'?5000:10000;
  await sleep(Math.random()*interval);let revision=0;
  while(!stopped&&Date.now()<deadline){
    const began=Date.now();revision++;
    const colors=Object.fromEntries(Lesson.keys.map((k,i)=>[k.id,(i+revision)%17===0?'main':k.region]));
    const payload={sessionId:session,studentId:`test-${kind}-${id}`,kind:`load-test-${kind}`,updatedAt:Date.now(),...(kind==='coloring'?{colors,completed:false}:{total:id*10+revision*5,level:Lesson.levelInfo(id*10+revision*5).level})};
    await request(kind,'PUT',`/state/${encodeURIComponent(`${session}:${kind}:${id}`)}?ttl=120`,payload,stage);
    await sleep(Math.min(Math.max(0,interval-(Date.now()-began)),Math.max(0,deadline-Date.now())));
  }
}
async function teacher(kind,deadline,stage){
  while(!stopped&&Date.now()<deadline){const start=Date.now();await request(kind,'GET','/state',null,stage);
    await sleep(Math.min(Math.max(0,5000-(Date.now()-start)),Math.max(0,deadline-Date.now())));}
}
(async()=>{
  console.log('Session:',session,'TTL:120s. Hard limit:40 students per activity / 1500 requests / stop on429.');
  for(const kind of ['coloring','typing'])for(const suffix of ['/state','/all'])if(!stopped)await request(kind,'GET',suffix,null,'baseline');
  console.log('Baseline:',JSON.stringify(summary(records)));
  for(const stage of stages){
    if(stopped)break;
    const name=`${stage.students}+${stage.students}`,deadline=Date.now()+stage.seconds*1000,offset=records.length;
    console.log('Starting:',name,`${stage.seconds}s`,new Date().toISOString());
    await Promise.all(['coloring','typing'].flatMap(kind=>[teacher(kind,deadline,name),...Array.from({length:stage.students},(_,i)=>actor(kind,i,deadline,name))]));
    console.log('Finished:',name,JSON.stringify(summary(records.slice(offset))));
  }
  const report={session,startedAt,finishedAt:new Date().toISOString(),stopped:stopped||null,
    policy:{stages,writeIntervalsMs:{coloring:5000,typing:10000},teacherIntervalMs:5000,ttlSeconds:120,requestTimeoutMs:8000},
    total:summary(records),byStage:Object.fromEntries(['baseline',...stages.map(s=>`${s.students}+${s.students}`)].map(s=>[s,summary(records.filter(r=>r.stage===s))])),
    byEndpoint:Object.fromEntries([...new Set(records.map(r=>r.kind+' '+r.method+' '+r.endpoint))].map(key=>[key,summary(records.filter(r=>r.kind+' '+r.method+' '+r.endpoint===key))])),records};
  const out=path.join(__dirname,'../docs/qform-load-test.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log('Result:',JSON.stringify(report.total),'Stop:',stopped||'none','Report:',out);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
