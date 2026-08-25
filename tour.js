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
// (pitchBack/yawBack). No need to duplicate "back to X" by hand,
// and no need to manually keep both sides in sync.
// =================================================================
const LINKS = [
  { from: "entrance", pitch: -5,  yaw: 0,    to: "room",     pitchBack: -5, yawBack: -180 },
  { from: "room",     pitch: 0,   yaw: 90,   to: "bathroom", pitchBack: 0,  yawBack: -90  }

  // Adding a room is one line here, e.g.:
  // { from: "room", pitch: -8, yaw: 160, to: "entrance2", pitchBack: 0, yawBack: -20 },
];

const FIRST_SCENE = "entrance";

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
    <svg viewBox="0 0 100 58">
      <polygon class="wf-hex" points="50,4 90,20 90,38 50,54 10,38 10,20"/>
      <path class="wf-arrow" d="M50 20 L66 29 L50 38 L54 29 Z"/>
    </svg>
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

// =================================================================
// Right-edge scene list navigator
// =================================================================
const sceneList = document.getElementById("scene-list");
const sceneItems = {};
Object.keys(SCENES).forEach(id => {
  const s = SCENES[id];
  const item = document.createElement("button");
  item.className = "scene-item" + (id === FIRST_SCENE ? " active" : "");
  item.textContent = s.title;
  item.dataset.scene = id;
  item.addEventListener("click", () => viewer.loadScene(id));
  sceneList.appendChild(item);
  sceneItems[id] = item;
});
function setActiveSceneItem(sceneId) {
  Object.values(sceneItems).forEach(el => el.classList.remove("active"));
  sceneItems[sceneId].classList.add("active");
}
viewer.on("scenechange", setActiveSceneItem);

// =================================================================
// Floor-plan mini-map — built from SCENES[id].map + LINKS
// =================================================================
const mapSvg = document.getElementById("map-svg");
const mapPanel = document.getElementById("map-panel");
const NS = "http://www.w3.org/2000/svg";

// draw connecting lines first (so nodes sit on top)
LINKS.forEach(link => {
  const a = SCENES[link.from].map, b = SCENES[link.to].map;
  const line = document.createElementNS(NS, "line");
  line.setAttribute("class", "map-link");
  line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
  line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
  mapSvg.appendChild(line);
});

// draw one node per scene
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
  viewer.setYaw(0, true); // true = animated
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
