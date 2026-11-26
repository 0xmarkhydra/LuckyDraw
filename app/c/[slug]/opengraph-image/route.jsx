import {db} from '../../../../lib/db';
import {shareImage} from '../../../../lib/share-image';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req,{params}){const {slug}=await params;if(!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug))return new Response(null,{status:404});const {data,error}=await db().from('settings').select('title').eq('slug',slug).maybeSingle();if(error)return new Response(null,{status:503});if(!data)return new Response(null,{status:404});return shareImage(data.title.slice(0,95),'VÒNG QUAY MAY MẮN')}
