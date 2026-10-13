const fs=require('node:fs');
const {database,transaction,closeDatabase}=require('../server/database.cjs');
const M=require('../assets/calendar-model.js');
(async()=>{
  await database().query(fs.readFileSync('db/001_initial.sql','utf8'));
  const state=M.seed();
  if(process.env.SEED_DEMO!=='true')for(const key of Object.keys(state))if(Array.isArray(state[key]))state[key]=[];
  await transaction(async c=>{await c.query('INSERT INTO crm_workspace(id,data) VALUES(1,$1) ON CONFLICT DO NOTHING',[JSON.stringify(state)]);});
  console.log('Схема применена. Существующие данные сохранены.');
})().catch(()=>{console.error('Миграция не выполнена. Проверьте подключение PostgreSQL и права базы.');process.exitCode=1;}).finally(closeDatabase);
