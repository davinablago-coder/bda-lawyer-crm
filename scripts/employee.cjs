const {randomUUID}=require('node:crypto');
const readline=require('node:readline');
const {Writable}=require('node:stream');
const {database,transaction,closeDatabase}=require('../server/database.cjs');
const {hashPassword}=require('../server/password.cjs');
const [email,name,role,existingId]=process.argv.slice(2);
(async()=>{
  if(!email||!name||!['ceo','sales','coordinator','lawyer'].includes(role))throw Error('Использование: npm run employee:create -- email "Имя" ceo|sales|coordinator|lawyer [ID демо-сотрудника]');
  if(!process.stdin.isTTY)throw Error('Запустите команду в интерактивном терминале для скрытого ввода пароля');
  process.stdout.write('Новый пароль (12+ символов, ввод скрыт): ');
  const muted=new Writable({write(chunk,encoding,cb){cb();}});
  const rl=readline.createInterface({input:process.stdin,output:muted,terminal:true});
  const password=await new Promise(resolve=>rl.question('',resolve));rl.close();process.stdout.write('\n');
  const passwordHash=await hashPassword(password);
  await transaction(async c=>{
    const {rows}=await c.query('SELECT data FROM crm_workspace WHERE id=1 FOR UPDATE');
    if(!rows.length)throw Error('Сначала выполните миграцию');
    const db=rows[0].data,id=existingId||randomUUID();
    if(existingId){const u=db.users.find(u=>u.id===id);if(!u||u.role!==role)throw Error('ID или роль демо-сотрудника не совпадает');}
    else db.users.push({id,name,role,specialty:''});
    await c.query('INSERT INTO accounts(id,employee_id,email,password_hash) VALUES($1,$2,$3,$4)',[randomUUID(),id,email.trim().toLowerCase(),passwordHash]);
    await c.query('UPDATE crm_workspace SET data=$1,revision=revision+1 WHERE id=1',[JSON.stringify(db)]);
  });
  console.log('Учётная запись создана.');
})().catch(e=>{console.error(e.code?'Не удалось создать сотрудника. Проверьте базу и уникальность email / ID.':e.message);process.exitCode=1;}).finally(closeDatabase);
