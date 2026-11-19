// 「现在出发」live trip mode: GPS position → ETA for every remaining stop,
// plus quick "add a restaurant on the way" and "find fuel ahead" helpers.
// Runs only while the page is open; it catches up when the page comes back.
(function(){
 const KEY='malaysia-trip-live';
 let live=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch{return {};}})();
 let here=null,geoNote='',watchId=null,liveRoute=null,ahead=[],eta=[],busy=false,lastCalc=0,lastPos=null,drawer='',drawerHtml='',timer=0;
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(live));}catch{}};
 const clock=d=>clockParts.format(d);
 const mins=ms=>Math.max(0,Math.round(ms/60000));

 const panel=document.createElement('div');panel.id='live-trip';panel.className='live-trip';
 document.querySelector('.itinerary-panel').prepend(panel);
 const bar=document.createElement('div');bar.id='live-bar';bar.className='live-bar';bar.hidden=true;
 document.body.append(bar);

 function stopsAhead(){
   const done=new Set(live.done||[]);
   return planEvents().filter((e,i)=>i>0&&e.p&&!e.p.sample&&e.minute!==undefined&&!done.has(eventKey(e))&&(e.type==='city'||e.minute!==null))
     .map(e=>({key:eventKey(e),p:e.p,type:e.type,dwell:e.type==='city'?(e.i===points.length-1?0:Number(e.dwell)||0):Number(e.p.duration)||0}));
 }
 async function recalc(force=false){
   if(!live.active||busy)return;
   if(!force&&Date.now()-lastCalc<45000&&lastPos&&here&&straight(lastPos,here)<.3)return;
   ahead=stopsAhead();
   if(!ahead.length){liveRoute=null;eta=[];render();return;}
   const origin=here||points[0];
   busy=true;render();
   try{
     const wps=[{...origin,title:'现在位置'},...ahead.slice(0,9).map(s=>s.p)];
     const raw=await requestRoad(wps,true);
     liveRoute=normalizeRoute(raw,wps);
     let t=Date.now();
     eta=liveRoute.legs.map((leg,i)=>{t+=leg.min*60000;const arrive=new Date(t);t+=ahead[i].dwell*60000;return {arrive,km:leg.km,min:leg.min};});
     lastCalc=Date.now();lastPos=here&&{...here};
   }catch{geoNote=(geoNote?geoNote+' · ':'')+'暂时算不到道路时间，稍后自动再试。';}
   finally{busy=false;render();}
 }
 function startWatch(){
   if(!navigator.geolocation){geoNote='这个浏览器不支持定位，按起点估算。';return;}
   watchId=navigator.geolocation.watchPosition(pos=>{
     here={lat:pos.coords.latitude,lon:pos.coords.longitude};
     geoNote='定位准确度约 '+Math.round(pos.coords.accuracy)+' 米';
     recalc();
   },err=>{geoNote=err.code===1?'没有定位权限：按路线起点估算。可在浏览器设定允许定位。':'暂时取不到定位，按路线起点估算。';here=null;recalc(true);},
   {enableHighAccuracy:true,maximumAge:15000,timeout:20000});
 }
 function start(){
   if(points.length<2){notify('请先计算路线');return;}
   const now=new Date();
   live={active:true,startedAt:Date.now(),done:[]};persist();
   state.date=dateParts.format(now);state.time=clock(now);
   $('trip-date').value=state.date;$('trip-time').value=state.time;save();renderItinerary();
   drawer='';startWatch();recalc(true);
   timer=setInterval(()=>{if(!document.hidden)recalc();},60000);
   panel.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function stop(){
   live={};persist();if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;clearInterval(timer);
   liveRoute=null;eta=[];drawer='';render();
 }
 function bestMatch(p){
   const ms=liveRoute?matches(liveRoute,p):[];
   return ms.reduce((b,m)=>!b||m.distance<b.distance?m:b,null);
 }
 function dwellBeforeLeg(leg){let d=0;for(let i=0;i<leg;i++)d+=ahead[i]?.dwell||0;return d;}
 async function loadNearby(){
   const origin=here||points[0];
   const samples=[origin,...(liveRoute?.coordinates||[]).filter((_,i,a)=>i%Math.max(1,Math.floor(a.length/4))===0).slice(1,4)];
   try{const r=await mapPlaceTiles(samples,true);addDiscoveredPlaces(r.places);}catch{}
 }
 async function suggestFood(){
   drawer='food';drawerHtml='<p class="fine">正在找前方路线附近的餐厅…</p>';render();
   await loadNearby();
   if(!liveRoute){drawerHtml='<p class="fine">要先算出前方路线才能找沿路餐厅。</p>';render();return;}
   const inPlan=new Set(state.plan.map(p=>p.id));
   const rows=[...livePlaces.values()].filter(p=>p.category==='food'&&!p.sample&&!inPlan.has(p.id)&&p.recommend!==false).map(p=>{
     const m=bestMatch(p);if(!m)return null;
     const pick=p.recommend===true;
     if(m.distance>(pick?8:2.5))return null;
     const arrive=new Date(Date.now()+(m.fromStart+dwellBeforeLeg(m.leg))*60000);
     return {p,m,pick,arrive,open:opening(p.hours,arrive),detour:Math.round(m.distance*2/30*60)};
   }).filter(Boolean).filter(r=>r.open!==false)
     .sort((a,b)=>(b.pick-a.pick)||(a.m.progress-b.m.progress)).slice(0,8);
   drawerHtml=rows.length?'<ul class="live-suggest">'+rows.map(r=>'<li><div><strong>'+safe(r.p.title)+'</strong>'+(r.pick?' <span class="tag caveat">推荐</span>':' <span class="tag">未核实</span>')+
     '<small>'+safe(clock(r.arrive))+' 左右到 · 离路线约 '+safe(km(r.m.distance))+(r.detour?' · 绕路约 '+r.detour+' 分钟':'')+(r.open===true?' · 到时营业':r.p.hours?'':' · 营业时间待核对')+'</small>'+
     (r.p.mustEat?'<small>必吃：'+safe(r.p.mustEat.map(x=>x.name).slice(0,3).join('、'))+'</small>':'')+
     '</div><button type="button" class="primary" data-live-add="'+safe(r.p.id)+'">加入</button></li>').join('')+'</ul>'
     :'<p class="fine">前方路线附近暂时没有找到合适的餐厅。推荐资料还在补充中，可在 Google Maps 搜附近餐厅。</p>';
   const o=here||points[0];
   drawerHtml+=externalLink('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('restaurants near '+o.lat.toFixed(5)+','+o.lon.toFixed(5)),'在 Google Maps 找附近餐厅','live-link');
   render();
 }
 async function suggestFuel(){
   drawer='fuel';drawerHtml='<p class="fine">正在找前方油站…</p>';render();
   await loadNearby();
   const o=here||points[0];
   const rows=[...livePlaces.values()].filter(p=>p.category==='fuel').map(p=>{
     const m=bestMatch(p);
     const onRoute=m&&m.distance<=2;
     const dist=onRoute?m.progress+m.distance:straight(o,p)*1.3;
     const min=onRoute?m.fromStart+dwellBeforeLeg(m.leg):dist/50*60;
     return {p,ahead:onRoute,dist,min};
   }).filter(r=>r.dist<=60).sort((a,b)=>(b.ahead-a.ahead)||(a.dist-b.dist)).slice(0,6);
   drawerHtml=(rows.length?'<ul class="live-suggest">'+rows.map(r=>'<li><div><strong>'+safe(r.p.title)+'</strong>'+(r.ahead?' <span class="tag soft">在路线上</span>':'')+
     '<small>约 '+safe(km(r.dist))+' · '+safe(timeText(r.min))+'后到</small></div>'+externalLink(googleDirections([r.p],{fromHere:true}),'导航','primary-link')+'</li>').join('')+'</ul>'
     :'<p class="fine">附近资料里没有找到油站。</p>')+
     externalLink('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('petrol station near '+o.lat.toFixed(5)+','+o.lon.toFixed(5)),'在 Google Maps 找附近油站','live-link');
   render();
 }
 function render(){
   const active=Boolean(live.active);
   document.body.classList.toggle('live-on',active);
   if(!active){
     const ok=points.length>=2;
     panel.innerHTML='<button type="button" class="primary live-start" data-live="start"'+(ok?'':' disabled')+'>▶ 现在出发</button>'+
       '<p class="fine">'+(ok?'按下后用手机定位，实时算出到每一站的时间。开着网页才会更新。':'先在上方计算路线，再按现在出发。')+'</p>';
     bar.hidden=true;return;
   }
   const next=ahead[0],ne=eta[0];
   const started=mins(Date.now()-live.startedAt);
   let html='<div class="live-head"><strong>行程进行中</strong><span>已出发 '+safe(timeText(started))+'</span><button type="button" class="text-button" data-live="stop">结束行程</button></div>'+
     '<p class="fine">'+safe(busy?'正在更新时间…':geoNote||'正在取得定位…')+'</p>';
   if(!next)html+='<p class="live-next">全部停留点都已完成 🎉</p>';
   else{
     html+='<div class="live-next"><small>下一站</small><strong>'+safe(next.p.title)+'</strong>'+
       (ne?'<span>预计 <b>'+safe(clock(ne.arrive))+'</b> 到 · 还有 '+safe(km(ne.km))+' · '+safe(timeText(ne.min))+'</span>':'<span>计算中…</span>')+
       '<div class="live-actions">'+externalLink(googleDirections([next.p],{fromHere:true}),'导航到这里','primary-link')+
       '<button type="button" class="text-button" data-live="arrived">已到达 ✓</button></div></div>';
   }
   html+='<div class="live-tools"><button type="button" data-live="food" aria-pressed="'+(drawer==='food')+'">🍜 加餐厅</button><button type="button" data-live="fuel" aria-pressed="'+(drawer==='fuel')+'">⛽ 要加油</button></div>';
   if(drawer)html+='<div class="live-drawer">'+drawerHtml+'</div>';
   if(ahead.length>1){
     html+='<ol class="live-list">'+ahead.slice(1).map((s,i)=>{
       const e=eta[i+1];const open=e&&s.p.hours?opening(s.p.hours,e.arrive):null;
       return '<li><time>'+(e?safe(clock(e.arrive)):'—')+'</time><span>'+safe(s.p.title)+(open===false?' <em class="warn">到时未营业</em>':'')+'</span></li>';
     }).join('')+'</ol>';
   }
   panel.innerHTML=html;
   bar.hidden=false;
   bar.innerHTML='<button type="button" class="live-bar-main" data-live="show"><small>下一站</small><strong>'+safe(next?next.p.title:'已完成')+'</strong>'+(ne?'<span>'+safe(clock(ne.arrive))+' 到</span>':'')+'</button>'+
     '<button type="button" data-live="food">🍜</button><button type="button" data-live="fuel">⛽</button>';
 }
 document.addEventListener('click',event=>{
   const b=event.target.closest('[data-live],[data-live-add]');if(!b)return;
   if(b.dataset.liveAdd){addToPlan(b.dataset.liveAdd);drawer='';recalc(true);return;}
   const a=b.dataset.live;
   if(a==='start')start();
   else if(a==='stop')stop();
   else if(a==='arrived'&&ahead[0]){live.done=[...(live.done||[]),ahead[0].key];persist();drawer='';recalc(true);}
   else if(a==='food'){if(drawer==='food'&&b.closest('#live-trip')){drawer='';render();}else{panel.scrollIntoView({behavior:'smooth',block:'start'});suggestFood();}}
   else if(a==='fuel'){if(drawer==='fuel'&&b.closest('#live-trip')){drawer='';render();}else{panel.scrollIntoView({behavior:'smooth',block:'start'});suggestFuel();}}
   else if(a==='show')panel.scrollIntoView({behavior:'smooth',block:'start'});
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)recalc(true);});
 // keep the start button in step with route changes
 const original=window.renderItinerary;
 window.renderItinerary=function(){original();if(!live.active)render();};
 render();
 if(live.active){startWatch();setTimeout(()=>recalc(true),1500);timer=setInterval(()=>{if(!document.hidden)recalc();},60000);}
})();
