const {createHash,timingSafeEqual}=require('node:crypto');
const {transaction}=require('./database.cjs');
const {M}=require('./domain.cjs');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const reply=(body,status=200)=>new Response(body,{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
const digest=value=>createHash('sha256').update(value).digest();

function configuration(env){
  const forms=(env.TILDA_FORM_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!env.TILDA_WEBHOOK_SECRET||env.TILDA_WEBHOOK_SECRET.length<32)throw fail(503,'Integration secret missing or too short');
  if(!env.TILDA_OWNER_ID||!forms.length)throw fail(503,'Integration owner or forms missing');
  const service=env.TILDA_DEFAULT_SERVICE||'Юридическая консультация';
  if(!M.SERVICES.includes(service))throw fail(503,'Integration default service invalid');
  if(forms.some(x=>!/^form\d+$/.test(x)))throw fail(503,'Integration form IDs invalid');
  return {secret:env.TILDA_WEBHOOK_SECRET,ownerId:env.TILDA_OWNER_ID,forms,service};
}

async function readBody(req){
  const type=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!['application/json','application/x-www-form-urlencoded'].includes(type))throw fail(415,'Unsupported content type');
  const reader=req.body?.getReader();if(!reader)throw fail(400,'Empty request');
  const chunks=[];let size=0;
  while(true){
    const {done,value}=await reader.read();if(done)break;
    size+=value.length;if(size>65536){await reader.cancel();throw fail(413,'Request too large');}
    chunks.push(Buffer.from(value));
  }
  const body=Buffer.concat(chunks).toString('utf8');let result;
  try{
    if(type==='application/json')result=JSON.parse(body);
    else{
      result=Object.create(null);
      for(const [key,value] of new URLSearchParams(body)){
        if(Object.hasOwn(result,key))throw Error('Duplicate field');
        result[key]=value;
      }
    }
  }catch{throw fail(400,'Invalid request');}
  if(!result||typeof result!=='object'||Array.isArray(result))throw fail(400,'Invalid request');
  return result;
}

function field(input,names,max=4000){
  for(const name of names){
    const value=Object.hasOwn(input,name)?input[name]:undefined;
    if(value==null||value==='')continue;
    if(typeof value!=='string'||value.length>max)throw fail(422,'Invalid field');
    return value.trim();
  }
  return '';
}

function submission(input,config,referer){
  const submissionId=field(input,['tranid'],160),formId=field(input,['formid'],80);
  if(!/^[\w:-]{1,160}$/.test(submissionId)||!config.forms.includes(formId))throw fail(422,'Invalid submission or form');
  const name=field(input,['Name','Имя','name'],200),phone=field(input,['Phone','Телефон','phone'],80);
  if(name.length<2||M.phoneKey(phone).length!==11)throw fail(422,'Name and phone required');
  const direction=field(input,['Direction','Направление'],500),situation=field(input,['Situation','Описание ситуации','Comments','Message'],16000);
  const caseType=field(input,['Case'],1000),email=field(input,['Email','email'],254);
  const file=field(input,['File','Файл'],8000),consent=field(input,['Consent','Согласие'],500);
  const phase=field(input,['Этап вопроса'],1000),applicant=field(input,['Кто обращается'],1000);
  // Only retain the source page, never query strings, cookies or arbitrary fields.
  let page='';
  try{const url=new URL(referer);if(url.protocol==='https:'&&url.hostname==='sixteen-detailed-flag.tilda.ws')page=url.origin+url.pathname;}catch{}
  const note=[['Направление',direction],['Ситуация',caseType],['Этап вопроса',phase],['Кто обращается',applicant],['Описание',situation],['Email',email],['Файлы (ссылки из формы)',file],['Согласие в форме',consent],['Страница',page],['Форма Тильды',formId],['Заявка Тильды',submissionId]]
    .filter(([,value])=>value).map(([label,value])=>`${label}: ${value}`).join('\n');
  return {submissionId,formId,page,input:{name,phone,source:'Сайт',service:M.SERVICES.includes(direction)?direction:config.service,note,nextStep:'Связаться с клиентом и квалифицировать заявку с сайта',nextDate:M.calendar.today(),ownerId:config.ownerId}};
}

async function save(delivery,config,runTransaction=transaction){
  return runTransaction(async c=>{
    await c.query("SET LOCAL lock_timeout='2s'");
    await c.query("SET LOCAL statement_timeout='3s'");
    // The same lock as CRM commands prevents lost updates and serializes retries.
    const {rows}=await c.query('SELECT data FROM crm_workspace WHERE id=1 FOR UPDATE');
    if(!rows[0])throw fail(503,'Workspace unavailable');
    const prior=await c.query('SELECT lead_id FROM tilda_deliveries WHERE submission_id=$1',[delivery.submissionId]);
    if(prior.rows[0])return;
    const db=rows[0].data;
    const ownerId=db.settings?.tildaOwnerId||config.ownerId;
    const owner=db.users.find(u=>u.id===ownerId&&u.role==='sales'&&u.active!==false);
    const account=await c.query('SELECT id FROM accounts WHERE employee_id=$1 AND active=true',[ownerId]);
    if(!owner||!account.rows[0])throw fail(503,'Lead owner unavailable');
    // Only this fixed server-side action is permitted; no payload role/amount/stage is used.
    const lead=M.createLead(db,owner,delivery.input);
    lead.createdAt=delivery.input.nextDate;
    lead.integration={provider:'tilda',submissionId:delivery.submissionId,formId:delivery.formId,receivedAt:new Date().toISOString()};
    const activity=db.activity[0];activity.actorId='integration:tilda';activity.message='Тильда: получена заявка с сайта. Назначен менеджер '+owner.name+'.';
    await c.query('UPDATE crm_workspace SET data=$1,revision=revision+1 WHERE id=1',[JSON.stringify(db)]);
    await c.query('INSERT INTO tilda_deliveries(submission_id,form_id,lead_id) VALUES($1,$2,$3)',[delivery.submissionId,delivery.formId,lead.id]);
  });
}

async function handle(req){
  try{
    const config=configuration(process.env);
    const supplied=req.headers.get('x-bda-tilda-key')||'';
    if(!timingSafeEqual(digest(supplied),digest(config.secret)))return reply('Unauthorized',401);
    const input=await readBody(req);
    // Tilda checks a receiver with test=test when it is connected. Never create a lead.
    if(input.test==='test'&&Object.keys(input).length===1)return reply('ok');
    await save(submission(input,config,req.headers.get('referer')),config);
    return reply('ok');
  }catch(error){
    // Neither payloads nor driver errors (which may contain data) enter logs/responses.
    return reply(error.status?error.message:'Temporarily unavailable',error.status||503);
  }
}

module.exports={handle,configuration,readBody,submission,save};
