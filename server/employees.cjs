const {randomUUID,randomBytes}=require('node:crypto');
const {hashPassword}=require('./password.cjs');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function validate(data){
  const name=String(data.name||'').trim(),login=String(data.login||'').trim().toLowerCase(),specialty=String(data.specialty||'').trim();
  if(name.length<2||name.length>120)throw fail('Имя: от 2 до 120 символов');
  if(!/^[a-z0-9][a-z0-9._@+-]{2,253}$/.test(login))throw fail('Логин: от 3 до 254 латинских букв, цифр или . _ @ + -');
  if(!['ceo','sales','coordinator','lawyer'].includes(data.role)||specialty.length>200||typeof data.active!=='boolean')throw fail('Проверьте роль, статус и специализацию');
  return {name,login,role:data.role,specialty,active:data.active};
}
function guardChange(db,actorId,target,next){
  if(target.id===actorId&&(!next.active||next.role!==target.role))throw fail('Нельзя отключить себя или изменить собственную роль');
  if(target.id===process.env.TILDA_OWNER_ID&&(!next.active||next.role!=='sales'))throw fail('Сначала переназначьте получателя заявок Tilda');
  const assigned=db.leads.some(l=>![ 'Успешно','Отказано'].includes(l.stage)&&(l.ownerId===target.id||l.coordinatorId===target.id))||db.cases.some(c=>c.stage!=='Завершено'&&(c.lawyerId===target.id||c.coordinatorId===target.id))||db.tasks.some(t=>!t.done&&t.assigneeId===target.id)||db.events.some(e=>e.status==='planned'&&e.ownerId===target.id);
  if(assigned&&(!next.active||next.role!==target.role))throw fail('Сначала передайте активные лиды, дела, задачи и события другому сотруднику');
}
async function manage(c,db,actor,account,input){
  if(actor.role!=='ceo')throw fail('Управление сотрудниками доступно только CEO',403);
  if(!['create','update','reset'].includes(input.action))throw fail('Неизвестное действие');
  let target=input.action==='create'?null:db.users.find(u=>u.id===input.id),credential;
  if(input.action!=='create'&&!target)throw fail('Сотрудник не найден',404);
  if(input.action==='reset'&&target.id===actor.id)throw fail('Для собственного пароля используйте смену пароля');
  if(input.action!=='reset'){
    const value=validate(input.data||{});
    if(target)guardChange(db,actor.id,target,value);
    const duplicate=await c.query('SELECT employee_id FROM accounts WHERE email=$1',[value.login]);
    if(duplicate.rows.some(a=>a.employee_id!==target?.id))throw fail('Этот логин уже занят');
    if(!target){target={id:randomUUID()};db.users.push(target);}
    Object.assign(target,{name:value.name,role:value.role,specialty:value.specialty,active:value.active});
    const existing=await c.query('SELECT id FROM accounts WHERE employee_id=$1',[target.id]);
    if(!existing.rows.length){
      credential=randomBytes(18).toString('base64url');
      await c.query('INSERT INTO accounts(id,employee_id,email,password_hash,active,must_change_password) VALUES($1,$2,$3,$4,$5,true)',[randomUUID(),target.id,value.login,await hashPassword(credential),value.active]);
    }else await c.query('UPDATE accounts SET email=$1,active=$2 WHERE employee_id=$3',[value.login,value.active,target.id]);
  }else{
    credential=randomBytes(18).toString('base64url');
    const result=await c.query('UPDATE accounts SET password_hash=$1,must_change_password=true WHERE employee_id=$2 RETURNING id',[await hashPassword(credential),target.id]);
    if(!result.rows.length)throw fail('Сначала создайте доступ через редактирование сотрудника');
  }
  // Every permission or credential change revokes the target's existing sessions.
  if(target.id!==actor.id)await c.query('DELETE FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE employee_id=$1)',[target.id]);
  await c.query('INSERT INTO account_audit(actor_id,employee_id,action) VALUES($1,$2,$3)',[account.id,target.id,input.action]);
  return {id:target.id,temporaryPassword:credential};
}
module.exports={manage,validate,guardChange};
