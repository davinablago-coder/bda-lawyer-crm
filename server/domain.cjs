const M=require('../assets/calendar-model.js');
function scoped(db,u){
  const leads=M.leadList(db,u),cases=M.caseList(db,u),clients=M.clientList(db,u),invoices=M.invoiceList(db,u);
  const caseIds=new Set(cases.map(c=>c.id)),leadIds=new Set(leads.map(l=>l.id));
  // Sales can see the number of a converted case, not its legal or financial details.
  const caseLinks=u.role==='sales'?db.cases.filter(c=>leadIds.has(c.leadId)).map(c=>({id:c.id,code:c.code,leadId:c.leadId,clientId:c.clientId,coordinatorId:c.coordinatorId})):cases;
  const events=db.events.filter(ev=>M.calendar.canView(db,u,ev));
  const eventIds=new Set(events.map(ev=>ev.id)),invoiceIds=new Set(invoices.map(i=>i.id));
  const safeCases=caseLinks.map(c=>{if(u.role!=='lawyer')return c;const {approvedFee,...safe}=c;return safe;});
  return {version:db.version,users:db.users.map(({id,name,role,specialty,active})=>({id,name,role,specialty,active})),leads,clients,cases:safeCases,
    tasks:db.tasks.filter(t=>caseIds.has(t.caseId)),invoices,receipts:db.receipts.filter(r=>invoiceIds.has(r.invoiceId)),
    documents:db.documents.filter(d=>caseIds.has(d.caseId)),comments:db.comments.filter(c=>caseIds.has(c.caseId)),events,
    activity:db.activity.filter(a=>u.role!=='lawyer'||!(/^(Учтено поступление|Запланирован платёж)/.test(a.message))).filter(a=>a.type==='case'?caseIds.has(a.entityId):a.type==='event'?eventIds.has(a.entityId):leadIds.has(a.entityId))};
}
function command(db,u,action,id,data){
  const direct={'new-lead':()=>M.createLead(db,u,data),'edit-lead':()=>M.updateLead(db,u,id,data),
    'handoff-lead':()=>M.handoffLead(db,u,id,data),'propose-price':()=>M.proposePrice(db,u,id,data),
    'decide-price':()=>M.decidePrice(db,u,id,data),'accept-lead':()=>M.acceptLead(db,u,id,data),
    'edit-case':()=>M.updateCase(db,u,id,data),'new-task':()=>M.addTask(db,u,id,data),
    'new-invoice':()=>M.addInvoice(db,u,data),'receipt':()=>M.receive(db,u,id,data),
    'comment':()=>M.addComment(db,u,id,data.body),'new-document':()=>M.addDocument(db,u,id,data.name),
    'toggle-task':()=>M.toggleTask(db,u,id),'calendar-task':()=>M.toggleTask(db,u,id),
    'document':()=>M.toggleDocument(db,u,id),'event-status':()=>M.calendar.setStatus(db,u,id,data.status),
    'calendar-event':()=>{
      const [linkType='',linkId='']=(data.link||'').split(':');
      if(data.kind==='task'){if(linkType!=='case')throw Error('Выберите дело');return M.addTask(db,u,linkId,{title:data.title,assigneeId:data.ownerId,due:data.date});}
      return M.calendar.save(db,u,{...data,linkType,linkId},id);
    }};
  if(!Object.hasOwn(direct,action))throw Error('Неизвестное действие');
  return direct[action]()||null;
}
module.exports={M,scoped,command};
