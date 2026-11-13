/* Calendar dates and times are wall-clock values in Asia/Almaty. */
(function(root){
  'use strict';
  const M=typeof module!=='undefined'?require('./model.js'):root.BDA;
  const TZ='Asia/Almaty';
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const key=d=>d.toISOString().slice(0,10);
  const day=d=>new Date(d+'T12:00:00Z');
  const shift=(d,n)=>{const x=day(d);x.setUTCDate(x.getUTCDate()+n);return key(x);};
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(day(d).valueOf())&&key(day(d))===d;
  const minutes=t=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t||''))return NaN;const [h,m]=t.split(':').map(Number);return h*60+m;};
  const uid=()=> 'ev-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
  const weekStart=d=>shift(d,-((day(d).getUTCDay()+6)%7));
  function monthDays(d){const first=d.slice(0,8)+'01',start=weekStart(first);return Array.from({length:42},(_,i)=>shift(start,i));}
  function move(d,view,direction){
    if(view!=='month')return shift(d,direction*(view==='week'?7:1));
    const x=day(d),date=x.getUTCDate();x.setUTCDate(1);x.setUTCMonth(x.getUTCMonth()+direction);
    const end=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate();x.setUTCDate(Math.min(date,end));return key(x);
  }
  function init(db){
    if(Array.isArray(db.events))return db;
    const d=today();
    const samples=[
      {id:'ev-demo-1',kind:'meeting',title:'Обсудить условия сотрудничества',date:d,start:'10:00',end:'11:00',ownerId:'u2',linkType:'lead',linkId:'l7',location:'Переговорная · офис BDA',note:'Согласовать объём работ и следующий шаг.'},
      {id:'ev-demo-2',kind:'court',title:'Предварительное заседание',date:shift(d,1),start:'11:00',end:'12:00',ownerId:'u4',linkType:'case',linkId:'c1',location:'Демонстрационный суд · зал 3',note:'Проверить комплект документов перед заседанием.'},
      {id:'ev-demo-3',kind:'meeting',title:'Обсуждение документов с клиентом',date:d,start:'14:00',end:'14:45',ownerId:'u5',linkType:'case',linkId:'c2',location:'Онлайн',note:'Уточнить недостающие документы.'},
      {id:'ev-demo-4',kind:'meeting',title:'Согласование правок к договору',date:shift(d,2),start:'15:00',end:'16:00',ownerId:'u4',linkType:'case',linkId:'c3',location:'Офис BDA',note:''},
      {id:'ev-demo-5',kind:'meeting',title:'Планирование работы команды',date:shift(d,3),start:'09:30',end:'10:00',ownerId:'u3',linkType:'',linkId:'',location:'Офис BDA',note:'Проверить сроки открытых дел.'}
    ];
    db.events=samples.filter(ev=>db.users.some(u=>u.id===ev.ownerId)&&(!ev.linkType||(ev.linkType==='case'?db.cases:db.leads).some(x=>x.id===ev.linkId))).map(ev=>({...ev,status:'planned',createdBy:ev.ownerId}));
    return db;
  }
  const originalSeed=M.seed;M.seed=()=>init(originalSeed());
  function canView(db,u,ev){
    if(u.role==='ceo')return true;
    if(ev.linkType==='case'){const c=db.cases.find(c=>c.id===ev.linkId);return !!c&&M.canCase(db,u,c);}
    if(ev.linkType==='lead'){const l=db.leads.find(l=>l.id===ev.linkId);return !!l&&M.canLead(db,u,l);}
    return ev.ownerId===u.id||ev.createdBy===u.id;
  }
  function canEdit(db,u,ev){
    if(!canView(db,u,ev))return false;
    if(u.role==='ceo')return true;
    if(ev.linkType==='case'){const c=db.cases.find(c=>c.id===ev.linkId);return M.manageCase(db,u,c)||(u.role==='lawyer'&&ev.ownerId===u.id);}
    if(ev.linkType==='lead'){const l=db.leads.find(l=>l.id===ev.linkId);return M.editLead(u,l);}
    return ev.ownerId===u.id||ev.createdBy===u.id;
  }
  function items(db,u){
    init(db);
    const evs=db.events.filter(ev=>canView(db,u,ev)).map(ev=>({...ev,origin:'event'}));
    const tasks=db.tasks.filter(t=>{
      const c=db.cases.find(c=>c.id===t.caseId);
      return c&&M.canCase(db,u,c)&&(u.role!=='lawyer'||t.assigneeId===u.id);
    }).map(t=>({id:t.id,origin:'task',kind:'task',title:t.title,date:t.due,start:'',end:'',ownerId:t.assigneeId,linkType:'case',linkId:t.caseId,status:t.done?'done':'planned',location:'',note:'Срок выполнения задачи по делу'}));
    return [...evs,...tasks].sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)||a.title.localeCompare(b.title,'ru'));
  }
  function validate(db,u,input){
    assert(['meeting','court'].includes(input.kind),'Выберите встречу или судебное заседание');
    const title=String(input.title||'').trim();assert(title&&title.length<=160,'Введите название до 160 символов');
    assert(validDate(input.date),'Укажите корректную дату');
    const start=minutes(input.start),end=minutes(input.end);
    assert(Number.isFinite(start)&&Number.isFinite(end)&&end>start,'Время окончания должно быть позже начала в тот же день');
    assert(db.users.some(x=>x.id===input.ownerId&&x.active!==false),'Выберите ответственного');
    assert(['','case','lead'].includes(input.linkType),'Неизвестный тип привязки');
    if(input.linkType==='case'){
      const c=db.cases.find(c=>c.id===input.linkId);
      assert(c&&M.canCase(db,u,c),'Нет доступа к выбранному делу');
      assert([c.coordinatorId,c.lawyerId].includes(input.ownerId),'Ответственным должен быть участник дела');
      assert(M.manageCase(db,u,c)||(u.role==='lawyer'&&input.ownerId===u.id),'Можно создавать только свои события');
    }else if(input.linkType==='lead'){
      const l=db.leads.find(l=>l.id===input.linkId);
      assert(l&&M.editLead(u,l),'Нет права планировать встречи по этому лиду');
      assert(input.ownerId===l.ownerId,'Ответственный должен совпадать с менеджером лида');
    }else assert(u.role==='ceo'||input.ownerId===u.id,'Без привязки можно создать только своё событие');
    assert(input.kind!=='court'||input.linkType==='case','Для суда обязательно выберите дело');
    return {kind:input.kind,title,date:input.date,start:input.start,end:input.end,ownerId:input.ownerId,linkType:input.linkType,linkId:input.linkType?input.linkId:'',location:String(input.location||'').trim().slice(0,240),note:String(input.note||'').trim().slice(0,2000)};
  }
  function audit(db,u,ev,message){db.activity.unshift({id:uid(),type:'event',entityId:ev.id,actorId:u.id,message,at:new Date().toISOString()});}
  function save(db,u,input,eventId){
    init(db);const existing=eventId&&db.events.find(ev=>ev.id===eventId);
    if(eventId)assert(existing&&canEdit(db,u,existing),'Нет доступа к изменению события');
    const data=validate(db,u,input);
    const ev=existing||{id:uid(),createdBy:u.id,status:'planned'};
    Object.assign(ev,data);if(!existing)db.events.push(ev);
    audit(db,u,ev,(existing?'Изменено':'Запланировано')+' событие «'+ev.title+'»: '+ev.date+', '+ev.start+'–'+ev.end+'.');return ev;
  }
  function setStatus(db,u,eventId,status){
    const ev=db.events.find(ev=>ev.id===eventId);
    assert(ev&&canEdit(db,u,ev),'Нет доступа к событию');assert(['planned','done','cancelled'].includes(status),'Неизвестный статус');
    ev.status=status;audit(db,u,ev,'Событие «'+ev.title+'»: '+({planned:'запланировано',done:'завершено',cancelled:'отменено'}[status])+'.');
  }
  function conflicts(db,u,input,excludeId){
    return items(db,u).filter(ev=>ev.origin==='event'&&ev.id!==excludeId&&ev.status==='planned'&&ev.ownerId===input.ownerId&&ev.date===input.date&&minutes(ev.start)<minutes(input.end)&&minutes(input.start)<minutes(ev.end));
  }
  function layout(events){
    const sorted=events.map(ev=>({ev,start:minutes(ev.start),end:Math.max(minutes(ev.end),minutes(ev.start)+30)})).sort((a,b)=>a.start-b.start||a.end-b.end);
    const result=[];let group=[],edge=-1;
    function flush(){
      const ends=[];
      for(const item of group){let lane=ends.findIndex(end=>end<=item.start);if(lane<0)lane=ends.length;ends[lane]=item.end;item.lane=lane;}
      for(const item of group)result.push({...item.ev,lane:item.lane,lanes:ends.length,top:item.start/60*48,height:(item.end-item.start)/60*48});
      group=[];edge=-1;
    }
    for(const item of sorted){if(group.length&&item.start>=edge)flush();group.push(item);edge=Math.max(edge,item.end);}
    flush();return result;
  }
  M.calendar={TZ,today,shift,weekStart,monthDays,move,minutes,init,canView,canEdit,items,save,setStatus,conflicts,layout};
  if(typeof module!=='undefined')module.exports=M;
})(typeof globalThis!=='undefined'?globalThis:this);
