import {readFile} from 'node:fs/promises';
import path from 'node:path';
export const runtime='nodejs';
export async function GET(_req:Request,{params}:{params:Promise<{name:string}>}){
  const {name}=await params;
  if(!['styles.css','model.js','calendar-model.js','app.js'].includes(name))return new Response(null,{status:404});
  const body=await readFile(path.join(process.cwd(),'assets',name),'utf8');
  return new Response(body,{headers:{'Content-Type':name.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8'}});
}
