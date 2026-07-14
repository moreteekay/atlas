const map=L.map('map').setView([20,0],2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
 attribution:'© OpenStreetMap contributors'
}).addTo(map);

const load=f=>new Promise(r=>Papa.parse(`data/${f}`,{download:true,header:true,complete:x=>r(x.data)}));

Promise.all([
 load('places.csv'),
 load('content.csv'),
 load('photos.csv')
]).then(([places,content,photos])=>{
 places.filter(p=>p["Map Enabled?"]==="Yes").forEach(place=>{
   if(!place.Latitude||!place.Longitude) return;

   const id=place["Atlas ID"];
   const c=content.filter(x=>x["Atlas ID"]===id && x["Publishing Status"]==="Published");
   const p=photos.filter(x=>x["Atlas ID"]===id && x["Published?"]==="Yes");

   let html=`<div class="popup">
   <h3>${place["City / Place"]}</h3>
   <p>${place["Short Description"]||""}</p>`;

   if(place["Hero Photo URL"])
      html+=`<img src="${place["Hero Photo URL"]}" alt="">`;

   if(place["Personal Memory"])
      html+=`<p>${place["Personal Memory"]}</p>`;

   const add=(title,type)=>{
      const items=c.filter(x=>x.Type===type);
      if(!items.length) return;
      html+=`<h4>${title}</h4><ul>`;
      items.forEach(i=>{
         html+= i.URL
           ? `<li><a href="${i.URL}" target="_blank">${i.Title}</a></li>`
           : `<li>${i.Title}</li>`;
      });
      html+='</ul>';
   };

   add("Essays","Essay");
   add("Journal","Journal");
   add("Podcast","Podcast");
   add("Videos","Video");
   add("Gallery","Gallery");

   if(p.length){
      html+="<h4>Photos</h4>";
      p.forEach(ph=>{
         html+=`<img src="${ph["Photo URL"]}" alt="${ph.Caption||""}">`;
      });
   }

   html+="</div>";

   L.marker([parseFloat(place.Latitude),parseFloat(place.Longitude)])
    .addTo(map)
    .bindPopup(html,{maxWidth:450});
 });
});
