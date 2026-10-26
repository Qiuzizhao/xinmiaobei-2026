const test=require('node:test'), assert=require('node:assert/strict');
const L=require('../web/src/core.js');

test('11道按键分区选择题和3道连线题，分区符合课堂标准',()=>{
  assert.equal(L.quizQuestions.length,14);
  assert.equal(L.quizQuestions.filter(q=>q.type==='mcq').length,11);
  assert.equal(L.quizQuestions.filter(q=>q.type==='match').length,2);
  assert.equal(L.quizQuestions.filter(q=>q.type==='match-shape').length,1);
  const expected=['主键盘区','功能键区','功能键区','功能键区','功能键区','编辑键区','编辑键区','编辑键区','主键盘区','小键盘区','小键盘区'];
  L.quizQuestions.slice(0,11).forEach((q,i)=>assert.equal(q.choices.find(c=>c.id===q.answer).text,expected[i]));
  assert.match(L.quizQuestions[10].prompt,/最右侧/);
});

test('选择题与连线题可判对错',()=>{
  const mcq=L.quizQuestions.find(q=>q.id==='q1');
  assert.equal(L.gradeQuizAnswer(mcq,'a'),true);
  assert.equal(L.gradeQuizAnswer(mcq,'b'),false);
  const match=L.quizQuestions.find(q=>q.type==='match');
  assert.equal(L.gradeQuizAnswer(match,{...match.answer}),true);
  assert.equal(L.gradeQuizAnswer(match,{...match.answer,main:'d2'}),false);
  assert.equal(L.gradeQuizAnswer(match,{main:'d1'}),false);
  const shape=L.quizQuestions.find(q=>q.type==='match-shape');
  assert.equal(L.gradeQuizAnswer(shape,{...shape.answer}),true);
});

test('作答进度与错题统计',()=>{
  const answers={};
  assert.deepEqual(L.quizProgress(answers),{total:14,answered:0,correct:0,finished:false,accuracy:0});
  answers.q1={checked:true,correct:true,value:'a'};
  answers.q2={checked:true,correct:false,value:'a'};
  const p=L.quizProgress(answers);
  assert.equal(p.answered,2);assert.equal(p.correct,1);assert.equal(p.accuracy,50);
  const people=[{answers},{answers:{q1:{checked:true,correct:false,value:'c'}}}];
  const wrong=L.quizWrongStats(people);
  assert.equal(wrong[0].id,'q1');
  assert.equal(wrong[0].attempts,2);
  assert.equal(wrong[0].wrongCount,1);
  assert.equal(wrong[1].wrongCount,1);
});

test('原有11道题完成后，仍需完成新增连线，原选择题作答保留',()=>{
 const answers=Object.fromEntries(L.quizQuestions.slice(0,11).map(q=>[q.id,{value:q.answer,correct:true,checked:true}]));
 let p=L.quizProgress(answers);assert.equal(p.answered,11);assert.equal(p.finished,false);
 for(const q of L.quizQuestions.slice(11)){assert.equal(L.gradeQuizAnswer(q,q.answer),true);answers[q.id]={value:q.answer,correct:true,checked:true};}
 p=L.quizProgress(answers);assert.equal(p.finished,true);assert.equal(p.correct,14);
});
