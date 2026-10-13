'use client';
import {useEffect} from 'react';
export default function Home(){
  useEffect(()=>{
    const w=window as typeof window & {BDA_SERVER?:boolean; BDA_LOADING?:boolean};
    if(w.BDA_LOADING)return;
    w.BDA_LOADING=true;w.BDA_SERVER=true;
    (async()=>{
      for(const name of ['model.js','calendar-model.js','app.js']){
        await new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src='/assets/'+name;s.onload=()=>resolve();s.onerror=reject;document.body.appendChild(s);});
      }
    })().catch(()=>{const el=document.getElementById('app');if(el)el.textContent='Не удалось загрузить приложение. Обновите страницу.';});
  },[]);
  return <><link rel="stylesheet" href="/assets/styles.css"/><div id="app">Загрузка CRM…</div><dialog id="detail" className="drawer" aria-labelledby="detail-title"/><dialog id="modal" className="modal" aria-labelledby="modal-title"/><div id="toast" className="toast" role="status" aria-live="polite"/></>;
}
