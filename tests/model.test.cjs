const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/model.js');
const setup=()=>{const db=M.seed();return {db,ceo:M.user(db,'u1'),sales:M.user(db,'u2'),coord:M.user(db,'u3'),lawyer:M.user(db,'u4')};};
const draft=()=>({name:'Тестовый клиент',phone:'+7 (000) 123-45-67',service:M.SERVICES[0],source:'Вручную',note:'Вымышленный запрос',nextStep:'Позвонить',nextDate:M.date(),ownerId:'u2'});
const accepted=()=>({revision:1,lawyerId:'u4',coordinatorId:'u3',due:M.date(14)});

// Existing scenario fixtures now follow the mandatory pricing workflow.
function approve(db,leadId){
  const l=db.leads.find(x=>x.id===leadId);
  if(l.pricing.status==='sales')M.handoffLead(db,M.user(db,'u2'),leadId,{coordinatorId:'u3',qualification:l.note});
  M.proposePrice(db,M.user(db,'u3'),leadId,{amount:100000,note:l.note,revision:l.pricing.revision});
  M.decidePrice(db,M.user(db,'u1'),leadId,{decision:'approve',revision:l.pricing.revision});
}

test('end-to-end: lead → sale → coordinator → case → task → partial receipts',()=>{
  const {db,sales,coord,lawyer}=setup();
  const l=M.createLead(db,sales,draft());
  for(const stage of M.STAGES.slice(1,4))M.updateLead(db,sales,l.id,{...l,stage});
  assert.equal(M.caseList(db,lawyer).length,2);
  approve(db,l.id);
  const c=M.acceptLead(db,coord,l.id,accepted());
  assert.equal(c.clientId,db.clients.find(x=>x.phone===l.phone).id);
  assert.equal(M.caseList(db,lawyer).length,3);
  M.addTask(db,coord,c.id,{title:'Подготовить претензию',assigneeId:lawyer.id,due:M.date()});
  const task=db.tasks.at(-1);
  M.toggleTask(db,lawyer,task.id);
  assert.equal(task.done,true);
  M.updateCase(db,lawyer,c.id,{stage:'Подготовка документов'});
  assert.equal(c.stage,'Подготовка документов');
  M.addInvoice(db,coord,{caseId:c.id,title:'Аванс',amount:100000,due:M.date(2)});
  const i=db.invoices[0];
  M.receive(db,coord,i.id,{amount:25000,date:M.date()});
  assert.equal(M.invoiceStatus(db,i),'Частично');
  assert.equal(M.balance(db,i),75000);
  M.receive(db,coord,i.id,{amount:75000,date:M.date()});
  assert.equal(M.invoiceStatus(db,i),'Оплачено');
  assert.equal(M.paid(db,i),100000);
  assert.ok(db.activity.some(a=>a.entityId===c.id&&a.actorId===coord.id));
});

test('repeat acceptance cannot create duplicate case or client',()=>{
  const {db,coord}=setup();approve(db,'l8');const c=M.acceptLead(db,coord,'l8',accepted());
  const size=[db.cases.length,db.clients.length];
  assert.equal(M.acceptLead(db,coord,'l8',accepted()).id,c.id);
  assert.deepEqual([db.cases.length,db.clients.length],size);
});

test('existing client is reused for normalized phone; multiple cases are allowed',()=>{
  const {db,sales,coord}=setup();const cl=db.clients[0];
  const l=M.createLead(db,sales,{...draft(),phone:cl.phone.replace('+7','8')});
  approve(db,l.id);
  const count=db.clients.length,c=M.acceptLead(db,coord,l.id,accepted());
  assert.equal(c.clientId,cl.id);assert.equal(db.clients.length,count);
  assert.equal(db.cases.filter(x=>x.clientId===cl.id).length,2);
});

test('rejection needs reason and accepted sale cannot change outcome',()=>{
  const {db,sales,coord}=setup(),l=db.leads[0];
  assert.throws(()=>M.updateLead(db,sales,l.id,{...l,stage:'Отказано',reason:''}));
  assert.equal(l.stage,'Новые лиды');
  M.updateLead(db,sales,l.id,{...l,stage:'Отказано',reason:M.REASONS[0]});
  assert.equal(l.reason,M.REASONS[0]);
  approve(db,'l8');
  M.acceptLead(db,coord,'l8',accepted());
  assert.throws(()=>M.updateLead(db,sales,'l8',{...db.leads[7],stage:'Отказано',reason:M.REASONS[0]}),/Нет доступа/);
});

test('invalid handoff does not mutate data',()=>{
  const {db,coord}=setup();approve(db,'l8');const before=JSON.stringify(db);
  assert.throws(()=>M.acceptLead(db,coord,'l8',{...accepted(),lawyerId:'u2'}));
  assert.equal(JSON.stringify(db),before);
  assert.throws(()=>M.acceptLead(db,coord,'l1',accepted()),/Нет доступа/);
});

test('lawyer sees assigned cases only and cannot mutate sales or payments',()=>{
  const {db,lawyer,sales,coord}=setup();
  assert.deepEqual(M.leadList(db,lawyer),[]);
  assert.deepEqual(M.invoiceList(db,lawyer),[]);
  assert.equal(M.caseList(db,lawyer).some(c=>c.id==='c2'),false);
  assert.throws(()=>M.updateCase(db,lawyer,'c2',{stage:'Анализ'}));
  assert.throws(()=>M.createLead(db,lawyer,draft()));
  assert.throws(()=>M.receive(db,lawyer,'i1',{amount:1,date:M.date()}));
  assert.throws(()=>M.acceptLead(db,sales,'l8',accepted()));
  assert.throws(()=>M.toggleTask(db,lawyer,'t2'));
  assert.throws(()=>M.updateLead(db,coord,'l8',{...db.leads[7],stage:'Отказано',reason:M.REASONS[0]}));
});

test('partial receipts reject zero, negatives, fractions, overpayment, future dates',()=>{
  const {db,coord}=setup(),i=db.invoices[0],before=JSON.stringify(db);
  for(const amount of [0,-1,1.5,100001,Infinity,NaN])assert.throws(()=>M.receive(db,coord,i.id,{amount,date:M.date()}));
  assert.throws(()=>M.receive(db,coord,i.id,{amount:1,date:M.date(1)}));
  assert.equal(JSON.stringify(db),before);
  assert.equal(M.invoiceStatus(db,i),'Просрочено');
});

test('closing case needs coordinator and result; debt stays independent',()=>{
  const {db,coord,lawyer}=setup(),c=db.cases[0];
  assert.throws(()=>M.updateCase(db,lawyer,c.id,{stage:'Завершено',result:'Готово'}));
  assert.throws(()=>M.updateCase(db,coord,c.id,{...c,stage:'Завершено',result:''}));
  M.updateCase(db,coord,c.id,{...c,stage:'Завершено',result:'Досудебное соглашение достигнуто'});
  assert.equal(M.balance(db,db.invoices[0]),100000);
});

test('reassignment transfers open tasks and preserves completed work authorship',()=>{
  const {db,coord}=setup(),c=db.cases[0];
  M.updateCase(db,coord,c.id,{...c,lawyerId:'u5'});
  assert.equal(db.tasks.find(t=>t.id==='t1').assigneeId,'u5');
  assert.equal(db.tasks.find(t=>t.id==='t5').assigneeId,'u4');
});

test('document checklist and comments obey assigned case access',()=>{
  const {db,coord,lawyer}=setup();
  M.addDocument(db,coord,'c1','Подписанный договор');
  M.toggleDocument(db,lawyer,db.documents.at(-1).id);
  assert.equal(db.documents.at(-1).received,true);
  assert.throws(()=>M.addDocument(db,lawyer,'c1','Новый документ'));
  assert.throws(()=>M.addComment(db,lawyer,'c2','Недоступное дело'));
  M.addComment(db,lawyer,'c1','Претензия подготовлена');
  assert.equal(db.comments.at(-1).authorId,lawyer.id);
});

test('local state round-trip retains relations and recorded payments',()=>{
  const {db,coord}=setup();approve(db,'l8');const c=M.acceptLead(db,coord,'l8',accepted());
  const restored=JSON.parse(JSON.stringify(db));
  assert.equal(restored.leads.find(l=>l.id==='l8').caseId,c.id);
  assert.equal(M.paid(restored,restored.invoices[0]),200000);
});
