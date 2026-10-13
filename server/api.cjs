const {randomBytes,createHash}=require('node:crypto');
const {database,transaction}=require('./database.cjs');
const {verifyPassword}=require('./password.cjs');
const {M,scoped,command}=require('./domain.cjs');
const digest=value=>createHash('sha256').update(value).digest('hex');
const cookieName=process.env.NODE_ENV==='production'?'__Host-bda_session':'bda_session';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const reply=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
function token(req){return (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
function cookie(value,age){return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
async function readBody(req){
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw fail('Требуется JSON',415);
  const reader=req.body?.getReader();if(!reader)throw fail('Пустой запрос');
  let size=0;const parts=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw fail('Слишком большой запрос',413);}parts.push(Buffer.from(value));}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw fail('Некорректный JSON');}
}
async function session(req,c=database()){
  const value=token(req);if(!/^[a-f0-9]{64}$/.test(value))throw fail('Войдите в систему',401);
  const {rows}=await c.query('SELECT a.id,a.employee_id FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.active=true',[digest(value)]);
  if(!rows[0])throw fail('Сессия истекла. Войдите заново',401);return rows[0];
}
async function snapshot(req){
  const account=await session(req);
  const {rows}=await database().query('SELECT data,revision FROM crm_workspace WHERE id=1');
  if(!rows[0])throw fail('Сначала выполните миграцию базы',503);
  const u=M.user(rows[0].data,account.employee_id);
  return {db:scoped(rows[0].data,u),actorId:u.id,revision:rows[0].revision};
}
async function login(req,data){
  const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  if(!email||email.length>254||typeof data.password!=='string'||data.password.length>256)throw fail('Проверьте email и пароль',401);
  // Persisted limits work across serverless instances. Hash identities instead of storing IPs.
  const ip=process.env.VERCEL?(req.headers.get('x-vercel-forwarded-for')||'unknown'):'local';
  for(const key of [digest('account:'+email),digest('ip:'+ip)]){
    const {rows}=await database().query(`INSERT INTO login_attempts(key,count,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_attempts.reset_at<now() THEN 1 ELSE login_attempts.count+1 END, reset_at=CASE WHEN login_attempts.reset_at<now() THEN now()+interval '15 minutes' ELSE login_attempts.reset_at END RETURNING count`,[key]);
    if(rows[0].count>(key===digest('account:'+email)?10:60))throw fail('Слишком много попыток. Повторите через 15 минут',429);
  }
  const {rows}=await database().query('SELECT * FROM accounts WHERE email=$1 AND active=true',[email]);
  const account=rows[0];
  const ok=await verifyPassword(data.password,account?.password_hash||'00000000000000000000000000000000:'+ '00'.repeat(64));
  if(!account||!ok)throw fail('Неверный email или пароль',401);
  const value=randomBytes(32).toString('hex');
  await transaction(async c=>{
    if(token(req))await c.query('DELETE FROM sessions WHERE token_hash=$1',[digest(token(req))]);
    await c.query('DELETE FROM sessions WHERE expires_at<now()');
    await c.query("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",[digest(value),account.id]);
  });
  return reply({ok:true},200,{'Set-Cookie':cookie(value,43200)});
}
async function handle(req,parts){
  try{
    const path=parts.join('/');
    if(req.method==='GET'&&path==='state')return reply(await snapshot(req));
    if(req.method!=='POST')return reply({error:'Не найдено'},404);
    const origin=process.env.APP_ORIGIN||new URL(req.url).origin;
    if(req.headers.get('origin')!==origin)throw fail('Недопустимый источник запроса',403);
    if(path==='logout'){
      if(token(req))await database().query('DELETE FROM sessions WHERE token_hash=$1',[digest(token(req))]);
      return reply({ok:true},200,{'Set-Cookie':cookie('',0)});
    }
    const input=await readBody(req);
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail('Некорректный запрос');
    if(path==='login')return await login(req,input);
    if(path!=='command')throw fail('Не найдено',404);
    if(!/^[a-f0-9-]{36}$/i.test(input.requestId||'')||!Number.isInteger(input.revision))throw fail('Некорректная версия или идентификатор запроса');
    const result=await transaction(async c=>{
      const account=await session(req,c);
      const {rows}=await c.query('SELECT data,revision FROM crm_workspace WHERE id=1 FOR UPDATE');
      if(!rows[0])throw fail('Сначала выполните миграцию',503);
      const db=rows[0].data,u=M.user(db,account.employee_id);
      const prior=await c.query('SELECT result FROM command_receipts WHERE account_id=$1 AND request_id=$2',[account.id,input.requestId]);
      if(prior.rows[0])return {db:scoped(db,u),actorId:u.id,revision:rows[0].revision,result:prior.rows[0].result};
      if(input.revision!==rows[0].revision)throw fail('Данные изменились другим сотрудником. Обновите данные и повторите действие.',409);
      if(!input.data||typeof input.data!=='object'||Array.isArray(input.data))throw fail('Некорректные поля');
      let value;
      try{value=command(db,u,input.action,input.id,input.data);}catch(e){throw fail(e.message);}
      await c.query('UPDATE crm_workspace SET data=$1,revision=revision+1 WHERE id=1',[JSON.stringify(db)]);
      // Only IDs are returned; no unfiltered records escape through command results.
      const result=value?.id?{id:value.id,code:value.code}:null;
      await c.query('INSERT INTO command_receipts(account_id,request_id,result) VALUES($1,$2,$3)',[account.id,input.requestId,JSON.stringify(result)]);
      return {db:scoped(db,u),actorId:u.id,revision:rows[0].revision+1,result};
    });
    return reply(result);
  }catch(e){return reply({error:e.status?e.message:'Сервис базы данных недоступен. Проверьте подключение и миграции.'},e.status||503);}
}
module.exports={handle};
