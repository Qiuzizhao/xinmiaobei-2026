const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function keyboard(){const Lesson=require('../web/src/core.js');vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/src/keyboard.js'),'utf8'),{Lesson});return Lesson;}
test('按课堂参考图划分：顶部16键全属功能键区，编辑区仅六键和四方向键',()=>{
 const L=keyboard(),keys=L.keys;
 assert.equal(keys.length,107);
 const functional=['Escape',...Array.from({length:12},(_,i)=>'F'+(i+1)),'PrintScreen','ScrollLock','Pause'];
 const editing=['Insert','Home','PageUp','Delete','End','PageDown','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'];
 assert.deepEqual(Array.from(keys.filter(k=>k.region==='function'),k=>k.id).sort(),functional.sort());
 assert.deepEqual(Array.from(keys.filter(k=>k.region==='editing'),k=>k.id).sort(),editing.sort());
 for(const k of keys.filter(k=>k.y===0))assert.equal(k.region,'function');
 assert.equal(keys.filter(k=>k.region==='indicator').length,3);
 assert.equal(keys.filter(k=>k.region==='numeric').length,17);
});
test('学生正确率按修正后的标准判定，顶部三键不再误判为编辑区',()=>{
 const L=keyboard(),colors=Object.fromEntries(L.keys.map(k=>[k.id,k.region]));
 assert.equal(L.coloringProgress(colors,L.keys).perfect,true);
 for(const id of ['PrintScreen','ScrollLock','Pause'])colors[id]='editing';
 assert.equal(L.coloringProgress(colors,L.keys).correct,104);
 assert.equal(L.coloringProgress(colors,L.keys).perfect,false);
});
