const CONFIG=window.ATLAS_CONFIG||{};
const map=L.map("map",{
  worldCopyJump:true,
  minZoom:2,
  maxZoom:18,
  zoomControl:false,
  preferCanvas:true
}).setView([22,3],2);

L.control.zoom({position:"bottomright"}).addTo(map);

// Warm, bright cartographic basemap at every zoom level.
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    attribution:"© OpenStreetMap contributors © CARTO",
    subdomains:"abcd",
    maxZoom:20
  }
).addTo(map);

const clusters=L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:45,disableClusteringAtZoom:12});
map.addLayer(clusters);

const sidebar=document.getElementById("sidebar");
const statsPanel=document.getElementById("stats-panel");
const navigation=document.getElementById("navigation");
const filters=document.getElementById("filters");
const search=document.getElementById("search");
const storyPanel=document.getElementById("story-panel");
const storyContent=document.getElementById("story-content");
let activeTab="places",activeFilter="All",records=[],countryBounds=new Map(),worldBounds=[];

document.getElementById("menu-button").onclick=()=>sidebar.classList.add("open");
document.getElementById("stats-button").onclick=()=>statsPanel.classList.add("open");
document.getElementById("close-story").onclick=()=>storyPanel.classList.remove("open");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).classList.remove("open"));

const text=v=>String(v??"").trim();
const esc=v=>text(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const splitIds=v=>text(v).split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);
const sourceUrl=kind=>text(CONFIG[`${kind}Url`])||`data/${kind}.csv`;
const loadCsv=kind=>new Promise((resolve,reject)=>Papa.parse(sourceUrl(kind),{download:true,header:true,skipEmptyLines:true,complete:r=>resolve(r.data),error:reject}));

function category(type){
  const t=text(type).toLowerCase();
  if(t.includes("beach")||t.includes("coast")||t.includes("bay")||t.includes("lagoon")||t.includes("strait")||t.includes("estuary"))return"Beaches & water";
  if(t.includes("river")||t.includes("lake")||t.includes("waterfall")||t.includes("oasis"))return"Rivers & lakes";
  if(t.includes("mountain")||t.includes("dune")||t.includes("desert")||t.includes("forest")||t.includes("park"))return"Landscapes";
  if(t.includes("museum")||t.includes("monument")||t.includes("palace")||t.includes("cathedral")||t.includes("church")||t.includes("mosque")||t.includes("basilica")||t.includes("archaeological")||t.includes("cave")||t.includes("bridge"))return"Heritage";
  if(t.includes("city")||t.includes("town")||t.includes("village")||t.includes("neighbourhood")||t.includes("district")||t.includes("square"))return"Cities & places";
  return"Other";
}

function featherIcon(favorite){
  const svg=`<svg viewBox="0 0 18 54" aria-hidden="true">
    <path d="M15.6 1.7C11.2 3.7 7.7 7.5 5.9 12.2C3.8 17.5 3 24 3.4 31.8C3.6 36.1 5.3 39.8 8.2 41.7C11 38.5 13.1 34.3 14.3 29.2C16.1 21.8 16.5 12.6 15.6 1.7Z" fill="#111"/>
    <path d="M14 5C11.3 11.2 9.3 18.2 8.1 26C7.2 31.9 6.4 39.6 5.2 51.8" fill="none" stroke="#e8e2d8" stroke-width=".8" stroke-linecap="round"/>
    <path d="M11.8 10.1L7.2 13M11 14.8L6.1 18M10.1 20L5.2 23.5M9.3 25.5L4.7 29M13.2 8.6L14.7 12.8M12.1 13.1L14.1 17.1M11.2 17.8L13.5 21.6M10.4 22.8L12.9 26.1" fill="none" stroke="#e8e2d8" stroke-width=".52" stroke-linecap="round" opacity=".85"/>
    <path d="M5.2 52L7.4 40" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
  return L.divIcon({className:`feather-marker${favorite?" favorite":""}`,html:svg,iconSize:favorite?[17,47]:[14,39],iconAnchor:favorite?[6,44]:[5,37]});
}

function buildStory(record){
  const p=record.place,related=record.related,photos=record.photos;
  const hero=text(p["Hero Photo"])||text((photos.find(x=>text(x["Hero?"]).toLowerCase()==="yes")||{})["Photo URL"]);
  const gallery=photos.filter(x=>text(x["Photo URL"])!==hero);
  const grouped={};related.forEach(x=>(grouped[text(x.Type)||"External"]??=[]).push(x));
  const timeline=text(p.Timeline)||[p["First Visit"],p["Last Visit"]].map(text).filter(Boolean).join("–");

  let html=`<span class="story-kicker">${esc(p.Continent||"Atlas")}</span><h2 class="story-title">${esc(p.Place)}</h2>`;
  html+=`<p class="story-location">${esc([p.Region,p.Country].map(text).filter(Boolean).join(", "))}</p>`;
  if(text(p.Type))html+=`<span class="story-type">${esc(p.Type)}</span>`;
  if(timeline)html+=`<span class="story-timeline">${esc(timeline)}</span>`;
  if(hero)html+=`<img class="story-hero" src="${esc(hero)}" alt="${esc(p.Place)}">`;
  if(text(p["Short Description"]))html+=`<p class="story-text">${esc(p["Short Description"])}</p>`;
  if(text(p["Personal Memory"]))html+=`<section class="story-section"><h3>A memory</h3><p class="story-text">${esc(p["Personal Memory"])}</p></section>`;

  const labels={Essay:"Essays",Journal:"Journal",Podcast:"Podcast episodes",Video:"Videos",Gallery:"Galleries",External:"Related content"};
  Object.entries(labels).forEach(([type,label])=>{
    const items=grouped[type]||[];if(!items.length)return;
    html+=`<section class="story-section"><h3>${label}</h3><ul>${items.map(i=>`<li>${text(i.URL)?`<a href="${esc(i.URL)}" target="_blank" rel="noopener">${esc(i.Title||"Untitled")}</a>`:esc(i.Title||"Untitled")}</li>`).join("")}</ul></section>`;
  });

  if(gallery.length){
    html+=`<section class="story-section"><h3>Photos</h3><div class="gallery-track">${gallery.map(x=>`<figure><img src="${esc(x["Photo URL"])}" alt="${esc(x.Caption||p.Place)}">${text(x.Caption)?`<figcaption>${esc(x.Caption)}</figcaption>`:""}</figure>`).join("")}</div></section>`;
  }

  storyContent.innerHTML=html;
  storyPanel.classList.add("open");
}

function showRecord(record){
  sidebar.classList.remove("open");
  clusters.zoomToShowLayer(record.marker,()=>{
    map.flyTo(record.marker.getLatLng(),Math.max(map.getZoom(),10),{duration:.8});
    setTimeout(()=>buildStory(record),350);
  });
}

function rebuildMap(filtered){
  clusters.clearLayers();
  filtered.forEach(r=>clusters.addLayer(r.marker));
}

function visibleRecords(){
  let result=[...records];
  if(activeTab==="favorites")result=result.filter(r=>text(r.place.Favorite).toLowerCase()==="yes");
  if(activeTab==="timeline")result=result.filter(r=>text(r.place.Timeline)||text(r.place["First Visit"]));
  if(activeFilter!=="All")result=result.filter(r=>r.category===activeFilter);
  const q=search.value.trim().toLowerCase();
  if(q)result=result.filter(r=>r.haystack.includes(q));
  return result;
}

function renderNavigation(){
  const visible=visibleRecords();
  rebuildMap(visible);

  if(search.value.trim()||activeTab!=="places"||activeFilter!=="All"){
    navigation.innerHTML=visible.length?visible.slice(0,150).map((r,i)=>`<button class="nav-item" data-item="${i}"><strong>${esc(r.place.Place)}</strong><span>${esc([r.place.Type,r.place.Region,r.place.Country].map(text).filter(Boolean).join(" · "))}</span></button>`).join(""):"<p>No places found.</p>";
    navigation.querySelectorAll("[data-item]").forEach(b=>b.onclick=()=>showRecord(visible[Number(b.dataset.item)]));
    return;
  }

  const tree={};
  visible.forEach(r=>{const cont=text(r.place.Continent)||"Other",country=text(r.place.Country)||"Unknown";tree[cont]??={};tree[cont][country]??=[];tree[cont][country].push(r)});
  navigation.innerHTML=Object.keys(tree).sort().map(cont=>`<h2 class="nav-section-title">${esc(cont)}</h2>${Object.keys(tree[cont]).sort().map(country=>`<button class="nav-country" data-country="${esc(country)}"><span>${esc(country)}</span><span>${tree[cont][country].length}</span></button>`).join("")}`).join("");
  navigation.querySelectorAll("[data-country]").forEach(b=>b.onclick=()=>{const bounds=countryBounds.get(b.dataset.country);sidebar.classList.remove("open");if(bounds?.length)map.fitBounds(bounds,{padding:[45,45],maxZoom:7})});
}

function renderFilters(){
  const categories=["All",...new Set(records.map(r=>r.category))];
  filters.innerHTML=categories.map(c=>`<button class="filter-chip${c===activeFilter?" active":""}" data-filter="${esc(c)}">${esc(c)}</button>`).join("");
  filters.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;renderFilters();renderNavigation()});
}

function renderStats(){
  const countries=new Set(records.map(r=>text(r.place.Country)).filter(Boolean));
  const countCat=name=>records.filter(r=>r.category===name).length;
  const unesco=records.filter(r=>text(r.place["UNESCO?"]).toLowerCase()==="yes").length;
  const favorites=records.filter(r=>text(r.place.Favorite).toLowerCase()==="yes").length;
  const stats=[
    [countries.size,"Countries"],[records.length,"Places"],
    [countCat("Beaches & water"),"Beaches & coasts"],
    [countCat("Rivers & lakes"),"Rivers & lakes"],
    [countCat("Landscapes"),"Landscapes"],
    [countCat("Heritage"),"Heritage sites"],
    [unesco,"UNESCO places"],[favorites,"Favorites"]
  ];
  document.getElementById("stats-grid").innerHTML=stats.map(([v,l])=>`<div class="stat-card"><span class="stat-value">${v}</span><span class="stat-label">${l}</span></div>`).join("");
}

Promise.all([loadCsv("places"),loadCsv("content"),loadCsv("photos")]).then(([places,content,photos])=>{
  const contentById=new Map(content.filter(i=>text(i["Content ID"])).map(i=>[text(i["Content ID"]),i]));
  const photosByPlace=new Map();
  photos.forEach(p=>{const id=text(p["Atlas ID"]);if(!id||!text(p["Photo URL"]))return;if(!photosByPlace.has(id))photosByPlace.set(id,[]);photosByPlace.get(id).push(p)});

  places.forEach(place=>{
    if(text(place["Map Enabled"]).toLowerCase()!=="yes")return;
    const lat=parseFloat(place.Latitude),lon=parseFloat(place.Longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
    const id=text(place["Atlas ID"]);
    const related=splitIds(place["Related Content IDs"]).map(x=>contentById.get(x)).filter(Boolean).filter(x=>text(x.Status).toLowerCase()==="published");
    const placePhotos=photosByPlace.get(id)||[];
    const favorite=text(place.Favorite).toLowerCase()==="yes";
    const marker=L.marker([lat,lon],{icon:featherIcon(favorite),title:text(place.Place)});
    const record={place,related,photos:placePhotos,marker,category:category(place.Type),haystack:[place.Place,place.Country,place.Region,place.Type,place.Continent,place["Search Keywords"],place.Timeline].map(text).join(" ").toLowerCase()};
    marker.on("click",()=>buildStory(record));
    records.push(record);worldBounds.push([lat,lon]);
    const country=text(place.Country);if(!countryBounds.has(country))countryBounds.set(country,[]);countryBounds.get(country).push([lat,lon]);
  });

  document.querySelectorAll(".tab").forEach(tab=>tab.onclick=()=>{document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));tab.classList.add("active");activeTab=tab.dataset.tab;renderNavigation()});
  search.oninput=renderNavigation;

  renderFilters();renderNavigation();renderStats();
  rebuildMap(records);
  if(worldBounds.length)map.fitBounds(worldBounds,{padding:[30,30],maxZoom:3});
  setTimeout(()=>document.getElementById("loading-screen").classList.add("hidden"),500);
}).catch(error=>{
  console.error("Atlas could not load:",error);
  document.getElementById("loading-screen").innerHTML="<p>The Atlas could not be opened. Check the browser console.</p>";
});
