import api from '../../../server/api.cjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{path:string[]}>}){return api.handle(req,(await params).path);}
export const POST=GET;
