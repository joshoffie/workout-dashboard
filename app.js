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
    element.querySelectorAll('.char').forEach(char => { char.style.color = 'var(--color-text)'; });
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

// ------------------ RENDER FUNCTIONS ------------------
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

// ... [Client Actions, SelectClient same as before] ...
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

// ... [Session Rendering same as before] ...
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

// ... [Exercise Rendering same as before] ...
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

// ------------------ SETS & VISUALIZER ------------------
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
  saveUserJson();
  renderSets();
};

function renderSets() {
  setsTable.innerHTML = "";
  if (!selectedExercise) return;

  // Sort by Date ascending for table
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
  
  // Run New Visualizer Logic
  runComparisonLogic(); 
}

// =====================================================
// NEW SWIRL WIDGET CLASS (Vanilla JS Port)
// =====================================================
class SwirlWidget {
  constructor(container, label, metricKey, data, options = {}) {
    this.container = container;
    this.label = label;
    this.metricKey = metricKey;
    this.data = data;
    this.options = options;
    this.progress = 1.0; // Default to end
    
    // Geometry Config
    this.maxRadius = 42;
    this.coils = 3;
    this.center = { x: 50, y: 50 };
    this.resolution = 400;

    // Pre-calculate Spiral
    this.calcGeometry();
    
    // Build DOM
    this.render();
    
    // Update Visuals for initial state
    this.update(1.0);
  }

  calcGeometry() {
    this.points = [];
    let cumulativeLen = 0;
    let prevPt = null;
    this.pathD = "";

    for (let i = 0; i <= this.resolution; i++) {
      const t = 0.15 + (i / this.resolution) * 0.85;
      const totalAngle = Math.PI * 2 * this.coils;
      const angle = t * totalAngle;
      const r = t * this.maxRadius;
      const rotOffset = -Math.PI / 2;
      const x = this.center.x + r * Math.cos(angle + rotOffset);
      const y = this.center.y + r * Math.sin(angle + rotOffset);
      
      const pt = { x, y, len: 0 };
      
      if (prevPt) {
        const d = Math.sqrt((x - prevPt.x) ** 2 + (y - prevPt.y) ** 2);
        cumulativeLen += d;
        pt.len = cumulativeLen;
        this.pathD += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      } else {
        this.pathD += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
      }
      this.points.push(pt);
      prevPt = pt;
    }
    this.totalLength = cumulativeLen;
  }

  render() {
    this.container.innerHTML = '';
    
    // Card Wrapper
    const card = document.createElement('div');
    card.className = 'swirl-card';
    
    // Header
    const header = document.createElement('div');
    header.className = 'swirl-label';
    header.textContent = this.label;
    card.appendChild(header);
    
    // Visual Area
    const visArea = document.createElement('div');
    visArea.className = 'swirl-visual';
    this.visArea = visArea;
    
    // SVG
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    
    // Defs/Mask
    const defs = document.createElementNS(svgNS, "defs");
    const mask = document.createElementNS(svgNS, "mask");
    mask.id = `mask-${this.metricKey}`;
    const maskPath = document.createElementNS(svgNS, "path");
    maskPath.setAttribute("d", this.pathD);
    maskPath.setAttribute("stroke", "white");
    maskPath.setAttribute("stroke-width", "6");
    maskPath.setAttribute("fill", "none");
    maskPath.setAttribute("stroke-linecap", "round");
    maskPath.setAttribute("stroke-dasharray", `0 1000`); 
    this.maskPath = maskPath;
    mask.appendChild(maskPath);
    defs.appendChild(mask);
    svg.appendChild(defs);

    // Base Track
    const baseTrack = document.createElementNS(svgNS, "path");
    baseTrack.setAttribute("d", this.pathD);
    baseTrack.setAttribute("stroke", "#333");
    baseTrack.setAttribute("stroke-width", "3");
    baseTrack.setAttribute("fill", "none");
    baseTrack.setAttribute("stroke-linecap", "round");
    svg.appendChild(baseTrack);

    // Segments Group (Masked)
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("mask", `url(#mask-${this.metricKey})`);
    
    // Generate Segments
    const startTime = this.data[0].timestamp;
    const endTime = this.data[this.data.length - 1].timestamp;
    const totalTime = endTime - startTime || 1;
    
    for (let i = 1; i < this.data.length; i++) {
      const prev = this.data[i - 1];
      const curr = this.data[i];
      const pctStart = (prev.timestamp - startTime) / totalTime;
      const pctEnd = (curr.timestamp - startTime) / totalTime;
      const lenStart = pctStart * this.totalLength;
      const lenEnd = pctEnd * this.totalLength;
      
      // Determine status
      let statusClass = "stroke-yellow";
      if (curr.stats[this.metricKey] > prev.stats[this.metricKey]) statusClass = "stroke-green";
      else if (curr.stats[this.metricKey] < prev.stats[this.metricKey]) statusClass = "stroke-red";

      // Build Path
      const segmentPoints = this.points.filter(p => p.len >= lenStart && p.len <= lenEnd);
      if (segmentPoints.length > 1) {
        let segD = `M ${segmentPoints[0].x.toFixed(2)} ${segmentPoints[0].y.toFixed(2)}`;
        for(let k=1; k<segmentPoints.length; k++) {
            segD += ` L ${segmentPoints[k].x.toFixed(2)} ${segmentPoints[k].y.toFixed(2)}`;
        }
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", segD);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-width", "3");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("class", statusClass);
        g.appendChild(path);
      }
    }
    svg.appendChild(g);

    // Ball
    const ball = document.createElementNS(svgNS, "circle");
    ball.setAttribute("r", "5");
    ball.setAttribute("fill", "white");
    this.ball = ball;
    svg.appendChild(ball);

    visArea.appendChild(svg);
    card.appendChild(visArea);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'swirl-footer';
    footer.innerHTML = `
        <div class="swirl-date" id="date-${this.metricKey}"></div>
        <div class="swirl-value-row">
            <span class="swirl-main-val" id="val-${this.metricKey}">--</span>
            <span class="swirl-diff" id="diff-${this.metricKey}"></span>
        </div>
    `;
    card.appendChild(footer);

    this.container.appendChild(card);
    
    // Elements to update
    this.elDate = footer.querySelector(`#date-${this.metricKey}`);
    this.elVal = footer.querySelector(`#val-${this.metricKey}`);
    this.elDiff = footer.querySelector(`#diff-${this.metricKey}`);

    // Bind Events
    this.bindEvents();
  }

  update(newProgress) {
    this.progress = newProgress;
    const currentLen = this.progress * this.totalLength;
    
    // 1. Mask Reveal
    this.maskPath.setAttribute("stroke-dasharray", `${currentLen} 1000`);

    // 2. Ball Position
    let targetPt = this.points[this.points.length-1];
    for(let p of this.points) {
        if(p.len >= currentLen) {
            targetPt = p;
            break;
        }
    }
    this.ball.setAttribute("cx", targetPt.x);
    this.ball.setAttribute("cy", targetPt.y);

    // 3. Data Display (Segment Logic)
    const startTime = this.data[0].timestamp;
    const endTime = this.data[this.data.length - 1].timestamp;
    const totalTime = endTime - startTime || 1;
    
    let bestIdx = 0;
    if (this.progress < 0.02) {
        bestIdx = 0;
    } else {
        const currentTimestamp = startTime + (this.progress * totalTime);
        bestIdx = this.data.length - 1;
        for (let i = 1; i < this.data.length; i++) {
            if (currentTimestamp <= this.data[i].timestamp) {
                bestIdx = i;
                break;
            }
        }
    }
    
    const curr = this.data[bestIdx];
    const prev = bestIdx > 0 ? this.data[bestIdx-1] : curr;
    
    // Render Text
    const d = new Date(curr.date);
    const todayStr = new Date().toDateString();
    this.elDate.textContent = (d.toDateString() === todayStr) ? "Today" : d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
    
    let valStr = curr.stats[this.metricKey];
    if(this.metricKey === 'volume') valStr += " lb";
    this.elVal.textContent = valStr;
    
    // Diff Logic
    if(curr !== prev) {
        const val = curr.stats[this.metricKey];
        const pVal = prev.stats[this.metricKey];
        const diff = (val - pVal);
        const pct = pVal ? Math.round((diff/pVal)*100) : 0;
        
        let colorClass = "text-yellow";
        let sign = "+";
        if(diff < 0) { colorClass = "text-red"; sign = ""; }
        else if(diff > 0) { colorClass = "text-green"; }
        
        this.elDiff.className = `swirl-diff ${colorClass}`;
        this.elDiff.textContent = `${sign}${diff.toFixed(0)} (${pct}%)`;
    } else {
        this.elDiff.textContent = "";
    }
  }

  bindEvents() {
    const handler = (e) => {
        e.preventDefault(); // Prevent scroll on mobile
        const rect = this.visArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Map to SVG coords (100x100)
        const svgX = x * (100 / rect.width);
        const svgY = y * (100 / rect.height);
        
        // Find closest point
        let closestPt = this.points[0];
        let minDst = Infinity;
        for(let p of this.points) {
            const dst = (svgX - p.x)**2 + (svgY - p.y)**2;
            if(dst < minDst) {
                minDst = dst;
                closestPt = p;
            }
        }
        
        const newProg = Math.min(1, Math.max(0, closestPt.len / this.totalLength));
        
        if(this.options.onUpdate) {
            this.options.onUpdate(newProg);
        } else {
            this.update(newProg);
        }
    };

    this.visArea.addEventListener('pointerdown', (e) => {
        this.visArea.setPointerCapture(e.pointerId);
        handler(e);
        this.visArea.addEventListener('pointermove', handler);
    });

    this.visArea.addEventListener('pointerup', (e) => {
        this.visArea.releasePointerCapture(e.pointerId);
        this.visArea.removeEventListener('pointermove', handler);
    });
  }
}

// ------------------ VISUALIZER LOGIC ------------------
let swirlWidgets = [];
let isSwirlLinked = true;

function aggregateStats(setsArray) {
  if (!setsArray || setsArray.length === 0) return { sets: 0, reps: 0, volume: 0, wpr: 0 };
  const totalSets = setsArray.length;
  const totalReps = setsArray.reduce((sum, set) => sum + set.reps, 0);
  const totalVolume = setsArray.reduce((sum, set) => sum + set.volume, 0);
  const avgWpr = totalReps > 0 ? parseFloat((totalVolume / totalReps).toFixed(1)) : 0;
  return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getHistoryData(sets, limit) {
    // 1. Group by day
    const setsByDay = new Map();
    // Sort oldest to newest
    const chronological = sets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    chronological.forEach(set => {
        const d = new Date(set.timestamp);
        const key = d.toDateString();
        if(!setsByDay.has(key)) setsByDay.set(key, { date: d, sets: [] });
        setsByDay.get(key).sets.push(set);
    });
    
    const history = [];
    setsByDay.forEach(val => {
        history.push({
            date: val.date,
            timestamp: val.date.getTime(),
            stats: aggregateStats(val.sets)
        });
    });
    
    // Apply limit (take last N)
    const startIndex = Math.max(0, history.length - limit);
    return history.slice(startIndex);
}

function runComparisonLogic() {
  const container = document.getElementById('swirlContainer');
  const grid = document.getElementById('swirlGrid');
  const titleElement = document.getElementById('exerciseSetsTitleSpan');
  const linkBtn = document.getElementById('swirlLinkBtn');
  const historySelect = document.getElementById('swirlHistorySelect');

  // 1. Basic Validation
  if (!selectedExercise || !selectedExercise.sets || selectedExercise.sets.length === 0) {
    container.classList.add('hidden');
    if (titleElement) applyTitleStyling(titleElement, selectedExercise ? selectedExercise.exercise : 'Exercise', null);
    return;
  }
  container.classList.remove('hidden');
  
  // 2. Set Title Style (Legacy logic preserved for title)
  const colorData = getExerciseColorData(selectedExercise);
  applyTitleStyling(titleElement, selectedExercise.exercise, colorData);

  // 3. Setup Controls
  // Remove old listeners to prevent duplicates (simple clone hack)
  const newLinkBtn = linkBtn.cloneNode(true);
  linkBtn.parentNode.replaceChild(newLinkBtn, linkBtn);
  const newSelect = historySelect.cloneNode(true);
  historySelect.parentNode.replaceChild(newSelect, historySelect);
  
  newLinkBtn.onclick = () => {
      isSwirlLinked = !isSwirlLinked;
      newLinkBtn.classList.toggle('active', isSwirlLinked);
      newLinkBtn.innerHTML = isSwirlLinked 
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Linked` 
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg> Unlinked`;
  };
  
  newSelect.onchange = () => runComparisonLogic(); // Re-run on change

  // 4. Prepare Data
  const limit = parseInt(newSelect.value);
  const history = getHistoryData(selectedExercise.sets, limit);
  
  if(history.length < 2) {
      // Not enough data to visualize effectively
      grid.innerHTML = '<div style="grid-column: span 2; text-align:center; color:#666; padding:20px;">Add more workouts to see trends.</div>';
      return;
  }

  // 5. Initialize Widgets
  grid.innerHTML = '';
  swirlWidgets = [];
  
  const updateAll = (progress) => {
      if(isSwirlLinked) {
          swirlWidgets.forEach(w => w.update(progress));
      }
  };

  const metrics = [
      { key: 'sets', label: 'SETS' },
      { key: 'reps', label: 'REPS' },
      { key: 'volume', label: 'VOLUME' },
      { key: 'wpr', label: 'AVG W/R' }
  ];

  metrics.forEach(m => {
      const div = document.createElement('div');
      grid.appendChild(div);
      const widget = new SwirlWidget(div, m.label, m.key, history, {
          onUpdate: (prog) => {
             if(isSwirlLinked) updateAll(prog);
             else widget.update(prog);
          }
      });
      swirlWidgets.push(widget);
  });
}

// ------------------ HELPER ------------------
function hideAllDetails() {
  Object.values(SCREENS).forEach(screenId => {
    document.getElementById(screenId).classList.add('hidden');
  });
  document.getElementById(SCREENS.CLIENTS).classList.remove('hidden');
  currentScreen = SCREENS.CLIENTS;
  document.getElementById("graphDiv").innerHTML = "";
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

// ------------------ PLOTLY GRAPH ------------------
document.getElementById("showGraphBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  const sets = selectedExercise.sets;
  if (!sets || sets.length === 0) { alert("No sets to graph"); return; }

  navigateTo(SCREENS.GRAPH, 'forward');;

  const chronological = sets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const dates = chronological.map(s => s.timestamp);
  const reps = chronological.map(s => s.reps);
  const weight = chronological.map(s => s.weight);
  const volume = chronological.map(s => s.volume);
  const wpr = chronological.map(s => s.volume / s.reps);
  
  const traces = [
    { x: dates, y: reps, type: 'scatter', mode: 'lines+markers', name: 'Reps' },
    { x: dates, y: weight, type: 'scatter', mode: 'lines+markers', name: 'Weight' },
    { x: dates, y: volume, type: 'scatter', mode: 'lines+markers', name: 'Volume' },
    { x: dates, y: wpr, type: 'scatter', mode: 'lines+markers', name: 'Weight/Rep' }
  ];
  
  Plotly.newPlot('graphDiv', traces, { title: `${selectedExercise.exercise} Progress`, hovermode: 'x unified', paper_bgcolor: '#1c1c1c', plot_bgcolor: '#1c1c1c', font: { color: '#f0f0f0' } });
  Plotly.Plots.resize('graphDiv');
};
