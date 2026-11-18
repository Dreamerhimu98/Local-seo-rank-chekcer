import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const distanceKm=(a:number,b:number,c:number,d:number)=>{const rad=(x:number)=>x*Math.PI/180;const x=rad(c-a),y=rad(d-b);const h=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 12742*Math.asin(Math.sqrt(h));};
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(req.method!=='POST') return json({error:'POST required'},405);
 try {
  const weeklySecret=Deno.env.get('WEEKLY_SCAN_SECRET'); const schedulerCall=Boolean(weeklySecret && req.headers.get('x-weekly-scan-secret')===weeklySecret);
  if(!schedulerCall){ const auth=req.headers.get('Authorization')||''; const token=auth.replace(/^Bearer\s+/i,''); const anon=Deno.env.get('SUPABASE_ANON_KEY'); const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(!token||!anon) return json({error:'Authentication required.'},401); if(token!==anon&&token!==serviceKey){ const authClient=createClient(Deno.env.get('SUPABASE_URL')!,anon); const {data:userData,error:userError}=await authClient.auth.getUser(token); if(userError||!userData?.user) return json({error:'A valid signed-in admin session or project API key is required.'},401); } }
  const login=Deno.env.get('DATAFORSEO_LOGIN'),password=Deno.env.get('DATAFORSEO_PASSWORD');
  if(!login||!password) return json({error:'DataForSEO credentials are not configured in Supabase Edge Function secrets.'},503);
  const body=await req.json(); const business=body.business; const keyword=String(body.keyword||'').trim(); const points=body.points;
  if(!business||!keyword||!Array.isArray(points)||points.length!==10) return json({error:'Business, keyword and exactly 10 geo-grid points are required.'},400);
  if(points.some((p:any)=>distanceKm(Number(business.latitude),Number(business.longitude),Number(p.lat),Number(p.lng))>20.05)) return json({error:'Every geo-grid point must be within 20 KM of the business centre.'},400);
  const sbUrl=Deno.env.get('SUPABASE_URL')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; const db=createClient(sbUrl,serviceKey);
  const mode=body.mode==='explorer'?'explorer':'client';
  const {data:scan,error:scanErr}=await db.from('rank_scans').insert({business_id:mode==='client'?body.businessId||null:null,keyword,scan_type:mode,business_name:String(business.name),search_location:String(body.location||business.address||''),status:'running'}).select().single();
  if(scanErr) throw scanErr;
  const basic=btoa(`${login}:${password}`); const output:any[]=[]; let failures=0;
  // Keep concurrency conservative to reduce rate-limit pressure.
  for(let i=0;i<points.length;i+=2){
   const batch=points.slice(i,i+2);
   const settled=await Promise.all(batch.map(async(p:any)=>{
    try {
     const coord=`${Number(p.lat)},${Number(p.lng)},14z`;
     const response=await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced',{method:'POST',headers:{'Authorization':`Basic ${basic}`,'Content-Type':'application/json'},body:JSON.stringify([{keyword,location_coordinate:coord,language_code:'en',depth:20}])});
     const payload=await response.json(); if(!response.ok||payload.status_code>=40000) throw new Error(payload.status_message||`DataForSEO HTTP ${response.status}`);
     const task=payload.tasks?.[0]; if(task?.status_code>=40000) throw new Error(task.status_message||'DataForSEO task failed'); const result=task?.result?.[0]; const items=result?.items||[];
     const placeId=String(business.place_id||'').trim();
     const targetName=String(business.name||'').trim().toLowerCase();
     const cleanStr=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
     const normTarget=cleanStr(targetName);
     const targetIndex=items.findIndex((it:any)=>{
      const itemPlaceId=String(it.place_id||'').trim();
      const itemCid=String(it.cid||'').trim();
      if(placeId&&(itemPlaceId===placeId||itemCid===placeId)) return true;
      if(normTarget.length>=3){
       const itemTitle=cleanStr(it.title||it.name||'');
       if(itemTitle&&(itemTitle===normTarget||itemTitle.includes(normTarget)||normTarget.includes(itemTitle))) return true;
      }
      return false;
     });
     const target=targetIndex>=0?items[targetIndex]:null;
     const rank=target?(Number(target.rank_group||target.rank_absolute||targetIndex+1)):null;
     const competitors=items.slice(0,10).map((it:any,index:number)=>({name:it.title||it.name||'Unknown business',placeId:it.place_id||it.cid||null,rank:Number(it.rank_group||it.rank_absolute||index+1),rating:it.rating?.value??it.rating??null,reviews:it.rating?.votes_count??it.reviews_count??null}));
     const {data:grid,error:gridErr}=await db.from('grid_locations').insert({scan_id:scan.id,location_number:Number(p.number),latitude:Number(p.lat),longitude:Number(p.lng),distance_km:Number(p.distanceKm||0)}).select().single(); if(gridErr)throw gridErr;
     const {error:resErr}=await db.from('ranking_results').insert({scan_id:scan.id,grid_location_id:grid.id,target_place_id:placeId||null,target_business_name:target?.title||business.name,rank_position:rank,rating:target?.rating?.value??target?.rating??null,review_count:target?.rating?.votes_count??target?.reviews_count??null,result_url:target?.url||null,competitors,raw_response:payload}); if(resErr)throw resErr;
     return {pointId:p.id,number:p.number,rank,competitors,checkedAt:new Date().toISOString()};
    } catch(error){failures++;return {pointId:p.id,number:p.number,rank:null,competitors:[],checkedAt:new Date().toISOString(),error:String(error)};}
   })); output.push(...settled);
  }
  const ranks=output.map(x=>x.rank).filter((x:number|null)=>x!==null) as number[]; const top3=ranks.filter(x=>x<=3).length,top10=ranks.filter(x=>x<=10).length;
  const status=failures===10?'failed':failures>0?'partial':'completed';
  await db.from('rank_scans').update({status,average_rank:ranks.length?ranks.reduce((a,b)=>a+b,0)/ranks.length:null,top_3_count:top3,top_10_count:top10,not_found_count:10-ranks.length,visibility_percentage:top10/10*100,completed_at:new Date().toISOString()}).eq('id',scan.id);
  if(mode==='explorer') await db.from('keyword_explorer_scans').insert({id:scan.id,search_keyword:keyword,search_location:String(body.location||''),center_latitude:Number(business.latitude),center_longitude:Number(business.longitude),radius_km:20,grid_size:10});
  const firstErr=output.find(o=>o.error)?.error;
  return json({scanId:scan.id,status,averageRank:ranks.length?ranks.reduce((a,b)=>a+b,0)/ranks.length:null,top3,top10,notFound:10-ranks.length,results:output,errorMessage:status==='failed'?(firstErr||'All 10 grid point requests failed'):undefined});
 } catch(error){return json({error:error instanceof Error?error.message:String(error)},500);}
});
