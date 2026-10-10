/* Domain rules for the local prototype. Production must enforce them on the server. */
(function (root) {
  'use strict';
  const STAGES = ['Новые лиды', 'Встреча', 'КП', 'В работе', 'Успешно', 'Отказано'];
  const CASE_STAGES = ['Принято', 'Сбор документов', 'Анализ', 'Подготовка документов', 'Досудебная работа', 'Суд', 'Ожидаем результат', 'Завершено', 'Приостановлено'];
  const ROLES = { ceo: 'CEO', sales: 'Менеджер по продажам', coordinator: 'Координатор', lawyer: 'Юрист' };
  const SERVICES = ['ДТП и страховые споры', 'Взыскание задолженности', 'Судебное представительство', 'Документы и договоры', 'Юридическая консультация', 'Семейное право', 'Споры и конфликты'];
  const SOURCES = ['Сайт', 'WhatsApp', 'Телефон', 'Рекомендация', 'Вручную'];
  const REASONS = ['Не устроила стоимость', 'Не наш профиль', 'Выбрали другую компанию', 'Не удалось связаться', 'Клиент отложил решение', 'Дубль обращения', 'Другое'];
  const date = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
  const id = prefix => prefix + '-' + (root.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2,8));
  const need = (condition, message) => { if (!condition) throw new Error(message); };
  const phoneKey = value => { let p = String(value || '').replace(/\D/g, ''); return p.length === 11 && p[0] === '8' ? '7' + p.slice(1) : p; };
  const text = value => String(value || '').trim();
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0,10) === value;
  function seed() {
    const users = [
      {id:'u1',name:'Арман Алиев',role:'ceo',specialty:'Управление компанией'},
      {id:'u2',name:'Алия Бекова',role:'sales',specialty:'Продажи и консультации'},
      {id:'u3',name:'Мадина Кенже',role:'coordinator',specialty:'Контроль делопроизводства'},
      {id:'u4',name:'Данияр Сейтов',role:'lawyer',specialty:'ДТП и взыскание долгов'},
      {id:'u5',name:'Айдана Мусина',role:'lawyer',specialty:'Семейные и гражданские споры'}
    ];
    const samples = [
      ['Алексей Соколов','ДТП и страховые споры','WhatsApp',0,450000,'Страховая выплата не покрывает стоимость ремонта.','Связаться и уточнить обстоятельства',0],
      ['ТОО «Демо Вектор»','Документы и договоры','Сайт',0,320000,'Проверка договора поставки перед подписанием.','Назначить первичную консультацию',1],
      ['Динара Омарова','Семейное право','Рекомендация',1,600000,'Консультация по разделу совместного имущества.','Встреча в офисе в 15:00',0],
      ['Самат Есенов','Взыскание задолженности','Телефон',1,400000,'Возврат долга по расписке.','Онлайн-консультация в 11:00',1],
      ['ТОО «Демо Арна»','Взыскание задолженности','Сайт',2,850000,'Задолженность контрагента по договору.','Обсудить коммерческое предложение',0],
      ['Жанна Тимурова','Споры и конфликты','WhatsApp',2,280000,'Спор с подрядчиком по ремонту квартиры.','Получить ответ по предложению',2],
      ['Марат Садыков','Судебное представительство','Рекомендация',3,700000,'Представительство в гражданском споре.','Согласовать условия договора',0],
      ['Алия Нурова','ДТП и страховые споры','WhatsApp',4,500000,'Подготовить претензию к страховой компании.','Передать материалы координатору',0],
      ['ИП «Демо Орда»','Взыскание задолженности','Сайт',4,950000,'Взыскание задолженности по оказанным услугам.','Дело передано',0],
      ['Мадина Асанова','Семейное право','Телефон',4,300000,'Подготовка документов по семейному спору.','Дело передано',0],
      ['ТОО «Демо Берекет»','Документы и договоры','Рекомендация',4,420000,'Правовая экспертиза пакета договоров.','Дело передано',0],
      ['Ерлан Ким','Юридическая консультация','Сайт',5,60000,'Первичная консультация по правовому вопросу.','',0]
    ];
    const leads = samples.map((s,i)=>({
      id:'l'+(i+1),code:'L-'+String(101+i),name:s[0],service:s[1],source:s[2],stage:STAGES[s[3]],amount:s[4],
      note:s[5],nextStep:s[6],nextDate:date(s[7]),phone:'+7 000 000 '+String(i+1).padStart(4,'0'),ownerId:'u2',
      createdAt:date(-(12-i)),reason:i===11?'Клиент отложил решение':'',caseId:i>=8&&i<=10?'c'+(i-7):null
    }));
    const clients = [8,9,10].map((n,i)=>({id:'cl'+(i+1),name:leads[n].name,phone:leads[n].phone}));
    const cases = [
      {id:'c1',code:'D-024',clientId:'cl1',leadId:'l9',title:'Взыскание долга по договору услуг',service:SERVICES[1],note:leads[8].note,coordinatorId:'u3',lawyerId:'u4',stage:'Досудебная работа',due:date(4),createdAt:date(-8),result:''},
      {id:'c2',code:'D-025',clientId:'cl2',leadId:'l10',title:'Подготовка документов по семейному спору',service:SERVICES[5],note:leads[9].note,coordinatorId:'u3',lawyerId:'u5',stage:'Сбор документов',due:date(8),createdAt:date(-6),result:''},
      {id:'c3',code:'D-026',clientId:'cl3',leadId:'l11',title:'Экспертиза договоров поставки',service:SERVICES[3],note:leads[10].note,coordinatorId:'u3',lawyerId:'u4',stage:'Подготовка документов',due:date(2),createdAt:date(-4),result:''}
    ];
    return initWorkflow({version:2,users,leads,clients,cases,tasks:[
      {id:'t1',caseId:'c1',title:'Подготовить досудебную претензию',assigneeId:'u4',due:date(),done:false},
      {id:'t2',caseId:'c1',title:'Запросить акт сверки у клиента',assigneeId:'u3',due:date(-1),done:false},
      {id:'t3',caseId:'c2',title:'Изучить документы клиента',assigneeId:'u5',due:date(1),done:false},
      {id:'t4',caseId:'c3',title:'Согласовать правки к договору',assigneeId:'u4',due:date(2),done:false},
      {id:'t5',caseId:'c1',title:'Провести первичный анализ',assigneeId:'u4',due:date(-2),done:true}
    ],invoices:[
      {id:'i1',caseId:'c1',title:'Первый этап — анализ и претензия',amount:300000,due:date(-2)},
      {id:'i2',caseId:'c2',title:'Аванс по договору',amount:150000,due:date(2)},
      {id:'i3',caseId:'c3',title:'Экспертиза пакета документов',amount:420000,due:date(5)}
    ],receipts:[
      {id:'r1',invoiceId:'i1',amount:200000,date:date(-1),authorId:'u3'},
      {id:'r2',invoiceId:'i2',amount:150000,date:date(-2),authorId:'u3'}
    ],documents:[
      {id:'d1',caseId:'c1',name:'Договор оказания услуг',received:true},
      {id:'d2',caseId:'c1',name:'Акт сверки взаиморасчётов',received:false},
      {id:'d3',caseId:'c2',name:'Документы по семейному спору',received:false},
      {id:'d4',caseId:'c3',name:'Пакет договоров поставки',received:true}
    ],comments:[],activity:[
      {id:'a1',type:'lead',entityId:'l8',actorId:'u2',message:'Лид квалифицирован. Требуется назначить стоимость и согласовать её с CEO.',at:new Date().toISOString()},
      {id:'a2',type:'case',entityId:'c1',actorId:'u3',message:'Учтено поступление: 200 000 ₸.',at:new Date(Date.now()-3600000).toISOString()}
    ]});
  }
  function user(db, userId) { const u=db.users.find(u=>u.id===userId); need(u,'Сотрудник не найден'); return u; }
  function canLead(db,u,l) { return u.role==='ceo'||u.role==='sales'&&l.ownerId===u.id||u.role==='coordinator'&&l.coordinatorId===u.id; }
  function canCase(db,u,c) { return u.role==='ceo'||u.role==='coordinator'&&c.coordinatorId===u.id||u.role==='lawyer'&&c.lawyerId===u.id; }
  function editLead(u,l) { return !l.caseId&&l.pricing?.status==='sales'&&(u.role==='ceo'||u.role==='sales'&&l.ownerId===u.id); }
  function manageCase(db,u,c) { return u.role==='ceo'||u.role==='coordinator'&&c.coordinatorId===u.id; }
  function leadList(db,u) { return db.leads.filter(l=>canLead(db,u,l)); }
  function caseList(db,u) { return db.cases.filter(c=>canCase(db,u,c)); }
  function invoiceList(db,u) { return ['ceo','coordinator'].includes(u.role)?db.invoices.filter(i=>caseList(db,u).some(c=>c.id===i.caseId)):[]; }
  function clientList(db,u) {
    if(u.role==='ceo')return db.clients;
    const ids=u.role==='sales'?db.cases.filter(c=>db.leads.some(l=>l.id===c.leadId&&l.ownerId===u.id)).map(c=>c.clientId):caseList(db,u).map(c=>c.clientId);
    return db.clients.filter(c=>ids.includes(c.id));
  }
  function paid(db,i) { return db.receipts.filter(r=>r.invoiceId===i.id).reduce((sum,r)=>sum+r.amount,0); }
  function balance(db,i) { return i.amount-paid(db,i); }
  function invoiceStatus(db,i) { return balance(db,i)===0?'Оплачено':i.due<date()?'Просрочено':paid(db,i)>0?'Частично':'Ожидается'; }
  function log(db,u,type,entityId,message) { db.activity.unshift({id:id('a'),type,entityId,actorId:u.id,message,at:new Date().toISOString()}); }
  function validateLead(input) {
    need(text(input.name).length>=2,'Укажите имя клиента');
    need(phoneKey(input.phone).length===11,'Телефон должен содержать 11 цифр');
    need(SERVICES.includes(input.service)&&SOURCES.includes(input.source),'Выберите услугу и источник');
    need(text(input.note),'Опишите запрос');
    need(input.amount==null||Number(input.amount)===0,'Стоимость устанавливает координатор после квалификации');
    need(text(input.nextStep)&&validDate(input.nextDate),'Укажите следующий шаг и дату');
  }
  function createLead(db,u,input) {
    need(['ceo','sales'].includes(u.role),'Создание лидов недоступно этой роли'); validateLead(input);
    const ownerId=u.role==='sales'?u.id:input.ownerId;
    need(db.users.some(x=>x.id===ownerId&&x.role==='sales'),'Выберите менеджера');
    const l={id:id('l'),code:'L-'+(Math.max(100,...db.leads.map(x=>Number(x.code.split('-')[1])))+1),name:text(input.name),phone:text(input.phone),service:input.service,source:input.source,note:text(input.note),amount:0,coordinatorId:null,pricing:{status:'sales',revision:0,history:[]},nextStep:text(input.nextStep),nextDate:input.nextDate,ownerId,stage:STAGES[0],createdAt:date(),caseId:null,reason:''};
    db.leads.unshift(l);log(db,u,'lead',l.id,'Создан лид из источника «'+l.source+'».');return l;
  }
  function updateLead(db,u,leadId,input) {
    const l=db.leads.find(x=>x.id===leadId);need(l&&editLead(u,l),'Нет доступа к изменению лида');need(!l.caseId,'Дело уже создано. Продажа зафиксирована.');
    need(STAGES.includes(input.stage)&&input.stage!=='Успешно','Успешная продажа фиксируется при открытии дела после одобрения CEO');
    need(input.amount==null||Number(input.amount)===l.amount,'Стоимость устанавливает только координатор');
    if(input.stage==='Отказано')need(REASONS.includes(input.reason),'Укажите причину отказа');
    if(!['Успешно','Отказано'].includes(input.stage))need(text(input.nextStep)&&validDate(input.nextDate),'Укажите следующий шаг и дату');
    const before=l.stage;
    Object.assign(l,{stage:input.stage,nextStep:text(input.nextStep),nextDate:input.nextDate,reason:input.stage==='Отказано'?input.reason:''});
    log(db,u,'lead',l.id,before!==l.stage?'Этап: '+before+' → '+l.stage+(l.reason?'. Причина: '+l.reason:'.'):'Обновлены договорённости и следующий шаг.');
  }
  // Preserve legacy records without inventing retrospective approvals.
  function initWorkflow(db) {
    for(const l of db.leads){
      if(l.pricing)continue;
      const c=db.cases.find(c=>c.id===l.caseId);
      l.coordinatorId=c?.coordinatorId||(l.stage==='Успешно'?db.users.find(u=>u.role==='coordinator')?.id:null)||null;
      l.pricing={status:c?'legacy':l.coordinatorId?'pricing':'sales',revision:0,history:[],migrated:true};
      if(!c){l.legacyEstimate=l.amount;l.amount=0;if(l.coordinatorId){l.stage='В работе';l.nextStep='Координатор определяет стоимость';}}
    }
    return db;
  }
  function handoffLead(db,u,leadId,input) {
    const l=db.leads.find(x=>x.id===leadId);
    need(l&&u.role==='sales'&&l.ownerId===u.id&&editLead(u,l)&&l.stage!=='Отказано','Передать может менеджер своего активного лида');
    need(text(input.qualification),'Опишите результат квалификации');
    need(db.users.some(x=>x.id===input.coordinatorId&&x.role==='coordinator'),'Выберите координатора');
    l.coordinatorId=input.coordinatorId;l.qualification={note:text(input.qualification),by:u.id,at:new Date().toISOString()};
    l.stage='В работе';l.pricing.status='pricing';l.nextStep='Координатор определяет стоимость';
    log(db,u,'lead',l.id,'Лид квалифицирован и передан координатору '+user(db,l.coordinatorId).name+'. '+l.qualification.note);
  }
  function proposePrice(db,u,leadId,input) {
    const l=db.leads.find(x=>x.id===leadId);
    need(l&&!l.caseId&&u.role==='coordinator'&&l.coordinatorId===u.id&&['pricing','pending','approved','returned'].includes(l.pricing.status),'Стоимость назначает закреплённый координатор до открытия дела');
    const amount=Number(input.amount);
    need(Number.isSafeInteger(amount)&&amount>0,'Укажите положительную сумму в целых тенге');
    need(text(input.note),'Добавьте обоснование стоимости');
    need(Number(input.revision)===l.pricing.revision,'Стоимость уже изменена. Откройте карточку заново');
    const record={revision:l.pricing.revision+1,amount,note:text(input.note),submittedBy:u.id,submittedAt:new Date().toISOString()};
    l.amount=amount;
    l.pricing={status:'pending',revision:record.revision,history:[...l.pricing.history,record]};
    l.nextStep='CEO согласовывает стоимость';
    log(db,u,'lead',l.id,'На согласование CEO: '+amount.toLocaleString('ru-RU')+' ₸ (версия '+record.revision+'). '+record.note);
  }
  function decidePrice(db,u,leadId,input) {
    const l=db.leads.find(x=>x.id===leadId);
    need(u.role==='ceo','Сумму утверждает только CEO');
    need(l&&!l.caseId&&l.pricing.status==='pending','Нет стоимости, ожидающей согласования');
    need(Number(input.revision)===l.pricing.revision,'Версия стоимости изменилась. Откройте карточку заново');
    need(['approve','return'].includes(input.decision),'Выберите решение');
    need(input.decision!=='return'||text(input.note),'Укажите причину возврата');
    const record=l.pricing.history.at(-1);
    need(record&&record.amount===l.amount&&record.revision===l.pricing.revision,'Сумма не соответствует предложению координатора');
    Object.assign(record,{decision:input.decision,decidedBy:u.id,decidedAt:new Date().toISOString(),feedback:text(input.note)});
    l.pricing.status=input.decision==='approve'?'approved':'returned';
    l.nextStep=input.decision==='approve'?'Координатор открывает дело':'Координатор пересматривает стоимость';
    log(db,u,'lead',l.id,(input.decision==='approve'?'Утверждена стоимость: ':'Стоимость возвращена: ')+l.amount.toLocaleString('ru-RU')+' ₸ (версия '+record.revision+'). '+record.feedback);
  }
  function acceptLead(db,u,leadId,input) {
    need(u.role==='coordinator','Дело открывает координатор после одобрения CEO');
    const l=db.leads.find(x=>x.id===leadId);need(l&&l.coordinatorId===u.id,'Нет доступа к передаче');
    if(l.caseId){const existing=db.cases.find(c=>c.id===l.caseId);need(existing&&canCase(db,u,existing),'Дело уже принято другим координатором');return existing;}
    const approval=l.pricing.history.at(-1);
    need(l.pricing.status==='approved'&&approval?.decision==='approve'&&approval.revision===l.pricing.revision&&approval.amount===l.amount,'Сначала требуется одобрение CEO текущей суммы');
    need(Number(input.revision)===l.pricing.revision,'Версия стоимости изменилась. Откройте карточку заново');
    need(validDate(input.due),'Укажите срок дела');
    need(db.users.some(x=>x.id===input.lawyerId&&x.role==='lawyer'),'Выберите юриста');
    const coordinatorId=u.id;
    need(db.users.some(x=>x.id===coordinatorId&&x.role==='coordinator'),'Выберите координатора');
    let cl=db.clients.find(x=>phoneKey(x.phone)===phoneKey(l.phone));
    if(!cl){cl={id:id('cl'),name:l.name,phone:l.phone};db.clients.push(cl);}
    const c={id:id('c'),code:'D-'+String(Math.max(26,...db.cases.map(x=>Number(x.code.split('-')[1])))+1).padStart(3,'0'),clientId:cl.id,leadId:l.id,approvedFee:{...approval},title:l.service+' — '+l.name,service:l.service,note:l.note,coordinatorId,lawyerId:input.lawyerId,stage:'Принято',due:input.due,createdAt:date(),result:''};
    db.cases.unshift(c);l.caseId=c.id;l.stage='Успешно';l.pricing.status='opened';l.nextStep='Дело открыто';
    log(db,u,'lead',l.id,'Передача принята. Создано дело '+c.code+'.');
    log(db,u,'case',c.id,'Создано дело. Назначен юрист: '+user(db,c.lawyerId).name+'.');return c;
  }
  function updateCase(db,u,caseId,input) {
    const c=db.cases.find(x=>x.id===caseId);need(c&&canCase(db,u,c),'Нет доступа к делу');need(CASE_STAGES.includes(input.stage),'Неизвестный этап дела');
    if(input.stage==='Завершено') {need(manageCase(db,u,c),'Закрытие доступно координатору');need(text(input.result),'Опишите результат дела');}
    if(manageCase(db,u,c)) {
      need(validDate(input.due),'Укажите срок');
      need(db.users.some(x=>x.id===input.lawyerId&&x.role==='lawyer'),'Выберите юриста');
      const before=c.lawyerId;
      if(before!==input.lawyerId)db.tasks.filter(t=>t.caseId===c.id&&t.assigneeId===before&&!t.done).forEach(t=>{t.assigneeId=input.lawyerId;});
      if(before!==input.lawyerId)(db.events||[]).filter(ev=>ev.linkType==='case'&&ev.linkId===c.id&&ev.ownerId===before&&ev.status==='planned').forEach(ev=>{ev.ownerId=input.lawyerId;});
      c.lawyerId=input.lawyerId;c.due=input.due;c.result=text(input.result);
    } else need(c.stage!=='Завершено','Завершённое дело изменяет координатор');
    const prev=c.stage;c.stage=input.stage;
    log(db,u,'case',c.id,'Обновлено дело: '+prev+' → '+c.stage+'. Юрист: '+user(db,c.lawyerId).name+'. Срок: '+c.due+'.'+(c.result?' Результат: '+c.result:''));
  }
  function addTask(db,u,caseId,input) {
    const c=db.cases.find(x=>x.id===caseId);need(c&&manageCase(db,u,c),'Создание задач доступно координатору');need(text(input.title)&&validDate(input.due),'Заполните задачу и срок');
    need([c.lawyerId,c.coordinatorId].includes(input.assigneeId),'Выберите участника дела');
    db.tasks.push({id:id('t'),caseId,title:text(input.title),due:input.due,assigneeId:input.assigneeId,done:false});log(db,u,'case',caseId,'Добавлена задача: '+text(input.title)+'.');
  }
  function toggleTask(db,u,taskId) {
    const t=db.tasks.find(x=>x.id===taskId),c=t&&db.cases.find(x=>x.id===t.caseId);need(c&&canCase(db,u,c)&&(manageCase(db,u,c)||t.assigneeId===u.id),'Нет доступа к задаче');
    t.done=!t.done;log(db,u,'case',c.id,(t.done?'Выполнена':'Возобновлена')+' задача: '+t.title+'.');
  }
  function addInvoice(db,u,input) {
    const c=db.cases.find(x=>x.id===input.caseId);need(c&&manageCase(db,u,c),'Нет доступа к оплатам этого дела');
    need(text(input.title)&&validDate(input.due),'Укажите назначение и срок');
    const amount=Number(input.amount);need(Number.isSafeInteger(amount)&&amount>0,'Сумма должна быть положительной, в целых тенге');
    db.invoices.unshift({id:id('i'),caseId:c.id,title:text(input.title),amount,due:input.due});log(db,u,'case',c.id,'Запланирован платёж: '+amount.toLocaleString('ru-RU')+' ₸.');
  }
  function receive(db,u,invoiceId,input) {
    const i=db.invoices.find(x=>x.id===invoiceId),c=i&&db.cases.find(x=>x.id===i.caseId);
    need(c&&manageCase(db,u,c),'Нет доступа к регистрации оплаты');const amount=Number(input.amount);
    need(Number.isSafeInteger(amount)&&amount>0&&amount<=balance(db,i),'Сумма должна быть больше нуля и не превышать остаток');need(validDate(input.date)&&input.date<=date(),'Укажите дату поступления не позднее сегодня');
    db.receipts.push({id:id('r'),invoiceId,amount,date:input.date,authorId:u.id});log(db,u,'case',c.id,'Учтено поступление: '+amount.toLocaleString('ru-RU')+' ₸.');
  }
  function addComment(db,u,caseId,body) {const c=db.cases.find(x=>x.id===caseId);need(c&&canCase(db,u,c),'Нет доступа к делу');need(text(body),'Введите комментарий');db.comments.push({id:id('m'),caseId,body:text(body),authorId:u.id,at:new Date().toISOString()});log(db,u,'case',caseId,'Добавлен комментарий.');}
  function toggleDocument(db,u,documentId) {const d=db.documents.find(x=>x.id===documentId),c=d&&db.cases.find(x=>x.id===d.caseId);need(c&&canCase(db,u,c),'Нет доступа к документу');d.received=!d.received;log(db,u,'case',c.id,(d.received?'Отмечен полученным':'Запрошен документ')+': '+d.name+'.');}
  function addDocument(db,u,caseId,name) {
    const c=db.cases.find(x=>x.id===caseId);need(c&&manageCase(db,u,c),'Нет доступа к чек-листу');need(text(name),'Укажите название');
    db.documents.push({id:id('d'),caseId,name:text(name),received:false});log(db,u,'case',caseId,'Запрошен документ: '+text(name)+'.');
  }
  const api={STAGES,CASE_STAGES,ROLES,SERVICES,SOURCES,REASONS,date,seed,initWorkflow,handoffLead,proposePrice,decidePrice,user,phoneKey,canLead,canCase,editLead,manageCase,leadList,caseList,clientList,invoiceList,paid,balance,invoiceStatus,createLead,updateLead,acceptLead,updateCase,addTask,toggleTask,addInvoice,receive,addComment,toggleDocument,addDocument};
  root.BDA=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
