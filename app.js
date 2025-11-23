// ------------------ Firebase Config ------------------
const firebaseConfig = {
  apiKey: "AIzaSyAywTTfFa6K7heVmkOUQDKpGJbeAbJ_8a8",
  authDomain: "free-workout-tracker.firebaseapp.com",
  projectId: "free-workout-tracker",
  storageBucket: "free-workout-tracker.firebasestorage.app",
  messagingSenderId: "797968203224",
  appId: "1:797968203224:web:0409faf864741f9e5c86ad",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let clientsData = {};
let selectedClient = null;
let selectedSession = null;
let selectedExercise = null;

// =====================================================
// ANIMATION CONFIGURATION
// =====================================================

const ANIMATION_CLASSES = {
  happy: ['happy-1', 'happy-2', 'happy-3'],
  sad: ['sad-1', 'sad-2', 'sad-3'],
  calm: ['calm-1', 'calm-2', 'calm-3'],
};

// Global state
let currentAnimationClass = 'calm-1'; 

function getRandomAnimationClass(mood) {
  const classes = ANIMATION_CLASSES[mood] || ANIMATION_CLASSES.calm;
  return classes[Math.floor(Math.random() * classes.length)];
}

// ------------------ NAVIGATION ------------------

const SCREENS = {
  CLIENTS: 'clientsDiv',
  SESSIONS: 'sessionsDiv',
  EXERCISES: 'exercisesDiv',
  SETS: 'setsDiv',
  GRAPH: 'graphContainer'
};

let currentScreen = SCREENS.CLIENTS;

function navigateTo(targetScreenId, direction = 'forward') {
  const targetScreen = document.getElementById(targetScreenId);
  const currentScreenEl = document.getElementById(currentScreen);
  
  if (!targetScreen || targetScreen === currentScreenEl) return;

  // Re-render to trigger animations
  switch (targetScreenId) {
    case SCREENS.CLIENTS: renderClients(); break;
    case SCREENS.SESSIONS: renderSessions(); break;
    case SCREENS.EXERCISES: renderExercises(); break;
    case SCREENS.SETS: renderSets(); break;
  }

  const enterClass = (direction === 'forward') ? 'slide-in-right' : 'slide-in-left';
  const exitClass = (direction === 'forward') ? 'slide-out-left' : 'slide-out-right';

  targetScreen.classList.remove('hidden', 'slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  targetScreen.classList.add(enterClass);

  currentScreenEl.classList.remove('slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  currentScreenEl.classList.add(exitClass);

  currentScreen = targetScreenId;

  currentScreenEl.addEventListener('animationend', () => {
    currentScreenEl.classList.add('hidden');
    currentScreenEl.classList.remove(exitClass);
  }, { once: true });

  targetScreen.addEventListener('animationend', () => {
    targetScreen.classList.remove(enterClass);
  }, { once: true });
}

// ... (Existing button listeners) ...
document.getElementById('backToClientsBtn').onclick = () => {
  selectedClient = null;
  selectedSession = null;
  selectedExercise = null;
  renderClients();
  navigateTo(SCREENS.CLIENTS, 'back');
};
document.getElementById('backToSessionsBtn').onclick = () => {
  selectedSession = null;
  selectedExercise = null;
  renderSessions();
  navigateTo(SCREENS.SESSIONS, 'back');
};
document.getElementById('backToExercisesBtn').onclick = () => {
  selectedExercise = null;
  renderExercises();
  navigateTo(SCREENS.EXERCISES, 'back');
};
document.getElementById('backToSetsFromGraphBtn').onclick = () => {
  navigateTo(SCREENS.SETS, 'back');
};

// ------------------ AUTH ------------------
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");
const modal = document.getElementById("loginModal");
const modalLoginBtn = document.getElementById("modalLoginBtn");

const deleteModal = document.getElementById('deleteModal');
const deleteModalMessage = document.getElementById('deleteModalMessage');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');

auth.onAuthStateChanged(async (user) => {
  if (user) {
    modal.classList.add("hidden");
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userLabel.textContent = `Logged in as ${user.displayName}`;
    await loadUserJson();
    renderClients();
  } else {
    modal.classList.remove("hidden");
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userLabel.textContent = "";
    clientsData = {};
    selectedClient = null;
    renderClients();
    hideAllDetails();
  }
});

modalLoginBtn.onclick = async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (err) {
    alert("Login failed: " + err.message);
  }
};

logoutBtn.onclick = async () => {
  await auth.signOut();
};

function showDeleteConfirm(message, onConfirm) {
  deleteModalMessage.textContent = message;
  deleteModal.classList.remove('hidden');
  deleteConfirmBtn.addEventListener('click', () => {
    onConfirm();
    hideDeleteConfirm();
  }, { once: true });
  deleteCancelBtn.addEventListener('click', () => {
    hideDeleteConfirm();
  }, { once: true });
}

function hideDeleteConfirm() {
  deleteModal.classList.add('hidden');
}
deleteCancelBtn.onclick = hideDeleteConfirm;

// ------------------ FIRESTORE DATA ------------------
async function loadUserJson() {
  const uid = auth.currentUser.uid;
  const docRef = db.collection("clients").doc(uid);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    clientsData = docSnap.data();
  } else {
    clientsData = {};
    await docRef.set(clientsData);
  }
}

async function saveUserJson() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  await db.collection("clients").doc(uid).set(clientsData);
}

// ... (Animation Helpers Omitted for brevity - assume existing) ... 
function setTextAsChars(element, text) {
  element.innerHTML = '';
  if (!text || text.trim() === '') {
      const span = document.createElement('span');
      span.className = 'char';
      span.innerHTML = '&nbsp;';
      element.appendChild(span);
      return;
  }
  for (let char of text) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = char;
    if (char === ' ') {
        span.innerHTML = '&nbsp;';
    }
    element.appendChild(span);
  }
}

function applyTitleStyling(element, text, colorData) {
    // ... existing code ...
    setTextAsChars(element, text);
    // (Assuming same logic as before)
}

function setupListTextAnimation(element, text, colorData) {
    // ... existing code ...
    setTextAsChars(element, text);
    // (Assuming same logic as before)
}

function getExerciseColorData(exercise) {
  if (!exercise.sets || exercise.sets.length < 2) {
      return { red: 0, green: 0, yellow: 0, total: 0 };
  }
  const allSets = exercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const mostRecentDate = new Date(allSets[0].timestamp);
  const currentDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), mostRecentDate));
  const previousWorkoutSet = allSets.find(set => !isSameDay(new Date(set.timestamp), mostRecentDate));

  if (!previousWorkoutSet) {
      return { red: 0, green: 0, yellow: 0, total: 0 };
  }

  const previousWorkoutDate = new Date(previousWorkoutSet.timestamp);
  const previousDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), previousWorkoutDate));

  const currentStats = aggregateStats(currentDaySets);
  const prevStats = aggregateStats(previousDaySets);

  const statuses = [];
  statuses.push(calculateStatStatus(currentStats.sets, prevStats.sets));
  statuses.push(calculateStatStatus(currentStats.reps, prevStats.reps));
  statuses.push(calculateStatStatus(currentStats.volume, prevStats.volume));
  statuses.push(calculateStatStatus(currentStats.wpr, prevStats.wpr));

  const red = statuses.filter(s => s === 'decrease').length;
  const green = statuses.filter(s => s === 'increase').length;
  const yellow = statuses.filter(s => s === 'neutral').length;
  return { red, green, yellow, total: statuses.length };
}

function calculateStatStatus(currentValue, previousValue) {
  const epsilon = 0.01;
  if (currentValue > previousValue + epsilon) return 'increase';
  if (currentValue < previousValue - epsilon) return 'decrease';
  return 'neutral';
}

// ------------------ RENDER CLIENTS ------------------
const clientList = document.getElementById("clientList");
function renderClients() {
  // ... existing renderClients logic ...
  clientList.innerHTML = "";
  for (const name in clientsData) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${name}</span><button class="btn-delete">&times;</button>`;
      li.onclick = () => selectClient(name);
      clientList.appendChild(li);
  }
  hookEditables();
}

// ... (Other render functions omitted for brevity but should remain) ...

document.getElementById("addClientBtn").onclick = () => {
  const name = prompt("Enter client name:");
  if (!name) return;
  if (clientsData[name]) { alert("Client already exists."); return; }
  clientsData[name] = { client_name: name, sessions: [] };
  saveUserJson();
  renderClients();
};

function selectClient(name) {
  selectedClient = name;
  selectedSession = null;
  selectedExercise = null;
  renderSessions();
  navigateTo(SCREENS.SESSIONS, 'forward');
}

// ... (Sessions and Exercises Logic) ...
const sessionList = document.getElementById("sessionList");
function renderSessions() {
    sessionList.innerHTML = "";
    if (!selectedClient) return;
    (clientsData[selectedClient].sessions || []).forEach(sess => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${sess.session_name}</span><button class="btn-delete">&times;</button>`;
        li.onclick = () => selectSession(sess);
        sessionList.appendChild(li);
    });
    hookEditables();
}
function selectSession(s) {
    selectedSession = s;
    renderExercises();
    navigateTo(SCREENS.EXERCISES, 'forward');
}

const exerciseList = document.getElementById("exerciseList");
function renderExercises() {
    exerciseList.innerHTML = "";
    if (!selectedSession) return;
    (selectedSession.exercises || []).forEach((ex, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${ex.exercise}</span><button class="btn-delete">&times;</button>`;
        li.onclick = () => selectExercise(idx);
        exerciseList.appendChild(li);
    });
    hookEditables();
}
function selectExercise(idx) {
    selectedExercise = selectedSession.exercises[idx];
    renderSets();
    navigateTo(SCREENS.SETS, 'forward');
}

// ------------------ SETS ------------------
const setsTable = document.querySelector("#setsTable tbody");

function renderSets() {
  setsTable.innerHTML = "";
  if (!selectedExercise) return;

  const sortedSets = selectedExercise.sets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const setsByDay = new Map();
  sortedSets.forEach(set => {
    const setDate = new Date(set.timestamp);
    const dayString = setDate.toDateString();
    if (!setsByDay.has(dayString)) setsByDay.set(dayString, []);
    setsByDay.get(dayString).push(set);
  });

  const sortedDays = Array.from(setsByDay.keys()).sort((a, b) => new Date(b) - new Date(a));
  const renderedSetsInOrder = [];

  sortedDays.forEach((dayString, dayIndex) => {
    const daySets = setsByDay.get(dayString);
    daySets.forEach((s, setIdx) => {
      const tr = document.createElement("tr");
      if (setIdx === daySets.length - 1 && dayIndex < sortedDays.length - 1) {
        tr.classList.add("day-end-row");
      }
      const originalIndex = selectedExercise.sets.indexOf(s);
      tr.innerHTML = `
        <td>${setIdx + 1}</td>
        <td>${s.reps}</td>
        <td>${s.weight}</td>
        <td>${s.volume}</td>
        <td>${s.notes}</td>
        <td>${new Date(s.timestamp).toLocaleString()}</td>
      `;
      const deleteTd = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        showDeleteConfirm(`Are you sure?`, () => {
          selectedExercise.sets.splice(originalIndex, 1);
          saveUserJson();
          renderSets();
        });
      };
      deleteTd.appendChild(deleteBtn);
      tr.appendChild(deleteTd);
      setsTable.appendChild(tr);
      renderedSetsInOrder.push(s);
    });
  });

  hookEditables(renderedSetsInOrder);
  runComparisonLogic();

  // === INITIALIZE SPIRAL WIDGET ===
  if (typeof SpiralWidget !== 'undefined') {
      SpiralWidget.init(selectedExercise.sets);
  }
}

document.getElementById("addSetBtn").onclick = () => {
    if (!selectedExercise) { alert("Select an exercise first"); return; }
    let reps = prompt("Reps:");
    let weight = prompt("Weight:");
    if (reps && weight) {
        selectedExercise.sets.push({ 
            reps: parseInt(reps), 
            weight: parseFloat(weight), 
            volume: parseInt(reps)*parseFloat(weight), 
            notes: "", 
            timestamp: new Date().toISOString() 
        });
        saveUserJson();
        renderSets();
    }
};

// ... (Graph and Helper functions) ...
function hideAllDetails() {
    // ...
}
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}
function aggregateStats(setsArray) {
  if (!setsArray || setsArray.length === 0) {
    return { sets: 0, reps: 0, volume: 0, wpr: 0 };
  }
  const totalSets = setsArray.length;
  const totalReps = setsArray.reduce((sum, set) => sum + set.reps, 0);
  const totalVolume = setsArray.reduce((sum, set) => sum + set.volume, 0);
  const avgWpr = totalReps > 0 ? (totalVolume / totalReps) : 0;
  return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
}
function formatNum(num) {
  if (num % 1 === 0) return num.toString();
  return num.toFixed(1);
}
function updateStatUI(statName, currentValue, previousValue) {
  const arrowEl = document.getElementById(statName + 'Arrow');
  const dataEl = document.getElementById(statName + 'Data');
  if (!arrowEl || !dataEl) return;

  const status = calculateStatStatus(currentValue, previousValue);
  let arrow = '—';
  if (status === 'increase') arrow = '&uarr;';
  else if (status === 'decrease') arrow = '&darr;';
  
  const change = currentValue - previousValue;
  let percentageChange = 0;
  if (previousValue !== 0) percentageChange = (change / previousValue) * 100;
  else if (currentValue > 0) percentageChange = 100;

  let label = statName === 'volume' ? 'lb' : (statName === 'wpr' ? 'lb/rep' : statName);
  let currentString = `${formatNum(currentValue)} ${label}`;
  let changeSign = change > 0 ? '+' : '';
  let changeString = `(${changeSign}${formatNum(change)} / ${changeSign}${Math.abs(percentageChange).toFixed(0)}%)`;
  if (status === 'neutral') changeString = `(0 / 0%)`;
  
  arrowEl.innerHTML = arrow;
  arrowEl.className = `stat-arrow ${status}`;
  dataEl.textContent = `${currentString} ${changeString}`;
  dataEl.className = `stat-data ${status}`;
}

function runComparisonLogic() {
    // ... existing ...
    // Just ensures banner is visible
    const banner = document.getElementById('comparisonBanner');
    if(banner) banner.classList.remove('hidden');
}

// ... (Edit Mode & Swipe Logic) ...
let editMode = false;
function hookEditables() {} // Stub

// ============================================================
// SPIRAL WIDGET CONTROLLER (MOBILE OPTIMIZED)
// ============================================================
const SpiralWidget = {
    svg: null,
    data: [],
    visibleData: [],
    range: 'all',
    
    CX: 250, CY: 250, START_RADIUS: 30,
    OFFSETS: { sets: -21, reps: -7, vol: 7, wpr: 21 },
    
    isDragging: false,
    hitLookup: [],
    visualPoints: [],
    totalLen: 0,
    listenersAttached: false,

    init: function(rawSets) {
        this.svg = document.getElementById('spiralCanvas');
        if(!this.svg) return;
        
        this.data = this.processData(rawSets);
        
        if (!this.listenersAttached) {
            this.attachListeners();
            this.listenersAttached = true;
        }
        this.setRange(this.range);
    },

    processData: function(sets) {
        if (!sets || sets.length === 0) return [];
        const groups = {};
        sets.forEach(s => {
            const d = new Date(s.timestamp).toDateString();
            if(!groups[d]) groups[d] = [];
            groups[d].push(s);
        });
        const history = Object.values(groups).map(daySets => {
            daySets.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
            const totalVol = daySets.reduce((sum, s) => sum + (s.reps * s.weight), 0);
            const totalReps = daySets.reduce((sum, s) => sum + s.reps, 0);
            const avgWpr = totalReps > 0 ? (totalVol / totalReps) : 0;
            return {
                timestamp: new Date(daySets[0].timestamp).getTime(),
                sets: daySets.length,
                reps: totalReps,
                volume: totalVol,
                wpr: parseFloat(avgWpr.toFixed(1))
            };
        });
        return history.sort((a,b) => a.timestamp - b.timestamp);
    },

    setRange: function(range) {
        this.range = range;
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('active');
            if(b.textContent.toLowerCase().includes(range) || (range==='all' && b.textContent==='All')) 
                b.classList.add('active');
        });

        const now = new Date().getTime();
        let days = 3650;
        if(range === '4w') days = 28;
        if(range === '8w') days = 56;
        if(range === '12w') days = 84;
        
        const cutoff = now - (days * 24 * 60 * 60 * 1000);
        this.visibleData = this.data.filter(d => d.timestamp >= cutoff);

        let turns = 2.5;
        let pitch = 90;
        if (range === 'all') { turns = 3.8; pitch = 55; } 
        else {
            pitch = 90;
            if(range === '4w') turns = 1.3;
            else if(range === '8w') turns = 1.8;
            else if(range === '12w') turns = 2.2;
        }
        this.draw(turns, pitch);
    },

    draw: function(turns, pitch) {
        const segmentsG = document.getElementById('spiralSegments');
        const markersG = document.getElementById('markersGroup');
        if(!segmentsG || !markersG) return;
        segmentsG.innerHTML = '';
        markersG.innerHTML = '';

        const getPoint = (t, offset) => {
            const angle = t * Math.PI * 2 * turns;
            const r = this.START_RADIUS + (pitch * (angle / (Math.PI * 2))) + offset;
            return { x: this.CX + r * Math.cos(angle), y: this.CY + r * Math.sin(angle) };
        };
        
        const getPathD = (tEnd, offset) => {
            let d = "";
            const steps = 100;
            for(let i=0; i<=steps; i++) {
                const t = (i/steps) * tEnd;
                const p = getPoint(t, offset);
                d += (i===0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
            }
            return d;
        };

        ['bgTrack1','bgTrack2','bgTrack3','bgTrack4'].forEach((id, i) => {
            const offset = [this.OFFSETS.sets, this.OFFSETS.reps, this.OFFSETS.vol, this.OFFSETS.wpr][i];
            const el = document.getElementById(id);
            if(el) el.setAttribute('d', getPathD(1, offset));
        });

        const hitPath = document.getElementById('hitPath');
        hitPath.setAttribute('d', getPathD(1, 0));
        this.totalLen = hitPath.getTotalLength();
        
        this.hitLookup = [];
        for(let i=0; i<=200; i++) {
            const l = (i/200) * this.totalLen;
            const p = hitPath.getPointAtLength(l);
            this.hitLookup.push({l, x:p.x, y:p.y});
        }

        if (this.visibleData.length === 0) return;
        
        const oldest = this.visibleData[0].timestamp;
        const newest = this.visibleData[this.visibleData.length-1].timestamp;
        const span = newest - oldest || 1;

        this.visualPoints = [];

        this.visibleData.forEach((curr, i) => {
            const t = (curr.timestamp - oldest) / span;
            const p = getPoint(t, 0);
            const delay = (i / this.visibleData.length) * 1.0;

            this.visualPoints.push({x:p.x, y:p.y, idx:i, t});

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", p.x); circle.setAttribute("cy", p.y);
            circle.setAttribute("class", "workout-marker");
            circle.style.animation = `fadeInMarker 0.5s ease-out forwards`;
            circle.style.animationDelay = `${delay + 0.5}s`;
            markersG.appendChild(circle);

            if (i < this.visibleData.length - 1) {
                const next = this.visibleData[i+1];
                const tNext = (next.timestamp - oldest) / span;
                
                const drawSeg = (val1, val2, offset, extraDelay) => {
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    let d = "";
                    for(let k=0; k<=20; k++) {
                        const tStep = t + (k/20)*(tNext - t);
                        const pt = getPoint(tStep, offset);
                        d += (k===0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
                    }
                    path.setAttribute('d', d);
                    path.setAttribute('class', 'spiral-segment');
                    if(val2 > val1) path.classList.add('seg-increase');
                    else if(val2 < val1) path.classList.add('seg-decrease');
                    else path.classList.add('seg-neutral');
                    path.style.animation = `drawInSegment 0.4s ease-out forwards`;
                    path.style.animationDelay = `${delay + extraDelay}s`;
                    segmentsG.appendChild(path);
                };
                drawSeg(curr.sets, next.sets, this.OFFSETS.sets, 0);
                drawSeg(curr.reps, next.reps, this.OFFSETS.reps, 0.05);
                drawSeg(curr.volume, next.volume, this.OFFSETS.vol, 0.1);
                drawSeg(curr.wpr, next.wpr, this.OFFSETS.wpr, 0.15);
            }
        });

        this.updateBall(this.totalLen);
    },

    attachListeners: function() {
        const surface = this.svg; // Listen on entire SVG for fat finger support
        
        const start = (e) => {
            const pt = this.getSVGPoint(e);
            const closest = this.findClosestLen(pt.x, pt.y);
            // Distance check to allow scrolling if touching corners (60 SVG units)
            const dist = Math.sqrt((closest.x - pt.x)**2 + (closest.y - pt.y)**2);
            if (dist > 60) return; 

            this.isDragging = true;
            this.updateBall(closest.len);
        };
        
        const move = (e) => {
            if (!this.isDragging) return;
            if (e.cancelable) e.preventDefault(); 
            const pt = this.getSVGPoint(e);
            const closest = this.findClosestLen(pt.x, pt.y);
            this.updateBall(closest.len);
        };
        
        const end = () => { this.isDragging = false; };

        surface.addEventListener('mousedown', start);
        surface.addEventListener('touchstart', start, {passive: false});
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move, {passive: false});
        window.addEventListener('mouseup', end);
        window.addEventListener('touchend', end);
    },

    getSVGPoint: function(e) {
        const pt = this.svg.createSVGPoint();
        // Robustly handle Touch vs Mouse
        const src = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
        pt.x = src.clientX;
        pt.y = src.clientY;
        return pt.matrixTransform(this.svg.getScreenCTM().inverse());
    },

    findClosestLen: function(x, y) {
        let best = {len:0, x:0, y:0}, min = Infinity;
        for(let p of this.hitLookup) {
            const d = (p.x-x)**2 + (p.y-y)**2;
            if(d < min) { min = d; best = p; }
        }
        return best;
    },

    updateBall: function(len) {
        const pt = document.getElementById('hitPath').getPointAtLength(len);
        const ball = document.getElementById('timeBall');
        ball.setAttribute('cx', pt.x); ball.setAttribute('cy', pt.y);

        let bestIdx = 0, min = Infinity;
        this.visualPoints.forEach(vp => {
            const d = (vp.x-pt.x)**2 + (vp.y-pt.y)**2;
            if(d < min) { min=d; bestIdx = vp.idx; }
        });
        this.updateUI(bestIdx);
    },

    updateUI: function(idx) {
        const curr = this.visibleData[idx];
        const prev = idx > 0 ? this.visibleData[idx-1] : {sets:0, reps:0, volume:0, wpr:0};

        document.querySelectorAll('.workout-marker').forEach(m => m.classList.remove('active'));
        if (document.getElementById('markersGroup').children[idx]) 
            document.getElementById('markersGroup').children[idx].classList.add('active');

        const d = new Date(curr.timestamp);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const dateStr = d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
        document.getElementById('spiralDateDisplay').textContent = isToday ? "Today" : dateStr;

        if (typeof updateStatUI === 'function') {
            updateStatUI('sets', curr.sets, prev.sets);
            updateStatUI('reps', curr.reps, prev.reps);
            updateStatUI('volume', curr.volume, prev.volume);
            updateStatUI('wpr
