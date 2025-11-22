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

// ------------------ State ------------------
let clientsData = {};
let selectedClient = null;
let selectedSession = null;
let selectedExercise = null;
let swirlWidgets = [];
let isLinkedMode = true;
let editMode = false;

// ------------------ Navigation ------------------
const SCREENS = {
  CLIENTS: 'clientsDiv',
  SESSIONS: 'sessionsDiv',
  EXERCISES: 'exercisesDiv',
  SETS: 'setsDiv',
  GRAPH: 'graphContainer'
};
let currentScreen = SCREENS.CLIENTS;

function navigateTo(targetId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
    currentScreen = targetId;
    
    // Trigger render based on destination
    if(targetId === SCREENS.CLIENTS) renderClients();
    else if(targetId === SCREENS.SESSIONS) renderSessions();
    else if(targetId === SCREENS.EXERCISES) renderExercises();
    else if(targetId === SCREENS.SETS) renderSets();
}

// Back buttons
document.getElementById('backToClientsBtn').onclick = () => { selectedClient=null; navigateTo(SCREENS.CLIENTS); };
document.getElementById('backToSessionsBtn').onclick = () => { selectedSession=null; navigateTo(SCREENS.SESSIONS); };
document.getElementById('backToExercisesBtn').onclick = () => { selectedExercise=null; navigateTo(SCREENS.EXERCISES); };
document.getElementById('backToSetsFromGraphBtn').onclick = () => navigateTo(SCREENS.SETS);

// ------------------ Auth ------------------
auth.onAuthStateChanged(async (user) => {
    const modal = document.getElementById('loginModal');
    if (user) {
        modal.classList.add('hidden');
        document.getElementById('logoutBtn').classList.remove('hidden');
        document.getElementById('userLabel').textContent = user.displayName ? user.displayName.split(' ')[0] : 'User';
        await loadData();
        renderClients();
    } else {
        modal.classList.remove('hidden');
        document.getElementById('logoutBtn').classList.add('hidden');
        clientsData = {};
        renderClients();
    }
});

document.getElementById('modalLoginBtn').onclick = async () => {
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch(e) { alert(e.message); }
};
document.getElementById('logoutBtn').onclick = () => auth.signOut();

// ------------------ Firestore ------------------
async function loadData() {
    if(!auth.currentUser) return;
    const doc = await db.collection('clients').doc(auth.currentUser.uid).get();
    if(doc.exists) clientsData = doc.data();
    else { clientsData = {}; await saveData(); }
}
async function saveData() {
    if(!auth.currentUser) return;
    await db.collection('clients').doc(auth.currentUser.uid).set(clientsData);
}

// ------------------ Swirl Visualizer Logic ------------------
function getSpiralPoint(t, center={x:50, y:50}, maxRadius=42, coils=3) {
    const totalAngle = Math.PI * 2 * coils;
    const angle = t * totalAngle;
    const r = t * maxRadius;
    // -PI/2 rotates it so it starts at the top
    return { x: center.x + r * Math.cos(angle - Math.PI/2), y: center.y + r * Math.sin(angle - Math.PI/2) };
}

class SwirlWidget {
    constructor(containerId, metricKey, history, limit) {
        this.container = document.getElementById(containerId);
        this.metricKey = metricKey;
        
        // Slice data based on limit
        const startIdx = Math.max(0, history.length - limit);
        this.data = history.slice(startIdx);
        
        if(this.data.length === 0) {
            this.container.innerHTML = '<div style="text-align:center; color:#555; padding-top:40%;">No Data</div>';
            return;
        }

        this.startTime = this.data[0].timestamp;
        this.endTime = this.data[this.data.length - 1].timestamp;
        this.totalTime = this.endTime - this.startTime || 1;
        
        this.initSVG();
        this.setupInteraction();
        this.setVisualProgress(1.0); // Start at "Today"
    }

    calcStatus(curr, prev) {
        const c = curr.stats[this.metricKey], p = prev.stats[this.metricKey];
        return c > p ? 'increase' : (c < p ? 'decrease' : 'neutral');
    }

    initSVG() {
        this.pathPoints = [];
        let pathD = "";
        const resolution = 1200; // Reduced from 2000 for Mobile Performance
        let len = 0, prev = null;

        // 1. Generate Spiral Path
        for(let i=0; i<=resolution; i++) {
            const t = 0.15 + (i/resolution) * 0.85; // Don't start at exact center (too cluttered)
            const pt = getSpiralPoint(t);
            if(prev) len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
            this.pathPoints.push({ x: pt.x, y: pt.y, len });
            prev = pt;
            pathD += (i===0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
        }
        this.totalLength = len;

        // 2. Generate Color Segments
        let segmentsHTML = '';
        this.dataSegments = [];
        
        if(this.data.length > 1) {
            for(let i=1; i<this.data.length; i++) {
                const pData = this.data[i-1], cData = this.data[i];
                
                const tStart = (pData.timestamp - this.startTime) / this.totalTime;
                const tEnd = (cData.timestamp - this.startTime) / this.totalTime;
                const lStart = tStart * this.totalLength;
                const lEnd = tEnd * this.totalLength;

                // Extract sub-path for color
                let segD = "";
                let started = false;
                // Optimization: Simple linear scan is fine for 1200 pts on modern mobile
                for(let pt of this.pathPoints) {
                    if(pt.len >= lStart && pt.len <= lEnd) {
                        segD += (started ? ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
                        started = true;
                    }
                }
                
                const status = this.calcStatus(cData, pData);
                segmentsHTML += `<path d="${segD}" class="spiral-segment ${status}" />`;
                
                this.dataSegments.push({ start: lStart, end: lEnd, current: cData, prev: pData });
            }
        }

        const maskId = `mask-${this.metricKey}`;
        this.container.innerHTML = `
            <svg viewBox="0 0 100 100" style="width:100%; height:100%; overflow:visible;">
                <defs>
                    <mask id="${maskId}">
                        <path id="mask-path-${this.metricKey}" d="${pathD}" stroke="white" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="0 10000" />
                    </mask>
                </defs>
                <path d="${pathD}" class="spiral-base-track" />
                <g mask="url(#${maskId})">${segmentsHTML}</g>
                <circle id="ball-${this.metricKey}" r="4" class="spiral-ball" />
            </svg>
        `;
        
        this.maskPath = this.container.querySelector(`#mask-path-${this.metricKey}`);
        this.ball = this.container.querySelector(`#ball-${this.metricKey}`);
    }

    setupInteraction() {
        const handler = (e) => {
            // STOP PROPAGATION to prevent page swipe/scroll while scrubbing graph
            e.stopPropagation();
            if(e.cancelable && e.type === 'touchmove') e.preventDefault();

            const svg = this.container.querySelector('svg');
            let pt = svg.createSVGPoint();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            pt.x = clientX; pt.y = clientY;
            const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());

            // Find closest point on spiral
            let closest = this.pathPoints[0], minDist = Infinity;
            for(let p of this.pathPoints) {
                const d = (cursor.x - p.x)**2 + (cursor.y - p.y)**2;
                if(d < minDist) { minDist = d; closest = p; }
            }

            const pct = closest.len / this.totalLength;
            
            if(isLinkedMode) swirlWidgets.forEach(w => w.setVisualProgress(pct));
            else this.setVisualProgress(pct);
        };

        const area = this.container.parentElement.querySelector('.swirl-visual-area');
        area.addEventListener('touchstart', handler, { passive: false });
        area.addEventListener('touchmove', handler, { passive: false });
        area.addEventListener('mousemove', handler);
        area.addEventListener('click', handler);
    }

    setVisualProgress(pct) {
        const len = pct * this.totalLength;
        this.maskPath.style.strokeDasharray = `${len} 10000`;
        
        let target = this.pathPoints.find(p => p.len >= len) || this.pathPoints[this.pathPoints.length-1];
        this.ball.setAttribute('transform', `translate(${target.x}, ${target.y})`);
        
        // Update Text
        const seg = this.dataSegments.find(s => len >= s.start && len < s.end) || 
                   (len >= this.totalLength*0.99 ? this.dataSegments[this.dataSegments.length-1] : this.dataSegments[0]);
        
        if(seg) this.updateText(seg.current, seg.prev);
        else if(this.data.length===1) this.updateText(this.data[0], null);
    }

    updateText(curr, prev) {
        const valEl = document.getElementById(`val-${this.metricKey}`);
        const dateEl = document.getElementById(`date-${this.metricKey}`);
        const diffEl = document.getElementById(`diff-${this.metricKey}`);
        const arrowEl = document.getElementById(`arrow-${this.metricKey}`);
        const card = document.getElementById(`card-${this.metricKey}`);
        
        dateEl.textContent = new Date(curr.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'});
        
        let val = curr.stats[this.metricKey];
        if(this.metricKey === 'volume') val = Math.round(val);
        if(this.metricKey === 'wpr') val = val.toFixed(1);
        valEl.textContent = val;

        // Reset colors
        card.querySelectorAll('.data-footer span').forEach(s => s.className = '');
        diffEl.className = 'data-diff'; arrowEl.className = 'arrow-icon';

        if(!prev || curr === prev) {
            diffEl.textContent = ''; arrowEl.innerHTML = '';
            return;
        }

        const status = this.calcStatus(curr, prev);
        const pVal = prev.stats[this.metricKey];
        const diff = val - pVal;
        const sign = diff > 0 ? '+' : '';
        
        arrowEl.innerHTML = status === 'increase' ? '&#8593;' : (status === 'decrease' ? '&#8595;' : '');
        diffEl.textContent = `(${sign}${this.metricKey==='wpr'?diff.toFixed(1):Math.round(diff)})`;
        
        const colorClass = status; // increase/decrease/neutral
        valEl.classList.add(colorClass);
        diffEl.classList.add(colorClass);
        arrowEl.classList.add(colorClass);
    }
}

// ------------------ Data Processing & Rendering ------------------

// Helper: Text Animation
function animateText(element, text, colorData) {
    element.innerHTML = '';
    if(!text) return;
    
    let colors = [];
    if(colorData && colorData.total > 0) {
        let {green, red, yellow} = colorData;
        for(let i=0; i<text.length; i++) {
            if(green>0) { colors.push('var(--color-green)'); green--; }
            else if(red>0) { colors.push('var(--color-red)'); red--; }
            else { colors.push('var(--color-yellow)'); }
        }
        // Shuffle colors
        for(let i=colors.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [colors[i], colors[j]] = [colors[j], colors[i]]; }
    }

    [...text].forEach((char, i) => {
        const span = document.createElement('span');
        span.textContent = char === ' ' ? '\u00A0' : char;
        span.className = 'char';
        if(colors[i]) {
            span.style.color = colors[i];
            // Add animation class based on color
            if(colors[i].includes('green')) span.classList.add('animate-up');
            if(colors[i].includes('red')) span.classList.add('animate-down');
        }
        // Apply global mood animation
        let mood = 'calm';
        if(colorData && colorData.green > colorData.red) mood = 'happy';
        if(colorData && colorData.red > colorData.green) mood = 'sad';
        span.classList.add(`${mood}-${(i%3)+1}`);
        
        element.appendChild(span);
    });
}

function getColorData(item, type) {
    // Recursively count stats for sessions/clients
    let res = { red:0, green:0, yellow:0, total:0 };
    
    if(type === 'exercise') {
        const sets = item.sets || [];
        if(sets.length < 2) return res;
        // Simple check: Compare last set vs second to last
        // Note: Real implementation should group by day, but this is a visual approximation
        const s1 = sets[sets.length-1], s2 = sets[sets.length-2];
        if(s1.volume > s2.volume) res.green++; else if(s1.volume < s2.volume) res.red++; else res.yellow++;
        res.total = 1;
    }
    // Aggregation logic could be expanded here for Client/Session levels
    return res; 
}

// Render Sets (Specific Logic)
function renderSets() {
    const tbody = document.querySelector('#setsTable tbody');
    tbody.innerHTML = '';
    const titleSpan = document.getElementById('exerciseSetsTitleSpan');
    
    if(!selectedExercise) { titleSpan.textContent = 'Exercise'; return; }
    animateText(titleSpan, selectedExercise.exercise, getColorData(selectedExercise, 'exercise'));

    // 1. Prepare Data for Visualizer
    const rawSets = selectedExercise.sets || [];
    const sorted = rawSets.slice().sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Group by day
    const days = {};
    sorted.forEach(s => {
        const d = new Date(s.timestamp).toDateString();
        if(!days[d]) days[d] = { date: s.timestamp, sets: [] };
        days[d].sets.push(s);
    });
    
    const history = Object.values(days).map(d => {
        const sets = d.sets.length;
        const reps = d.sets.reduce((a,b) => a + (parseInt(b.reps)||0), 0);
        const vol = d.sets.reduce((a,b) => a + (parseFloat(b.volume)||0), 0);
        return {
            timestamp: new Date(d.date).getTime(),
            stats: { sets, reps, volume: vol, wpr: reps?vol/reps:0 }
        };
    });

    // 2. Init Visualizer
    const limit = parseInt(document.getElementById('historySelect').value);
    swirlWidgets = [];
    if(history.length) {
        swirlWidgets.push(new SwirlWidget('swirl-sets', 'sets', history, limit));
        swirlWidgets.push(new SwirlWidget('swirl-reps', 'reps', history, limit));
        swirlWidgets.push(new SwirlWidget('swirl-volume', 'volume', history, limit));
        swirlWidgets.push(new SwirlWidget('swirl-wpr', 'wpr', history, limit));
    }

    // 3. Render Table (Newest first)
    rawSets.slice().reverse().forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${rawSets.length - i}</td>
            <td class="editable" data-key="reps">${s.reps}</td>
            <td class="editable" data-key="weight">${s.weight}</td>
            <td>${(s.reps*s.weight).toFixed(0)}</td>
            <td class="editable" data-key="notes">${s.notes || ''}</td>
            <td style="color:#666; font-size:0.75rem">${new Date(s.timestamp).toLocaleDateString()}</td>
            <td><button class="btn-delete">&times;</button></td>
        `;
        
        // Edit Handlers
        tr.querySelectorAll('.editable').forEach(td => {
            td.onclick = (e) => {
                if(!editMode) return;
                e.stopPropagation();
                const k = td.dataset.key;
                const val = prompt(`Edit ${k}`, s[k]);
                if(val !== null) {
                    if(k === 'notes') s[k] = val;
                    else s[k] = parseFloat(val) || 0;
                    s.volume = s.reps * s.weight;
                    saveData(); renderSets();
                }
            };
        });
        
        // Delete Handler
        tr.querySelector('.btn-delete').onclick = (e) => {
            e.stopPropagation();
            confirmDelete('Delete Set?', () => {
                const idx = selectedExercise.sets.indexOf(s);
                if(idx > -1) selectedExercise.sets.splice(idx, 1);
                saveData(); renderSets();
            });
        };
        tbody.appendChild(tr);
    });
}

// Render Clients/Sessions/Exercises (Simplified for brevity, logic follows same pattern)
function renderClients() {
    const list = document.getElementById('clientList');
    list.innerHTML = '';
    for(let k in clientsData) {
        const li = document.createElement('li');
        const span = document.createElement('span');
        animateText(span, k, {green:1, red:0, yellow:0, total:1}); // Dummy colors
        li.appendChild(span);
        li.onclick = () => { if(!editMode) { selectedClient=k; navigateTo(SCREENS.SESSIONS); } };
        const btn = document.createElement('button'); btn.className='btn-delete'; btn.innerHTML='&times;';
        btn.onclick = (e) => { e.stopPropagation(); confirmDelete('Delete Client?', ()=>{ delete clientsData[k]; saveData(); renderClients(); }); };
        li.appendChild(btn);
        list.appendChild(li);
    }
}

function renderSessions() {
    const list = document.getElementById('sessionList');
    list.innerHTML = '';
    if(!selectedClient) return;
    (clientsData[selectedClient].sessions||[]).forEach((sess, i) => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        animateText(span, sess.session_name, null);
        li.appendChild(span);
        li.onclick = () => { if(!editMode) { selectedSession=sess; navigateTo(SCREENS.EXERCISES); } };
        const btn = document.createElement('button'); btn.className='btn-delete'; btn.innerHTML='&times;';
        btn.onclick = (e) => { e.stopPropagation(); confirmDelete('Delete Session?', ()=>{ clientsData[selectedClient].sessions.splice(i,1); saveData(); renderSessions(); }); };
        li.appendChild(btn);
        list.appendChild(li);
    });
}

function renderExercises() {
    const list = document.getElementById('exerciseList');
    list.innerHTML = '';
    if(!selectedSession) return;
    (selectedSession.exercises||[]).forEach((ex, i) => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        animateText(span, ex.exercise, getColorData(ex, 'exercise'));
        li.appendChild(span);
        li.onclick = () => { if(!editMode) { selectedExercise=ex; navigateTo(SCREENS.SETS); } };
        const btn = document.createElement('button'); btn.className='btn-delete'; btn.innerHTML='&times;';
        btn.onclick = (e) => { e.stopPropagation(); confirmDelete('Delete Exercise?', ()=>{ selectedSession.exercises.splice(i,1); saveData(); renderExercises(); }); };
        li.appendChild(btn);
        list.appendChild(li);
    });
}

// ------------------ UI Actions ------------------
document.getElementById('editToggleBtn').onclick = function() {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode-active', editMode);
    this.textContent = editMode ? 'Done' : 'Edit';
    this.classList.toggle('active');
    // Refresh current screen
    if(currentScreen === SCREENS.CLIENTS) renderClients();
    if(currentScreen === SCREENS.SESSIONS) renderSessions();
    if(currentScreen === SCREENS.EXERCISES) renderExercises();
    if(currentScreen === SCREENS.SETS) renderSets();
};

document.getElementById('addClientBtn').onclick = () => { const n = prompt('Name:'); if(n) { clientsData[n] = {sessions:[]}; saveData(); renderClients(); }};
document.getElementById('addSessionBtn').onclick = () => { const n = prompt('Name:'); if(n) { clientsData[selectedClient].sessions.push({session_name:n, exercises:[], date:new Date().toISOString()}); saveData(); renderSessions(); }};
document.getElementById('addExerciseBtn').onclick = () => { const n = prompt('Name:'); if(n) { selectedSession.exercises.push({exercise:n, sets:[]}); saveData(); renderExercises(); }};
document.getElementById('addSetBtn').onclick = () => {
    if(!selectedExercise) return;
    const last = selectedExercise.sets[selectedExercise.sets.length-1] || {reps:10, weight:135};
    const r = prompt('Reps', last.reps);
    const w = prompt('Weight', last.weight);
    if(r&&w) {
        selectedExercise.sets.push({reps:parseInt(r), weight:parseFloat(w), volume: r*w, notes:'', timestamp:new Date().toISOString()});
        saveData(); renderSets();
    }
};

// Modal Logic
const delModal = document.getElementById('deleteModal');
let confirmCallback = null;
function confirmDelete(msg, cb) {
    document.getElementById('deleteModalMessage').textContent = msg;
    confirmCallback = cb;
    delModal.classList.remove('hidden');
}
document.getElementById('deleteCancelBtn').onclick = () => delModal.classList.add('hidden');
document.getElementById('deleteConfirmBtn').onclick = () => { if(confirmCallback) confirmCallback(); delModal.classList.add('hidden'); };

// Visualizer Controls
document.getElementById('linkToggle').onclick = function() { isLinkedMode=!isLinkedMode; this.classList.toggle('active'); };
document.getElementById('historySelect').onchange = () => renderSets();

// Global Swipe Back (Mobile)
let tsX = 0, tsY = 0;
document.body.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; tsY = e.touches[0].clientY; }, {passive:true});
document.body.addEventListener('touchend', e => {
    const dX = e.changedTouches[0].clientX - tsX;
    const dY = e.changedTouches[0].clientY - tsY;
    if(tsX < 50 && dX > 80 && Math.abs(dY) < 50) {
        // Simple back logic
        if(currentScreen === SCREENS.SESSIONS) navigateTo(SCREENS.CLIENTS);
        if(currentScreen === SCREENS.EXERCISES) navigateTo(SCREENS.SESSIONS);
        if(currentScreen === SCREENS.SETS) navigateTo(SCREENS.EXERCISES);
        if(currentScreen === SCREENS.GRAPH) navigateTo(SCREENS.SETS);
    }
});
