const {Pool}=require('pg');const fs=require('node:fs');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
process.env.APP_ORIGIN='http://localhost';const original=process.env.DATABASE_URL;const schema='test_employees_'+Date.now();const admin=new Pool({connectionString:original,max:1});
(async()=>{
 await admin.query('CREATE SCHEMA '+schema);const url=new URL(original);url.hostname=url.hostname.replace('-pooler','');url.searchParams.set('options','-c search_path='+schema);process.env.DATABASE_URL=url.toString();
 const {database,closeDatabase}=require('../server/database.cjs');const {hashPassword}=require('../server/password.cjs');const {handle}=require('../server/api.cjs');
 try{
  for(const f of ['001_initial','002_tilda','003_employees'])await database().query(fs.readFileSync('db/'+f+'.sql','utf8'));
  const db=require('../assets/calendar-model.js').seed();for(const k of Object.keys(db))if(Array.isArray(db[k]))db[k]=[];db.users=[{id:'ceo',name:'Test CEO',role:'ceo'}];
  await database().query('INSERT INTO crm_workspace(id,data) VALUES(1,$1)',[JSON.stringify(db)]);
  const password='Synthetic-'+randomUUID();await database().query('INSERT INTO accounts(id,employee_id,email,password_hash) VALUES($1,$2,$3,$4)',[randomUUID(),'ceo','ceo',await hashPassword(password)]);
  async function call(path,data,cookie=''){const r=await handle(new Request('http://localhost/api/'+path,{method:data?'POST':'GET',headers:{origin:'http://localhost','content-type':'application/json',cookie},body:data?JSON.stringify(data):undefined}),[path]);return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  const login=await call('login',{email:'ceo',password});assert.equal(login.status,200);const ceo=login.cookie;
  let state=await call('state',null,ceo);let created=await call('employees',{action:'create',revision:state.body.revision,data:{name:'Test Lawyer',login:'test.lawyer',role:'lawyer',active:true}},ceo);assert.equal(created.status,200);
  const temp=created.body.temporaryPassword;assert.ok(temp);const id=created.body.id;
  let worker=(await call('login',{email:'test.lawyer',password:temp})).cookie;
  assert.deepEqual((await call('state',null,worker)).body,{passwordChangeRequired:true});
  assert.equal((await call('employees',{action:'create',revision:1,data:{}},worker)).status,403);
  const next='New-'+randomUUID();assert.equal((await call('password',{currentPassword:temp,password:next},worker)).status,200);
  assert.equal((await call('state',null,worker)).status,401);
  worker=(await call('login',{email:'test.lawyer',password:next})).cookie;
  assert.equal((await call('state',null,worker)).status,200);
  assert.equal((await call('employees',{action:'create',revision:1,data:{}},worker)).status,403);
  state=await call('state',null,ceo);
  assert.equal((await call('employees',{action:'update',id,revision:state.body.revision,data:{name:'Test Lawyer',login:'test.lawyer',role:'lawyer',active:false}},ceo)).status,200);
  assert.equal((await call('state',null,worker)).status,401);
  assert.equal((await call('login',{email:'test.lawyer',password:next})).status,401);
  console.log('PASS: create, login, forced password change, role denial, disable and session revocation in isolated PostgreSQL schema');
 }finally{await closeDatabase();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(async()=>{await admin.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await admin.end();});
