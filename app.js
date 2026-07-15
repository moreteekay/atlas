const CONFIG=window.ATLAS_CONFIG||{};
const map=L.map("map",{worldCopyJump:true,minZoom:2}).setView([22,3],2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors",maxZoom:19}).addTo(map);

const clusters=L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:46,disableClusteringAtZoom:12});
map.addLayer(clusters);

const sidebar=document.getElementById("sidebar");
const navigation=document.getElementById("navigation");
const search=document.getElementById("search");

document.getElementById("menu-button").onclick=()=>sidebar.classList.add("open");
document.getElementById("close-sidebar").onclick=()=>sidebar.classList.remove("open");

const text=v=>String(v??"").trim();
const escapeHtml=v=>text(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const splitIds=v=>text(v).split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);

function sourceUrl(kind){
  const direct=CONFIG[`${kind}Url`];
  if(text(direct)) return direct;
  return `data/${kind}.csv`;
}

function loadCsv(kind){
  return new Promise((resolve,reject)=>{
    Papa.parse(sourceUrl(kind),{
      download:true,header:true,skipEmptyLines:true,
      complete:r=>resolve(r.data),error:reject
    });
  });
}

function featherIcon(favorite){
  const svg=`<svg viewBox="0 0 32 48" aria-hidden="true">
  <path d="M27.2 2.5C19.4 3.1 12.8 7.3 8.2 14.1C3.9 20.4 3.8 28.7 7.8 34.3C10.1 37.5 13.7 39.2 17.4 38.7C21.5 38.1 24.8 34.8 26.8 30.6C29.5 24.9 29.2 16.4 27.2 2.5Z" fill="#111"/>
  <path d="M24.4 7.4C19 13.4 14.5 20.1 11.2 27.3C8.7 32.8 7.2 38.8 6.8 45.4" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".9"/>
  <path d="M20.6 12.3L12.5 15.9M18.2 17.3L9.9 21.1M15.8 22.7L8.4 26.5M14 28L8 31.6M23.5 9.2L25.2 14.7M21.8 13.8L25.4 19.4M20 18.7L24.7 24.1M18.3 23.7L23.2 28.4" fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".75"/>
  <path d="M7 45.5L10.3 36.6" stroke="#111" stroke-width="2" stroke-linecap="round"/></svg>`;
  return L.divIcon({
    className:`feather-marker${favorite?" favorite":""}`,
    html:svg,
    iconSize:favorite?[33,44]:[28,38],
    iconAnchor:favorite?[11,42]:[9,36],
    popupAnchor:[4,-34]
  });
}

function contentList(items){
  if(!items.length)return "";
  return `<ul>${items.map(item=>{
    const title=escapeHtml(item.Title||"Untitled");
    const url=text(item.URL);
    return `<li>${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${title}</a>`:title}</li>`;
  }).join("")}</ul>`;
}

function buildPopup(place,related,photos){
  const hero=text(place["Hero Photo"])||text((photos.find(p=>text(p["Hero?"]).toLowerCase()==="yes")||{})["Photo URL"]);
  const gallery=photos.filter(p=>text(p["Photo URL"])!==hero);
  const groups={};
  related.forEach(item=>{const type=text(item.Type)||"External";(groups[type]??=[]).push(item)});

  let html=`<article class="popup"><h2>${escapeHtml(place.Place)}</h2>`;
  const location=[place.Region,place.Destination||place.Country].map(text).filter(Boolean).join(", ");
  if(location) html+=`<p class="location">${escapeHtml(location)}</p>`;
  if(text(place.Type)) html+=`<span class="type">${escapeHtml(place.Type)}</span>`;
  if(hero) html+=`<img class="hero-photo" src="${escapeHtml(hero)}" alt="${escapeHtml(place.Place)}">`;
  if(text(place["Short Description"])) html+=`<p>${escapeHtml(place["Short Description"])}</p>`;
  if(text(place["Personal Memory"])) html+=`<h3>A memory</h3><p>${escapeHtml(place["Personal Memory"])}</p>`;

  const labels={Essay:"Essays",Journal:"Journal",Podcast:"Podcast",Video:"Videos",Gallery:"Galleries",External:"Related content"};
  Object.entries(labels).forEach(([type,label])=>{const list=contentList(groups[type]||[]);if(list)html+=`<h3>${label}</h3>${list}`});

  if(gallery.length){
    html+=`<h3>Photos</h3><div class="photo-grid">`;
    html+=gallery.map(photo=>`<figure><img src="${escapeHtml(photo["Photo URL"])}" alt="${escapeHtml(photo.Caption||place.Place)}">${text(photo.Caption)?`<figcaption>${escapeHtml(photo.Caption)}</figcaption>`:""}</figure>`).join("");
    html+=`</div>`;
  }
  return html+"</article>";
}

Promise.all([loadCsv("places"),loadCsv("content"),loadCsv("photos")]).then(([places,content,photos])=>{
  const contentById=new Map(content.filter(i=>text(i["Content ID"])).map(i=>[text(i["Content ID"]),i]));
  const photosByPlace=new Map();

  photos.forEach(photo=>{
    const id=text(photo["Atlas ID"]);
    if(!id||!text(photo["Photo URL"]))return;
    if(!photosByPlace.has(id))photosByPlace.set(id,[]);
    photosByPlace.get(id).push(photo);
  });

  const records=[],countryBounds=new Map(),world=[];

  places.forEach(place=>{
    if(text(place["Map Enabled"]).toLowerCase()!=="yes")return;
    const lat=parseFloat(place.Latitude),lon=parseFloat(place.Longitude);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return;

    const id=text(place["Atlas ID"]);
    const related=splitIds(place["Related Content IDs"]).map(x=>contentById.get(x)).filter(Boolean).filter(i=>text(i.Status).toLowerCase()==="published");
    const placePhotos=photosByPlace.get(id)||[];
    const favorite=text(place.Favorite).toLowerCase()==="yes";

    const marker=L.marker([lat,lon],{icon:featherIcon(favorite),title:text(place.Place)})
      .bindPopup(buildPopup(place,related,placePhotos),{maxWidth:490,maxHeight:600});

    clusters.addLayer(marker);
    world.push([lat,lon]);

    const country=text(place.Country);
    if(!countryBounds.has(country))countryBounds.set(country,[]);
    countryBounds.get(country).push([lat,lon]);

    records.push({
      place,marker,
      haystack:[place.Place,place.Country,place.Destination,place.Region,place.Type,place.Continent,place["Search Keywords"]].map(text).join(" ").toLowerCase()
    });
  });

  function focus(record){
    sidebar.classList.remove("open");
    clusters.zoomToShowLayer(record.marker,()=>{
      map.setView(record.marker.getLatLng(),Math.max(map.getZoom(),10));
      record.marker.openPopup();
    });
  }

  function render(query=""){
    const q=query.trim().toLowerCase();

    if(q){
      const matches=records.filter(r=>r.haystack.includes(q)).slice(0,80);
      navigation.innerHTML=matches.length
        ?matches.map((r,i)=>`<button class="search-result" data-result="${i}"><strong>${escapeHtml(r.place.Place)}</strong><span>${escapeHtml([r.place.Region,r.place.Country].map(text).filter(Boolean).join(", "))}</span></button>`).join("")
        :"<p>No places found.</p>";
      navigation.querySelectorAll("[data-result]").forEach(button=>button.onclick=()=>focus(matches[Number(button.dataset.result)]));
      return;
    }

    const tree={};
    records.forEach(record=>{
      const continent=text(record.place.Continent)||"Other";
      const country=text(record.place.Country)||"Unknown";
      tree[continent]??={};
      tree[continent][country]??=[];
      tree[continent][country].push(record);
    });

    navigation.innerHTML=Object.keys(tree).sort().map(continent=>{
      return `<h2 class="nav-continent">${escapeHtml(continent)}</h2>`+
        Object.keys(tree[continent]).sort().map(country=>`<button class="nav-country" data-country="${escapeHtml(country)}">${escapeHtml(country)} (${tree[continent][country].length})</button>`).join("");
    }).join("");

    navigation.querySelectorAll("[data-country]").forEach(button=>{
      button.onclick=()=>{
        const bounds=countryBounds.get(button.dataset.country);
        sidebar.classList.remove("open");
        if(bounds?.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:7});
      };
    });
  }

  search.addEventListener("input",e=>render(e.target.value));
  document.getElementById("show-all").onclick=()=>{
    sidebar.classList.remove("open");
    if(world.length)map.fitBounds(world,{padding:[25,25],maxZoom:3});
  };

  render();
  if(world.length)map.fitBounds(world,{padding:[25,25],maxZoom:3});
}).catch(error=>console.error("Atlas could not load:",error));