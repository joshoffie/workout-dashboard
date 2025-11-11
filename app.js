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

// ------------------ AUTH ------------------
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");

loginBtn.onclick = async () => {
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

auth.onAuthStateChanged(async (user) => {
  if (user) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userLabel.textContent = `Logged in as ${user.displayName}`;
    await loadUserJson();
    renderClients();
  } else {
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userLabel.textContent = "";
    clientsData = {};
    selectedClient = null;
    renderClients();
    hideAllDetails();
  }
});

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
}

async function saveUserJson() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  await db.collection("clients").doc(uid).set(clientsData, { merge: true });
}

// ------------------ RENDER CLIENTS ------------------
const clientList = document.getElementById("clientList");
function renderClients() {
  clientList.innerHTML = "";
  for (const name in clientsData) {
    const li = document.createElement("li");
    li.textContent = name;
    li.style.cursor = "pointer";
    li.onclick = () => selectClient(name);
    clientList.appendChild(li);
  }
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
  document.getElementById("sessionsDiv").classList.remove("hidden");
  document.getElementById("exercisesDiv").classList.add("hidden");
  document.getElementById("setsDiv").classList.add("hidden");
}

// ------------------ SESSIONS ------------------
const sessionList = document.getElementById("sessionList");
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
  document.getElementById("selectedSessionLabel").textContent = "";
  document.getElementById("exercisesDiv").classList.add("hidden");
  const sessions = clientsData[selectedClient].sessions || [];
  sessions.forEach((sess, idx) => {
    const li = document.createElement("li");
    li.textContent = sess.session_name;
    li.style.cursor = "pointer";
    li.onclick = () => selectSession(idx);
    sessionList.appendChild(li);
  });
}

function selectSession(idx) {
  selectedSession = clientsData[selectedClient].sessions[idx];
  selectedExercise = null;
  document.getElementById("selectedSessionLabel").textContent = selectedSession.session_name;
  renderExercises();
  document.getElementById("exercisesDiv").classList.remove("hidden");
  document.getElementById("setsDiv").classList.add("hidden");
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
  document.getElementById("setsDiv").classList.add("hidden");
  selectedSession.exercises.forEach((ex, idx) => {
    const li = document.createElement("li");
    li.textContent = ex.exercise;
    li.style.cursor = "pointer";
    li.onclick = () => selectExercise(idx);
    exerciseList.appendChild(li);
  });
}

function selectExercise(idx) {
  selectedExercise = selectedSession.exercises[idx];
  document.getElementById("selectedExerciseLabel").textContent = selectedExercise.exercise;
  renderSets();
  document.getElementById("setsDiv").classList.remove("hidden");
}

// ------------------ SETS ------------------
const setsTable = document.querySelector("#setsTable tbody");
document.getElementById("addSetBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  const reps = parseInt(prompt("Reps:"));
  if (isNaN(reps)) return;
  const weight = parseFloat(prompt("Weight:"));
  if (isNaN(weight)) return;
  const notes = prompt("Notes:") || "";
  const timestamp = new Date().toISOString();
  const volume = reps * weight;
  selectedExercise.sets.push({ reps, weight, volume, notes, timestamp });
  saveUserJson();
  renderSets();
};

function renderSets() {
  setsTable.innerHTML = "";
  if (!selectedExercise) return;
  selectedExercise.sets.forEach((s, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${idx+1}</td><td>${s.reps}</td><td>${s.weight}</td><td>${s.volume}</td><td>${s.notes}</td><td>${s.timestamp}</td>`;
    setsTable.appendChild(tr);
  });
}

// ------------------ PLOTLY GRAPH ------------------
document.getElementById("showGraphBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  const sets = selectedExercise.sets;
  if (!sets || sets.length === 0) { alert("No sets to graph"); return; }
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
};

// ------------------ HELPER ------------------
function hideAllDetails() {
  document.getElementById("sessionsDiv").classList.add("hidden");
  document.getElementById("exercisesDiv").classList.add("hidden");
  document.getElementById("setsDiv").classList.add("hidden");
  document.getElementById("graphDiv").innerHTML = "";
}

// ------------------ AUTO-SAVE & PREVIOUS SETS ------------------

// Get the last set for the same exercise across previous sessions
function getPreviousSet() {
  if (!selectedClient || !selectedExercise) return null;
  const sessions = clientsData[selectedClient].sessions || [];
  for (let i = sessions.length - 1; i >= 0; i--) {
    const sess = sessions[i];
    if (sess === selectedSession) continue; // skip current session
    for (const ex of sess.exercises || []) {
      if (ex.exercise === selectedExercise.exercise && ex.sets && ex.sets.length) {
        return ex.sets[ex.sets.length - 1]; // last set
      }
    }
  }
  return null;
}

// Override add set button
document.getElementById("addSetBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }

  const prevSet = getPreviousSet();
  const prevReps = prevSet ? prevSet.reps : "";
  const prevWeight = prevSet ? prevSet.weight : "";

  let reps = prompt(`Reps (previous: ${prevReps || "N/A"}):`);
  if (!reps || isNaN(reps)) return;
  reps = parseInt(reps);

  let weight = prompt(`Weight (previous: ${prevWeight || "N/A"}):`);
  if (!weight || isNaN(weight)) return;
  weight = parseFloat(weight);

  let notes = prompt("Notes:") || "";
  const timestamp = new Date().toISOString();
  const volume = reps * weight;

  selectedExercise.sets.push({ reps, weight, volume, notes, timestamp });
  saveUserJson(); // AUTO-SAVE
  renderSets();
};

let editMode = false;
const editToggleBtn = document.getElementById("editToggleBtn");

editToggleBtn.onclick = () => {
  editMode = !editMode;
  editToggleBtn.textContent = editMode ? "Done" : "Edit";

  // Visual cue for editable text
  document.querySelectorAll(".editable").forEach(el => {
    el.style.color = editMode ? "red" : "black";
  });

  // Optional: subtle background color change
  document.body.style.backgroundColor = editMode ? "#f9f9f9" : "#fff";

  if (!editMode) {
    // Done pressed → save changes automatically
    saveUserJson();
  }
};


// ------------------ MAKE ELEMENTS EDITABLE ------------------
function makeEditable(element, type, parentIdx = null) {
  element.classList.add("editable");
  element.style.cursor = "pointer";

  element.onclick = (e) => {
    if (!editMode) return; // normal selection
    e.stopPropagation();

    let currentVal = element.textContent;
    let newVal = prompt(`Edit ${type}:`, currentVal);
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

      case "Session":
        selectedSession.session_name = newVal;
        renderSessions();
        break;

      case "Exercise":
        selectedExercise.exercise = newVal;
        renderExercises();
        break;

      case "SetReps":
        selectedExercise.sets[parentIdx].reps = parseInt(newVal) || selectedExercise.sets[parentIdx].reps;
        selectedExercise.sets[parentIdx].volume = selectedExercise.sets[parentIdx].reps * selectedExercise.sets[parentIdx].weight;
        renderSets();
        break;

      case "SetWeight":
        selectedExercise.sets[parentIdx].weight = parseFloat(newVal) || selectedExercise.sets[parentIdx].weight;
        selectedExercise.sets[parentIdx].volume = selectedExercise.sets[parentIdx].reps * selectedExercise.sets[parentIdx].weight;
        renderSets();
        break;

      case "SetNotes":
        selectedExercise.sets[parentIdx].notes = newVal;
        renderSets();
        break;
    }

    saveUserJson();
  };
}

// ------------------ HOOK EDITABLES ------------------
function hookEditables() {
  // Clients
  document.querySelectorAll("#clientList li").forEach(li => makeEditable(li, "Client"));

  // Sessions
  document.querySelectorAll("#sessionList li").forEach((li, idx) => makeEditable(li, "Session"));

  // Exercises
  document.querySelectorAll("#exerciseList li").forEach((li, idx) => makeEditable(li, "Exercise"));

  // Sets table
  setsTable.querySelectorAll("tr").forEach((tr, idx) => {
    const tds = tr.querySelectorAll("td");
    makeEditable(tds[1], "SetReps", idx);
    makeEditable(tds[2], "SetWeight", idx);
    makeEditable(tds[4], "SetNotes", idx);
  });
}

// ------------------ OVERRIDE RENDERS TO HOOK EDITABLES ------------------
const originalRenderClients = renderClients;
renderClients = () => { originalRenderClients(); hookEditables(); };
const originalRenderSessions = renderSessions;
renderSessions = () => { originalRenderSessions(); hookEditables(); };
const originalRenderExercises = renderExercises;
renderExercises = () => { originalRenderExercises(); hookEditables(); };
const originalRenderSets = renderSets;
renderSets = () => { originalRenderSets(); hookEditables(); };

// Initial hook
hookEditables();

