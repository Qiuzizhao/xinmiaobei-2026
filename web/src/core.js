(function (root) {
  'use strict';
  const regions = [
    {id:'main', name:'主键盘区', color:'#ed6874', desc:'输入字母、数字等内容'},
    {id:'function', name:'功能键区', color:'#f1bf52', desc:'完成一些功能操作'},
    {id:'editing', name:'编辑键区', color:'#688ee6', desc:'移动光标、翻页和编辑'},
    {id:'numeric', name:'小键盘区', color:'#54b997', desc:'集中输入数字'},
    {id:'indicator', name:'指示灯区', color:'#a287cf', desc:'显示键盘的状态'}
  ];
  const themes = [
    ['珊瑚红', 355], ['日落橙', 24], ['向阳黄', 45], ['薄荷绿', 146],
    ['浅海青', 181], ['晴空蓝', 211], ['鸢尾紫', 266], ['玫瑰粉', 321],
    ['草莓红', 348, 85], ['蜜桃粉', 10, 65], ['南瓜橙', 28, 86], ['琥珀金', 38, 90],
    ['柠檬黄', 56, 88], ['青柠绿', 79, 76], ['嫩芽绿', 99, 65], ['青草绿', 120, 60],
    ['森林绿', 140, 48], ['翡翠绿', 158, 76], ['湖水青', 172, 65], ['冰川青', 190, 56],
    ['海盐蓝', 201, 48], ['蔚蓝海', 219, 82], ['宝石蓝', 230, 85], ['星夜蓝', 242, 55],
    ['风信紫', 252, 62], ['薰衣紫', 275, 50], ['葡萄紫', 286, 72], ['丁香紫', 297, 46],
    ['兰花紫', 309, 66], ['樱花粉', 333, 56], ['西瓜红', 359, 82], ['石榴红', 342, 64],
    ['奶茶棕', 30, 36], ['可可棕', 19, 32], ['沙滩金', 43, 52], ['橄榄绿', 68, 38],
    ['鼠尾草', 133, 28], ['孔雀青', 183, 84], ['雾霭蓝', 214, 30], ['暮云紫', 263, 30]
  ];
  function quota(level) { return level === 1 ? 12 : level === 2 ? 20 : 30; }
  function levelInfo(total) {
    total = Math.max(0, Math.floor(Number(total) || 0));
    if (total < 12) return {level:1, within:total, target:12};
    if (total < 32) return {level:2, within:total-12, target:20};
    return {level:3+Math.floor((total-32)/30), within:(total-32)%30, target:30};
  }
  function theme(level) {
    const item = themes[(level-1)%themes.length];
    return {name:item[0], hue:(item[1]+Math.floor((level-1)/themes.length)*7)%360, saturation:item[2]??73};
  }
  function swatch(level, i, n) {
    const t = theme(level), light=36 + (i/Math.max(1,n-1))*48;
    return `hsl(${t.hue + (i%4-1.5)*3} ${t.saturation}% ${light}%)`;
  }
  const alphabet='abcdefghijklmnopqrstuvwxyz', digits='1234567890';
  function targetAt(total) {
    const {level,within}=levelInfo(total);
    const chars=level<=2 ? alphabet : level===3 ? digits : alphabet+digits;
    return chars[(within*7 + level*3 + Math.floor(total/9))%chars.length];
  }
  function typingKey(event) {
    if(event.ctrlKey || event.metaKey || event.altKey || event.repeat)return null;
    const code=event.code||'',key=event.key||'';
    if(/^Numpad[0-9]$/.test(code))return {text:code.slice(-1),main:false};
    if(/^[a-z0-9]$/i.test(key))return {text:key.toLowerCase(),main:true};
    // 中文输入法接管按键时，仍可根据物理字母键和数字键练习。
    if(key==='Process'||key==='Unidentified'||event.isComposing){
      if(/^Key[A-Z]$/.test(code))return {text:code.slice(3).toLowerCase(),main:true};
      if(/^Digit[0-9]$/.test(code))return {text:code.slice(5),main:true};
    }
    return null;
  }
  function stats(people) {
    const levels=people.map(p=>levelInfo(p.total).level).sort((a,b)=>b-a), n=levels.length;
    return {count:n, max:n?levels[0]:0, mean:n?levels.reduce((a,b)=>a+b,0)/n:0,
      thresholds:[10,25,50,75].map(p=>({percent:p,level:n?levels[Math.ceil(n*p/100)-1]:0}))};
  }
  function distribution(people,key) {
    const counts=Object.fromEntries([...regions.map(r=>r.id),'blank'].map(id=>[id,0]));
    people.forEach(p=>{const id=p.colors?.[key]; counts[id in counts && id!=='blank'?id:'blank']++;});
    return counts;
  }
  function coloringProgress(colors,keys){
    const valid=new Set(regions.map(r=>r.id));
    const filled=keys.filter(k=>valid.has(colors[k.id])).length;
    const correct=keys.filter(k=>valid.has(colors[k.id])&&colors[k.id]===k.region).length;
    return {filled,correct,showAccuracy:filled>keys.length/2,
      accuracy:filled?Math.floor(correct/filled*1000)/10:0,
      perfect:keys.length>0&&correct===keys.length};
  }
  function normalizeStates(response) {
    if (!response || response.ok===false || !response.states || typeof response.states!=='object') throw Error('状态数据格式不正确');
    if(response.truncated) throw Error('状态数量超过平台单次读取范围，请更换课堂编号或任务');
    return Object.entries(response.states).map(([key,item])=>({key,...item.value}));
  }
  function mergeClassrooms(existing,records) {
    const map=new Map();
    for(const item of [...existing,...records]){
      const id=item.id||item.sessionId;if(typeof id!=='string'||!id.trim())continue;
      const previous=map.get(id),time=Number(item.createdAt)>0?Number(item.createdAt):null;
      map.set(id,{id,createdAt:previous?.createdAt&&time?Math.min(previous.createdAt,time):previous?.createdAt||time});
    }
    return [...map.values()].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)||a.id.localeCompare(b.id));
  }
  function roomCode(bytes){const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');}
  const api={regions,themes,quota,levelInfo,theme,swatch,targetAt,typingKey,stats,distribution,coloringProgress,normalizeStates,mergeClassrooms,roomCode};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.Lesson=api;
})(typeof window!=='undefined'?window:globalThis);
