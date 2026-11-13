/* Runtime smoke checks using a minimal DOM harness; no visual/browser assertions. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const M=require('../assets/calendar-model.js');
function boot(db=M.seed(),actor='u1',serverState=null){
  const elements=new Map(),listeners={};
  const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',open:false,close(){this.open=false},showModal(){this.open=true},addEventListener(){},classList:{add(){},remove(){}}});return elements.get(key);};
  const saved=new Map([['bda.crm.prototype.v2',JSON.stringify(db)],['bda.crm.actor.v2',actor]]);
  const context={BDA:M,document:{activeElement:null,querySelector:element,getElementById:()=>null,addEventListener:(name,fn)=>listeners[name]=fn},localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},setTimeout:()=>0,clearTimeout(){},Intl,Date,console};
  if(serverState){context.BDA_SERVER=true;context.fetch=async()=>({ok:true,json:async()=>serverState});}
  context.window=context;
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/app.js'),'utf8'),context);
  return {html:()=>element('#app').innerHTML,detail:()=>element('#detail').innerHTML,modal:()=>element('#modal').innerHTML,
    click:(action,rest={})=>listeners.click({target:{closest:()=>({dataset:{action,...rest}})}}),
    role:id=>listeners.change({target:{id:'role-select',value:id}}),
    search:value=>listeners.input({target:{id:'record-search',value}})};
}
test('CEO renders all sections and case tabs without runtime errors',()=>{
  const app=boot();
  assert.match(app.html(),/Здравствуйте, Арман/);
  for(const page of ['crm','calendar','cases','payments','employees','analytics','dashboard']){
    app.click('nav',{page});assert.match(app.html(),/class="content"/);
  }
  app.click('case',{id:'c1'});
  for(const tab of ['overview','tasks','documents','comments','payments','history']){
    app.click('detail-tab',{tab});assert.match(app.detail(),/D-024/);
  }
  app.click('new-lead');assert.match(app.modal(),/data-form="new-lead"/);
  app.click('receipt',{id:'i1'});assert.match(app.modal(),/100.000/);
});
test('role change changes navigation and lawyer scope',()=>{
  const app=boot();
  app.role('u4');assert.doesNotMatch(app.html(),/data-page="payments"/);
  assert.doesNotMatch(app.html(),/data-page="crm"/);
  app.click('nav',{page:'cases'});assert.match(app.html(),/D-024/);assert.doesNotMatch(app.html(),/D-025/);
  app.role('u2');assert.match(app.html(),/Здравствуйте, Алия/);assert.doesNotMatch(app.html(),/data-page="cases"/);
  app.role('u3');app.click('handoff');assert.match(app.html(),/Алия Нурова/);
});
test('client views, search and empty states render',()=>{
  const app=boot();app.click('nav',{page:'crm'});app.click('crm-tab',{tab:'clients'});
  assert.match(app.html(),/Демо Орда/);
  app.search('nothing-matches');assert.match(app.html(),/Клиенты появятся/);
  app.click('crm-tab',{tab:'pipeline'});app.click('view',{view:'table'});
  assert.match(app.html(),/Алексей Соколов/);
});
test('untrusted text is escaped in cards and fields',()=>{
  const db=M.seed();db.leads[0].name='<img src=x onerror=alert(1)>';
  const app=boot(db);app.click('nav',{page:'crm'});
  assert.match(app.html(),/&lt;img/);assert.doesNotMatch(app.html(),/<img src=x/);
  app.click('lead',{id:'l1'});assert.match(app.detail(),/&lt;img/);
});
test('logout displays explicitly simulated login and reentry works',()=>{
  const app=boot();app.click('logout');assert.match(app.html(),/демонстрация входа/);
  app.click('login',{id:'u3'});assert.match(app.html(),/Здравствуйте, Мадина/);
});

test('compact header provides the same logout action for every role',()=>{
  for(const role of ['u1','u2','u3','u4']){
    const app=boot(M.seed(),role);
    assert.match(app.html(),/class="icon-btn topbar-logout"/);
    assert.match(app.html(),/aria-label="Выйти из демонстрации"/);
    app.click('logout');
    assert.match(app.html(),/демонстрация входа/);
  }
});

test('calendar renders month, week, day, filters and event forms',()=>{
  const app=boot();app.click('nav',{page:'calendar'});
  assert.match(app.html(),/Общий календарь/);assert.match(app.html(),/cal-month/);
  assert.match(app.html(),/Предварительное заседание/);
  app.click('cal-view',{view:'week'});assert.match(app.html(),/cal-time-body/);
  app.click('cal-view',{view:'day'});assert.match(app.html(),/--cal-days:1/);
  app.click('new-event');assert.match(app.modal(),/data-form="calendar-event"/);
  app.click('cal-event',{id:'ev-demo-2',origin:'event'});
  assert.match(app.modal(),/Предварительное заседание/);
  app.click('edit-event',{id:'ev-demo-2'});assert.match(app.modal(),/Редактировать событие/);
  app.click('cal-scope',{scope:'mine'});assert.match(app.html(),/На выбранную дату событий нет/);
  app.click('cal-clear');app.search('неттакогособытия');assert.match(app.html(),/На выбранную дату событий нет/);
});
test('calendar is available to every role and hides inaccessible meetings',()=>{
  const app=boot();app.role('u2');app.click('nav',{page:'calendar'});
  assert.match(app.html(),/Обсудить условия сотрудничества/);
  assert.doesNotMatch(app.html(),/Предварительное заседание/);
  app.role('u4');app.click('nav',{page:'calendar'});
  assert.match(app.html(),/Предварительное заседание/);
  assert.doesNotMatch(app.html(),/Обсуждение документов с клиентом/);
});

test('server CEO can open employee creation with login instead of email',async()=>{
  const db=M.seed();const app=boot(db,'u1',{db,actorId:'u1',revision:1});
  await new Promise(resolve=>setImmediate(resolve));
  await app.click('nav',{page:'employees'});
  assert.match(app.html(),/Добавить сотрудника/);
  await app.click('employee-new');assert.match(app.modal(),/name="login"/);assert.doesNotMatch(app.modal(),/type="email"/);
});
test('temporary-password session renders password change without CRM data',async()=>{
  const app=boot(M.seed(),'u1',{passwordChangeRequired:true});await new Promise(resolve=>setImmediate(resolve));
  assert.match(app.html(),/data-form="change-password"/);assert.doesNotMatch(app.html(),/data-page="crm"/);
});
