// Tourism and venue sources describe the places. Tripadvisor values are dated snapshots.
const attractionZones = {
 kl: [
  ['klcc','KLCC'],['bukit-bintang','武吉免登 · Bukit Bintang'],['chinatown','茨厂街与中央艺术坊'],['merdeka','独立广场与市中心'],['perdana','湖滨公园与博物馆区'],
  ['kampung-baru','甘榜峇鲁 · Kampung Baru'],['titiwangsa','蒂蒂旺沙 · Titiwangsa'],['setapak','文良港 · Setapak'],
  ['brickfields','十五碑与天后宫'],['kepong','甲洞 · Kepong'],['desa-parkcity','Desa ParkCity'],['ttdi','TTDI 与武吉加拉'],['bukit-jalil','武吉加里尔 · Bukit Jalil'],['cheras','蕉赖 · Cheras']
 ],
 sel: [
  ['petaling','Petaling · PJ／梳邦／莎阿南部分'],['gombak','Gombak · 黑风洞／Rawang'],['klang','Klang · 巴生／巴生港'],
  ['kuala-selangor','Kuala Selangor · 瓜雪'],['sabak-bernam','Sabak Bernam · 适耕庄'],['hulu-selangor','Hulu Selangor · 新古毛／Serendah'],
  ['hulu-langat','Hulu Langat · 加影／Semenyih'],['kuala-langat','Kuala Langat · 万津／摩立'],['sepang','Sepang · 雪邦／Cyberjaya']
 ]
};
const zoneLabels = new Map(Object.entries(attractionZones).flatMap(([state,zones])=>zones.map(([id,label])=>[state+':'+id,label])));
const attractionSources = {
 kl:'https://www.malaysia.travel/explore/top-places-to-visit-in-kuala-lumpur',
 guide:'https://ebrochures.tourismmalaysia.app/malaysia-travel-guide/06-malaysia-travel-guide-kuala-lumpur/',
 gombak:'https://selangor.travel/discover-gombak/',
 petaling:'https://www.visitselangor.com/topic/petaling/',
 klang:'https://selangor.travel/about-selangor/',
 'kuala-selangor':'https://selangor.travel/discover-kuala-selangor/',
 'sabak-bernam':'https://selangor.travel/discover-sabak-bernam/',
 'hulu-selangor':'https://selangor.travel/discover-hulu-selangor/',
 'hulu-langat':'https://selangor.travel/discover-hulu-langat/',
 'kuala-langat':'https://selangor.travel/discover-kuala-langat/',
 sepang:'https://selangor.travel/discover-sepang/'
};
const klReview = 'https://www.tripadvisor.com.my/Attractions-g298570-Activities';
const selReview = 'https://www.tripadvisor.com.my/Attractions-g298310-Activities';
const klSuffix = '-Kuala_Lumpur_Wilayah_Persekutuan.html';
const reviewSources = {
 kl:klReview+klSuffix, landmarks:klReview+'-c47'+klSuffix, parks:klReview+'-c57'+klSuffix, museums:klReview+'-c49'+klSuffix,
 sel:selReview+'-Selangor.html', selParks:selReview+'-c57-Selangor.html', selBeaches:selReview+'-c61-t52-Selangor.html', selTheme:selReview+'-c52-t98-Selangor.html',
 selGuide:'https://www.tripadvisor.com.my/Tourism-g298310-Selangor-Vacations.html',
 waterfalls:'https://www.tripadvisor.com/Attractions-g293951-Activities-c57-t95-Malaysia.html',
 sekinchan:'https://www.tripadvisor.com/Attractions-g2050021-Activities-Sekinchan_Selangor.html',
 klang:'https://www.tripadvisor.com.my/Attractions-g1022648-Activities-Klang_Selangor.html',
 jugra:'https://www.tripadvisor.com.my/Tourism-g15246183-Jugra_Kuala_Langat_District_Selangor-Vacations.html',
 carey:'https://www.tripadvisor.com/Tourism-g10432972-Pulau_Indah_Selangor-Vacations.html',
 kwaiChaiHong:'https://www.tripadvisor.com/Attraction_Review-g298570-d18753541-Reviews-Kwai_Chai_Hong-Kuala_Lumpur_Wilayah_Persekutuan.html',
 titiwangsa:'https://www.tripadvisor.com/Attraction_Review-g298570-d455035-Reviews-Taman_Tasik_Titiwangsa-Kuala_Lumpur_Wilayah_Persekutuan.html',
 tugu:'https://www.tripadvisor.com/Attraction_Review-g298570-d15743601-Reviews-Taman_Tugu_Malaysia-Kuala_Lumpur_Wilayah_Persekutuan.html',
 rexkl:'https://www.tripadvisor.com/Attraction_Review-g298570-d20105546-Reviews-REXKL-Kuala_Lumpur_Wilayah_Persekutuan.html',
 merdeka:'https://www.tripadvisor.com/Attractions-g298569-Activities-Wilayah_Persekutuan.html',
 saloma:'https://www.tripadvisor.com/Attractions-g298570-Activities-c47-t5-Kuala_Lumpur_Wilayah_Persekutuan.html',
 nationalArt:'https://www.tripadvisor.com/Attractions-g298570-Activities-c49-t161-Kuala_Lumpur_Wilayah_Persekutuan.html',
 cyberjaya:'https://www.tripadvisor.com/Attractions-g298312-Activities-c57-Cyberjaya_Sepang_District_Selangor.html',
 river:'https://www.tripadvisor.com/Attractions-g306997-Activities-c55-Melaka_Central_Melaka_District_Melaka_State.html',
 kepong:'https://www.tripadvisor.com/Attractions-g298570-Activities-c57-t162-Kuala_Lumpur_Wilayah_Persekutuan.html'
};
// [id, Maps name, neighborhood, lat, lon, category, visit minutes, description, source, score/count/source, landmark]
const capitalAttractions = [
 ['petronas-towers','Petronas Twin Towers','klcc',3.1579,101.7117,'地标',90,'双峰塔观景台与空中桥。上塔建议先查官方票务。','https://www.petronastwintowers.com.my/',[4.4,30776,'kl'],true],
 ['klcc-park','KLCC Park','klcc',3.1547,101.7134,'公园',60,'双峰塔旁的城市公园，适合散步和拍城市天际线。','kl',[4.3,13262,'kl'],true],
 ['aquaria-klcc','Aquaria KLCC','klcc',3.1537,101.7132,'水族馆',95,'在 Kuala Lumpur Convention Centre 下层，可和 KLCC 公园同游。','https://aquariaklcc.com/',[4.1,6323,'kl']],
 ['jalan-alor','Jalan Alor Food Street','bukit-bintang',3.1451,101.7089,'美食街',60,'武吉免登夜间食街。评分对应整条街，摊位各有差别。','guide',[4.0,7706,'landmarks'],true],
 ['pavilion-kl','Pavilion Kuala Lumpur','bukit-bintang',3.1490,101.7132,'购物',90,'在 Jalan Bukit Bintang，可与柏威年附近的步行街区一起逛。','https://www.pavilion-kl.com/',[4.4,4244,'kl']],
 ['central-market','Central Market Kuala Lumpur','chinatown',3.1453,101.6953,'市集',60,'Pasar Seni 手工艺品市场，可步行去茨厂街。','https://centralmarket.com.my/',[3.9,5105,'landmarks'],true],
 ['petaling-street','Petaling Street Market','chinatown',3.1442,101.6971,'街区',60,'茨厂街市场区，和中央艺术坊是不同地点。','guide',[3.6,11736,'landmarks'],true],
 ['kwai-chai-hong','Kwai Chai Hong','chinatown',3.1417,101.6976,'街巷',35,'茨厂街后方的壁画小巷，适合串游。','guide',[4.2,33,'kwaiChaiHong']],
 ['rexkl','REXKL','chinatown',3.1454,101.6983,'文化空间',50,'旧戏院改造的文化空间，查活动日历再决定是否专程前往。','https://www.rexkl.com/',[4.5,20,'rexkl']],
 ['merdeka-square','Dataran Merdeka','merdeka',3.1486,101.6936,'历史广场',45,'独立广场，可从广场看苏丹阿都沙末大厦外观。','guide',[3.9,1619,'merdeka'],true],
 ['kl-tower','KL Tower','merdeka',3.1528,101.7038,'观景塔',75,'武吉咖啡山的观景塔，出发前查当日开放及票种。','kl',[4.1,8826,'landmarks'],true],
 ['kl-forest-eco','KL Forest Eco Park','merdeka',3.1516,101.7021,'森林公园',65,'武吉纳纳森林和空中步道。开放入口与门票可先核实。','kl'],
 ['perdana-garden','Perdana Botanical Garden','perdana',3.1437,101.6852,'植物园',75,'湖滨公园区的植物园，可和附近博物馆搭配。','kl',[4.2,1422,'parks']],
 ['kl-bird-park','Kuala Lumpur Bird Park','perdana',3.1439,101.6883,'飞禽公园',120,'湖滨公园区的付费景点。可与植物园分别安排时间。','https://www.klbirdpark.com/',[4.2,8113,'parks']],
 ['islamic-arts-kl','Islamic Arts Museum Malaysia','perdana',3.1418,101.6894,'博物馆',100,'馆内收藏书法、建筑模型与不同地区的伊斯兰艺术。','https://iamm.org.my/',[4.5,3572,'museums'],true],
 ['national-museum-kl','Muzium Negara','perdana',3.1379,101.6870,'博物馆',90,'国家博物馆，步行可到 MRT Muzium Negara。','https://www.muziumnegara.gov.my/',[4.1,1151,'museums']],
 ['taman-tugu','Taman Tugu','perdana',3.1517,101.6848,'林间步道',75,'市区森林步道。出发前看官网地图及开放情况。','kl',[4.8,43,'tugu']],
 ['saloma-link','Saloma Link','kampung-baru',3.1616,101.7071,'步行桥',30,'连接甘榜峇鲁和 KLCC 一带，适合从两区步行经过。','https://www.malaysia.travel/explore/saloma-bridge',[4.4,36,'saloma']],
 ['titiwangsa-lake','Taman Tasik Titiwangsa','titiwangsa',3.1776,101.7064,'湖滨公园',65,'面向吉隆坡天际线的湖畔休闲公园。','https://www.dbkl.gov.my/en/fasiliti-awam/taman-awam/taman-tasik-titiwangsa',[3.8,154,'titiwangsa']],
 ['national-art-gallery','Balai Seni Negara','titiwangsa',3.1736,101.7027,'美术馆',90,'国家美术馆，展览以当期公告为准。','https://www.artgallery.gov.my/',[4.0,122,'nationalArt']],
 ['royal-selangor-vc','Royal Selangor Visitor Centre','setapak',3.1969,101.7212,'工艺展馆',75,'在吉隆坡 Setapak 的锡器工艺参观中心。','https://visitorcentre.royalselangor.com/',[4.7,5311,'kl'],true],
 ['thean-hou','Thean Hou Temple','brickfields',3.1216,101.6875,'庙宇',45,'Robson Heights 的天后宫，节庆人流会增加。','guide',[4.3,1568,'landmarks'],true],
 ['little-india-brickfields','Little India Brickfields','brickfields',3.1307,101.6844,'街区',50,'KL Sentral 附近的小印度，适合步行看店面与街景。','guide',[3.7,1188,'merdeka']],
 ['desa-central-park','The Central Park Desa ParkCity','desa-parkcity',3.1847,101.6285,'湖滨公园',55,'湖边步道紧邻 The Waterfront；行程点对应公园。','https://www.desaparkcity.com/'],
 ['bukit-kiara','Bukit Kiara Federal Park','ttdi',3.1468,101.6315,'林间步道',90,'从 TTDI 一侧进入的城市绿地，出发前查看步道入口。','https://www.jln.gov.my/',[4.1,52,'parks']],
 ['bukit-jalil-park','Bukit Jalil Recreational Park','bukit-jalil',3.0592,101.6718,'公园',65,'武吉加里尔的公共公园，可走环湖及花园步道。','https://my.trip.com/travel-guide/attraction/kuala-lumpur/bukit-jalil-recreational-park-31693951'],
 ['connaught-market','Taman Connaught Night Market','cheras',3.0818,101.7345,'夜市',75,'康乐花园夜市。通常周三开放，遇假期宜先查看公告。','guide']
];
const selangorAttractions = [
 ['batu-caves','Batu Caves','gombak',3.2374,101.6839,'庙宇与石灰岩洞',80,'黑风洞在雪兰莪 Gombak。上主洞需要爬阶梯。','https://selangor.travel/listing/batu-caves/',[4.0,14168,'sel'],true],
 ['zoo-negara','Zoo Negara Malaysia','gombak',3.2071,101.7567,'动物园',180,'Hulu Kelang 的国家动物园，与 Zoo Johor 是不同地点。','https://www.zoonegaramalaysia.my/',[3.2,776,'selParks']],
 ['frim','FRIM Forest Research Institute Malaysia','gombak',3.2361,101.6349,'森林公园',110,'靠近甲洞的雪州森林研究院，进园与空中步道的预约方式各异。','https://www.frim.gov.my/',[4.1,439,'selParks']],
 ['kanching-falls','Kanching Eco Forest Park','gombak',3.3027,101.6190,'瀑布',110,'Rawang 一带的多层瀑布；步道和入场以开放公告为准。','gombak',[3.8,163,'waterfalls']],
 ['sunway-lagoon','Sunway Lagoon','petaling',3.0719,101.6059,'主题乐园',300,'Bandar Sunway 的水上及主题乐园，可按票种留半天以上。','https://sunwaylagoon.com/',[4.1,3300,'sel'],true],
 ['shah-alam-blue-mosque','Sultan Salahuddin Abdul Aziz Shah Mosque','petaling',3.0788,101.5193,'清真寺',60,'莎阿南蓝色清真寺，参观以礼拜时段及访客规定为准。','petaling',[4.6,473,'selGuide']],
 ['i-city','i-City Theme Park','petaling',3.0648,101.4837,'主题乐园',130,'莎阿南西边的灯饰及主题乐园，票种和设施各异。','https://iticket.i-city.my/',[3.5,772,'selTheme']],
 ['thai-chetawan','Thai Chetawan Temple','petaling',3.1026,101.6512,'庙宇',45,'PJ Jalan Pantai 一带的泰式佛寺。','petaling',[4.4,99,'selGuide']],
 ['royal-gallery-klang','Sultan Abdul Aziz Royal Gallery','klang',3.0433,101.4504,'博物馆',70,'巴生老城区的雪州王室历史展馆。','https://www.visitselangor.com/sultan-abdul-aziz-royal-gallery/',[4.1,22,'klang']],
 ['pulau-ketam','Pulau Ketam','klang',2.9996,101.3922,'渔村',180,'自驾路线到巴生港客运码头，换船前往吉胆岛。','klang',[3.4,193,'selParks'],false,'Port Klang Passenger Terminal'],
 ['bukit-melawati','Bukit Melawati','kuala-selangor',3.3406,101.2477,'历史山丘',65,'瓜雪历史山丘与灯塔一带，适合与自然公园同游。','kuala-selangor',[4.1,256,'selGuide']],
 ['kuala-selangor-nature','Kuala Selangor Nature Park','kuala-selangor',3.3368,101.2466,'红树林与湿地',100,'红树林和湿地步道，与 Bukit Melawati 是不同入口。','https://selangor.travel/listing/kuala-selangor-nature-park/',[4.0,124,'selParks']],
 ['kuantan-fireflies','Kampung Kuantan Fireflies Park','kuala-selangor',3.3598,101.2990,'夜间生态游',80,'在指定码头乘船看萤火虫。出发前查船班及天气。','https://selangor.travel/listing/kampung-kuantan-fireflies-park/',[4.1,455,'selGuide'],true],
 ['sekinchan-paddy','Sekinchan Paddy Field','sabak-bernam',3.5022,101.1266,'田园景观',85,'稻田随农期变色。路线指向稻米展览馆一带，可从那里看田景。','sabak-bernam',[4.2,199,'sekinchan'],false,'Paddy Gallery Sekinchan'],
 ['sekinchan-redang','Pantai Redang Sekinchan','sabak-bernam',3.5043,101.0925,'海滨',45,'适耕庄的海边和许愿树区。导航时确认地名带 Sekinchan。','sabak-bernam',[3.4,198,'sekinchan']],
 ['chiling-waterfall','Chiling Waterfall','hulu-selangor',3.5752,101.7542,'瀑布与步道',150,'新古毛外的跨溪步道。出发前先核实是否开放及当日天气。','https://mphs.gov.my/en/mphs/corporate-info/management/ydp-message',[4.2,49,'waterfalls'],false,'Sungai Chiling Fish Sanctuary'],
 ['kkb-heritage','Kuala Kubu Bharu Heritage Town','hulu-selangor',3.5638,101.6579,'老街',60,'新古毛旧镇，可步行逛战前店屋一带。','hulu-selangor',null,false,'Kuala Kubu Bharu town centre'],
 ['gabai-falls','Sungai Gabai Waterfall','hulu-langat',3.1663,101.9128,'瀑布',95,'Hulu Langat 的瀑布和野餐区，进场以开放公告为准。','hulu-langat',[3.5,39,'waterfalls']],
 ['sungai-congkak','Sungai Congkak Recreational Forest','hulu-langat',3.2071,101.8616,'森林与溪流',100,'适合短程野餐的溪流，雨后或水势升高时先核实开放。','hulu-langat'],
 ['morib-beach','Pantai Morib','kuala-langat',2.7499,101.4465,'海滨',65,'Banting 一带的海滨步道，适合放傍晚行程。','kuala-langat',[3.1,105,'selBeaches']],
 ['bukit-jugra','Bukit Jugra','kuala-langat',2.8370,101.4254,'山丘与观景',75,'可看灯塔及河口景色，滑翔伞活动另行安排。','kuala-langat',[4.2,22,'jugra']],
 ['mah-meri-cultural','Mah Meri Cultural Village','kuala-langat',2.8949,101.4018,'文化村',95,'Carey Island 了解 Mah Meri 木雕与文化的场所，出发前查询开放安排。','kuala-langat',[3.7,15,'carey']],
 ['sepang-circuit','Sepang International Circuit','sepang',2.7608,101.7371,'赛车场',90,'赛道在雪邦。参观安排随赛事变化。','https://www.sepangcircuit.com/',[4.3,738,'selGuide']],
 ['bagan-lalang','Bagan Lalang Beach','sepang',2.6000,101.6911,'海滨',70,'Sungai Pelek 一带的海滩，可先看潮汐和天气。','sepang',[3.7,37,'selBeaches']],
 ['cyberjaya-lake','Taman Tasik Cyberjaya','sepang',2.9397,101.6480,'湖滨公园',55,'Cyberjaya 的湖畔绿地，适合作就近散步停留。','sepang',[4.0,65,'cyberjaya']]
];
const attractionRatings = new Map();
function setAttractionRating(id, score, count, source){
 attractionRatings.set(id,{score,count,source:reviewSources[source],checkedOn:'2026-11-19'});
}
for (const [area,list] of [['kl',capitalAttractions],['sel',selangorAttractions]]) {
 for (const [id,title,zone,lat,lon,tag,duration,detail,source,rating,landmark,mapsName] of list) {
   basePlaces.push({
     id,title,area,zone:area+':'+zone,lat,lon,tag,duration,detail,category:'attraction',
     source:attractionSources[source]||source,googleArea:area==='kl'?'Kuala Lumpur':'Selangor',mapsName:mapsName||title,
     landmark:Boolean(landmark),ferryTransfer:id==='pulau-ketam'
   });
   if(rating)setAttractionRating(id,...rating);
 }
}
Object.assign(basePlaces.find(p=>p.id==='kepong-metropolitan-park'),{zone:'kl:kepong',mapsName:'Taman Tasik Metropolitan Kepong'});
setAttractionRating('kepong-metropolitan-park',4.8,4,'kepong');
setAttractionRating('river',3.7,838,'river');
