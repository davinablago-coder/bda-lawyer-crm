(function () {
  'use strict';
  const SERVER=!!window.BDA_SERVER;
  const M=window.BDA, KEY='bda.crm.prototype.v2', ACTOR='bda.crm.actor.v2';
  const $=s=>document.querySelector(s);
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const H=(name,attrs={},body='')=>'<'+name+Object.entries(attrs).filter(([,v])=>v!==false&&v!=null).map(([k,v])=>' '+k+'="'+e(v===true?'':v)+'"').join('')+'>'+body+'</'+name+'>';
  const div=(cls,body)=>H('div',{class:cls},body);
  const iconPaths={calendar:'M3 5h18v16H3z M3 10h18 M7 3v4 M17 3v4 M7 14h2 M13 14h2 M7 17h2',overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',crm:'M4 4h4v16H4z M10 4h4v10h-4z M16 4h4v13h-4z',cases:'M3 7h18v13H3z M8 7V4h8v3 M3 12h18 M10 12v3h4v-3',payments:'M3 5h18v14H3z M3 10h18 M6 15h4',employees:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',analytics:'M4 19V5 M4 19h16 M8 15v-3 M12 15V8 M16 15V5',search:'m21 21-4.4-4.4 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',plus:'M12 5v14 M5 12h14',arrow:'M5 12h14 M13 6l6 6-6 6',clock:'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',check:'m5 12 4 4L19 6',close:'m6 6 12 12 M6 18 18 6',logout:'M9 4H4v16h5 M9 12h12 M16 7l5 5-5 5',list:'M8 6h13 M8 12h13 M8 18h13 M3 6h1 M3 12h1 M3 18h1',doc:'M14 2H5v20h14V7z M14 2v5h5 M8 12h8 M8 16h6',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7z m-5 9 3 3 6-6'};
  const icon=n=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(iconPaths[n]||iconPaths.doc)+'"/></svg>';
  const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₸';
  const priceLabel=l=>l.amount?money(l.amount):'Стоимость не назначена';
  const workflowLabel=l=>({sales:'Квалификация',pricing:'Ожидает стоимости',pending:'На согласовании CEO',approved:'CEO утвердил · можно открыть дело',returned:'Возвращено координатору',opened:'Дело открыто',legacy:'Дело создано ранее'})[l.pricing.status];
  const awaiting=l=>!!l.coordinatorId&&!l.caseId;
  const fmt=d=>d?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(d.slice(0,10)+'T12:00:00')):'—';
  const initials=name=>name.replace(/[«»"]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const avatar=(name,cls='')=>div('avatar '+cls,e(initials(name)));
  const badge=(text,style)=>H('span',{class:'pill '+(style||'s'+Math.max(0,M.STAGES.indexOf(text)))},e(text));
  const btn=(label,action,attrs={})=>H('button',{type:'button',class:'btn',...attrs,'data-action':action},label);
  const link=(label,action,attrs={})=>btn(label,action,{class:'text-btn',...attrs});
  const emp=id=>db.users.find(u=>u.id===id)?.name||'Не назначен';
  const client=c=>db.clients.find(cl=>cl.id===c.clientId);
  const panel=(title,sub,body,action='')=>div('panel',div('panel-head',div('',H('h2',{},e(title))+(sub?H('p',{},e(sub)):''))+action)+body);
  const empty=text=>div('empty',e(text));
  const option=(value,label,selected)=>H('option',{value,selected:value===selected},e(label));
  const select=(name,items,value,attrs={})=>H('select',{name,...attrs},items.map(x=>typeof x==='string'?option(x,x,value):option(x.value,x.label,value)).join(''));
  const field=(label,input,full=false)=>div('field'+(full?' full':''),H('label',{},e(label)+input));
  const input=(name,value='',attrs={})=>'<input '+Object.entries({name,value,...attrs}).map(([k,v])=>k+'="'+e(v===true?'':v)+'"').join(' ')+'>';
  const area=(name,value='',attrs={})=>H('textarea',{name,maxlength:2000,...attrs},e(value));
  const formEnd=label=>div('form-error','')+div('form-actions',H('button',{type:'submit',class:'btn primary'},e(label)));
  const section=(label,action='')=>div('section-title',e(label)+action);
  const kv=(label,value)=>div('',div('field-label',e(label))+div('field-value',value));
  const names={dashboard:'Dashboard',crm:'CRM',calendar:'Календарь',cases:'Дела',payments:'Оплаты',employees:'Сотрудники',analytics:'Аналитика'};
  const rolePages={ceo:Object.keys(names),sales:['dashboard','crm','calendar'],coordinator:['dashboard','crm','calendar','cases','payments'],lawyer:['dashboard','calendar','cases']};
  let storageOK=true,db=M.seed(),actorId=SERVER?'':'u1',revision=0,busy=false,loginError='';
  if(SERVER)for(const key of Object.keys(db))if(Array.isArray(db[key]))db[key]=[];
  if(!SERVER)try{
    const saved=localStorage.getItem(KEY);
    if(saved){const parsed=JSON.parse(saved);if(parsed.version!==2||!['users','leads','clients','cases','tasks','invoices','receipts','documents','comments','activity'].every(k=>Array.isArray(parsed[k])))throw new Error('invalid');db=parsed;}
    const a=localStorage.getItem(ACTOR);if(a!==null)actorId=a;
    if(actorId&&!db.users.some(u=>u.id===actorId))actorId='u1';
  }catch{storageOK=false;}
  const calendarMigrationNeeded=!Array.isArray(db.events)||db.leads.some(l=>!l.pricing);
  if(!SERVER){M.initWorkflow(db);M.calendar.init(db);if(calendarMigrationNeeded)persist();}
  const cal={view:'month',date:M.calendar.today(),selected:M.calendar.today(),kind:'',owner:'',scope:'all',showDone:false};
  const ui={page:'dashboard',tab:'pipeline',view:'board',search:'',source:'',stage:'',caseStage:'',paymentStatus:'',detail:null,detailTab:'overview'};
  let timer;
  const actor=()=>M.user(db,actorId);
  const visibleCases=()=>M.caseList(db,actor());
  const visibleLeads=()=>M.leadList(db,actor());
  const taskList=()=>db.tasks.filter(t=>visibleCases().some(c=>c.id===t.caseId)&&(actor().role!=='lawyer'||t.assigneeId===actorId));
  function persist(){
    if(SERVER)return true;
    if(!storageOK)return false;
    try{localStorage.setItem(KEY,JSON.stringify(db));return true;}catch{storageOK=false;return false;}
  }
  function toast(message){clearTimeout(timer);$('#toast').textContent=message;$('#toast').classList.add('show');timer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
  function changeActor(id){
    if(SERVER)return;
    cal.owner='';cal.kind='';cal.scope='all';
    actorId=id;try{localStorage.setItem(ACTOR,id);}catch{storageOK=false;}
    closeDetails();$('#modal').close();Object.assign(ui,{page:'dashboard',tab:'pipeline',search:'',source:'',stage:'',caseStage:'',paymentStatus:''});render();
  }
  function navigate(page,tab){
    if(!rolePages[actor().role].includes(page)){toast('Этот раздел недоступен вашей роли');return;}
    Object.assign(ui,{page,tab:tab||'pipeline',search:'',source:'',stage:'',caseStage:'',paymentStatus:''});render();
  }
  function stats(items){return div('stats',items.map(([title,value,note,ico])=>div('stat',div('stat-top',e(title)+div('stat-icon',icon(ico)))+div('stat-value',e(value))+div('stat-note',e(note)))).join(''));}
  function pageHead(title,sub,actions=''){
    return div('page-head',div('',div('eyebrow',e(new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long'}).format(new Date())))+H('h1',{},e(title))+H('p',{class:'page-sub'},e(sub)))+div('head-buttons',actions));
  }
  function login(){
    if(SERVER)return div('login',div('login-aside',brand()+H('h1',{},'Каждое дело.<br>Под контролем.')+H('p',{},'Рабочее пространство BDA Lawyer'))+div('login-form',div('login-box',H('h2',{},'Вход сотрудника')+H('form',{'data-form':'server-login'},field('Email',input('email','',{type:'email',required:true,autocomplete:'username'}),true)+field('Пароль',input('password','',{type:'password',required:true,autocomplete:'current-password'}),true)+div('notice',e(loginError||'Войдите с учётной записью, созданной администратором.'))+formEnd('Войти')))));

    return div('login',div('login-aside',brand()+H('h1',{},'Каждое дело.<br>Под контролем.')+H('p',{},'Единое пространство BDA Lawyer<br>для продаж, юридической работы и команды.'))+div('login-form',div('login-box',div('eyebrow','ДЕМОНСТРАЦИОННЫЙ ДОСТУП')+H('h2',{},'Войти в пространство')+H('p',{},'Выберите роль, чтобы пройти её рабочий сценарий. Все записи вымышлены.')+db.users.filter(u=>u.id!=='u5').map(u=>btn(avatar(u.name)+div('',H('b',{},e(u.name))+H('small',{},M.ROLES[u.role]))+icon('arrow'),'login',{class:'demo-account','data-id':u.id})).join('')+H('p',{class:'login-note'},'Это демонстрация входа. Настоящие пароли и проверка доступа появятся в серверной версии.'))));
  }
  function brand(){return div('brand',div('brand-symbol','B')+div('',H('b',{},'BDA')+H('small',{},'LAWYER · WORKSPACE')));}
  function render(){
    if(!actorId){$('#app').innerHTML=login();return;}
    const u=actor(),focus=document.activeElement?.id,position=document.activeElement?.selectionStart;
    if(!rolePages[u.role].includes(ui.page))ui.page='dashboard';
    const icons={dashboard:'overview',crm:'crm',calendar:'calendar',cases:'cases',payments:'payments',employees:'employees',analytics:'analytics'};
    const nav=rolePages[u.role].map(p=>btn(icon(icons[p])+e(names[p])+(p==='crm'&&visibleLeads().filter(l=>l.stage==='Новые лиды').length?H('span',{class:'nav-count'},visibleLeads().filter(l=>l.stage==='Новые лиды').length):''),'nav',{class:ui.page===p?'active':'','data-page':p})).join('');
    const side=H('aside',{class:'sidebar'},brand()+div('nav-label','РАБОЧЕЕ ПРОСТРАНСТВО')+H('nav',{class:'nav','aria-label':'Разделы CRM'},nav)+div('sidebar-note',H('b',{},'Всё начинается с доверия.')+'Клиенты, дела и команда<br>в одном рабочем пространстве.')+div('profile',avatar(u.name,'gold')+div('',H('b',{},e(u.name))+H('small',{},M.ROLES[u.role]))+btn(icon('logout'),'logout',{class:'icon-btn logout','aria-label':SERVER?'Выйти':'Выйти из демонстрации'})));
    const top=H('header',{class:'topbar'},div('breadcrumb','BDA Lawyer <span>/</span> <b>'+names[ui.page]+'</b>')+div('top-actions',H('span',{class:'demo-pill'},SERVER?'Общая база':'Демонстрационный прототип')+(SERVER?btn('Обновить данные','refresh',{class:'btn small'}):div('role-picker',H('label',{for:'role-select'},'Просмотр от лица')+select('actor',db.users.map(x=>({value:x.id,label:M.ROLES[x.role]+(x.role==='lawyer'?' · '+x.name.split(' ')[0]:'')})),u.id,{id:'role-select','aria-label':'Демонстрационная роль'})))+btn(icon('bell'),'notifications',{class:'icon-btn','aria-label':'Задачи и уведомления'})+avatar(u.name)));
    const pages={dashboard:dashboard,crm:crm,calendar:calendarPage,cases:casesPage,payments:paymentsPage,employees:employeesPage,analytics:analytics};
    const footer=div('page-footer',H('span',{},'BDA Lawyer · Внутренняя система компании')+H('span',{},SERVER?'Данные сохраняются на сервере': 'Демо-данные хранятся в этом браузере'));
    $('#app').innerHTML=div('shell',side+H('main',{class:'workspace'},top+(!storageOK?div('storage-warning','Хранилище недоступно или содержит несовместимые данные. Изменения доступны только до перезагрузки. Используйте локальный сервер из README.'): '')+div('content',pages[ui.page]()+footer)));
    if(ui.page==='calendar'&&cal.view!=='month'){const scroll=$('.cal-scroll');if(scroll)scroll.scrollTop=8*48;}
    if(focus){const el=document.getElementById(focus);if(el){el.focus();if(typeof position==='number'&&el.setSelectionRange)el.setSelectionRange(position,position);}}
  }
  function dashboard(){
    const u=actor(),leads=visibleLeads(),cs=visibleCases(),tasks=taskList().filter(t=>!t.done),invoices=M.invoiceList(db,u);
    const pending=leads.filter(awaiting),late=tasks.filter(t=>t.due<M.date());
    const canFinance=['ceo','coordinator'].includes(u.role);
    const cards=u.role==='sales'?[
      ['Новые лиды',leads.filter(l=>l.stage===M.STAGES[0]).length,'Ожидают первого контакта','crm'],
      ['Активные продажи',leads.filter(l=>!['Успешно','Отказано'].includes(l.stage)).length,'От встречи до договора','cases'],
      ['Переданы координатору',pending.length,'Стоимость и согласование CEO','arrow'],
      ['Успешные продажи',leads.filter(l=>l.stage==='Успешно').length,'За всё время','check']
    ]:u.role==='lawyer'?[
      ['Мои дела',cs.filter(c=>c.stage!=='Завершено').length,'Закреплены за вами','cases'],
      ['Мои задачи',tasks.length,'Осталось выполнить','list'],
      ['На сегодня',tasks.filter(t=>t.due===M.date()).length,'Запланировано на сегодня','clock'],
      ['Просрочено',late.length,'Требуют внимания','bell']
    ]:[
      [u.role==='ceo'?'Новые лиды':'Ожидают приёма',u.role==='ceo'?leads.filter(l=>l.stage===M.STAGES[0]).length:pending.length,u.role==='ceo'?'Обращения из всех источников':'Передача от менеджера','crm'],
      ['Дела в работе',cs.filter(c=>c.stage!=='Завершено').length,'Активная юридическая работа','cases'],
      ['Открытые задачи',tasks.length,late.length+' с истёкшим сроком','clock'],
      ['Получено',money(invoices.reduce((s,i)=>s+M.paid(db,i),0)),'Поступления за всё время','payments']
    ];
    const subtitles={ceo:'Общая картина практики. Внимание — на том, что требует решения.',sales:'Новые обращения, следующие встречи и ваши договорённости.',coordinator:'Примите новые дела и помогите команде двигаться по плану.',lawyer:'Ваши дела, документы и ближайшие задачи.'};
    let main='',side='';
    if(pending.length&&['ceo','coordinator'].includes(u.role)){
      main+=div('welcome-strip',div('welcome-icon',icon('arrow'))+div('welcome-copy',H('b',{},u.role==='ceo'?'Ожидают решения CEO: '+pending.filter(l=>l.pricing.status==='pending').length:'Заявки в работе координатора: '+pending.length)+H('p',{},u.role==='ceo'?'Всего переданных заявок: '+pending.length+'. Решение доступно после отправки стоимости координатором.':'Назначьте стоимость и отправьте CEO. После утверждения откройте дело.'))+btn('Открыть заявки '+icon('arrow'),'handoff',{class:'btn small'}));
    }
    if(['ceo','sales'].includes(u.role)){
      main+=panel('Последние обращения','От первого контакта до сотрудничества',leadTable(leads.slice(0,6)),link('Вся воронка '+icon('arrow'),'nav',{'data-page':'crm'}));
    }else main+=panel('Задачи и сроки','Ближайшие поручения команды',taskRows(tasks.sort((a,b)=>a.due.localeCompare(b.due)).slice(0,6)));
    if(u.role==='ceo')main+=panel('Ближайшие задачи','Дела, которым нужно ваше внимание',taskRows(tasks.sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4)));
    if(u.role==='sales')main+=panel('Следующие контакты','План работы по вашим лидам',div('panel-pad',leads.filter(l=>!['Успешно','Отказано'].includes(l.stage)).sort((a,b)=>a.nextDate.localeCompare(b.nextDate)).slice(0,4).map(l=>div('activity',div('activity-icon',icon('clock'))+div('',link(e(l.name),'lead',{'data-id':l.id})+H('p',{},e(l.nextStep))+H('time',{},fmt(l.nextDate))))).join('')));
    if(leads.length)side+=panel('Воронка продаж','Все доступные вам обращения',div('panel-pad',funnel(leads))+div('funnel-footer',H('span',{},'Успешные / все лиды')+H('b',{},Math.round(leads.filter(l=>l.stage==='Успешно').length/Math.max(1,leads.length)*100)+'%')));
    else side+=panel('Этапы моих дел','Распределение текущей работы',div('panel-pad',M.CASE_STAGES.filter(s=>cs.some(c=>c.stage===s)).map(s=>div('funnel-row',div('funnel-line',e(s)+H('b',{},cs.filter(c=>c.stage===s).length)))).join('')||empty('Пока нет дел')));
    side+=panel('Последние действия','История рабочего пространства',div('panel-pad',activityRows(db.activity.filter(a=>activityVisible(a)).slice(0,5))));
    return pageHead('Здравствуйте, '+u.name.split(' ')[0],subtitles[u.role],['ceo','sales'].includes(u.role)?btn(icon('plus')+'Новый лид','new-lead',{class:'btn primary'}):btn(icon('cases')+'Мои дела','nav',{'data-page':'cases'}))+stats(cards)+div('grid-main',div('stack',main)+div('stack',side));
  }
  function funnel(leads){
    return M.STAGES.map((s,i)=>{const count=leads.filter(l=>l.stage===s).length;return div('funnel-row',div('funnel-line',link(e(s),'filter-stage',{'data-stage':s})+H('b',{},count))+div('bar','<i style="width:'+Math.round(count/Math.max(1,leads.length)*100)+'%;background:'+['#a5b0a1','#ceb779','#b49cc4','#95aec1','#789976','#c9a092'][i]+'"></i>'));}).join('');
  }
  function activityVisible(a){const u=actor();if(a.type==='event')return db.events.some(ev=>ev.id===a.entityId&&M.calendar.canView(db,u,ev));return a.type==='case'?db.cases.some(c=>c.id===a.entityId&&M.canCase(db,u,c)):db.leads.some(l=>l.id===a.entityId&&M.canLead(db,u,l));}
  function activityRows(rows){return rows.map(a=>div('activity',div('activity-icon',icon(a.type==='case'?'cases':'crm'))+div('',H('p',{},H('b',{},e(emp(a.actorId)))+' · '+e(a.message))+H('time',{},fmt(a.at)+' · '+new Date(a.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}))))).join('')||empty('Действия появятся здесь');}
  function leadTable(rows){
    const head=['Клиент','Услуга','Этап','Ответственный','Следующий шаг'].map(x=>H('th',{},x)).join('');
    const body=rows.map(l=>H('tr',{},H('td',{},div('person-cell',avatar(l.name)+div('',btn(e(l.name),'lead',{class:'cell-link','data-id':l.id})+H('small',{},e(l.source)))))+H('td',{},e(l.service))+H('td',{},badge(l.stage)+div('task-meta',e(workflowLabel(l))))+H('td',{},emp(l.ownerId).split(' ')[0])+H('td',{},l.caseId?H('span',{class:'muted'},'Передано в дело'):fmt(l.nextDate)))).join('');
    return div('table-wrap',H('table',{},H('thead',{},H('tr',{},head))+H('tbody',{},body)))+(rows.length?'':empty('Лидов по этим условиям нет'));
  }
  function searchBar(extra=''){
    return div('toolbar',div('search',icon('search')+input('search',ui.search,{id:'record-search',placeholder:'Поиск по имени, номеру, запросу…','aria-label':'Поиск записей'}))+extra);
  }
  function table(headers,rows){
    return div('table-wrap',H('table',{},H('thead',{},H('tr',{},headers.map(x=>H('th',{},e(x))).join('')))+H('tbody',{},rows)));
  }
  function matches(value){return value.toLowerCase().includes(ui.search.trim().toLowerCase());}
  function crm(){
    const u=actor(),ls=visibleLeads(),pending=ls.filter(awaiting).length;
    const tabs=[['pipeline','Воронка',ls.length],['clients','Клиенты',M.clientList(db,u).length]];
    if(['ceo','coordinator'].includes(u.role))tabs.push(['handoff','Передача и согласование',pending]);
    let out=pageHead('CRM','Каждое обращение — начало нового сотрудничества.',['ceo','sales'].includes(u.role)?btn(icon('plus')+'Новый лид','new-lead',{class:'btn primary'}):'')+div('tabs',tabs.map(([key,label,count])=>btn(e(label)+H('span',{class:'tab-count'},count),'crm-tab',{class:ui.tab===key?'active':'','data-tab':key})).join(''));
    if(ui.tab==='clients'){
      const cls=M.clientList(db,u).filter(c=>matches(c.name+' '+c.phone));
      const rows=cls.map(cl=>{
        const count=u.role==='sales'?db.cases.filter(c=>c.clientId===cl.id&&db.leads.some(l=>l.id===c.leadId&&l.ownerId===u.id)).length:visibleCases().filter(c=>c.clientId===cl.id).length;
        return H('tr',{},H('td',{},btn(e(cl.name),'client',{class:'cell-link','data-id':cl.id}))+H('td',{},e(cl.phone))+H('td',{},count));
      }).join('');
      return out+searchBar()+div('panel',table(['Клиент','Телефон','Дела'],rows)+(cls.length?'':empty('Клиенты появятся после приёма передачи')));
    }
    if(ui.tab==='handoff'){
      const rows=ls.filter(awaiting);
      rows.sort((a,b)=>Number(b.pricing.status==='pending')-Number(a.pricing.status==='pending'));
      const queue=rows.map(l=>panel(l.name,l.code+' · '+l.service,div('panel-pad',
        div('summary-row',badge(workflowLabel(l),l.pricing.status==='approved'?'s4':'s3'))+
        div('detail-grid',kv('Стоимость',e(priceLabel(l)))+kv('Координатор',e(emp(l.coordinatorId))))+
        (u.role==='ceo'?ceoPriceDecision(l):div('notice',e(l.nextStep)))+
        btn(u.role==='coordinator'?'Открыть заявку и продолжить':'Карточка и история','lead',{'data-id':l.id,class:'btn small'})
      ))).join('');
      return out+div('welcome-strip',div('welcome-copy',H('b',{},'Передача и согласование стоимости')+H('p',{},'Координатор назначает стоимость → CEO принимает решение → координатор открывает дело.')))+div('stack',queue||empty('Нет заявок, ожидающих обработки'));
    }
    const rows=ls.filter(l=>matches(l.name+' '+l.phone+' '+l.note+' '+l.code)&&(!ui.source||l.source===ui.source)&&(!ui.stage||l.stage===ui.stage));
    out+=searchBar(select('source',[{value:'',label:'Все источники'},...M.SOURCES],ui.source,{id:'source-filter','aria-label':'Источник лида'})+select('stage',[{value:'',label:'Все этапы'},...M.STAGES],ui.stage,{id:'stage-filter','aria-label':'Этап воронки'})+H('span',{class:'spacer'})+H('span',{class:'small muted'},rows.length+' записей')+div('segmented',btn(icon('crm'),'view',{'data-view':'board',class:ui.view==='board'?'active':'','aria-label':'Канбан'})+btn(icon('list'),'view',{'data-view':'table',class:ui.view==='table'?'active':'','aria-label':'Таблица'})));
    if(ui.view==='table')return out+div('panel',leadTable(rows));
    return out+div('board',M.STAGES.map((stage,i)=>{
      const items=rows.filter(l=>l.stage===stage);
      return div('lane',div('lane-head',badge(String(i+1).padStart(2,'0'),'s'+i)+H('h2',{},e(stage))+H('span',{class:'lane-count'},items.length))+div('lane-total','Сумма предложений: '+money(items.reduce((s,l)=>s+l.amount,0)))+items.map(l=>btn(div('card-source',e(l.source)+' <span style="float:right">'+e(l.code)+'</span>')+H('h3',{},e(l.name))+H('p',{},e(l.service))+div('card-value',e(priceLabel(l)))+div('task-meta',e(workflowLabel(l)))+(l.stage==='Успешно'?div('card-next',l.caseId?'✓ Дело создано':'Ожидает координатора'):l.stage==='Отказано'?div('card-next',e(l.reason)):div('card-next',e(l.nextStep)))+div('card-foot',H('span',{},l.caseId?'Передача принята':fmt(l.nextDate))+avatar(emp(l.ownerId))),'lead',{class:'lead-card','data-id':l.id})).join('')+(items.length?'':div('empty-lane','На этом этапе пока нет лидов')));}).join(''))+H('p',{class:'caption'},'Откройте карточку, чтобы изменить этап, следующий контакт или передать дело координатору.');
  }
  function casesPage(){
    const rows=visibleCases().filter(c=>matches(c.code+' '+c.title+' '+client(c)?.name)&&(!ui.caseStage||c.stage===ui.caseStage));
    const body=rows.map(c=>H('tr',{},
      H('td',{},btn(e(c.code)+' · '+e(c.title),'case',{class:'cell-link','data-id':c.id})+div('task-meta',e(client(c)?.name)))+
      H('td',{},badge(c.stage,c.stage==='Завершено'?'s4':'s3'))+H('td',{},e(emp(c.lawyerId)))+
      H('td',{class:c.due<M.date()&&c.stage!=='Завершено'?'danger':''},fmt(c.due))+
      H('td',{},db.tasks.filter(t=>t.caseId===c.id&&t.done).length+' / '+db.tasks.filter(t=>t.caseId===c.id).length)
    )).join('');
    return pageHead(actor().role==='lawyer'?'Мои дела':'Дела','Юридическая работа, сроки и ответственность в одном месте.')+
      searchBar(select('case-stage',[{value:'',label:'Все этапы дела'},...M.CASE_STAGES],ui.caseStage,{id:'case-filter','aria-label':'Этап дела'}))+
      div('panel',table(['Дело и клиент','Этап','Юрист','Срок','Задачи'],body)+(rows.length?'':empty('Нет дел по выбранным условиям')));
  }
  function taskRows(rows){
    return rows.map(t=>{const c=db.cases.find(c=>c.id===t.caseId);const allowed=M.manageCase(db,actor(),c)||t.assigneeId===actorId;
      return div('task-row',btn(t.done?icon('check'):'','toggle-task',{class:'task-check'+(t.done?' done':''),'data-id':t.id,'aria-label':(t.done?'Возобновить: ':'Выполнить: ')+t.title,disabled:!allowed})+div('',div('task-title'+(t.done?' task-done':''),e(t.title))+div('task-meta',link(e(c.code),'case',{'data-id':c.id})+' · '+e(emp(t.assigneeId))))+div('task-due'+(!t.done&&t.due<M.date()?' late':''),!t.done&&t.due<M.date()?'Просрочено · '+fmt(t.due):fmt(t.due)));
    }).join('')||empty('Открытых задач нет');
  }
  function invoicesTable(rows,withCase=true){
    return div('table-wrap',H('table',{},H('thead',{},H('tr',{},[withCase?'Клиент / дело':'Назначение','План','Получено','Остаток','Статус',''].map(x=>H('th',{},x)).join('')))+H('tbody',{},rows.map(i=>{const c=db.cases.find(c=>c.id===i.caseId),status=M.invoiceStatus(db,i);return H('tr',{},H('td',{},withCase?btn(e(client(c)?.name),'case',{class:'cell-link','data-id':c.id})+div('task-meta',e(i.title)):e(i.title))+H('td',{},money(i.amount))+H('td',{},money(M.paid(db,i)))+H('td',{},money(M.balance(db,i)))+H('td',{},badge(status,status==='Оплачено'?'s4':status==='Просрочено'?'s5':'s1')+div('task-meta',fmt(i.due)))+H('td',{},M.balance(db,i)>0?btn('Учесть оплату','receipt',{class:'btn small','data-id':i.id}):icon('check')));}).join(''))))+(rows.length?'':empty('Начисления пока не созданы'));
  }
  function paymentsPage(){
    const all=M.invoiceList(db,actor()),rows=all.filter(i=>{const c=db.cases.find(c=>c.id===i.caseId);return matches(client(c)?.name+' '+c.code+' '+i.title)&&(!ui.paymentStatus||M.invoiceStatus(db,i)===ui.paymentStatus);});
    return pageHead('Оплаты','Плановые платежи и фактические поступления по делам.',btn(icon('plus')+'Запланировать платёж','new-invoice',{class:'btn primary'}))+stats([
      ['Начислено',money(all.reduce((s,i)=>s+i.amount,0)),'По всем плановым платежам','doc'],
      ['Получено',money(all.reduce((s,i)=>s+M.paid(db,i),0)),'Фактические поступления','payments'],
      ['Остаток',money(all.reduce((s,i)=>s+M.balance(db,i),0)),'Включая просроченные суммы','clock'],
      ['Просрочено',money(all.filter(i=>M.invoiceStatus(db,i)==='Просрочено').reduce((s,i)=>s+M.balance(db,i),0)),'Неоплаченный остаток после срока','bell']
    ])+searchBar(select('payment-status',[{value:'',label:'Все статусы'},'Ожидается','Частично','Оплачено','Просрочено'],ui.paymentStatus,{id:'payment-filter','aria-label':'Статус платежа'}))+div('panel',invoicesTable(rows))+H('p',{class:'caption'},'В прототипе фиксируются поступления в целых тенге. Банковская операция не выполняется; подтверждающие документы появятся в серверной версии.');
  }
  function employeesPage(){
    return pageHead('Сотрудники','Команда BDA Lawyer и текущая загрузка.')+div('notice',SERVER?'Учётные записи создаёт администратор. Роль определяет доступ к записям и действиям.':'Демонстрационные сотрудники. Роль определяет доступ к разделам и записям; реальные приглашения появятся после подключения авторизации.')+div('employees',db.users.map(u=>{const cs=db.cases.filter(c=>(c.lawyerId===u.id||c.coordinatorId===u.id)&&c.stage!=='Завершено'),ts=db.tasks.filter(t=>t.assigneeId===u.id&&!t.done);return div('employee',avatar(u.name)+H('h2',{},e(u.name))+badge(M.ROLES[u.role],'s'+({ceo:2,sales:1,coordinator:4,lawyer:3}[u.role]))+H('p',{},e(u.specialty))+div('employee-meta',H('span',{},H('b',{},cs.length)+'активных дел')+H('span',{},H('b',{},ts.length)+'открытых задач')));}).join(''));
  }
  function analytics(){
    const ls=db.leads,won=ls.filter(l=>l.stage==='Успешно').length,refused=ls.filter(l=>l.stage==='Отказано');
    const sourceRows=M.SOURCES.map(s=>({name:s,count:ls.filter(l=>l.source===s).length}));
    const chart=rows=>rows.map(r=>div('chart-row',e(r.name)+div('bar','<i style="width:'+Math.round(r.count/Math.max(1,...rows.map(x=>x.count))*100)+'%"></i>')+H('b',{},r.count))).join('');
    return pageHead('Аналитика','Продажи, результаты и деньги — на основе записей CRM.')+div('notice','За всё время · Конверсия = успешные лиды / все лиды. Поступления = сумма зарегистрированных оплат. Стоимость сделок и взысканные в пользу клиента суммы не считаются поступлениями компании.')+stats([
      ['Все лиды',ls.length,'Все источники и направления','crm'],['Конверсия',Math.round(won/Math.max(1,ls.length)*100)+'%',won+' успешных из '+ls.length,'analytics'],
      ['Открыто дел',db.cases.length,'Созданы после приёма передачи','cases'],['Поступления',money(db.receipts.reduce((s,r)=>s+r.amount,0)),'Фактически учтённые суммы','payments']
    ])+div('two-col',panel('Воронка продаж','Распределение по текущим этапам',div('panel-pad',funnel(ls)))+panel('Источники обращений','Количество лидов из каждого канала',div('panel-pad',chart(sourceRows)))+panel('Причины отказов',refused.length+' отказов за всё время',div('panel-pad',refused.length?chart(M.REASONS.map(r=>({name:r,count:refused.filter(l=>l.reason===r).length})).filter(r=>r.count)):empty('Отказов нет')))+panel('Загрузка юристов','Активные закреплённые дела',div('panel-pad',chart(db.users.filter(u=>u.role==='lawyer').map(u=>({name:u.name,count:db.cases.filter(c=>c.lawyerId===u.id&&c.stage!=='Завершено').length}))))));
  }
  const eventKinds={task:'Задача',meeting:'Встреча',court:'Суд'};
  function calendarFiltered(){
    return M.calendar.items(db,actor()).filter(ev=>(!cal.kind||ev.kind===cal.kind)&&(!cal.owner||ev.ownerId===cal.owner)&&(cal.scope!=='mine'||ev.ownerId===actorId)&&(cal.showDone||ev.status==='planned')&&matches(ev.title+' '+emp(ev.ownerId)+' '+ev.location+' '+calendarLinkName(ev)));
  }
  function calendarLinkName(ev){
    if(ev.linkType==='case'){const c=db.cases.find(c=>c.id===ev.linkId);return c?c.code+' · '+client(c)?.name:'';}
    if(ev.linkType==='lead'){const l=db.leads.find(l=>l.id===ev.linkId);return l?l.code+' · '+l.name:'';}
    return '';
  }
  function eventButton(ev,cls='cal-event',attrs={}){
    const time=ev.origin==='task'?'Срок':ev.start;
    return btn(H('span',{class:'event-time'},e(time))+H('span',{class:'event-name'},e(ev.title)),'cal-event',{
      class:cls+' kind-'+ev.kind+(ev.status!=='planned'?' event-inactive':''),
      'data-id':ev.id,'data-origin':ev.origin,
      title:eventKinds[ev.kind]+' · '+ev.title+' · '+(ev.start?ev.start+'–'+ev.end:'В течение дня')+' · '+emp(ev.ownerId),
      ...attrs
    });
  }
  function calendarPage(){
    const C=M.calendar,all=C.items(db,actor()),rows=calendarFiltered(),weekday=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const owners=actor().role==='ceo'?db.users:db.users.filter(u=>u.id===actorId||all.some(ev=>ev.ownerId===u.id));
    let days=cal.view==='month'?C.monthDays(cal.date):cal.view==='week'?Array.from({length:7},(_,i)=>C.shift(C.weekStart(cal.date),i)):[cal.date];
    const period=cal.view==='month'?new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(cal.date+'T12:00:00Z')):cal.view==='week'?fmt(days[0])+' — '+fmt(days[6])+', '+cal.date.slice(0,4):fmt(cal.date)+', '+cal.date.slice(0,4);
    const periodCount=rows.filter(ev=>cal.view==='month'?ev.date.slice(0,7)===cal.date.slice(0,7):days.includes(ev.date)).length;
    const controls=div('cal-controls',div('cal-period',btn('‹','cal-shift',{class:'btn small','data-direction':-1,'aria-label':'Предыдущий период'})+btn('Сегодня','cal-today',{class:'btn small'})+btn('›','cal-shift',{class:'btn small','data-direction':1,'aria-label':'Следующий период'})+H('h2',{},e(period)))+div('segmented',[['month','Месяц'],['week','Неделя'],['day','День']].map(([key,name])=>btn(name,'cal-view',{'data-view':key,class:cal.view===key?'active':'','aria-pressed':cal.view===key?'true':'false'})).join('')));
    const filters=searchBar(select('kind',[{value:'',label:'Все типы'},...Object.entries(eventKinds).map(([value,label])=>({value,label}))],cal.kind,{id:'cal-kind','aria-label':'Тип события'})+
      select('owner',[{value:'',label:'Все сотрудники'},...owners.map(u=>({value:u.id,label:u.name}))],cal.owner,{id:'cal-owner','aria-label':'Ответственный сотрудник'})+
      input('date',cal.date,{type:'date',id:'cal-date','aria-label':'Перейти к дате'})+link('Сбросить','cal-clear'));
    let grid='';
    if(cal.view==='month'){
      grid=div('cal-month-scroll',div('cal-weekdays',weekday.map(w=>H('div',{},w)).join(''))+div('cal-month',days.map(d=>{
        const items=rows.filter(ev=>ev.date===d),today=d===C.today(),selected=d===cal.selected;
        return div('cal-cell'+(d.slice(0,7)!==cal.date.slice(0,7)?' other-month':'')+(selected?' selected-day':'')+(today?' is-today':''),
          div('cal-cell-top',btn(String(Number(d.slice(-2))),'cal-day',{'data-date':d,class:'cal-day-number','aria-label':'Выбрать '+d,'aria-pressed':selected?'true':'false'})+(today?H('span',{class:'cal-today-label'},'Сегодня'):''))+
          items.slice(0,3).map(ev=>eventButton(ev)).join('')+(items.length>3?btn('Ещё '+(items.length-3)+'…','cal-day',{class:'cal-more','data-date':d,'data-open':'day'}):'')
        );
      }).join('')));
    }else{
      const headers=div('cal-time-header',div('cal-zone','UTC+5')+days.map(d=>btn(H('small',{},weekday[(new Date(d+'T12:00:00Z').getUTCDay()+6)%7])+H('b',{},Number(d.slice(-2))),'cal-day',{'data-date':d,'data-open':'day',class:'cal-time-day'+(d===C.today()?' is-today':'')})).join(''));
      const allday=div('cal-all-day',div('cal-zone','Сроки задач')+days.map(d=>div('cal-all-day-column',rows.filter(ev=>ev.date===d&&ev.origin==='task').map(ev=>eventButton(ev)).join(''))).join(''));
      const timeLabels=div('cal-time-axis',Array.from({length:24},(_,i)=>H('span',{style:'top:'+(i*48)+'px'},String(i).padStart(2,'0')+':00')).join(''));
      const columns=days.map(d=>div('cal-time-column',C.layout(rows.filter(ev=>ev.date===d&&ev.origin==='event')).map(ev=>eventButton(ev,'cal-timed-event',{
        style:'top:'+ev.top+'px;height:'+Math.max(24,ev.height-2)+'px;left:calc('+ev.lane/ev.lanes*100+'% + 3px);width:calc('+100/ev.lanes+'% - 6px)'
      })).join(''))).join('');
      grid=div('cal-time',H('div',{class:'cal-week-inner',style:'--cal-days:'+days.length},headers+allday+div('cal-scroll',div('cal-time-body',timeLabels+columns))));
    }
    const agenda=rows.filter(ev=>ev.date===cal.selected);
    const side=panel('План на '+fmt(cal.selected),agenda.length+' событий · Азия/Алматы',div('cal-agenda',agenda.map(ev=>btn(
      div('cal-agenda-time',ev.origin==='task'?'В течение дня':ev.start+' — '+ev.end)+
      div('cal-agenda-title',e(ev.title))+div('cal-agenda-meta',e(eventKinds[ev.kind])+' · '+e(emp(ev.ownerId)))+
      (ev.location?div('cal-agenda-meta',e(ev.location)):'')+(ev.status!=='planned'?div('cal-agenda-meta',ev.status==='done'?'Завершено':'Отменено'):'')
    ,'cal-event',{class:'cal-agenda-card kind-'+ev.kind+(ev.status!=='planned'?' event-inactive':''),'data-id':ev.id,'data-origin':ev.origin})).join('')||empty('На выбранную дату событий нет'))+div('panel-pad',btn(icon('plus')+'Добавить событие','new-event',{class:'btn small'})));
    return pageHead('Календарь','Сроки дел, встречи и судебные заседания — в одном расписании.',btn(icon('plus')+'Новое событие','new-event',{class:'btn primary'}))+
      div('cal-scope-row',div('segmented',btn('Общий календарь','cal-scope',{'data-scope':'all',class:cal.scope==='all'?'active':''})+btn('Мой календарь','cal-scope',{'data-scope':'mine',class:cal.scope==='mine'?'active':''}))+
      H('span',{class:'caption',style:'margin:0'},actor().role==='ceo'?'Все события компании':'События доступных вам дел и обращений'))+
      filters+div('cal-options',div('cal-legend',Object.entries(eventKinds).map(([key,label])=>H('span',{class:'kind-'+key},'<i></i>'+label)).join(''))+
      H('label',{class:'cal-completed'},'<input type="checkbox" id="cal-completed" '+(cal.showDone?'checked':'')+'> Завершённые и отменённые')+H('span',{class:'small muted'},periodCount+' в периоде'))+
      div('cal-layout',div('panel cal-panel',controls+grid)+side)+H('p',{class:'caption'},'Время встреч и судов — по Алматы (UTC+5). Сроки задач отображаются без времени и синхронизируются с делами. Нажмите на событие, чтобы посмотреть детали.');
  }
  function calendarDetail(id,origin){
    const ev=M.calendar.items(db,actor()).find(ev=>ev.id===id&&ev.origin===origin);if(!ev)throw new Error('Событие недоступно');
    const editable=origin==='event'&&M.calendar.canEdit(db,actor(),ev);
    const c=origin==='task'&&db.cases.find(c=>c.id===ev.linkId);
    const taskEditable=c&&(M.manageCase(db,actor(),c)||ev.ownerId===actorId);
    const state={planned:'Запланировано',done:'Завершено',cancelled:'Отменено'};
    showModal(eventKinds[ev.kind],H('h3',{class:'event-detail-title'},e(ev.title))+div('summary-row',badge(state[ev.status],ev.status==='planned'?'s3':ev.status==='done'?'s4':'s5'))+
      div('detail-grid',kv('Дата',fmt(ev.date)+', '+ev.date.slice(0,4))+kv('Время · Алматы',ev.start?ev.start+' — '+ev.end:'В течение дня')+kv('Ответственный',e(emp(ev.ownerId)))+kv('Место / ссылка',e(ev.location||'Не указано')))+
      (ev.note?kv('Комментарий',e(ev.note)):'')+
      (ev.linkType?section('Связанная запись')+link(e(calendarLinkName(ev))+' '+icon('arrow'),ev.linkType,{'data-id':ev.linkId}):'')+
      div('form-actions',(editable?btn('Редактировать','edit-event',{'data-id':ev.id}):'')+(taskEditable?btn(ev.status==='done'?'Возобновить':'Выполнить задачу','calendar-task',{'data-id':ev.id,class:'btn primary'}):'')+
        (editable?btn(ev.status==='planned'?'Завершить':'Вернуть в план','event-status',{'data-id':ev.id,'data-status':ev.status==='planned'?'done':'planned',class:'btn primary'}):''))+
      (editable&&ev.status!=='cancelled'?div('form-actions',link('Отменить событие','event-status',{'data-id':ev.id,'data-status':'cancelled'})):''));
  }
  function eventLinks(kind){
    const links=kind==='meeting'?[{value:'',label:'Без привязки'}]:[];
    const cases=visibleCases().filter(c=>kind!=='task'||M.manageCase(db,actor(),c));
    links.push(...cases.map(c=>({value:'case:'+c.id,label:c.code+' · '+client(c)?.name})));
    if(kind==='meeting')links.push(...visibleLeads().filter(l=>M.editLead(actor(),l)).map(l=>({value:'lead:'+l.id,label:l.code+' · '+l.name})));
    return links;
  }
  function eventOwners(link){
    const [type,id]=(link||'').split(':');let ids=[actorId];
    if(type==='case'){const c=visibleCases().find(c=>c.id===id);if(c)ids=M.manageCase(db,actor(),c)?[c.coordinatorId,c.lawyerId]:[actorId];}
    else if(type==='lead'){const l=visibleLeads().find(l=>l.id===id);if(l)ids=[l.ownerId];}
    else if(actor().role==='ceo')ids=db.users.map(u=>u.id);
    return db.users.filter(u=>ids.includes(u.id)).map(u=>({value:u.id,label:u.name}));
  }
  function eventModal(eventId){
    const ev=eventId&&db.events.find(ev=>ev.id===eventId);
    if(eventId&&(!ev||!M.calendar.canEdit(db,actor(),ev)))throw new Error('Нет доступа к изменению события');
    const kinds=[{value:'meeting',label:'Встреча'}];
    if(actor().role!=='sales')kinds.push({value:'court',label:'Судебное заседание'});
    if(!ev&&['ceo','coordinator'].includes(actor().role))kinds.push({value:'task',label:'Задача по делу'});
    const kind=ev?.kind||'meeting',links=eventLinks(kind),link=ev?.linkType?ev.linkType+':'+ev.linkId:'';
    const owners=eventOwners(link);
    showModal(ev?'Редактировать событие':'Новое событие',H('form',{'data-form':'calendar-event','data-id':ev?.id||''},
      div('form-grid',field('Тип',select('kind',kinds,kind,{id:'event-kind'}))+field('Дата / срок',input('date',ev?.date||cal.selected,{type:'date',required:true}))+
        field('Название',input('title',ev?.title||'',{required:true,maxlength:160,placeholder:'Например, судебное заседание'}),true)+
        field('Дело или лид',select('link',links,link,{id:'event-link'}),true)+
        field('Ответственный',select('ownerId',owners,ev?.ownerId||actorId,{required:true,id:'event-owner'}),true)+
        H('div',{class:'form-grid event-time-fields field full'},field('Начало · Алматы',input('start',ev?.start||'10:00',{type:'time',required:true}))+field('Окончание · Алматы',input('end',ev?.end||'11:00',{type:'time',required:true})))+
        H('div',{class:'form-grid event-extra field full'},field('Место / ссылка на встречу',input('location',ev?.location||'',{maxlength:240,placeholder:'Суд, офис или видеоконференция'}),true)+field('Комментарий',area('note',ev?.note||''),true))
      )+div('cal-conflict')+div('caption','Для заседания и задачи обязательно дело. При совпадении времени календарь предупредит о занятости сотрудника.')+formEnd(ev?'Сохранить событие':'Добавить в календарь')));
    const form=$('#modal form');if(form)updateEventForm(form);
  }
  function updateEventForm(target){
    const form=target.matches?.('form')?target:target.closest?.('form');if(!form)return;
    const kind=form.elements.kind.value,linkSelect=form.elements.link,ownerSelect=form.elements.ownerId,oldLink=linkSelect.value;
    const links=eventLinks(kind);
    linkSelect.innerHTML=links.map(x=>option(x.value,x.label,oldLink)).join('');
    if(!links.some(x=>x.value===oldLink)&&links.length)linkSelect.value=links[0].value;
    const owners=eventOwners(linkSelect.value),oldOwner=ownerSelect.value;
    ownerSelect.innerHTML=owners.map(x=>option(x.value,x.label,oldOwner)).join('');
    if(!owners.some(x=>x.value===oldOwner)&&owners.length)ownerSelect.value=owners[0].value;
    for(const cls of ['.event-time-fields','.event-extra'])form.querySelector(cls).hidden=kind==='task';
    form.elements.start.required=form.elements.end.required=kind!=='task';
    const data=Object.fromEntries(new FormData(form));
    const collisions=kind==='task'?[]:M.calendar.conflicts(db,actor(),data,form.dataset.id);
    form.querySelector('.cal-conflict').innerHTML=collisions.length?div('notice warm','Пересечение у ответственного: '+collisions.map(ev=>e(ev.start+'–'+ev.end+' · '+ev.title)).join('; ')+'. Можно выбрать другое время или сохранить совпадение.'):'';
  }

  function openDetail(type,id,tab='overview'){
    $('#modal').close();
    ui.detail={type,id};ui.detailTab=tab;
    try{renderDetail();if(!$('#detail').open)$('#detail').showModal();}catch(err){ui.detail=null;toast(err.message);}
  }
  function closeDetails(){ui.detail=null;$('#detail').close();}
  function detailHeader(eyebrow,title,sub){
    return div('drawer-head',div('',div('eyebrow',e(eyebrow))+H('h2',{id:'detail-title'},e(title))+H('p',{},e(sub)))+btn(icon('close'),'close-detail',{class:'icon-btn','aria-label':'Закрыть карточку'}));
  }
  function ceoPriceDecision(l){
    if(l.pricing.status!=='pending'){
      const feedback=l.pricing.history.at(-1)?.feedback;
      const messages={
        pricing:'Координатор '+emp(l.coordinatorId)+' ещё не назначил и не отправил стоимость. После отправки здесь появятся сумма и кнопки решения CEO.',
        returned:'Стоимость отклонена и возвращена координатору. Ожидается новое предложение.'+(feedback?' Причина: '+feedback:''),
        approved:'CEO утвердил текущую сумму. Координатор может открыть дело и назначить юриста.'
      };
      return div('notice',e(messages[l.pricing.status]||workflowLabel(l)));
    }
    const proposal=l.pricing.history.at(-1);
    return div('notice',H('b',{},'На утверждение: '+e(priceLabel(l)))+' · версия '+l.pricing.revision+'<br>'+e(proposal?.note||''))+
      H('form',{'data-form':'decide-price','data-id':l.id},input('revision',l.pricing.revision,{type:'hidden'})+
        field('Комментарий CEO (обязателен при отклонении)',area('note','',{placeholder:'Укажите причину отклонения или комментарий к одобрению'}),true)+
        div('form-error','')+div('form-actions',
          H('button',{type:'submit',name:'decision',value:'approve',class:'btn primary'},'Утвердить сумму')+
          H('button',{type:'submit',name:'decision',value:'return',class:'btn'},'Отклонить и вернуть')));
  }
  function renderDetail(){
    if(!ui.detail)return;
    const {type,id}=ui.detail,u=actor();
    let body='',head='';
    if(type==='lead'){
      const l=db.leads.find(x=>x.id===id);if(!l||!M.canLead(db,u,l))throw new Error('Нет доступа к лиду');
      head=detailHeader(l.code+' · Лид',l.name,l.phone+' · '+l.source);
      body=div('summary-row',badge(l.stage)+H('span',{},e(l.service)))+div('detail-grid',kv('Ответственный',e(emp(l.ownerId)))+kv('Стоимость',e(priceLabel(l)))+kv('Согласование',e(workflowLabel(l)))+kv('Координатор',e(emp(l.coordinatorId)))+kv('Создан',fmt(l.createdAt))+kv('Следующий контакт',fmt(l.nextDate)))+kv('Запрос клиента',e(l.note));
      if(l.caseId){
        const c=db.cases.find(c=>c.id===l.caseId);
        body+=section('Передача завершена')+div('notice','Дело '+e(c.code)+' принято координатором '+e(emp(c.coordinatorId))+'. Продажа зафиксирована.')+(M.canCase(db,u,c)?btn('Открыть дело '+icon('arrow'),'case',{'data-id':c.id,class:'btn primary'}):'');
      }else if(M.editLead(u,l)){
        body+=section('Работа с лидом')+H('form',{'data-form':'edit-lead','data-id':l.id},
          div('form-grid',field('Этап',select('stage',M.STAGES.filter(s=>s!=='Успешно'),l.stage,{required:true}))+field('Следующий шаг',input('nextStep',l.nextStep,{maxlength:160}),true)+field('Дата контакта',input('nextDate',l.nextDate,{type:'date'}))+field('Причина отказа',select('reason',[{value:'',label:'Выберите при отказе'},...M.REASONS],l.reason)))+div('caption','Для активного лида обязательны следующий шаг и дата. После квалификации передайте заявку координатору отдельным действием ниже.')+formEnd('Сохранить изменения'));
      }
      if(!l.caseId&&u.role==='sales'&&M.editLead(u,l)&&l.stage!=='Отказано'){
        body+=section('Передать квалифицированный лид')+H('form',{'data-form':'handoff-lead','data-id':l.id},
          field('Результат квалификации',area('qualification','',{required:true}),true)+
          field('Координатор',select('coordinatorId',db.users.filter(x=>x.role==='coordinator').map(x=>({value:x.id,label:x.name})),l.coordinatorId,{required:true}),true)+formEnd('Квалифицирован · передать координатору'));
      }
      if(l.qualification)body+=section('Квалификация')+kv(emp(l.qualification.by),e(l.qualification.note));
      if(!l.caseId&&l.coordinatorId){
        body+=section('Согласование стоимости')+div('notice warm',e(workflowLabel(l))+'. Открытие дела доступно координатору только после одобрения текущей суммы CEO.');
        if(u.role==='coordinator'&&l.coordinatorId===u.id){
          if(l.pricing.status==='approved')body+=btn('Открыть дело и назначить юриста '+icon('arrow'),'accept',{'data-id':l.id,class:'btn primary'});
          body+=H('form',{'data-form':'propose-price','data-id':l.id},input('revision',l.pricing.revision,{type:'hidden'})+
            field('Стоимость услуги, ₸',input('amount',l.amount||'',{type:'number',min:1,step:1,required:true}),true)+
            field('Обоснование стоимости',area('note','',{required:true}),true)+div('caption','Каждая отправка создаёт новую версию и требует нового решения CEO.')+formEnd('Отправить сумму на согласование CEO'));
        }
        if(u.role==='ceo')body+=ceoPriceDecision(l);
      }
      if(l.pricing.history.length)body+=section('Версии стоимости')+l.pricing.history.slice().reverse().map(p=>div('notice',H('b',{},'Версия '+p.revision+' · '+money(p.amount))+'<br>'+e(p.note)+'<br>'+e(emp(p.submittedBy))+' · '+fmt(p.submittedAt)+'<br>'+e(p.decision==='approve'?'Утверждено CEO':p.decision==='return'?'Возвращено CEO':p.revision<l.pricing.revision?'Заменено новой версией':'Ожидает решения')+(p.decidedBy?' · '+e(emp(p.decidedBy))+' · '+fmt(p.decidedAt):'')+(p.feedback?'<br>'+e(p.feedback):''))).join('');
      body+=section('История лида')+activityRows(db.activity.filter(a=>a.type==='lead'&&a.entityId===l.id));
    }else if(type==='case'){
      const c=db.cases.find(x=>x.id===id);if(!c||!M.canCase(db,u,c))throw new Error('Нет доступа к делу');
      head=detailHeader(c.code+' · Дело',c.title,client(c)?.name+' · '+c.service);
      const canManage=M.manageCase(db,u,c);
      const tabs=[['overview','Обзор'],['tasks','Задачи'],['documents','Документы'],['comments','Обсуждение']];
      if(canManage)tabs.push(['payments','Оплаты']);
      tabs.push(['history','История']);
      body=div('drawer-tabs',tabs.map(([key,label])=>btn(e(label),'detail-tab',{'data-tab':key,class:ui.detailTab===key?'active':''})).join(''));
      if(ui.detailTab==='overview'){
        body+=div('summary-row',badge(c.stage,c.stage==='Завершено'?'s4':'s3'))+div('detail-grid',kv('Координатор',e(emp(c.coordinatorId)))+kv('Юрист',e(emp(c.lawyerId)))+kv('Клиент',link(e(client(c)?.name),'client',{'data-id':c.clientId}))+kv('Телефон',e(client(c)?.phone)))+kv('Суть дела',e(c.note))+(canManage?div('notice',c.approvedFee?'Стоимость, утверждённая CEO: '+money(c.approvedFee.amount)+' · версия '+c.approvedFee.revision+' · '+e(emp(c.approvedFee.decidedBy)):'Дело создано ранее. Решение CEO о стоимости в прототипе отсутствует.'):'')+section('Этап и ответственные');
        const items=canManage?M.CASE_STAGES:M.CASE_STAGES.filter(s=>s!=='Завершено');
        if(c.stage==='Завершено'&&!canManage)body+=div('notice','Дело завершено. '+e(c.result));
        else body+=H('form',{'data-form':'edit-case','data-id':c.id},div('form-grid',
          field('Этап дела',select('stage',items,c.stage,{required:true}),true)+(canManage?field('Юрист',select('lawyerId',db.users.filter(x=>x.role==='lawyer').map(x=>({value:x.id,label:x.name})),c.lawyerId,{required:true}))+field('Плановый срок',input('due',c.due,{type:'date',required:true}))+field('Результат / комментарий к завершению',area('result',c.result),true):'')
        )+(canManage?div('caption','При смене юриста его открытые задачи и запланированные события по этому делу перейдут новому исполнителю.'): '')+formEnd('Обновить дело'));
      }else if(ui.detailTab==='tasks'){
        const tasks=db.tasks.filter(t=>t.caseId===c.id);
        body+=div('panel',taskRows(tasks))+section('План работы',canManage?btn(icon('plus')+'Добавить задачу','new-task',{'data-id':c.id,class:'btn small'}):'')+H('p',{class:'caption'},'Координатор формирует план; исполнитель отмечает выполненную работу. Изменения записываются в историю.');
      }else if(ui.detailTab==='documents'){
        body+=div('notice','Демонстрационный чек-лист. Здесь отмечается получение документов; сами файлы пока не загружаются и не хранятся.');
        body+=db.documents.filter(d=>d.caseId===c.id).map(d=>div('document-row',icon('doc')+div('',e(d.name)+div('task-meta',d.received?'Отмечен полученным':'Ожидаем документ'))+btn(d.received?'Запросить':'Получен','document',{'data-id':d.id,class:'btn small'}))).join('')||empty('Список документов пока пуст');
        if(canManage)body+=section('Чек-лист')+H('form',{'data-form':'new-document','data-id':c.id},field('Название документа',input('name','',{required:true,maxlength:160,placeholder:'Например, договор оказания услуг'}))+formEnd('Добавить в список'));
      }else if(ui.detailTab==='comments'){
        const comments=db.comments.filter(m=>m.caseId===c.id);
        body+=comments.map(m=>div('comment',H('b',{},e(emp(m.authorId)))+H('p',{},e(m.body))+H('small',{},fmt(m.at)))).join('')||empty('Начните обсуждение дела');
        body+=section('Новый комментарий')+H('form',{'data-form':'comment','data-id':c.id},field('Сообщение команде',area('body','',{required:true,placeholder:'Зафиксируйте договорённость или результат работы'}))+formEnd('Добавить комментарий'));
      }else if(ui.detailTab==='payments'&&canManage){
        const inv=db.invoices.filter(i=>i.caseId===c.id);
        body+=div('notice','Начисления и поступления по делу. Эти суммы не означают размер взыскания в пользу клиента.')+btn(icon('plus')+'Запланировать платёж','new-invoice',{'data-case-id':c.id,class:'btn small'})+section('График платежей')+invoicesTable(inv,false)+section('Поступления');
        const receipts=db.receipts.filter(r=>inv.some(i=>i.id===r.invoiceId));
        body+=receipts.map(r=>div('document-row',icon('payments')+div('',money(r.amount)+div('task-meta',fmt(r.date)+' · '+e(emp(r.authorId)))))).join('')||empty('Поступлений пока нет');
      }else if(ui.detailTab==='history')body+=activityRows(db.activity.filter(a=>a.type==='case'&&a.entityId===c.id));
    }else if(type==='client'){
      const cl=M.clientList(db,u).find(x=>x.id===id);if(!cl)throw new Error('Нет доступа к клиенту');
      const cs=u.role==='sales'?db.cases.filter(c=>c.clientId===cl.id&&db.leads.some(l=>l.id===c.leadId&&l.ownerId===u.id)):visibleCases().filter(c=>c.clientId===cl.id);
      head=detailHeader('Клиент',cl.name,cl.phone);
      body=div('notice','Один клиент может обратиться с несколькими делами. При приёме передачи совпадение проверяется по телефону.')+section('Связанные дела')+cs.map(c=>div('document-row',icon('cases')+div('',M.canCase(db,u,c)?link(e(c.code)+' · '+e(c.title),'case',{'data-id':c.id}):e(c.code)+' · Продажа передана')+(u.role!=='sales'?badge(c.stage,'s3'):''))).join('');
    }
    $('#detail').innerHTML=head+div('drawer-body',body);
  }
  function showModal(title,body){
    $('#modal').innerHTML=div('modal-head',H('h2',{id:'modal-title'},e(title))+btn(icon('close'),'close-modal',{class:'icon-btn','aria-label':'Закрыть окно'}))+div('modal-body',body);
    if(!$('#modal').open)$('#modal').showModal();
  }
  function newLead(){
    showModal('Новое обращение',H('p',{class:'caption',style:'margin:0 0 18px'},'Для проверки используйте вымышленные контакты. Новый лид попадёт в первый этап воронки.')+H('form',{'data-form':'new-lead'},div('form-grid',
      field('Имя клиента / компания',input('name','',{required:true,minlength:2,maxlength:100,autocomplete:'off'}),true)+
      field('Телефон',input('phone','',{required:true,type:'tel',maxlength:24,placeholder:'+7 000 000 00 00'}))+field('Источник',select('source',M.SOURCES,'Вручную'))+
      field('Услуга',select('service',M.SERVICES,M.SERVICES[0]),true)+
      field('Кратко о запросе',area('note','',{required:true}),true)+
      field('Менеджер',select('ownerId',db.users.filter(u=>u.role==='sales').map(u=>({value:u.id,label:u.name})),'u2'))+
      field('Следующий шаг',input('nextStep','Связаться и квалифицировать запрос',{required:true,maxlength:160}),true)+
      field('Дата контакта',input('nextDate',M.date(),{type:'date',required:true}),true)
    )+formEnd('Создать лид')));
  }
  function acceptModal(leadId){
    const l=visibleLeads().find(x=>x.id===leadId);if(!l)throw new Error('Лид не найден');
    if(actor().role!=='coordinator'||l.coordinatorId!==actorId||l.pricing.status!=='approved')throw new Error('Сначала требуется одобрение CEO. Дело открывает закреплённый координатор');
    const match=db.clients.find(c=>M.phoneKey(c.phone)===M.phoneKey(l.phone));
    showModal('Принять передачу',div('notice',H('b',{},e(l.name))+'<br>'+e(l.service)+' · '+money(l.amount)+'<br>'+(match?'Найден клиент: '+e(match.name)+'. Новое дело будет связано с ним.':'Контакт новый — при приёме будет создана карточка клиента.'))+
      H('form',{'data-form':'accept-lead','data-id':l.id},input('revision',l.pricing.revision,{type:'hidden'})+div('form-grid',
        field('Юрист',select('lawyerId',db.users.filter(u=>u.role==='lawyer').map(u=>({value:u.id,label:u.name})),'u4',{required:true}),true)+
        kv('Координатор',e(emp(l.coordinatorId)))+
        field('Плановый срок дела',input('due',M.date(14),{type:'date',required:true}),true)
      )+formEnd('Принять и создать дело')));
  }
  function taskModal(caseId){
    const c=visibleCases().find(c=>c.id===caseId);if(!c)throw new Error('Дело не найдено');
    showModal('Новая задача',H('form',{'data-form':'new-task','data-id':caseId},div('form-grid',field('Что нужно сделать',input('title','',{required:true,maxlength:160}),true)+field('Исполнитель',select('assigneeId',[c.lawyerId,c.coordinatorId].map(id=>({value:id,label:emp(id)})),c.lawyerId),true)+field('Срок',input('due',M.date(1),{type:'date',required:true}),true))+formEnd('Добавить задачу')));
  }
  function invoiceModal(caseId){
    const cs=visibleCases().filter(c=>M.manageCase(db,actor(),c));
    if(!cs.length){toast('Сначала примите дело от менеджера');return;}
    showModal('Запланировать платёж',H('form',{'data-form':'new-invoice'},div('form-grid',
      field('Дело',select('caseId',cs.map(c=>({value:c.id,label:c.code+' · '+client(c)?.name})),caseId||cs[0].id,{required:true}),true)+
      field('Назначение',input('title','',{required:true,maxlength:160,placeholder:'Например, аванс по договору'}),true)+
      field('Сумма, ₸',input('amount','',{type:'number',min:1,step:1,required:true}))+field('Срок оплаты',input('due',M.date(3),{type:'date',required:true}))
    )+formEnd('Добавить платёж')));
  }
  function receiptModal(invoiceId){
    const i=M.invoiceList(db,actor()).find(x=>x.id===invoiceId);if(!i)throw new Error('Нет доступа к оплате');
    showModal('Учесть поступление',div('notice','Остаток по начислению: '+H('b',{},money(M.balance(db,i)))+'. Можно внести часть суммы. Это запись в CRM, а не банковский перевод.')+H('form',{'data-form':'receipt','data-id':i.id},div('form-grid',field('Полученная сумма, ₸',input('amount',M.balance(db,i),{type:'number',required:true,min:1,max:M.balance(db,i),step:1}))+field('Дата поступления',input('date',M.date(),{type:'date',required:true,max:M.date()})))+formEnd('Зафиксировать поступление')));
  }
  async function api(path,body){
    const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const value=await response.json();
    if(!response.ok){const err=new Error(value.error||'Не удалось выполнить запрос');err.status=response.status;throw err;}return value;
  }
  function applySnapshot(value){db=value.db;actorId=value.actorId;revision=value.revision;}
  async function refresh(){
    try{applySnapshot(await api('state'));loginError='';render();if(ui.detail)renderDetail();}
    catch(err){if(err.status===401){actorId='';closeDetails();$('#modal').close();loginError='';render();}else if(!actorId){loginError=err.message;render();}else toast(err.message);}
  }
  async function serverAction(action,id,data={}){
    if(busy)throw new Error('Дождитесь завершения предыдущего действия');
    busy=true;
    try{
      const value=await api('command',{action,id,data,revision,requestId:crypto.randomUUID()});
      applySnapshot(value);return value.result;
    }catch(err){
      if(err.status===401){actorId='';closeDetails();$('#modal').close();render();}
      // Preserve the form on conflict so the user can copy changes before refreshing.
      throw err;
    }finally{busy=false;}
  }
  async function submitServer(form,data,id){
    if(busy)return;
    const buttons=[...form.querySelectorAll('button[type="submit"]')];buttons.forEach(b=>b.disabled=true);
    try{
      if(form.dataset.form==='server-login'){
        busy=true;await api('login',data);busy=false;await refresh();return;
      }
      const result=await serverAction(form.dataset.form,id,data);
      $('#modal').close();
      if(form.dataset.form==='new-lead'){navigate('crm');ui.detail={type:'lead',id:result.id};}
      if(form.dataset.form==='accept-lead'){navigate('cases');ui.detail={type:'case',id:result.id};ui.detailTab='overview';}
      if(form.dataset.form==='calendar-event')cal.date=cal.selected=data.date;
      commit(form.dataset.form==='decide-price'?(data.decision==='approve'?'Сумма утверждена':'Стоимость возвращена с комментарием'):'Сохранено на сервере');
      if(ui.detail&&!$('#detail').open)$('#detail').showModal();
    }catch(err){const box=form.querySelector('.form-error');if(box){box.textContent=err.message;if(err.status===409)box.insertAdjacentHTML('beforeend',btn('Обновить данные','refresh',{class:'btn small'}));}else toast(err.message);}
    finally{busy=false;buttons.forEach(b=>b.disabled=false);}
  }
  function commit(message){
    const saved=persist();render();
    if(ui.detail)renderDetail();
    toast(saved?message:message+' · Только до перезагрузки: сохранение недоступно.');
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-action]');if(!b||b.disabled)return;
    const a=b.dataset.action,id=b.dataset.id;
    try {
      if(SERVER){
        if(a==='refresh'){if(!busy)await refresh();return;}
        if(a==='logout'){if(busy)return;await api('logout',{});actorId='';closeDetails();$('#modal').close();render();return;}
        if(a==='login')return;
        if(['toggle-task','calendar-task','document','event-status'].includes(a)){
          if(busy)return;
          await serverAction(a,id,{status:b.dataset.status});commit('Сохранено на сервере');
          if(a==='calendar-task'||a==='event-status')calendarDetail(id,a==='calendar-task'?'task':'event');return;
        }
      }
      if(a==='login'){changeActor(id);return;}
      if(a==='logout'){changeActor('');return;}
      if(a==='close-detail'){closeDetails();return;}
      if(a==='close-modal'){$('#modal').close();return;}
      if(!actorId)return;
      if(a==='cal-view'){cal.view=b.dataset.view;cal.date=cal.selected;render();return;}
      if(a==='cal-shift'){cal.date=M.calendar.move(cal.date,cal.view,Number(b.dataset.direction));cal.selected=cal.date;render();return;}
      if(a==='cal-today'){cal.date=cal.selected=M.calendar.today();render();return;}
      if(a==='cal-day'){cal.selected=b.dataset.date;cal.date=cal.selected;if(b.dataset.open==='day')cal.view='day';render();return;}
      if(a==='cal-scope'){cal.scope=b.dataset.scope;render();return;}
      if(a==='cal-clear'){Object.assign(cal,{kind:'',owner:'',scope:'all',showDone:false});ui.search='';render();return;}
      if(a==='new-event'){eventModal(null);return;}
      if(a==='edit-event'){eventModal(id);return;}
      if(a==='cal-event'){calendarDetail(id,b.dataset.origin);return;}
      if(a==='event-status'){M.calendar.setStatus(db,actor(),id,b.dataset.status);commit('Статус события обновлён');calendarDetail(id,'event');return;}
      if(a==='calendar-task'){M.toggleTask(db,actor(),id);commit('Статус задачи обновлён');calendarDetail(id,'task');return;}
      if(a==='nav'){navigate(b.dataset.page);return;}
      if(a==='handoff'){navigate('crm','handoff');return;}
      if(a==='filter-stage'){navigate('crm');ui.stage=b.dataset.stage;render();return;}
      if(a==='crm-tab'){ui.tab=b.dataset.tab;ui.search='';render();return;}
      if(a==='view'){ui.view=b.dataset.view;render();return;}
      if(['lead','case','client'].includes(a)){openDetail(a,id);return;}
      if(a==='detail-tab'){ui.detailTab=b.dataset.tab;renderDetail();return;}
      if(a==='new-lead'){newLead();return;}
      if(a==='accept'){acceptModal(id);return;}
      if(a==='new-task'){taskModal(id);return;}
      if(a==='new-invoice'){invoiceModal(b.dataset.caseId);return;}
      if(a==='receipt'){receiptModal(id);return;}
      if(a==='toggle-task'){M.toggleTask(db,actor(),id);commit('Статус задачи обновлён');return;}
      if(a==='document'){M.toggleDocument(db,actor(),id);commit('Чек-лист обновлён');return;}
      if(a==='notifications'){
        const tasks=taskList().filter(t=>!t.done&&t.due<=M.date());
        const pending=visibleLeads().filter(awaiting);
        showModal('Требует внимания',tasks.length?taskRows(tasks):div('notice','Просроченных задач и задач на сегодня нет.') );
        if(pending.length&&['ceo','coordinator'].includes(actor().role))$('#modal .modal-body').innerHTML+=div('notice',pending.length+' обращений в очереди передачи и согласования стоимости.');
      }
    }catch(err){toast(err.message);}
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='cal-kind'){cal.kind=el.value;render();return;}
    if(el.id==='cal-owner'){cal.owner=el.value;render();return;}
    if(el.id==='cal-completed'){cal.showDone=el.checked;render();return;}
    if(el.id==='cal-date'){if(el.value){cal.date=cal.selected=el.value;render();}return;}
    if(el.closest&&el.closest('[data-form="calendar-event"]')){updateEventForm(el);return;}
    if(el.id==='role-select'){changeActor(el.value);return;}
    const filters={'source-filter':'source','stage-filter':'stage','case-filter':'caseStage','payment-filter':'paymentStatus'};
    if(filters[el.id]){ui[filters[el.id]]=el.value;render();}
  });
  document.addEventListener('input',event=>{if(event.target.id==='record-search'){ui.search=event.target.value;render();}});
  document.addEventListener('submit',event=>{
    const form=event.target;if(!form.dataset.form)return;event.preventDefault();
    const data=Object.fromEntries(new FormData(form)),id=form.dataset.id;
    if(form.dataset.form==='decide-price')data.decision=event.submitter?.value||'';
    if(SERVER){submitServer(form,data,id);return;}
    try {
      if(!actorId)throw new Error('Сначала выберите сотрудника');
      const u=actor();let result,message='Изменения сохранены';
      switch(form.dataset.form){
        case 'calendar-event':{
          const parts=(data.link||'').split(':');data.linkType=parts[0]||'';data.linkId=parts[1]||'';
          if(data.kind==='task'){
            if(data.linkType!=='case')throw new Error('Для задачи выберите дело');
            M.addTask(db,u,data.linkId,{title:data.title,assigneeId:data.ownerId,due:data.date});
            message='Задача добавлена в дело и календарь';
          }else{
            const ev=M.calendar.save(db,u,data,id);
            const overlaps=M.calendar.conflicts(db,u,data,ev.id).length;
            message='Событие сохранено'+(overlaps?' · Есть пересечение по времени':'');
          }
          cal.date=cal.selected=data.date;break;
        }
        case 'new-lead':result=M.createLead(db,u,data);message='Лид создан';break;
        case 'handoff-lead':M.handoffLead(db,u,id,data);message='Лид передан координатору';break;
        case 'propose-price':M.proposePrice(db,u,id,data);message='Стоимость отправлена CEO';break;
        case 'decide-price':M.decidePrice(db,u,id,data);message=data.decision==='approve'?'Сумма утверждена. Координатор может открыть дело':'Стоимость отклонена и возвращена с комментарием';break;
        case 'edit-lead':M.updateLead(db,u,id,data);break;
        case 'accept-lead':result=M.acceptLead(db,u,id,data);message='Передача принята. Дело '+result.code+' создано';break;
        case 'edit-case':M.updateCase(db,u,id,data);break;
        case 'new-task':M.addTask(db,u,id,data);message='Задача добавлена';break;
        case 'new-invoice':M.addInvoice(db,u,data);message='Платёж запланирован';break;
        case 'receipt':M.receive(db,u,id,data);message='Поступление учтено';break;
        case 'comment':M.addComment(db,u,id,data.body);message='Комментарий добавлен';break;
        case 'new-document':M.addDocument(db,u,id,data.name);message='Документ добавлен в чек-лист';break;
        default:throw new Error('Неизвестное действие');
      }
      $('#modal').close();
      if(form.dataset.form==='new-lead'){navigate('crm');ui.detail={type:'lead',id:result.id};}
      if(form.dataset.form==='accept-lead'){navigate('cases');ui.detail={type:'case',id:result.id};ui.detailTab='overview';}
      commit(message);
      if(result&&ui.detail&&!$('#detail').open)$('#detail').showModal();
    }catch(err){const box=form.querySelector('.form-error');if(box){box.textContent=err.message;box.setAttribute('role','alert');}else toast(err.message);}
  });
  $('#detail').addEventListener('cancel',()=>{ui.detail=null;});
  for(const id of ['detail','modal'])$('#'+id).addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){event.currentTarget.close();if(id==='detail')ui.detail=null;}});
  if(SERVER)refresh();else render();
})();
