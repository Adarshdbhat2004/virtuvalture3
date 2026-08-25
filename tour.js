// =================================================================
// SCENES — one entry per panorama. Add rooms/entrances freely.
// `map` gives this scene's position on the mini-map (0-100, roughly
// matching your real floor plan — doesn't need to be exact).
// =================================================================
const SCENES = {
  entrance: {
    title: "Entrance",
    panorama: "entrance.png",
    map: { x: 50, y: 85 }
  },
  room: {
    title: "Main Room",
    panorama: "room.png",
    map: { x: 50, y: 50 }
  },
  bathroom: {
    title: "Bathroom",
    panorama: "bathroom.png",
    map: { x: 78, y: 50 }
  }

  // To add a second villa, for example:
  // entrance2:  { title: "Villa B Entrance", panorama: "entrance2.png", map: { x: 20, y: 85 } },
  // bedroom2:   { title: "Villa B Bedroom",  panorama: "bedroom2.png",  map: { x: 20, y: 50 } },
};

// =================================================================
// LINKS — one entry per doorway, defined ONCE. The code builds the
// hotspot in both scenes automatically: "from" gets a hotspot aimed
// at "to" (pitch/yaw), and "to" gets an automatic hotspot back
// (pitchBack/yawBack). This same list also drives the contextual
// filmstrip below and the mini-map connections — one source of truth.
// =================================================================
const LINKS = [
  { from: "entrance", pitch: -5,  yaw: 0,    to: "room",     pitchBack: -5, yawBack: -180 },
  { from: "room",     pitch: 0,   yaw: 90,   to: "bathroom", pitchBack: 0,  yawBack: -90  }

  // Adding a room is one line here, e.g.:
  // { from: "room", pitch: -8, yaw: 160, to: "entrance2", pitchBack: 0, yawBack: -20 },
];

const FIRST_SCENE = "entrance";

// =================================================================
// Neighbor map — which scenes are reachable directly from each scene.
// Drives the contextual filmstrip: only show what's actually through
// a door from where you're standing right now.
// =================================================================
function buildNeighborMap() {
  const map = {};
  Object.keys(SCENES).forEach(id => (map[id] = []));
  LINKS.forEach(link => {
    map[link.from].push(link.to);
    map[link.to].push(link.from);
  });
  return map;
}
const NEIGHBORS = buildNeighborMap();

// =================================================================
// Auto-generate pannellum hotspots from LINKS (both directions)
// =================================================================
function buildHotspotMap() {
  const bySceneId = {};
  Object.keys(SCENES).forEach(id => (bySceneId[id] = []));

  LINKS.forEach(link => {
    bySceneId[link.from].push({
      pitch: link.pitch,
      yaw: link.yaw,
      sceneId: link.to,
      label: link.label || `Go to ${SCENES[link.to].title}`
    });
    bySceneId[link.to].push({
      pitch: link.pitchBack,
      yaw: link.yawBack,
      sceneId: link.from,
      label: link.labelBack || `Go to ${SCENES[link.from].title}`
    });
  });

  return bySceneId;
}

function buildPannellumScenes() {
  const hotspotMap = buildHotspotMap();
  const out = {};
  for (const id of Object.keys(SCENES)) {
    const s = SCENES[id];
    out[id] = {
      title: s.title,
      type: "equirectangular",
      panorama: s.panorama,
      hotSpots: hotspotMap[id].map(h => ({
        pitch: h.pitch,
        yaw: h.yaw,
        type: "scene",
        sceneId: h.sceneId,
        cssClass: "wayfinder-hotspot",
        createTooltipFunc: createWayfinderHotspot,
        createTooltipArgs: { label: h.label }
      }))
    };
  }
  return out;
}

function createWayfinderHotspot(hotSpotDiv, args) {
  hotSpotDiv.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M12 3.5c-.9 2.6-3.3 6-7.5 8.5 4.2 2.5 6.6 5.9 7.5 8.5.9-2.6 3.3-6 7.5-8.5-4.2-2.5-6.6-5.9-7.5-8.5z"/></svg>
    <span class="wf-label">${args.label}</span>
  `;
}

// =================================================================
// Initialize viewer
// =================================================================
const viewer = pannellum.viewer("panorama", {
  default: {
    firstScene: FIRST_SCENE,
    author: "Luxury Resort",
    sceneFadeDuration: 900,
    autoLoad: true,
    compass: false,
    showControls: false,
    hfov: 100,
    minHfov: 50,
    maxHfov: 120,
    draggable: true,
    mouseZoom: true
  },
  scenes: buildPannellumScenes()
});

// Loader
const loaderEl = document.getElementById("tour-loader");
viewer.on("load", () => loaderEl.classList.add("hide"));

// Header sync
const sceneNameEl = document.getElementById("scene-name");
function setHeader(sceneId) { sceneNameEl.textContent = SCENES[sceneId].title; }
setHeader(FIRST_SCENE);
viewer.on("scenechange", setHeader);

// =================================================================
// Contextual filmstrip — shows ONLY the rooms reachable from the
// scene you're currently in (via LINKS), not every room in the tour.
// e.g. in the Entrance it shows just "Main Room"; in the Main Room
// it shows both "Entrance" and "Bathroom"; in the Bathroom, just
// "Main Room" again.
// =================================================================
const filmstrip = document.getElementById("filmstrip");
const arrowIcon = `<span class="film-arrow"><svg viewBox="0 0 24 24"><path d="M12 4l7 12H5z"/></svg></span>`;

function renderFilmstrip(sceneId) {
  filmstrip.innerHTML = "";
  NEIGHBORS[sceneId].forEach(neighborId => {
    const s = SCENES[neighborId];
    const thumb = document.createElement("button");
    thumb.className = "film-thumb";
    thumb.style.backgroundImage = `url(${s.panorama})`;
    thumb.setAttribute("aria-label", `Go to ${s.title}`);
    thumb.innerHTML = `${arrowIcon}<span>${s.title}</span>`;
    thumb.addEventListener("click", () => viewer.loadScene(neighborId));
    filmstrip.appendChild(thumb);
  });
}
renderFilmstrip(FIRST_SCENE);
viewer.on("scenechange", renderFilmstrip);

// =================================================================
// Floor-plan mini-map — built from SCENES[id].map + LINKS
// (shows the full property regardless of where you are, so people
// don't lose the big picture — the filmstrip stays contextual)
// =================================================================
const mapSvg = document.getElementById("map-svg");
const mapPanel = document.getElementById("map-panel");
const NS = "http://www.w3.org/2000/svg";

LINKS.forEach(link => {
  const a = SCENES[link.from].map, b = SCENES[link.to].map;
  const line = document.createElementNS(NS, "line");
  line.setAttribute("class", "map-link");
  line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
  line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
  mapSvg.appendChild(line);
});

const mapNodes = {};
Object.keys(SCENES).forEach(id => {
  const s = SCENES[id];
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "map-node" + (id === FIRST_SCENE ? " current" : ""));
  g.dataset.scene = id;

  const circle = document.createElementNS(NS, "circle");
  circle.setAttribute("cx", s.map.x);
  circle.setAttribute("cy", s.map.y);
  circle.setAttribute("r", 4.5);
  g.appendChild(circle);

  const label = document.createElementNS(NS, "text");
  label.setAttribute("x", s.map.x);
  label.setAttribute("y", s.map.y + 9);
  label.textContent = s.title;
  g.appendChild(label);

  g.addEventListener("click", () => viewer.loadScene(id));
  mapSvg.appendChild(g);
  mapNodes[id] = g;
});

function setActiveMapNode(sceneId) {
  Object.values(mapNodes).forEach(n => n.classList.remove("current"));
  mapNodes[sceneId].classList.add("current");
}
viewer.on("scenechange", setActiveMapNode);

const mapBtn = document.getElementById("map-btn");
mapBtn.addEventListener("click", () => {
  const open = mapPanel.classList.toggle("open");
  mapBtn.classList.toggle("active", open);
});

// =================================================================
// Compass — needle rotates opposite to yaw so it always points to
// where "forward" was when the scene loaded. Click recenters.
// =================================================================
const compassNeedle = document.getElementById("compass-needle");
const compassBtn = document.getElementById("compass");

function updateCompass() {
  const yaw = viewer.getYaw ? viewer.getYaw() : 0;
  compassNeedle.style.transform = `rotate(${-yaw}deg)`;
  requestAnimationFrame(updateCompass);
}
requestAnimationFrame(updateCompass);

compassBtn.addEventListener("click", () => {
  viewer.setYaw(0, true);
});

// =================================================================
// Zoom controls
// =================================================================
document.getElementById("zoom-in-btn").addEventListener("click", () => {
  viewer.setHfov(viewer.getHfov() - 12, 200);
});
document.getElementById("zoom-out-btn").addEventListener("click", () => {
  viewer.setHfov(viewer.getHfov() + 12, 200);
});

// =================================================================
// Fullscreen
// =================================================================
const fullscreenBtn = document.getElementById("fullscreen-btn");
fullscreenBtn.addEventListener("click", () => viewer.toggleFullscreen());
document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.classList.toggle("active", !!document.fullscreenElement);
});

// =================================================================
// Motion / gyroscope view (mobile)
// =================================================================
const gyroBtn = document.getElementById("gyro-btn");
let gyroOn = false;
gyroBtn.addEventListener("click", async () => {
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") return;
    } catch (e) { return; }
  }
  try {
    if (!gyroOn) { viewer.startOrientation(); gyroOn = true; }
    else { viewer.stopOrientation(); gyroOn = false; }
    gyroBtn.classList.toggle("active", gyroOn);
  } catch (e) {
    gyroBtn.disabled = true;
    gyroBtn.title = "Motion view not supported on this device";
  }
});

// =================================================================
// Drag hint
// =================================================================
const dragHint = document.getElementById("drag-hint");
function dismissHint() {
  dragHint.classList.add("hide");
  document.removeEventListener("pointerdown", dismissHint);
}
document.addEventListener("pointerdown", dismissHint);
setTimeout(dismissHint, 5000);
