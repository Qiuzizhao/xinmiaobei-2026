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
    ['浅海青', 181], ['晴空蓝', 211], ['鸢尾紫', 266], ['玫瑰粉', 321]
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
    return {name:item[0], hue:(item[1]+Math.floor((level-1)/themes.length)*7)%360};
  }
  function swatch(level, i, n) {
    const t = theme(level), light=36 + (i/Math.max(1,n-1))*48;
    return `hsl(${t.hue + (i%4-1.5)*3} 73% ${light}%)`;
  }
  const alphabet='abcdefghijklmnopqrstuvwxyz', digits='1234567890';
  function targetAt(total) {
    const {level,within}=levelInfo(total);
    const chars=level<=2 ? alphabet : level===3 ? digits : alphabet+digits;
    return chars[(within*7 + level*3 + Math.floor(total/9))%chars.length];
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
  function normalizeStates(response) {
    if (!response || response.ok===false || !response.states || typeof response.states!=='object') throw Error('状态数据格式不正确');
    if(response.truncated) throw Error('状态数量超过平台单次读取范围，请更换课堂编号或任务');
    return Object.entries(response.states).map(([key,item])=>({key,...item.value}));
  }
  const api={regions,themes,quota,levelInfo,theme,swatch,targetAt,stats,distribution,normalizeStates};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.Lesson=api;
})(typeof window!=='undefined'?window:globalThis);
