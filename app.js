// ---------------- FIREBASE ----------------
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

let clientsData = {}, selectedClient=null, selectedSession=null, selectedExercise=null;

// ---------------- UTILITY ----------------
function showScreen(screenId){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ---------------- LOGIN ----------------
const modalLoginBtn = document.getElementById("modalLoginBtn");
modalLoginBtn.onclick = async ()=>{
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch(err){ alert(err.message); }
}

auth.onAuthStateChanged(async user=>{
  if(user){
    await loadUserJson();
    renderClients();
    showScreen("clientsScreen");
  }else{
    clientsData={}; selectedClient=null;
    showScreen("loginScreen");
  }
});

// ---------------- FIRESTORE ----------------
async function loadUserJson(){
  const uid = auth.currentUser.uid;
  const docRef = db.collection("clients").doc(uid);
  const docSnap = await docRef.get();
  clientsData = docSnap.exists ? docSnap.data() : {};
  if(!docSnap.exists) await docRef.set(clientsData);
}
async function saveUserJson(){
  if(!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  await db.collection("clients").doc(uid).set(clientsData,{merge:true});
}

// ---------------- CLIENTS ----------------
const clientList = document.getElementById("clientList");
document.getElementById("addClientBtn").onclick = ()=>{
  const name = prompt("Enter client name:");
  if(!name) return;
  if(clientsData[name]){ alert("Client exists"); return; }
  clientsData[name]={client_name:name,sessions:[]};
  saveUserJson(); renderClients();
}

function renderClients(){
  clientList.innerHTML="";
  for(const name in clientsData){
    const li=document.createElement("li");
    li.textContent=name;
    li.onclick = ()=>selectClient(name);
    clientList.appendChild(li);
  }
}
function selectClient(name){
  selectedClient=name;
  selectedSession=null;
  selectedExercise=null;
  document.getElementById("selectedClientLabel").textContent=name;
  renderSessions();
  showScreen("sessionsScreen");
}

// ---------------- SESSIONS ----------------
const sessionList = document.getElementById("sessionList");
document.getElementById("addSessionBtn").onclick = ()=>{
  if(!selectedClient){ alert("Select a client"); return; }
  const name = prompt("Enter session name:"); if(!name) return;
  clientsData[selectedClient].sessions.push({session_name:name,exercises:[],date:new Date().toISOString()});
  saveUserJson(); renderSessions();
}

function renderSessions(){
  sessionList.innerHTML="";
  const sessions = clientsData[selectedClient]?.sessions || [];
  sessions.forEach((s,idx)=>{
    const li=document.createElement("li");
    li.textContent=s.session_name;
    li.onclick = ()=>selectSession(idx);
    sessionList.appendChild(li);
  });
}

function selectSession(idx){
  selectedSession = clientsData[selectedClient].sessions[idx];
  selectedExercise=null;
  document.getElementById("selectedSessionLabel").textContent = selectedSession.session_name;
  renderExercises();
  showScreen("exercisesScreen");
}

// ---------------- EXERCISES ----------------
const exerciseList = document.getElementById("exerciseList");
document.getElementById("addExerciseBtn").onclick = ()=>{
  if(!selectedSession){ alert("Select a session"); return; }
  const name = prompt("Enter exercise name:"); if(!name) return;
  selectedSession.exercises.push({exercise:name,sets:[]});
  saveUserJson(); renderExercises();
}

function renderExercises(){
  exerciseList.innerHTML="";
  (selectedSession.exercises||[]).forEach((ex,idx)=>{
    const li=document.createElement("li");
    li.textContent = ex.exercise;
    li.onclick = ()=>selectExercise(idx);
    exerciseList.appendChild(li);
  });
}

function selectExercise(idx){
  selectedExercise = selectedSession.exercises[idx];
  document.getElementById("selectedExerciseLabel").textContent = selectedExercise.exercise;
  renderSets();
  showScreen("setsScreen");
}

// ---------------- SETS ----------------
const setsTable = document.querySelector("#setsTable tbody");
document.getElementById("addSetBtn").onclick = ()=>{
  if(!selectedExercise){ alert("Select exercise"); return; }
  const prevSet = getPreviousSet();
  let reps = parseInt(prompt(`Reps (prev: ${prevSet?.reps||"N/A"}):`)); if(isNaN(reps)) return;
  let weight = parseFloat(prompt(`Weight (prev: ${prevSet?.weight||"N/A"}):`)); if(isNaN(weight)) return;
  let notes = prompt("Notes:")||"";
  const timestamp = new Date().toISOString();
  selectedExercise.sets.push({reps,weight,volume:reps*weight,notes,timestamp});
  saveUserJson(); renderSets();
}

function renderSets(){
  setsTable.innerHTML="";
  (selectedExercise.sets||[]).forEach((s,idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${idx+1}</td>
      <td>${s.reps}</td>
      <td>${s.weight}</td>
      <td>${s.volume}</td>
      <td>${s.notes}</td>
      <td>${s.timestamp}</td>
    `;
    setsTable.appendChild(tr);
  });
}

// ---------------- PREVIOUS SET ----------------
function getPreviousSet(){
  if(!selectedClient || !selectedExercise) return null;
  const sessions = clientsData[selectedClient].sessions || [];
  for(let i=sessions.length-1;i>=0;i--){
    if(sessions[i]===selectedSession) continue;
    for(const ex of sessions[i].exercises||[]){
      if(ex.exercise===selectedExercise.exercise && ex.sets.length) return ex.sets[ex.sets.length-1];
    }
  }
  return null;
}

// ---------------- GRAPH ----------------
document.getElementById("showGraphBtn").onclick = ()=>{
  if(!selectedExercise || !selectedExercise.sets.length){ alert("No sets"); return; }
  const sets = selectedExercise.sets;
  Plotly.newPlot('graphDiv',[
    {x:sets.map(s=>s.timestamp),y:sets.map(s=>s.reps),type:'scatter',mode:'lines+markers',name:'Reps'},
    {x:sets.map(s=>s.timestamp),y:sets.map(s=>s.weight),type:'scatter',mode:'lines+markers',name:'Weight'},
    {x:sets.map(s=>s.timestamp),y:sets.map(s=>s.volume),type:'scatter',mode:'lines+markers',name:'Volume'}
  ]);
}

// ---------------- BACK BUTTONS ----------------
document.getElementById("backToClientsBtn").onclick = ()=>showScreen("clientsScreen");
document.getElementById("backToSessionsBtn").onclick = ()=>showScreen("sessionsScreen");
document.getElementById("backToExercisesBtn").onclick = ()=>showScreen("exercisesScreen");
