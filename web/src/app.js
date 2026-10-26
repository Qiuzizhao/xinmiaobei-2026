(async function () {
  'use strict';
  document.addEventListener('contextmenu',event=>event.preventDefault(),{capture:true});
  const {regions,keys,levelInfo,theme,swatch,targetAt,completedCards,collectedCardCount,stats,distribution,mixShares,normalizeStates,quizQuestions,gradeQuizAnswer,quizProgress,quizWrongStats}=Lesson;
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  function replaceHTML(target,html){
    if(target.innerHTML===html)return;
    const scrollTop=target.scrollTop;
    target.innerHTML=html;target.scrollTop=scrollTop;
  }
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg=window.APP_CONFIG, kind=cfg.kind, teacher=cfg.role==='teacher';
  if(!teacher){
    const lessonURL=location.href;
    const keepLesson=()=>history.pushState({...history.state,keyboardLessonGuard:true},'',lessonURL);
    if(!history.state?.keyboardLessonGuard)keepLesson();
    window.addEventListener('popstate',keepLesson);
    document.addEventListener('keydown',event=>{
      if(event.key==='BrowserBack'||(event.altKey&&event.key==='ArrowLeft'))event.preventDefault();
    },{capture:true});
  }
  const params=new URLSearchParams(location.search), demo=params.get('demo')==='1';
  const storagePrefix=`keyboard-v1:${kind}:`, defaultState=kind==='coloring'?{colors:{}}:kind==='quiz'?{answers:{},index:0}:{total:0};
  let storageOK=true;
  function load(key,fallback){try{return JSON.parse(localStorage.getItem(storagePrefix+key))??fallback;}catch{storageOK=false;return fallback;}}
  function save(key,value){try{localStorage.setItem(storagePrefix+key,JSON.stringify(value));}catch{storageOK=false;}}
  const room=(params.get('room')||(teacher?load('last-room',null):null)||'体验').trim().slice(0,64)||'体验';
  if(teacher)save('last-room',room);
  const roomCacheKey=demo?'demo-rooms':'rooms';
  let classrooms=Lesson.mergeClassrooms(load(roomCacheKey,[]),[{id:room}]),roomListSignature='',creatingRoom=false,pendingClassroom=null;
  let studentId=load('device',null);
  if(!studentId){studentId=crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now();save('device',studentId);}
  const localKey=`${demo?'demo:':''}${room}:student`;
  let state={...defaultState,...load(localKey,{})}, people=[], snapshots=[], selected='main';
  let dirty=true, busy=false, lastSent=0, lastUploadAttempt=0, isOnline=false, pollBusy=false, milestoneSyncPending=false;
  const uploadDelay=kind==='coloring'||kind==='quiz'?5000:10000;
  let retryAt=0,requestFailures=0,recordsCache=null,recordsCachedAt=0,recordsPending=null,recordsVersion=0;
  const base=`https://qiuform.qiuzizhao.com/api/${cfg.taskId}`;
  const demoKey=`${storagePrefix}demo-state:${room}`;
  let toastTimer;
  function toast(message){let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';e.className='toast';e.setAttribute('role','status');document.body.append(e);}e.textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.remove(),3200);}
  function status(ok,text){const e=$('#sync');if(!e)return;e.className='status '+(ok?'ok':'error');e.textContent=text;e.title=text;isOnline=ok;}
  async function request(path,method='GET',body){
    if(navigator.onLine===false||Date.now()<retryAt)throw Error('等待网络恢复或重试窗口');
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),8000);
    try {const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:ctrl.signal,cache:'no-store'});
      if(!r.ok){
        const error=Error('HTTP '+r.status);error.status=r.status;
        const value=r.headers.get('Retry-After');
        error.retryAfter=value?(/^\d+(\.\d+)?$/.test(value)?Number(value)*1000:Math.max(0,Date.parse(value)-Date.now())):0;
        throw error;
      }
      const data=await r.json();if(data.ok===false)throw Error(data.error||'请求未完成');
      if(Date.now()>=retryAt)requestFailures=0;
      return data;
    } catch(error){
      requestFailures++;
      const delay=Math.max(error.retryAfter||0,error.status===429?60000:0,Math.min(120000,5000*2**Math.min(requestFailures-1,5)));
      retryAt=Math.max(retryAt,Date.now()+delay+Math.random()*1000);
      throw error;
    } finally {clearTimeout(timer);}
  }
  async function readRecords(){
    if(recordsCache&&Date.now()-recordsCachedAt<60000)return recordsCache;
    if(recordsPending)return recordsPending;
    const version=recordsVersion;
    const pending=request('/all').then(data=>{if(version===recordsVersion){recordsCache=data;recordsCachedAt=Date.now();}return data;});
    recordsPending=pending;
    try{return await pending;}finally{if(recordsPending===pending)recordsPending=null;}
  }
  function getDemo(){try{return JSON.parse(localStorage.getItem(demoKey))||{};}catch{return {};}}
  async function put(key,value,ttl=7200){
    if(demo){const all=getDemo();all[key]={value,expires:Date.now()+ttl*1000};localStorage.setItem(demoKey,JSON.stringify(all));return;}
    return request(`/state/${encodeURIComponent(key)}?ttl=${ttl}`,'PUT',value);
  }
  async function readStates(){
    if(demo)return Object.entries(getDemo()).filter(([,v])=>v.expires>Date.now()).map(([key,v])=>({key,...v.value}));
    return normalizeStates(await request('/state'));
  }
  async function post(value){
    if(demo){const all=load('demo-snapshots:'+room,[]);all.push(value);save('demo-snapshots:'+room,all);return;}
    const result=await request('','POST',value);
    recordsVersion++;recordsCache=null;recordsPending=null;
    return result;
  }
  function persist(){save(localKey,state);dirty=true;}
  function payload(){const base={sessionId:room,studentId,kind,updatedAt:Date.now()};if(kind==='coloring')return{...base,colors:state.colors,hasFilledAll:!!state.hasFilledAll,completed:!!state.completed};if(kind==='quiz'){const p=quizProgress(state.answers);return{...base,quizVersion:2,answers:state.answers,index:state.index|0,answered:p.answered,correct:p.correct,finished:!!p.finished};}return{...base,total:state.total,level:levelInfo(state.total).level,collectedCards:completedCards(state.total)};}
  async function syncStudent(force=false){
    const now=Date.now();
    const milestone=force&&kind==='typing';
    if(document.hidden||navigator.onLine===false||now<retryAt)return;
    if(busy){if(milestone){milestoneSyncPending=true;dirty=true;}return;}
    if(!milestone&&now-lastUploadAttempt<uploadDelay)return;
    if(!force&&!dirty&&now-lastSent<60000)return;
    busy=true;dirty=false;lastUploadAttempt=now;
    try{const outgoing=payload();await put(`${kind}:${room}:${studentId}`,outgoing);lastSent=Date.now();status(true,'已同步');}
    catch{dirty=true;status(false,'正在重连');}
    finally{busy=false;if(milestoneSyncPending){milestoneSyncPending=false;await syncStudent(true);}}
  }
  document.body.innerHTML=`<header><div class="brand"><span class="brandmark">${kind==='coloring'?'▦':kind==='quiz'?'▣':'◈'}</span><span>${cfg.title}</span></div><div style="display:flex;gap:8px;align-items:center"><span class="badge">${teacher?'教师端':'学生端'}</span><span class="status" id="sync">正在连接</span></div></header><main id="main"></main>`;
  const main=$('#main');
  if(demo)main.insertAdjacentHTML('beforebegin','<div class="offline-banner" style="margin:12px 4vw 0">示例体验 · 不计入课堂</div>');
  function intro(title,desc,tag){return `<div class="intro"><div><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div></div>`;}
  function legend(){return regions.map(r=>`<span><i class="dot" style="--c:${r.color}"></i>${r.name}</span>`).join('');}
  // 调色偏好单独保存在本机，不进入 state 或上传内容。
  const shadeStorageKey=`${localKey}:shades`,localShades=load(shadeStorageKey,{});
  const shadeHues={main:355,function:43,editing:223,numeric:160,indicator:264};
  function dismissShadeGuide(){
    $('#shade-guide')?.remove();$('#shade-play')?.classList.remove('guide-active');
  }
  function showShadeGuide(){
    if(!state.completed||load(localKey+':shade-guide-seen',false))return;
    const target=$('#shade-play');if(!target||target.classList.contains('hidden'))return;
    save(localKey+':shade-guide-seen',true);target.classList.add('guide-active');
    target.insertAdjacentHTML('beforeend','<div id="shade-guide" class="shade-guide" role="dialog" aria-label="试试调色"><strong>已完成，试试调色！</strong><p>先选左侧区域，再点这里的色块，换个色调。</p><button id="shade-guide-close" class="primary">试试看</button></div>');
    $('#shade-guide-close').onclick=dismissShadeGuide;
    $('#shade-guide').addEventListener('keydown',event=>{if(event.key==='Escape')dismissShadeGuide();});
    const rect=target.getBoundingClientRect();
    if(rect.top<0||rect.bottom>innerHeight)target.scrollIntoView({behavior:'smooth',block:'center'});
    $('#shade-guide-close').focus({preventScroll:true});
  }
  function shadeOptions(id){return [regions.find(r=>r.id===id).color,...[52,60,68,76,84].map(light=>`hsl(${shadeHues[id]} 70% ${light}%)`)];}
  function displayColor(id){const r=regions.find(r=>r.id===id);return r?shadeOptions(id)[localShades[id]]||r.color:'';}
  function renderShades(){
    const id=regions.some(r=>r.id===selected)?selected:regions[0].id;
    $('#shade-options').innerHTML=shadeOptions(id).map((color,i)=>`<button class="shade-option" style="--shade:${color}" data-shade="${i}" aria-label="${regions.find(r=>r.id===id).name}色号 ${i+1}" aria-pressed="${(localShades[id]||0)===i}"></button>`).join('');
    $$('[data-shade]').forEach(b=>b.onclick=()=>{if(!state.completed)return;dismissShadeGuide();localShades[id]=Number(b.dataset.shade);save(shadeStorageKey,localShades);renderShades();updateColor();});
  }
  function studentColor(){
    main.innerHTML=`<div class="intro coloring-intro"><h1>给键盘涂色</h1><div id="shade-play" class="shade-play hidden"><div id="shade-options" class="shade-options"></div></div></div>`+
      `<div class="palette">${regions.map(r=>`<button class="color-choice${r.id===selected?' active':''}" data-color="${r.id}" aria-pressed="${r.id===selected}"><i class="dot" style="--c:${r.color}"></i>${r.name}</button>`).join('')}<button class="color-choice" data-color="blank" aria-pressed="false">◇ 擦除</button><span class="paint-feedback"><span class="badge" id="paint-count"></span></span></div>
      <section class="panel"><div class="keyboard-scroll"><div id="keyboard"></div></div><div class="toolbar"><button id="clear" class="quiet">重新填色</button><span class="spacer"></span><button id="complete" class="primary">我填好了 ✓</button></div><div id="saved-note" class="notice hidden">已完成，还可以修改。</div></section>`;
    Lesson.drawKeyboard($('#keyboard'),(b,k)=>{
      const paint=()=>{if(selected==='blank')delete state.colors[k.id];else state.colors[k.id]=selected;state.completed=false;persist();updateColor();};
      b.addEventListener('pointerdown',e=>{if(e.button===0)paint();});
      b.addEventListener('pointerenter',e=>{if(e.buttons===1&&e.pointerType==='mouse')paint();});
      b.addEventListener('click',e=>{if(e.detail===0)paint();}); // 保留键盘和辅助操作触发的点击。
      b.addEventListener('dragstart',e=>e.preventDefault());
    });
    $$('[data-color]').forEach(b=>b.onclick=()=>{selected=b.dataset.color;$$('[data-color]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderShades();updateColor();});
    $('#clear').onclick=()=>{if(confirm('清空这次填色，重新试一试吗？')){state.colors={};state.completed=false;persist();updateColor();}};
    $('#complete').onclick=()=>{if(paintedCount()!==keys.length)return;state.completed=true;persist();updateColor();showShadeGuide();syncStudent(true);toast(isOnline?'选择已同步，可以继续观察键盘。':'选择已保存在本机，连接恢复后自动同步。');};
    renderShades();
    updateColor();
  }
  function paintedCount(){return keys.filter(k=>regions.some(r=>r.id===state.colors[k.id])).length;}
  function updateColor(){
    const progress=Lesson.coloringProgress(state.colors,keys),filled=progress.filled,allFilled=filled===keys.length;
    if(!state.hasFilledAll&&(allFilled||state.completed)){state.hasFilledAll=true;persist();}
    if(state.completed&&!allFilled){state.completed=false;persist();}
    if(!state.completed||selected==='blank')dismissShadeGuide();
    $('#complete').disabled=!allFilled;
    $('#shade-play').classList.toggle('hidden',!state.completed||selected==='blank');
    $$('[data-color] .dot').forEach(dot=>{dot.style.background=displayColor(dot.parentElement.dataset.color);});
    $$('.key').forEach(b=>{const id=state.colors[b.dataset.key],r=regions.find(x=>x.id===id);b.style.background=displayColor(id);b.setAttribute('aria-label',`${keys.find(k=>k.id===b.dataset.key)?.label||'空格键'}，${r?.name||'未填色'}`);});
    $('#paint-count').textContent=`已填 ${filled} / ${keys.length} 格`;
    $('#saved-note').classList.toggle('hidden',!state.completed);$('#complete').textContent=state.completed?'已完成 ✓':'我填好了 ✓';
  }
  let renderedLevel=0,typingLocked=false,typingBatchStart=Math.floor((state.total||0)/7)*7;
  function nextTypingBatch(delay=160){
    typingLocked=true;
    setTimeout(()=>{
      const targets=$('#targets');targets.classList.add('round-out');
      setTimeout(()=>{typingBatchStart=state.total;updateTyping();targets.classList.remove('round-out');targets.classList.add('round-in');
        setTimeout(()=>{targets.classList.remove('round-in');typingLocked=false;},220);
      },180);
    },delay);
  }
  function studentTyping(){
    main.classList.add('typing-main');
    main.innerHTML=
      `<div class="typing-layout"><section class="panel typing-task"><div class="section-head"><span class="lesson-label" id="exercise-label"></span><span class="badge" id="total-count"></span></div><div class="target-strip" id="targets" aria-label="接下来要输入的字符"></div><div class="input-hint" id="input-hint" role="status">看准绿色字符，直接按键。</div><div class="progress-track"><span id="typing-progress"></span></div><div class="typing-bottom" style="justify-content:flex-end"><span id="level-progress"></span></div></section>
      <section class="panel typing-card"><div class="section-head"><h2 id="theme-name"></h2><span class="level-tag" id="level-name"></span></div><p class="swatch-count" id="swatch-count"></p><div class="swatch-grid" id="swatches"></div><div class="celebration" id="celebration">下一格，会是什么颜色呢？</div></section></div>
      <section class="collection"><div class="section-head"><h2>色卡收藏</h2><span class="badge" id="collection-count"></span></div><div id="collection-list" class="collection-list"></div></section>`;
    const targets=$('#targets');
    document.addEventListener('keydown',e=>{
      if(e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      const key=Lesson.typingKey(e);if(!key)return;
      e.preventDefault();if(typingLocked)return;
      if(key.text===targetAt(state.total) && key.main){
        const before=levelInfo(state.total);state.total++;persist();targets.classList.remove('error');$('#input-hint').textContent='找对了！又点亮了一格。';
        const after=levelInfo(state.total);
        const batchFinished=state.total-typingBatchStart===7;
        if(before.level!==after.level){
          // 先让学生看到完整色卡，再进入下一关；过渡期间不接收新字符。
          typingLocked=true;updateTyping(before.level,before.target);$('#celebration').textContent=`${theme(before.level).name}色卡已收集！`;
          syncStudent(true);
          if(batchFinished)nextTypingBatch(850);
          else setTimeout(()=>{typingLocked=false;updateTyping();},850);
        }else{updateTyping();if(batchFinished)nextTypingBatch();}
      }else{targets.classList.remove('error');void targets.offsetWidth;targets.classList.add('error');$('#input-hint').textContent=!key.main?'请用主键盘区上方的数字键。':'再找找目标字符，已经点亮的颜色会保留。';}
    });
    document.addEventListener('paste',e=>{e.preventDefault();});
    updateTyping();
  }
  function updateTyping(displayLevel,displayWithin){
    const actual=levelInfo(state.total),level=displayLevel||actual.level,within=displayWithin??actual.within,target=Lesson.quota(level);
    $('#exercise-label').textContent=level<=2?'找一找 · 字母键':level===3?'找一找 · 主键盘数字键':'试一试 · 字母与数字';
    $('#targets').innerHTML=Array.from({length:7},(_,i)=>{
      const position=typingBatchStart+i,done=position<state.total,current=position===state.total,char=targetAt(position);
      const label=({'1':'数字 1','l':'字母 L','0':'数字 0','o':'字母 O'})[char];
      const glyph=char==='l'?'L':char==='o'?'O':char;
      return `<span class="target-char${done?' done':current?' current':''}${label?' clarified':''}${char==='o'?' letter-o':''}" ${current?'aria-current="true"':''} aria-label="${label||char}"><span class="char-glyph">${glyph}</span>${label?`<small class="char-kind">${label}</small>`:''}</span>`;
    }).join('');
    $('#total-count').textContent=`已正确输入 ${state.total} 个`;
    $('#theme-name').textContent=theme(level).name+'色卡';$('#level-name').textContent=`第 ${level} 关`;
    $('#swatch-count').textContent=`已点亮 ${within} / ${target} 格`;
    $('#swatches').innerHTML=Array.from({length:target},(_,i)=>`<span class="swatch${i<within?' lit':''}${i===within-1?' just-lit':''}" style="--paint:${swatch(level,i,target)}"></span>`).join('');
    $('#typing-progress').style.width=`${within/target*100}%`;$('#level-progress').textContent=`${within} / ${target}`;
    if(!displayLevel)$('#celebration').textContent='集满一张，解锁下一关';
    $('#collection-count').textContent=`已收集 ${completedCards(state.total)} 张`;
    if(renderedLevel!==actual.level){
      $('#collection-list').innerHTML=actual.level===1?'<p>完成第一关，收集色卡。</p>':Array.from({length:Math.min(actual.level-1,100)},(_,i)=>{const lv=actual.level-1-i;return `<div class="mini-card"><div class="mini-grid">${Array.from({length:12},(_,j)=>`<span style="background:${swatch(lv,j,12)}"></span>`).join('')}</div><small>第 ${lv} 关 · ${theme(lv).name}</small></div>`;}).join('');renderedLevel=actual.level;
    }
  }

  function shapeHTML(shapeId){
    const fragment=keys.filter(k=>k.region===shapeId);if(!fragment.length)return '';
    const left=Math.min(...fragment.map(k=>k.x))-.08,top=Math.min(...fragment.map(k=>k.y))-.08;
    const width=Math.max(...fragment.map(k=>k.x+k.w-.07))-left+.08,height=Math.max(...fragment.map(k=>k.y+k.h-.08))-top+.08;
    return `<span class="key-fragment"><svg class="region-fragment" viewBox="${left} ${top} ${width} ${height}" role="img" aria-label="一组键盘按键的局部图" preserveAspectRatio="xMidYMid meet">${fragment.map(k=>{
      const w=k.w-.07,h=k.h-.08,x=k.x+w/2,y=k.y+h/2,label=k.label||'',size=Math.min(.3,(w-.12)/Math.max(1,label.length*.62));
      const face=`<rect class="fragment-key" data-fragment-key="${esc(k.id)}" x="${k.x}" y="${k.y}" width="${w}" height="${h}" rx="${shapeId==='indicator'?.24:.08}" fill="#f1f4f0" stroke="#aebdb3" stroke-width=".025"/>`;
      if(shapeId==='indicator')return face+`<circle cx="${k.x+.25}" cy="${y}" r=".075" fill="#527161"/><text x="${x+.12}" y="${y}" font-size=".25" text-anchor="middle" dominant-baseline="central" fill="#34483e">${esc(label)}</text>`;
      return face+`<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="#34483e">${esc(label)}</text>`;
    }).join('')}</svg></span>`;
  }
  let quizPickLeft=null, quizDraft={},matchResizeObserver=null,activeMatch=null;
  function studentQuiz(){
    main.classList.add('quiz-main');
    if(state.quizVersion!==2){state={quizVersion:2,answers:{},index:0};persist();}
    if(typeof state.index!=='number'||state.index<0)state.index=0;
    if(!state.answers||typeof state.answers!=='object')state.answers={};
    main.addEventListener('click',event=>{const button=event.target.closest('#quiz-prev');if(button&&!button.disabled)goPreviousQuiz();});
    renderQuizStudent();
  }
  function quizPreviousButton(){return `<button id="quiz-prev" class="quiet" ${state.index===0?'disabled':''}>上一题</button>`;}
  function goPreviousQuiz(){
    if(state.index<=0)return;
    const current=quizQuestions[state.index];
    if(current&&current.type!=='mcq'&&!state.answers[current.id]?.checked){
      state.answers[current.id]={value:{...quizDraft},checked:false};
    }
    state.index--;quizPickLeft=null;quizDraft={};persist();renderQuizStudent();
  }
  function renderQuizStudent(){
    matchResizeObserver?.disconnect();activeMatch=null;
    const progress=quizProgress(state.answers);
    if(state.index>=quizQuestions.length){
      main.innerHTML=`<div class="intro"><div><h1>练习完成</h1><p>一共 ${progress.total} 题，答对 ${progress.correct} 题。</p></div><span class="badge">正确率 ${progress.accuracy}%</span></div>
        <section class="panel"><div class="progress-track"><span style="width:100%"></span></div><p class="notice" style="margin-top:18px">可以再看一遍错题，也可以关掉页面休息一下。</p>
        <div class="toolbar">${quizPreviousButton()}<button id="quiz-review" class="quiet">查看作答</button><span class="spacer"></span><button id="quiz-retry" class="primary">再练一次</button></div>
        <div id="quiz-review-list" class="quiz-review hidden"></div></section>`;
      $('#quiz-review').onclick=()=>{
        const box=$('#quiz-review-list');box.classList.toggle('hidden');
        if(box.classList.contains('hidden'))return;
        box.innerHTML=quizQuestions.map((q,i)=>{const a=state.answers[q.id];const ok=a?.correct;return `<div class="quiz-review-row ${ok?'ok':'bad'}"><strong>第 ${i+1} 题</strong><span>${ok?'正确':'再看看'}</span><p>${esc(q.prompt)}</p></div>`;}).join('');
      };
      $('#quiz-retry').onclick=()=>{if(!confirm('清空本次作答，重新练习吗？'))return;state={quizVersion:2,answers:{},index:0};persist();quizDraft={};quizPickLeft=null;renderQuizStudent();syncStudent(true);};
      return;
    }
    const q=quizQuestions[state.index];
    const answered=state.answers[q.id];
    quizDraft=answered?.value && typeof answered.value==='object' && !answered.checked ? {...answered.value} : (answered?.checked?{...(typeof answered.value==='object'?answered.value:{})}:{});
    if(answered?.checked && q.type==='mcq') quizDraft={};
    main.innerHTML=`<div class="quiz-topline"><span class="quiz-counter">第 <strong>${state.index+1}</strong> / ${quizQuestions.length} 题</span><span class="badge">已答对 ${progress.correct} 题</span></div>
      <div class="progress-track quiz-progress"><span style="width:${progress.answered/quizQuestions.length*100}%"></span></div>
      <section class="panel quiz-card" id="quiz-card"><span class="quiz-type">${q.type==='mcq'?'选一选':'配一配 · 先选左边，再选右边'}</span><h2>${esc(q.prompt)}</h2><div id="quiz-body"></div><div id="quiz-feedback" class="quiz-feedback hidden" role="status"></div><div class="toolbar" id="quiz-actions"></div></section>`;
    const body=$('#quiz-body'), actions=$('#quiz-actions'), feedback=$('#quiz-feedback');
    const locked=!!answered?.checked;actions.innerHTML=quizPreviousButton();
    if(q.type==='mcq'){
      body.innerHTML=`<div class="quiz-choices">${q.choices.map((c,i)=>`<button type="button" class="quiz-choice" data-choice="${c.id}" ${locked?'disabled':''}><span class="choice-letter">${String.fromCharCode(65+i)}</span><span class="choice-text">${esc(c.text)}</span><span class="choice-result" aria-hidden="true"></span></button>`).join('')}</div>`;
      if(locked){
        $$('.quiz-choice').forEach(b=>{b.classList.toggle('correct',b.dataset.choice===q.answer);b.classList.toggle('wrong',answered.value===b.dataset.choice&&!answered.correct);b.classList.toggle('picked',answered.value===b.dataset.choice);});
        showQuizFeedback(answered.correct, q);actions.innerHTML=`${quizPreviousButton()}<span class="spacer"></span><button id="quiz-next" class="primary">下一题</button>`;
        $('#quiz-next').onclick=()=>{state.index++;persist();renderQuizStudent();};
      }else{
        $$('.quiz-choice').forEach(b=>b.onclick=()=>{
          const value=b.dataset.choice;const correct=gradeQuizAnswer(q,value);
          state.answers[q.id]={value,correct,checked:true};persist();syncStudent();
          $$('.quiz-choice').forEach(x=>{x.disabled=true;x.classList.toggle('correct',x.dataset.choice===q.answer);x.classList.toggle('wrong',value===x.dataset.choice&&!correct);x.classList.toggle('picked',value===x.dataset.choice);});
          showQuizFeedback(correct,q);
          actions.innerHTML=`${quizPreviousButton()}<span class="spacer"></span><button id="quiz-next" class="primary">下一题</button>`;
          $('#quiz-next').onclick=()=>{state.index++;persist();renderQuizStudent();};
        });
      }
    }else{
      quizPickLeft=null;
      const pairs=locked?(typeof answered.value==='object'?answered.value:{}):quizDraft;
      renderMatchBody(q, pairs, locked);
      if(locked){
        showQuizFeedback(answered.correct,q);
        actions.innerHTML=`${quizPreviousButton()}<span class="spacer"></span><button id="quiz-next" class="primary">下一题</button>`;
        $('#quiz-next').onclick=()=>{state.index++;persist();renderQuizStudent();};
      }else{
        actions.innerHTML=`${quizPreviousButton()}<button id="quiz-clear" class="quiet">清空连线</button><span class="spacer"></span><button id="quiz-check" class="primary" disabled>检查答案</button>`;
        $('#quiz-clear').onclick=()=>{quizDraft={};quizPickLeft=null;renderMatchBody(q,quizDraft,false);$('#quiz-check').disabled=true;};
        $('#quiz-check').onclick=()=>{
          const value={...quizDraft};const correct=gradeQuizAnswer(q,value);
          state.answers[q.id]={value,correct,checked:true};persist();syncStudent();
          renderMatchBody(q,value,true);showQuizFeedback(correct,q);
          actions.innerHTML=`${quizPreviousButton()}<span class="spacer"></span><button id="quiz-next" class="primary">下一题</button>`;
          $('#quiz-next').onclick=()=>{state.index++;persist();renderQuizStudent();};
        };
        updateMatchCheck(q);
      }
    }
  }
  function showQuizFeedback(correct,q){
    const feedback=$('#quiz-feedback');if(!feedback)return;
    const progress=quizProgress(state.answers);
    $('.quiz-topline .badge').textContent=`已答对 ${progress.correct} 题`;
    $('.quiz-progress span').style.width=progress.answered/quizQuestions.length*100+'%';
    feedback.classList.remove('hidden','ok','bad');feedback.classList.add(correct?'ok':'bad');
    feedback.textContent=correct?'答对了！':q.type==='mcq'?'再想一想，正确答案已标出。':'红色虚线表示这组配对不正确。';
  }
  function updateMatchCheck(q){
    const btn=$('#quiz-check');if(!btn)return;
    const need=Object.keys(q.answer).length;btn.disabled=Object.keys(quizDraft).length!==need;
  }
  function drawMatchLines(){
    const board=$('.quiz-match'),svg=$('.match-lines');if(!board||!svg||!activeMatch)return;
    const rect=board.getBoundingClientRect();if(!rect.width||!rect.height)return;
    svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    const {q,pairs,locked}=activeMatch,colors=['#d28a36','#5483c5','#9672c4','#339c88','#c56885'];
    svg.innerHTML=q.left.map((item,index)=>{
      const rightId=pairs[item.id];if(!rightId)return '';
      const left=$$('[data-left]').find(b=>b.dataset.left===item.id),right=$$('[data-right]').find(b=>b.dataset.right===rightId);if(!left||!right)return '';
      const a=left.getBoundingClientRect(),b=right.getBoundingClientRect();
      const x1=a.right-rect.left,y1=a.top+a.height/2-rect.top,x2=b.left-rect.left,y2=b.top+b.height/2-rect.top,curve=(x2-x1)*.45;
      const correct=q.answer[item.id]===rightId,color=locked?(correct?'#25845e':'#c66553'):colors[index%colors.length];
      return `<path d="M ${x1} ${y1} C ${x1+curve} ${y1}, ${x2-curve} ${y2}, ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"${locked&&!correct?' stroke-dasharray="6 5"':''}/><circle cx="${x1}" cy="${y1}" r="4" fill="${color}"/><circle cx="${x2}" cy="${y2}" r="4" fill="${color}"/>`;
    }).join('');
  }
  function renderMatchBody(q, pairs, locked){
    const body=$('#quiz-body');if(!body)return;
    matchResizeObserver?.disconnect();activeMatch={q,pairs:{...pairs},locked};
    const usedRight=new Set(Object.values(pairs||{}));
    body.innerHTML=`<div class="quiz-match${q.type==='match-shape'?' shapes':''}"><svg class="match-lines" aria-hidden="true"></svg><div class="match-col">${q.left.map((item,index)=>{
      const paired=pairs[item.id];
      const label=locked?(paired?'已连接':'未连接'):quizPickLeft===item.id?'请点右侧连接':paired?'已连接，点击可重连':'点这里开始连线';
      return `<button type="button" class="match-item left${quizPickLeft===item.id?' active':''}${paired?' paired':''}${locked?(pairs[item.id]===q.answer[item.id]?' correct':' wrong'):''}" data-left="${item.id}" ${locked?'disabled':''}><span class="match-name"><span class="pair-number">${index+1}</span><strong>${esc(item.text)}</strong></span><small>${esc(label)}</small></button>`;
    }).join('')}</div><div class="match-col">${q.right.map(item=>{
      const taken=usedRight.has(item.id),pairIndex=q.left.findIndex(left=>pairs[left.id]===item.id),ok=taken&&q.answer[q.left[pairIndex].id]===item.id;
      const content=q.type==='match-shape'?shapeHTML(item.shape):esc(item.text);
      return `<button type="button" class="match-item right${taken?' taken':''}${locked&&taken?(ok?' correct':' wrong'):''}" data-right="${item.id}" ${locked?'disabled':''}>${taken?`<span class="paired-mark" aria-label="已连接 ${pairIndex+1}">${pairIndex+1}${locked?(ok?' ✓':' ×'):''}</span>`:''}${content}</button>`;
    }).join('')}</div></div>`;
    drawMatchLines();
    if(typeof ResizeObserver!=='undefined'){
      matchResizeObserver=new ResizeObserver(drawMatchLines);matchResizeObserver.observe($('.quiz-match'));
      $$('[data-left],[data-right]').forEach(b=>matchResizeObserver.observe(b));
    }
    if(locked)return;
    $$('[data-left]').forEach(b=>b.onclick=()=>{
      quizPickLeft=b.dataset.left;
      if(quizDraft[quizPickLeft])delete quizDraft[quizPickLeft];
      renderMatchBody(q,quizDraft,false);updateMatchCheck(q);
    });
    $$('[data-right]').forEach(b=>b.onclick=()=>{
      if(!quizPickLeft){toast('先点左边的名称，再点右边连线');return;}
      for(const [k,v] of Object.entries(quizDraft)){if(v===b.dataset.right)delete quizDraft[k];}
      quizDraft[quizPickLeft]=b.dataset.right;quizPickLeft=null;
      renderMatchBody(q,quizDraft,false);updateMatchCheck(q);
    });
  }
  function regionLabelFromShape(right){
    const r=regions.find(x=>x.id===right.shape);return r?r.name:'示意图';
  }
  function teacherQuiz(){
    teacherShell();
    $('#teacher-content').innerHTML=`<div class="metrics"><div class="metric"><span class="label">参与练习</span><strong id="q-count">0<small>人</small></strong></div><div class="metric"><span class="label">已完成</span><strong id="q-done">0<small>人</small></strong></div><div class="metric"><span class="label">平均答对</span><strong id="q-mean">—</strong></div><div class="metric"><span class="label">最近在线</span><strong id="q-online">0<small>人</small></strong></div></div>
      <div class="quiz-dashboard"><section class="panel"><div class="section-head"><h2>全班进度</h2><span class="badge" id="q-progress-badge">等待加入</span></div><div id="q-progress-bars"></div></section>
      <section class="panel"><div class="section-head"><h2>错题分布</h2><span class="tips">人数 · 比例</span></div><div id="q-wrong"></div></section></div>`;
    renderQuizTeacher();
  }
  function renderQuizTeacher(){
    const n=people.length, done=people.filter(p=>quizProgress(p.answers||{}).finished).length;
    const corrects=people.map(p=>Number(quizProgress(p.answers||{}).correct)||0);
    const mean=n?corrects.reduce((a,b)=>a+b,0)/n:0;
    const online=people.filter(p=>Date.now()-p.updatedAt<90000).length;
    $('#q-count').innerHTML=n+'<small>人</small>';
    $('#q-done').innerHTML=done+'<small>人</small>';
    $('#q-mean').innerHTML=n?mean.toFixed(1)+'<small> / '+quizQuestions.length+'</small>':'—';
    $('#q-online').innerHTML=online+'<small>人</small>';
    $('#q-progress-badge').textContent=n?`完成 ${done} / ${n}`:'等待加入';
    const buckets=Array.from({length:quizQuestions.length+1},()=>0);
    people.forEach(p=>{const a=Number(quizProgress(p.answers||{}).answered)||0;buckets[Math.min(quizQuestions.length,Math.max(0,a))]++;});
    replaceHTML($('#q-progress-bars'),n?buckets.map((count,i)=>`<div class="hist-row"><span>${i===quizQuestions.length?'完成':'答到 '+i}</span><div class="hist-bar"><span style="width:${count/n*100}%;background:${i===quizQuestions.length?'#36a97c':'#7fb399'}"></span></div><span>${count} 人</span></div>`).join(''):'<div class="empty">学生开始作答后，这里会出现进度。</div>');
    const wrong=quizWrongStats(people);
    replaceHTML($('#q-wrong'),n?wrong.map((w,i)=>{
      const rate=w.wrongRate;
      return `<div class="quiz-wrong-row"><div class="quiz-wrong-head"><strong>第 ${i+1} 题</strong><span>${w.attempts?`错误 ${w.wrongCount}/${w.attempts} · ${rate}%`:'尚无人作答'}</span></div><p>${esc(w.prompt)}</p><div class="hist-bar"><span style="width:${rate}%;background:#db8263"></span></div></div>`;
    }).join(''):'<div class="empty">还没有作答数据。</div>');
  }

  function teacherShell(){
    const title=kind==='coloring'?'全班填色':kind==='quiz'?'练习进度':'打字进度';
    main.innerHTML=
      `<div class="teacher-bar"><label for="room">课堂</label><select id="room" aria-label="选择课堂"></select><button id="new-room">新建课堂</button><span style="flex:1"></span><button class="primary" id="copy-link">复制学生链接</button><button id="open-student">打开学生端</button></div>${demo?'<div class="new-room"><button id="demo-seed">生成示例学生</button></div>':''}<div id="teacher-content"></div>`;
    renderClassrooms();
    $('#room').onchange=()=>switchClassroom($('#room').value);
    $('#room').onblur=()=>renderClassrooms();
    $('#new-room').onclick=createClassroom;
    loadClassrooms();
    const studentURL=()=>{const u=new URL('student.html',location.href);u.searchParams.set('room',room);if(demo)u.searchParams.set('demo','1');return u.href;};
    $('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(studentURL());toast('学生链接已复制');}catch{prompt('复制这个链接给学生：',studentURL());}};
    $('#open-student').onclick=()=>window.open(studentURL(),'_blank','noopener');
    if(demo)$('#demo-seed').onclick=seedDemo;
  }
  function switchClassroom(id){
    if(!id||id===room)return;
    save('last-room',id);const u=new URL(location.href);u.searchParams.set('room',id);location.href=u;
  }
  function rememberClassrooms(records){
    classrooms=Lesson.mergeClassrooms(classrooms,records);save(roomCacheKey,classrooms);renderClassrooms();
  }
  function renderClassrooms(){
    const select=$('#room');if(!select||document.activeElement===select)return;
    const signature=JSON.stringify(classrooms);if(signature===roomListSignature)return;
    roomListSignature=signature;
    select.innerHTML=classrooms.map(c=>{
      const name=c.id==='三年级体验'?'体验':c.id.replace(/^三年级-/, '');
      const time=c.createdAt?new Date(c.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'创建时间未记录';
      return `<option value="${esc(c.id)}"${c.id===room?' selected':''}>${esc(name)} · ${esc(time)}</option>`;
    }).join('');
  }
  async function loadClassrooms(){
    try{
      if(document.hidden||navigator.onLine===false||Date.now()<retryAt)return;
      const data=demo?load('demo-classroom-records',[]):(await readRecords()).submissions;
      const records=(data||[]).map(x=>x.data||x.payload||x);
      rememberClassrooms(records.filter(x=>x.type==='classroom').map(x=>({id:x.sessionId,createdAt:x.createdAt})));
      rememberClassrooms(records.filter(x=>x.type==='coloring-snapshot').map(x=>({id:x.sessionId})));
    }catch{toast('课堂列表暂未更新，正在显示已保存的课堂');}
  }
  async function createClassroom(){
    if(creatingRoom)return;creatingRoom=true;const button=$('#new-room');button.disabled=true;$('#room').disabled=true;button.textContent='正在创建…';
    if(!pendingClassroom){
      let id;do{id=Lesson.roomCode(crypto.getRandomValues(new Uint8Array(6)));}while(classrooms.some(c=>c.id===id));
      pendingClassroom={type:'classroom',sessionId:id,createdAt:Date.now()};
    }
    try{
      if(demo){const records=load('demo-classroom-records',[]);records.push(pendingClassroom);save('demo-classroom-records',records);}
      else await post(pendingClassroom);
      rememberClassrooms([{id:pendingClassroom.sessionId,createdAt:pendingClassroom.createdAt}]);switchClassroom(pendingClassroom.sessionId);
    }catch{toast('课堂未确认创建成功，请再试一次');}
    finally{creatingRoom=false;button.disabled=false;$('#room').disabled=false;button.textContent='新建课堂';}
  }
  function teacherColor(){
    teacherShell();$('#teacher-content').innerHTML=`<div class="metrics coloring-metrics"><div class="metric"><span class="label">参与学生</span><strong id="m-count">0<small>人</small></strong></div><div class="metric"><span class="label">最近在线</span><strong id="m-online">0<small>人</small></strong></div><div class="metric"><span class="label">平均填色进度</span><strong id="m-progress">0<small>%</small></strong></div><div class="metric"><span class="label">平均正确率</span><strong id="m-accuracy">0<small>%</small></strong></div><div class="metric"><span class="label">已填完</span><strong id="m-complete">0<small>人</small></strong></div></div>
      <section class="panel"><div class="section-head"><h2 id="board-title">全班混色键盘</h2><button id="answer-toggle">查看标准分区</button></div><div class="legend">${legend()}</div><div id="empty-hint" class="notice">等待学生进入。同一课堂中的学生填色后，这里会自动更新。</div><div class="keyboard-scroll"><div id="keyboard"></div></div></section>
      <div class="below"><section class="panel"><h2>保存快照</h2><div class="toolbar"><button id="save-before">保存讲解前</button><button id="save-after">保存修正后</button></div><p class="tips" id="snapshot-message"></p></section>
      <section class="panel"><div class="section-head"><h2>讲解前后对比</h2><button id="live-view">回到实时</button></div><div id="snapshots"><p class="tips">还没有保存快照。</p></div></section></div><div id="tooltip" role="tooltip" class="tooltip hidden"></div>`;
    Lesson.drawKeyboard($('#keyboard'),(b,k)=>{
      b.onpointerenter=e=>showTip(k,b,e);b.onpointermove=e=>positionTip(e.clientX,e.clientY);b.onpointerleave=()=>$('#tooltip').classList.add('hidden');b.onfocus=()=>showTip(k,b);b.onblur=()=>$('#tooltip').classList.add('hidden');b.onclick=e=>showTip(k,b,e);
    });
    $('#answer-toggle').onclick=()=>{showAnswer=!showAnswer;renderColorTeacher();};
    $('#save-before').onclick=()=>takeSnapshot('before');$('#save-after').onclick=()=>takeSnapshot('after');
    $('#live-view').onclick=()=>{viewSnapshot=null;renderColorTeacher();};
    loadSnapshots();
  }
  let showAnswer=false,viewSnapshot=null;
  function shownPeople(){return viewSnapshot?viewSnapshot.people:people;}
  function renderColorTeacher(){
    const data=shownPeople(),n=data.length,progress=data.map(p=>Lesson.coloringProgress(p.colors||{},keys));
    $('#m-count').innerHTML=n+'<small>人</small>';$('#m-online').innerHTML=people.filter(p=>Date.now()-p.updatedAt<90000).length+'<small>人</small>';
    const painted=progress.reduce((sum,p)=>sum+p.filled,0);
    $('#m-progress').innerHTML=(n?Math.round(painted/(n*keys.length)*100):0)+'<small>%</small>';
    const averageAccuracy=n?Math.floor(progress.reduce((sum,p)=>sum+(p.filled?p.correct/p.filled:0),0)/n*1000)/10:0;
    $('#m-accuracy').innerHTML=averageAccuracy+'<small>%</small>';
    $('#m-complete').innerHTML=data.filter((p,i)=>p.hasFilledAll||p.completed||progress[i].filled===keys.length).length+'<small>人</small>';
    $('#empty-hint').classList.toggle('hidden',n>0);
    $('#board-title').textContent=showAnswer?'标准分区 · 用于讲解':viewSnapshot?`${viewSnapshot.label} · ${n} 人快照`:'全班混色键盘';
    $('#answer-toggle').textContent=showAnswer?'回到混色键盘':'查看标准分区';
    $$('.key').forEach((b,i)=>{const k=keys[i];
      if(showAnswer)b.style.background=regions.find(r=>r.id===k.region).color;
      else {const counts=distribution(data,k.id),mix=mixShares(counts);let angle=0;const parts=mix.shares.map(s=>{const start=angle;angle+=s.ratio*360;return `${s.color} ${start}deg ${angle}deg`;});b.style.background=mix.filled?`conic-gradient(${parts.join(',')})`:'#edf1eb';}
    });
  }
  function showTip(k,b,e){
    const tip=$('#tooltip'),data=shownPeople(),counts=distribution(data,k.id),mix=mixShares(counts),filled=mix.filled;
    tip.innerHTML=`<strong>${esc(k.label||'空格键')}${k.region==='indicator'?' 指示灯':''}</strong>`+regions.map(r=>`<div class="tiprow"><span><i class="dot" style="--c:${r.color}"></i>${r.name}</span><span>${counts[r.id]} 人 · ${filled?Math.round(counts[r.id]/filled*100):0}%</span></div>`).join('');
    tip.classList.remove('hidden');const rect=b.getBoundingClientRect();positionTip(e?.clientX||rect.x,e?.clientY||rect.y);
  }
  function positionTip(x,y){const tip=$('#tooltip');tip.style.left=Math.max(8,Math.min(x+15,innerWidth-tip.offsetWidth-8))+'px';tip.style.top=Math.max(8,Math.min(y+15,innerHeight-tip.offsetHeight-12))+'px';}
  async function takeSnapshot(which){
    if(!people.length)return toast('还没有学生填色，先邀请学生进入');
    const button=which==='before'?$('#save-before'):$('#save-after');button.disabled=true;
    const record={type:'coloring-snapshot',sessionId:room,snapshotId:crypto.randomUUID(),label:which==='before'?'讲解前':'修正后',phase:which,createdAt:Date.now(),people:JSON.parse(JSON.stringify(people))};
    try{await post(record);snapshots.push(record);renderSnapshots();$('#snapshot-message').textContent=record.label+'快照已保存';toast('已保存'+record.label+'全班快照');}catch{$('#snapshot-message').textContent='保存失败，请确认连接后再试；当前实时数据仍保留。';}finally{button.disabled=false;}
  }
  async function loadSnapshots(){
    try{const data=demo?load('demo-snapshots:'+room,[]):(await readRecords()).submissions;
      snapshots=(data||[]).map(x=>x.data||x.payload||x).filter(x=>x.type==='coloring-snapshot'&&x.sessionId===room&&Array.isArray(x.people));renderSnapshots();
    }catch{$('#snapshots').innerHTML='<p class="tips">历史快照暂时无法读取，实时看板仍可使用。</p>';}
  }
  function renderSnapshots(){
    const target=$('#snapshots');replaceHTML(target,snapshots.length?snapshots.slice().reverse().map((s,i)=>`<div class="snapshot-row"><span>${esc(s.label)} · ${s.people.length} 人<br><small>${new Date(s.createdAt).toLocaleTimeString('zh-CN')}</small></span><button data-snapshot="${snapshots.length-1-i}">查看</button></div>`).join(''):'<p class="tips">还没有保存快照。</p>');
    $$('[data-snapshot]').forEach(b=>b.onclick=()=>{viewSnapshot=snapshots[Number(b.dataset.snapshot)];showAnswer=false;renderColorTeacher();});
  }
  function teacherTyping(){
    teacherShell();$('#teacher-content').innerHTML=`<div class="metrics"><div class="metric"><span class="label">参与练习</span><strong id="t-count">0<small>人</small></strong></div><div class="metric"><span class="label">最多获得</span><strong id="t-max">—</strong></div><div class="metric"><span class="label">平均获得</span><strong id="t-mean">—</strong></div><div class="metric"><span class="label">累计正确输入</span><strong id="t-total">0<small>个</small></strong></div></div>
      <section class="panel"><h2>色卡收集进度</h2><div class="percentile" id="percentiles"></div></section>
      <section class="panel" style="margin-top:22px"><h2>色卡数量分布</h2><div id="histogram"></div><p class="tips" id="typing-observation"></p></section>`;renderTypingTeacher();
  }
  function renderTypingTeacher(){
    const s=stats(people);$('#t-count').innerHTML=s.count+'<small>人</small>';$('#t-max').innerHTML=s.count?s.max+'<small>张色卡</small>':'—';$('#t-mean').innerHTML=s.count?s.mean.toFixed(1)+'<small>张色卡</small>':'—';$('#t-total').innerHTML=people.reduce((sum,p)=>sum+(Number(p.total)||0),0)+'<small>个</small>';
    $('#percentiles').innerHTML=s.thresholds.map(x=>`<div class="percentile-card"><span>前 ${x.percent}% 学生</span><strong>${s.count?x.cards+' 张色卡':'等待加入'}</strong></div>`).join('');
    const counts={};people.forEach(p=>{const lv=collectedCardCount(p);counts[lv]=(counts[lv]||0)+1;});
    replaceHTML($('#histogram'),s.count?Object.keys(counts).sort((a,b)=>Number(a)-Number(b)).map(l=>`<div class="hist-row"><span>${l} 张色卡</span><div class="hist-bar"><span style="width:${counts[l]/s.count*100}%;background:${swatch(Math.max(1,Number(l)),4,12)}"></span></div><span>${counts[l]} 人</span></div>`).join(''):'<div class="empty">学生开始输入后，这里会显示已获得色卡的数量分布。</div>');
    const online=people.filter(p=>Date.now()-p.updatedAt<90000).length;
    $('#typing-observation').textContent=`最近在线 ${online} 人 · 只统计完整获得的色卡`;
  }
  let peopleSignature='',lastTeacherRender=0;
  async function pollTeacher(){
    if(pollBusy||document.hidden||navigator.onLine===false||Date.now()<retryAt)return;pollBusy=true;
    try{const values=await readStates();people=values.filter(v=>v.key.startsWith(kind+':'+room+':')&&v.sessionId===room&&v.kind===kind&&v.studentId&&(kind!=='quiz'||v.quizVersion===2));
      rememberClassrooms(values.filter(v=>v.kind===kind&&v.sessionId&&v.studentId).map(v=>({id:v.sessionId})));
      const signature=JSON.stringify(people.map(p=>[p.studentId,kind==='coloring'?p.colors:kind==='quiz'?[p.answered,p.correct,p.finished,p.answers]:[p.total,p.collectedCards]]));
      if(signature!==peopleSignature||Date.now()-lastTeacherRender>=30000){
        if(kind==='coloring')renderColorTeacher();else if(kind==='quiz')renderQuizTeacher();else renderTypingTeacher();
        peopleSignature=signature;lastTeacherRender=Date.now();
      }
      status(true,'看板已同步');
    }catch{status(false,'连接暂断 · 显示最近结果');}finally{pollBusy=false;}
  }
  async function seedDemo(){
    const all=getDemo();for(let i=0;i<16;i++){
      const id='demo-'+String(i+1).padStart(2,'0');
      if(kind==='quiz'){
        const answers={};let answered=0,correct=0;
        quizQuestions.forEach((q,qi)=>{if(qi>i%12)return;const ok=qi%3!==1;answers[q.id]={checked:true,correct:ok,value:q.type==='mcq'?q.answer:{...q.answer}};answered++;if(ok)correct++;});
        const p=quizProgress(answers);all[`${kind}:${room}:${id}`]={expires:Date.now()+7200000,value:{sessionId:room,studentId:id,kind,updatedAt:Date.now(),answers,index:p.answered,answered:p.answered,correct:p.correct,finished:p.finished}};
      }else{
        const colors={};keys.forEach((k,j)=>{if((j+i)%19!==0)colors[k.id]=(j+i)%11===0?regions[(i+j)%5].id:k.region;});
        all[`${kind}:${room}:${id}`]={expires:Date.now()+7200000,value:{sessionId:room,studentId:id,kind,updatedAt:Date.now(),colors,completed:i%3===0,total:i*9}};
      }
    }localStorage.setItem(demoKey,JSON.stringify(all));await pollTeacher();toast('已生成 16 位示例学生');
  }
  let networkTimer,recordsTimer;
  function scheduleNetwork(delay){
    clearTimeout(networkTimer);
    networkTimer=setTimeout(async()=>{
      try{if(teacher)await pollTeacher();else await syncStudent();}
      finally{scheduleNetwork(document.hidden?30000:Math.max(teacher?5000:uploadDelay,retryAt-Date.now())+Math.random()*1000);}
    },delay);
  }
  function scheduleRecords(){
    clearTimeout(recordsTimer);
    recordsTimer=setTimeout(async()=>{try{await loadClassrooms();}finally{scheduleRecords();}},180000+Math.random()*5000);
  }
  if(teacher){kind==='coloring'?teacherColor():kind==='quiz'?teacherQuiz():teacherTyping();scheduleRecords();}
  else{kind==='coloring'?studentColor():kind==='quiz'?studentQuiz():studentTyping();}
  scheduleNetwork(Math.random()*3000);
  if(!storageOK)toast('浏览器限制了本机保存，请保持网页打开以免丢失进度。');
  window.addEventListener('online',()=>scheduleNetwork(Math.max(1000,retryAt-Date.now())+Math.random()*2000));
  document.addEventListener('visibilitychange',()=>scheduleNetwork(document.hidden?30000:1000+Math.random()*2000));
  // 自动化验收及教师调试只读入口，无上传或修改能力。
  window.lessonState=()=>({kind,role:cfg.role,room,demo,state:JSON.parse(JSON.stringify(state)),people:JSON.parse(JSON.stringify(people))});
})();
