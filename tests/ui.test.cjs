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

test('调色色卡跟随左侧区域选择，修改不进入上传状态',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/src/app.js'),'utf8');
 const regions=require('../web/src/core.js').regions;
 const options={innerHTML:''},buttons=[{dataset:{shade:'3'}}],state={completed:true,colors:{a:'main'}};let saved=0;
 const ctx={regions,state,selected:'main',localKey:'demo:test:student',load:()=>({}),save:()=>saved++,Lesson:{coloringProgress:()=>({perfect:true})},keys:[],updateColor(){},$:selector=>{assert.equal(selector,'#shade-options');return options},$$:()=>buttons};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  const shadeStorageKey='),source.indexOf('  function studentColor()')),ctx);
 ctx.renderShades();assert.ok(options.innerHTML.includes('主键盘区色号'));
 ctx.selected='editing';ctx.renderShades();assert.ok(options.innerHTML.includes('编辑键区色号'));assert.ok(!options.innerHTML.includes('主键盘区色号'));
 const before=JSON.stringify(state);buttons[0].onclick();assert.equal(JSON.stringify(state),before);assert.equal(saved,1);
 ctx.selected='blank';ctx.renderShades();assert.ok(options.innerHTML);
});
