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

  // --- 1. Sort sets by timestamp ASCENDING (earliest first) ---
  const sortedSets = selectedExercise.sets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // --- 2. Create a map of sets grouped by day ---
  const setsByDay = new Map();
  sortedSets.forEach(set => {
    const setDate = new Date(set.timestamp);
    const dayString = setDate.toDateString(); // "Sat Nov 15 2025"
    if (!setsByDay.has(dayString)) {
      setsByDay.set(dayString, []);
    }
    setsByDay.get(dayString).push(set);
  });

  // --- 3. Get the map keys (date strings) and sort them DESCENDING ---
  const sortedDays = Array.from(setsByDay.keys()).sort((a, b) => new Date(b) - new Date(a));

  // --- This array will hold the sets in the exact order they are rendered
  const renderedSetsInOrder = [];

  // --- 4. Iterate over sorted days (most recent first) ---
  sortedDays.forEach((dayString, dayIndex) => {
    
    // --- 5. Get the sets for this day (they are already in ascending order) ---
    const daySets = setsByDay.get(dayString);
    
    // --- 6. Render the sets for this day ---
    daySets.forEach((s, setIdx) => {
      const tr = document.createElement("tr");
      
      // --- NEW: Check if this is the last set of the day ---
      // and NOT the very last day in the list
      if (setIdx === daySets.length - 1 && dayIndex < sortedDays.length - 1) {
        tr.classList.add("day-end-row");
      }
      // --- END NEW ---

      // Find the original index from the *unsorted* array
      const originalIndex = selectedExercise.sets.indexOf(s);
      
      tr.innerHTML = `
        <td>${setIdx + 1}</td> <!-- This is the setCounter, 1-based -->
        <td>${s.reps}</td>
        <td>${s.weight}</td>
        <td>${s.volume}</td>
        <td>${s.notes}</td>
        <td>${new Date(s.timestamp).toLocaleString()}</td>
      `;
      
      // --- Add delete button ---
      const deleteTd = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        showDeleteConfirm(`Are you sure you want to delete set ${setIdx + 1} from this day?`, () => {
          // Use originalIndex to delete from the *unsorted* array
          selectedExercise.sets.splice(originalIndex, 1);
          saveUserJson();
          renderSets(); // Re-render, which will also update the comparison
        });
      };
      deleteTd.appendChild(deleteBtn);
      tr.appendChild(deleteTd);
      
      setsTable.appendChild(tr);

      // --- Add to our flat array for hookEditables ---
      renderedSetsInOrder.push(s);
    });

    // --- 7. REMOVED the divider <tr> logic ---
    /*
    if (dayIndex < sortedDays.length - 1) {
      const dividerTr = document.createElement("tr");
...
      dividerTr.appendChild(dividerTd);
      setsTable.appendChild(dividerTr);
    }
    */
  });

  // --- 8. Hook editables ---
  // Pass the flat array of sets *in render order*
  hookEditables(renderedSetsInOrder);

  // Run the comparison logic
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

// ------------------ NEW COMPARISON LOGIC ------------------

/**
 * Checks if two Date objects are on the same calendar day.
 * @param {Date} d1 - First date
 * @param {Date} d2 - Second date
 * @returns {boolean}
 */
function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * Aggregates stats for a given array of set objects.
 * @param {Array} setsArray - An array of set objects
 * @returns {object} An object with { sets, reps, volume, wpr }
 */
function aggregateStats(setsArray) {
  if (!setsArray || setsArray.length === 0) {
    return { sets: 0, reps: 0, volume: 0, wpr: 0 };
  }

  const totalSets = setsArray.length;
  const totalReps = setsArray.reduce((sum, set) => sum + set.reps, 0);
  const totalVolume = setsArray.reduce((sum, set) => sum + set.volume, 0);
  const avgWpr = totalReps > 0 ? (totalVolume / totalReps) : 0; // Avg Weight per Rep

  return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
}

/**
 * Helper to format numbers.
 * @param {number} num - The number to format
 * @returns {string} A formatted string
 */
function formatNum(num) {
  // Check if number is an integer
  if (num % 1 === 0) {
    return num.toString();
  }
  // Otherwise, return with 1 decimal place
  return num.toFixed(1);
}

/**
 * Updates a single stat row in the comparison banner.
 * @param {string} statName - The prefix ('sets', 'reps', 'volume', 'wpr')
 * @param {number} currentValue - The current workout's value
 * @param {number} previousValue - The previous workout's value
 */
function updateStatUI(statName, currentValue, previousValue) {
  // Get all the elements for this stat row
  const arrowEl = document.getElementById(statName + 'Arrow');
  const spiralEl = document.getElementById(statName + 'Spiral');
  const dataEl = document.getElementById(statName + 'Data'); // <-- NEW
  
  if (!arrowEl || !spiralEl || !dataEl) { // <-- MODIFIED
    console.warn(`Could not find all UI elements for stat: ${statName}`);
    return;
  }

  // --- 1. Determine Status & Arrow ---
  let status = 'neutral';
  let arrow = '—'; // Neutral arrow
  const epsilon = 0.01; // For float comparison

  if (currentValue > previousValue + epsilon) {
    status = 'increase';
    arrow = '&uarr;'; // Up arrow (FIXED)
  } else if (currentValue < previousValue - epsilon) {
    status = 'decrease';
    arrow = '&darr;'; // Down arrow (FIXED)
  }
  
  // --- 2. Calculate Change & Percentage ---
  const change = currentValue - previousValue;
  let percentageChange = 0;
  if (previousValue !== 0) {
    percentageChange = (change / previousValue) * 100;
  } else if (currentValue > 0) {
    percentageChange = 100; // From 0 to something is +100%
  }

  // --- 3. Format Strings ---
  let currentString = '';
  let changeString = '';
  const changeSign = change > 0 ? '+' : '';
  
  // Create the string for the current value
  switch(statName) {
    case 'sets':
      currentString = `${formatNum(currentValue)} Sets`;
      break;
    case 'reps':
      currentString = `${formatNum(currentValue)} Reps`;
      break;
    case 'volume':
      currentString = `${formatNum(currentValue)} lb`;
      break;
    case 'wpr':
      currentString = `${formatNum(currentValue)} lb/rep`;
      break;
  }
  
  // Create the string for the change
  changeString = `(${changeSign}${formatNum(change)} / ${changeSign}${Math.abs(percentageChange).toFixed(0)}%)`;
  if (status === 'neutral') {
    changeString = `(0 / 0%)`;
  }
  
  // --- 4. Apply to UI ---
  const classesToRemove = ['increase', 'decrease', 'neutral'];

  // Update Arrow
  arrowEl.innerHTML = arrow; // <-- This was the typo fix
  arrowEl.classList.remove(...classesToRemove);
  arrowEl.classList.add(status);

  // Update Spiral
  spiralEl.classList.remove(...classesToRemove);
  spiralEl.classList.add(status);
  
  // Update Data Text (NEW)
  dataEl.textContent = `${currentString} ${changeString}`;
  dataEl.classList.remove(...classesToRemove);
  dataEl.classList.add(status);
}


/**
 * Main function to run the comparison based on timestamps.
 */
function runComparisonLogic() {
  const banner = document.getElementById('comparisonBanner');
  if (!selectedExercise || !selectedExercise.sets || selectedExercise.sets.length < 2) {
    banner.classList.add('hidden'); // Hide banner if not enough data
    return;
  }
  
  console.log("--- WORKOUT COMPARISON (FINAL) ---"); // <-- Updated log
  
  // 1. Get all sets and sort them, most recent first
  const allSets = selectedExercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // 2. Find the date of the most recent workout
  const mostRecentDate = new Date(allSets[0].timestamp);
  
  // 3. Get all sets from that date
  const currentDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), mostRecentDate));
  
  // 4. Find the first set that is *not* from the most recent date
  const previousWorkoutSet = allSets.find(set => !isSameDay(new Date(set.timestamp), mostRecentDate));

  // 5. If no such set exists, there is no previous workout to compare to
  if (!previousWorkoutSet) {
    console.log("[runComparisonLogic] Found current stats, but no previous workout day found.");
    banner.classList.add('hidden');
    return;
  }

  // 6. Get the date of that previous workout
  const previousWorkoutDate = new Date(previousWorkoutSet.timestamp);

  // 7. Get all sets matching that previous workout date
  const previousDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), previousWorkoutDate));

  // 8. Aggregate stats for both days
  const currentStats = aggregateStats(currentDaySets);
  const prevStats = aggregateStats(previousDaySets);

  // 9. Log everything to the console
  console.log(`[runComparisonLogic] Most Recent Date: ${mostRecentDate.toDateString()}`);
  console.log("[runComparisonLogic] Current Stats:", currentStats);
  console.log(`[runComparisonLogic] Previous Workout Date: ${previousWorkoutDate.toDateString()}`);
  console.log("[runComparisonLogic] Previous Stats:", prevStats);
  console.log("-------------------------------------");
  
  // 10. Hook up the data to the UI
  updateStatUI('sets', currentStats.sets, prevStats.sets);
  updateStatUI('reps', currentStats.reps, prevStats.reps);
  updateStatUI('volume', currentStats.volume, prevStats.volume);
  updateStatUI('wpr', currentStats.wpr, prevStats.wpr);
  
  // Show the banner
  banner.classList.remove('hidden');
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
// --- MODIFIED (STEP 2.8) ---
// Now takes sortedSets as an argument to find the correct original index
function makeEditable(element, type, parentIdx, sortedSets) {
  element.classList.add("editable");
  element.style.cursor = "pointer";

  element.addEventListener("click", (e) => {
    if (!editMode) return; // allow normal click to propagate
    e.stopPropagation();

    const currentVal = element.textContent;
    const newVal = prompt(`Edit ${type}:`, currentVal);
    if (!newVal || newVal === currentVal) return;

    // --- NEW (STEP 2.8) ---
    // Find the *original* index before editing
    let originalIndex = -1;
    if (type.startsWith("Set")) {
        const sortedSetObject = sortedSets[parentIdx]; // Use parentIdx to find the set in the flat render-order array
        if (!sortedSetObject) {
            console.error("Could not find set object to edit!");
            return;
        }
        originalIndex = selectedExercise.sets.indexOf(sortedSetObject); // Find its *true* index
        if (originalIndex === -1) {
            console.error("Could not find set to edit!");
            return;
        }
    }
    // --- END NEW ---

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
        if (sessionToEdit) {
            sessionToEdit.session_name = newVal;
        }
        renderSessions(); // Re-render to show the new name
        break;

      case "Exercise":
        const exerciseToEdit = selectedSession.exercises.find(ex => ex.exercise === currentVal);
        if(exerciseToEdit) {
            exerciseToEdit.exercise = newVal;
        }
        renderExercises();
        break;

      case "SetReps":
        selectedExercise.sets[originalIndex].reps = parseInt(newVal) || selectedExercise.sets[originalIndex].reps;
        selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight;
        renderSets(); // This will re-render and trigger runComparisonLogic()
        break;

      case "SetWeight":
        selectedExercise.sets[originalIndex].weight = parseFloat(newVal) || selectedExercise.sets[originalIndex].weight;
        selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight;
        renderSets(); // This will re-render and trigger runComparisonLogic()
        break;

      case "SetNotes":
        selectedExercise.sets[originalIndex].notes = newVal;
        renderSets(); // This will re-render and trigger runComparisonLogic()
        break;
    }

    saveUserJson();
  });
}

// ------------------ HOOK EDITABLES ------------------
// --- MODIFIED ---
// Now passes the flat render-order array to makeEditable
function hookEditables(sortedSets = []) {
  // Clients
  document.querySelectorAll("#clientList li > span").forEach(span => makeEditable(span, "Client"));
  // Sessions
  document.querySelectorAll("#sessionList li > span").forEach((span, idx) => makeEditable(span, "Session"));
  // Exercises
  document.querySelectorAll("#exerciseList li > span").forEach((span, idx) => makeEditable(span, "Exercise"));
  
  // Sets table
  let setRowIdx = 0; // <-- Counter for *set rows only*
  setsTable.querySelectorAll("tr").forEach((tr) => {
    // --- REMOVED: Day divider check is no longer needed ---
    // if (tr.classList.contains('day-divider')) return;
    // --- END REMOVED ---

    const tds = tr.querySelectorAll("td");
    
    // Safety check to ensure it's a set row
    if (tds.length < 5) return;
    
    // We use setRowIdx to look up the item in the flat sortedSets array
    // This correctly skips the divider rows.
    makeEditable(tds[1], "SetReps", setRowIdx, sortedSets);
    makeEditable(tds[2], "SetWeight", setRowIdx, sortedSets);
    makeEditable(tds[4], "SetNotes", setRowIdx, sortedSets);
    
    setRowIdx++; // Increment only when we've processed a set row
  });
}
