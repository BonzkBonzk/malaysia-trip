const routeEndpoint='https://routing.openstreetmap.de/routed-car/route/v1/driving/';
const radians=Math.PI/180;
const straight=(a,b)=>{
 const dLat=(b.lat-a.lat)*radians;
 const dLon=(b.lon-a.lon)*radians;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
};
const km=n=>n<1?Math.round(n*1000)+' 米':(n>=10?Math.round(n):n.toFixed(1))+' 公里';
const timeText=m=>{const n=Math.max(0,Math.round(m));return n>=60?Math.floor(n/60)+' 小时'+(n%60?' '+n%60+' 分钟':''):n+' 分钟';};
const lngLat=([lon,lat])=>({lat,lon});
const timedJSON=async(url,ms=9000)=>{const res=await fetch(url,{signal:AbortSignal.timeout(ms)});if(!res.ok)throw Error('HTTP '+res.status);return res.json();};
let lastRoadRequest=0;
let roadQueue=Promise.resolve();
function requestRoad(points,geometry){
 const value=roadQueue.then(async ()=>{
   const pause=Math.max(0,1050-(Date.now()-lastRoadRequest));
   if(pause) await new Promise(resolve=>setTimeout(resolve,pause));
   lastRoadRequest=Date.now();
   const coords=points.map(p=>p.lon.toFixed(6)+','+p.lat.toFixed(6)).join(';');
   const options='?overview='+(geometry?'full':'false')+'&geometries=geojson&generate_hints=false';
   const json=await timedJSON(routeEndpoint+coords+options,13000);
   if(!json.routes?.[0]) throw Error(json.code||'NoRoute');
   return json.routes[0];
 });
 roadQueue=value.catch(()=>{});
 return value;
}
function normalizeRoute(raw,waypoints){
 const coordinates=raw.geometry.coordinates.map(lngLat);
 const cumulative=[0];
 for(let i=1;i<coordinates.length;i++) cumulative.push(cumulative[i-1]+straight(coordinates[i-1],coordinates[i]));
 const legs=raw.legs.map(l=>({km:l.distance/1000,min:l.duration/60}));
 let shapeStart=0,total=0,totalMin=0;
 for(const [i,leg] of legs.entries()){
   total+=leg.km;
   totalMin+=leg.min;
   // A loop can visit the same coordinates twice. Locate each leg by the
   // cumulative distance before matching the boundary coordinate.
   const target=cumulative.at(-1)*total/(raw.distance/1000||1);
   let selected=shapeStart;
   let best=Infinity;
   if(i===legs.length-1) selected=coordinates.length-1;
   else for(let p=shapeStart;p<coordinates.length;p++){
     const deviation=Math.abs(cumulative[p]-target);
     if(deviation>Math.max(8,leg.km*.12)) continue;
     const fit=straight(coordinates[p],waypoints[i+1])+deviation*.11;
     if(fit<best){best=fit;selected=p;}
   }
   leg.from=waypoints[i];leg.to=waypoints[i+1];leg.start=total-leg.km;leg.startMin=totalMin-leg.min;
   leg.shape=coordinates.slice(shapeStart,selected+1);
   if(leg.shape.length<2) leg.shape=[leg.from,leg.to];
   leg.shapeKm=[0];
   for(let p=1;p<leg.shape.length;p++) leg.shapeKm.push(leg.shapeKm[p-1]+straight(leg.shape[p-1],leg.shape[p]));
   shapeStart=selected;
 }
 return {points:waypoints,coordinates,legs,km:raw.distance/1000,min:raw.duration/60};
}
function projection(p,leg,i){
 const a=leg.shape[i],b=leg.shape[i+1];
 const factor=Math.cos(p.lat*radians);
 const x=(b.lon-a.lon)*factor,y=b.lat-a.lat,u=(p.lon-a.lon)*factor,v=p.lat-a.lat;
 const t=Math.max(0,Math.min(1,(u*x+v*y)/(x*x+y*y||1)));
 return {distance:Math.hypot(u-t*x,v-t*y)*111.2,t};
}
function legMatch(p,leg){
 let best=null;
 const total=leg.shapeKm.at(-1)||1;
 for(let i=0;i<leg.shape.length-1;i++){
   const {distance,t}=projection(p,leg,i);
   if(p.dir&&(p.dir==='north'?leg.to.lat<=leg.from.lat:leg.to.lat>=leg.from.lat))continue;
   if(!best||distance<best.distance){
     const fraction=(leg.shapeKm[i]+t*(leg.shapeKm[i+1]-leg.shapeKm[i]))/total;
     best={distance,along:leg.km*fraction,segment:i,fraction};
   }
 }
 return best;
}
function matches(route,place){
 if(!route)return [];
 return route.legs.flatMap((leg,i)=>{
   const m=legMatch(place,leg);
   return m&&(!place.dir||m.distance<1.5)?[{...m,leg:i,progress:leg.start+m.along,fromStart:leg.startMin+leg.min*m.fraction}]:[];
 });
}
function parseCoordinates(value){
 let normalized=value.trim();
 if(!normalized)return null;
 if(/^https?:/i.test(normalized)){
   try{
     const url=new URL(normalized);
     const osm=url.hash.match(/^#map=[\d.]+\/(-?[\d.]+)\/(-?[\d.]+)/);
     const pin=normalized.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);
     const at=url.pathname.match(/@(-?[\d.]+),(-?[\d.]+)/);
     if(pin) normalized=pin[1]+','+pin[2];
     else if(osm) normalized=osm[1]+','+osm[2];
     else if(at) normalized=at[1]+','+at[2];
     else if(url.searchParams.has('mlat')&&url.searchParams.has('mlon'))normalized=url.searchParams.get('mlat')+','+url.searchParams.get('mlon');
     else normalized=url.searchParams.get('query')||url.searchParams.get('q')||'';
   }catch{return null;}
 }
 const m=normalized.match(/^\s*(-?\d+(?:\.\d+)?)[,\s，]+(-?\d+(?:\.\d+)?)\s*$/);
 if(!m)return null;
 const [lat,lon]=m.slice(1).map(Number);
 return lat>=.8&&lat<=7.8&&lon>=99.3&&lon<=120?{lat,lon}:null;
}
const weekdays=['Su','Mo','Tu','We','Th','Fr','Sa'];
function localDate(date,time='00:00'){
 return new Date(date+'T'+time+':00+08:00');
}
const dateParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'});
const clockParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function opening(hours,date){
 if(!hours)return null;
 if(hours==='24/7')return true;
 const day=new Date(date.getTime()+8*3600000).getUTCDay();
 const clock=clockParts.format(date).split(':').map(Number);
 const minute=clock[0]*60+clock[1];
 let ruleFound=false, open=false;
 for(const raw of hours.split(';')){
   const rule=raw.trim().match(/^(?:((?:Su|Mo|Tu|We|Th|Fr|Sa)(?:(?:,|-)(?:Su|Mo|Tu|We|Th|Fr|Sa))*)\s+)?(off|\d\d:\d\d-\d\d:\d\d(?:,\d\d:\d\d-\d\d:\d\d)*)$/);
   if(!rule)return null;
   const days=new Set();
   for(const part of (rule[1]||'Su-Sa').split(',')){
     const [start,end]=part.split('-').map(d=>weekdays.indexOf(d));
     if(end===undefined)days.add(start);
     else for(let n=0;n<7;n++){const d=(start+n)%7;days.add(d);if(d===end)break;}
   }
   if(rule[2]==='off'){
     if(days.has(day)){ruleFound=true;open=false;}
     continue;
   }
   for(const window of rule[2].split(',')){
     const [a,b]=window.split('-').map(s=>{const [h,m]=s.split(':').map(Number);return h*60+m;});
     if(days.has(day)){ruleFound=true;open ||= b>a?minute>=a&&minute<b:minute>=a;}
     if(b<a&&days.has((day+6)%7)&&minute<b){ruleFound=true;open=true;}
   }
 }
 return ruleFound?open:false;
}

/* OpenMapTiles POI points, decoded from the public vector basemap. */
function protobuf(buffer){
 let offset=0;
 const read=()=>{
   let n=0,shift=0,b;
   do{if(offset>=buffer.length||shift>63)throw Error('Bad tile');b=buffer[offset++];n+=(b&127)*2**shift;shift+=7;}while(b&128);
   return n;
 };
 return {read,fields(fn){while(offset<buffer.length){
   const field=read(),wire=field%8,tag=field>>>3;
   if(wire===0){fn(tag,read());continue;}
   if(wire===2){const length=read(),start=offset;offset+=length;if(offset>buffer.length)throw Error('Bad tile length');fn(tag,buffer.subarray(start,offset));continue;}
   if(wire===5||wire===1){offset+=wire===5?4:8;continue;}
   throw Error('Unsupported tile format');
 }},done:()=>offset>=buffer.length};
}
const decoder=new TextDecoder();
function decodePOIs(buf,x,y,z){
 let pois=[];
 protobuf(buf).fields((id,payload)=>{
   if(id!==3)return;
   let layer='',extent=4096;const features=[],keys=[],values=[];
   protobuf(payload).fields((tag,v)=>{
     if(tag===1)layer=decoder.decode(v);
     if(tag===2)features.push(v);
     if(tag===3)keys.push(decoder.decode(v));
     if(tag===4){
       let value='';
       protobuf(v).fields((key,data)=>{if(key===1)value=decoder.decode(data);if(key>=4&&key<=7)value=data;});
       values.push(value);
     }
     if(tag===5)extent=v;
   });
   if(layer!=='poi')return;
   pois=features.flatMap(feature=>{
     const tags={};let geometry,type;
     protobuf(feature).fields((tag,v)=>{
       if(tag===2){const list=protobuf(v);while(!list.done())tags[keys[list.read()]]=values[list.read()];}
       if(tag===3)type=v;
       if(tag===4)geometry=v;
     });
     const title=tags['name:latin']||tags.name||tags['name:en'];
     if(type!==1||!geometry||typeof title!=='string'||!title.trim())return [];
     const food=['restaurant','cafe','fast_food','food_court','ice_cream','bakery'];
     const attractions=['attraction','museum','zoo','theme_park','viewpoint','monument','castle','fort','archaeological_site','waterfall','garden','park','aquarium','artwork'];
     const hits=types=>types.includes(tags.class)||types.includes(tags.subclass);
     const category=hits(food)?'food':hits(attractions)?'attraction':hits(['fuel'])?'fuel':'';
     if(!category)return [];
     const loc=protobuf(geometry),unzig=v=>v%2?-(v+1)/2:v/2;
     if((loc.read()&7)!==1)return [];
     const n=2**z,lon=(x+unzig(loc.read())/extent)/n*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+unzig(loc.read())/extent)/n)))/radians;
     return [{title,lat,lon,category,subclass:tags.subclass||tags.class}];
   });
 });
 return pois;
}
function tileAt(p,z=14){
 const n=2**z;
 return [Math.floor((p.lon+180)/360*n),Math.floor((1-Math.asinh(Math.tan(p.lat*radians))/Math.PI)/2*n)];
}
const tileCache=new Map();
let tileManifest;
async function mapPlaceTiles(points,neighbors){
 const z=14, tiles=new Map();
 for(const point of points){
   const [x,y]=tileAt(point,z);
   for(const [dx,dy] of neighbors?[[0,0],[-1,0],[1,0],[0,-1],[0,1]]:[[0,0]]){
     const key=(x+dx)+'/'+(y+dy);
     if(!tiles.has(key))tiles.set(key,[x+dx,y+dy]);
   }
 }
 tileManifest ||= timedJSON('https://tiles.openfreemap.org/planet',6500).catch(e=>{tileManifest=null;throw e;});
 const manifest=await tileManifest;
 const results=await Promise.allSettled([...tiles].slice(0,16).map(([key,[x,y]])=>{
   if(!tileCache.has(key)){
     const url=manifest.tiles[0].replace('{z}',z).replace('{x}',x).replace('{y}',y);
     tileCache.set(key,fetch(url,{signal:AbortSignal.timeout(9000)}).then(async r=>{
       if(!r.ok)throw Error('Tile '+r.status);
       return decodePOIs(new Uint8Array(await r.arrayBuffer()),x,y,z);
     }).catch(e=>{tileCache.delete(key);throw e;}));
   }
   return tileCache.get(key);
 }));
 if(results.every(r=>r.status==='rejected'))throw Error('Map data unavailable');
 return {places:results.flatMap(r=>r.status==='fulfilled'?r.value:[]),partial:results.some(r=>r.status==='rejected')};
}
if(typeof globalThis.tripGeoTest==='object')Object.assign(globalThis.tripGeoTest,{normalizeRoute,parseCoordinates,matches,straight,decodePOIs,opening,localDate,mapPlaceTiles});