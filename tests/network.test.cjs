const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/src/app.js'),'utf8');
function harness(){
  let now=100000,calls=0,reply=async()=>({ok:true,json:async()=>({ok:true,submissions:[]})});
  const ctx={navigator:{onLine:true},document:{hidden:false},Date:class extends Date{static now(){return now;}},Math:{...Math,random:()=>0,min:Math.min,max:Math.max},
    AbortController,setTimeout:()=>0,clearTimeout(){},base:'https://example.invalid',retryAt:0,requestFailures:0,recordsCache:null,recordsCachedAt:0,recordsPending:null,recordsVersion:0,
    fetch:async(...args)=>{calls++;return reply(...args);},dirty:true,busy:false,lastSent:0,lastUploadAttempt:0,uploadDelay:5000,kind:'coloring',room:'ABC',studentId:'device',status(){},payload:()=>({value:1})};
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('  async function request('),source.indexOf('  function getDemo()')),ctx);
  vm.runInContext(source.slice(source.indexOf('  async function syncStudent('),source.indexOf('  document.body.innerHTML=')),ctx);
  ctx.put=()=>ctx.request('/state','PUT',{value:1});
  return {ctx,advance:ms=>now+=ms,calls:()=>calls,reply:fn=>reply=fn};
}
test('上传合并、无变化保活、后台与离线暂停，恢复后发送最新状态',async()=>{
  const h=harness(),c=h.ctx;
  await c.syncStudent();assert.equal(h.calls(),1);
  c.dirty=true;await c.syncStudent();assert.equal(h.calls(),1);
  h.advance(5000);await c.syncStudent();assert.equal(h.calls(),2);
  h.advance(10000);await c.syncStudent();assert.equal(h.calls(),2);
  h.advance(50000);await c.syncStudent();assert.equal(h.calls(),3);
  c.dirty=true;c.document.hidden=true;h.advance(60000);await c.syncStudent(true);assert.equal(h.calls(),3);
  c.document.hidden=false;c.navigator.onLine=false;await c.syncStudent(true);assert.equal(h.calls(),3);
  c.navigator.onLine=true;await c.syncStudent();assert.equal(h.calls(),4);assert.equal(c.dirty,false);
});
test('上传期间新增修改不会丢失，也不会发出并发请求',async()=>{
  const h=harness();let release;h.reply(()=>new Promise(resolve=>release=resolve));
  const pending=h.ctx.syncStudent();h.ctx.dirty=true;
  await h.ctx.syncStudent(true);assert.equal(h.calls(),1);
  release({ok:true,json:async()=>({ok:true})});await pending;
  assert.equal(h.ctx.dirty,true);
});
test('429遵守Retry-After，重试窗口内不触发请求',async()=>{
  const h=harness();h.reply(async()=>({ok:false,status:429,headers:{get:()=> '120'}}));
  await assert.rejects(h.ctx.request('/state'));
  assert.equal(h.ctx.retryAt,220000);
  h.advance(60000);await assert.rejects(h.ctx.request('/state'));assert.equal(h.calls(),1);
  h.advance(60000);h.reply(async()=>({ok:true,json:async()=>({ok:true})}));
  await h.ctx.request('/state');assert.equal(h.calls(),2);assert.equal(h.ctx.requestFailures,0);
});
test('网络失败逐步退避，课堂和快照读取合并并短期缓存',async()=>{
  const h=harness();h.reply(async()=>{throw Error('offline')});
  await assert.rejects(h.ctx.request('/state'));assert.equal(h.ctx.retryAt,105000);
  h.advance(5000);await assert.rejects(h.ctx.request('/state'));assert.equal(h.ctx.retryAt,115000);
  h.advance(10000);h.reply(async()=>({ok:true,json:async()=>({ok:true,submissions:[]})}));
  await Promise.all([h.ctx.readRecords(),h.ctx.readRecords()]);assert.equal(h.calls(),3);
  await h.ctx.readRecords();assert.equal(h.calls(),3);
  h.advance(60000);await h.ctx.readRecords();assert.equal(h.calls(),4);
});
