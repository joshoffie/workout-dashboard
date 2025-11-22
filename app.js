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

// ------------------ NAVIGATION ------------------
const SCREENS = {
  CLIENTS: 'clientsDiv',
  SESSIONS: 'sessionsDiv',
  EXERCISES: 'exercisesDiv',
  SETS: 'setsDiv',
  GRAPH: 'graphContainer'
};

let currentScreen = SCREENS.CLIENTS;

function navigateTo(targetScreenId) {
  const targetScreen = document.getElementById(targetScreenId);
  const currentScreenEl = document.getElementById(currentScreen);
  
  if (!targetScreen || targetScreen === currentScreenEl) return;

  // Simple display toggle to prevent animation crashes on low-end devices
  currentScreenEl.classList.add('hidden');
  targetScreen.classList.remove('hidden');
  currentScreen = targetScreenId;

  // Re-render specific screens
  if (targetScreenId === SCREENS.CLIENTS) renderClients();
  if (targetScreenId === SCREENS.SESSIONS) renderSessions();
  if (targetScreenId === SCREENS.EXERCISES) renderExercises();
  if (targetScreenId === SCREENS.SETS) renderSets();
}

document.getElementById('backToClientsBtn').onclick = () => {
  selectedClient = null;
  navigateTo(SCREENS.CLIENTS);
};
document.getElementById('backToSessionsBtn').onclick = () => {
  selectedSession = null;
  navigateTo(SCREENS.SESSIONS);
};
document.getElementById('backToExercisesBtn').onclick = () => {
  selectedExercise = null;
  navigateTo(SCREENS.EXERCISES);
};
document.getElementById('backToSetsFromGraphBtn').onclick = () => {
  navigateTo(SCREENS.SETS);
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
    userLabel.textContent = user.displayName ? `User: ${user.displayName}` : "Logged In";
    await loadUserJson();
    renderClients();
  } else {
    modal.classList.remove("hidden");
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userLabel.textContent = "";
    clientsData = {};
    renderClients();
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
  deleteConfirmBtn.onclick = () => {
    onConfirm();
    deleteModal.classList.add('hidden');
  };
}
deleteCancelBtn.onclick = () => deleteModal.classList.add('hidden');

// ------------------ FIRESTORE ------------------
async function loadUserJson() {
  if (!auth.currentUser) return;
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
  await db.collection("clients").doc(auth.currentUser.uid).set(clientsData);
}

// ------------------ RENDER CLIENTS (CRASH PROOF VERSION) ------------------
// Removed all complex animation/color logic from here to prevent home screen freeze
function renderClients() {
  const list = document.getElementById("clientList");
  list.innerHTML = "";
  
  for (const name in clientsData) {
    const li = document.createElement("li");
    // Simple clean text
    li.innerHTML = `<span>${name}</span>`;
    
    // Navigation
    li.onclick = (e) => {
      if (editMode) return;
      selectedClient = name;
      renderSessions();
      navigateTo(SCREENS.SESSIONS);
    };

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete';
    delBtn.innerHTML = '&times;';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Delete client "${name}"?`, () => {
        delete clientsData[name];
        saveUserJson();
        renderClients();
      });
    };
    
    li.appendChild(delBtn);
    list.appendChild(li);
  }
  hookEditables();
}

document.getElementById("addClientBtn").onclick = () => {
  const name = prompt("Client Name:");
  if (name && !clientsData[name]) {
    clientsData[name] = { client_name: name, sessions: [] };
    saveUserJson();
    renderClients();
  }
};

// ------------------ SESSIONS ------------------
function renderSessions() {
  const list = document.getElementById("sessionList");
  list.innerHTML = "";
  if (!selectedClient || !clientsData[selectedClient]) return;

  const sessions = clientsData[selectedClient].sessions || [];
  
  sessions.forEach((sess, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${sess.session_name}</span>`;
    
    li.onclick = (e) => {
      if (editMode) return;
      selectedSession = sess;
      renderExercises();
      navigateTo(SCREENS.EXERCISES);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete';
    delBtn.innerHTML = '&times;';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Delete "${sess.session_name}"?`, () => {
        sessions.splice(idx, 1);
        saveUserJson();
        renderSessions();
      });
    };

    li.appendChild(delBtn);
    list.appendChild(li);
  });
  hookEditables();
}

document.getElementById("addSessionBtn").onclick = () => {
  if (!selectedClient) return;
  const name = prompt("Session Name:");
  if (name) {
    clientsData[selectedClient].sessions.push({ session_name: name, exercises: [], date: new Date().toISOString() });
    saveUserJson();
    renderSessions();
  }
};

// ------------------ EXERCISES ------------------
function renderExercises() {
  const list = document.getElementById("exerciseList");
  list.innerHTML = "";
  if (!selectedSession) return;

  const exercises = selectedSession.exercises || [];
  
  exercises.forEach((ex, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${ex.exercise}</span>`;
    
    li.onclick = (e) => {
      if (editMode) return;
      selectedExercise = ex;
      renderSets();
      navigateTo(SCREENS.SETS);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete';
    delBtn.innerHTML = '&times;';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Delete "${ex.exercise}"?`, () => {
        exercises.splice(idx, 1);
        saveUserJson();
        renderExercises();
      });
    };

    li.appendChild(delBtn);
    list.appendChild(li);
  });
  hookEditables();
}

document.getElementById("addExerciseBtn").onclick = () => {
  if (!selectedSession) return;
  const name = prompt("Exercise Name:");
  if (name) {
    selectedSession.exercises.push({ exercise: name, sets: [] });
    saveUserJson();
    renderExercises();
  }
};

// ------------------ SETS ------------------
function renderSets() {
  const tbody = document.querySelector("#setsTable tbody");
  tbody.innerHTML = "";
  if (!selectedExercise) return;

  // Sort sets by date descending for the table
  const sets = (selectedExercise.sets || []).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Update Title
  document.getElementById('exerciseSetsTitle').textContent = selectedExercise.exercise;

  sets.forEach((s, idx) => {
    const tr = document.createElement("tr");
    const dateStr = new Date(s.timestamp).toLocaleDateString() + " " + new Date(s.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    tr.innerHTML = `
        <td>${sets.length - idx}</td>
        <td>${s.reps}</td>
        <td>${s.weight}</td>
        <td>${s.volume}</td>
        <td>${s.notes || ''}</td>
        <td style="font-size:0.7rem; color:#666;">${dateStr}</td>
        <td><button class="btn-delete" data-idx="${idx}">&times;</button></td>
    `;
    
    // Delete Handler
    tr.querySelector('.btn-delete').onclick = (e) => {
        e.stopPropagation();
        const realIdx = selectedExercise.sets.indexOf(s);
        if (realIdx > -1) {
            showDeleteConfirm("Delete this set?", () => {
                selectedExercise.sets.splice(realIdx, 1);
                saveUserJson();
                renderSets();
            });
        }
    };
    tbody.appendChild(tr);
  });

  hookEditables();
  
  // Initialize Swirl Widgets with slight delay to ensure Canvas is ready
  setTimeout(updateHistoryDepth, 100);
}

document.getElementById("addSetBtn").onclick = () => {
  if (!selectedExercise) return;
  
  // Get defaults from last set
  let lastReps = "", lastWeight = "";
  if (selectedExercise.sets.length > 0) {
      const last = selectedExercise.sets[selectedExercise.sets.length - 1];
      lastReps = last.reps;
      lastWeight = last.weight;
  }

  const reps = prompt("Reps:", lastReps);
  if (reps === null) return;
  const weight = prompt("Weight:", lastWeight);
  if (weight === null) return;
  const notes = prompt("Notes:", "");

  selectedExercise.sets.push({
      reps: parseInt(reps) || 0,
      weight: parseFloat(weight) || 0,
      volume: (parseInt(reps)||0) * (parseFloat(weight)||0),
      notes: notes || "",
      timestamp: new Date().toISOString()
  });
  
  saveUserJson();
  renderSets();
};

// =========================================================
//  NEW CANVAS SWIRL ENGINE (MOBILE OPTIMIZED)
// =========================================================

let widgets = [];
let isLinkedMode = true;

// --- Toggle Handlers ---
document.getElementById('linkToggle').onclick = function() {
    isLinkedMode = !isLinkedMode;
    this.classList.toggle('active', isLinkedMode);
    this.querySelector('span').textContent = isLinkedMode ? '🔗 Link' : '🔓 Unlink';
};

document.getElementById('historySelect').onchange = function() {
    updateHistoryDepth();
};

// --- Data Helper ---
function processHistory(exercise) {
    if(!exercise || !exercise.sets) return [];
    
    // 1. Flatten and sort
    const allSets = exercise.sets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // 2. Group by Day
    const days = {};
    allSets.forEach(s => {
        const d = new Date(s.timestamp);
        if(isNaN(d.getTime())) return;
        const key = d.toDateString();
        if(!days[key]) days[key] = { date: d, sets: [] };
        days[key].sets.push(s);
    });
    
    // 3. Aggregate
    return Object.values(days).map(day => {
        const totalReps = day.sets.reduce((acc, s) => acc + (Number(s.reps)||0), 0);
        const totalVol = day.sets.reduce((acc, s) => acc + (Number(s.volume)||0), 0);
        const count = day.sets.length;
        
        return {
            date: day.date,
            timestamp: day.date.getTime(),
            stats: {
                sets: count,
                reps: totalReps,
                volume: totalVol,
                wpr: totalReps > 0 ? parseFloat((totalVol / totalReps).toFixed(1)) : 0
            }
        };
    }).sort((a, b) => a.timestamp - b.timestamp);
}

function updateHistoryDepth() {
    if(!selectedExercise) return;
    
    const limit = parseInt(document.getElementById('historySelect').value);
    const fullHistory = processHistory(selectedExercise);
    
    // Limit history
    const start = Math.max(0, fullHistory.length - limit);
    const history = fullHistory.slice(start);
    
    widgets = [];
    if(history.length > 0) {
        widgets.push(new CanvasSwirl('canvas-sets', 'sets', history));
        widgets.push(new CanvasSwirl('canvas-reps', 'reps', history));
        widgets.push(new CanvasSwirl('canvas-volume', 'volume', history));
        widgets.push(new CanvasSwirl('canvas-wpr', 'wpr', history));
    }
}

// --- THE CANVAS CLASS ---
class CanvasSwirl {
    constructor(canvasId, metric, data) {
        this.canvas = document.getElementById(canvasId);
        this.metric = metric;
        this.data = data;
        
        // Parent Card for Text Updates
        this.card = this.canvas.closest('.swirl-card');
        
        // Setup Canvas Resolution (High DPI)
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.scale(dpr, dpr);
        
        // Dimensions
        this.width = rect.width;
        this.height = rect.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        
        // Pre-calculate Path
        this.generatePath();
        
        // Interaction State
        this.progress = 1.0; // 0 to 1
        this.setupEvents();
        
        // Initial Draw
        this.draw();
        this.updateText(1.0);
    }
    
    generatePath() {
        this.path = [];
        // Spiral Config
        const coils = 2.25;
        const maxRadius = Math.min(this.width, this.height) * 0.4;
        const points = 100; // Enough for smooth lines on canvas
        
        for (let i = 0; i <= points; i++) {
            const t = i / points; // 0 to 1
            // Linear spiral equation
            // r = a + b * angle
            const angle = t * Math.PI * 2 * coils - (Math.PI / 2); // Start at top
            const r = 10 + (t * (maxRadius - 10)); // Inner hole size 10
            
            this.path.push({
                x: this.centerX + r * Math.cos(angle),
                y: this.centerY + r * Math.sin(angle),
                t: t // Store normalized position
            });
        }
    }
    
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        // 1. Draw Base Track (Grey)
        ctx.beginPath();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        this.path.forEach((p, i) => {
            if(i===0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        
        // 2. Draw Colored Segments
        // We draw segments that fall within 'this.progress'
        if(this.data.length > 1) {
            for(let i=1; i<this.data.length; i++) {
                const prev = this.data[i-1];
                const curr = this.data[i];
                
                // Map Time to Path T (0..1)
                const tStart = (i-1) / (this.data.length - 1);
                const tEnd = i / (this.data.length - 1);
                
                // Determine Color
                const valCurr = curr.stats[this.metric];
                const valPrev = prev.stats[this.metric];
                let color = '#ffcc00'; // Neutral
                if(valCurr > valPrev) color = '#34c759'; // Green
                if(valCurr < valPrev) color = '#ff3b30'; // Red
                
                // Draw Segment IF visible
                if (this.progress > tStart) {
                    // Calculate how much of this segment to draw
                    // Clamp tEnd based on progress
                    const drawEndT = Math.min(this.progress, tEnd);
                    
                    this.drawSegment(tStart, drawEndT, color);
                }
            }
        } else {
            // Single point data - just draw a dot in center?
            // Or generic color
        }
        
        // 3. Draw Ball
        const ballPos = this.getPointAtT(this.progress);
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.arc(ballPos.x, ballPos.y, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
    }
    
    drawSegment(tStart, tEnd, color) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 6; // Thicker than track
        ctx.lineCap = 'round';
        
        let started = false;
        
        // Simple scan through path points
        for(let i=0; i<this.path.length; i++) {
            const p = this.path[i];
            if(p.t >= tStart && p.t <= tEnd) {
                if(!started) {
                    ctx.moveTo(p.x, p.y);
                    started = true;
                } else {
                    ctx.lineTo(p.x, p.y);
                }
            }
        }
        // Ensure we connect the exact endpoints for precision
        const pEnd = this.getPointAtT(tEnd);
        ctx.lineTo(pEnd.x, pEnd.y);
        
        ctx.stroke();
    }
    
    getPointAtT(t) {
        // Find path segment index
        const index = t * (this.path.length - 1);
        const i = Math.floor(index);
        const subT = index - i; // Interpolation factor
        
        const p1 = this.path[i];
        const p2 = this.path[Math.min(i+1, this.path.length-1)];
        
        return {
            x: p1.x + (p2.x - p1.x) * subT,
            y: p1.y + (p2.y - p1.y) * subT
        };
    }
    
    setupEvents() {
        const updateFromEvent = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            let clientX = e.touches ? e.touches[0].clientX : e.clientX;
            let clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            
            // Find closest T on path
            let bestT = 0;
            let minDst = Infinity;
            
            // Coarse search
            for(let p of this.path) {
                const dst = (x - p.x)**2 + (y - p.y)**2;
                if(dst < minDst) {
                    minDst = dst;
                    bestT = p.t;
                }
            }
            
            this.progress = bestT;
            
            if(isLinkedMode) {
                widgets.forEach(w => {
                    w.progress = bestT;
                    w.draw();
                    w.updateText(bestT);
                });
            } else {
                this.draw();
                this.updateText(bestT);
            }
        };
        
        this.canvas.addEventListener('mousemove', (e) => { if(e.buttons === 1) updateFromEvent(e); });
        this.canvas.addEventListener('touchmove', updateFromEvent, {passive: false});
        this.canvas.addEventListener('touchstart', updateFromEvent, {passive: false});
        this.canvas.addEventListener('click', updateFromEvent);
    }
    
    updateText(t) {
        // Map T to Data Index
        if(this.data.length === 0) return;
        
        const idx = Math.round(t * (this.data.length - 1));
        const curr = this.data[idx];
        const prev = (idx > 0) ? this.data[idx-1] : curr;
        
        // DOM Updates
        const dateEl = this.card.querySelector('.data-date');
        const valEl = this.card.querySelector('.data-row span:first-child');
        const arrowEl = this.card.querySelector('.stat-arrow');
        const diffEl = this.card.querySelector('.data-diff');
        
        const d = new Date(curr.date);
        dateEl.textContent = (idx === this.data.length-1) ? "Today" : d.toLocaleDateString(undefined, {month:'short', day:'numeric'});
        
        const val = curr.stats[this.metric];
        valEl.textContent = val;
        if(this.metric === 'volume') valEl.textContent += " lb";
        if(this.metric === 'wpr') valEl.textContent += " lb/r";
        
        // Diff
        let colorClass = 'neutral';
        let arrow = '—';
        let diffText = '';
        
        if(curr !== prev) {
            const prevVal = prev.stats[this.metric];
            const diff = val - prevVal;
            const pct = prevVal !== 0 ? Math.round((diff/prevVal)*100) : 0;
            
            if(val > prevVal) { colorClass = 'increase'; arrow = '↑'; }
            if(val < prevVal) { colorClass = 'decrease'; arrow = '↓'; }
            
            const sign = diff > 0 ? '+' : '';
            diffText = `(${sign}${diff.toFixed(1)} / ${pct}%)`;
        }
        
        // Apply Colors
        valEl.className = colorClass;
        arrowEl.className = `stat-arrow ${colorClass}`;
        arrowEl.textContent = arrow;
        diffEl.className = `data-diff ${colorClass}`;
        diffEl.textContent = diffText;
    }
}

// ------------------ EDIT MODE ------------------
let editMode = false;
const editToggleBtn = document.getElementById("editToggleBtn");

editToggleBtn.onclick = () => {
  editMode = !editMode;
  editToggleBtn.textContent = editMode ? "Done" : "Edit";
  document.body.classList.toggle('edit-mode-active');
  if (!editMode) saveUserJson();
};

// ------------------ GENERIC EDITABLE HANDLER ------------------
function hookEditables() {
    const makeEditable = (el, type, callback) => {
        el.classList.add('editable');
        el.onclick = (e) => {
            if(!editMode) return;
            e.stopPropagation();
            const newVal = prompt(`Edit ${type}:`, el.innerText);
            if(newVal && newVal !== el.innerText) {
                callback(newVal);
            }
        };
    };

    // Clients
    document.querySelectorAll('#clientList li span').forEach(span => {
        makeEditable(span, 'Client Name', (val) => {
            const oldKey = span.innerText;
            const data = clientsData[oldKey];
            delete clientsData[oldKey];
            data.client_name = val;
            clientsData[val] = data;
            saveUserJson();
            renderClients();
        });
    });
    
    // Sessions
    if(selectedClient) {
        document.querySelectorAll('#sessionList li span').forEach((span, idx) => {
            makeEditable(span, 'Session Name', (val) => {
                clientsData[selectedClient].sessions[idx].session_name = val;
                saveUserJson();
                renderSessions();
            });
        });
    }
    
    // Exercises
    if(selectedSession) {
        document.querySelectorAll('#exerciseList li span').forEach((span, idx) => {
            makeEditable(span, 'Exercise Name', (val) => {
                selectedSession.exercises[idx].exercise = val;
                saveUserJson();
                renderExercises();
            });
        });
    }
}
