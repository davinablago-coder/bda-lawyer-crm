const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/calendar-model.js'),C=M.calendar;
const context=()=>{const db=M.seed();return {db,ceo:M.user(db,'u1'),sales:M.user(db,'u2'),coordinator:M.user(db,'u3'),lawyer:M.user(db,'u4')};};
const draft=()=>({kind:'court',title:'Тестовое заседание',date:C.today(),start:'11:00',end:'12:00',ownerId:'u4',linkType:'case',linkId:'c1',location:'Тестовый зал',note:''});

test('calendar initialization preserves existing data and is idempotent',()=>{
  const {db}=context();delete db.events;
  const before=JSON.stringify(db);C.init(db);const count=db.events.length;
  C.init(db);assert.equal(db.events.length,count);
  const copy=structuredClone(db);delete copy.events;assert.equal(JSON.stringify(copy),before);
});
test('month grid starts Monday and covers leap day and year boundaries',()=>{
  const days=C.monthDays('2028-02-15');
  assert.equal(days.length,42);assert.equal(new Date(days[0]+'T12:00:00Z').getUTCDay(),1);
  assert.ok(days.includes('2028-02-29'));
  assert.equal(C.move('2026-01-31','month',1),'2026-02-28');
  assert.equal(C.move('2026-12-31','month',1),'2027-01-31');
  assert.equal(C.weekStart('2027-01-01'),'2026-12-28');
  assert.equal(C.move('2026-12-31','day',1),'2027-01-01');
});
test('tasks are derived from cases and completion stays synchronized',()=>{
  const {db,lawyer}=context();const old=C.items(db,lawyer).find(ev=>ev.id==='t1');
  assert.equal(old.kind,'task');assert.equal(old.date,db.tasks.find(t=>t.id==='t1').due);
  M.toggleTask(db,lawyer,'t1');
  assert.equal(C.items(db,lawyer).find(ev=>ev.id==='t1').status,'done');
  assert.equal(db.events.some(ev=>ev.id==='t1'),false);
});
test('visibility follows case and lead permissions, private events stay private',()=>{
  const {db,sales,lawyer,coordinator,ceo}=context();
  assert.ok(C.items(db,sales).some(ev=>ev.id==='ev-demo-1'));
  assert.ok(!C.items(db,sales).some(ev=>ev.id==='ev-demo-2'));
  assert.ok(C.items(db,lawyer).some(ev=>ev.id==='ev-demo-2'));
  assert.ok(!C.items(db,lawyer).some(ev=>ev.id==='ev-demo-3'));
  assert.ok(!C.items(db,lawyer).some(ev=>ev.id==='t2'));
  assert.ok(C.items(db,coordinator).some(ev=>ev.id==='t2'));
  assert.ok(C.items(db,ceo).some(ev=>ev.id==='ev-demo-5'));
});
test('creating, rescheduling, completing and cancelling retain history',()=>{
  const {db,coordinator}=context();
  const ev=C.save(db,coordinator,draft());const id=ev.id;
  C.save(db,coordinator,{...draft(),date:C.shift(C.today(),3),start:'13:00',end:'14:00'},id);
  assert.equal(ev.id,id);assert.equal(ev.start,'13:00');assert.equal(ev.date,C.shift(C.today(),3));
  C.setStatus(db,coordinator,id,'done');assert.equal(ev.status,'done');
  C.setStatus(db,coordinator,id,'cancelled');assert.equal(ev.status,'cancelled');
  C.setStatus(db,coordinator,id,'planned');assert.equal(ev.status,'planned');
  assert.equal(db.activity.filter(a=>a.entityId===id).length,5);
});
test('invalid date, times, court without case, and illegal assignee leave state unchanged',()=>{
  const {db,coordinator,sales,lawyer}=context(),before=JSON.stringify(db);
  for(const edit of [{date:'2026-02-30'},{start:'12:00',end:'11:00'},{start:'25:00'},{linkType:'',linkId:''},{ownerId:'u5'}])assert.throws(()=>C.save(db,coordinator,{...draft(),...edit}));
  assert.throws(()=>C.save(db,sales,draft()));
  assert.throws(()=>C.save(db,lawyer,{...draft(),ownerId:'u3'}));
  assert.throws(()=>C.save(db,lawyer,{...draft(),linkId:'c2',ownerId:'u5'}));
  assert.equal(JSON.stringify(db),before);
});
test('busy warning ignores touching intervals and cancelled events',()=>{
  const {db,coordinator}=context();db.events=[];
  const a=C.save(db,coordinator,draft());
  assert.equal(C.conflicts(db,coordinator,{...draft(),start:'11:30',end:'12:30'}).length,1);
  assert.equal(C.conflicts(db,coordinator,{...draft(),start:'12:00',end:'12:30'}).length,0);
  assert.equal(C.conflicts(db,coordinator,draft(),a.id).length,0);
  C.setStatus(db,coordinator,a.id,'cancelled');
  assert.equal(C.conflicts(db,coordinator,draft()).length,0);
});
test('overlapping appointments receive separate layout lanes',()=>{
  const items=C.layout([{id:'a',start:'09:00',end:'10:00'},{id:'b',start:'09:30',end:'10:30'},{id:'c',start:'10:00',end:'11:00'},{id:'d',start:'13:00',end:'14:00'}]);
  assert.equal(items[0].lanes,2);assert.notEqual(items[0].lane,items[1].lane);
  assert.equal(items[2].lane,items[0].lane);assert.equal(items[3].lanes,1);
});
test('changing assigned lawyer revokes prior lawyer calendar access',()=>{
  const {db,coordinator,lawyer}=context();const c=db.cases.find(c=>c.id==='c1');
  assert.ok(C.items(db,lawyer).some(ev=>ev.id==='ev-demo-2'));
  M.updateCase(db,coordinator,c.id,{...c,lawyerId:'u5'});
  assert.ok(!C.items(db,lawyer).some(ev=>ev.id==='ev-demo-2'));
  assert.equal(db.events.find(ev=>ev.id==='ev-demo-2').ownerId,'u5');
  assert.ok(C.items(db,M.user(db,'u5')).some(ev=>ev.id==='ev-demo-2'));
});
