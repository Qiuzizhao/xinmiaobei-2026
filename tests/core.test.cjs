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
test('混色扇区只按已填色学生分比例，空白不稀释',()=>{
  const d=L.distribution([{colors:{KeyA:'main'}},{colors:{KeyA:'editing'}},{colors:{}},{colors:{KeyA:'bad'}}],'KeyA');
  const mix=L.mixShares(d);
  assert.equal(mix.filled,2);
  assert.deepEqual(mix.shares.map(s=>[s.id,s.count,s.ratio]),[['main',1,0.5],['editing',1,0.5]]);
  assert.equal(L.mixShares(L.distribution([{colors:{}},{colors:{KeyA:'bad'}}],'KeyA')).filled,0);
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
test('直接识别字母数字，不依赖输入框；支持大小写和输入法物理键',()=>{
  assert.deepEqual(L.typingKey({key:'D',code:'KeyD'}),{text:'d',main:true});
  assert.deepEqual(L.typingKey({key:'2',code:'Digit2'}),{text:'2',main:true});
  assert.deepEqual(L.typingKey({key:'Process',code:'KeyD',isComposing:true}),{text:'d',main:true});
  assert.deepEqual(L.typingKey({key:'End',code:'Numpad1'}),{text:'1',main:false});
  for(const event of [{key:'d',ctrlKey:true},{key:'d',metaKey:true},{key:'d',altKey:true},{key:'d',repeat:true},{key:'Shift'},{key:'Enter'},{key:'!'}])assert.equal(L.typingKey(event),null);
});
test('课堂列表去重、保留真实创建时间、按创建时间倒序',()=>{
  const result=L.mergeClassrooms([{id:'OLD',createdAt:null},{id:'ABC234',createdAt:200}], [{sessionId:'ABC234',createdAt:200},{id:'OLD'},{id:'NEW567',createdAt:300},{id:'ABC234'}]);
  assert.deepEqual(result,[{id:'NEW567',createdAt:300},{id:'ABC234',createdAt:200},{id:'OLD',createdAt:null}]);
  assert.deepEqual(L.mergeClassrooms([],[{id:'',createdAt:123},{}]),[]);
});
test('新课堂为简短六位编号，不包含年级或易混淆字符',()=>{
  const code=L.roomCode(new Uint8Array([0,7,15,30,120,255]));
  assert.equal(code.length,6);assert.match(code,/^[2-9A-HJ-NP-Z]{6}$/);
});

test('填色过半才显示正确率，全部正确才解锁，未填和非法颜色不计入',()=>{
  const keys=Array.from({length:107},(_,i)=>({id:String(i),region:i%2?'main':'numeric'}));
  const colors={};
  assert.equal(L.coloringProgress(colors,keys).showAccuracy,false);
  for(let i=0;i<53;i++)colors[i]=keys[i].region;
  assert.equal(L.coloringProgress(colors,keys).showAccuracy,false);
  colors[53]=keys[53].region;
  let p=L.coloringProgress(colors,keys);assert.equal(p.showAccuracy,true);assert.equal(p.accuracy,100);assert.equal(p.perfect,false);
  for(let i=54;i<107;i++)colors[i]=keys[i].region;
  assert.equal(L.coloringProgress(colors,keys).perfect,true);
  colors[106]='main';p=L.coloringProgress(colors,keys);assert.equal(p.perfect,false);assert.ok(p.accuracy<100);
  colors[106]='invalid';assert.equal(L.coloringProgress(colors,keys).filled,106);
});

test('40张色卡使用协调色阶，每格不同且明度连续递增',()=>{
  assert.equal(L.themes.length,40);
  const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
  const palettes=[];
  for(let level=1;level<=40;level++){
    const colors=Array.from({length:30},(_,i)=>L.swatch(level,i,30));
    assert.equal(new Set(colors).size,30);
    assert.ok(colors.every(c=>/^#[0-9a-f]{6}$/.test(c)));
    const light=colors.map(luminance);
    assert.ok(light.every((v,i)=>!i||v>light[i-1]));
    assert.ok(light[29]-light[0]>.12);
    palettes.push(colors.join('|'));
  }
  assert.equal(new Set(palettes).size,40);
});
