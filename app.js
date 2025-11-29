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

  switch (targetScreenId) {
    case SCREENS.CLIENTS: renderClients(); break;
    case SCREENS.SESSIONS: renderSessions();
    break;
    case SCREENS.EXERCISES: renderExercises(); break;
    case SCREENS.SETS: renderSets(); break;
  }

  const enterClass = (direction === 'forward') ?
  'slide-in-right' : 'slide-in-left';
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

// --- Wire up Back Buttons ---
document.getElementById('backToClientsBtn').onclick = () => {
  selectedClient = null; selectedSession = null;
  selectedExercise = null;
  renderClients(); navigateTo(SCREENS.CLIENTS, 'back');
};
document.getElementById('backToSessionsBtn').onclick = () => {
  selectedSession = null; selectedExercise = null;
  renderSessions();
  navigateTo(SCREENS.SESSIONS, 'back');
};
document.getElementById('backToExercisesBtn').onclick = () => {
  selectedExercise = null;
  renderExercises(); navigateTo(SCREENS.EXERCISES, 'back');
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
    // Force account selection even if logged in previously
    provider.setCustomParameters({ prompt: 'select_account' });
    
    await auth.signInWithPopup(provider);
  } catch (err) {
    alert("Login failed: " + err.message);
  }
};
logoutBtn.onclick = async () => { await auth.signOut(); };

function showDeleteConfirm(message, onConfirm) {
  deleteModalMessage.textContent = message;
  deleteModal.classList.remove('hidden');
  deleteConfirmBtn.addEventListener('click', () => { onConfirm(); hideDeleteConfirm(); }, { once: true });
  deleteCancelBtn.addEventListener('click', () => { hideDeleteConfirm(); }, { once: true });
}
function hideDeleteConfirm() { deleteModal.classList.add('hidden'); }
deleteCancelBtn.onclick = hideDeleteConfirm;
// ------------------ FIRESTORE DATA ------------------
async function loadUserJson() {
  const uid = auth.currentUser.uid;
  const docRef = db.collection("clients").doc(uid);
  const docSnap = await docRef.get();
  if (docSnap.exists) clientsData = docSnap.data();
  else { clientsData = {}; await docRef.set(clientsData);
  }
}

async function saveUserJson() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  await db.collection("clients").doc(uid).set(clientsData);
}

// ------------------ ANIMATED TITLE HELPERS ------------------
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
    if (char === ' ') span.innerHTML = '&nbsp;';
    element.appendChild(span);
  }
}

function applyTitleStyling(element, text, colorData) {
  if (!element) return;
  setTextAsChars(element, text);

  const parentTitle = element.closest('.animated-title');
  const targetElement = parentTitle ||
  element;
  
  const allClasses = [...ANIMATION_CLASSES.happy, ...ANIMATION_CLASSES.sad, ...ANIMATION_CLASSES.calm, 'happy', 'sad', 'calm'];
  targetElement.classList.remove(...allClasses);

  let mood = 'calm';
  if (colorData && colorData.total > 0) {
    const { red, green, yellow } = colorData;
    if (green > red && green > yellow) mood = 'happy';
    else if (red > green && red > yellow) mood = 'sad';
    else if (yellow > green && yellow > red) mood = 'calm';
  }

  const animClass = getRandomAnimationClass(mood);
  targetElement.classList.add(mood);
  if (!colorData || colorData.total === 0) {
    element.querySelectorAll('.char').forEach(char => {
      char.style.color = 'var(--color-text)';
      char.classList.remove(...allClasses);
    });
    return;
  }

  const { red, green, yellow, total } = colorData;
  const chars = element.querySelectorAll('.char');
  const numChars = chars.length;
  if (numChars === 0) return;

  const colors = [];
  let greenCount = Math.round((green / total) * numChars);
  let redCount = Math.round((red / total) * numChars);
  let yellowCount = Math.round((yellow / total) * numChars);
  while (greenCount + redCount + yellowCount < numChars) {
      if (green >= red && green >= yellow) greenCount++;
      else if (red >= green && red >= yellow) redCount++;
      else yellowCount++;
  }
  while (greenCount + redCount + yellowCount > numChars) {
      if (yellowCount > 0 && (yellow === 0 || (yellow <= red && yellow <= green))) yellowCount--;
      else if (redCount > 0 && (red === 0 || (red <= green && red <= yellow))) redCount--;
      else if (greenCount > 0) greenCount--;
      else if (yellowCount > 0 && yellow <= red) yellowCount--;
      else if (redCount > 0) redCount--;
      else if (greenCount > 0) greenCount--;
      else if (yellowCount > 0) yellowCount--;
      else if (redCount > 0) redCount--;
      else if (greenCount > 0) greenCount--;
  }

  for (let i = 0; i < greenCount; i++) colors.push('var(--color-green)');
  for (let i = 0; i < redCount; i++) colors.push('var(--color-red)');
  for (let i = 0; i < yellowCount; i++) colors.push('var(--color-yellow)');
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  chars.forEach((char, i) => {
    char.style.color = colors[i] || 'var(--color-text)';
    char.classList.add(animClass);
    if (animClass === 'calm-3') {
        if (colors[i] === 'var(--color-green)') char.classList.add('animate-up');
        if (colors[i] === 'var(--color-red)') char.classList.add('animate-down');
    }
  });
}

function setupListTextAnimation(element, text, colorData) {
  if (!element) return;
  setTextAsChars(element, text);
  if (!colorData || colorData.total === 0) {
    element.querySelectorAll('.char').forEach(char => {
      char.style.color = 'var(--color-text)';
    });
    return; 
  }

  const { red, green, yellow, total } = colorData;
  const chars = element.querySelectorAll('.char');
  const numChars = chars.length;
  const colors = [];
  let greenCount = Math.round((green / total) * numChars);
  let redCount = Math.round((red / total) * numChars);
  let yellowCount = Math.round((yellow / total) * numChars);

  while (greenCount + redCount + yellowCount < numChars) {
      if (green >= red && green >= yellow) greenCount++;
      else if (red >= green && red >= yellow) redCount++;
      else yellowCount++;
  }
  while (greenCount + redCount + yellowCount > numChars) {
      if (yellowCount > 0 && (yellow === 0 || (yellow <= red && yellow <= green))) yellowCount--;
      else if (redCount > 0 && (red === 0 || (red <= green && red <= yellow))) redCount--;
      else if (greenCount > 0) greenCount--;
      else if (yellowCount > 0 && yellow <= red) yellowCount--;
      else if (redCount > 0) redCount--;
      else if (greenCount > 0) greenCount--;
      else if (yellowCount > 0) yellowCount--;
      else if (redCount > 0) redCount--;
      else if (greenCount > 0) greenCount--;
  }

  for (let i = 0; i < greenCount; i++) colors.push('var(--color-green)');
  for (let i = 0; i < redCount; i++) colors.push('var(--color-red)');
  for (let i = 0; i < yellowCount; i++) colors.push('var(--color-yellow)');
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  chars.forEach((char, i) => {
    char.style.color = colors[i] || 'var(--color-text)';
    if (colors[i] === 'var(--color-green)') char.dataset.moveDirection = 'up'; 
    else if (colors[i] === 'var(--color-red)') char.dataset.moveDirection = 'down';
  });
  runAnimationLoop(element);
}

function runAnimationLoop(element) {
    const delay = 3000;
    setTimeout(() => {
        if (!document.body.contains(element)) return;
        const chars = element.querySelectorAll('.char');
        chars.forEach(char => {
            const dir = char.dataset.moveDirection;
            if (dir === 'up') char.classList.add('animate-up');
            if (dir === 'down') char.classList.add('animate-down');
        });
        setTimeout(() => {
  
            if (!document.body.contains(element)) return;
            chars.forEach(char => {
                char.classList.remove('animate-up', 'animate-down');
            });
            runAnimationLoop(element);
        }, 2000);
    }, delay);
}

function getExerciseColorData(exercise) {
  if (!exercise.sets || exercise.sets.length < 2) return { red: 0, green: 0, yellow: 0, total: 0 };
  const allSets = exercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const mostRecentDate = new Date(allSets[0].timestamp);
  const currentDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), mostRecentDate));
  const previousWorkoutSet = allSets.find(set => !isSameDay(new Date(set.timestamp), mostRecentDate));
  if (!previousWorkoutSet) return { red: 0, green: 0, yellow: 0, total: 0 };

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
  clientList.innerHTML = "";
  let totalAppColorData = { red: 0, green: 0, yellow: 0, total: 0 };
  for (const name in clientsData) {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    const nameSpan = document.createElement("span");
    let clientColorData = { red: 0, green: 0, yellow: 0, total: 0 };
    const sessions = clientsData[name].sessions || [];
    sessions.forEach(session => {
        const exercises = session.exercises || [];
        exercises.forEach(ex => {
            const cData = getExerciseColorData(ex);
            clientColorData.red += cData.red;
            clientColorData.green += cData.green;
            clientColorData.yellow += cData.yellow;
            clientColorData.total += cData.total;
    
        });
    });
    
    totalAppColorData.red += clientColorData.red;
    totalAppColorData.green += clientColorData.green;
    totalAppColorData.yellow += clientColorData.yellow;
    totalAppColorData.total += clientColorData.total;
    
    setupListTextAnimation(nameSpan, name, clientColorData);

    li.onclick = (e) => {
      if (editMode) { e.stopPropagation();
      return; }
      selectClient(name);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete client "${name}"?`, () => {
        delete clientsData[name]; saveUserJson(); renderClients();
        if (selectedClient === name) navigateTo(SCREENS.CLIENTS, 'back');
      });
    };

    li.appendChild(nameSpan); li.appendChild(deleteBtn);
    clientList.appendChild(li);
  }
  const clientsTitle = document.getElementById('clientsScreenTitle');
  applyTitleStyling(clientsTitle, 'Clients', totalAppColorData);
  hookEditables();
}

document.getElementById("addClientBtn").onclick = () => {
  const name = prompt("Enter client name:");
  if (!name) return;
  if (clientsData[name]) { alert("Client already exists."); return; }
  clientsData[name] = { client_name: name, sessions: [] };
  saveUserJson(); renderClients();
};
function selectClient(name) {
  selectedClient = name; selectedSession = null; selectedExercise = null;
  renderSessions(); navigateTo(SCREENS.SESSIONS, 'forward');
}

const sessionList = document.getElementById("sessionList");
function getSortedSessions(sessionsArray) {
  if (!sessionsArray) return [];
  return sessionsArray.slice().sort((a, b) => {
    let dateB = b.date ? new Date(b.date) : new Date(0);
    if (isNaN(dateB.getTime())) dateB = new Date(0);
    let dateA = a.date ? new Date(a.date) : new Date(0);
    if (isNaN(dateA.getTime())) dateA = new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
}

document.getElementById("addSessionBtn").onclick = () => {
  if (!selectedClient) { alert("Select a client first"); return;
  }
  const name = prompt("Enter session name:");
  if (!name) return;
  const session = { session_name: name, exercises: [], date: new Date().toISOString() };
  clientsData[selectedClient].sessions.push(session);
  saveUserJson(); renderSessions();
};
function renderSessions() {
  sessionList.innerHTML = "";
  if (!selectedClient) return;
  selectedSession = null;
  let clientTotalColorData = { red: 0, green: 0, yellow: 0, total: 0 };
  const sessions = clientsData[selectedClient]?.sessions || [];
  const sortedSessions = getSortedSessions(sessions);

  sortedSessions.forEach((sess, idx) => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    const nameSpan = document.createElement("span");
    
    let sessionColorData = { red: 0, green: 0, yellow: 0, total: 0 };
    const exercises = sess.exercises || [];
    exercises.forEach(ex => {
        const cData = getExerciseColorData(ex);
        sessionColorData.red += cData.red;
        sessionColorData.green += cData.green;
       
        sessionColorData.yellow += cData.yellow;
        sessionColorData.total += cData.total;
    });
    clientTotalColorData.red += sessionColorData.red;
    clientTotalColorData.green += sessionColorData.green;
    clientTotalColorData.yellow += sessionColorData.yellow;
    clientTotalColorData.total += sessionColorData.total;

    setupListTextAnimation(nameSpan, sess.session_name, sessionColorData);

    li.onclick = (e) => {
      if (editMode) { e.stopPropagation(); return; }
      selectSession(sess);
    };
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete session "${sess.session_name}"?`, () => {
        const sessionIndex = clientsData[selectedClient].sessions.findIndex(s => s === sess);
        if (sessionIndex > -1) { clientsData[selectedClient].sessions.splice(sessionIndex, 1); saveUserJson(); renderSessions(); }
        if (selectedSession === sess) navigateTo(SCREENS.SESSIONS, 'back');
      });
    };
    li.appendChild(nameSpan); li.appendChild(deleteBtn);
    sessionList.appendChild(li);
  });
  const sessionsTitle = document.getElementById('sessionsScreenTitle');
  applyTitleStyling(sessionsTitle, 'Sessions', clientTotalColorData);
  hookEditables();
}

function selectSession(sessionObject) {
  selectedSession = sessionObject;
  selectedExercise = null;
  renderExercises(); navigateTo(SCREENS.EXERCISES, 'forward');
}

const exerciseList = document.getElementById("exerciseList");
document.getElementById("addExerciseBtn").onclick = () => {
  if (!selectedSession) { alert("Select a session first"); return;
  }
  const name = prompt("Enter exercise name:");
  if (!name) return;
  const ex = { exercise: name, sets: [] };
  selectedSession.exercises.push(ex);
  saveUserJson(); renderExercises();
};

function renderExercises() {
  exerciseList.innerHTML = "";
  const sessionTitleElement = document.getElementById('sessionExercisesTitle');
  if (!selectedSession) { applyTitleStyling(sessionTitleElement, 'Exercises', null); return; }
  selectedExercise = null;
  let sessionColorData = { red: 0, green: 0, yellow: 0, total: 0 };
  selectedSession.exercises.forEach((ex, idx) => {
    const colorData = getExerciseColorData(ex);
    ex.colorData = colorData; 
    if (colorData) {
      sessionColorData.red += colorData.red;
      sessionColorData.green += colorData.green;
      sessionColorData.yellow += colorData.yellow;
      sessionColorData.total += colorData.total;
    }
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = ex.exercise;
    li.onclick = (e) => { if (editMode) { e.stopPropagation(); return; } 
    selectExercise(idx); };
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete exercise "${ex.exercise}"?`, () => {
        selectedSession.exercises.splice(idx, 1); saveUserJson(); renderExercises();
        if (selectedExercise === ex) navigateTo(SCREENS.EXERCISES, 'back');
      });
    };
    setupListTextAnimation(nameSpan, ex.exercise, colorData);
    li.appendChild(nameSpan); li.appendChild(deleteBtn);
    exerciseList.appendChild(li);
  });
  applyTitleStyling(sessionTitleElement, 'Exercises', sessionColorData);
  hookEditables();
}

function selectExercise(idx) {
  selectedExercise = selectedSession.exercises[idx];
  renderSets(); navigateTo(SCREENS.SETS, 'forward');
  document.getElementById("graphContainer").classList.add("hidden");
}

// ------------------ SPIRAL WIDGET LOGIC ------------------
const spiralState = {
    svg: null, hitPath: null, segmentsGroup: null, markersGroup: null, timeBall: null, dateDisplay: null,
    fullHistory: [], visibleHistory: [], hitPathLookup: [], workoutVisualPoints: [],
    totalLen: 0, isDragging: false, currentRange: '8w',
    CX: 250, CY: 250, START_RADIUS: 30, OFFSETS: { sets: -21, reps: -7, vol: 7, wpr: 21 },
    RADIAL_PITCH: 45, TURNS: 3.8,
    slider: null
};
function initSpiralElements() {
    if (spiralState.svg) return;
    spiralState.svg = document.getElementById('spiralCanvas');
    spiralState.hitPath = document.getElementById('hitPath');
    spiralState.segmentsGroup = document.getElementById('spiralSegments');
    spiralState.markersGroup = document.getElementById('markersGroup');
    spiralState.timeBall = document.getElementById('timeBall');
    spiralState.dateDisplay = document.getElementById('spiralDateDisplay');
    
    // RESTORED SLIDER HOOK
    spiralState.slider = document.getElementById('spiralSlider');
    if(spiralState.slider) {
        spiralState.slider.addEventListener('input', handleSliderMove);
    }

    if (spiralState.hitPath) {
        spiralState.hitPath.addEventListener('pointerdown', handleSpiralStart);
        spiralState.hitPath.addEventListener('pointermove', handleSpiralMove);
        spiralState.hitPath.addEventListener('pointerup', handleSpiralEnd);
        spiralState.hitPath.addEventListener('pointercancel', handleSpiralEnd);
    }
    document.getElementById('range4w').onclick = () => setSpiralRange('4w');
    document.getElementById('range8w').onclick = () => setSpiralRange('8w');
    document.getElementById('range12w').onclick = () => setSpiralRange('12w');
    document.getElementById('rangeAll').onclick = () => setSpiralRange('all');
}

function processSetsForSpiral(sets) {
    if (!sets || sets.length === 0) return [];
    const sorted = sets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const sessions = [];
    let currentSession = null;
    sorted.forEach(set => {
        const d = new Date(set.timestamp);
        const dayStr = d.toDateString();
        if (!currentSession || currentSession.dayStr !== dayStr) {
            if (currentSession) sessions.push(currentSession);
            currentSession = { dayStr: dayStr, timestamp: d.getTime(), sets: 0, reps: 0, volume: 0, rawSets: [] };
        }
        currentSession.sets++;
    
        currentSession.reps += (parseInt(set.reps) || 0);
        currentSession.volume += (parseFloat(set.volume) || 0);
        currentSession.rawSets.push(set);
    });
    if (currentSession) sessions.push(currentSession);
    sessions.forEach(s => { s.wpr = s.reps > 0 ? (s.volume / s.reps) : 0; });
    return sessions;
}

function getSpiralPoint(t, offset) {
    const totalAngle = Math.PI * 2 * spiralState.TURNS;
    const angle = t * totalAngle;
    const baseR = spiralState.START_RADIUS + (spiralState.RADIAL_PITCH * (angle / (Math.PI * 2)));
    const r = baseR + offset;
    return { x: spiralState.CX + r * Math.cos(angle), y: spiralState.CY + r * Math.sin(angle) };
}

function getSegmentD(tStart, tEnd, offset) {
    let d = "";
    const steps = 150;
    for(let i=0; i<=steps; i++) {
        const t = tStart + (i/steps) * (tEnd - tStart);
        const p = getSpiralPoint(t, offset);
        d += (i===0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
    }
    return d;
}

function getFullSpiralD(offset) {
    let d = "";
    const points = 1000;
    for(let i=0; i<=points; i++) {
        const t = i/points;
        const p = getSpiralPoint(t, offset);
        d += (i===0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
    }
    return d;
}

function setSpiralRange(range) {
    spiralState.currentRange = range;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById('range' + range.charAt(0).toUpperCase() + range.slice(1));
    if(activeBtn) activeBtn.classList.add('active');

    const now = new Date().getTime();
    let days = 3650;
    if(range === '4w') days = 28;
    if(range === '8w') days = 56;
    if(range === '12w') days = 84;
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    spiralState.visibleHistory = spiralState.fullHistory.filter(w => w.timestamp >= cutoff);
    if (range === 'all') { spiralState.RADIAL_PITCH = 52; spiralState.TURNS = 3.2;
    } 
    else {
        spiralState.RADIAL_PITCH = 90;
        if (range === '4w') spiralState.TURNS = 1.3;
        else if (range === '8w') spiralState.TURNS = 1.8;
        else if (range === '12w') spiralState.TURNS = 2.2;
    }
    redrawSpiral();
}

function redrawSpiral() {
    if (!spiralState.svg) return;
    spiralState.segmentsGroup.innerHTML = '';
    spiralState.markersGroup.innerHTML = '';
    document.getElementById('bgTrack1').setAttribute('d', getFullSpiralD(spiralState.OFFSETS.sets));
    document.getElementById('bgTrack2').setAttribute('d', getFullSpiralD(spiralState.OFFSETS.reps));
    document.getElementById('bgTrack3').setAttribute('d', getFullSpiralD(spiralState.OFFSETS.vol));
    document.getElementById('bgTrack4').setAttribute('d', getFullSpiralD(spiralState.OFFSETS.wpr));
    const hitD = getFullSpiralD(0);
    spiralState.hitPath.setAttribute('d', hitD);
    spiralState.totalLen = spiralState.hitPath.getTotalLength();
    
    spiralState.hitPathLookup = [];
    const res = 1000;
    for(let i=0; i<=res; i++) {
        const l = (i/res) * spiralState.totalLen;
        const pt = spiralState.hitPath.getPointAtLength(l);
        spiralState.hitPathLookup.push({ len: l, x: pt.x, y: pt.y });
    }

    if (!spiralState.visibleHistory || spiralState.visibleHistory.length === 0) { updateBallToLen(0); return;
    }

    const oldestTime = spiralState.visibleHistory[0].timestamp;
    const newestTime = spiralState.visibleHistory[spiralState.visibleHistory.length-1].timestamp;
    const timeSpan = newestTime - oldestTime || 1;
    spiralState.workoutVisualPoints = [];
    const totalSegments = spiralState.visibleHistory.length;
    const baseUnit = 3.5 / (totalSegments || 1);
    const tracks = { sets: [], reps: [], vol: [], wpr: [] };
    spiralState.visibleHistory.forEach((curr, i) => {
        const t = (curr.timestamp - oldestTime) / timeSpan;
        const p = getSpiralPoint(t, 0);
        let bestWpLen = 0, minWpDist = Infinity;
        for(let lp of spiralState.hitPathLookup) {
            const d = (lp.x - p.x)**2 + (lp.y - p.y)**2;
            if(d < minWpDist) { minWpDist = d; bestWpLen = lp.len; }
 
        }
        spiralState.workoutVisualPoints.push({ x: p.x, y: p.y, len: bestWpLen, index: i, data: curr });
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", p.x); circle.setAttribute("cy", p.y); circle.setAttribute("class", "workout-marker");
        spiralState.markersGroup.appendChild(circle);

        if(i === spiralState.visibleHistory.length - 1) return;
        const next = spiralState.visibleHistory[i+1];
        const tEnd = (next.timestamp - oldestTime) / timeSpan;
  
        tracks.sets.push(createSeg(curr.sets, next.sets, t, tEnd, spiralState.OFFSETS.sets, baseUnit));
        tracks.reps.push(createSeg(curr.reps, next.reps, t, tEnd, spiralState.OFFSETS.reps, baseUnit));
        tracks.vol.push(createSeg(curr.volume, next.volume, t, tEnd, spiralState.OFFSETS.vol, baseUnit));
        tracks.wpr.push(createSeg(curr.wpr, next.wpr, t, tEnd, spiralState.OFFSETS.wpr, baseUnit));
    });
    updateBallToLen(spiralState.totalLen);
    runTrack(tracks.sets); runTrack(tracks.reps); runTrack(tracks.vol); runTrack(tracks.wpr);
}

function createSeg(v1, v2, t1, t2, offset, baseUnit) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute('d', getSegmentD(t1, t2, offset));
    path.setAttribute('class', 'spiral-segment');
    const epsilon = 0.01; let speedFactor = 1.0;
    if (v2 > v1 + epsilon) { path.classList.add('seg-increase');
    speedFactor = 0.4; }
    else if (v2 < v1 - epsilon) { path.classList.add('seg-decrease'); speedFactor = 2.5;
    }
    else { path.classList.add('seg-neutral'); speedFactor = 1.0; }
    path.style.opacity = '0';
    spiralState.segmentsGroup.appendChild(path);
    return { el: path, duration: baseUnit * speedFactor };
}

function runTrack(segments, index = 0) {
    if (index >= segments.length) return;
    const segment = segments[index];
    const path = segment.el;
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.style.opacity = '0.9'; 
    const animation = path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: segment.duration * 1000, fill: 'forwards', easing: 'linear' });
    animation.onfinish = () => { runTrack(segments, index + 1); };
}

function updateSpiralData(sets) {
    initSpiralElements();
    spiralState.fullHistory = processSetsForSpiral(sets);
    setSpiralRange(spiralState.currentRange); 
    document.getElementById('comparisonBanner').classList.remove('hidden');
}

function getSVGC(evt) {
    const pt = spiralState.svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(spiralState.svg.getScreenCTM().inverse());
}
function getClosestLen(x, y) {
    let best = 0, min = Infinity;
    for(let p of spiralState.hitPathLookup) {
        const d = (p.x-x)**2 + (p.y-y)**2;
        if(d<min) { min=d; best=p.len; }
    }
    return best;
}
function getClosestDataIdx(currentLen) {
    let bestIdx = -1; let minDist = Infinity;
    spiralState.workoutVisualPoints.forEach((wp) => {
        const dist = Math.abs(currentLen - wp.len); 
        if(dist < minDist) { minDist = dist; bestIdx = wp.index; }
    });
    return bestIdx;
}
function updateBallToLen(len) {
    const pt = spiralState.hitPath.getPointAtLength(len);
    spiralState.timeBall.style.display = 'block'; 
    spiralState.timeBall.setAttribute('cx', pt.x); spiralState.timeBall.setAttribute('cy', pt.y);
    // SYNC SLIDER
    if(spiralState.slider && spiralState.totalLen > 0) {
        // Map length 0..totalLen -> 0..100
        const val = (len / spiralState.totalLen) * 100;
        spiralState.slider.value = val;
    }

    if (spiralState.workoutVisualPoints.length > 0) {
        const idx = getClosestDataIdx(len);
        updateDataByIndex(idx);
    }
}
function updateDataByIndex(idx) {
    // 1. Safety Check
    if (idx === -1 || !spiralState.visibleHistory[idx]) return;
    const curr = spiralState.visibleHistory[idx];
    const prev = idx > 0 ? spiralState.visibleHistory[idx-1] : { sets:0, reps:0, volume:0, wpr:0 };
    // 2. Highlight Spiral Marker
    document.querySelectorAll('.workout-marker').forEach(m => m.classList.remove('active'));
    if (spiralState.markersGroup.children[idx]) {
        spiralState.markersGroup.children[idx].classList.add('active');
    }

    // 3. Update Date Text
    const d = new Date(curr.timestamp);
    const dateStr = d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
    spiralState.dateDisplay.textContent = dateStr;
    // 4. Update Stats & Collect Statuses
    const stats = [];
    stats.push(updateStatUI('sets', curr.sets, prev.sets));
    stats.push(updateStatUI('reps', curr.reps, prev.reps));
    stats.push(updateStatUI('volume', curr.volume, prev.volume));
    stats.push(updateStatUI('wpr', curr.wpr, prev.wpr));

    // 5. CALCULATE MOOD COLOR
    let green = 0, red = 0, yellow = 0;
    stats.forEach(s => {
        if (s === 'increase') green++;
        else if (s === 'decrease') red++;
        else yellow++;
    });
    let finalColor = 'var(--color-primary)'; // Default Blue
    if (green > red && green >= yellow) {
        finalColor = 'var(--color-green)';
    } else if (red > green && red >= yellow) {
        finalColor = 'var(--color-red)';
    } else if (yellow > green && yellow > red) {
        finalColor = 'var(--color-yellow)';
    } else {
        if (green > 0 && green >= red) finalColor = 'var(--color-green)';
        else if (red > 0) finalColor = 'var(--color-red)';
    }

    // 6. APPLY COLOR TO SLIDER (Corrected)
    if (spiralState.slider) {
        spiralState.slider.style.setProperty('--thumb-color', finalColor);
    }
    
    // 7. ENSURE TIME BALL IS WHITE (Reset)
    spiralState.timeBall.style.fill = '#ffffff';
    spiralState.timeBall.style.filter = 'none';
}
const handleSpiralStart = (e) => { spiralState.isDragging = true; spiralState.hitPath.setPointerCapture(e.pointerId); const c = getSVGC(e); updateBallToLen(getClosestLen(c.x, c.y));
}
const handleSpiralMove = (e) => { if(!spiralState.isDragging) return; e.preventDefault(); const c = getSVGC(e); updateBallToLen(getClosestLen(c.x, c.y));
}
const handleSpiralEnd = (e) => { if (!spiralState.isDragging) return; spiralState.isDragging = false; spiralState.hitPath.releasePointerCapture(e.pointerId);
}

// NEW SLIDER HANDLER
const handleSliderMove = (e) => {
    const val = parseFloat(e.target.value);
    const len = (val / 100) * spiralState.totalLen;
    updateBallToLen(len);
}


// ------------------ SETS ------------------
const setsTable = document.querySelector("#setsTable tbody");
function getLastSet() {
    if (!selectedExercise || !selectedExercise.sets || selectedExercise.sets.length === 0) return null;
    const sortedSets = selectedExercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return sortedSets[0];
}

document.getElementById("addSetBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  const lastSet = getLastSet();
  const repsPrompt = lastSet ? lastSet.reps : "";
  const weightPrompt = lastSet ? lastSet.weight : "";
  let reps = prompt(`Reps (last: ${repsPrompt}):`);
  if (!reps || isNaN(reps)) return;
  reps = parseInt(reps);
  let weight = prompt(`Weight (last: ${weightPrompt}):`);
  if (!weight || isNaN(weight)) return;
  weight = parseFloat(weight);
  let notes = prompt("Notes:") || "";
  const timestamp = new Date().toISOString();
  const volume = reps * weight;

  selectedExercise.sets.push({ reps, weight, volume, notes, timestamp });
  saveUserJson(); renderSets();
};
function renderSets() {
  setsTable.innerHTML = "";
  if (!selectedExercise) return;
  updateSpiralData(selectedExercise.sets);
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
      tr.innerHTML = `<td>${setIdx + 1}</td><td>${s.reps}</td><td>${s.weight}</td><td>${s.volume}</td><td>${s.notes}</td><td>${new Date(s.timestamp).toLocaleString()}</td>`;
      const deleteTd = document.createElement('td');
      const deleteBtn = document.createElement('button');
    
      deleteBtn.className = 'btn-delete';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        showDeleteConfirm(`Are you sure you want to delete set ${setIdx + 1} from this day?`, () => {
          selectedExercise.sets.splice(originalIndex, 1);
          saveUserJson(); renderSets();
        });
      };
      deleteTd.appendChild(deleteBtn);
      tr.appendChild(deleteTd);
      setsTable.appendChild(tr);
      renderedSetsInOrder.push(s);
    });
  });
  hookEditables(renderedSetsInOrder);
  runTitleOnlyLogic();
}

// ------------------ CUSTOM MINIMAL GRAPH ENGINE ------------------
const chartState = {
    range: '12w',
    metrics: { wpr: true, reps: true, volume: false, sets: false },
    dataPoints: [],
    width: 0, height: 0
};
document.getElementById("showGraphBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  const sets = selectedExercise.sets;
  if (!sets || sets.length === 0) { alert("No sets to graph"); return; }
  navigateTo(SCREENS.GRAPH, 'forward');
  const graphTitle = document.getElementById('graphTitle');
  applyTitleStyling(graphTitle, selectedExercise.exercise, getExerciseColorData(selectedExercise));
  requestAnimationFrame(() => {
      initChart();
      drawChart();
  });
};

function initChart() {
    const stage = document.getElementById('chartStage');
    chartState.width = stage.clientWidth;
    chartState.height = stage.clientHeight;
}

function getChartData() {
    const now = new Date().getTime();
    let days = 3650;
    if(chartState.range === '4w') days = 28;
    if(chartState.range === '8w') days = 56;
    if(chartState.range === '12w') days = 84;
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    // Group sets by Day
    const dayMap = {};
    selectedExercise.sets.forEach(s => {
        const time = new Date(s.timestamp).getTime();
        if (time < cutoff) return;
        
        const dateKey = new Date(s.timestamp).toDateString();
        if (!dayMap[dateKey]) {
            dayMap[dateKey] = { timestamp: time, reps: 0, vol: 0, sets: 0 };
        }
        dayMap[dateKey].reps += (parseInt(s.reps) || 0);
 
        dayMap[dateKey].vol += (parseFloat(s.volume) || 0);
        dayMap[dateKey].sets += 1;
    });
    const points = Object.values(dayMap).map(d => {
        const wpr = d.reps > 0 ? d.vol / d.reps : 0;
        return { timestamp: d.timestamp, vol: d.vol, reps: d.reps, sets: d.sets, wpr: wpr };
    }).sort((a,b) => a.timestamp - b.timestamp);
    if(points.length === 0) return [];

    let maxReps = 0, maxVol = 0, maxWpr = 0, maxSets = 0;
    points.forEach(p => {
        if(p.reps > maxReps) maxReps = p.reps;
        if(p.vol > maxVol) maxVol = p.vol;
        if(p.wpr > maxWpr) maxWpr = p.wpr;
        if(p.sets > maxSets) maxSets = p.sets;
    });
    maxReps *= 1.1; maxVol *= 1.1; maxWpr *= 1.1; maxSets *= 1.1;
    const startTime = points[0].timestamp;
    const endTime = points[points.length-1].timestamp;
    const timeSpan = endTime - startTime || 1; 

    return points.map(p => {
        const xNorm = (p.timestamp - startTime) / timeSpan;
        const x = xNorm * chartState.width;
        return {
            x: x,
            yReps: maxReps ? chartState.height - ((p.reps / maxReps) * chartState.height) : chartState.height,
            yVol: maxVol ? chartState.height 
            - ((p.vol / maxVol) * chartState.height) : chartState.height,
            yWpr: maxWpr ? chartState.height - ((p.wpr / maxWpr) * chartState.height) : chartState.height,
            ySets: maxSets ? chartState.height - ((p.sets / maxSets) * chartState.height) : chartState.height,
            data: p
        };
    });
}

// UPDATED: Added Sprint Animation Logic + Leaf Spawner Hook
function drawChart() {
    // 1. STOP OLD LEAVES when redrawing
    stopLeafSpawner(); 

    chartState.dataPoints = getChartData();
    const points = chartState.dataPoints;
    const pointsGroup = document.getElementById('chartPoints');
    pointsGroup.innerHTML = '';
    document.getElementById('chartGrid').innerHTML = '';
    if (points.length < 1) return;

    const gridGroup = document.getElementById('chartGrid');
    for(let i=1; i<5; i++) {
        const x = (chartState.width / 5) * i;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x); line.setAttribute("y1", 0);
        line.setAttribute("x2", x); line.setAttribute("y2", chartState.height);
        line.setAttribute("class", "chart-grid-line");
        gridGroup.appendChild(line);
    }

    const buildPath = (key) => {
        return points.map((p, i) => {
            return (i === 0 ? 'M' : 'L') + ` ${p.x},${p[key]}`;
        }).join(' ');
    };

    const updateLine = (id, key, metricKey, colorClass) => {
        const el = document.getElementById(id);
        if (chartState.metrics[metricKey]) {
            el.setAttribute('d', buildPath(key));
            el.classList.add('active');
            points.forEach((p, idx) => {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", p.x); circle.setAttribute("cy", p[key]);
                circle.setAttribute("class", `chart-point ${colorClass}`);
                circle.dataset.idx = idx; 
                pointsGroup.appendChild(circle);
     
            });
            
            // TRIGGER SPRINT ANIMATION (SLOWER)
            const len = el.getTotalLength();
            el.style.strokeDasharray = len;
            el.style.strokeDashoffset = len;
            // Using WAAPI for smooth JS control
            el.animate([
                { strokeDashoffset: len },
                { strokeDashoffset: 0 }
            ], {
                duration: 2000, 
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)', 
                fill: 'forwards'
            });
        } else {
            el.classList.remove('active');
        }
    };
    updateLine('pathReps', 'yReps', 'reps', 'reps');
    updateLine('pathWpr', 'yWpr', 'wpr', 'wpr');
    updateLine('pathVol', 'yVol', 'volume', 'vol');
    updateLine('pathSets', 'ySets', 'sets', 'sets');
    if (points.length > 0) updateDetailView(points.length - 1);

    // 2. START LEAVES AFTER DELAY
    setTimeout(() => {
        // Only start if we are still on the graph screen
        if (currentScreen === SCREENS.GRAPH) {
             startLeafSpawner();
        }
    }, 2200);
}

const touchLayer = document.getElementById('touchLayer');
const handleInteraction = (clientX) => {
    const rect = touchLayer.getBoundingClientRect();
    const x = clientX - rect.left;
    let closestDist = Infinity;
    let closestIdx = -1;
    chartState.dataPoints.forEach((p, i) => {
        const dist = Math.abs(p.x - x);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });
    if (closestIdx !== -1) updateDetailView(closestIdx);
};

touchLayer.addEventListener('mousemove', (e) => handleInteraction(e.clientX));
touchLayer.addEventListener('touchmove', (e) => { e.preventDefault(); handleInteraction(e.touches[0].clientX); }, { passive: false });
touchLayer.addEventListener('touchstart', (e) => { e.preventDefault(); handleInteraction(e.touches[0].clientX); }, { passive: false });
function updateDetailView(idx) {
    const p = chartState.dataPoints[idx];
    if(!p) return;
    const cursor = document.getElementById('cursorLine');
    cursor.classList.remove('hidden');
    cursor.setAttribute('x1', p.x);
    cursor.setAttribute('x2', p.x);
    document.querySelectorAll('.chart-point').forEach(c => {
        c.classList.remove('active');
        if (parseInt(c.dataset.idx) === idx) c.classList.add('active');
    });
    const raw = p.data; 
    const dateStr = new Date(raw.timestamp).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric'
    });
    document.getElementById('headerReps').textContent = raw.reps;
    document.getElementById('headerWpr').textContent = raw.wpr.toFixed(1);
    document.getElementById('headerSets').textContent = raw.sets;
    document.getElementById('headerVol').textContent = raw.vol;
    document.getElementById('headerDate').textContent = dateStr;
}

['gRange4w', 'gRange8w', 'gRange12w', 'gRangeAll'].forEach(id => {
    document.getElementById(id).onclick = (e) => {
        document.querySelectorAll('.pill-group .filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        chartState.range = id.replace('gRange', '').toLowerCase();
        drawChart();
    };
});
document.querySelectorAll('.toggle-text').forEach(btn => {
    btn.onclick = () => {
        const m = btn.dataset.metric;
        chartState.metrics[m] = !chartState.metrics[m];
        btn.classList.toggle('active');
        drawChart();
    };
});
window.addEventListener('resize', () => { if(currentScreen === SCREENS.GRAPH) { initChart(); drawChart(); }});

function hideAllDetails() {
  stopLeafSpawner(); // Stop leaves if user navigates away
  Object.values(SCREENS).forEach(screenId => { document.getElementById(screenId).classList.add('hidden'); });
  document.getElementById(SCREENS.CLIENTS).classList.remove('hidden');
  currentScreen = SCREENS.CLIENTS;
  document.getElementById("graphDiv").innerHTML = "";
}
function isSameDay(d1, d2) { return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function aggregateStats(setsArray) {
  if (!setsArray || setsArray.length === 0) return { sets: 0, reps: 0, volume: 0, wpr: 0 };
  const totalSets = setsArray.length;
  const totalReps = setsArray.reduce((sum, set) => sum + set.reps, 0);
  const totalVolume = setsArray.reduce((sum, set) => sum + set.volume, 0);
  const avgWpr = totalReps > 0 ?
  (totalVolume / totalReps) : 0;
  return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
}
function formatNum(num) { if (num % 1 === 0) return num.toString(); return num.toFixed(1);
}

function updateStatUI(statName, currentValue, previousValue) {
  const arrowEl = document.getElementById(statName + 'Arrow');
  const spiralEl = document.getElementById(statName + 'Spiral');
  const dataEl = document.getElementById(statName + 'Data');
  if (!arrowEl || !dataEl) return 'neutral';
  const status = calculateStatStatus(currentValue, previousValue);
  let arrow = '—';
  if (status === 'increase') arrow = ''; else if (status === 'decrease') arrow = '';
  const change = currentValue - previousValue;
  let percentageChange = 0;
  if (previousValue !== 0) percentageChange = (change / previousValue) * 100;
  else if (currentValue > 0) percentageChange = 100;
  let currentString = '';
  const changeSign = change > 0 ? '+' : '';
  switch(statName) {
    case 'sets': currentString = `${formatNum(currentValue)} Sets`; break;
    case 'reps': currentString = `${formatNum(currentValue)} Reps`; break;
    case 'volume': currentString = `${formatNum(currentValue)} lb`; break;
    case 'wpr': currentString = `${formatNum(currentValue)} lb/rep`; break;
  }
  let changeString = `(${changeSign}${formatNum(change)} / ${changeSign}${Math.abs(percentageChange).toFixed(0)}%)`;
  if (status === 'neutral') changeString = `(0 / 0%)`;
  const classesToRemove = ['increase', 'decrease', 'neutral'];
  arrowEl.innerHTML = arrow;
  arrowEl.classList.remove(...classesToRemove); arrowEl.classList.add(status);
  if(spiralEl) { spiralEl.classList.remove(...classesToRemove); void spiralEl.offsetWidth; spiralEl.classList.add(status);
  }
  dataEl.textContent = `${currentString} ${changeString}`;
  dataEl.classList.remove(...classesToRemove); dataEl.classList.add(status);
  return status;
}
function runTitleOnlyLogic() {
  const titleElement = document.getElementById('exerciseSetsTitleSpan');
  if (!selectedExercise) return;
  applyTitleStyling(titleElement, selectedExercise.exercise, null);
  const colorData = getExerciseColorData(selectedExercise);
  selectedExercise.colorData = colorData;
  applyTitleStyling(titleElement, selectedExercise.exercise, colorData);
}
let editMode = false;
const editToggleBtn = document.getElementById("editToggleBtn");
editToggleBtn.onclick = () => {
  editMode = !editMode;
  editToggleBtn.textContent = editMode ? "Done" : "Edit";
  document.body.classList.toggle('edit-mode-active');
  if (!editMode) saveUserJson();
};
function makeEditable(element, type, parentIdx, sortedSets) {
  element.classList.add("editable");
  element.style.cursor = "pointer";
  element.addEventListener("click", (e) => {
    if (!editMode) return;
    e.stopPropagation();
    const currentVal = element.textContent;
    const newVal = prompt(`Edit ${type}:`, currentVal);
    if (!newVal || newVal === currentVal) return;
    let originalIndex = -1;
    if (type.startsWith("Set")) {
        const sortedSetObject = sortedSets[parentIdx];
        if (!sortedSetObject) return;
        originalIndex = selectedExercise.sets.indexOf(sortedSetObject);
        if (originalIndex === -1) return;
    }
 
    switch(type) {
      case "Client":
        const data = clientsData[currentVal]; delete clientsData[currentVal]; data.client_name = newVal; clientsData[newVal] = data; if (selectedClient === currentVal) selectedClient = newVal; renderClients(); break;
      case "Session":
        const sessionToEdit = clientsData[selectedClient].sessions.find(s => s.session_name === currentVal); if (sessionToEdit) sessionToEdit.session_name = newVal; renderSessions(); break;
      case "Exercise":
        const exerciseToEdit = selectedSession.exercises.find(ex => ex.exercise === currentVal);
        if(exerciseToEdit) exerciseToEdit.exercise = newVal; renderExercises(); break;
      case "SetReps":
        selectedExercise.sets[originalIndex].reps = parseInt(newVal) || selectedExercise.sets[originalIndex].reps;
        selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight; renderSets(); break;
      case "SetWeight":
        selectedExercise.sets[originalIndex].weight = parseFloat(newVal) ||
        selectedExercise.sets[originalIndex].weight; selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight; renderSets(); break;
      case "SetNotes":
        selectedExercise.sets[originalIndex].notes = newVal;
        renderSets(); break;
    }
    saveUserJson();
  });
}
function hookEditables(sortedSets = []) {
  document.querySelectorAll("#clientList li > span").forEach(span => makeEditable(span, "Client"));
  document.querySelectorAll("#sessionList li > span").forEach((span, idx) => makeEditable(span, "Session"));
  document.querySelectorAll("#exerciseList li > span").forEach((span, idx) => makeEditable(span, "Exercise"));
  let setRowIdx = 0;
  setsTable.querySelectorAll("tr").forEach((tr) => {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 5) return;
    makeEditable(tds[1], "SetReps", setRowIdx, sortedSets);
    makeEditable(tds[2], "SetWeight", setRowIdx, sortedSets);
    makeEditable(tds[4], "SetNotes", setRowIdx, sortedSets);
    setRowIdx++;
  });
}
let touchStartX = 0; let touchStartY = 0; let touchMoveX = 0; let touchMoveY = 0;
const MIN_SWIPE_DISTANCE = 85;
const MAX_START_EDGE = 150;
document.body.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; touchMoveX = 0; touchMoveY = 0; }, { passive: true });
document.body.addEventListener('touchmove', (e) => { touchMoveX = e.touches[0].clientX; touchMoveY = e.touches[0].clientY; }, { passive: true });
document.body.addEventListener('touchend', () => {
    if (touchMoveX === 0 && touchMoveY === 0) return;
    const deltaX = touchMoveX - touchStartX;
    const deltaY = touchMoveY - touchStartY;
    if (touchStartX > MAX_START_EDGE) return;
    if (deltaX < MIN_SWIPE_DISTANCE) return;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    switch (currentScreen) {
        case SCREENS.SESSIONS: document.getElementById('backToClientsBtn').click(); break;
        case SCREENS.EXERCISES: document.getElementById('backToSessionsBtn').click(); break;
        case SCREENS.SETS: document.getElementById('backToExercisesBtn').click(); break;
    
        case SCREENS.GRAPH: document.getElementById('backToSetsFromGraphBtn').click(); break;
    }
    touchStartX = 0; touchStartY = 0;
});


let leafInterval = null;

// ==========================================
// 5 FIXED MINIMAL LEAF GEOMETRIES (FINAL)
// ==========================================

function generateOrganicLeafPath() {
    const style = Math.floor(Math.random() * 5);
    let d = "";

    switch (style) {
        case 0: // 1. THE CLASSIC (Beech)
            // Balanced oval.
            d += "M 0 0 Q 2 -32 0 -65 "; // Spine
            d += "C 15 -45, 12 -15, 0 0 "; // Right Outline
            d += "C -12 -15, -15 -45, 0 -65 "; // Left Outline
            
            d += "M 0 -20 L 6 -25 ";  d += "M 0 -20 L -6 -25 ";
            d += "M 0 -35 L 8 -40 ";  d += "M 0 -35 L -8 -40 ";
            d += "M 0 -50 L 5 -55 ";  d += "M 0 -50 L -5 -55 ";
            break;

        case 1: // 2. THE ROUNDED OAK (Fixed)
            // Previously twisting. Now uses explicit curves to stay safe.
            // Spine
            d += "M 0 0 Q 2 -35 0 -65 ";
            
            // Right Side (Tip -> Base)
            // Explicitly define both lobes to keep X positive
            d += "Q 15 -50, 5 -35 ";  // Upper Lobe
            d += "Q 10 -15, 0 0 ";    // Lower Lobe
            
            // Left Side (Base -> Tip)
            // Explicitly define both lobes to keep X negative
            d += "M 0 0 Q -10 -15, -5 -35 "; // Lower Lobe
            d += "Q -15 -50, 0 -65 ";        // Upper Lobe

            // Veins
            d += "M 0 -25 L 6 -20 ";  d += "M 0 -25 L -6 -20 ";
            d += "M 0 -45 L 6 -40 ";  d += "M 0 -45 L -6 -40 ";
            break;

        case 2: // 3. THE WILLOW (Lanceolate)
            // Long and thin.
            d += "M 0 0 Q 1 -40 0 -75 ";
            d += "C 6 -55, 4 -15, 0 0 ";
            d += "C -4 -15, -6 -55, 0 -75 ";
            
            d += "M 0 -20 L 3 -30 "; d += "M 0 -20 L -3 -30 ";
            d += "M 0 -35 L 4 -45 "; d += "M 0 -35 L -4 -45 ";
            d += "M 0 -50 L 3 -60 "; d += "M 0 -50 L -3 -60 ";
            break;

        case 3: // 4. THE HEART (Cordate)
            // Wide base.
            d += "M 0 0 L 0 -60 ";
            d += "C 15 -50, 25 -25, 0 0 ";
            d += "C -25 -25, -15 -50, 0 -60 ";
            
            d += "M 0 -15 Q 8 -18, 10 -22 ";   d += "M 0 -15 Q -8 -18, -10 -22 ";
            d += "M 0 -30 Q 6 -33, 8 -38 ";    d += "M 0 -30 Q -6 -33, -8 -38 ";
            d += "M 0 -45 Q 3 -48, 4 -50 ";    d += "M 0 -45 Q -3 -48, -4 -50 ";
            break;

        case 4: // 5. THE TEAR (Obovate)
            // Wide top.
            d += "M 0 0 Q 0 -30 0 -60 ";
            d += "C 20 -45, 5 -10, 0 0 ";
            d += "C -5 -10, -20 -45, 0 -60 ";
            
            d += "M 0 -20 L 4 -25 ";  d += "M 0 -20 L -4 -25 ";
            d += "M 0 -35 L 6 -40 ";  d += "M 0 -35 L -6 -40 ";
            d += "M 0 -50 L 5 -55 ";  d += "M 0 -50 L -5 -55 ";
            break;
    }

    return d;
}
function startLeafSpawner() {
  if (leafInterval) clearInterval(leafInterval);
  leafInterval = setInterval(() => {
    const activeLeaves = document.querySelectorAll('.leaf-group');
    if (activeLeaves.length >= 5) return;
    spawnRandomLeaf();
  }, 800);
}

function stopLeafSpawner() {
  if (leafInterval) clearInterval(leafInterval);
  leafInterval = null;
  document.querySelectorAll('.leaf-group').forEach(el => el.remove());
}

function spawnRandomLeaf() {
  const pointsGroup = document.getElementById('chartPoints'); 
  if (!pointsGroup) return;

  const activeLines = Array.from(document.querySelectorAll('.chart-line.active'));
  if (activeLines.length === 0) return;

  // 1. Pick random line & point
  const targetLine = activeLines[Math.floor(Math.random() * activeLines.length)];
  const len = targetLine.getTotalLength();
  if (len === 0) return;
  const randLen = Math.random() * len;
  const pt = targetLine.getPointAtLength(randLen);

  const computedStyle = window.getComputedStyle(targetLine);
  const strokeColor = computedStyle.stroke;

  // 2. Create Parent Group (Position/Rotate)
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "leaf-group");
  
  const rotation = (Math.random() * 90) - 45;
  const scale = 0.5 + (Math.random() * 0.5); 
  g.setAttribute("transform", `translate(${pt.x}, ${pt.y}) rotate(${rotation}) scale(${scale})`);

  // 3. Create Inner Wrapper (Handles Sway Animation)
  const gInner = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gInner.setAttribute("class", "leaf-inner");
  
  // 45% chance to sway
  if (Math.random() < 0.45) {
      gInner.classList.add('leaf-sway');
  }

  // 4. Create Procedural Path
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", generateOrganicLeafPath());
  path.setAttribute("class", "leaf-path");
  path.style.stroke = strokeColor;
  
  gInner.appendChild(path);
  g.appendChild(gInner);
  pointsGroup.appendChild(g);

  // 5. Animate Drawing
  const pathLen = path.getTotalLength();
  path.style.strokeDasharray = pathLen;
  path.style.strokeDashoffset = pathLen; 

  const animation = path.animate([
    { strokeDashoffset: pathLen }, 
    { strokeDashoffset: 0 }        
  ], {
    duration: 1500,
    easing: 'ease-out',
    fill: 'forwards'
  });

  animation.onfinish = () => {
    setTimeout(() => {
        if (!document.body.contains(path)) return;
        const undraw = path.animate([
            { strokeDashoffset: 0 },
            { strokeDashoffset: pathLen }
        ], {
            duration: 1000,
            easing: 'ease-in',
            fill: 'forwards'
        });
        undraw.onfinish = () => {
            if (document.body.contains(g)) g.remove();
        };
    }, 5000);
  };
}
