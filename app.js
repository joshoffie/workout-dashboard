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
// ANIMATION CONFIGURATION & COOLDOWN
// =====================================================

const ANIMATION_CLASSES = {
  happy: ['happy-1', 'happy-2', 'happy-3'],
  sad: ['sad-1', 'sad-2', 'sad-3'],
  calm: ['calm-1', 'calm-2', 'calm-3'],
};

// Global state to store the current animation for consistency
let currentAnimationClass = 'calm-1'; 
// Store timestamps for when an item was last animated
const animationCooldowns = {}; 
const COOLDOWN_DURATION = 20000; // 20 seconds in ms

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

  // Force re-render on navigation to trigger new random animations (if cooldown allows)
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

// --- Wire up the new Back Buttons ---
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

/**
 * ORIGINAL TITLE ANIMATION (For Headers)
 * Applies mood-based animation with cooldown.
 */
function applyTitleStyling(element, text, colorData, cooldownKey = null) {
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
  
  let shouldAnimate = true;
  if (cooldownKey) {
    const lastRun = animationCooldowns[cooldownKey] || 0;
    const now = Date.now();
    if (now - lastRun < COOLDOWN_DURATION) {
        shouldAnimate = false; 
    } else {
        animationCooldowns[cooldownKey] = now; 
    }
  }

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
    
    if (shouldAnimate) {
        char.classList.add(animClass);
        if (animClass === 'calm-3') {
            if (colors[i] === 'var(--color-green)') {
                char.classList.add('calm-3-green');
            } else if (colors[i] === 'var(--color-red)') {
                char.classList.add('calm-3-red');
            }
        }
    }
  });
}

/**
 * NEW: RANDOM INTERVAL ANIMATION (For List Items)
 * Applies the "Diverge" (Calm-3) animation randomly every 1-40 seconds.
 */
function applyRandomIntervalAnimation(element, text, colorData) {
  if (!element) return;

  // ADDED: This class connects to the new CSS rule in style.rtf
  element.classList.add('animatable-text');

  // 1. Setup Text
  setTextAsChars(element, text);
  
  // Clean parent styling just in case
  const parentTitle = element.closest('.animated-title');
  if (parentTitle) {
      parentTitle.classList.remove('happy', 'sad', 'calm');
  }

  // Handle No Data
  if (!colorData || colorData.total === 0) {
    element.querySelectorAll('.char').forEach(char => {
      char.style.color = 'var(--color-text)';
    });
    return; 
  }

  // 2. Calculate Colors (Same logic)
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

  // 3. Apply Colors & Store Type
  chars.forEach((char, i) => {
    char.style.color = colors[i] || 'var(--color-text)';
    if (colors[i] === 'var(--color-green)') char.dataset.colorType = 'green';
    else if (colors[i] === 'var(--color-red)') char.dataset.colorType = 'red';
    else char.dataset.colorType = 'yellow';
  });

  // 4. Define the recursive trigger function
  const triggerAnimation = () => {
      // Safety check: Stop if element removed from DOM
      if (!document.body.contains(element)) return;

      chars.forEach(char => {
          // Reset
          char.classList.remove('calm-3', 'calm-3-green', 'calm-3-red');
          void char.offsetWidth; // Reflow

          // Apply Animation Classes
          char.classList.add('calm-3');
          if (char.dataset.colorType === 'green') char.classList.add('calm-3-green');
          if (char.dataset.colorType === 'red') char.classList.add('calm-3-red');
      });

      // Remove classes after animation duration (2s)
      setTimeout(() => {
          if (!document.body.contains(element)) return;
          chars.forEach(char => {
               char.classList.remove('calm-3', 'calm-3-green', 'calm-3-red');
          });
      }, 2000);

      // Schedule next run (Random: 1s - 40s)
      const nextDelay = Math.random() * 39000 + 1000;
      setTimeout(triggerAnimation, nextDelay);
  };

  // 5. Start Loop Immediately
  triggerAnimation();
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
    // NOTE: textContent is set inside applyRandomIntervalAnimation now
    
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
    
    // USE NEW RANDOM ANIMATION FUNCTION
    applyRandomIntervalAnimation(nameSpan, name, clientColorData);

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
  
  // Keep MAIN TITLE on standard animation logic
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

    // USE NEW RANDOM ANIMATION FUNCTION
    applyRandomIntervalAnimation(nameSpan, sess.session_name, sessionColorData);

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
    
    // USE NEW RANDOM ANIMATION FUNCTION
    applyRandomIntervalAnimation(nameSpan, ex.exercise, colorData);

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
  runComparisonLogic();
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
  
  if (!arrowEl || !spiralEl || !dataEl) return 'neutral';

  const status = calculateStatStatus(currentValue, previousValue);
  
  let arrow = '—';
  if (status === 'increase') arrow = '&uarr;';
  else if (status === 'decrease') arrow = '&darr;';
  
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
  
  const classesToRemove = ['increase', 'decrease', 'neutral'];
  arrowEl.innerHTML = arrow;
  arrowEl.classList.remove(...classesToRemove);
  arrowEl.classList.add(status);

  spiralEl.classList.remove(...classesToRemove);
  spiralEl.classList.add(status);
  
  dataEl.textContent = `${currentString} ${changeString}`;
  dataEl.classList.remove(...classesToRemove);
  dataEl.classList.add(status);

  return status;
}


function runComparisonLogic() {
  const banner = document.getElementById('comparisonBanner');
  const titleElement = document.getElementById('exerciseSetsTitleSpan');

  if (!selectedExercise) {
    banner.classList.add('hidden');
    if (titleElement) applyTitleStyling(titleElement, 'Exercise', null);
    return;
  }
  
  // Apply initial styling (sets random animation)
  applyTitleStyling(titleElement, selectedExercise.exercise, null);

  const colorData = getExerciseColorData(selectedExercise);
  selectedExercise.colorData = colorData;

  if (colorData.total === 0) {
      banner.classList.add('hidden');
      applyTitleStyling(titleElement, selectedExercise.exercise, null);
      return;
  }

  const allSets = selectedExercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const mostRecentDate = new Date(allSets[0].timestamp);
  const currentDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), mostRecentDate));
  const previousWorkoutSet = allSets.find(set => !isSameDay(new Date(set.timestamp), mostRecentDate));
  const previousWorkoutDate = new Date(previousWorkoutSet.timestamp);
  const previousDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), previousWorkoutDate));
  const currentStats = aggregateStats(currentDaySets);
  const prevStats = aggregateStats(previousDaySets);

  updateStatUI('sets', currentStats.sets, prevStats.sets);
  updateStatUI('reps', currentStats.reps, prevStats.reps);
  updateStatUI('volume', currentStats.volume, prevStats.volume);
  updateStatUI('wpr', currentStats.wpr, prevStats.wpr);
  
  applyTitleStyling(titleElement, selectedExercise.exercise, colorData);
  banner.classList.remove('hidden');
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
