export type Client = { id:string; name:string; contact:string; phone:string; email:string; notes:string; createdAt:string };
export type Business = { id:string; clientId:string; name:string; address:string; placeId:string; category:string; lat:number; lng:number; keywords:string[]; active:boolean; createdAt:string };
export type GridPoint = { id:string; number:number; lat:number; lng:number; distanceKm:number };
export type RankResult = { pointId:string; rank:number|null; competitors:{name:string;placeId?:string;rank:number;rating?:number;reviews?:number}[]; checkedAt:string };
export type Scan = { id:string; businessId?:string; businessName:string; keyword:string; mode:'client'|'explorer'; createdAt:string; status:'completed'|'partial'|'failed'|'demo'; averageRank:number|null; top3:number; top10:number; notFound:number; points:GridPoint[]; results:RankResult[]; location:string };
