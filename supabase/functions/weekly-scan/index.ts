import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const secret=Deno.env.get('WEEKLY_SCAN_SECRET');const supplied=req.headers.get('x-weekly-scan-secret');
 if(!secret||supplied!==secret)return new Response(JSON.stringify({error:'Unauthorized scheduler request'}),{status:401,headers:{...cors,'Content-Type':'application/json'}});
 const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;const db=createClient(url,service);
 const {data:schedules,error}=await db.from('scan_schedules').select('*, businesses(*, keywords(*))').eq('is_active',true);
 if(error)return new Response(JSON.stringify({error:error.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}});
 const results=[];const now=new Date();
 for(const schedule of schedules||[]){
  const b=schedule.businesses;if(!b||!b.is_active)continue;
  for(const k of (b.keywords||[]).filter((x:any)=>x.is_active)){
   // Avoid duplicate weekly runs for the same business+keyword in the last 6 days.
   const since=new Date(now.getTime()-6*86400000).toISOString();const {data:recent}=await db.from('rank_scans').select('id').eq('business_id',b.id).eq('keyword',k.keyword).eq('scan_type','client').gte('created_at',since).limit(1);
   if(recent?.length)continue;
   const points=makeGrid(Number(b.latitude),Number(b.longitude));
   const response=await fetch(`${url}/functions/v1/scan-rank`,{method:'POST',headers:{'Authorization':`Bearer ${service}`,'apikey':service,'Content-Type':'application/json','x-weekly-scan-secret':secret},body:JSON.stringify({business:{name:b.business_name,address:b.address,place_id:b.place_id,latitude:b.latitude,longitude:b.longitude},businessId:b.id,keyword:k.keyword,points,mode:'client',location:b.address})});
   results.push({business:b.business_name,keyword:k.keyword,status:response.ok?'submitted':'failed'});
  }
  await db.from('scan_schedules').update({last_run_at:now.toISOString()}).eq('id',schedule.id);
 }
 return new Response(JSON.stringify({processed:results.length,results}),{headers:{...cors,'Content-Type':'application/json'}});
});
function makeGrid(lat:number,lng:number){const specs=[{r:0,b:0},{r:6,b:0},{r:6,b:120},{r:6,b:240},{r:13,b:0},{r:13,b:60},{r:13,b:120},{r:13,b:180},{r:13,b:240},{r:13,b:300}];return specs.map((s,i)=>{const br=s.b*Math.PI/180;const la=lat+s.r*Math.cos(br)/111.32,lo=lng+s.r*Math.sin(br)/(111.32*Math.cos(lat*Math.PI/180));return {id:`${i+1}`,number:i+1,lat:la,lng:lo,distanceKm:s.r};});}
