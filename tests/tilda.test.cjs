const {test}=require('node:test');
const assert=require('node:assert/strict');
const {configuration,submission,readBody,save,handle}=require('../server/tilda.cjs');
const {M}=require('../server/domain.cjs');
const env={TILDA_WEBHOOK_SECRET:'synthetic-test-key-'.repeat(3),TILDA_OWNER_ID:'u2',TILDA_FORM_IDS:'form123'};
const config=configuration(env);
const payload={Name:'Тестовый клиент',Phone:'+7 (700) 000-00-00',tranid:'123:456',formid:'form123',Direction:'ДТП и страховые споры',Situation:'Синтетический запрос'};

test('English and Russian form fields produce a new site lead with Almaty contact date',()=>{
  const en=submission(payload,config,'https://sixteen-detailed-flag.tilda.ws/dtp?private=discard');
  const ru=submission({...payload,Name:undefined,Phone:undefined,Имя:payload.Name,Телефон:payload.Phone},config,'');
  assert.equal(en.input.name,ru.input.name);assert.equal(en.input.phone,ru.input.phone);
  assert.equal(en.input.source,'Сайт');assert.equal(en.input.nextDate,M.calendar.today());
  assert.equal(en.input.service,'ДТП и страховые споры');assert.ok(!en.input.note.includes('private'));
});

test('Unknown direction stays in the note; payload cannot choose owner, price or stage',()=>{
  const result=submission({...payload,Direction:'Новое направление',ownerId:'u1',amount:900,stage:'Успешно'},config,'');
  assert.equal(result.input.service,'Юридическая консультация');assert.match(result.input.note,/Новое направление/);
  assert.equal(result.input.ownerId,'u2');assert.equal(result.input.amount,undefined);assert.equal(result.input.stage,undefined);
});

test('Contact page preserves its Russian field names and extra qualification answers',()=>{
  const result=submission({...payload,Direction:undefined,Situation:undefined,Направление:'Семейное право','Описание ситуации':'Синтетическое описание','Этап вопроса':'До суда','Кто обращается':'Частное лицо',Файл:'https://example.test/synthetic.pdf',Согласие:'yes'},config,'');
  assert.equal(result.input.service,'Семейное право');
  for(const text of ['Синтетическое описание','До суда','Частное лицо','synthetic.pdf','yes'])assert.ok(result.input.note.includes(text));
});

test('Missing delivery ID, unapproved forms, invalid phones and object fields are rejected',()=>{
  for(const change of [{tranid:''},{formid:'form999'},{Phone:'123'},{Situation:{nested:true}}])
    assert.throws(()=>submission({...payload,...change},config,''),{status:422});
  assert.throws(()=>configuration({...env,TILDA_WEBHOOK_SECRET:''}),{status:503});
});

test('URL encoded and JSON bodies are supported; duplicate fields and oversized bodies fail',async()=>{
  const request=(body,type)=>new Request('https://example.test',{method:'POST',headers:{'content-type':type},body});
  assert.deepEqual({...await readBody(request(new URLSearchParams(payload),'application/x-www-form-urlencoded'))},payload);
  assert.deepEqual(await readBody(request(JSON.stringify(payload),'application/json')),payload);
  await assert.rejects(readBody(request('Name=a&Name=b','application/x-www-form-urlencoded')),{status:400});
  await assert.rejects(readBody(request('a'.repeat(65537),'application/json')),{status:413});
});

test('Unauthenticated requests fail before body/DB access; authenticated setup probe creates no lead',async()=>{
  const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
  try{
    assert.equal((await handle(new Request('https://example.test',{method:'POST'}))).status,401);
    const probe=await handle(new Request('https://example.test',{method:'POST',headers:{'x-bda-tilda-key':env.TILDA_WEBHOOK_SECRET,'content-type':'application/x-www-form-urlencoded'},body:'test=test'}));
    assert.equal(probe.status,200);assert.equal(await probe.text(),'ok');
  }finally{for(const [key,value]of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});

test('A delivery and its retry create one lead, preserving workflow and an integration audit author',async()=>{
  let state=M.seed(),receipt=null,writes=0;
  const run=async fn=>fn({query:async(sql,args)=>{
    if(sql.startsWith('SELECT data'))return {rows:[{data:structuredClone(state)}]};
    if(sql.startsWith('SELECT lead_id'))return {rows:receipt?[receipt]:[]};
    if(sql.startsWith('SELECT id FROM accounts'))return {rows:[{id:'synthetic-account'}]};
    if(sql.startsWith('UPDATE crm_workspace')){state=JSON.parse(args[0]);writes++;}
    if(sql.startsWith('INSERT INTO tilda_deliveries'))receipt={lead_id:args[2]};
    return {rows:[]};
  }});
  const before=state.leads.length,delivery=submission(payload,config,'');
  await save(delivery,config,run);await save(delivery,config,run);
  assert.equal(writes,1);assert.equal(state.leads.length,before+1);
  assert.equal(state.leads[0].stage,'Новые лиды');assert.equal(state.leads[0].amount,0);
  assert.equal(state.leads[0].pricing.status,'sales');assert.equal(state.leads[0].caseId,null);
  assert.equal(state.activity[0].actorId,'integration:tilda');
});
