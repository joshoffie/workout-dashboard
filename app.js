// ------------------ FIREBASE CONFIG ------------------
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
let editMode = false;

// ------------------ SCREEN NAV ------------------
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
}

// Back buttons
document.getElementById("backToClients").onclick = () => showScreen("clientsScreen");
document.getElementById("backToSessions").onclick = () => showScreen("sessionsScreen");
document.getElementById("backToExercises").onclick = () => showScreen("exercisesScreen");

// ------------------ AUTH ------------------
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");

auth.onAuthStateChanged(async user => {
  if (user) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userLabel.textContent = `Logged in as ${user.displayName}`;
    await loadUserJson();
    renderClients();
    showScreen("clientsScreen");
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

loginBtn.onclick = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithPopup(provider);
};
logoutBtn.onclick = async () => await auth.signOut();

// ------------------ DATA LOAD/SAVE ------------------
async function loadUserJson() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const docRef = db.collection("clients").doc(uid);
  const docSnap = await docRef.get();
  clientsData = docSnap.exists ? docSnap.data() : {};
  if (!docSnap.exists) await docRef.set(clientsData);
}
async function saveUserJson() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  await db.collection("clients").doc(uid).set(clientsData, { merge: true });
}

// ------------------ CLIENTS ------------------
const clientList = document.getElementById("clientList");
document.getElementById("addClientBtn").onclick = () => {
  const name = prompt("Enter client name:");
  if (!name || clientsData[name]) return;
  clientsData[name] = { client_name: name, sessions: [] };
  saveUserJson();
  renderClients();
};
function renderClients() {
  clientList.innerHTML = "";
  for (const name in clientsData) {
    const li = document.createElement("li");
    li.textContent = name;
    li.onclick = () => selectClient(name);
    clientList.appendChild(li);
  }
}
function selectClient(name) {
  selectedClient = name;
  document.getElementById("selectedClientLabel").textContent = name;
  renderSessions();
  showScreen("sessionsScreen");
}

// ------------------ SESSIONS ------------------
const sessionList = document.getElementById("sessionList");
document.getElementById("addSessionBtn").onclick = () => {
  if (!selectedClient) return alert("Select client first");
  const name = prompt("Enter session name:");
  if (!name) return;
  clientsData[selectedClient].sessions.push({ session_name: name, exercises: [], date: new Date().toISOString() });
  saveUserJson();
  renderSessions();
};
function renderSessions() {
  sessionList.innerHTML = "";
  selectedSession = null;
  document.getElementById("selectedSessionLabel").textContent = "";
  const sessions = clientsData[selectedClient]?.sessions || [];
  sessions.forEach((s, idx) => {
    const li = document.createElement("li");
    li.textContent = s.session_name;
    li.onclick = () => selectSession(idx);
    sessionList.appendChild(li);
  });
}
function selectSession(idx) {
  selectedSession = clientsData[selectedClient].sessions[idx];
  document.getElementById("selectedSessionLabel").textContent = selectedSession.session_name;
  renderExercises();
  showScreen("exercisesScreen");
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

  (selectedSession.exercises || []).forEach((ex, idx) => {
    const li = document.createElement("li");
    li.textContent = ex.exercise;
    li.style.cursor = "pointer";

    // Normal click → select exercise
    li.onclick = () => {
      if (editMode) return;
      selectExercise(idx);
    };

    // Edit click → only in editMode
    li.addEventListener("click", (e) => {
      if (!editMode) return;
      e.stopPropagation();
      const newVal = prompt("Edit Exercise:", li.textContent);
      if (!newVal || newVal === li.textContent) return;
      selectedSession.exercises[idx].exercise = newVal;
      renderExercises();
      saveUserJson();
    });

    exerciseList.appendChild(li);
  });

  // Make list editable if in edit mode
  hookEditables();
}

function selectExercise(idx) {
  selectedExercise = selectedSession.exercises[idx];
  document.getElementById("selectedExerciseLabel").textContent = selectedExercise.exercise;
  renderSets();
  showScreen("setsScreen"); // switch to sets screen for selected exercise
}


// ------------------ SETS ------------------
const setsTable = docum
