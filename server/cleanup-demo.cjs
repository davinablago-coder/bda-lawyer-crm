const M=require('../assets/calendar-model.js');
const pilotNames=new Set(['ПИЛОТ UI 15.10 — проверка форм','ПИЛОТ 2026-10-14T13-22-14-705Z','Тест подключения CRM','Бейбарыс тест']);
function clean(db){
  const seed=M.seed(),removed={};
  const leads=new Set(db.leads.filter(l=>seed.leads.some(s=>s.id===l.id&&s.name===l.name)||pilotNames.has(l.name)).map(l=>l.id));
  const cases=new Set(db.cases.filter(c=>leads.has(c.leadId)||seed.cases.some(s=>s.id===c.id&&s.clientId===c.clientId)).map(c=>c.id));
  // A retained lead linked to an old case protects that case and its client.
  for(const l of db.leads)if(!leads.has(l.id)&&l.caseId)cases.delete(l.caseId);
  const clients=new Set([...db.cases.filter(c=>cases.has(c.id)).map(c=>c.clientId),...seed.clients.map(c=>c.id)]);
  for(const c of db.cases)if(!cases.has(c.id))clients.delete(c.clientId);
  const invoices=new Set(db.invoices.filter(i=>cases.has(i.caseId)).map(i=>i.id));
  const events=new Set(db.events.filter(e=>(e.linkType==='lead'&&leads.has(e.linkId))||(e.linkType==='case'&&cases.has(e.linkId))||seed.events.some(s=>s.id===e.id&&s.title===e.title)).map(e=>e.id));
  const filters={leads:x=>leads.has(x.id),cases:x=>cases.has(x.id),clients:x=>clients.has(x.id),invoices:x=>invoices.has(x.id),receipts:x=>invoices.has(x.invoiceId),tasks:x=>cases.has(x.caseId),documents:x=>cases.has(x.caseId),comments:x=>cases.has(x.caseId),events:x=>events.has(x.id),activity:x=>leads.has(x.entityId)||cases.has(x.entityId)||events.has(x.entityId)};
  for(const [key,remove] of Object.entries(filters)){const before=db[key].length;db[key]=db[key].filter(x=>!remove(x));removed[key]=before-db[key].length;}
  return removed;
}
module.exports={clean};
