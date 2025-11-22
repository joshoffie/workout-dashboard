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
  
  // NEW: Initialize Widgets
  const titleElement = document.getElementById('exerciseSetsTitleSpan');
  if(titleElement) applyTitleStyling(titleElement, selectedExercise.exercise, null);
  
  setTimeout(() => {
      updateHistoryDepth();
  }, 50);
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

// ------------------ COMPARISON LOGIC (Standard Stats) ------------------

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

// =============================================================
// NEW: SWIRL WIDGET INTEGRATION (V8 - NO MASKS / ROBUST MOBILE)
// =============================================================

let widgets = [];
let isLinkedMode = true;

const linkToggleBtn = document.getElementById('linkToggle');
const historySelect = document.getElementById('historySelect');

if(linkToggleBtn) {
    linkToggleBtn.onclick = () => {
        isLinkedMode = !isLinkedMode;
        if(isLinkedMode) {
            linkToggleBtn.classList.add('active');
            linkToggleBtn.innerHTML = '<span>🔗 Link</span>';
        } else {
            linkToggleBtn.classList.remove('active');
            linkToggleBtn.innerHTML = '<span>🔓 Unlink</span>';
        }
    }
}

if(historySelect) {
    historySelect.onchange = () => {
        updateHistoryDepth();
    }
}

// TRANSFORM FIREBASE DATA TO WIDGET HISTORY
function processExerciseHistory(exercise) {
    if(!exercise || !exercise.sets || exercise.sets.length === 0) return [];
    
    const allSets = exercise.sets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    // Group by Day
    const sessionsMap = new Map();
    allSets.forEach(set => {
        const d = new Date(set.timestamp);
        const dateKey = d.toDateString(); 
        
        if (!sessionsMap.has(dateKey)) {
            sessionsMap.set(dateKey, {
                dateObj: d,
                sets: []
            });
        }
        sessionsMap.get(dateKey).sets.push(set);
    });
    
    // Convert Map to Array
    const history = [];
    sessionsMap.forEach((val, key) => {
        const stats = aggregateStats(val.sets);
        // Fix WPR floating point
        stats.wpr = parseFloat(stats.wpr.toFixed(1));
        
        history.push({
            date: val.dateObj,
            timestamp: val.dateObj.getTime(),
            stats: stats
        });
    });
    
    // Ensure sorted by time (Oldest -> Newest)
    return history.sort((a,b) => a.timestamp - b.timestamp);
}

function updateHistoryDepth() {
    if(!selectedExercise) return;
    
    const limit = parseInt(document.getElementById('historySelect').value);
    const history = processExerciseHistory(selectedExercise);
    
    widgets = [];
    // If we have history, init widgets
    if(history.length > 0) {
        widgets.push(new SwirlWidget('swirl-sets', 'sets', history, limit));
        widgets.push(new SwirlWidget('swirl-reps', 'reps', history, limit));
        widgets.push(new SwirlWidget('swirl-volume', 'volume', history, limit));
        widgets.push(new SwirlWidget('swirl-wpr', 'wpr', history, limit));
    }
}

// --- MOBILE-OPTIMIZED SWIRL WIDGET CLASS ---

// Helper: Calculate point on spiral
// Simpler 2.25 coil spiral for better touch target
function getSpiralPoint(t, center={x:50, y:50}, maxRadius=42, coils=2.25) {
    const totalAngle = Math.PI * 2 * coils;
    const angle = t * totalAngle;
    const r = t * maxRadius;
    // Start from top (-PI/2)
    const rotOffset = -Math.PI / 2; 
    return {
        x: center.x + r * Math.cos(angle + rotOffset),
        y: center.y + r * Math.sin(angle + rotOffset)
    };
}

function distSq(x1, y1, x2, y2) {
    return (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2);
}

class SwirlWidget {
    constructor(elementId, metricKey, fullHistory, limit) {
        this.elementId = elementId;
        this.container = document.getElementById(elementId);
        this.card = this.container.parentElement;
        this.metricKey = metricKey;
        
        // Slice Data
        const startIndex = Math.max(0, fullHistory.length - limit);
        this.data = fullHistory.slice(startIndex);
        
        if(this.data.length === 0) return;

        this.startTime = this.data[0].timestamp;
        this.endTime = this.data[this.data.length - 1].timestamp;
        this.totalTime = this.endTime - this.startTime;
        if (this.totalTime === 0) this.totalTime = 1;

        this.initSVG();
        this.setupInteraction();
        
        // Initialize at 100% (Today)
        this.setVisualProgress(1.0);
    }

    calcStatus(curr, prev) {
        const cVal = curr.stats[this.metricKey];
        const pVal = prev.stats[this.metricKey];
        if (cVal > pVal) return 'increase';
        if (cVal < pVal) return 'decrease';
        return 'neutral';
    }

    initSVG() {
        this.pathPoints = [];
        let basePathD = "";
        
        // 1. Generate Path Data (Low Poly for Speed)
        const resolution = 120; 
        let cumulativeLen = 0;
        let prevPt = null;

        for(let i=0; i<=resolution; i++) {
            const t = 0.15 + (i/resolution) * 0.85; 
            const pt = getSpiralPoint(t);
            
            if (i > 0) {
                const d = Math.sqrt(distSq(pt.x, pt.y, prevPt.x, prevPt.y));
                cumulativeLen += d;
            }
            
            this.pathPoints.push({ x: pt.x, y: pt.y, len: cumulativeLen });
            prevPt = pt;
            
            if(i===0) basePathD += `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
            else basePathD += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        }
        this.totalLength = cumulativeLen;

        this.segmentElements = []; // Store references to colored paths
        let colorSegmentsHTML = '';

        // 2. Generate Colored Segments (Initially Hidden)
        if (this.data.length > 1) {
            for (let i = 1; i < this.data.length; i++) {
                const prevDataPt = this.data[i-1];
                const currDataPt = this.data[i];
                
                const timePctStart = (prevDataPt.timestamp - this.startTime) / this.totalTime;
                const timePctEnd = (currDataPt.timestamp - this.startTime) / this.totalTime;
                
                const lenStart = timePctStart * this.totalLength;
                const lenEnd = timePctEnd * this.totalLength;
                
                // Slightly overlap segments for visual continuity
                const overlapStart = (lenStart - 1.0) > 0 ? (lenStart - 1.0) : 0;
                
                let segD = "";
                let started = false;
                let segLen = 0;
                
                // Build sub-path
                for (let p of this.pathPoints) {
                    if (p.len >= overlapStart && p.len <= lenEnd) {
                        if (!started) {
                            segD += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                            started = true;
                        } else {
                            segD += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                        }
                    }
                }
                
                // Store segment metadata
                const segObj = {
                    id: `seg-${this.elementId}-${i}`,
                    startLen: overlapStart,
                    endLen: lenEnd,
                    totalLen: lenEnd - overlapStart,
                    dataPoint: currDataPt,
                    prevPoint: prevDataPt
                };
                this.segmentElements.push(segObj);

                const status = this.calcStatus(currDataPt, prevDataPt);
                
                // Create Path Element string with ID
                // Initially, we can set stroke-dasharray to match its length to be ready
                // We will control visibility via opacity or display
                colorSegmentsHTML += `<path id="${segObj.id}" d="${segD}" 
                                      class="spiral-segment ${status}" 
                                      stroke-linecap="butt" stroke-linejoin="round"
                                      style="display:none;" />`; // Hidden by default
            }
        } else if (this.data.length === 1) {
             const pt = getSpiralPoint(1.0); 
             colorSegmentsHTML = `<circle cx="${pt.x}" cy="${pt.y}" r="3" class="neutral" />`;
        }

        // 3. Build SVG (No Masks!)
        this.container.innerHTML = `
            <svg viewBox="0 0 100 100" style="width:100%; height:100%; overflow:visible;">
                <!-- Background Track -->
                <path id="base-track-${this.elementId}" d="${basePathD}" class="spiral-base-track" stroke-width="3" />
                
                <!-- Colored Segments Layer (No Mask) -->
                <g stroke-width="4">
                    ${colorSegmentsHTML}
                </g>
                
                <!-- Ball -->
                <circle id="ball-${this.elementId}" r="5" class="spiral-ball" cx="0" cy="0" />
            </svg>
        `;
        
        this.baseTrack = this.container.querySelector(`#base-track-${this.elementId}`);
        this.ball = this.container.querySelector(`#ball-${this.elementId}`);
    }

    updateTextDisplay(currentPoint, comparisonPoint) {
        const dateEl = document.getElementById(`date-${this.metricKey}`);
        const valEl = document.getElementById(`val-${this.metricKey}`);
        const arrowEl = document.getElementById(`arrow-${this.metricKey}`);
        const diffEl = document.getElementById(`diff-${this.metricKey}`);
        
        const d = new Date(currentPoint.date);
        const isLatest = (currentPoint.timestamp === this.data[this.data.length-1].timestamp);
        dateEl.textContent = isLatest ? "Today" : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        
        const val = currentPoint.stats[this.metricKey];
        let displayVal = val;
        if (Number.isInteger(val)) displayVal = val;
        
        valEl.textContent = displayVal;
        if (this.metricKey === 'volume') valEl.textContent += " lb";
        if (this.metricKey === 'wpr') valEl.textContent += " lb/r";
        
        if (!comparisonPoint || currentPoint === comparisonPoint) {
             arrowEl.innerHTML = '';
             diffEl.textContent = '';
             this.setStatusColor('neutral');
             return;
        }

        const prevVal = comparisonPoint.stats[this.metricKey];
        const status = this.calcStatus(currentPoint, comparisonPoint);
        
        let arrow = '—';
        if (status === 'increase') arrow = '↑';
        if (status === 'decrease') arrow = '↓';
        
        const diff = val - prevVal;
        const sign = diff > 0 ? '+' : '';
        const percent = prevVal !== 0 ? Math.round((diff / prevVal) * 100) : 0;
        
        arrowEl.innerHTML = arrow;
        diffEl.textContent = `(${sign}${diff.toFixed(1)} / ${percent}%)`;
        this.setStatusColor(status);
    }
    
    setStatusColor(status) {
        const footer = this.card.querySelector('.data-footer');
        footer.querySelectorAll('span').forEach(el => {
            el.classList.remove('increase', 'decrease', 'neutral');
            el.classList.add(status);
        });
    }

    setupInteraction() {
        const handleInteract = (e) => {
            e.preventDefault(); 
            
            const svgElement = this.container.querySelector('svg');
            let point = svgElement.createSVGPoint();
            
            if (e.touches && e.touches.length > 0) {
                point.x = e.touches[0].clientX;
                point.y = e.touches[0].clientY;
            } else {
                point.x = e.clientX;
                point.y = e.clientY;
            }
            
            let cursor = point.matrixTransform(svgElement.getScreenCTM().inverse());
            
            let closestPt = this.pathPoints[0];
            let minDst = Infinity;
            
            for(let p of this.pathPoints) {
                const dst = distSq(cursor.x, cursor.y, p.x, p.y);
                if(dst < minDst) {
                    minDst = dst;
                    closestPt = p;
                }
            }
            
            const pct = closestPt.len / this.totalLength;
            
            if (isLinkedMode) {
                widgets.forEach(w => w.setVisualProgress(pct));
            } else {
                this.setVisualProgress(pct);
            }
        };

        this.swirlVisualArea = this.card.querySelector('.swirl-visual-area');
        this.swirlVisualArea.addEventListener('touchmove', handleInteract, { passive: false });
        this.swirlVisualArea.addEventListener('touchstart', handleInteract, { passive: false });
        this.swirlVisualArea.addEventListener('mousemove', handleInteract);
        this.swirlVisualArea.addEventListener('click', handleInteract);
    }

    setVisualProgress(pct) {
        const drawLen = pct * this.totalLength;
        
        // 1. Move Ball
        let targetPt = this.pathPoints[this.pathPoints.length-1];
        for(let p of this.pathPoints) {
            if (p.len >= drawLen) {
                targetPt = p;
                break;
            }
        }
        this.ball.setAttribute("cx", targetPt.x);
        this.ball.setAttribute("cy", targetPt.y);
        
        // 2. Manage Segment Visibility (The "No Mask" Trick)
        let activeDataSegment = null;

        this.segmentElements.forEach(seg => {
            const el = document.getElementById(seg.id);
            if (!el) return;

            if (drawLen >= seg.endLen) {
                // Ball has passed this segment -> Show Fully
                el.style.display = 'block';
                el.style.strokeDasharray = 'none';
            } 
            else if (drawLen < seg.startLen) {
                // Ball has not reached this segment -> Hide
                el.style.display = 'none';
            } 
            else {
                // Ball is currently traversing this segment -> Show Partial
                el.style.display = 'block';
                // Calculate how much of this specific segment to show
                // We need the path's total length to do this accurately via dasharray
                // A simplified approx: length visible = drawLen - startLen
                const visiblePart = drawLen - seg.startLen;
                // dasharray: [visible, gap]
                // gap should be huge to hide the rest
                el.style.strokeDasharray = `${visiblePart} 1000`;
                
                activeDataSegment = seg;
            }
        });
        
        // Edge case for end of history
        if (!activeDataSegment && this.segmentElements.length > 0) {
             if (drawLen >= this.totalLength * 0.95) {
                 activeDataSegment = this.segmentElements[this.segmentElements.length-1];
             } else {
                 activeDataSegment = this.segmentElements[0]; 
             }
        } else if (this.data.length === 1) {
            this.updateTextDisplay(this.data[0], null);
            return;
        }

        if (activeDataSegment) {
            this.updateTextDisplay(activeDataSegment.dataPoint, activeDataSegment.prevPoint);
        }
    }
}
