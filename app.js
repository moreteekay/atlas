const map = L.map("map", {
  worldCopyJump: true,
  minZoom: 2
}).setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19
}).addTo(map);

function loadCsv(filename) {
  return new Promise((resolve, reject) => {
    Papa.parse(`data/${filename}`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: result => resolve(result.data),
      error: error => reject(error)
    });
  });
}

function text(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitIds(value) {
  return text(value)
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function section(title, body) {
  return body ? `<section><h4>${title}</h4>${body}</section>` : "";
}

function buildContentList(items) {
  if (!items.length) return "";

  return `<ul>${items.map(item => {
    const title = escapeHtml(item.Title || "Untitled");
    const url = text(item.URL);
    return `<li>${url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${title}</a>`
      : title}</li>`;
  }).join("")}</ul>`;
}

Promise.all([
  loadCsv("places.csv"),
  loadCsv("content.csv"),
  loadCsv("photos.csv")
]).then(([places, content, photos]) => {
  const contentById = new Map(
    content
      .filter(item => text(item["Content ID"]))
      .map(item => [text(item["Content ID"]), item])
  );

  const photosByPlace = new Map();
  photos.forEach(photo => {
    const atlasId = text(photo["Atlas ID"]);
    if (!atlasId || !text(photo["Photo URL"])) return;
    if (!photosByPlace.has(atlasId)) photosByPlace.set(atlasId, []);
    photosByPlace.get(atlasId).push(photo);
  });

  const bounds = [];

  places.forEach(place => {
    if (text(place["Map Enabled"]).toLowerCase() !== "yes") return;

    const latitude = Number.parseFloat(place.Latitude);
    const longitude = Number.parseFloat(place.Longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const atlasId = text(place["Atlas ID"]);
    const placePhotos = photosByPlace.get(atlasId) || [];

    const relatedContent = splitIds(place["Related Content IDs"])
      .map(id => contentById.get(id))
      .filter(Boolean)
      .filter(item => text(item.Status).toLowerCase() === "published");

    const grouped = {
      Essay: [],
      Journal: [],
      Podcast: [],
      Gallery: [],
      Video: [],
      External: []
    };

    relatedContent.forEach(item => {
      const type = text(item.Type);
      if (grouped[type]) grouped[type].push(item);
    });

    const heroPhoto =
      text(place["Hero Photo"]) ||
      text((placePhotos.find(photo => text(photo["Hero?"]).toLowerCase() === "yes") || {})["Photo URL"]);

    const galleryPhotos = placePhotos
      .filter(photo => text(photo["Photo URL"]) !== heroPhoto);

    let popup = `<article class="popup">`;
    popup += `<h3>${escapeHtml(place.Place)}</h3>`;

    const locationLine = [place.Region, place.Destination || place.Country]
      .map(text)
      .filter(Boolean)
      .join(", ");

    if (locationLine) {
      popup += `<p class="location">${escapeHtml(locationLine)}</p>`;
    }

    if (heroPhoto) {
      popup += `<img class="hero-photo" src="${escapeHtml(heroPhoto)}" alt="${escapeHtml(place.Place)}">`;
    }

    if (text(place["Short Description"])) {
      popup += `<p>${escapeHtml(place["Short Description"])}</p>`;
    }

    if (text(place["Personal Memory"])) {
      popup += section("Memory", `<p>${escapeHtml(place["Personal Memory"])}</p>`);
    }

    popup += section("Essays", buildContentList(grouped.Essay));
    popup += section("Journal", buildContentList(grouped.Journal));
    popup += section("Podcast", buildContentList(grouped.Podcast));
    popup += section("Videos", buildContentList(grouped.Video));
    popup += section("Related content", buildContentList(grouped.External));
    popup += section("Galleries", buildContentList(grouped.Gallery));

    if (galleryPhotos.length) {
      popup += `<section><h4>Photos</h4><div class="photo-grid">`;
      popup += galleryPhotos.map(photo => `
        <figure>
          <img src="${escapeHtml(photo["Photo URL"])}" alt="${escapeHtml(photo.Caption || place.Place)}">
          ${text(photo.Caption) ? `<figcaption>${escapeHtml(photo.Caption)}</figcaption>` : ""}
        </figure>
      `).join("");
      popup += `</div></section>`;
    }

    popup += `</article>`;

    const marker = L.circleMarker([latitude, longitude], {
      radius: text(place.Favorite).toLowerCase() === "yes" ? 7 : 5,
      weight: 1.5,
      fillOpacity: 0.85
    })
      .addTo(map)
      .bindPopup(popup, {
        maxWidth: 480,
        maxHeight: 560
      });

    bounds.push([latitude, longitude]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, {
      padding: [25, 25],
      maxZoom: 4
    });
  } else {
    console.error("No valid places were found in places.csv.");
  }
}).catch(error => {
  console.error("Atlas data could not be loaded:", error);
});