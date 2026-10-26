const test=require('node:test'), assert=require('node:assert/strict');
const L=require('../web/src/core.js');

test('知识点练习共 11 题，含选择题与两种连线',()=>{
  assert.equal(L.quizQuestions.length,11);
  const types=L.quizQuestions.map(q=>q.type);
  assert.ok(types.filter(t=>t==='mcq').length>=6);
  assert.ok(types.includes('match'));
  assert.ok(types.includes('match-shape'));
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
