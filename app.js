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

// --- Wire up Back Buttons ---
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
    if (char === ' ') {
        span.innerHTML = '&nbsp;';
    }
    element.appendChild(span);
  }
}

function applyTitleStyling(element, text, colorData) {
  if (!element) return;

  setTextAsChars(element, text);

  const parentTitle = element.closest('.animated-title');
  const targetElement = parentTitle || element;
  
  const allClasses = [
    ...ANIMATION_CLASSES.happy, 
    ...ANIMATION_CLASSES.sad, 
    ...ANIMATION_CLASSES.calm, 
    'happy', 'sad', 'calm'
  ];
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

  // Distribution Logic
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
    
    if (colors[i] === 'var(--color-green)') {
        char.dataset.moveDirection = 'up'; 
    } else if (colors[i] === 'var(--color-red)') {
        char.dataset.moveDirection = 'down';
    }
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
      if (editMode) { e.stopPropagation(); return; }
      selectClient(name);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete client "${name}"?`, () => {
        delete clientsData[name];
        saveUserJson();
        renderClients();
        if (selectedClient === name) navigateTo(SCREENS.CLIENTS, 'back');
      });
    };

    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    clientList.appendChild(li);
  }
  
  const clientsTitle = document.getElementById('clientsScreenTitle');
  applyTitleStyling(clientsTitle, 'Clients', totalAppColorData);
  
  hookEditables();
}

// ------------------ CLIENT ACTIONS ------------------
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

// ------------------ SESSIONS ------------------
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
  if (!selectedClient) { alert("Select a client first"); return; }
  const name = prompt("Enter session name:");
  if (!name) return;
  const session = { session_name: name, exercises: [], date: new Date().toISOString() };
  clientsData[selectedClient].sessions.push(session);
  saveUserJson();
  renderSessions();
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
        if (sessionIndex > -1) {
          clientsData[selectedClient].sessions.splice(sessionIndex, 1);
          saveUserJson();
          renderSessions();
        }
        if (selectedSession === sess) navigateTo(SCREENS.SESSIONS, 'back');
      });
    };

    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    sessionList.appendChild(li);
  });
  
  const sessionsTitle = document.getElementById('sessionsScreenTitle');
  applyTitleStyling(sessionsTitle, 'Sessions', clientTotalColorData);

  hookEditables();
}

function selectSession(sessionObject) {
  selectedSession = sessionObject;
  selectedExercise = null;
  renderExercises();
  navigateTo(SCREENS.EXERCISES, 'forward');
}

// ------------------ EXERCISES ------------------
const exerciseList = document.getElementById("exerciseList");
document.getElementById("addExerciseBtn").onclick = () => {
  if (!selectedSession) { alert("Select a session first"); return; }
  const name = prompt("Enter exercise name:");
  if (!name) return;
  const ex = { exercise: name, sets: [] };
  selectedSession.exercises.push(ex);
  saveUserJson();
  renderExercises();
};

function renderExercises() {
  exerciseList.innerHTML = "";
  const sessionTitleElement = document.getElementById('sessionExercisesTitle');
  
  if (!selectedSession) {
    applyTitleStyling(sessionTitleElement, 'Exercises', null);
    return;
  }
  
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

    li.onclick = (e) => {
      if (editMode) { e.stopPropagation(); return; }
      selectExercise(idx);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete exercise "${ex.exercise}"?`, () => {
        selectedSession.exercises.splice(idx, 1);
        saveUserJson();
        renderExercises();
        if (selectedExercise === ex) navigateTo(SCREENS.EXERCISES, 'back');
      });
    };
    
    setupListTextAnimation(nameSpan, ex.exercise, colorData);

    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    exerciseList.appendChild(li);
  });
  
  applyTitleStyling(sessionTitleElement, 'Exercises', sessionColorData);
  hookEditables();
}

function selectExercise(idx) {
  selectedExercise = selectedSession.exercises[idx];
  renderSets();
  navigateTo(SCREENS.SETS, 'forward');
  document.getElementById("graphContainer").classList.add("hidden");
}

// ------------------ SPIRAL WIDGET LOGIC ------------------
const spiralState = {
    svg: null,
    hitPath: null,
    segmentsGroup: null,
    markersGroup: null,
    timeBall: null,
    dateDisplay: null,
    fullHistory: [],
    visibleHistory: [],
    hitPathLookup: [],
    workoutVisualPoints: [],
    totalLen: 0,
    isDragging: false,
    currentRange: 'all',
    CX: 250, CY: 250, START_RADIUS: 30,
    OFFSETS: { sets: -21, reps: -7, vol: 7, wpr: 21 },
    RADIAL_PITCH: 45, TURNS: 3.8
};

function initSpiralElements() {
    if (spiralState.svg) return;
    spiralState.svg = document.getElementById('spiralCanvas');
    spiralState.hitPath = document.getElementById('hitPath');
    spiralState.segmentsGroup = document.getElementById('spiralSegments');
    spiralState.markersGroup = document.getElementById('markersGroup');
    spiralState.timeBall = document.getElementById('timeBall');
    spiralState.dateDisplay = document.getElementById('spiralDateDisplay');

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
            currentSession = {
                dayStr: dayStr,
                timestamp: d.getTime(),
                sets: 0, reps: 0, volume: 0, rawSets: []
            };
        }
        currentSession.sets++;
        currentSession.reps += (parseInt(set.reps) || 0);
        currentSession.volume += (parseFloat(set.volume) || 0);
        currentSession.rawSets.push(set);
    });
    if (currentSession) sessions.push(currentSession);
    sessions.forEach(s => {
        s.wpr = s.reps > 0 ? (s.volume / s.reps) : 0;
    });
    return sessions;
}

function getSpiralPoint(t, offset) {
    const totalAngle = Math.PI * 2 * spiralState.TURNS;
    const angle = t * totalAngle;
    const baseR = spiralState.START_RADIUS + (spiralState.RADIAL_PITCH * (angle / (Math.PI * 2)));
    const r = baseR + offset;
    return {
        x: spiralState.CX + r * Math.cos(angle),
        y: spiralState.CY + r * Math.sin(angle)
    };
}

function getSegmentD(tStart, tEnd, offset) {
    let d = "";
    const steps = 30; 
    for(let i=0; i<=steps; i++) {
        const t = tStart + (i/steps) * (tEnd - tStart);
        const p = getSpiralPoint(t, offset);
        d += (i===0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
    }
    return d;
}

function getFullSpiralD(offset) {
    let d = "";
    const points = 300;
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

    if (range === 'all') {
        spiralState.RADIAL_PITCH = 45; 
        spiralState.TURNS = 3.8; 
    } else {
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
    
    // Populate lookup table for path coordinates
    spiralState.hitPathLookup = [];
    const res = 300; 
    for(let i=0; i<=res; i++) {
        const l = (i/res) * spiralState.totalLen;
        const pt = spiralState.hitPath.getPointAtLength(l);
        spiralState.hitPathLookup.push({ len: l, x: pt.x, y: pt.y });
    }

    if (spiralState.visibleHistory.length === 0) {
         updateBallToLen(0);
         return;
    }

    const oldestTime = spiralState.visibleHistory[0].timestamp;
    const newestTime = spiralState.visibleHistory[spiralState.visibleHistory.length-1].timestamp;
    const timeSpan = newestTime - oldestTime || 1;

    spiralState.workoutVisualPoints = [];

    spiralState.visibleHistory.forEach((curr, i) => {
        const t = (curr.timestamp - oldestTime) / timeSpan;
        const p = getSpiralPoint(t, 0);
        
        // --- NEW: CALCULATE MARKER LENGTH ON PATH ---
        let bestWpLen = 0; 
        let minWpDist = Infinity;
        for(let lp of spiralState.hitPathLookup) {
            const d = (lp.x - p.x)**2 + (lp.y - p.y)**2;
            if(d < minWpDist) { minWpDist = d; bestWpLen = lp.len; }
        }
        
        // Store "len" (path distance) instead of just X/Y for lookup
        spiralState.workoutVisualPoints.push({ 
            x: p.x, 
            y: p.y, 
            len: bestWpLen, // Crucial for "track hopping" fix
            index: i, 
            data: curr 
        });

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", p.x);
        circle.setAttribute("cy", p.y);
        circle.setAttribute("class", "workout-marker");
        circle.style.animation = `fadeIn 0.5s ease-out forwards`;
        circle.style.animationDelay = `${(i / spiralState.visibleHistory.length) + 0.5}s`;
        spiralState.markersGroup.appendChild(circle);

        if(i === spiralState.visibleHistory.length - 1) return;
        const next = spiralState.visibleHistory[i+1];
        const tEnd = (next.timestamp - oldestTime) / timeSpan;

        drawSeg(curr.sets, next.sets, t, tEnd, spiralState.OFFSETS.sets, (i / spiralState.visibleHistory.length) + 0.0);
        drawSeg(curr.reps, next.reps, t, tEnd, spiralState.OFFSETS.reps, (i / spiralState.visibleHistory.length) + 0.05);
        drawSeg(curr.volume, next.volume, t, tEnd, spiralState.OFFSETS.vol, (i / spiralState.visibleHistory.length) + 0.1);
        drawSeg(curr.wpr, next.wpr, t, tEnd, spiralState.OFFSETS.wpr, (i / spiralState.visibleHistory.length) + 0.15);
    });

    function drawSeg(v1, v2, t1, t2, offset, delay) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute('d', getSegmentD(t1, t2, offset));
        path.setAttribute('class', 'spiral-segment');
        path.style.animation = `drawInSegment 0.4s ease-out forwards`;
        path.style.animationDelay = `${delay}s`;
        
        const epsilon = 0.01;
        if (v2 > v1 + epsilon) path.classList.add('seg-increase');
        else if (v2 < v1 - epsilon) path.classList.add('seg-decrease');
        else path.classList.add('seg-neutral');
        
        spiralState.segmentsGroup.appendChild(path);
    }

    updateBallToLen(spiralState.totalLen);
}

function updateSpiralData(sets) {
    initSpiralElements();
    spiralState.fullHistory = processSetsForSpiral(sets);
    setSpiralRange(spiralState.currentRange); 
    document.getElementById('comparisonBanner').classList.remove('hidden');
}

// --- SPIRAL INTERACTION ---
function getSVGC(evt) {
    const pt = spiralState.svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
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

// --- FIXED LOGIC: Use Path Length (Linear Distance), NOT X/Y Distance ---
function getClosestDataIdx(currentLen) {
    let bestIdx = -1; 
    let minDist = Infinity;
    
    spiralState.workoutVisualPoints.forEach((wp) => {
        // Compare linear distance along the wire
        const dist = Math.abs(currentLen - wp.len); 
        if(dist < minDist) { minDist = dist; bestIdx = wp.index; }
    });
    
    // STRICT THRESHOLD removed. Always return bestIdx.
    return bestIdx;
}

function updateBallToLen(len) {
    const pt = spiralState.hitPath.getPointAtLength(len);
    spiralState.timeBall.style.display = 'block'; 
    spiralState.timeBall.setAttribute('cx', pt.x);
    spiralState.timeBall.setAttribute('cy', pt.y);
    
    if (spiralState.workoutVisualPoints.length > 0) {
        // Pass LENGTH (position on line) instead of X/Y coords
        const idx = getClosestDataIdx(len);
        updateDataByIndex(idx);
    }
}

function updateDataByIndex(idx) {
    // Removed "Ghost" state logic. Always update if index is valid.
    if (idx === -1 || !spiralState.visibleHistory[idx]) {
        // Fallback just in case no data exists at all
        return;
    }

    const curr = spiralState.visibleHistory[idx];
    const prev = idx > 0 ? spiralState.visibleHistory[idx-1] : { sets:0, reps:0, volume:0, wpr:0 };

    document.querySelectorAll('.workout-marker').forEach(m => m.classList.remove('active'));
    if (spiralState.markersGroup.children[idx]) spiralState.markersGroup.children[idx].classList.add('active');

    const d = new Date(curr.timestamp);
    const dateStr = d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
    spiralState.dateDisplay.textContent = dateStr;

    updateStatUI('sets', curr.sets, prev.sets);
    updateStatUI('reps', curr.reps, prev.reps);
    updateStatUI('volume', curr.volume, prev.volume);
    updateStatUI('wpr', curr.wpr, prev.wpr);
}

// Handlers
const handleSpiralStart = (e) => {
    spiralState.isDragging = true;
    spiralState.hitPath.setPointerCapture(e.pointerId);
    const c = getSVGC(e);
    updateBallToLen(getClosestLen(c.x, c.y));
}
const handleSpiralMove = (e) => { 
    if(!spiralState.isDragging) return;
    e.preventDefault(); 
    const c = getSVGC(e);
    updateBallToLen(getClosestLen(c.x, c.y)); 
}
const handleSpiralEnd = (e) => {
    if (!spiralState.isDragging) return;
    spiralState.isDragging = false;
    spiralState.hitPath.releasePointerCapture(e.pointerId);
}


// ------------------ SETS ------------------
const setsTable = document.querySelector("#setsTable tbody");

function getLastSet() {
    if (!selectedExercise || !selectedExercise.sets || selectedExercise.sets.length === 0) {
        return null;
    }
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
  saveUserJson();
  renderSets();
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
        showDeleteConfirm(`Are you sure you want to delete set ${setIdx + 1} from this day?`, () => {
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
  runTitleOnlyLogic();
}


// ------------------ PLOTLY GRAPH ------------------
document.getElementById("showGraphBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  const sets = selectedExercise.sets;
  if (!sets || sets.length === 0) { alert("No sets to graph"); return; }

  navigateTo(SCREENS.GRAPH, 'forward');;

  const dates = sets.map(s => s.timestamp);
  const reps = sets.map(s => s.reps);
  const weight = sets.map(s => s.weight);
  const volume = sets.map(s => s.volume);
  const wpr = sets.map(s => s.volume / s.reps);
  
  const traces = [
    { x: dates, y: reps, type: 'scatter', mode: 'lines+markers', name: 'Reps' },
    { x: dates, y: weight, type: 'scatter', mode: 'lines+markers', name: 'Weight' },
    { x: dates, y: volume, type: 'scatter', mode: 'lines+markers', name: 'Volume' },
    { x: dates, y: wpr, type: 'scatter', mode: 'lines+markers', name: 'Weight/Rep' }
  ];
  
  Plotly.newPlot('graphDiv', traces, { title: `${selectedExercise.exercise} Progress`, hovermode: 'x unified' });
  Plotly.Plots.resize('graphDiv');
};

// ------------------ HELPER ------------------
function hideAllDetails() {
  Object.values(SCREENS).forEach(screenId => {
    document.getElementById(screenId).classList.add('hidden');
  });
  document.getElementById(SCREENS.CLIENTS).classList.remove('hidden');
  currentScreen = SCREENS.CLIENTS;
  document.getElementById("graphDiv").innerHTML = "";
}

// ------------------ COMPARISON LOGIC ------------------

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
  const spiralEl = document.getElementById(statName + 'Spiral'); 
  const dataEl = document.getElementById(statName + 'Data');
  
  if (!arrowEl || !dataEl) return 'neutral';

  const status = calculateStatStatus(currentValue, previousValue);
  
  let arrow = '—';
  if (status === 'increase') arrow = '↑';
  else if (status === 'decrease') arrow = '↓';
  
  const change = currentValue - previousValue;
  let percentageChange = 0;
  if (previousValue !== 0) {
    percentageChange = (change / previousValue) * 100;
  } else if (currentValue > 0) {
    percentageChange = 100;
  }

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
  
  arrowEl.innerHTML = arrow;
  arrowEl.className = `stat-arrow ${status}`;

  if(spiralEl) {
    spiralEl.setAttribute('class', `comparison-spiral ${status}`);
  }
  
  dataEl.textContent = `${currentString} ${changeString}`;
  dataEl.className = `stat-data ${status}`;

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


// ------------------ EDIT MODE ------------------
let editMode = false;
const editToggleBtn = document.getElementById("editToggleBtn");

editToggleBtn.onclick = () => {
  editMode = !editMode;
  editToggleBtn.textContent = editMode ? "Done" : "Edit";
  document.body.classList.toggle('edit-mode-active');
  if (!editMode) saveUserJson();
};

// ------------------ MAKE ELEMENTS EDITABLE ------------------
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
        const data = clientsData[currentVal];
        delete clientsData[currentVal];
        data.client_name = newVal;
        clientsData[newVal] = data;
        if (selectedClient === currentVal) selectedClient = newVal;
        renderClients();
        break;

      case "Session":
        const sessionToEdit = clientsData[selectedClient].sessions.find(s => s.session_name === currentVal);
        if (sessionToEdit) sessionToEdit.session_name = newVal;
        renderSessions();
        break;

      case "Exercise":
        const exerciseToEdit = selectedSession.exercises.find(ex => ex.exercise === currentVal);
        if(exerciseToEdit) exerciseToEdit.exercise = newVal;
        renderExercises();
        break;

      case "SetReps":
        selectedExercise.sets[originalIndex].reps = parseInt(newVal) || selectedExercise.sets[originalIndex].reps;
        selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight;
        renderSets();
        break;

      case "SetWeight":
        selectedExercise.sets[originalIndex].weight = parseFloat(newVal) || selectedExercise.sets[originalIndex].weight;
        selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight;
        renderSets();
        break;

      case "SetNotes":
        selectedExercise.sets[originalIndex].notes = newVal;
        renderSets();
        break;
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

// ------------------ SWIPE NAVIGATION ------------------
let touchStartX = 0;
let touchStartY = 0;
let touchMoveX = 0;
let touchMoveY = 0;
const MIN_SWIPE_DISTANCE = 85;
const MAX_START_EDGE = 150;

document.body.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoveX = 0;
    touchMoveY = 0;
}, { passive: true });

document.body.addEventListener('touchmove', (e) => {
    touchMoveX = e.touches[0].clientX;
    touchMoveY = e.touches[0].clientY;
}, { passive: true });

document.body.addEventListener('touchend', () => {
    if (touchMoveX === 0 && touchMoveY === 0) return;
    const deltaX = touchMoveX - touchStartX;
    const deltaY = touchMoveY - touchStartY;
    if (touchStartX > MAX_START_EDGE) return;
    if (deltaX < MIN_SWIPE_DISTANCE) return;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    
    switch (currentScreen) {
        case SCREENS.SESSIONS:
            document.getElementById('backToClientsBtn').click();
            break;
        case SCREENS.EXERCISES:
            document.getElementById('backToSessionsBtn').click();
            break;
        case SCREENS.SETS:
            document.getElementById('backToExercisesBtn').click();
            break;
        case SCREENS.GRAPH:
            document.getElementById('backToSetsFromGraphBtn').click();
            break;
    }
    touchStartX = 0; touchStartY = 0;
});
