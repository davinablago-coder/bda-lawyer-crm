const {Pool}=require('pg');
let pool;
function database(){
  if(!process.env.DATABASE_URL)throw Object.assign(new Error('База данных ещё не подключена. Настройте DATABASE_URL и выполните миграцию.'),{status:503});
  return pool ||= new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:10000,statement_timeout:15000});
}
async function transaction(fn){
  const client=await database().connect();
  try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function closeDatabase(){if(pool)await pool.end();}
module.exports={database,transaction,closeDatabase};
