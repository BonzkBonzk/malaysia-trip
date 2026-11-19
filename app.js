const $=id=>document.getElementById(id);
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const categoryNames={food:'美食',attraction:'景点',fuel:'油站'};
const icons={food:'♨',attraction:'◇',fuel:'⛽'};
const metrics=['食物','卫生','服务'];
const city=id=>cities.find(p=>p.id===id)||customStops.get(id);
const region=id=>regions.find(p=>p.id===id);
const storageKey='malaysia-trip.v1';
function loadSaved(){
 try{return JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{return {};}
}
const saved=loadSaved();
const customStops=new Map((Array.isArray(saved.customStops)?saved.customStops:[])
 .filter(p=>typeof p?.id==='string'&&p.id.startsWith('custom-')&&typeof p.title==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon))
 .map(p=>[p.id,p]));
const state={
 ids:Array.isArray(saved.ids)&&saved.ids.length>=2&&saved.ids.every(city)?saved.ids:defaultStops.slice(),
 stay:saved.stay||null,date:saved.date||dateParts.format(new Date()),time:saved.time||'08:00',
 foodType:saved.foodType||'all',
 plan:Array.isArray(saved.plan)?saved.plan.filter(p=>p?.id&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)):[],
 ratings:saved.ratings||{},evidence:saved.evidence||{},layovers:saved.layovers||{},category:'food',area:'route',scope:'all',
 preset:saved.preset||'balanced',minimum:Array.isArray(saved.minimum)?saved.minimum:[0,0,0],
 showUnknown:saved.showUnknown??true,demo:saved.demo??false,limit:saved.limit??15,
 fuelTarget:saved.fuelTarget??180,onlyOpen:false
};
function save(){
 try{
  localStorage.setItem(storageKey,JSON.stringify({
   ids:state.ids,customStops:state.ids.map(id=>customStops.get(id)).filter(Boolean),stay:state.stay,date:state.date,time:state.time,foodType:state.foodType,plan:state.plan,ratings:state.ratings,evidence:state.evidence,
   layovers:state.layovers,preset:state.preset,minimum:state.minimum,showUnknown:state.showUnknown,
   demo:state.demo,limit:state.limit,fuelTarget:state.fuelTarget
  }));
 }catch{}
}
const routeStore=new Map();
const livePlaces=new Map(basePlaces.map(p=>[p.id,p]));
const placeNameIndex=new Map();
for(const p of state.plan)if(!livePlaces.has(p.id))livePlaces.set(p.id,p);
let searchStatus='',searchLoading=false,searchToken=0,routeToken=0;
let route=null,points=[],draft=state.ids.slice(),selectedPin='',mapBoundaries=[];
let routeTime=new Map(),detours=new Map(),placeMatches=new Map(),activeRating=null,activeSwap=null;
const formatDeparture=()=>localDate(state.date,state.time);
const at=(m)=>new Date(formatDeparture().getTime()+m*60000);
const makePointWords=p=>[p.title,p.en].filter((label,i,list)=>label&&list.indexOf(label)===i).join(' · ');
function notify(text){
 $('toast').textContent=text;
 clearTimeout(notify.timer);
 notify.timer=setTimeout(()=>$('toast').textContent='',2700);
}
function routeMessage(text,error=false){
 $('route-status').textContent=text;
 $('route-status').classList.toggle('error',error);
}
function hasRoute(){
 return Boolean(route&&route.legs.length);
}
function routeKey(waypoints){return waypoints.map(p=>p.lat.toFixed(5)+','+p.lon.toFixed(5)).join(';');}
function renderStops(){
 $('stops').innerHTML=draft.map((id,i)=>{
   const label=i===0?'起点':i===draft.length-1?'终点':'途经地';
   const groups=[
     ['吉隆坡及社区',cities.filter(p=>p.area==='kl')],
     ['雪兰莪',cities.filter(p=>p.area==='sel')],
     ['西马其他城市',cities.filter(p=>!p.east&&!['kl','sel'].includes(p.area))],
     ['东马城市',cities.filter(p=>p.east)]
   ];
   const custom=customStops.get(id);
   if(custom)groups.push(['已查找地点',[custom]]);
   const options=groups.map(([title,items])=>'<optgroup label="'+title+'">'+items.map(p=>
     '<option value="'+safe(p.id)+'" '+(p.id===id?'selected':'')+'>'+safe(makePointWords(p))+'</option>').join('')+'</optgroup>').join('');
   return '<div class="stop-row"><span class="stop-num">'+(i+1)+'</span><div class="stop-field"><label><span>'+label+'</span>'+
      '<select data-stop="'+i+'" aria-label="'+label+' '+(i+1)+'">'+options+'</select></label>'+
      '<button type="button" class="text-button find-stop" data-find-stop="'+i+'" aria-label="查找'+label+' '+(i+1)+'">查找地点</button></div>'+
      (draft.length>2?'<button type="button" class="remove-stop" data-remove-stop="'+i+'" aria-label="移除'+label+'">✕</button>':'<span aria-hidden="true"></span>')+'</div>';
 }).join('');
 $('add-stop').disabled=draft.length>=8;
}
function waypointsFromState(){
 const places=state.ids.map(city);
 if(state.stay) {
   const area=findArea(state.stay)||places[0].area;
   places[0]={...places[0],...state.stay,id:'lodging',area,en:'住宿',east:state.stay.lon>=109};
 }
 return places;
}
async function calculate(userAction=false){
 const token=++routeToken;
 const nextPoints=waypointsFromState();
 points=nextPoints;
 route=null;routeTime=new Map();placeMatches=new Map();
 selectedPin='';state.area='route';
 $('route-submit').disabled=true;
 routeMessage('正在计算道路距离…');
 renderAll();
 try{
   if(nextPoints.slice(1).some((p,i)=>straight(p,nextPoints[i])<.03))throw Error('duplicate');
   if(nextPoints.some(p=>p.east!==nextPoints[0].east))throw Error('sea');
   const key=routeKey(nextPoints);
   if(!routeStore.has(key)){
     const raw=await requestRoad(nextPoints,true);
     routeStore.set(key,raw);
   }
   if(token!==routeToken)return;
   route=normalizeRoute(routeStore.get(key),nextPoints);
   routeMessage('');
 }catch(err){
   if(token!==routeToken)return;
   const messages={
     duplicate:'连续两个停留点太近，请换一个目的地。',
     sea:'东西马之间需要另外安排航班或船程。可分别计算西马和东马的自驾路线。'
   };
   routeMessage(messages[err.message]||'暂时算不到这条道路路线。仍可按城市找地点，稍后可再计算。',true);
 }finally{
   if(token===routeToken){
     $('route-submit').disabled=false;
     renderAll();
     if(userAction&&route)notify('路线已更新');
     void discoverPlaces();
   }
 }
}

let mapScope='all',mapScale=1,panX=0,panY=0,focusedRegion=null;
let pointerDrag=null;
const mapPointers=new Map();
const bounds={west:[99.35,1.15,104.65,6.95],east:[109.25,.65,119.8,7.55]};
const featureNames={Selangor:'sel',Johor:'joh','Kuala Lumpur':'kl',Malacca:'mel','Negeri Sembilan':'ns',Sabah:'sbh',Sarawak:'srw',Kelantan:'kel',Putrajaya:'put',Terengganu:'trg',Pahang:'phg',Kedah:'ked',Perlis:'pls',Perak:'per',Penang:'pen',Labuan:'lab'};
const stateColors={pls:'#dcb4e5',ked:'#9bc4e8',pen:'#f3b49f',per:'#8ccdbd',sel:'#d8b4e9',kl:'#da856d',put:'#f1cf74',ns:'#edb582',mel:'#8fbfe9',joh:'#f2d785',kel:'#f3c18b',trg:'#9ac8de',phg:'#b5d692',sbh:'#9acec5',srw:'#ddb8e6',lab:'#f3bc83'};
const stateLabels={
 pls:[100.22,6.57],ked:[100.66,6.05],pen:[100.35,5.32],per:[101.04,4.76],kel:[102.11,5.65],
 trg:[103.04,5.13],phg:[102.38,3.83],sel:[101.36,3.34],kl:[101.69,3.15],put:[101.70,2.93],
 ns:[102.16,2.80],mel:[102.30,2.29],joh:[103.42,2.04],srw:[113.30,2.55],sbh:[116.93,5.57],lab:[115.22,5.33]
};
function stateBounds(id){
 const feature=mapBoundaries.find(([name])=>featureNames[name]===id);
 if(!feature)return null;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const polygon of feature[1])for(const [lon,lat] of polygon[0]){
   minX=Math.min(lon,minX);minY=Math.min(lat,minY);maxX=Math.max(lon,maxX);maxY=Math.max(lat,maxY);
 }
 const padX=Math.max(.14,(maxX-minX)*.17),padY=Math.max(.14,(maxY-minY)*.17);
 return [minX-padX,minY-padY,maxX+padX,maxY+padY];
}
function mapFrames(w,h){
 let frames;
 if(mapScope!=='all')frames=[{x:0,y:0,w,h,key:mapScope}];
 else if(w<520)frames=[{x:0,y:0,w,h:h/2,key:'west'},{x:0,y:h/2,w,h:h/2,key:'east'}];
 else frames=[{x:0,y:0,w:w*.47,h,key:'west'},{x:w*.47,y:0,w:w*.53,h,key:'east'}];
 return frames.map(frame=>{
   const [a,b,c,d]=(focusedRegion&&stateBounds(focusedRegion))||bounds[frame.key];
   const scale=Math.min(Math.max(12,frame.w-48)/(c-a),Math.max(12,frame.h-44)/(d-b))*mapScale;
   const midX=frame.x+frame.w/2+panX,midY=frame.y+frame.h/2+panY+7;
   const lon0=(a+c)/2,lat0=(b+d)/2;
   return {...frame,xy:(lon,lat)=>[midX+(lon-lon0)*scale,midY+(lat0-lat)*scale],
     unproject:(x,y)=>({lon:lon0+(x-midX)/scale,lat:lat0-(y-midY)/scale})};
 });
}
const featuredCities=new Set(['george-town','kuala-lumpur','johor-bahru','kuching','kota-kinabalu','kuala-terengganu']);
function selectArea(area){
 state.area=area;selectedPin=area;state.category=state.category||'food';
 renderAll();
 void discoverPlaces();
}
function mapSelectArea(area,focus=false){
 if(!region(area))return;
 limitCards=9;
 if(focus)setMapScope(region(area).east?'east':'west',area);
 selectArea(area);
}
function drawMap(){
 const canvas=$('map'),stage=$('map-stage');
 const w=stage.clientWidth,h=stage.clientHeight;
 if(!w||!h)return;
 const ratio=Math.min(window.devicePixelRatio||1,2);
 const pixelW=Math.round(w*ratio),pixelH=Math.round(h*ratio);
 if(canvas.width!==pixelW||canvas.height!==pixelH){canvas.width=pixelW;canvas.height=pixelH;}
 const ctx=canvas.getContext('2d');
 if(!ctx)return;
 ctx.setTransform(ratio,0,0,ratio,0,0);
 ctx.fillStyle='#eaf3f7';ctx.fillRect(0,0,w,h);
 const routeIds=new Set(points.map(p=>p.id));
 const track=route?.coordinates||[];
 const pins=[];
 for(const frame of mapFrames(w,h)){
   const {x,y,w:fw,h:fh,key,xy}=frame;
   ctx.save();ctx.beginPath();ctx.rect(x,y,fw,fh);ctx.clip();
   ctx.fillStyle=key==='east'?'#e8f2f6':'#edf5f7';ctx.fillRect(x,y,fw,fh);
   for(const [name,polygons] of mapBoundaries){
     const id=featureNames[name],r=region(id);
     if(!r||(key==='east')!==r.east)continue;
     ctx.fillStyle=stateColors[id]||'#bbcfc5';
     ctx.strokeStyle='#ffffff';ctx.lineWidth=state.area===id?2.3:1.05;
     ctx.globalAlpha=focusedRegion&&focusedRegion!==id ? .54 : 1;
     ctx.beginPath();
     for(const polygon of polygons)for(const ring of polygon){
       for(let i=0;i<ring.length;i++){
         const [px,py]=xy(...ring[i]);i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
       }
       ctx.closePath();
     }
     ctx.fill('evenodd');ctx.stroke();
     if(state.area===id){ctx.strokeStyle='#23493c';ctx.lineWidth=1.25;ctx.stroke();}
     ctx.globalAlpha=1;
   }
   if(track.length>1&&Boolean(points[0]?.east)===(key==='east')){
     for(const [color,width] of [['#fff',5],['#174e43',2.6]]){
       ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';
       ctx.beginPath();track.forEach((p,i)=>{const [px,py]=xy(p.lon,p.lat);i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);});ctx.stroke();
     }
   }
   ctx.font='750 10px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   for(const r of regions){
     if((key==='east')!==r.east||(focusedRegion&&focusedRegion!==r.id))continue;
     if((mapScope==='all'||mapScale<1.6)&&['kl','put','lab','pen','mel'].includes(r.id))continue;
     const [px,py]=xy(...stateLabels[r.id]);
     if(px<x+18||px>x+fw-18||py<y+31||py>y+fh-15)continue;
     ctx.strokeStyle='#f4faf7';ctx.lineWidth=2.8;ctx.lineJoin='round';ctx.strokeText(r.title,px,py);
     ctx.fillStyle='#294741';ctx.fillText(r.title,px,py);
   }
   const candidatePins=[
     ...cities.filter(p=>!routeIds.has(p.id)&&mapScope!=='all'&&(mapScale>=1.5||focusedRegion===p.area||featuredCities.has(p.id))).map(p=>({...p,num:0})),
     ...points.map((p,i)=>({...p,num:i+1}))
   ];
   for(const p of candidatePins){
     if((key==='east')!==p.east)continue;
     const [px,py]=xy(p.lon,p.lat);
     if(px<x+9||px>x+fw-9||py<y+25||py>y+fh-8)continue;
     pins.push('<button type="button" class="map-pin'+(p.num?' route':'')+(selectedPin===p.area?' selected':'')+'" style="left:'+px.toFixed(1)+'px;top:'+py.toFixed(1)+'px" data-area="'+safe(p.area)+'" aria-label="探索'+safe(p.title)+'" title="'+safe(makePointWords(p))+'">'+(p.num||'')+'<span>'+safe(p.title)+'</span></button>');
   }
   ctx.fillStyle='#335c59';ctx.font='800 11px system-ui, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
   ctx.fillText(focusedRegion?(region(focusedRegion)?.title||''):(key==='west'?'西马 · PENINSULAR':'东马 · BORNEO'),x+12,y+14);
   ctx.restore();
   if(x||y){
     ctx.strokeStyle='#c7dce3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x?x:x+fw,x?y+fh:y);ctx.stroke();
   }
 }
 $('map-pins').innerHTML=pins.join('');
 $('map-caption').textContent='点州属看地点 · ＋／− 缩放 · 可拖动';
 const legend=$('state-legend');
 legend.innerHTML=regions.filter(r=>mapScope==='all'||r.east===(mapScope==='east')).map(r=>
   '<button type="button" data-legend-area="'+r.id+'" aria-pressed="'+String(state.area===r.id)+'"><span aria-hidden="true" style="background:'+stateColors[r.id]+'"></span>'+safe(r.title)+'</button>').join('');
}
function setMapScope(scope,focus=null){
 mapScope=scope;focusedRegion=focus;mapScale=1;panX=0;panY=0;
 document.querySelectorAll('[data-region]').forEach(b=>{const on=b.dataset.region===scope;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
 drawMap();
}
function zoom(step){
 mapScale=Math.min(7,Math.max(.78,mapScale*step));
 if(mapScale<=1){panX=0;panY=0;}
 drawMap();
}
function mapHit(x,y){
 const frame=mapFrames($('map-stage').clientWidth,$('map-stage').clientHeight).find(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h);
 if(!frame)return null;
 const p=frame.unproject(x,y);
 const feature=mapBoundaries.find(([name,polygons])=>region(featureNames[name])?.east===(frame.key==='east')&&polygons.some(poly=>inRing(p,poly[0])&&!poly.slice(1).some(hole=>inRing(p,hole))));
 return feature?featureNames[feature[0]]:null;
}
function googleDirections(stops){
 const coords=p=>p.lat.toFixed(6)+','+p.lon.toFixed(6);
 const params=new URLSearchParams({api:'1',origin:coords(stops[0]),destination:coords(stops.at(-1)),travelmode:'driving'});
 if(stops.length>2)params.set('waypoints',stops.slice(1,-1).map(coords).join('|'));
 return 'https://www.google.com/maps/dir/?'+params;
}
function googleRouteSegments(stops){
 const segments=[];
 for(let i=0;i<stops.length-1;i+=4)segments.push(stops.slice(i,i+5));
 return segments;
}
function renderGoogleRoute(){
 const navigation=$('google-route');
 if(points.length<2||points.some(p=>p.east!==points[0].east)||points.slice(1).some((p,i)=>straight(p,points[i])<.03)){
   navigation.innerHTML='';
   return;
 }
 const segments=googleRouteSegments(points);
 navigation.innerHTML=segments.map(stops=>{
   const label=segments.length===1?'Google Maps 实时路况及导航':stops[0].title+' → '+stops.at(-1).title;
   return '<a href="'+safe(googleDirections(stops))+'" target="_blank" rel="noopener">'+safe(label)+'</a>';
 }).join('')+(segments.length>1?'<p class="fine">途经地较多，按以上分段打开 Google Maps。</p>':'');
}
function renderRouteSummary(){
 renderGoogleRoute();
 if(!route){
  $('route-summary').innerHTML='<span>公路距离和车程会在计算后显示。</span>';
  return;
 }
 $('route-summary').innerHTML='<span><span class="route-icon">◇</span> <b>'+safe(km(route.km))+'</b> 全程</span>'+
 '<span><span class="route-icon">◷</span> <b>'+safe(timeText(route.min))+'</b> 规划估时</span>'+
 route.legs.map(leg=>'<span>'+safe(leg.from.title)+' → '+safe(leg.to.title)+' <b>'+safe(km(leg.km))+'</b></span>').join('');
}
function simplifiedTitle(name){return name.normalize('NFKD').toLowerCase().replace(/\s*\((?:store|restaurant)\)$/,'').replace(/[^a-z0-9\u3400-\u9fff]/g,'');}
const niceSubtype={restaurant:'餐馆',cafe:'咖啡馆',fast_food:'快餐',food_court:'美食中心',ice_cream:'冰品',bakery:'面包店',attraction:'景点',museum:'博物馆',zoo:'动物园',theme_park:'主题公园',viewpoint:'观景点',monument:'纪念地',castle:'古迹',waterfall:'瀑布',garden:'花园',park:'公园',fuel:'油站'};
function inRing(point,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const [x1,y1]=ring[i],[x2,y2]=ring[j];
   if((y1>point.lat)!==(y2>point.lat)&&point.lon<(x2-x1)*(point.lat-y1)/(y2-y1)+x1)inside=!inside;
 }
 return inside;
}
function findArea(p){
 for(const [name,polygons] of mapBoundaries){
   if(polygons.some(poly=>inRing(p,poly[0])&&!poly.slice(1).some(hole=>inRing(p,hole))))return featureNames[name];
 }
 return mapBoundaries.length?null:regions.reduce((best,r)=>straight(p,r)<straight(p,best)?r:best,regions[0]).id;
}
function addDiscoveredPlaces(raw){
 for(const p of raw){
   const name=simplifiedTitle(p.title);
   if(!name)continue;
   const id='osm-'+name+'-'+p.lat.toFixed(4)+'-'+p.lon.toFixed(4);
   if(livePlaces.has(id))continue;
   const key=p.category+'|'+name;
   if(!placeNameIndex.has(key))placeNameIndex.set(key,[...basePlaces,...state.plan].filter(other=>other.category===p.category&&simplifiedTitle(other.title)===name));
   const sameName=placeNameIndex.get(key);
   if(sameName.some(other=>straight(p,other)<.8))continue;
   sameName.push(p);
   const area=findArea(p);
   if(!area)continue;
   livePlaces.set(id,{...p,id,area,tag:niceSubtype[p.subclass]||categoryNames[p.category],osm:true,duration:{food:45,attraction:60,fuel:15}[p.category]});
 }
}
function sampleRoute(){
 if(!hasRoute())return points;
 const samples=[...points];
 for(const leg of route.legs){
  const segments=Math.max(1,Math.ceil(leg.km/65));
  const len=leg.shapeKm.at(-1)||0;
  for(let i=1;i<Math.min(segments,7);i++){
    const p=leg.shapeKm.findIndex(d=>d>=i/segments*len);
    if(p>=0)samples.push(leg.shape[p]);
  }
 }
 return samples;
}
async function discoverPlaces(){
 const token=++searchToken;
 const area=state.area;
 const candidates=area==='route'?sampleRoute():[region(area)].filter(Boolean);
 if(!candidates.length){searchLoading=false;renderPlaces();return;}
 searchLoading=true;searchStatus='';renderPlaces();
 try{
   const response=await mapPlaceTiles(candidates,area!=='route');
   if(token!==searchToken)return;
   addDiscoveredPlaces(response.places);
   searchStatus=response.partial?'部分地图地点暂时无法读取。':'';
 }catch{
   if(token!==searchToken)return;
   searchStatus='地图地点暂时无法读取。可先查看已收录地点，或再试一次。';
 }finally{
   if(token===searchToken){searchLoading=false;renderPlaces();renderItinerary();}
 }
}
const presets={balanced:[1,1,1],food:[1,0,0],hygiene:[0,1,0],service:[0,0,1]};
function scoresFor(p){const auto=sourceEstimates(p);return metrics.map((_,i)=>auto[i].score??state.evidence[p.id]?.[i]?.score??state.ratings[p.id]?.[i]??p.scores?.[i]??null);}
function eligibleRating(p){
 const values=scoresFor(p);
 const selected=presets[state.preset]||presets.balanced;
 if(!state.showUnknown&&!values.some((v,i)=>selected[i]&&v!=null))return false;
 return state.minimum.every((min,i)=>!min||(values[i]!=null&&values[i]>=min));
}
function weightedScore(p){
 const values=scoresFor(p);let n=0,weight=0;
 (presets[state.preset]||presets.balanced).forEach((w,i)=>{if(w&&values[i]!=null){n+=values[i];weight++;}});
 return weight?n/weight:-1;
}
function relate(p){
 if(!route)return [];
 if(!placeMatches.has(p.id))placeMatches.set(p.id,matches(route,p));
 return placeMatches.get(p.id);
}
function bestMatch(p){
 const set=relate(p);
 return set.reduce((best,m)=>!best||m.distance<best.distance-.12||Math.abs(m.distance-best.distance)<=.12&&m.progress<best.progress?m:best,null);
}
function matchForDisplay(p){
 const all=relate(p);
 if(!all.length)return null;
 const standard=bestMatch(p);
 const preferred=p.category==='fuel'&&all.find(m=>m.progress>=state.fuelTarget&&m.distance<=Math.min(state.limit,5));
 return preferred||standard;
}
function dwellBefore(leg){
 return Object.entries(state.layovers).reduce((acc,[i,v])=>acc+(Number(i)<=leg?Number(v)||0:0),0);
}
function timeAtPlace(p,match){
 if(!match)return null;
 const custom=detours.get(routeKey(points)+'|'+p.id+'|'+match.leg);
 return at(match.fromStart+dwellBefore(match.leg)+(custom?.min||0)/2);
}
function fuelPick(items){
 if(!route)return null;
 const options=items.filter(a=>a.p.dir&&a.match?.distance<1.5);
 return options.find(a=>a.match.progress>=state.fuelTarget-8&&a.match.progress<=state.fuelTarget+25)
  ||options.filter(a=>a.match.progress<=state.fuelTarget).at(-1)
  ||null;
}
function getResults(){
 const items=[];
 for(const p of livePlaces.values()){
   if(p.category!==state.category||p.sample&&!state.demo)continue;
   if(state.area!=='route'&&p.area!==state.area)continue;
   const match=matchForDisplay(p);
   if(state.area==='route'){
     if(hasRoute()&&(!match||match.distance>state.limit))continue;
     if(!hasRoute()&&points.length&&!points.some(a=>a.area===p.area||straight(p,a)<8))continue;
   }
   if(p.category==='food'&&(!eligibleRating(p)||(state.foodType!=='all'&&foodKind(p)!==state.foodType)))continue;
   const likelyTime=timeAtPlace(p,match),open=likelyTime?opening(p.hours,likelyTime):null;
   if(state.onlyOpen&&open!==true)continue;
   items.push({p,match,open});
 }
 items.sort((a,b)=>{
   if(state.category==='food'){
    const score=weightedScore(b.p)-weightedScore(a.p);
    if(score)return score;
   }
   if(state.category==='fuel'){
     if(Boolean(a.p.dir)!==Boolean(b.p.dir))return a.p.dir?-1:1;
     return (a.match?.progress??Infinity)-(b.match?.progress??Infinity)||a.p.title.localeCompare(b.p.title);
   }
   return (a.p.osm?1:0)-(b.p.osm?1:0)||(a.match?.distance||0)-(b.match?.distance||0)||a.p.title.localeCompare(b.p.title);
 });
 return items;
}
function renderArea(){
 $('area-filter').innerHTML='<option value="route">沿途地点</option>'+regions.map(r=>'<option value="'+r.id+'">'+safe(r.title)+' · '+safe(r.en)+'</option>').join('');
 $('area-filter').value=state.area;
}
function activeButtons(selector,active){
 document.querySelectorAll(selector).forEach(button=>{
   const v=Object.values(button.dataset)[0]===active;
   button.classList.toggle('on',v);button.setAttribute('aria-pressed',String(v));
 });
}
function renderFilters(){
 activeButtons('#category-tabs [data-category]',state.category);
 const option=(value,label,current)=>'<option value="'+value+'" '+(String(current)===String(value)?'selected':'')+'>'+label+'</option>';
 const distance='<label>距线路直线<select id="distance-limit">'+[3,8,15,30,60].map(n=>option(n,n+' 公里内',state.limit)).join('')+'</select></label>';
 const open='<label class="check"><input type="checkbox" id="only-open" '+(state.onlyOpen?'checked':'')+'>只看预计营业</label>';
 let html='<div class="filters">';
 if(state.category==='food'){
   html+='<label>美食分类<select id="food-kind">'+Object.entries(foodKinds).map(([value,label])=>option(value,label,state.foodType)).join('')+'</select></label>';
   html+='<label>按你在意的项目排序<select id="rating-preset">'+[['balanced','三项平均'],['food','食物优先'],['hygiene','卫生优先'],['service','服务优先']].map(([value,label])=>option(value,label,state.preset)).join('')+'</select></label>';
   html+=metrics.map((name,i)=>'<label>'+name+'最低<select data-minimum="'+i+'">'+[[0,'不限'],[1,'1 星'],[2,'2 星'],[3,'3 星'],[4,'4 星'],[5,'5 星']].map(([value,label])=>option(value,label,state.minimum[i])).join('')+'</select></label>').join('');
   html+='</div><div class="filters">'+distance+open+'<label class="check"><input type="checkbox" id="unknown" '+(state.showUnknown?'checked':'')+'>含资料不足</label><label class="check"><input type="checkbox" id="demo" '+(state.demo?'checked':'')+'>看评分演示</label>';
 }else if(state.category==='fuel'){
   html+='<label>预计出发后补油<select id="fuel-target">'+[60,100,140,180,220,300,400,500].map(n=>option(n,n+' 公里左右',state.fuelTarget)).join('')+'</select></label>'+distance;
 }else html+=distance+open;
 html+='</div>';
 if(state.category==='food')html+='<p class="filter-note">按你在意的项目排序。样本足够时自动估分，未评分显示为「—」。'+(state.demo?' 演示店铺为虚构。':'')+'</p>';
 if(state.category==='fuel')html+='<p class="filter-note">优先建议有方向资料的 PLUS 站。里程从出发点计算，实际补油时机由你的油量决定。</p>';
 $('category-filters').innerHTML=html;
}
const mapLink=p=>'https://www.openstreetmap.org/?mlat='+encodeURIComponent(p.lat)+'&mlon='+encodeURIComponent(p.lon)+'#map=17/'+encodeURIComponent(p.lat)+'/'+encodeURIComponent(p.lon);
const foodKinds={
 all:'全部美食',restaurant:'餐馆',stall:'小吃／档口',dessert:'甜点',drinks:'饮料／咖啡',bakery:'面包糕点',other:'其他'
};
function foodKind(p){
 if(p.foodKind)return p.foodKind;
 const name=p.title.toLowerCase(),tag=p.subclass||p.tag;
 if(/\b(cendol|chendul|cendul|dessert|ais kacang|ice cream|gelato|bingsu|waffle)\b|甜品|甜点|冰淇淋|煎蕊/.test(name)||tag==='ice_cream')return 'dessert';
 if(/\b(coconut shake|bubble tea|juice|boba|tealive|chagee|gong cha|coffee|starbucks|zus coffee)\b|饮料|奶茶|果汁|咖啡/.test(name)||tag==='cafe')return 'drinks';
 if(/\b(bakery|pastry|patisserie|bread|bakers)\b|饼家|面包|糕饼/.test(name)||tag==='bakery')return 'bakery';
 if(/\b(stall|food court|gerai|warung|hawker|kopitiam)\b|小贩|档口|食阁/.test(name)||tag==='food_court')return 'stall';
 if(['restaurant','fast_food'].includes(tag)||/\b(restaurant|restoran|kitchen|bistro)\b|餐馆|餐厅/.test(name))return 'restaurant';
 return 'other';
}
const sourceScoreCache=new Map();
function sourceEstimates(p){
 if(sourceScoreCache.has(p.id))return sourceScoreCache.get(p.id);
 const entries=publishedEvidence[p.id];
 if(!entries)return metrics.map(()=>({n:0,score:null}));
 const scores=scoreReviewText(entries.map(entry=>entry.summary).join('\n')).map(({positive,negative})=>{
   const n=positive+negative;
   return {n,score:n>=2?Math.round((3+2*(positive-negative)/(n+.75))*10)/10:null};
 });
 sourceScoreCache.set(p.id,scores);
 return scores;
}
function googlePlace(p){
 const q=new URLSearchParams({api:'1',query:[p.title,p.googleArea||region(p.area)?.en,'Malaysia'].filter(Boolean).join(', ')});
 if(p.googlePlaceId)q.set('query_place_id',p.googlePlaceId);
 return p.googleReviewsUrl||'https://www.google.com/maps/search/?'+q;
}
function placeMedia(p){
 const photo=venuePhotos[p.id];
 if(photo)return '<a class="place-media photo" href="'+safe(photo.source)+'" target="_blank" rel="noopener" title="'+safe(photo.author+' · '+photo.license)+'"><img loading="lazy" width="128" height="100" src="'+safe(photo.path)+'" alt="'+safe(p.title)+'"></a>';
 if(p.sample)return '<div class="place-media placeholder '+p.category+'" aria-hidden="true"><span>'+icons[p.category]+'</span><small>暂无照片</small></div>';
 return '<a class="place-media placeholder '+p.category+'" href="'+safe(googlePlace(p))+'" target="_blank" rel="noopener" aria-label="打开 '+safe(p.title)+' 的 Google Maps 地点详情"><span aria-hidden="true">'+icons[p.category]+'</span><small>查看照片</small></a>';
}
function ratingDetails(p){
 const entries=publishedEvidence[p.id]||[], ratings=sourceEstimates(p);
 if(!entries.length)return '';
 return '<details class="rating-evidence"><summary>自动评分依据 · '+entries.length+' 条公开来源</summary><p>'+metrics.map((label,i)=>label+' '+ratings[i].n+' 条').join(' · ')+'</p><ul>'+entries.map(entry=>'<li><a href="'+safe(entry.url)+'" target="_blank" rel="noopener">'+safe(entry.label)+'</a> · '+safe(entry.summary)+'</li>').join('')+'</ul></details>';
}

function showRatings(p){
 const values=scoresFor(p),auto=sourceEstimates(p);
 return '<div class="rating-row">'+metrics.map((name,i)=>{
   const value=values[i];
   const source=auto[i].score!=null?'自动 · '+auto[i].n+' 条':p.sample?'演示':state.evidence[p.id]?.[i]?.score!=null?'导入估分':state.ratings[p.id]?.[i]!=null?'我的记录':'资料不足';
   return '<span class="aspect-score" title="'+safe(source)+'">'+name+' <b>'+(value==null?'—':'★ '+Number(value).toFixed(1))+'</b></span>';
 }).join('')+(auto.some(v=>v.score!=null)?'<span class="score-mode">自动估分</span>':'')+'</div>'+ratingDetails(p);
}
let limitCards=9;
function placeCard({p,match,open},pick){
 const linked=state.plan.some(s=>s.id===p.id);
 const detour=match&&detours.get(routeKey(points)+'|'+p.id+'|'+match.leg);
 let proximity='';
 if(match){
   if(p.category==='fuel')proximity='出发约 '+km(match.progress)+' · '+timeText(match.fromStart);
   else proximity=match.distance<.65?'靠近路线':'距线路直线约 '+km(match.distance);
 }
 const when=open===true?'预计营业':open===false?'预计未营业':'';
 const hours=p.hoursText||p.hours||'营业时间待核对';
 const sourceUrl=p.source||mapLink(p);
 const badge=pick?.p.id===p.id?'<span class="tag">建议补油</span>':p.sample?'<span class="tag alert">虚构演示</span>':'';
 let plusDrive='';
 if(detour)plusDrive='<span class="tag '+(detour.min>=25?'alert':'')+'">加开约 '+safe(timeText(detour.min))+' · '+safe(km(detour.km))+'</span>';
 return '<article class="card place">'+placeMedia(p)+'<div class="place-body">'+
   '<div class="place-title"><h3>'+safe(p.title)+'</h3>'+badge+'</div>'+
   '<div class="place-meta"><span>'+safe(region(p.area)?.title||'')+' · '+safe(p.category==='food'?foodKinds[foodKind(p)]+(p.tag&&p.tag!==foodKinds[foodKind(p)]?' · '+p.tag:''):p.tag)+'</span>'+
   (proximity?'<span>'+safe(proximity)+'</span>':'')+(when?'<span>'+safe(when)+'</span>':'')+'</div>'+
   (p.detail?'<p class="place-desc">'+safe(p.detail)+'</p>':'')+
   (p.category==='food'?showRatings(p):'')+
   '<div class="place-info"><span>'+safe(hours)+'</span><span>'+safe(p.price||(p.category==='attraction'?'票价待核对':p.category==='food'?'价格待核对':''))+'</span>'+plusDrive+'</div>'+
   '<div class="place-actions"><button type="button" class="primary" data-add="'+safe(p.id)+'"'+(linked?' disabled':'')+'>'+(linked?'已加入':'＋ 加入行程')+'</button>'+
   (p.category==='food'&&!p.sample?'<button type="button" class="text-button" data-rate="'+safe(p.id)+'">我的记录</button>':'')+
   (match&&p.category!=='fuel'&&!p.sample&&!detour?'<button type="button" class="text-button" data-detour="'+safe(p.id)+'">估算绕路</button>':'')+
   (!p.sample?'<a href="'+safe(sourceUrl)+'" target="_blank" rel="noopener">'+(p.osm?'地图资料':'查看来源')+'</a>':'')+
   (!p.sample?'<a class="maps-review" href="'+safe(googlePlace(p))+'" target="_blank" rel="noopener" title="打开 Google Maps 地点详情，可切换照片或评论">Google Maps 照片／评论</a>':'')+
   (p.tickets?'<a href="'+safe(p.tickets)+'" target="_blank" rel="noopener">购票</a>':'')+'</div></div></article>';
}
function renderPlaces(){
 const items=getResults();
 const pick=state.category==='fuel'?fuelPick(items):null;
 const order=pick?[pick,...items.filter(item=>item!==pick)]:items;
 const area=state.area==='route'?'路线附近':region(state.area)?.title||'';
 const headline=searchLoading?'正在搜索地图地点…':items.length+' 个'+categoryNames[state.category]+'地点';
 $('results-header').innerHTML='<div><strong>'+safe(area+' · '+headline)+'</strong>'+
   (searchStatus?'<span role="status">'+safe(searchStatus)+'</span>':'')+'</div>'+
   '<button type="button" id="refresh-places"'+(searchLoading?' disabled':'')+'>查找地图地点</button>';
 $('place-list').innerHTML=items.length?order.slice(0,limitCards).map(item=>placeCard(item,pick)).join('')+
    (items.length>limitCards?'<button type="button" class="add-line" id="more-results">查看更多地点</button>':''):
    '<div class="card empty">'+(searchLoading?'正在查找可加入行程的地点。':'没有符合现有筛选的地点。可以放宽范围、显示资料不足的店，或选另一个州属。')+'</div>';
}
function nearestAnchor(p,match,leg){
 if(!leg)return [p];
 const total=leg.shapeKm.at(-1)||0;
 const here=total*match.fraction;
 const i=leg.shapeKm.findIndex(d=>d>=Math.max(0,here-11));
 const j=leg.shapeKm.findIndex(d=>d>=here+11);
 const start=leg.shape[Math.max(0,i-1)];
 const end=leg.shape[j<0?leg.shape.length-1:j];
 return [start,end];
}
async function estimateDetour(button){
 const p=livePlaces.get(button.dataset.detour);
 const match=p&&bestMatch(p);
 if(!p||!match||!route)return;
 const key=routeKey(points)+'|'+p.id+'|'+match.leg;
 const [start,end]=nearestAnchor(p,match,route.legs[match.leg]);
 if(straight(start,end)<.05){notify('这里没有足够的道路范围可以比较');return;}
 button.textContent='计算中…';button.disabled=true;
 try{
   const baseline=await requestRoad([start,end],false);
   const diverted=await requestRoad([start,p,end],false);
   detours.set(key,{km:Math.max(0,(diverted.distance-baseline.distance)/1000),min:Math.max(0,(diverted.duration-baseline.duration)/60)});
   renderPlaces();renderItinerary();
 }catch{notify('暂时无法估算这个地点的道路绕行时间');button.textContent='估算绕路';button.disabled=false;}
}
function planEvents(){
 const events=[];
 if(!route){
   points.forEach((p,i)=>events.push({type:'city',p,i,minute:i===0?0:null,dwell:Number(state.layovers[i])||0}));
   state.plan.forEach(p=>events.push({type:'place',p,minute:null}));
   return events;
 }
 events.push({type:'city',p:points[0],i:0,minute:0,dwell:Number(state.layovers[0])||0});
 let elapsed=Number(state.layovers[0])||0;
 for(const [i,leg] of route.legs.entries()){
   const stops=state.plan.map(p=>({p,match:matchForDisplay(p)})).filter(s=>s.match?.leg===i&&s.match.distance<=60).sort((a,b)=>a.match.along-b.match.along);
   for(const {p,match} of stops){
     const detour=detours.get(routeKey(points)+'|'+p.id+'|'+i);
     const extra=detour?.min??(p.dir?0:Math.max(0,match.distance*2.8));
     events.push({type:'place',p,match,minute:elapsed+leg.min*match.fraction+extra/2,detourChecked:Boolean(detour)||Boolean(p.dir)});
     elapsed+=(Number(p.duration)||0)+extra;
   }
   elapsed+=leg.min;
   const dwell=Number(state.layovers[i+1])||0;
   events.push({type:'city',p:points[i+1],i:i+1,minute:elapsed,dwell});
   elapsed+=dwell;
 }
 const included=new Set(events.filter(e=>e.type==='place').map(e=>e.p.id));
 for(const p of state.plan)if(!included.has(p.id))events.push({type:'place',p,minute:null});
 return events;
}
function renderItinerary(){
 $('plan-count').textContent=state.plan.length;
 const events=planEvents();
 const reset=state.plan.length?'<button type="button" class="text-button" id="clear-plan">清空地点</button>':'';
 let html='<div class="itinerary-head"><strong>'+safe(state.date)+' · '+safe(state.time)+' 出发</strong>'+reset+'</div>'+
   '<p class="fine">已加 '+state.plan.length+' 个地点 · 时间以马来西亚当地时区估算</p>';
 if(!events.length){$('itinerary-content').innerHTML=html+'<p class="empty">计算路线后可加入沿路地点。</p>';return;}
 html+='<ol class="itinerary-list">';
 for(const event of events){
   const {p}=event,time=event.minute!=null?at(event.minute):null;
   const open=time?opening(p.hours,time):null;
   const stamp=time?(dateParts.format(time)!==state.date?dateParts.format(time)+' · ':'')+clockParts.format(time):'未排时间';
   html+='<li class="event '+(event.type==='place'?'stop-event':'')+'"><time>'+safe(stamp)+'</time><h3>'+safe(p.title)+'</h3>';
   if(event.type==='city'){
     const role=event.i===0?'出发':event.i===points.length-1?'目的地':'抵达';
     html+='<p>'+role+(event.dwell?' · 停留 '+safe(timeText(event.dwell)):'')+'</p>';
     if(event.i<points.length-1){
       html+='<div class="event-actions"><label class="event-stay">停留<select data-layover="'+event.i+'">'+[[0,'直接出发'],[60,'1 小时'],[180,'3 小时'],[360,'6 小时'],[720,'12 小时'],[1080,'18 小时'],[1440,'24 小时'],[2880,'48 小时']].map(([n,l])=>'<option value="'+n+'" '+(event.dwell===n?'selected':'')+'>'+l+'</option>').join('')+'</select></label></div>';
     }
   }else{
     const description=categoryNames[p.category]+' · 停留约 '+timeText(p.duration||0)+(p.sample?' · 虚构演示':'');
     html+='<p>'+safe(description)+'</p>';
     if(!time)html+='<p class="warn">当前路线未排入此地点，可更换或调整路线。</p>';
     else if(open===false)html+='<p class="warn">预计抵达时未营业，可换一个地点。</p>';
     else if(!p.hours)html+='<p>营业时间待核对</p>';
     if(time&&event.match?.distance>=.65&&!event.detourChecked)html+='<p>车程含粗略绕路估计，可在地点卡计算。</p>';
     html+='<div class="event-actions"><button type="button" class="text-button" data-swap="'+safe(p.id)+'">更换 / 来不及</button><button type="button" class="text-button" data-delete="'+safe(p.id)+'">移除</button></div>';
   }
   html+='</li>';
 }
 $('itinerary-content').innerHTML=html+'</ol>';
}
function addToPlan(id){
 const p=livePlaces.get(id);
 if(!p||state.plan.some(item=>item.id===id))return;
 state.plan.push({...p});save();renderPlaces();renderItinerary();notify('已加入我的行程');
}
function removePlan(id){
 state.plan=state.plan.filter(p=>p.id!==id);
 save();renderPlaces();renderItinerary();notify('已从行程移除');
}
function showSwap(id){
 const old=state.plan.find(p=>p.id===id);
 if(!old)return;
 activeSwap=id;
 const oldEvent=planEvents().find(e=>e.type==='place'&&e.p.id===id);
 const sameIndex=oldEvent?.match?.leg;
 const options=[];
 const planIds=new Set(state.plan.map(p=>p.id));
 for(const p of livePlaces.values()){
   if(p.category!==old.category||p.sample&&!old.sample||planIds.has(p.id))continue;
   if(p.category==='food'&&!eligibleRating(p))continue;
   const delta=straight(old,p);
   const match=relate(p).find(m=>m.leg===sameIndex);
   if(delta>25&&(!match||match.distance>state.limit||Math.abs(match.along-oldEvent.match.along)>60))continue;
   const original=oldEvent?.minute;
   const gap=match&&oldEvent?.match?match.fromStart-oldEvent.match.fromStart:0;
   const time=original!=null?at(original+gap+delta*1.5):null;
   const open=time?opening(p.hours,time):null;
   options.push({p,delta,open,match});
 }
 const preference=v=>v===true?0:v===null?1:2;
 options.sort((a,b)=>preference(a.open)-preference(b.open)||Number(!a.match)-Number(!b.match)||a.delta-b.delta);
 $('swap-content').innerHTML='<p class="fine">'+safe(old.title)+' · 优先列预计营业、靠近原停留点的同类地点。</p>'+
 (options.length?options.slice(0,7).map(({p,delta,open})=>'<div class="swap-row"><div><strong>'+safe(p.title)+'</strong><p class="fine">距原点直线 '+safe(km(delta))+' · '+(open===true?'预计营业':open===false?'预计未营业':'营业状态待核对')+'</p></div><button class="primary" type="button" data-replace="'+safe(p.id)+'">换这里</button></div>').join(''):'<p class="empty">这附近暂时没有可替换的同类地点。</p>')+
 '<button type="button" class="text-button" id="skip-stop">跳过这一站</button>';
 $('swap-dialog').showModal();
}
function showRating(id){
 const p=livePlaces.get(id);if(!p||p.sample)return;
 activeRating=id;
 $('rating-place').textContent=p.title;
 const values=state.ratings[id]||[];
 $('rating-fields').innerHTML=metrics.map((name,i)=>'<label class="rating-line">'+name+'<select name="rate'+i+'"><option value="">留空</option>'+[5,4,3,2,1].map(n=>'<option value="'+n+'" '+(values[i]===n?'selected':'')+'>'+n+' 星</option>').join('')+'</select></label>').join('');
 initRatingExtras(id);$('rating-dialog').showModal();
}
function renderAll(){renderArea();renderFilters();drawMap();renderRouteSummary();renderPlaces();renderItinerary();}
$('stops').addEventListener('change',event=>{
 const select=event.target.closest('[data-stop]');if(select)draft[Number(select.dataset.stop)]=select.value;
});
$('stops').addEventListener('click',event=>{
 const find=event.target.closest('[data-find-stop]');
 if(find){openStopSearch(Number(find.dataset.findStop));return;}
 const button=event.target.closest('[data-remove-stop]');if(!button||draft.length<=2)return;
 draft.splice(Number(button.dataset.removeStop),1);renderStops();
});
$('add-stop').addEventListener('click',()=>{
 if(draft.length>=8)return;
 const prev=city(draft.at(-2));
 const location=cities.find(p=>p.east===prev.east&&!draft.includes(p.id));
 draft.splice(draft.length-1,0,location?.id||prev.id);renderStops();
 const control=$('stops').querySelector('[data-stop="'+(draft.length-2)+'"]');control?.focus();
});
$('route-form').addEventListener('submit',event=>{
 event.preventDefault();
 const value=$('stay-coords').value.trim();
 const coords=parseCoordinates(value);
 if(value&&!coords){
   routeMessage('请输入马来西亚境内的纬度、经度，或含坐标的地图链接。',true);
   $('stay-coords').focus();return;
 }
 if(state.ids.join(';')!==draft.join(';')||JSON.stringify(coords)!==JSON.stringify(state.stay&&{lat:state.stay.lat,lon:state.stay.lon}))state.layovers={};
 state.ids=draft.slice();state.date=$('trip-date').value;state.time=$('trip-time').value;
 state.stay=coords?{...coords,title:$('stay-name').value.trim()||'我的住宿'}:null;
 save();
 void calculate(true);
});
$('reset-route').addEventListener('click',()=>{
 draft=defaultStops.slice();state.ids=draft.slice();state.stay=null;state.layovers={};
 $('stay-coords').value='';$('stay-name').value='';$('stay-details').open=false;
 save();renderStops();setMapScope('all');void calculate(true);
});
for(const id of ['trip-date','trip-time'])$(id).addEventListener('change',()=>{
 const date=$('trip-date').value,time=$('trip-time').value;if(!date||!time)return;
 state.date=date;state.time=time;save();renderPlaces();renderItinerary();
});
$('map-pins').addEventListener('click',event=>{
 const button=event.target.closest('[data-area]');if(!button)return;
 limitCards=9;selectArea(button.dataset.area);
 $('discover').scrollIntoView({behavior:'smooth',block:'start'});
});
document.querySelectorAll('[data-region]').forEach(button=>button.addEventListener('click',()=>setMapScope(button.dataset.region)));
$('zoom-in').addEventListener('click',()=>zoom(1.35));
$('zoom-out').addEventListener('click',()=>zoom(1/1.35));
const mapCanvas=$('map');
const distanceBetweenPointers=()=>{
 const [a,b]=[...mapPointers.values()];
 return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;
};
mapCanvas.addEventListener('pointerdown',event=>{
 if(event.button!==0)return;
 mapPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 pointerDrag={x:event.clientX,y:event.clientY,ox:panX,oy:panY,id:event.pointerId,distance:distanceBetweenPointers(),scale:mapScale,moved:mapPointers.size>1};
 mapCanvas.setPointerCapture(event.pointerId);
});
mapCanvas.addEventListener('pointermove',event=>{
 if(!pointerDrag||!mapPointers.has(event.pointerId))return;
 mapPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(mapPointers.size>1&&pointerDrag.distance>0){
   mapScale=Math.min(7,Math.max(.78,pointerDrag.scale*distanceBetweenPointers()/pointerDrag.distance));
   drawMap();return;
 }
 if(pointerDrag.id!==event.pointerId)return;
 const dx=event.clientX-pointerDrag.x,dy=event.clientY-pointerDrag.y;
 if(Math.hypot(dx,dy)<5&&!pointerDrag.moved)return;
 pointerDrag.moved=true;
 const cap=(n,max)=>Math.max(-max,Math.min(max,n));
 panX=cap(pointerDrag.ox+dx,mapCanvas.clientWidth*1.5);
 panY=cap(pointerDrag.oy+dy,mapCanvas.clientHeight*1.5);drawMap();
});
mapCanvas.addEventListener('pointerup',event=>{
 if(pointerDrag?.id===event.pointerId&&!pointerDrag.moved&&mapPointers.size===1){
   const rect=mapCanvas.getBoundingClientRect();
   const area=mapHit(event.clientX-rect.left,event.clientY-rect.top);
   if(area)mapSelectArea(area);
 }
 mapPointers.delete(event.pointerId);pointerDrag=null;
});
for(const name of ['pointercancel','lostpointercapture'])mapCanvas.addEventListener(name,event=>{mapPointers.delete(event.pointerId);pointerDrag=null;});
mapCanvas.addEventListener('wheel',event=>{
 if(!event.ctrlKey&&!event.metaKey)return;
 event.preventDefault();zoom(event.deltaY<0?1.12:1/1.12);
},{passive:false});
$('state-legend').addEventListener('click',event=>{
 const button=event.target.closest('[data-legend-area]');
 if(button)mapSelectArea(button.dataset.legendArea,true);
});
$('zoom-reset').addEventListener('click',()=>setMapScope('all'));
new ResizeObserver(drawMap).observe($('map-stage'));
$('area-filter').addEventListener('change',event=>{limitCards=9;selectArea(event.target.value);});
$('category-tabs').addEventListener('click',event=>{
 const button=event.target.closest('[data-category]');if(!button)return;
 state.category=button.dataset.category;state.onlyOpen=false;limitCards=9;renderFilters();renderPlaces();
});
$('category-filters').addEventListener('change',event=>{
 const control=event.target;
 if(control.dataset.minimum!==undefined)state.minimum[Number(control.dataset.minimum)]=Number(control.value);
 if(control.id==='rating-preset')state.preset=control.value;
 if(control.id==='food-kind')state.foodType=control.value;
 if(control.id==='distance-limit')state.limit=Number(control.value);
 if(control.id==='unknown')state.showUnknown=control.checked;
 if(control.id==='demo')state.demo=control.checked;
 if(control.id==='only-open')state.onlyOpen=control.checked;
 if(control.id==='fuel-target')state.fuelTarget=Number(control.value);
 save();limitCards=9;renderPlaces();renderItinerary();
 const note=$('category-filters').querySelector('.filter-note');
 if(control.id==='demo'&&note)note.textContent='按你在意的项目排序。样本足够时自动估分，未评分显示为「—」。'+(state.demo?' 演示店铺为虚构。':'');
});
$('results-header').addEventListener('click',event=>{
 if(event.target.id==='refresh-places')void discoverPlaces();
});
$('place-list').addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.add)addToPlan(button.dataset.add);
 if(button.dataset.rate)showRating(button.dataset.rate);
 if(button.dataset.detour)void estimateDetour(button);
 if(button.id==='more-results'){limitCards+=12;renderPlaces();}
});
$('itinerary-content').addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.swap)showSwap(button.dataset.swap);
 if(button.dataset.delete)removePlan(button.dataset.delete);
 if(button.id==='clear-plan'&&window.confirm('清空已加入的地点？')){
   state.plan=[];save();renderPlaces();renderItinerary();
 }
});
$('itinerary-content').addEventListener('change',event=>{
 const select=event.target.closest('[data-layover]');if(!select)return;
 state.layovers[select.dataset.layover]=Number(select.value);save();renderPlaces();renderItinerary();
 $('itinerary-content').querySelector('[data-layover="'+select.dataset.layover+'"]')?.focus();
});
$('top-plan').addEventListener('click',()=>$('itinerary').scrollIntoView({behavior:'smooth',block:'start'}));
$('close-swap').addEventListener('click',()=>$('swap-dialog').close());
$('close-rating').addEventListener('click',()=>$('rating-dialog').close());
$('swap-content').addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.id==='skip-stop'){
   removePlan(activeSwap);$('swap-dialog').close();return;
 }
 const place=livePlaces.get(button.dataset.replace);
 if(!place||!activeSwap)return;
 const index=state.plan.findIndex(p=>p.id===activeSwap);
 if(index<0)return;
 state.plan[index]={...place};save();$('swap-dialog').close();renderPlaces();renderItinerary();notify('已换成 '+place.title);
});
$('rating-form').addEventListener('submit',event=>{
 event.preventDefault();if(!activeRating)return;
 const form=new FormData(event.target);
 const values=metrics.map((_,i)=>form.get('rate'+i)?Number(form.get('rate'+i)):null);
 if(values.some(v=>v!=null))state.ratings[activeRating]=values;
 else delete state.ratings[activeRating];
 if(draftEvidence)state.evidence[activeRating]=draftEvidence;
 else delete state.evidence[activeRating];
 save();$('rating-dialog').close();renderPlaces();notify('三项评分已保存');
});
async function init(){
 $('trip-date').value=state.date;$('trip-time').value=state.time;
 if(state.stay){
   $('stay-name').value=state.stay.title;$('stay-coords').value=state.stay.lat+', '+state.stay.lon;$('stay-details').open=true;
 }
 renderStops();
 const mapAsset=timedJSON('./map.json',5000).then(data=>{mapBoundaries=data;drawMap();}).catch(()=>{});
 const routeAsset=timedJSON('./initial-route.json',5000).then(data=>routeStore.set(routeKey(defaultStops.map(city)),data)).catch(()=>{});
 const catalogAsset=timedJSON('./places.json',5000).then(async data=>{await mapAsset;addDiscoveredPlaces(data);}).catch(()=>{});
 renderAll();
 await Promise.all([mapAsset,routeAsset]);
 await catalogAsset;
 void calculate();
}


const aspects=[
 {name:/\b(food|taste|dish|meal|rice|noodles?|laksa|chicken|cake|cendol|coconut|drink|makan(?:an)?|rasa|nasi)\b|食物|味道|口味|菜|饭|蛋糕|冰沙|煎蕊|叻沙|凤梨挞/iu,
  good:/\b(delicious|tasty|flavourful|flavorful|fresh|sedap|enak|good|great)\b|好吃|好喝|美味|鲜美|新鲜|好味|香浓/iu,
  bad:/\b(not (?:good|tasty|fresh)|bad|bland|stale|cold|undercooked|tasteless|hambar|tak sedap|tidak sedap|masin)\b|不好吃|难吃|没味|无味|太咸|不新鲜|变质|太油/iu},
 {name:/\b(hygiene|cleanliness|clean|dirty|filthy|cockroach(?:es)?|flies|table|toilet|bersih|kotor|kebersihan)\b|卫生|干净|邋遢|蟑螂|苍蝇|桌子|厕所|脏/iu,
  good:/\b(clean|spotless|tidy|good|bersih)\b|干净|整洁|卫生很好/iu,
  bad:/\b(not clean|dirty|filthy|cockroach(?:es)?|flies|kotor|tidak bersih|tak bersih)\b|不干净|不卫生|很脏|肮脏|蟑螂|苍蝇/iu},
 {name:/\b(service|staff|server|waiter|waitress|wait(?:ed|ing)?|layanan|pelayan|khidmat|mesra)\b|服务|店员|老板|员工|等太久/iu,
  good:/\b(friendly|kind|helpful|polite|quick|fast|great|good|mesra|cepat|baik)\b|热情|友善|有礼|迅速|亲切|态度好|上菜快/iu,
  bad:/\b(not (?:friendly|helpful|good)|rude|slow|unhelpful|terrible|kasar|lambat|kurang mesra)\b|没礼貌|态度差|等太久|慢|不友善|不耐烦|不热情/iu}
];
function scoreReviewText(text){
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,100);
 return aspects.map(aspect=>{
   let positive=0,negative=0;
   for(const line of lines){
     let yes=false,no=false;
     for(const phrase of line.split(/[。！？!?；;，,\n]|(?:\bbut\b|\btetapi\b|但是|不过)/iu)){
       if(!aspect.name.test(phrase))continue;
       if(aspect.bad.test(phrase))no=true;
       else if(aspect.good.test(phrase))yes=true;
     }
     if(yes&&!no)positive++;
     if(no&&!yes)negative++;
   }
   const n=positive+negative;
   return {positive,negative,score:n>=2?Math.round((1+4*positive/n)*10)/10:null};
 });
}
function describeEvidence(evidence){
 return evidence?.map((r,i)=>metrics[i]+' '+(r.score==null?'资料不足':'约 '+r.score.toFixed(1)+' 星')+'（'+r.positive+' 正面 / '+r.negative+' 负面）').join(' · ')||'';
}
let draftEvidence;
function initRatingExtras(id){
 draftEvidence=state.evidence[id]||null;
 $('review-text').value='';
 $('review-result').textContent=describeEvidence(draftEvidence);
}
$('analyze-review').addEventListener('click',()=>{
 const input=$('review-text').value.trim();
 if(!input){$('review-result').textContent='请先在上方贴入评论。';return;}
 draftEvidence=scoreReviewText(input);
 $('review-result').textContent=describeEvidence(draftEvidence);
});
$('clear-reviews').addEventListener('click',()=>{
 draftEvidence=null;$('review-text').value='';$('review-result').textContent='已清除，按保存后生效。';
});
const malaysiaPlaceCache=new Map();
async function lookupMalaysia(name){
 const query=name.replace(/\bkl\b/gi,'Kuala Lumpur').trim();
 const key=query.toLowerCase();
 if(!malaysiaPlaceCache.has(key)){
   const params=new URLSearchParams({q:query,bbox:'99.25,0.8,120,7.8',limit:'6'});
   malaysiaPlaceCache.set(key,timedJSON('https://photon.komoot.io/api/?'+params,8500)
     .then(json=>(json.features||[]).filter(f=>f.properties?.countrycode?.toUpperCase()==='MY'&&f.geometry?.type==='Point'))
     .catch(error=>{malaysiaPlaceCache.delete(key);throw error;}));
 }
 return malaysiaPlaceCache.get(key);
}
function knownStopMatches(name){
 const terms=name.toLowerCase().replace(/\bkl\b/g,'kuala lumpur').split(/\s+/).filter(Boolean);
 return cities.filter(p=>{
   const label=(makePointWords(p)+' '+(p.area==='kl'?'Kuala Lumpur 吉隆坡':'')).toLowerCase();
   return terms.every(term=>label.includes(term));
 }).slice(0,6);
}
let stopIndex=null,stopResults=[],stopSearchToken=0;
function openStopSearch(index){
 stopIndex=index;stopResults=[];++stopSearchToken;
 $('stop-query').value='';$('stop-results').innerHTML='';
 $('stop-search').showModal();$('stop-query').focus();
}
function makeCustomStop(lat,lon,title,en=''){
 const area=findArea({lat,lon});
 if(!area)return null;
 return {id:'custom-'+lat.toFixed(5)+','+lon.toFixed(5),title,en,lat,lon,area,east:region(area).east};
}
function renderStopResults(items){
 stopResults=items;
 $('stop-results').innerHTML=items.length?items.map((p,i)=>
   '<button type="button" class="stay-result" data-stop-result="'+i+'"><strong>'+safe(makePointWords(p))+'</strong><span>'+safe(region(p.area)?.title||'')+'</span></button>').join(''):
   '<p class="fine">没有找到地点。可加上城市名称，或输入坐标。</p>';
}
$('close-stop-search').addEventListener('click',()=>$('stop-search').close());
$('stop-search').addEventListener('close',()=>{++stopSearchToken;stopIndex=null;});
$('stop-search-form').addEventListener('submit',async event=>{
 event.preventDefault();
 const name=$('stop-query').value.trim();
 if(!name)return;
 const token=++stopSearchToken;
 const local=knownStopMatches(name),coords=parseCoordinates(name);
 if(local.length||coords){
   renderStopResults(coords?[makeCustomStop(coords.lat,coords.lon,'地图坐标',coords.lat+', '+coords.lon)].filter(Boolean):local);
   return;
 }
 $('stop-results').textContent='正在查找地点…';
 try{
   const features=await lookupMalaysia(name);
   if(token!==stopSearchToken)return;
   renderStopResults(features.map(f=>{
     const [lon,lat]=f.geometry.coordinates,p=f.properties;
     if(!Number.isFinite(lon)||!Number.isFinite(lat))return null;
     return makeCustomStop(lat,lon,p.name||p.street||name,[p.district,p.city].filter((part,i,parts)=>part&&part!==(p.name||p.street)&&parts.indexOf(part)===i).join(', '));
   }).filter(Boolean));
 }catch{if(token===stopSearchToken)$('stop-results').textContent='暂时无法查找地点。可选已有城市，或直接输入坐标。';}
});
$('stop-results').addEventListener('click',event=>{
 const button=event.target.closest('[data-stop-result]');
 if(!button||stopIndex===null)return;
 const selected=stopResults[Number(button.dataset.stopResult)];
 if(!selected)return;
 if(selected.id.startsWith('custom-'))customStops.set(selected.id,selected);
 const index=stopIndex;
 draft[index]=selected.id;$('stop-search').close();renderStops();
 $('stops').querySelector('[data-stop="'+index+'"]')?.focus();
 routeMessage('已选择 '+selected.title+'。点击「计算路线」更新。');
});
let stayOptions=[];
$('lookup-stay').addEventListener('click',async()=>{
 const name=$('stay-name').value.trim();
 if(name.length<3){$('stay-results').textContent='请在「住宿名称」输入至少三个字。';$('stay-name').focus();return;}
 $('stay-results').textContent='正在查找住宿…';
 $('lookup-stay').disabled=true;
 try{
   stayOptions=await lookupMalaysia(name);
   $('stay-results').innerHTML=stayOptions.length?stayOptions.map((f,i)=>{
     const p=f.properties;
     return '<button class="stay-result" type="button" data-result="'+i+'"><strong>'+safe(p.name||p.street||name)+'</strong><span>'+safe([p.housenumber,p.street,p.city,p.state].filter(Boolean).join(' · '))+'</span></button>';
   }).join(''):'没有找到。可换名称，或直接贴地图坐标。';
 }catch{$('stay-results').textContent='住宿查找暂不可用。仍可直接贴地图坐标。';}
 finally{$('lookup-stay').disabled=false;}
});
$('stay-results').addEventListener('click',event=>{
 const button=event.target.closest('[data-result]');if(!button)return;
 const option=stayOptions[Number(button.dataset.result)];
 if(!option)return;
 const [lon,lat]=option.geometry.coordinates;
 $('stay-coords').value=lat.toFixed(6)+', '+lon.toFixed(6);
 $('stay-name').value=option.properties.name||$('stay-name').value;
 $('stay-results').textContent='已选住宿。点击「计算路线」更新。';
});
if(typeof globalThis.tripGeoTest==='object')globalThis.tripGeoTest.scoreReviewText=scoreReviewText;

void init();
