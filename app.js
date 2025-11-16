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

// This maps all our screens
const SCREENS = {
  CLIENTS: 'clientsDiv',
  SESSIONS: 'sessionsDiv',
  EXERCISES: 'exercisesDiv',
  SETS: 'setsDiv',
  GRAPH: 'graphContainer'
};

// This will store which screen is currently visible
let currentScreen = SCREENS.CLIENTS;

/**
 * Handles all screen-to-screen navigation with animations.
 * @param {string} targetScreenId - The ID of the screen to show (e.g., SCREENS.SESSIONS)
 * @param {'forward' | 'back'} direction - The animation direction
 */
function navigateTo(targetScreenId, direction = 'forward') {
  const targetScreen = document.getElementById(targetScreenId);
  const currentScreenEl = document.getElementById(currentScreen);
  
  if (!targetScreen || targetScreen === currentScreenEl) return;

  const enterClass = (direction === 'forward') ? 'slide-in-right' : 'slide-in-left';
  const exitClass = (direction === 'forward') ? 'slide-out-left' : 'slide-out-right';

  // 1. Prepare target screen
  targetScreen.classList.remove('hidden', 'slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  targetScreen.classList.add(enterClass);

  // 2. Animate current screen out
  currentScreenEl.classList.remove('slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  currentScreenEl.classList.add(exitClass);

  // 3. Update current screen variable
  currentScreen = targetScreenId;

  // 4. Clean up classes after animation
  currentScreenEl.addEventListener('animationend', () => {
    currentScreenEl.classList.add('hidden');
    currentScreenEl.classList.remove(exitClass);
  }, { once: true }); // 'once: true' removes the listener after it fires

  targetScreen.addEventListener('animationend', () => {
    targetScreen.classList.remove(enterClass);
  }, { once: true });
}


// --- Wire up the new Back Buttons ---
document.getElementById('backToClientsBtn').onclick = () => {
  // Reset all state when going to main screen
  selectedClient = null;
  selectedSession = null;
  selectedExercise = null;
  navigateTo(SCREENS.CLIENTS, 'back');
};
document.getElementById('backToSessionsBtn').onclick = () => {
  // Reset downstream state
  selectedSession = null;
  selectedExercise = null;
  navigateTo(SCREENS.SESSIONS, 'back');
};
document.getElementById('backToExercisesBtn').onclick = () => {
  // Reset downstream state
  selectedExercise = null;
  navigateTo(SCREENS.EXERCISES, 'back'); // <-- FIX: This was targeting the wrong screen
};
document.getElementById('backToSetsFromGraphBtn').onclick = () => {
  // No state to reset, just navigate
  navigateTo(SCREENS.SETS, 'back');
};

// ------------------ AUTH ------------------
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");

const modal = document.getElementById("loginModal");
const modalLoginBtn = document.getElementById("modalLoginBtn");

// ADD THESE LINES
const deleteModal = document.getElementById('deleteModal');
const deleteModalMessage = document.getElementById('deleteModalMessage');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');

// Show modal if user is not logged in
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Hide modal
    modal.classList.add("hidden");
    
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userLabel.textContent = `Logged in as ${user.displayName}`;
    await loadUserJson();
    renderClients();
  } else {
    // Show modal
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

// Login via modal button
modalLoginBtn.onclick = async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (err) {
    alert("Login failed: " + err.message);
  }
};

// Keep logoutBtn as is
logoutBtn.onclick = async () => {
  await auth.signOut();
};

/**
 * Shows the custom confirmation modal.
 * @param {string} message - The message to display.
 * @param {function} onConfirm - The callback function to run if "Delete" is clicked.
 */
function showDeleteConfirm(message, onConfirm) {
  deleteModalMessage.textContent = message;
  deleteModal.classList.remove('hidden');

  // We use { once: true } so these listeners automatically remove themselves
  // This prevents bugs where clicking delete fires multiple times
  deleteConfirmBtn.addEventListener('click', () => {
    onConfirm();
    hideDeleteConfirm();
  }, { once: true });

  deleteCancelBtn.addEventListener('click', () => {
    hideDeleteConfirm();
  }, { once: true });
}

/** Hides the custom confirmation modal */
function hideDeleteConfirm() {
  deleteModal.classList.add('hidden');
}
// Also hide modal if cancel is clicked (as a fallback)
deleteCancelBtn.onclick = hideDeleteConfirm;


// ------------------ FIRESTORE DATA ------------------
async function loadUserJson() {
  const uid = auth.currentUser.uid;
  const docRef = db.collection("clients").doc(uid);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    clientsData = docSnap.data();  // load existing JSON
  } else {
    clientsData = {}; // empty structure
    await docRef.set(clientsData);
  }
  console.log("Data loaded from Firestore:", clientsData);
}

async function saveUserJson() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  
  // REMOVED { merge: true }
  // This ensures the document is fully overwritten, allowing
  // top-level client deletions to be saved correctly.
  await db.collection("clients").doc(uid).set(clientsData);
}

// ------------------ RENDER CLIENTS ------------------
const clientList = document.getElementById("clientList");
function renderClients() {
  clientList.innerHTML = "";
  // INSIDE renderClients()
  for (const name in clientsData) {
    const li = document.createElement("li");
    li.style.cursor = "pointer";

    // 1. Create a span for the editable text
    const nameSpan = document.createElement("span");
    nameSpan.textContent = name;
    
    // 2. Add click listener to the *entire li* for non-edit mode
    li.onclick = (e) => {
      // If we're in edit mode, stop. The 'makeEditable' listener on the span will handle it.
      if (editMode) {
        e.stopPropagation(); 
        return;
      }
      selectClient(name);
    };

    // 3. Create the delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;'; // 'x' icon
    deleteBtn.onclick = (e) => {
      e.stopPropagation(); // Stop it from selecting the client
      showDeleteConfirm(`Are you sure you want to delete client "${name}"? This will delete all their sessions.`, () => {
        delete clientsData[name];
        saveUserJson();
        renderClients();
        // If they deleted the currently selected client, go back
        if (selectedClient === name) {
          navigateTo(SCREENS.CLIENTS, 'back');
        }
      });
    };

    // 4. Append the new span and the button
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    
    clientList.appendChild(li);
  }
  // After rendering, hook listeners
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
  document.getElementById("selectedClientLabel").textContent = name;
  renderSessions();
  navigateTo(SCREENS.SESSIONS, 'forward');
}

// ------------------ SESSIONS ------------------
const sessionList = document.getElementById("sessionList");

/**
 * A robust helper function to sort sessions by date, descending.
 * Handles missing or invalid dates.
 * @param {Array} sessionsArray - The array of session objects to sort.
 * @returns {Array} A new, sorted array.
 */
function getSortedSessions(sessionsArray) {
  if (!sessionsArray) return [];
  
  return sessionsArray.slice().sort((a, b) => {
    // Get date for B, default to 0 (epoch) if missing/invalid
    let dateB = b.date ? new Date(b.date) : new Date(0);
    if (isNaN(dateB.getTime())) dateB = new Date(0);

    // Get date for A, default to 0 (epoch) if missing/invalid
    let dateA = a.date ? new Date(a.date) : new Date(0);
    if (isNaN(dateA.getTime())) dateA = new Date(0);

    // Compare timestamps (most recent first)
    return dateB.getTime() - dateA.getTime();
  });
}


document.getElementById("addSessionBtn").onclick = () => {
  if (!selectedClient) { alert("Select a client first"); return; }
  const name = prompt("Enter session name:");
  if (!name) return;
  // Make sure to add the 'date' field
  const session = { session_name: name, exercises: [], date: new Date().toISOString() };
  clientsData[selectedClient].sessions.push(session);
  saveUserJson();
  renderSessions();
};

function renderSessions() {
  sessionList.innerHTML = "";
  if (!selectedClient) return;
  selectedSession = null;
  document.getElementById("selectedSessionLabel").textContent = "";

  const sessions = clientsData[selectedClient]?.sessions || [];
  
  // Use the robust sorting function
  const sortedSessions = getSortedSessions(sessions);

  sortedSessions.forEach((sess, idx) => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";

    // 1. Create a span for the editable text
    const nameSpan = document.createElement("span");
    nameSpan.textContent = sess.session_name;

    // 2. Add click listener to the *entire li* for non-edit mode
    li.onclick = (e) => {
      if (editMode) {
        e.stopPropagation();
        return;
      }
      // Pass the session object itself, not the index
      selectSession(sess);
    };

    // 3. Create the delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete session "${sess.session_name}"?`, () => {
        
        // Find the actual index of this session in the *original* array
        const sessionIndex = clientsData[selectedClient].sessions.findIndex(s => s === sess);
        if (sessionIndex > -1) {
          clientsData[selectedClient].sessions.splice(sessionIndex, 1);
          saveUserJson();
          renderSessions();
        }

        // If they deleted the selected session, go back
        if (selectedSession === sess) {
          navigateTo(SCREENS.SESSIONS, 'back');
        }
      });
    };

    // 4. Append the new span and the button
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    
    sessionList.appendChild(li);
  });
  // After rendering, hook listeners
  hookEditables();
}


// Now accepts the full session object
function selectSession(sessionObject) {
  selectedSession = sessionObject; // <-- Pass the whole object
  selectedExercise = null;
  document.getElementById("selectedSessionLabel").textContent = selectedSession.session_name;
  renderExercises();
  navigateTo(SCREENS.EXERCISES, 'forward'); // <-- THIS IS THE FIX
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
  if (!selectedSession) return;
  selectedExercise = null;
  document.getElementById("selectedExerciseLabel").textContent = "";

  // INSIDE renderExercises()
  selectedSession.exercises.forEach((ex, idx) => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";

    // 1. Create a span for the editable text
    const nameSpan = document.createElement("span");
    nameSpan.textContent = ex.exercise;

    // 2. Add click listener to the *entire li* for non-edit mode
    li.onclick = (e) => {
      if (editMode) {
        e.stopPropagation();
        return;
      }
      selectExercise(idx);
    };

    // 3. Create the delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete exercise "${ex.exercise}"?`, () => {
        selectedSession.exercises.splice(idx, 1);
        saveUserJson();
        renderExercises();
        // If they deleted the selected exercise, go back
        if (selectedExercise === ex) {
          navigateTo(SCREENS.EXERCISES, 'back');
        }
      });
    };

    // 4. Append the new span and the button
    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);

    exerciseList.appendChild(li);
  });
  // After rendering, hook listeners
  hookEditables();
}

function selectExercise(idx) {
  selectedExercise = selectedSession.exercises[idx];
  document.getElementById("selectedExerciseLabel").textContent = selectedExercise.exercise;
  renderSets(); // This will now trigger the console.log
  navigateTo(SCREENS.SETS, 'forward');
  document.getElementById("graphContainer").classList.add("hidden"); // This is still needed
}

// ------------------ SETS ------------------
const setsTable = document.querySelector("#setsTable tbody");

// Get the very last set for this exercise, regardless of session
function getLastSet() {
    if (!selectedExercise || !selectedExercise.sets || selectedExercise.sets.length === 0) {
        return null;
    }
    // Sort sets by timestamp to find the most recent one
    const sortedSets = selectedExercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return sortedSets[0];
}

document.getElementById("addSetBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }

  // Get last set from *current* exercise object
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
  saveUserJson(); // AUTO-SAVE
  renderSets(); // This will re-render and trigger runComparisonLogic()
};

function renderSets() {
  setsTable.innerHTML = "";
  if (!selectedExercise) return;

  // Sort sets by timestamp, most recent first, for display
  const sortedSets = selectedExercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  sortedSets.forEach((s, idx) => {
    const tr = document.createElement("tr");
    
    // Find the original index to make editing work
    const originalIndex = selectedExercise.sets.indexOf(s);
    
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${s.reps}</td>
      <td>${s.weight}</td>
      <td>${s.volume}</td>
      <td>${s.notes}</td>
      <td>${new Date(s.timestamp).toLocaleString()}</td>
    `;
    
    // --- ADD THIS DELETE BUTTON LOGIC ---
    const deleteTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete set ${idx + 1}?`, () => {
        // Use originalIndex to delete from the *unsorted* array
        selectedExercise.sets.splice(originalIndex, 1);
        saveUserJson();
        renderSets(); // Re-render, which will also update the comparison
      });
    };
    deleteTd.appendChild(deleteBtn);
    tr.appendChild(deleteTd);
    // --- END ADD ---

    setsTable.appendChild(tr);
  });
  // After rendering, hook listeners
  hookEditables(sortedSets); // Pass sorted sets to hookables

  // --- NEW (STEP 2) ---
  // Run the comparison logic and log to console
  runComparisonLogic();
}


// ------------------ PLOTLY GRAPH ------------------
document.getElementById("showGraphBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  const sets = selectedExercise.sets;
  if (!sets || sets.length === 0) { alert("No sets to graph"); return; }

  // --- FIX #1: UN-HIDE THE CONTAINER *BEFORE* PLOTTING ---
  navigateTo(SCREENS.GRAPH, 'forward');;

  const dates = sets.map(s => s.timestamp);
  const reps = sets.map(s => s.reps);
  const weight = sets.map(s => s.weight);
  const volume = sets.map(s => s.volume);
  const wpr = sets.map(s => s.volume / s.reps); // Note: This will be Infinity if reps=0, be careful
  
  const traces = [
    { x: dates, y: reps, type: 'scatter', mode: 'lines+markers', name: 'Reps' },
    { x: dates, y: weight, type: 'scatter', mode: 'lines+markers', name: 'Weight' },
    { x: dates, y: volume, type: 'scatter', mode: 'lines+markers', name: 'Volume' },
    { x: dates, y: wpr, type: 'scatter', mode: 'lines+markers', name: 'Weight/Rep' }
  ];
  
  Plotly.newPlot('graphDiv', traces, { title: `${selectedExercise.exercise} Progress`, hovermode: 'x unified' });

  // --- FIX #2: FORCE PLOTLY TO RESIZE (just in case) ---
  Plotly.Plots.resize('graphDiv');
};

// ------------------ HELPER ------------------
function hideAllDetails() {
  // Hide all screens instantly
  Object.values(SCREENS).forEach(screenId => {
    document.getElementById(screenId).classList.add('hidden');
  });

  // Show the main one
  document.getElementById(SCREENS.CLIENTS).classList.remove('hidden');
  currentScreen = SCREENS.CLIENTS;

  // Also clear the graph
  document.getElementById("graphDiv").innerHTML = "";
}

// ------------------ NEW COMPARISON LOGIC (STEP 2.8) ------------------

/**
// ... existing code ... -->
 * @returns {boolean}
 */
function isSameDay(d1, d2) {
// ... existing code ... -->
         d1.getDate() === d2.getDate();
}

/**
// ... existing code ... -->
 * @returns {object} An object with { sets, reps, volume, wpr }
 */
function aggregateStats(setsArray) {
// ... existing code ... -->
  const avgWpr = totalReps > 0 ? (totalVolume / totalReps) : 0; // Avg Weight per Rep

  return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
}

// --- NEW (STEP 3A) ---
/**
 * Updates a single stat row in the comparison banner.
 * @param {string} statName - The prefix ('sets', 'reps', 'volume', 'wpr')
 * @param {number} currentValue - The current workout's value
 * @param {number} previousValue - The previous workout's value
 */
function updateStatUI(statName, currentValue, previousValue) {
  const arrowEl = document.getElementById(statName + 'Arrow');
  const spiralEl = document.getElementById(statName + 'Spiral');
  
  if (!arrowEl || !spiralEl) {
    console.warn(`Could not find UI elements for stat: ${statName}`);
    return;
  }

  let status = 'neutral';
  let arrow = '—'; // Neutral arrow

  // Use a small epsilon for floating point comparison (for wpr)
  const epsilon = 0.01; 

  if (currentValue > previousValue + epsilon) {
    status = 'increase';
    arrow = '▲'; // Up arrow
  } else if (currentValue < previousValue - epsilon) {
    status = 'decrease';
    arrow = '▼'; // Down arrow
  }

  // Update Arrow
  arrowEl.textContent = arrow;
  arrowEl.classList.remove('increase', 'decrease', 'neutral');
  arrowEl.classList.add(status);

  // Update Spiral
  spiralEl.classList.remove('increase', 'decrease', 'neutral');
  spiralEl.classList.add(status);
}


/**
 * Main function to run the comparison based on timestamps.
 */
function runComparisonLogic() {
// ... existing code ... -->
  if (!selectedExercise || !selectedExercise.sets || selectedExercise.sets.length < 2) {
    banner.classList.add('hidden'); // Hide banner if not enough data
    return;
  }
  
  console.log("--- WORKOUT COMPARISON (STEP 3A) ---"); // <-- Updated log
  
  // 1. Get all sets and sort them, most recent first
// ... existing code ... -->
  const previousDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), previousWorkoutDate));

  // 8. Aggregate stats for both days
  const currentStats = aggregateStats(currentDaySets);
  const prevStats = aggregateStats(previousDaySets);

  // 9. Log everything to the console for this step
  console.log(`[runComparisonLogic] Most Recent Date: ${mostRecentDate.toDateString()}`);
// ... existing code ... -->
  console.log(`[runComparisonLogic] Previous Workout Date: ${previousWorkoutDate.toDateString()}`);
  console.log("[runComparisonLogic] Previous Stats:", prevStats);
  console.log("-------------------------------------");
  
  // --- MODIFIED (STEP 3A) ---
  // Hook up the data to the UI
  updateStatUI('sets', currentStats.sets, prevStats.sets);
  updateStatUI('reps', currentStats.reps, prevStats.reps);
  updateStatUI('volume', currentStats.volume, prevStats.volume);
  updateStatUI('wpr', currentStats.wpr, prevStats.wpr);
  
  // Show the banner
  banner.classList.remove('hidden');
}


// ------------------ EDIT MODE ------------------
// ... existing code ... -->
