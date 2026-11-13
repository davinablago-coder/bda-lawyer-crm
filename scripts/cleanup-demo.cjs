// Explicit maintenance operation; never invoked from build or startup.
const fs=require('node:fs');
const {transaction,closeDatabase}=require('../server/database.cjs');
const {clean}=require('../server/cleanup-demo.cjs');
(async()=>{
  if(!process.argv.includes('--apply'))throw Error('Укажите --apply для очистки известных заглушек после резервного копирования');
  await transaction(async c=>{
    const {rows}=await c.query('SELECT data,revision FROM crm_workspace WHERE id=1 FOR UPDATE');
    const snapshot=rows[0];if(!snapshot)throw Error('Нет рабочей области');
    const backup={workspace:snapshot};
    for(const table of ['accounts','sessions','command_receipts','tilda_deliveries'])backup[table]=(await c.query('SELECT * FROM '+table)).rows;
    fs.mkdirSync('tmp/backups',{recursive:true,mode:0o700});
    const file='tmp/backups/before-demo-cleanup-'+Date.now()+'.json';
    fs.writeFileSync(file,JSON.stringify(backup),{mode:0o600,flag:'wx'});
    const removed=clean(snapshot.data);
    const seed=require('../assets/calendar-model.js').seed();
    const retained=new Set(snapshot.data.users.filter(u=>u.role==='ceo'||u.id===process.env.TILDA_OWNER_ID).map(u=>u.id));
    for(const [key,records] of Object.entries(snapshot.data))if(key!=='users'&&Array.isArray(records))for(const record of records)for(const field of ['ownerId','coordinatorId','lawyerId','assigneeId','actorId','createdBy'])if(record[field])retained.add(record[field]);
    const removeUsers=snapshot.data.users.filter(u=>!retained.has(u.id)&&seed.users.some(s=>s.id===u.id&&s.name===u.name)).map(u=>u.id);
    for(const id of removeUsers){
      await c.query('DELETE FROM command_receipts WHERE account_id IN (SELECT id FROM accounts WHERE employee_id=$1)',[id]);
      await c.query('DELETE FROM accounts WHERE employee_id=$1',[id]);
    }
    snapshot.data.users=snapshot.data.users.filter(u=>!removeUsers.includes(u.id));
    for(const u of snapshot.data.users)if(seed.users.some(s=>s.id===u.id&&s.name===u.name)){
      if(u.role==='ceo'){u.name='CEO';u.specialty='';}
      else if(u.id===process.env.TILDA_OWNER_ID){u.name='Менеджер заявок сайта';u.specialty='Получатель заявок Tilda — укажите имя сотрудника';}
    }
    removed.users=removeUsers.length;
    await c.query('UPDATE crm_workspace SET data=$1,revision=revision+1 WHERE id=1',[JSON.stringify(snapshot.data)]);
    console.log(JSON.stringify({backup:file,removed,remainingLeads:snapshot.data.leads.length}));
  });
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(closeDatabase);
