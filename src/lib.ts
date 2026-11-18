import { createClient } from '@supabase/supabase-js';
import type { GridPoint } from './types';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase = url && key ? createClient(url,key) : null;
export const uid = () => crypto.randomUUID();
export const load = <T,>(key:string, fallback:T):T => { try { const v=localStorage.getItem(key); return v?JSON.parse(v) as T:fallback; } catch { return fallback; } };
export const save = (key:string,value:unknown) => localStorage.setItem(key,JSON.stringify(value));
const R=6371;
export function haversine(a:number,b:number,c:number,d:number){const rad=(x:number)=>x*Math.PI/180;const x=rad(c-a),y=rad(d-b);const h=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
export function generateGrid(lat:number,lng:number):GridPoint[]{
 const points:GridPoint[]=[{id:uid(),number:1,lat,lng,distanceKm:0}];
 // Nine evenly distributed points on three rings; deterministic bearings avoid random drift.
 const specs=[{r:6,b:0},{r:6,b:120},{r:6,b:240},{r:13,b:0},{r:13,b:60},{r:13,b:120},{r:13,b:180},{r:13,b:240},{r:13,b:300}];
 for(let i=0;i<specs.length;i++){const {r,b}=specs[i];const br=b*Math.PI/180;const dLat=(r*Math.cos(br))/111.32;const dLng=(r*Math.sin(br))/(111.32*Math.cos(lat*Math.PI/180));const pLat=lat+dLat,pLng=lng+dLng;points.push({id:uid(),number:i+2,lat:pLat,lng:pLng,distanceKm:haversine(lat,lng,pLat,pLng)});}
 return points;
}
export async function invokeRankScan(payload:Record<string,unknown>){
 if(!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then deploy the scan-rank Edge Function.');
 const {data,error}=await supabase.functions.invoke('scan-rank',{body:payload});
 if(error){
  let msg = error.message;
  if('context' in error && error.context){
   try {
    const body = await (error.context as Response).json();
    if(body?.error) msg = body.error;
   } catch {
    try {
     const txt = await (error.context as Response).text();
     if(txt) msg = txt;
    } catch {}
   }
  }
  throw new Error(msg);
 }
 return data;
}
