(function () {
  const keys=[];
  const add=(id,label,x,y,w=1,h=1,region='main')=>keys.push({id,label,x,y,w,h,region});
  add('Escape','Esc',0,0,1,1,'function');
  for(let i=1;i<=12;i++) add('F'+i,'F'+i,1.6+(i-1)*1.03+Math.floor((i-1)/4)*.45,0,1,1,'function');
  const row=(items,y)=>{let x=0;items.forEach(([id,label,w=1])=>{add(id,label,x,y,w);x+=w;});};
  row([['Backquote','`'],...Array.from('1234567890',(n)=>['Digit'+n,n]),['Minus','−'],['Equal','='],['Backspace','Backspace',2]],1.6);
  row([['Tab','Tab',1.5],...Array.from('QWERTYUIOP',n=>['Key'+n,n]),['BracketLeft','['],['BracketRight',']'],['Backslash','\\',1.5]],2.65);
  row([['CapsLock','Caps Lock',1.75],...Array.from('ASDFGHJKL',n=>['Key'+n,n]),['Semicolon',';'],['Quote',"'"],['Enter','Enter',2.25]],3.7);
  row([['ShiftLeft','Shift',2.25],...Array.from('ZXCVBNM',n=>['Key'+n,n]),['Comma',','],['Period','.'],['Slash','/'],['ShiftRight','Shift',2.75]],4.75);
  row([['ControlLeft','Ctrl',1.25],['MetaLeft','Win',1.25],['AltLeft','Alt',1.25],['Space','',6.25],['AltRight','Alt',1.25],['MetaRight','Win',1.25],['ContextMenu','▤',1.25],['ControlRight','Ctrl',1.25]],5.8);
  [['PrintScreen','PrtSc'],['ScrollLock','ScrLk'],['Pause','Pause']].forEach(([id,label],i)=>add(id,label,15.65+i,0,1,1,'editing'));
  [['Insert','Ins'],['Home','Home'],['PageUp','PgUp'],['Delete','Del'],['End','End'],['PageDown','PgDn']].forEach(([id,label],i)=>add(id,label,15.65+i%3,1.6+Math.floor(i/3)*1.05,1,1,'editing'));
  add('ArrowUp','↑',16.65,4.75,1,1,'editing');
  [['ArrowLeft','←'],['ArrowDown','↓'],['ArrowRight','→']].forEach(([id,label],i)=>add(id,label,15.65+i,5.8,1,1,'editing'));
  [['LightNum','1'],['LightCaps','A'],['LightScroll','↓']].forEach(([id,label],i)=>add(id,label,19.3+i*1.4,.05,1.25,.8,'indicator'));
  [['NumLock','Num'],['NumpadDivide','/'],['NumpadMultiply','×'],['NumpadSubtract','−']].forEach(([id,label],i)=>add(id,label,19.3+i,1.6,1,1,'numeric'));
  ['789','456','123'].forEach((r,j)=>Array.from(r).forEach((n,i)=>add('Numpad'+n,n,19.3+i,2.65+j*1.05,1,1,'numeric')));
  add('NumpadAdd','+',22.3,2.65,1,2.05,'numeric'); add('NumpadEnter','Enter',22.3,4.75,1,2.05,'numeric');
  add('Numpad0','0',19.3,5.8,2,1,'numeric');add('NumpadDecimal','.',21.3,5.8,1,1,'numeric');
  Lesson.keys=keys;
  Lesson.drawKeyboard=function(el,handler){
    el.classList.add('keyboard'); el.innerHTML='';
    keys.forEach(k=>{const b=document.createElement('button');b.type='button';b.className='key'+(k.region==='indicator'?' indicator':'');b.dataset.key=k.id;b.textContent=k.label;
      b.setAttribute('aria-label', k.region==='indicator'?'指示灯 '+k.label:(k.label||'空格键'));
      Object.assign(b.style,{left:`${k.x/23.3*100}%`,top:`${k.y/6.85*100}%`,width:`${(k.w-.07)/23.3*100}%`,height:`${(k.h-.08)/6.85*100}%`});
      handler?.(b,k);el.append(b);});
  };
})();
