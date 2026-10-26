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
/* Color anchors adapted from Open Color https://yeun.github.io/open-color/
MIT License
Copyright (c) 2016 heeyeun
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
  const cardPalettes=[["#f14337","#fa574b","#ff7063","#ff8b80","#ffaba2","#ffcbc5"],["#f76e06","#fd8412","#ff9829","#ffae4b","#ffc476","#ffdaa6"],["#f59b01","#faac06","#fcc01a","#ffd13c","#ffdd67","#ffea9a"],["#1baa69","#22bb76","#31cb86","#49da99","#71e7b1","#a0f2cd"],["#0f9ca0","#14aeb1","#22bcc1","#3acdce","#65dcde","#98ebeb"],["#1b81d1","#208fe1","#319eec","#4baff4","#72c3fa","#a4dafd"],["#694ce8","#7254f2","#7e62f7","#9279fa","#ac99fc","#cdc0ff"],["#d13477","#e1498b","#ec649f","#f482b4","#f7a1c7","#fac2db"],["#ea3b4a","#f5505e","#fb6a76","#fd8690","#fea6ae","#fec7cc"],["#e58787","#ed9993","#f2aaa0","#f6baae","#f9cbbd","#fbdacd"],["#f6620e","#fd791b","#ff8d33","#ffa554","#ffbd7e","#ffd6ac"],["#f68603","#fb9a0c","#fdae21","#ffc143","#ffd26e","#ffe3a0"],["#e6a203","#ecb308","#f0c61b","#f5d63d","#f7e168","#faed9a"],["#8bb412","#98c41a","#a7d429","#b8e048","#cbe972","#dff3a0"],["#62b626","#6ec62f","#80d53e","#96e15a","#b0ea80","#cdf4aa"],["#3eb346","#48c150","#59d05f","#71dc76","#92e996","#b7f2b8"],["#28ae5c","#30bd67","#40cd77","#58da8c","#7ee8a7","#a8f2c5"],["#11a773","#18b980","#26ca91","#3ed9a4","#68e6ba","#99f2d4"],["#0da480","#12b68f","#20c69f","#38d7b0","#63e4c4","#96f1db"],["#1293b4","#17a4c6","#25b3d5","#3ec4e0","#69d4ec","#9be6f4"],["#2575bd","#368cd6","#4b9fe6","#67b3f1","#89c7f8","#b3dcfc"],["#217bd9","#2788e8","#3896f1","#52a8f8","#77bdfc","#a8d6ff"],["#376be5","#3f77f0","#5085f7","#6897fa","#88aefe","#b4cdff"],["#4360d0","#5674e4","#6b86ef","#849bf6","#9fb2fa","#c2cefc"],["#5d53e9","#665df3","#736bf8","#8880fb","#a49efd","#c7c3ff"],["#6a49d1","#7b5ae3","#8b6cee","#a084f5","#b8a3f8","#d4c6fc"],["#9842d4","#a64de3","#b35ded","#c376f5","#d398f9","#e4befc"],["#9e41b7","#b556d0","#c76be1","#d886ee","#e4a5f4","#edc5f8"],["#bc3aa8","#cc4abb","#d960cb","#e47bda","#ec9ce4","#f3bfee"],["#da3565","#e94a79","#f2668f","#f884a6","#fba3bd","#fcc3d5"],["#ee3d42","#f85156","#fe6b6e","#fe878a","#ffa8aa","#ffc8ca"],["#e23857","#ef4d6b","#f76882","#fb859b","#fca5b6","#fdc5d1"],["#987055","#ad8262","#bf9676","#d0ad90","#dfc2a9","#ecdbca"],["#755747","#8d6b56","#a5836c","#bd9f86","#d4bea6","#e5d7c5"],["#bd914c","#cda460","#dab777","#e5c891","#edd8af","#f3e5c9"],["#788a42","#90a154","#a7b66d","#bdc98b","#d1dbab","#e2e8c8"],["#568575","#6c9b88","#86af9b","#a2c3b0","#bfd7c6","#d8e8db"],["#0ea08d","#13b29d","#21c2ad","#39d3bd","#64e1cf","#97eee2"],["#2e6ca3","#4a8cc6","#64a5dc","#81bbeb","#9ecef3","#c0e0f9"],["#614bb1","#7e68cf","#947fe1","#ac99ee","#c2b4f4","#dad0f9"]];
  function swatch(level, i, n) {
    const palette=cardPalettes[(level-1)%cardPalettes.length];
    const position=Math.max(0,Math.min(1,i/Math.max(1,n-1)))*(palette.length-1);
    const index=Math.min(Math.floor(position),palette.length-2),blend=position-index;
    const a=palette[index],b=palette[index+1];
    return '#'+[1,3,5].map(offset=>{
      const channel=parseInt(a.slice(offset,offset+2),16),next=parseInt(b.slice(offset,offset+2),16);
      return Math.round(channel+(next-channel)*blend).toString(16).padStart(2,'0');
    }).join('');
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
  // 混色比例只统计已填色学生，未填/空白不占扇区，避免把色盘稀释成空白。
  function mixShares(counts) {
    const filled=regions.reduce((sum,r)=>sum+(counts[r.id]||0),0);
    return {filled, shares:filled?regions.filter(r=>counts[r.id]>0).map(r=>({id:r.id,color:r.color,count:counts[r.id],ratio:counts[r.id]/filled})):[]};
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
  const api={regions,themes,quota,levelInfo,theme,swatch,targetAt,typingKey,stats,distribution,mixShares,coloringProgress,normalizeStates,mergeClassrooms,roomCode};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.Lesson=api;
})(typeof window!=='undefined'?window:globalThis);
