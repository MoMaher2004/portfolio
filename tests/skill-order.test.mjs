import test from 'node:test';
import assert from 'node:assert/strict';
import { orderHardSkills } from '../src/skill-order.js';

test('Other Engineering follows existing and future groups without mutating input',()=>{
  const input=[{id:'backend',name:'Backend & APIs'},{id:'hard-other',name:'Other Engineering'},{id:'ai',name:'Artificial Intelligence & Data Analysis'},{id:'future',name:'Future group'}];
  assert.deepEqual(orderHardSkills(input).map(x=>x.id),['backend','ai','future','hard-other']);
  assert.equal(input[1].id,'hard-other');
});
test('stable id survives a rename and normalized name is a fallback',()=>{
  const a={id:'hard-other',name:'Embedded Systems'};
  const b={id:'custom',name:'  OTHER ENGINEERING '};
  const c={id:'normal',name:'Other tools'};
  assert.deepEqual(orderHardSkills([a,b,c]),[c,a,b]);
});
test('unrelated groups retain their order and an empty list works',()=>{
  const groups=[{id:'b'},{id:'a'}];
  assert.deepEqual(orderHardSkills(groups),groups);
  assert.deepEqual(orderHardSkills([]),[]);
});
