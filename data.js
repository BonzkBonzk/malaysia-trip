const regions = [
['kl','吉隆坡','Kuala Lumpur',3.1390,101.6869],
['sel','雪兰莪','Petaling Jaya',3.1073,101.6067],
['ns','森美兰','Seremban',2.7259,101.9378],
['mel','马六甲','Melaka',2.1944,102.2501],
['joh','柔佛','Johor Bahru',1.4927,103.7618],
['phg','彭亨','Kuantan',3.8077,103.3260],
['trg','登嘉楼','Kuala Terengganu',5.3302,103.1408],
['kel','吉兰丹','Kota Bharu',6.1254,102.2381],
['per','霹雳','Ipoh',4.5975,101.0901],
['pen','槟城','George Town',5.4141,100.3288],
['ked','吉打','Alor Setar',6.1248,100.3673],
['pls','玻璃市','Kangar',6.4414,100.1986],
['put','布城','Putrajaya',2.9264,101.6964],
['srw','砂拉越','Kuching',1.5533,110.3592],
['sbh','沙巴','Kota Kinabalu',5.9804,116.0735],
['lab','纳闽','Labuan',5.2805,115.2470]
].map(([id,title,en,lat,lon])=>({id,title,en,lat,lon,east:['srw','sbh','lab'].includes(id)}));

const cities = [
['kuala-lumpur','吉隆坡','Kuala Lumpur','kl',3.1390,101.6869],
['petaling-jaya','八打灵再也','Petaling Jaya','sel',3.1073,101.6067],
['subang-jaya','梳邦再也','Subang Jaya','sel',3.0567,101.5851],
['putrajaya','布城','Putrajaya','put',2.9264,101.6964],
['seremban','芙蓉','Seremban','ns',2.7259,101.9378],
['melaka','马六甲市','Melaka','mel',2.1944,102.2501],
['muar','麻坡','Muar','joh',2.0442,102.5689],
['batu-pahat','峇株巴辖','Batu Pahat','joh',1.8494,102.9301],
['kluang','居銮','Kluang','joh',2.0292,103.3223],
['johor-bahru','新山','Johor Bahru','joh',1.4927,103.7618],
['iskandar-puteri','依斯干达公主城','Iskandar Puteri','joh',1.4255,103.6217],
['bentong','文冬','Bentong','phg',3.5222,101.9083],
['kuantan','关丹','Kuantan','phg',3.8077,103.3260],
['kuala-terengganu','瓜拉登嘉楼','Kuala Terengganu','trg',5.3302,103.1408],
['kota-bharu','哥打峇鲁','Kota Bharu','kel',6.1254,102.2381],
['ipoh','怡保','Ipoh','per',4.5975,101.0901],
['george-town','乔治市','George Town','pen',5.4141,100.3288],
['alor-setar','亚罗士打','Alor Setar','ked',6.1248,100.3673],
['kangar','加央','Kangar','pls',6.4414,100.1986],
['kuching','古晋','Kuching','srw',1.5533,110.3592],
['sibu','诗巫','Sibu','srw',2.2873,111.8305],
['miri','美里','Miri','srw',4.3983,113.9916],
['kota-kinabalu','亚庇','Kota Kinabalu','sbh',5.9804,116.0735],
['kundasang','昆达山','Kundasang','sbh',5.9850,116.5754],
['sandakan','山打根','Sandakan','sbh',5.8391,118.1171],
['labuan','纳闽','Labuan','lab',5.2805,115.2470]
].map(([id,title,en,area,lat,lon])=>({id,title,en,area,lat,lon,east:regions.find(r=>r.id===area).east}));
const defaultStops=['kuala-lumpur','johor-bahru','melaka'];
const basePlaces = [
 {id:'nancy',title:"Nancy’s Kitchen",category:'food',tag:'娘惹菜',area:'mel',lat:2.1967,lon:102.2347,detail:'位于 Kota Laksamana，可看看官方菜单的娘惹菜和糕点。',hours:'Mo,We-Th 11:00-17:00; Fr-Su 11:00-21:00; Tu off',hoursText:'周一、三、四 11:00–17:00 · 周五至周日 11:00–21:00',price:'查看菜单',source:'https://eatatnancyskit.com/',duration:55},
 {id:'river',title:'Melaka River Cruise',category:'attraction',tag:'马六甲河游船',area:'mel',lat:2.2012,lon:102.2503,detail:'从 Pengkalan Rama 码头上船，船程约 45 分钟。',hours:'Mo-Su 09:00-23:00',hoursText:'官网列 09:00–23:00 · 闭航视天气',price:'本地成人 RM25 起 · 以购票页为准',source:'https://www.visitmelaka.com.my/index.php/nature-adventure/recreation/124-melaka-river-cruise',tickets:'https://ticket.melakarivercruise.my/',duration:65},
 {id:'jb-garden',title:'Taman Botani Diraja Johor',category:'attraction',tag:'柔佛皇家植物园',area:'joh',lat:1.4543,lon:103.7560,detail:'工作日与周末入场时段不同，周二和部分公假休息。',hours:'Mo,We-Fr 14:00-17:00; Sa-Su 09:00-17:00; Tu off',hoursText:'平日 14:00–18:00 · 周末 09:00–18:00 · 最迟 17:00 入场 · 周二休',price:'RM2 起 / 人',source:'https://etiket.johor.gov.my/',tickets:'https://tamanbotanidiraja.johor.gov.my/tiket/',duration:60},
 {id:'jb-zoo',title:'Zoo Johor',category:'attraction',tag:'柔佛动物园',area:'joh',lat:1.4561,lon:103.7529,detail:'建议留 90 分钟。周五午间休息，学校假期营业安排可能不同。',hours:'Mo,We-Th,Sa-Su 09:00-17:00; Fr 09:00-12:30,14:00-17:00; Tu off',hoursText:'大多数日子 09:00–18:00 · 最迟 17:00 入场 · 周二通常休',price:'RM10 起 / 人',source:'https://etiket.johor.gov.my/',tickets:'https://etiket.johor.gov.my/',duration:90},
 {id:'jb-eco',title:'Kampung Sungai Melayu',category:'attraction',tag:'红树林生态游',area:'joh',lat:1.4260,lon:103.6674,detail:'靠近依斯干达公主城，适合安排红树林或乡村行程。',hours:'Mo-Th,Sa-Su 09:00-16:30; Fr off',hoursText:'09:00–16:30 · 周五休',price:'RM45 起 / 人',source:'https://etiket.johor.gov.my/',tickets:'https://etiket.johor.gov.my/',duration:90},
 {id:'sample-food',title:'街角熟食档',category:'food',tag:'评分演示',area:'joh',lat:1.4650,lon:103.7611,detail:'虚构档口。用来体验味道高分、服务低分时，如何按你在意的项目筛选。',sample:true,scores:[4.9,3.5,1.5],duration:35},
 {id:'sample-service',title:'小巷午餐馆',category:'food',tag:'评分演示',area:'mel',lat:2.1956,lon:102.2489,detail:'虚构餐厅。切换到「服务优先」可比较排序的变化。',sample:true,scores:[3.5,4.4,4.9],duration:45}
];
const knownFuel = [
 ['seremban-s','Shell Seremban R&R', 'ns',2.76399,101.830652,'south','https://find.shell.com/my/fuel/10208151-shell-nse-seremban-r-r-south-bound/en_MY','24/7'],
 ['pagoh-s','R&R Pagoh','joh',2.1458,102.6992,'south','https://www.plus.com.my/facilities/pagoh-southbound/',''],
 ['pagoh-n','Shell Pagoh R&R','joh',2.148415,102.698219,'north','https://find.shell.com/my/fuel/10208867-shell-nse-pagoh-r-r-kl-bound/en_MY','24/7']
].map(([id,title,area,lat,lon,dir,source,hours])=>({id,title,area,lat,lon,dir,category:'fuel',tag:dir==='north'?'PLUS · 北上':'PLUS · 南下',detail:'PLUS 公路休息站。到达前留意行车方向和沿途油量。',source,hours,duration:15}));
basePlaces.push(...knownFuel);

basePlaces.push({id:'hiap-joo',title:'Hiap Joo Bakery',category:'food',tag:'柴烧香蕉蛋糕',area:'joh',lat:1.4569,lon:103.7649,detail:'新山老城区 Jalan Tan Hiok Nee 的面包店。香蕉蛋糕卖完即止。',hoursText:'通常 07:30 起 · 周日和售罄时间待核对',price:'香蕉蛋糕 RM13 / 10 片（参考）',source:'https://where2go.com.my/johor-bahru/hawker-food/hiap-joo-bakery/',duration:25},{id:'village-park',title:'Village Park Restaurant',category:'food',tag:'椰浆饭',area:'sel',lat:3.1363,lon:101.6227,detail:'Damansara Uptown 的炸鸡椰浆饭。',hours:'Mo-Su 06:30-17:30',hoursText:'06:30–17:30 · 出发前核对',price:'RM10–20（参考）',source:'https://where2go.com.my/selangor/hawker-food/village-park/',duration:45});

basePlaces.push(...[
  {
    "id": "limapulo",
    "title": "Limapulo: Baba Can Cook",
    "category": "food",
    "foodKind": "restaurant",
    "tag": "娘惹菜",
    "area": "kl",
    "lat": 3.1582712,
    "lon": 101.6995656,
    "googleArea": "Jalan Doraisamy, Kuala Lumpur",
    "detail": "米其林指南推荐娘惹叻沙和沙嗲。",
    "hours": "Mo-Sa 11:30-15:00,17:30-21:00; Su off",
    "hoursText": "周一至周六 11:30–15:00、17:30–21:00",
    "source": "https://guide.michelin.com/en/kuala-lumpur-region/kuala-lumpur/restaurant/limapulo",
    "duration": 55
  },
  {
    "id": "klebang",
    "title": "Klebang Original Coconut Shake",
    "category": "food",
    "foodKind": "drinks",
    "tag": "椰子冰沙",
    "area": "mel",
    "lat": 2.2157827,
    "lon": 102.2069043,
    "googleArea": "Klebang Besar, Melaka",
    "detail": "可点原味或加香草冰淇淋，旁边有停车位。",
    "source": "https://www.gomelaka.my/klebang-original-coconut-shake/",
    "duration": 25
  },
  {
    "id": "jonker-88",
    "title": "Jonker 88",
    "category": "food",
    "foodKind": "dessert",
    "tag": "煎蕊 · 娘惹叻沙",
    "area": "mel",
    "lat": 2.1966709,
    "lon": 102.2466399,
    "googleArea": "Jalan Hang Jebat, Melaka",
    "detail": "鸡场街卖煎蕊和叻沙的老店。",
    "source": "https://gomelaka.com/news/malacca-peranakan-food-trail-melaka-2026",
    "duration": 30
  }
]);
