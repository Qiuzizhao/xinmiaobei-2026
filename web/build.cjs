const fs=require('node:fs'), path=require('node:path');
const root=__dirname, config=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
const read=name=>fs.readFileSync(path.join(root,'src',name),'utf8');
const css=read('style.css').replace("@import url('');\n",'');
const wrap=(title,body)=>`<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title><style>${css}</style></head><body>${body}</body></html>`;
for(const kind of ['coloring','typing']){
  const dir=path.join(root,kind);fs.mkdirSync(dir,{recursive:true});
  for(const role of ['student','teacher']){
    const cfg={...config[kind],kind,role};
    fs.writeFileSync(path.join(dir,role+'.html'),wrap(cfg.title+' · '+(role==='student'?'学生端':'教师端'),`<script>window.APP_CONFIG=${JSON.stringify(cfg)};</script><script>${read('core.js')}\n${read('keyboard.js')}\n${read('app.js')}</script>`));
  }
}
const cards=[['coloring','01','填色盘','选一支颜色，给键盘分区。教师看见全班的颜色。'],['typing','02','收集色卡','每正确输入一次，点亮一格，收集一片新的色彩。']];
fs.writeFileSync(path.join(root,'index.html'),wrap('认识键盘 · 课堂互动',`<header><div class="brand"><span class="brandmark">▦</span><span>认识键盘<small>三年级信息科技 · 课堂互动</small></span></div><span class="badge">第一版 · 动手试一试</span></header><main><div class="eyebrow">观察 · 尝试 · 发现</div><h1>从认识键盘，<br>到点亮每一种颜色。</h1><p>两项独立活动，让每个孩子都有自己的尝试节奏。无需填写姓名或座位号。</p><div class="home-grid">${cards.map(([kind,n,title,desc])=>`<section class="panel home-card"><div class="home-art">${['#ed6874','#f1bf52','#54b997','#688ee6','#a287cf'].map(c=>`<i style="--c:${c}"></i>`).join('')}</div><div class="eyebrow">任务 ${n}</div><h2>${title}</h2><p>${desc}</p><a class="primary" style="padding:12px 18px;border-radius:12px" href="${kind}/student.html">进入学生端 →</a><a href="${kind}/teacher.html">教师看板 ↗</a><p class="tips"><a href="${kind}/teacher.html?demo=1">本机示例体验</a></p></section>`).join('')}</div><p class="footer-note">教师先打开看板，新建课堂，再复制该课堂的学生链接。两项活动分别使用独立的 QForm 任务。</p></main>`));
console.log('Generated 4 self-contained classroom pages and index.');
