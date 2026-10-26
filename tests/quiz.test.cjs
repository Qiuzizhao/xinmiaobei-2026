const test=require('node:test'), assert=require('node:assert/strict');
const L=require('../web/src/core.js');

test('按键分区练习共11题，顶部易混淆键按课堂标准归入功能键区',()=>{
  assert.equal(L.quizQuestions.length,11);
  assert.ok(L.quizQuestions.every(q=>q.type==='mcq'));
  const expected=['主键盘区','功能键区','功能键区','功能键区','功能键区','编辑键区','编辑键区','编辑键区','主键盘区','小键盘区','小键盘区'];
  L.quizQuestions.forEach((q,i)=>assert.equal(q.choices.find(c=>c.id===q.answer).text,expected[i]));
  assert.match(L.quizQuestions[10].prompt,/最右侧/);
});

test('选择题与连线题可判对错',()=>{
  const mcq=L.quizQuestions.find(q=>q.id==='q1');
  assert.equal(L.gradeQuizAnswer(mcq,'a'),true);
  assert.equal(L.gradeQuizAnswer(mcq,'b'),false);
  const match={type:'match',answer:{main:'d1',function:'d2'}};
  assert.equal(L.gradeQuizAnswer(match,{...match.answer}),true);
  assert.equal(L.gradeQuizAnswer(match,{...match.answer,main:'d2'}),false);
  assert.equal(L.gradeQuizAnswer(match,{main:'d1'}),false);
  const shape={type:'match-shape',answer:{main:'s-main',numeric:'s-numeric'}};
  assert.equal(L.gradeQuizAnswer(shape,{...shape.answer}),true);
});

test('作答进度与错题统计',()=>{
  const answers={};
  assert.deepEqual(L.quizProgress(answers),{total:11,answered:0,correct:0,finished:false,accuracy:0});
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
