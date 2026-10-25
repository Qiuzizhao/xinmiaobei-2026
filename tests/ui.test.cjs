const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('教师列表内容变化时保留滚动位置，不变时不重建节点',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/src/app.js'),'utf8');
 const code=source.slice(source.indexOf('  function replaceHTML('),source.indexOf('  const esc='));
 const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
 let markup='old',writes=0;const element={scrollTop:85};
 Object.defineProperty(element,'innerHTML',{get:()=>markup,set:value=>{markup=value;writes++;element.scrollTop=0;}});
 ctx.replaceHTML(element,'new');assert.equal(markup,'new');assert.equal(element.scrollTop,85);assert.equal(writes,1);
 ctx.replaceHTML(element,'new');assert.equal(writes,1);assert.equal(element.scrollTop,85);
});
