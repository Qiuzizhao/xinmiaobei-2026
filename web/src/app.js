(async function () {
  'use strict';
  const {regions,keys,levelInfo,theme,swatch,targetAt,stats,distribution,normalizeStates}=Lesson;
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cfg=window.APP_CONFIG, kind=cfg.kind, teacher=cfg.role==='teacher';
  const params=new URLSearchParams(location.search), demo=params.get('demo')==='1';
  const room=(params.get('room')||'三年级体验').trim().slice(0,64)||'三年级体验';
  const storagePrefix=`keyboard-v1:${kind}:`, defaultState=kind==='coloring'?{colors:{}}:{total:0};
  let storageOK=true;
  function load(key,fallback){try{return JSON.parse(localStorage.getItem(storagePrefix+key))??fallback;}catch{storageOK=false;return fallback;}}
  function save(key,value){try{localStorage.setItem(storagePrefix+key,JSON.stringify(value));}catch{storageOK=false;}}
  let studentId=load('device',null);
  if(!studentId){studentId=crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now();save('device',studentId);}
  const localKey=`${demo?'demo:':''}${room}:student`;
  let state={...defaultState,...load(localKey,{})}, people=[], snapshots=[], selected='main';
  let dirty=true, busy=false, lastSent=0, isOnline=false, pollBusy=false;
  const base=`https://qiuform.qiuzizhao.com/api/${cfg.taskId}`;
  const demoKey=`${storagePrefix}demo-state:${room}`;
  let toastTimer;
  function toast(message){let e=$('#toast');if(!e){e=document.createElement('div');e.id='toast';e.className='toast';e.setAttribute('role','status');document.body.append(e);}e.textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.remove(),3200);}
  function status(ok,text){const e=$('#sync');if(!e)return;e.className='status '+(ok?'ok':'error');e.textContent=text;isOnline=ok;}
  async function request(path,method='GET',body){
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),8000);
    try {const r=await fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:ctrl.signal,cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(data.ok===false)throw Error(data.error||'请求未完成');return data;
    } finally {clearTimeout(timer);}
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
    return request('','POST',value);
  }
  function persist(){save(localKey,state);dirty=true;}
  function payload(){return {sessionId:room,studentId,kind,updatedAt:Date.now(),...(kind==='coloring'?{colors:state.colors,completed:!!state.completed}:{total:state.total,level:levelInfo(state.total).level})};}
  async function syncStudent(force=false){
    if(busy || (!force&&!dirty&&Date.now()-lastSent<20000))return;
    busy=true;dirty=false;
    try{await put(`${kind}:${room}:${studentId}`,payload());lastSent=Date.now();status(true,'已同步');}
    catch{dirty=true;status(false,'正在重连');}
    finally{busy=false;}
  }
  document.body.innerHTML=`<header><div class="brand"><span class="brandmark">${kind==='coloring'?'▦':'◈'}</span><span>${cfg.title}<small>认识键盘 · ${teacher?'教师看板':'一起动手试一试'}</small></span></div><div style="display:flex;gap:8px;align-items:center"><span class="badge">${teacher?'教师端':'学生端'}</span><span class="status" id="sync">正在连接</span></div></header><main id="main"></main>`;
  const main=$('#main');
  if(demo)main.insertAdjacentHTML('beforebegin','<div class="offline-banner" style="margin:12px 4vw 0">示例体验 · 不计入课堂</div>');
  function intro(title,desc,tag){return `<div class="intro"><div><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div></div>`;}
  function legend(){return regions.map(r=>`<span><i class="dot" style="--c:${r.color}"></i>${r.name}</span>`).join('')+'<span><i class="dot"></i>未填色</span>';}
  function studentColor(){
    main.innerHTML=intro('给键盘涂色','选颜色，点格子；按住鼠标可连续涂色。','任务 01 / 键盘调色室')+
      `<div class="palette">${regions.map(r=>`<button class="color-choice${r.id===selected?' active':''}" data-color="${r.id}" aria-pressed="${r.id===selected}"><i class="dot" style="--c:${r.color}"></i>${r.name}</button>`).join('')}<button class="color-choice" data-color="blank" aria-pressed="false">◇ 擦除</button></div>
      <section class="panel"><div class="section-head"><h2>键盘</h2><span class="badge" id="paint-count"></span></div><div class="keyboard-scroll"><div id="keyboard"></div></div><div class="toolbar"><button id="clear" class="quiet">重新填色</button><span class="spacer"></span><button id="complete" class="primary">我填好了 ✓</button></div><div id="saved-note" class="notice hidden">已完成，还可以修改。</div></section>`;
    Lesson.drawKeyboard($('#keyboard'),(b,k)=>{
      const paint=()=>{if(selected==='blank')delete state.colors[k.id];else state.colors[k.id]=selected;state.completed=false;persist();updateColor();};
      b.addEventListener('click',paint);b.addEventListener('pointerenter',e=>{if(e.buttons===1&&e.pointerType==='mouse')paint();});
      b.addEventListener('dragstart',e=>e.preventDefault());
    });
    $$('[data-color]').forEach(b=>b.onclick=()=>{selected=b.dataset.color;$$('[data-color]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});});
    $('#clear').onclick=()=>{if(confirm('清空这次填色，重新试一试吗？')){state.colors={};state.completed=false;persist();updateColor();}};
    $('#complete').onclick=async()=>{state.completed=true;persist();updateColor();await syncStudent(true);toast(isOnline?'选择已同步，可以继续观察键盘。':'选择已保存在本机，连接恢复后自动同步。');};
    updateColor();
  }
  function updateColor(){
    $$('.key').forEach(b=>{const id=state.colors[b.dataset.key],r=regions.find(x=>x.id===id);b.style.background=r?.color||'';b.setAttribute('aria-label',`${keys.find(k=>k.id===b.dataset.key)?.label||'空格键'}，${r?.name||'未填色'}`);});
    $('#paint-count').textContent=`已填 ${Object.keys(state.colors).filter(k=>keys.some(x=>x.id===k)).length} / ${keys.length} 格`;
    $('#saved-note').classList.toggle('hidden',!state.completed);$('#complete').textContent=state.completed?'已完成 ✓':'我填好了 ✓';
  }
  let renderedLevel=0,typingLocked=false;
  function studentTyping(){
    main.innerHTML=intro('打字，点亮色卡','输入目标字符，每次点亮一格。','任务 02 / 打字拾色记')+
      `<div class="typing-layout"><section class="panel typing-task"><div class="section-head"><span class="lesson-label" id="exercise-label"></span><span class="badge" id="total-count"></span></div><div class="target-strip" id="targets" aria-label="接下来要输入的字符"></div><input id="typing-input" class="typing-input" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" aria-label="在这里输入目标字母或数字" placeholder="点击这里，开始打字"/><div class="input-hint" id="input-hint" role="status">请使用英文输入。</div><div class="progress-track"><span id="typing-progress"></span></div><div class="typing-bottom"><span>主键盘区 · 字母与数字</span><span id="level-progress"></span></div></section>
      <section class="panel"><div class="section-head"><h2 id="theme-name"></h2><span class="level-tag" id="level-name"></span></div><p class="swatch-count" id="swatch-count"></p><div class="swatch-grid" id="swatches"></div><div class="celebration" id="celebration">下一格，会是什么颜色呢？</div></section></div>
      <section class="collection"><div class="section-head"><h2>色卡收藏</h2><span class="badge" id="collection-count"></span></div><div id="collection-list" class="collection-list"></div></section>`;
    const input=$('#typing-input');let lastCode='',lastCodeAt=0;
    input.addEventListener('keydown',e=>{lastCode=e.code;lastCodeAt=Date.now();if(e.key==='Enter')e.preventDefault();});
    input.addEventListener('paste',e=>{e.preventDefault();$('#input-hint').textContent='请一个一个输入，自己点亮色卡。';});
    input.addEventListener('drop',e=>e.preventDefault());
    input.addEventListener('input',e=>{
      if(e.isComposing)return;
      const text=input.value;input.value='';if(!text || typingLocked)return;
      if(e.inputType==='insertFromPaste'||Array.from(text).length!==1){$('#input-hint').textContent='请切换到英文输入状态，一个一个输入。';return;}
      if(text.toLowerCase()===targetAt(state.total) && !(lastCode.startsWith('Numpad')&&Date.now()-lastCodeAt<1500)){
        const before=levelInfo(state.total);state.total++;persist();input.classList.remove('error');$('#input-hint').textContent='找对了！又点亮了一格。';
        const after=levelInfo(state.total);
        if(before.level!==after.level){
          // 先让学生看到完整色卡，再进入下一关；过渡期间不接收新字符。
          typingLocked=true;updateTyping(before.level,before.target);$('#celebration').textContent=`${theme(before.level).name}色卡已收集！`;
          syncStudent(true);setTimeout(()=>{typingLocked=false;updateTyping();input.focus();},850);
        }else updateTyping();
      }else{input.classList.remove('error');void input.offsetWidth;input.classList.add('error');$('#input-hint').textContent=lastCode.startsWith('Numpad')&&Date.now()-lastCodeAt<1500?'请用主键盘区上方的数字键。':'再找找目标字符，已经点亮的颜色会保留。';}
    });
    input.addEventListener('compositionend',()=>{input.value='';$('#input-hint').textContent='请先切换到英文输入状态。';});
    updateTyping();
  }
  function updateTyping(displayLevel,displayWithin){
    const actual=levelInfo(state.total),level=displayLevel||actual.level,within=displayWithin??actual.within,target=Lesson.quota(level);
    $('#exercise-label').textContent=level<=2?'找一找 · 字母键':level===3?'找一找 · 主键盘数字键':'试一试 · 字母与数字';
    $('#targets').innerHTML=Array.from({length:7},(_,i)=>`<span class="target-char${i===0?' current':''}" ${i===0?'aria-current="true"':''}>${targetAt(state.total+i)}</span>`).join('');
    $('#total-count').textContent=`已正确输入 ${state.total} 个`;
    $('#theme-name').textContent=theme(level).name+'色卡';$('#level-name').textContent=`第 ${level} 关`;
    $('#swatch-count').textContent=`已点亮 ${within} / ${target} 格`;
    $('#swatches').innerHTML=Array.from({length:target},(_,i)=>`<span class="swatch${i<within?' lit':''}${i===within-1?' just-lit':''}" style="--paint:${swatch(level,i,target)}"></span>`).join('');
    $('#typing-progress').style.width=`${within/target*100}%`;$('#level-progress').textContent=`${within} / ${target}`;
    if(!displayLevel)$('#celebration').textContent='集满一张，解锁下一关';
    $('#collection-count').textContent=`已收集 ${actual.level-1} 张`;
    if(renderedLevel!==actual.level){
      $('#collection-list').innerHTML=actual.level===1?'<p>完成第一关，收集色卡。</p>':Array.from({length:Math.min(actual.level-1,100)},(_,i)=>{const lv=actual.level-1-i;return `<div class="mini-card"><div class="mini-grid">${Array.from({length:12},(_,j)=>`<span style="background:${swatch(lv,j,12)}"></span>`).join('')}</div><small>第 ${lv} 关 · ${theme(lv).name}</small></div>`;}).join('');renderedLevel=actual.level;
    }
  }
  function teacherShell(){
    const title=kind==='coloring'?'全班填色':'打字进度';
    main.innerHTML=intro(title,'',kind==='coloring'?'键盘调色室 / 教师看板':'打字拾色记 / 教师看板')+
      `<div class="teacher-bar"><label for="room">课堂</label><input id="room" value="${esc(room)}" aria-label="课堂编号"><button id="open-room">切换</button><button id="new-room">新建课堂</button><span style="flex:1"></span><button class="primary" id="copy-link">复制学生链接</button><button id="open-student">打开学生端</button></div>${demo?'<div class="new-room"><button id="demo-seed">生成示例学生</button></div>':''}<div id="teacher-content"></div>`;
    $('#open-room').onclick=()=>{const next=$('#room').value.trim();if(!next)return toast('请给这节课起一个简短编号');const u=new URL(location.href);u.searchParams.set('room',next);location.href=u;};
    $('#new-room').onclick=()=>{const now=new Date(),id=`三年级-${now.getMonth()+1}${now.getDate()}-${now.getHours()}${String(now.getMinutes()).padStart(2,'0')}-${Math.random().toString(36).slice(2,5)}`;$('#room').value=id;$('#open-room').click();};
    const studentURL=()=>{const u=new URL('student.html',location.href);u.searchParams.set('room',room);if(demo)u.searchParams.set('demo','1');return u.href;};
    $('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(studentURL());toast('学生链接已复制');}catch{prompt('复制这个链接给学生：',studentURL());}};
    $('#open-student').onclick=()=>window.open(studentURL(),'_blank','noopener');
    if(demo)$('#demo-seed').onclick=seedDemo;
  }
  function teacherColor(){
    teacherShell();$('#teacher-content').innerHTML=`<div class="metrics"><div class="metric"><span class="label">参与学生</span><strong id="m-count">0<small>人</small></strong></div><div class="metric"><span class="label">最近在线</span><strong id="m-online">0<small>人</small></strong></div><div class="metric"><span class="label">平均填色进度</span><strong id="m-progress">0<small>%</small></strong></div><div class="metric"><span class="label">已点击完成</span><strong id="m-complete">0<small>人</small></strong></div></div>
      <section class="panel"><div class="section-head"><h2 id="board-title">全班混色键盘</h2><button id="answer-toggle">查看标准分区</button></div><div class="legend">${legend()}</div><div id="empty-hint" class="notice">等待学生进入。同一课堂中的学生填色后，这里会自动更新。</div><div class="keyboard-scroll"><div id="keyboard"></div></div><div class="keyboard-note"><span>悬停或点击任意格子，查看人数与百分比。</span><span id="updated"></span></div></section>
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
    const data=shownPeople(),n=data.length,valid=new Set(keys.map(k=>k.id));
    $('#m-count').innerHTML=n+'<small>人</small>';$('#m-online').innerHTML=people.filter(p=>Date.now()-p.updatedAt<90000).length+'<small>人</small>';
    const painted=data.reduce((sum,p)=>sum+Object.keys(p.colors||{}).filter(k=>valid.has(k)).length,0);
    $('#m-progress').innerHTML=(n?Math.round(painted/(n*keys.length)*100):0)+'<small>%</small>';
    $('#m-complete').innerHTML=data.filter(p=>p.completed).length+'<small>人</small>';
    $('#empty-hint').classList.toggle('hidden',n>0);
    $('#board-title').textContent=showAnswer?'标准分区 · 用于讲解':viewSnapshot?`${viewSnapshot.label} · ${n} 人快照`:'全班混色键盘';
    $('#answer-toggle').textContent=showAnswer?'回到混色键盘':'查看标准分区';
    $$('.key').forEach((b,i)=>{const k=keys[i];
      if(showAnswer)b.style.background=regions.find(r=>r.id===k.region).color;
      else {const counts=distribution(data,k.id);let angle=0;const parts=[...regions,{id:'blank',color:'#edf1eb'}].filter(r=>counts[r.id]>0).map(r=>{const start=angle;angle+=counts[r.id]/n*360;return `${r.color} ${start}deg ${angle}deg`;});b.style.background=n?`conic-gradient(${parts.join(',')})`:'#edf1eb';}
    });
    $('#updated').textContent='每 2 秒自动更新';
  }
  function showTip(k,b,e){
    const tip=$('#tooltip'),data=shownPeople(),n=data.length,counts=distribution(data,k.id);
    tip.innerHTML=`<strong>${esc(k.label||'空格键')}${k.region==='indicator'?' 指示灯':''}</strong>`+[...regions,{id:'blank',name:'未填色',color:'#e4e9e0'}].map(r=>`<div class="tiprow"><span><i class="dot" style="--c:${r.color}"></i>${r.name}</span><span>${counts[r.id]} 人 · ${n?Math.round(counts[r.id]/n*100):0}%</span></div>`).join('')+`<p class="tiptotal">按本课堂 ${n} 位参与学生计算</p>`;
    tip.classList.remove('hidden');const rect=b.getBoundingClientRect();positionTip(e?.clientX||rect.x,e?.clientY||rect.y);
  }
  function positionTip(x,y){const tip=$('#tooltip');tip.style.left=Math.max(8,Math.min(x+15,innerWidth-280))+'px';tip.style.top=Math.max(8,Math.min(y+15,innerHeight-tip.offsetHeight-12))+'px';}
  async function takeSnapshot(which){
    if(!people.length)return toast('还没有学生填色，先邀请学生进入');
    const button=which==='before'?$('#save-before'):$('#save-after');button.disabled=true;
    const record={type:'coloring-snapshot',sessionId:room,snapshotId:crypto.randomUUID(),label:which==='before'?'讲解前':'修正后',phase:which,createdAt:Date.now(),people:JSON.parse(JSON.stringify(people))};
    try{await post(record);snapshots.push(record);renderSnapshots();$('#snapshot-message').textContent=record.label+'快照已保存';toast('已保存'+record.label+'全班快照');}catch{$('#snapshot-message').textContent='保存失败，请确认连接后再试；当前实时数据仍保留。';}finally{button.disabled=false;}
  }
  async function loadSnapshots(){
    try{const data=demo?load('demo-snapshots:'+room,[]):(await request('/all')).submissions;
      snapshots=(data||[]).map(x=>x.data||x.payload||x).filter(x=>x.type==='coloring-snapshot'&&x.sessionId===room&&Array.isArray(x.people));renderSnapshots();
    }catch{$('#snapshots').innerHTML='<p class="tips">历史快照暂时无法读取，实时看板仍可使用。</p>';}
  }
  function renderSnapshots(){
    const target=$('#snapshots');target.innerHTML=snapshots.length?snapshots.slice().reverse().map((s,i)=>`<div class="snapshot-row"><span>${esc(s.label)} · ${s.people.length} 人<br><small>${new Date(s.createdAt).toLocaleTimeString('zh-CN')}</small></span><button data-snapshot="${snapshots.length-1-i}">查看</button></div>`).join(''):'<p class="tips">还没有保存快照。</p>';
    $$('[data-snapshot]').forEach(b=>b.onclick=()=>{viewSnapshot=snapshots[Number(b.dataset.snapshot)];showAnswer=false;renderColorTeacher();});
  }
  function teacherTyping(){
    teacherShell();$('#teacher-content').innerHTML=`<div class="metrics"><div class="metric"><span class="label">参与练习</span><strong id="t-count">0<small>人</small></strong></div><div class="metric"><span class="label">目前最高</span><strong id="t-max">—</strong></div><div class="metric"><span class="label">平均关卡</span><strong id="t-mean">—</strong></div><div class="metric"><span class="label">累计正确输入</span><strong id="t-total">0<small>个</small></strong></div></div>
      <section class="panel"><h2>分层进度</h2><div class="percentile" id="percentiles"></div></section>
      <section class="panel" style="margin-top:22px"><h2>关卡分布</h2><div id="histogram"></div><p class="tips" id="typing-observation"></p></section>`;renderTypingTeacher();
  }
  function renderTypingTeacher(){
    const s=stats(people);$('#t-count').innerHTML=s.count+'<small>人</small>';$('#t-max').innerHTML=s.count?s.max+'<small>关</small>':'—';$('#t-mean').innerHTML=s.count?s.mean.toFixed(1)+'<small>关</small>':'—';$('#t-total').innerHTML=people.reduce((sum,p)=>sum+(Number(p.total)||0),0)+'<small>个</small>';
    $('#percentiles').innerHTML=s.thresholds.map(x=>`<div class="percentile-card"><span>前 ${x.percent}% 学生至少到</span><strong>${s.count?'第 '+x.level+' 关':'等待加入'}</strong></div>`).join('');
    const counts={};people.forEach(p=>{const lv=levelInfo(p.total).level;counts[lv]=(counts[lv]||0)+1;});
    $('#histogram').innerHTML=s.count?Object.keys(counts).sort((a,b)=>Number(a)-Number(b)).map(l=>`<div class="hist-row"><span>第 ${l} 关</span><div class="hist-bar"><span style="width:${counts[l]/s.count*100}%;background:${swatch(Number(l),4,12)}"></span></div><span>${counts[l]} 人</span></div>`).join(''):'<div class="empty">学生开始输入后，这里会出现关卡分布。</div>';
    const online=people.filter(p=>Date.now()-p.updatedAt<90000).length;
    $('#typing-observation').textContent=`最近在线 ${online} 人 · 当前关卡为正在挑战的关卡`;
  }
  async function pollTeacher(){
    if(pollBusy)return;pollBusy=true;
    try{const values=await readStates();people=values.filter(v=>v.key.startsWith(kind+':'+room+':')&&v.sessionId===room&&v.kind===kind&&v.studentId);
      if(kind==='coloring')renderColorTeacher();else renderTypingTeacher();status(true,'看板已同步');
    }catch{status(false,'连接暂断 · 显示最近结果');}finally{pollBusy=false;}
  }
  async function seedDemo(){
    const all=getDemo();for(let i=0;i<16;i++){
      const id='demo-'+String(i+1).padStart(2,'0'),colors={};keys.forEach((k,j)=>{if((j+i)%19!==0)colors[k.id]=(j+i)%11===0?regions[(i+j)%5].id:k.region;});
      all[`${kind}:${room}:${id}`]={expires:Date.now()+7200000,value:{sessionId:room,studentId:id,kind,updatedAt:Date.now(),colors,completed:i%3===0,total:i*9}};
    }localStorage.setItem(demoKey,JSON.stringify(all));await pollTeacher();toast('已生成 16 位示例学生');
  }
  if(teacher){kind==='coloring'?teacherColor():teacherTyping();await pollTeacher();setInterval(pollTeacher,2000);}
  else{kind==='coloring'?studentColor():studentTyping();await syncStudent(true);setInterval(()=>syncStudent(),2000);}
  if(!storageOK)toast('浏览器限制了本机保存，请保持网页打开以免丢失进度。');
  window.addEventListener('online',()=>teacher?pollTeacher():syncStudent(true));
  // 自动化验收及教师调试只读入口，无上传或修改能力。
  window.lessonState=()=>({kind,role:cfg.role,room,demo,state:JSON.parse(JSON.stringify(state)),people:JSON.parse(JSON.stringify(people))});
})();
