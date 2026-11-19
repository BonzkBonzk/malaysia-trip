// Detailed street map (MapLibre GL + OpenFreeMap vector tiles).
// Loaded after app.js and takes over the map functions it defines; if MapLibre
// cannot load (offline, no WebGL), the original canvas map keeps working.
(function(){
 if(!window.maplibregl||(maplibregl.supported&&!maplibregl.supported()))return;
 const SCOPES={all:[[99.3,.6],[119.9,7.6]],west:[[99.35,1.15],[104.65,6.95]],east:[[109.25,.65],[119.8,7.55]]};
 const stage=$('map-stage');
 const box=document.createElement('div');
 box.id='gl-map';box.className='gl-map';
 stage.prepend(box);
 $('map').style.display='none';$('map-pins').style.display='none';
 stage.classList.add('gl-ready');

 const gl=new maplibregl.Map({
   container:box,style:'https://tiles.openfreemap.org/styles/liberty',
   bounds:SCOPES.all,fitBoundsOptions:{padding:16},maxBounds:[[94,-4],[125,12]],
   attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false
 });
 gl.touchZoomRotate.disableRotation();
 gl.addControl(new maplibregl.GeolocateControl({positionOptions:{enableHighAccuracy:true},trackUserLocation:true,showUserLocation:true}),'bottom-right');
 let ready=false,lastArea=null,stopMarkers=[],placeMarkers=[];

 const toFeatureCollection=()=>({type:'FeatureCollection',features:mapBoundaries.map(([name,polygons])=>({
   type:'Feature',properties:{id:featureNames[name]||''},geometry:{type:'MultiPolygon',coordinates:polygons}}))});
 const routeFeature=()=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:(route?.coordinates||[]).map(p=>[p.lon,p.lat])}});
 const boundsOf=list=>{
   if(!list.length)return null;
   let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
   for(const p of list){a=Math.min(a,p.lon);b=Math.min(b,p.lat);c=Math.max(c,p.lon);d=Math.max(d,p.lat);}
   return [[a,b],[c,d]];
 };
 const fit=(bounds,maxZoom=13)=>bounds&&gl.fitBounds(bounds,{padding:{top:40,bottom:30,left:30,right:30},maxZoom,duration:700});

 gl.on('load',()=>{
   ready=true;
   gl.addSource('states',{type:'geojson',data:toFeatureCollection()});
   gl.addLayer({id:'state-selected',type:'fill',source:'states',filter:['==',['get','id'],''],paint:{'fill-color':'#0f766e','fill-opacity':.08}});
   gl.addLayer({id:'state-outline',type:'line',source:'states',paint:{'line-color':'#2f6f62','line-width':['case',['==',['get','id'],''],2.2,.6],'line-opacity':.55}});
   gl.addSource('route',{type:'geojson',data:routeFeature()});
   gl.addLayer({id:'route-casing',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffffff','line-width':8}});
   gl.addLayer({id:'route-line',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#0f5c4c','line-width':4.5}});
   drawMap();
   if(points.length&&route)fitMapToRoute();
 });
 // Click empty map at country/state zoom to explore that state.
 gl.on('click',event=>{
   if(gl.getZoom()>8.5||!mapBoundaries.length)return;
   const p={lon:event.lngLat.lng,lat:event.lngLat.lat};
   const hit=mapBoundaries.find(([,polys])=>polys.some(poly=>inRing(p,poly[0])&&!poly.slice(1).some(h=>inRing(p,h))));
   const id=hit&&featureNames[hit[0]];
   if(id)mapSelectArea(id,true);
 });

 function marker(html,cls,lngLat,onClick,title){
   const el=document.createElement('button');
   el.type='button';el.className=cls;el.innerHTML=html;if(title)el.title=title;
   if(onClick)el.addEventListener('click',e=>{e.stopPropagation();onClick();});
   return new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat(lngLat).addTo(gl);
 }
 function areaBounds(area){
   if(region(area)){const b=stateBounds(area);return b&&[[b[0],b[1]],[b[2],b[3]]];}
   if(zoneLabels.has(area))return boundsOf([...livePlaces.values()].filter(p=>p.zone===area));
   return null;
 }

 window.drawMap=function(){
   if(!ready)return;
   gl.getSource('states')?.setData(toFeatureCollection());
   const sel=region(state.area)?state.area:areaState(state.area)||'';
   gl.setFilter('state-selected',['==',['get','id'],sel]);
   gl.setPaintProperty('state-outline','line-width',['case',['==',['get','id'],sel],2.2,.6]);
   gl.getSource('route')?.setData(routeFeature());
   // numbered route stops
   stopMarkers.forEach(m=>m.remove());
   stopMarkers=points.map((p,i)=>marker('<b>'+(i+1)+'</b><span>'+safe(p.title)+'</span>','gl-stop',[p.lon,p.lat],null,makePointWords(p)));
   // the places currently listed below the map
   placeMarkers.forEach(m=>m.remove());
   const list=(state.area==='route'&&!hasRoute())?[]:getResults().slice(0,60);
   placeMarkers=list.map(({p})=>marker('<span>'+safe(p.title)+'</span>','gl-place '+p.category+(p.recommend===true?' pick':''),[p.lon,p.lat],
     ()=>new maplibregl.Popup({offset:18,closeButton:false}).setLngLat([p.lon,p.lat]).setHTML('<strong>'+safe(p.title)+'</strong><br><small>'+safe(p.tag||categoryNames[p.category]||'')+'</small>').addTo(gl),p.title));
   // fly to a newly chosen state / zone
   if(state.area!==lastArea){
     const prev=lastArea;lastArea=state.area;
     if(prev!==null&&state.area!=='route')fit(areaBounds(state.area),zoneLabels.has(state.area)?15:11);
   }
   const legend=$('state-legend');
   legend.innerHTML=regions.filter(r=>mapScope==='all'||r.east===(mapScope==='east')).map(r=>
     '<button type="button" data-legend-area="'+r.id+'" aria-pressed="'+String(state.area===r.id)+'"><span aria-hidden="true" style="background:'+stateColors[r.id]+'"></span>'+safe(r.title)+'</button>').join('');
   $('map-caption').textContent='滚轮或双指缩放 · 放大看马路和建筑 · 点地图上的店名看名称';
 };
 window.setMapScope=function(scope,focus=null){
   const scopeChanged=mapScope!==scope;
   mapScope=scope;focusedRegion=focus;fitBox=null;
   document.querySelectorAll('[data-region]').forEach(b=>{const on=b.dataset.region===scope;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
   if(scopeChanged&&$('stops').children.length)renderStops();
   if(ready){const fb=focus&&stateBounds(focus);fit(fb?[[fb[0],fb[1]],[fb[2],fb[3]]]:SCOPES[scope],11);}
   drawMap();
 };
 window.fitMapToRoute=function(){
   if(!ready)return;
   fit(boundsOf([...points,...(route?.coordinates||[])]),14);
   drawMap();
 };
 window.zoom=step=>ready&&gl.zoomTo(gl.getZoom()+Math.log2(step),{duration:250});
 window.zoomAt=(x,y,step)=>window.zoom(step);
 // Keep the map markers in step with the list (category tab, filters, more results).
 const listRender=window.renderPlaces;
 let markerTimer=0;
 window.renderPlaces=function(){listRender();clearTimeout(markerTimer);markerTimer=setTimeout(()=>window.drawMap(),60);};
 new ResizeObserver(()=>gl.resize()).observe(stage);
 window.tripGL=gl;
})();
