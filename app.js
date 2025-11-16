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
  
  // --- NEW (STEP 2) ---
  // Sort sessions by date, most recent first. .slice() makes a copy.
  const sortedSessions = sessions.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

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
      // --- MODIFIED (STEP 2) ---
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
        
        // --- MODIFIED (STEP 2) ---
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


// --- MODIFIED (STEP 2) ---
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

// --- MODIFIED (STEP 2) ---
// Updated prompt logic to be clearer
document.getElementById("addSetBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }

  // Get last set from *current* session for quick copy
  const lastSetInCurrentSession = selectedExercise.sets[selectedExercise.sets.length - 1];
  
  // Get last set from *previous* session for comparison
  const prevSet = getPreviousSet(); // This now uses the new sorted logic
  
  // Default prompt values: Use last set from *this* session if it exists, otherwise last set from *previous* session
  const repsPrompt = lastSetInCurrentSession ? lastSetInCurrentSession.reps : (prevSet ? prevSet.reps : "");
  const weightPrompt = lastSetInCurrentSession ? lastSetInCurrentSession.weight : (prevSet ? prevSet.weight : "");
  
  // Text for the prompt:
  const prevRepsText = prevSet ? ` (prev sess: ${prevSet.reps})` : "";
  const prevWeightText = prevSet ? ` (prev sess: ${prevSet.weight})` : "";


  let reps = prompt(`Reps (last: ${repsPrompt})${prevRepsText}:`);
  if (!reps || isNaN(reps)) return;
  reps = parseInt(reps);

  let weight = prompt(`Weight (last: ${weightPrompt})${prevWeightText}:`);
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

  selectedExercise.sets.forEach((s, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${s.reps}</td>
      <td>${s.weight}</td>
      <td>${s.volume}</td>
      <td>${s.notes}</td>
      <td>${new Date(s.timestamp).toLocaleString()}</td>
    `;
    
    // We don't add listeners here anymore
    // hookEditables() will handle it

    // --- ADD THIS DELETE BUTTON LOGIC ---
    const deleteTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete set ${idx + 1}?`, () => {
        selectedExercise.sets.splice(idx, 1);
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
  hookEditables();

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

// ------------------ AUTO-SAVE & PREVIOUS SETS ------------------

// --- MODIFIED (STEP 2) ---
// Updated to use new sorting logic for consistency
function getPreviousSet() {
  if (!selectedClient || !selectedExercise) return null;
  
  // Get all sessions, sorted by date descending (most recent first)
  const sessions = (clientsData[selectedClient].sessions || []).slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const sess of sessions) {
    if (sess === selectedSession) continue; // skip current session
    
    for (const ex of (sess.exercises || [])) {
      if (ex.exercise === selectedExercise.exercise && ex.sets && ex.sets.length) {
        return ex.sets[ex.sets.length - 1]; // last set
      }
    }
  }
  return null;
}

// ------------------ NEW COMPARISON LOGIC (STEP 2) ------------------

/**
 * Calculates aggregate stats for the current exercise in the current session.
 * @returns {object|null} An object with { sets, reps, volume, wpr } or null if no sets.
 */
function getCurrentSessionStats() {
  if (!selectedExercise || !selectedExercise.sets || selectedExercise.sets.length === 0) {
    return null;
  }

  const sets = selectedExercise.sets;
  const totalSets = sets.length;
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
  const totalVolume = sets.reduce((sum, set) => sum + set.volume, 0);
  const avgWpr = totalReps > 0 ? (totalVolume / totalReps) : 0; // Avg Weight per Rep

  return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
}

/**
 * Finds the most recent previous session with the same exercise and calculates its stats.
 * @param {string} exerciseName The name of the exercise to look for.
 * @returns {object|null} An object with { sets, reps, volume, wpr } or null if not found.
 */
function getPreviousSessionStats(exerciseName) {
  if (!selectedClient || !exerciseName) return null;

  // Get all sessions, sorted by date descending (most recent first)
  // .slice() creates a copy so we don't mutate the original array
  const sessions = (clientsData[selectedClient].sessions || []).slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  for (const sess of sessions) {
    // Skip the currently selected session
    if (sess === selectedSession) continue;

    // Find the exercise in this older session
    const exercise = (sess.exercises || []).find(ex => ex.exercise === exerciseName);

    if (exercise && exercise.sets && exercise.sets.length > 0) {
      // Found the most recent previous session with this exercise.
      // Now, aggregate the stats for it.
      const sets = exercise.sets;
      const totalSets = sets.length;
      const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
      const totalVolume = sets.reduce((sum, set) => sum + set.volume, 0);
      const avgWpr = totalReps > 0 ? (totalVolume / totalReps) : 0;

      // Return the stats for *this* session's exercise
      return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
    }
  }

  return null; // No previous session found with this exercise
}

/**
 * Main function to run the comparison and log it.
 */
function runComparisonLogic() {
  const banner = document.getElementById('comparisonBanner'); // Get the banner
  if (!selectedExercise) {
    banner.classList.add('hidden'); // Hide banner if no exercise
    return;
  }

  const currentStats = getCurrentSessionStats();
  const prevStats = getPreviousSessionStats(selectedExercise.exercise);

  console.log("--- WORKOUT COMPARISON (STEP 2) ---");
  console.log("Current Stats:", currentStats);
  console.log("Previous Stats:", prevStats);
  console.log("-------------------------------------");
  
  // For this step, we'll just show the banner if we have data,
  // but we won't color it yet.
  if (!currentStats || !prevStats) {
    banner.classList.add('hidden');
  } else {
    banner.classList.remove('hidden');
  }
}

// ------------------ EDIT MODE ------------------

let editMode = false;
const editToggleBtn = document.getElementById("editToggleBtn");

editToggleBtn.onclick = () => {
  editMode = !editMode;
  editToggleBtn.textContent = editMode ? "Done" : "Edit";

  // This class now controls all edit-mode UI (delete buttons, text color)
  // The CSS file will do all the work.
  document.body.classList.toggle('edit-mode-active');

  if (!editMode) {
    // Done pressed  save changes automatically
    saveUserJson();
  }
};


// ------------------ MAKE ELEMENTS EDITABLE ------------------
function makeEditable(element, type, parentIdx = null) {
  element.classList.add("editable");
  element.style.cursor = "pointer";

  element.addEventListener("click", (e) => {
    if (!editMode) return; // allow normal click to propagate
    e.stopPropagation();

    const currentVal = element.textContent;
    const newVal = prompt(`Edit ${type}:`, currentVal);
    if (!newVal || newVal === currentVal) return;

    switch(type) {
      case "Client":
        const data = clientsData[currentVal];
        delete clientsData[currentVal];
        data.client_name = newVal;
        clientsData[newVal] = data;
        if (selectedClient === currentVal) selectedClient = newVal;
        renderClients();
        break;

      // --- MODIFIED (STEP 2) ---
      // Made this logic more robust, doesn't rely on selectedSession
      case "Session":
        const sessionToEdit = clientsData[selectedClient].sessions.find(s => s.session_name === currentVal);
        if (sessionToEdit) {
            sessionToEdit.session_name = newVal;
        }
        renderSessions(); // Re-render to show the new name
        break;

      // --- MODIFIED (STEP 2) ---
      // Made this logic more robust
      case "Exercise":
        const exerciseToEdit = selectedSession.exercises.find(ex => ex.exercise === currentVal);
        if(exerciseToEdit) {
            exerciseToEdit.exercise = newVal;
        }
        renderExercises();
        break;

      case "SetReps":
        selectedExercise.sets[parentIdx].reps = parseInt(newVal) || selectedExercise.sets[parentIdx].reps;
        selectedExercise.sets[parentIdx].volume = selectedExercise.sets[parentIdx].reps * selectedExercise.sets[parentIdx].weight;
        renderSets(); // This will re-render and trigger runComparisonLogic()
        break;

      case "SetWeight":
        selectedExercise.sets[parentIdx].weight = parseFloat(newVal) || selectedExercise.sets[parentIdx].weight;
        selectedExercise.sets[parentIdx].volume = selectedExercise.sets[parentIdx].reps * selectedExercise.sets[parentIdx].weight;
        renderSets(); // This will re-render and trigger runComparisonLogic()
        break;

      case "SetNotes":
        selectedExercise.sets[parentIdx].notes = newVal;
        renderSets(); // This will re-render and trigger runComparisonLogic()
        break;
    }

    saveUserJson();
  });
}

// ------------------ HOOK EDITABLES ------------------
function hookEditables() {
  // Clients
  document.querySelectorAll("#clientList li > span").forEach(span => makeEditable(span, "Client"));
  // Sessions
  document.querySelectorAll("#sessionList li > span").forEach((span, idx) => makeEditable(span, "Session"));
  // Exercises
  document.querySelectorAll("#exerciseList li > span").forEach((span, idx) => makeEditable(span, "Exercise"));
  
  // Sets table (This part was correct, leave it as is)
  setsTable.querySelectorAll("tr").forEach((tr, idx) => {
    const tds = tr.querySelectorAll("td");
    makeEditable(tds[1], "SetReps", idx);
    makeEditable(tds[2], "SetWeight", idx);
    makeEditable(tds[4], "SetNotes", idx);
  });
}
