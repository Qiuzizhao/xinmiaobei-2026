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
 const ctx={regions,state,selected:'main',localKey:'demo:test:student',load:()=>({}),save:()=>saved++,Lesson:{coloringProgress:()=>({perfect:false})},keys:[],updateColor(){},$:selector=>selector==='#shade-options'?options:null,$$:()=>buttons};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  const shadeStorageKey='),source.indexOf('  function studentColor()')),ctx);
 ctx.renderShades();assert.ok(options.innerHTML.includes('主键盘区色号'));
 ctx.selected='editing';ctx.renderShades();assert.ok(options.innerHTML.includes('编辑键区色号'));assert.ok(!options.innerHTML.includes('主键盘区色号'));
 const before=JSON.stringify(state);buttons[0].onclick();assert.equal(JSON.stringify(state),before);assert.equal(saved,1);
 ctx.selected='blank';ctx.renderShades();assert.ok(options.innerHTML);
});

test('提交后即可显示调色引导，不要求正确率，且只显示一次',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/src/app.js'),'utf8');
 const code=source.slice(source.indexOf('  function dismissShadeGuide()'),source.indexOf('  function shadeOptions('));
 let seen=false,inserted=0,removed=0,correct=false;const classes=new Set();
 const nodes={'#shade-play':{classList:{contains:v=>classes.has(v),add:v=>classes.add(v),remove:v=>classes.delete(v)},insertAdjacentHTML(){inserted++;},getBoundingClientRect:()=>({top:80,bottom:130})},'#shade-guide':{remove(){removed++;},addEventListener(){}},'#shade-guide-close':{focus(){}}};
 const ctx={state:{completed:false,colors:{}},keys:[],Lesson:{coloringProgress:()=>({perfect:correct})},load:()=>seen,save:()=>{seen=true},localKey:'demo:room:student',innerHeight:900,$:selector=>nodes[selector]};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 ctx.showShadeGuide();assert.equal(inserted,0);
 ctx.state.completed=true;ctx.showShadeGuide();assert.equal(inserted,1);assert.ok(classes.has('guide-active'));
 ctx.showShadeGuide();assert.equal(inserted,1);
 nodes['#shade-guide-close'].onclick();assert.equal(removed,1);assert.ok(!classes.has('guide-active'));
});
test('填满自动记录完成，擦除和重新填色后仍保留完成记录',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/src/app.js'),'utf8');
 const code=source.slice(source.indexOf('  function updateColor()'),source.indexOf('  let renderedLevel='));
 const state={colors:{},completed:false};let filled=1,saves=0;
 const element={classList:{toggle(){}},textContent:'',disabled:false};
 const ctx={state,keys:[{},{}],selected:'main',Lesson:{coloringProgress:()=>({filled,perfect:false})},persist:()=>saves++,dismissShadeGuide(){},$:()=>element,$$:()=>[]};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 ctx.updateColor();assert.equal(state.hasFilledAll,undefined);
 filled=2;ctx.updateColor();assert.equal(state.hasFilledAll,true);assert.equal(state.completed,false);assert.equal(saves,1);
 filled=1;ctx.updateColor();assert.equal(state.hasFilledAll,true);
 state.colors={};filled=0;ctx.updateColor();assert.equal(state.hasFilledAll,true);assert.equal(saves,1);
});
test('配对题绘制真实连线，重新布局与清空时更新，错误答案使用虚线',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/src/app.js'),'utf8');
 const code=source.slice(source.indexOf('  function drawMatchLines()'),source.indexOf('  function renderMatchBody('));
 let width=600,viewBox='';const svg={innerHTML:'',setAttribute:(name,value)=>{if(name==='viewBox')viewBox=value;}};
 const board={getBoundingClientRect:()=>({left:10,top:20,width,height:400})};
 const left={dataset:{left:'main'},getBoundingClientRect:()=>({right:210,top:40,height:80})};
 const right={dataset:{right:'r1'},getBoundingClientRect:()=>({left:410,top:120,height:80})};
 const ctx={activeMatch:{q:{left:[{id:'main'}],answer:{main:'r2'}},pairs:{main:'r1'},locked:false},$:s=>s==='.quiz-match'?board:svg,$$:s=>s==='[data-left]'?[left]:[right]};
 vm.createContext(ctx);vm.runInContext(code,ctx);ctx.drawMatchLines();
 assert.equal(viewBox,'0 0 600 400');assert.match(svg.innerHTML,/<path d="M 200 60 C/);assert.match(svg.innerHTML,/, 400 140"/);
 ctx.activeMatch.locked=true;ctx.drawMatchLines();assert.match(svg.innerHTML,/stroke-dasharray="6 5"/);
 width=420;ctx.drawMatchLines();assert.equal(viewBox,'0 0 420 400');
 ctx.activeMatch.pairs={};ctx.drawMatchLines();assert.equal(svg.innerHTML,'');
});
test('形状连线题只展示对应区域的真实按键，不画整盘或标出区域名称',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/src/app.js'),'utf8');
 const Lesson=require('../web/src/core.js');vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/src/keyboard.js'),'utf8'),{Lesson});
 const ctx={keys:Lesson.keys,esc:value=>String(value)};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('  function shapeHTML('),source.indexOf('  let quizPickLeft=')),ctx);
 for(const [region,count] of [['main',61],['function',16],['editing',10],['numeric',17],['indicator',3]]){
  const markup=ctx.shapeHTML(region);assert.equal((markup.match(/class="fragment-key"/g)||[]).length,count);
  assert.doesNotMatch(markup,/主键盘区|功能键区|编辑键区|小键盘区|指示灯区/);
 }
 assert.match(ctx.shapeHTML('function'),/data-fragment-key="PrintScreen"/);assert.doesNotMatch(ctx.shapeHTML('function'),/data-fragment-key="KeyA"/);
 assert.match(ctx.shapeHTML('numeric'),/data-fragment-key="NumpadEnter"/);assert.doesNotMatch(ctx.shapeHTML('numeric'),/data-fragment-key="Enter"/);
});
test('上一题保留已提交答案和未提交连线草稿，首题不回退，完成页可返回末题',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/src/app.js'),'utf8');
 const code=source.slice(source.indexOf('  function quizPreviousButton('),source.indexOf('  function renderQuizStudent('));
 let saved=0,rendered=0;const state={index:1,answers:{q1:{checked:true,value:'a',correct:true}}};
 const ctx={state,quizQuestions:[{id:'q1',type:'mcq'},{id:'q2',type:'match'}],quizDraft:{main:'r1'},quizPickLeft:'editing',persist:()=>saved++,renderQuizStudent:()=>rendered++};
 vm.createContext(ctx);vm.runInContext(code,ctx);ctx.goPreviousQuiz();
 assert.equal(state.index,0);assert.equal(state.answers.q1.correct,true);assert.equal(state.answers.q2.value.main,'r1');assert.equal(state.answers.q2.checked,false);assert.equal(saved,1);assert.equal(rendered,1);assert.match(ctx.quizPreviousButton(),/disabled/);
 ctx.goPreviousQuiz();assert.equal(saved,1);state.index=2;ctx.goPreviousQuiz();assert.equal(state.index,1);assert.doesNotMatch(ctx.quizPreviousButton(),/disabled/);
});
test('答对和答错均显示本题解析',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/src/app.js'),'utf8');
 const code=source.slice(source.indexOf('  function showQuizFeedback('),source.indexOf('  function updateMatchCheck('));
 const feedback={innerHTML:'',classList:{remove(){},add(){}}},badge={},bar={style:{}};
 const ctx={state:{answers:{}},quizQuestions:[{}],quizProgress:()=>({correct:1,answered:1}),esc:value=>String(value),$:s=>s==='#quiz-feedback'?feedback:s==='.quiz-topline .badge'?badge:bar};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const q={type:'mcq',explanation:'Esc位于顶排，属于功能键区。'};
 ctx.showQuizFeedback(true,q);assert.match(feedback.innerHTML,/答对了/);assert.ok(feedback.innerHTML.includes(q.explanation));
 ctx.showQuizFeedback(false,q);assert.match(feedback.innerHTML,/正确答案已标出/);assert.ok(feedback.innerHTML.includes(q.explanation));
 q.type='match';ctx.showQuizFeedback(false,q);assert.match(feedback.innerHTML,/红色虚线/);assert.ok(feedback.innerHTML.includes(q.explanation));
});
