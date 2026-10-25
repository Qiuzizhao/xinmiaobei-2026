const test=require('node:test'), assert=require('node:assert/strict');
const L=require('../web/src/core.js');
test('色卡边界正确，首关12格，第二关20格，之后30格',()=>{
  assert.deepEqual(L.levelInfo(0),{level:1,within:0,target:12});
  assert.deepEqual(L.levelInfo(11),{level:1,within:11,target:12});
  assert.deepEqual(L.levelInfo(12),{level:2,within:0,target:20});
  assert.deepEqual(L.levelInfo(32),{level:3,within:0,target:30});
  assert.deepEqual(L.levelInfo(62),{level:4,within:0,target:30});
});
test('累计数量是关卡与百分位的唯一依据，小样本向上取整',()=>{
  const s=L.stats([{total:0},{total:12},{total:32},{total:62}]);
  assert.equal(s.max,4);assert.equal(s.mean,2.5);
  assert.deepEqual(s.thresholds.map(x=>x.level),[4,4,3,2]);
  assert.equal(L.stats([]).count,0);
});
test('混色按学生计数，未填色和非法颜色进入未填色',()=>{
  const d=L.distribution([{colors:{KeyA:'main'}},{colors:{KeyA:'editing'}},{colors:{}},{colors:{KeyA:'bad'}}],'KeyA');
  assert.equal(d.main,1);assert.equal(d.editing,1);assert.equal(d.blank,2);
  assert.equal(Object.values(d).reduce((a,b)=>a+b),4);
});
test('任务只包含字母数字，前三关分开练字母和数字',()=>{
  for(let i=0;i<1000;i++)assert.match(L.targetAt(i),/^[a-z0-9]$/);
  for(let i=0;i<32;i++)assert.match(L.targetAt(i),/^[a-z]$/);
  for(let i=32;i<62;i++)assert.match(L.targetAt(i),/^[0-9]$/);
});
test('读取平台真实 state 包装，并拒绝截断数据以免统计错误',()=>{
  assert.deepEqual(L.normalizeStates({ok:true,states:{abc:{value:{total:12}}}}),[{key:'abc',total:12}]);
  assert.throws(()=>L.normalizeStates({ok:true,truncated:true,states:{}}));
});
