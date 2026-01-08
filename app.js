
// =====================================================
// DATA OPTIMIZATION & COMPRESSION HELPERS
// =====================================================

// Minify a single set (Long keys -> Short keys)
function minifySet(s) {
    return {
        r: s.reps,
        w: s.weight,
        v: s.volume,
        n: s.notes || "",
        t: s.timestamp
    };
}

// Expand a single set (Short keys -> Long keys)
function expandSet(s) {
    // Handle both legacy (long) and new (short) formats for robustness
    return {
        reps: s.r ?? s.reps,
        weight: s.w ?? s.weight,
        volume: s.v ?? s.volume,
        notes: s.n ?? s.notes ?? "",
        timestamp: s.t ?? s.timestamp
    };
}

// Prepare a client object for saving (Strip junk, compress sets)
function cleanAndMinifyClient(clientObj) {
    const cleanClient = JSON.parse(JSON.stringify(clientObj)); // Deep copy
    
    if (cleanClient.sessions) {
        cleanClient.sessions.forEach(session => {
            if (session.exercises) {
                session.exercises.forEach(ex => {
                    // 1. Remove calculated colorData (save space)
                    delete ex.colorData; 
                    // 2. Minify sets
                    if (ex.sets) {
                        ex.sets = ex.sets.map(minifySet);
                    }
                });
            }
        });
    }
    return cleanClient;
}

// Hydrate a client object on load (Expand sets)
function expandClientData(clientObj) {
    if (clientObj.sessions) {
        clientObj.sessions.forEach(session => {
            if (session.exercises) {
                session.exercises.forEach(ex => {
                    if (ex.sets) {
                        ex.sets = ex.sets.map(expandSet);
                    }
                });
            }
        });
    }
    return clientObj;
}

// Helper to delete a specific client doc (used during rename/delete)
async function deleteClientFromFirestore(clientName) {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    try {
        await db.collection("users").doc(uid).collection("clients").doc(clientName).delete();
    } catch (err) {
        console.error("Error deleting client doc:", err);
    }
}

// =====================================================
// TUTORIAL ENGINE
// =====================================================
let isTutorialMode = false;
// === NEW SETTINGS STATE ===
let userSettings = {
    units: 'lbs',
    enableColors: true,
    enableAnimations: true
};

function getUnitLabel() { return userSettings.units === 'lbs' ? 'lbs' : 'kg'; }
function getUnitRatioLabel() { return userSettings.units === 'lbs' ? 'lb/r' : 'kg/r'; }
let tutorialTimer = null; // <--- NEW: Tracks pending bubbles
let tutorialStep = 0;
let restTimerInterval = null; // Tracks the background interval

// 1. FAKE DATA GENERATOR (8 Weeks of History)
function generateTutorialData() {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const sets = [];
  
  // Create 8 weeks of Bench Press data, 1 session per week
  for (let i = 0; i < 8; i++) {
    const weeksAgo = 7 - i; // 7, 6, 5... 0
    const date = new Date(now.getTime() - (weeksAgo * 7 * oneDay));
    
    // Progressive Overload Logic (Start at 135, end at 165)
    const weight = 135 + (i * 5); 
    const reps = 8 + (i % 2); // Toggle between 8 and 9 reps
    
    // Add 3 sets per workout
    for (let s = 0; s < 3; s++) {
      sets.push({
        reps: reps,
        weight: weight,
        volume: reps * weight,
        notes: i === 7 ? "New PR!" : "Felt good",
        timestamp: new Date(date.getTime() + (s * 5 * 60000)).toISOString() // 5 mins apart
      });
    }
  }

  return {
    "Mike": {
      client_name: "Mike",
      order: 0,
      sessions: [
        {
          session_name: "Chest Day",
          date: new Date().toISOString(),
          exercises: [
            {
              exercise: "Bench Press",
              sets: sets
            },
            {
              exercise: "Incline Dumbbell",
              sets: [] // Empty to show contrast
            }
          ]
        }
      ]
    }
  };
}

// 2. TUTORIAL CONTROLS
const startTutorialBtn = document.getElementById('startTutorialBtn');
const endTutorialBtn = document.getElementById('endTutorialBtn');

startTutorialBtn.onclick = () => {
  isTutorialMode = true;
  
  document.getElementById('loginModal').classList.add('hidden');
  document.getElementById('loginBtn').classList.add('hidden');
  document.getElementById('logoutBtn').classList.add('hidden');
  document.getElementById('editToggleBtn').classList.add('hidden');
  endTutorialBtn.classList.remove('hidden');
  
  clientsData = generateTutorialData();
  renderClients();
  
  // OFFSET CHANGED: 40 (Points down at the list item "Mike")
  showTutorialTip('clientList', 'Tap the profile to see sessions.', 40);
};

endTutorialBtn.onclick = () => {
  isTutorialMode = false;
  
  // 1. STRICT CLEANUP: Kill timer and remove bubble immediately
  if (tutorialTimer) clearTimeout(tutorialTimer);
  tutorialTimer = null;
  clearTutorialTips(); 
  
  // 2. Reset UI
  endTutorialBtn.classList.remove('flash-active');
  document.body.removeAttribute('data-tutorial-graph-ready'); 
  
  document.getElementById('loginModal').classList.remove('hidden');
  document.getElementById('loginBtn').classList.remove('hidden');
  document.getElementById('editToggleBtn').classList.remove('hidden');
  endTutorialBtn.classList.add('hidden');
  
  clientsData = {};
  hideAllDetails();
};

// 3. TOOLTIP SYSTEM
// Updated helper with CSS class logic
function showTutorialTip(targetId, text, offsetY = -60, align = 'center', enableScroll = true) {
  clearTutorialTips();
  
  const target = document.getElementById(targetId);
  if (!target) return;
  
  if (enableScroll) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const tip = document.createElement('div');
  tip.className = 'tutorial-tooltip';
  
  // FIX 1: Add specific class if aligned right
  if (align === 'right') {
      tip.classList.add('right-aligned');
  }

  tip.textContent = text;
  document.body.appendChild(tip);
  
  const rect = target.getBoundingClientRect();
  const top = rect.top + window.scrollY + offsetY;
  
  let left;
  if (align === 'right') {
      // FIX 2: Point to the ball (right edge - 30px buffer)
      left = rect.right - 30; 
  } else if (align === 'left') {
      left = rect.left + 40;
  } else {
      left = rect.left + (rect.width / 2);
  }
  
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}

function clearTutorialTips() {
  document.querySelectorAll('.tutorial-tooltip').forEach(el => el.remove());
}


// ------------------ Firebase Config ------------------
const firebaseConfig = {
  apiKey: "AIzaSyAywTTfFa6K7heVmkOUQDKpGJbeAbJ_8a8",
  authDomain: "trunk-tracker.web.app", // <--- Updated to your custom domain
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
let lastPlateAdded = null; // Tracks the weight of the last plate clicked

// =====================================================
// ANIMATION CONFIGURATION
// =====================================================

const ANIMATION_CLASSES = {
  happy: ['happy-1', 'happy-2', 'happy-3'],
  sad: ['sad-1', 'sad-2', 'sad-3'],
  calm: ['calm-1', 'calm-2', 'calm-3'],
};
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
    // --- NEW: Stop Timer UI when leaving Sets screen ---
  if (currentScreen === SCREENS.SETS && targetScreenId !== SCREENS.SETS) {
      stopRestTimerUI();
  }
  // ---------------------------------------------------

  // --- NEW STEP: PRE-CALCULATE SIZE BEFORE SHOWING ---
  // This runs while the element is still technically 'hidden' to the user
  forceTitleResize(targetScreenId); 
  // ---------------------------------------------------

  switch (targetScreenId) {
    case SCREENS.CLIENTS: renderClients(); break;
    case SCREENS.SESSIONS: renderSessions(); break;
    case SCREENS.EXERCISES: renderExercises(); break;
    case SCREENS.SETS: renderSets(); break;
  }

  const enterClass = (direction === 'forward') ? 'slide-in-right' : 'slide-in-left';
  const exitClass = (direction === 'forward') ? 'slide-out-left' : 'slide-out-right';

  targetScreen.classList.remove('hidden', 'slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  
  // Note: We don't need autoShrinkTitle here anymore because we did it above!

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
  selectedClient = null; selectedSession = null;
  selectedExercise = null;
  renderClients(); navigateTo(SCREENS.CLIENTS, 'back');
};
document.getElementById('backToSessionsBtn').onclick = () => {
  selectedSession = null; selectedExercise = null;
  renderSessions();
  navigateTo(SCREENS.SESSIONS, 'back');
};
document.getElementById('backToExercisesBtn').onclick = () => {
  selectedExercise = null;
  renderExercises(); navigateTo(SCREENS.EXERCISES, 'back');
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
    // Force account selection even if logged in previously
    provider.setCustomParameters({ prompt: 'select_account' });
    
    await auth.signInWithPopup(provider);
  } catch (err) {
    alert("Login failed: " + err.message);
  }
};
logoutBtn.onclick = async () => { await auth.signOut(); };

function showDeleteConfirm(message, onConfirm) {
  deleteModalMessage.textContent = message;
  deleteModal.classList.remove('hidden');
  deleteConfirmBtn.addEventListener('click', () => { onConfirm(); hideDeleteConfirm(); }, { once: true });
  deleteCancelBtn.addEventListener('click', () => { hideDeleteConfirm(); }, { once: true });
}
function hideDeleteConfirm() { deleteModal.classList.add('hidden'); }
deleteCancelBtn.onclick = hideDeleteConfirm;
// ------------------ FIRESTORE DATA ------------------
async function loadUserJson() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  clientsData = {};

  try {
      // 1. LOAD SETTINGS
      const settingsDoc = await db.collection("users").doc(uid).get();
      if (settingsDoc.exists && settingsDoc.data().settings) {
          userSettings = { ...userSettings, ...settingsDoc.data().settings };
      }
      if(typeof updateSettingsUI === 'function') updateSettingsUI();

      // 2. CHECK FOR MODERN DATA
      const newCollectionRef = db.collection("users").doc(uid).collection("clients");
      const newSnap = await newCollectionRef.get();

      if (!newSnap.empty) {
          console.log("Loaded data from optimized system.");
          newSnap.forEach(doc => {
              let clientObj = doc.data();
              if (typeof expandClientData === "function") clientObj = expandClientData(clientObj);
              if (clientObj.order === undefined) clientObj.order = 999;
              clientsData[clientObj.client_name] = clientObj;
          });
      } else {
          // Legacy Fallback
          console.log("New system empty. Checking legacy...");
          const oldDocRef = db.collection("clients").doc(uid);
          const oldDocSnap = await oldDocRef.get();
          if (oldDocSnap.exists) {
               clientsData = oldDocSnap.data();
               // Legacy migration fix...
               Object.values(clientsData).forEach(c => {
                   if (!c.sessions) c.sessions = [];
               });
          } else {
              const fullName = auth.currentUser.displayName || "User";
              const firstName = fullName.split(' ')[0];
              clientsData = { [firstName]: { client_name: firstName, sessions: [], order: 0 } };
              await saveUserJson();
          }
      }
      renderClients();
  } catch (err) {
      console.error("Error loading user data:", err);
  }
}

async function saveUserJson() {
  if (isTutorialMode) return;
  if (!auth.currentUser) return;
  
  const uid = auth.currentUser.uid;
  const batch = db.batch();

  // 1. Save Settings
  const userDocRef = db.collection("users").doc(uid);
  batch.set(userDocRef, { settings: userSettings }, { merge: true });

  // 2. Save Clients
  const profilesRef = db.collection("users").doc(uid).collection("clients");
  Object.values(clientsData).forEach(clientObj => {
      const optimizedData = cleanAndMinifyClient(clientObj);
      const docRef = profilesRef.doc(clientObj.client_name);
      batch.set(docRef, optimizedData);
  });

  try {
      await batch.commit();
  } catch (err) {
      console.error("Save failed:", err);
  }
}

// === NEW WIPE FUNCTION FOR UNIT SWITCHING ===
async function wipeAllUserData() {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const batch = db.batch();

    // 1. Delete all Firestore profiles
    const profilesRef = db.collection("users").doc(uid).collection("clients");
    const snapshot = await profilesRef.get();
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    // 2. Clear Local Memory
    clientsData = {};
    selectedClient = null;
    selectedSession = null;
    selectedExercise = null;

    // 3. Save Settings (Persist the unit change)
    const userDocRef = db.collection("users").doc(uid);
    batch.set(userDocRef, { settings: userSettings }, { merge: true });

    await batch.commit();
    renderClients(); 
}

// ------------------ ANIMATED TITLE HELPERS ------------------
// 
function setTextAsChars(element, text) {
  element.innerHTML = '';
  if (!text || text.trim() === '') {
      const span = document.createElement('span');
      span.className = 'char';
      span.innerHTML = '&nbsp;';
      element.appendChild(span);
      return;
  }
  
  // UPDATED: Use forEach with index (i) to handle infinite length
  text.split('').forEach((char, i) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = char;
    if (char === ' ') span.innerHTML = '&nbsp;';
    
    // --- THE FIX: Inject the index variable directly ---
    span.style.setProperty('--char-index', i + 1);
    // --------------------------------------------------
    
    element.appendChild(span);
  });
}

// --- ROBUST FONT SIZING ENGINE (FIXED V2) ---
function forceTitleResize(targetScreenId = currentScreen) {
  const screenEl = document.getElementById(targetScreenId);
  if (!screenEl) return;
  const title = screenEl.querySelector('.animated-title');
  if (!title) return;

  // 1. SAVE ORIGINAL STATE
  const wasHidden = screenEl.classList.contains('hidden');
  const originalPosition = screenEl.style.position;
  const originalVisibility = screenEl.style.visibility;
  const originalDisplay = screenEl.style.display;

  // 2. THE "PEEK" TRICK
  if (wasHidden) {
    screenEl.classList.remove('hidden');
    screenEl.style.visibility = 'hidden';
    screenEl.style.display = 'block';
  }

  // 3. PREPARE FOR MEASUREMENT
  // We MUST use 'hidden' here so offsetWidth represents the CONTAINER limit,
  // not the content width.
  title.style.whiteSpace = 'nowrap';
  title.style.overflow = 'hidden'; 
  title.style.textOverflow = 'clip'; // Kills the "..." permanently
  
  // Reset to max size
  title.style.fontSize = '1.75rem';

  // 4. THE CALCULATION LOOP
  let currentSize = 1.75;
  const minSize = 0.85;

  // Force reflow
  void title.offsetWidth;

  // Logic: If content (scrollWidth) is wider than container (offsetWidth), shrink.
  // We allow a 1px buffer to prevent aggressive shrinking on perfect fits.
  while ((title.scrollWidth > title.offsetWidth + 1) && currentSize > minSize) {
    currentSize -= 0.1;
    title.style.fontSize = `${currentSize}rem`;
  }

  // 5. RESTORE
  // Ensure styles remain locked to prevent dots from returning
  title.style.whiteSpace = 'nowrap';
  title.style.overflow = 'hidden';
  title.style.textOverflow = 'clip';

  if (wasHidden) {
    screenEl.classList.add('hidden');
    screenEl.style.visibility = originalVisibility;
    screenEl.style.display = originalDisplay;
    screenEl.style.position = originalPosition;
  }
}

function applyTitleStyling(element, text, colorData) {
  if (!element) return;
  setTextAsChars(element, text);
        // CHECK SETTINGS
    if (!userSettings.enableColors) {
         element.querySelectorAll('.char').forEach(char => char.style.color = 'var(--color-text)');
         if (!userSettings.enableAnimations) return; // Exit if both off
    }

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
  if (userSettings.enableAnimations) {
    targetElement.classList.add(mood);
}
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

  // If this title belongs to a screen, resize it now.
  const parentScreen = element.closest('.screen');
  if (parentScreen) {
      forceTitleResize(parentScreen.id);
  }
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
  if (!exercise.sets || exercise.sets.length < 2) return { red: 0, green: 0, yellow: 0, total: 0 };
  const allSets = exercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const mostRecentDate = new Date(allSets[0].timestamp);
  const currentDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), mostRecentDate));
  const previousWorkoutSet = allSets.find(set => !isSameDay(new Date(set.timestamp), mostRecentDate));
  if (!previousWorkoutSet) return { red: 0, green: 0, yellow: 0, total: 0 };

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

// ------------------ NEW: DYNAMIC ARROW HELPER (TEXT VERSION) ------------------
function createDynamicArrow(colorData) {
    // Create a text span instead of SVG
    const span = document.createElement("span");
    span.className = "arrow-icon";
    span.textContent = "→"; // The stylized arrow character matching your ↓

    if (!colorData || colorData.total === 0) {
         return span; // Default grey
    }

    const { red, green, yellow } = colorData;
    
    // Logic matching the app's dominance logic:
    if (green > red && green >= yellow) {
        span.classList.add("arrow-green");
    } else if (red > green && red >= yellow) {
        span.classList.add("arrow-red");
    } else if (yellow > green && yellow > red) {
        span.classList.add("arrow-yellow");
    } else {
        // Tie-breaking defaults
        if (green > 0) span.classList.add("arrow-green");
        else if (red > 0) span.classList.add("arrow-red");
        else if (yellow > 0) span.classList.add("arrow-yellow");
    }
    
    return span;
}

// --- REORDER HELPER ---
function moveItem(type, index, direction) {
    // direction: -1 (up), 1 (down)
    if (type === 'client') {
        const sortedClients = Object.values(clientsData).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= sortedClients.length) return;
        // Swap order values
        const itemA = sortedClients[index];
        const itemB = sortedClients[targetIndex];
        const tempOrder = itemA.order ?? 0;
        itemA.order = itemB.order ?? 0;
        itemB.order = tempOrder;

        saveUserJson();
        renderClients();
    } else if (type === 'session') {
        const list = clientsData[selectedClient].sessions;
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.length) return;
        
        [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
        saveUserJson();
        renderSessions();
    } else if (type === 'exercise') {
        const list = selectedSession.exercises;
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.length) return;

        [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
        saveUserJson();
        renderExercises();
    }
}

function renderClients() {
  clientList.innerHTML = "";
  
  const sortedClients = Object.values(clientsData).sort((a, b) => a.order - b.order);
  
  // 1. LOOP STARTS HERE
  sortedClients.forEach(client => {
      const li = document.createElement("li");
      
      const colorData = getExerciseColorData(client); 
      let arrowHtml = createDynamicArrow(colorData);

      li.innerHTML = `
        <span class="client-name">${client.client_name}</span>
        ${arrowHtml}
        <div class="edit-actions">
           <button class="btn-icon btn-move">☰</button>
           <button class="btn-icon btn-delete"><span class="delete-icon"></span></button>
        </div>
      `;
      
      li.onclick = (e) => {
        if (body.classList.contains('edit-mode-active')) return;
        selectClient(client.client_name);
      };

      const deleteBtn = li.querySelector('.btn-delete');
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        openDeleteModal(client.client_name, 'client');
      };

      hookEditables(li, client, 'client');

      clientList.appendChild(li);

      setupListTextAnimation(li.querySelector('.client-name'), client.client_name, colorData);
  }); 
  // 2. LOOP ENDS HERE (Critical Fix)

  // 3. SETTINGS BUTTON (Now Outside the Loop)
  const settingsLi = document.createElement("li");
  settingsLi.className = "settings-row"; 
  settingsLi.style.cursor = "pointer";
  
  const iconDiv = document.createElement("div");
  iconDiv.className = "settings-icon";
  iconDiv.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
  
  const textDiv = document.createElement("div");
  textDiv.className = "settings-text";
  textDiv.textContent = "Settings";

  settingsLi.appendChild(iconDiv);
  settingsLi.appendChild(textDiv);

  settingsLi.onclick = (e) => {
      e.stopPropagation();
      openSettingsModal();
  };

  clientList.appendChild(settingsLi);
}

document.getElementById("addClientBtn").onclick = () => {
  const name = prompt("Enter name:");
  if (!name) return;
  if (clientsData[name]) { alert("Client already exists."); return; }
  // NEW: Add default order index
  const newOrder = Object.keys(clientsData).length;
  clientsData[name] = { client_name: name, sessions: [], order: newOrder };
  saveUserJson(); renderClients();
};
function selectClient(name) {
  selectedClient = name;
  selectedSession = null; selectedExercise = null;
  renderSessions(); navigateTo(SCREENS.SESSIONS, 'forward');
  
  // --- ADD THIS ---
  if (isTutorialMode) {
    setTimeout(() => showTutorialTip('sessionList', 'Tap "Chest Day" to see exercises.', 40), 400);
  }
}

const sessionList = document.getElementById("sessionList");
function getSortedSessions(sessionsArray) {
  // REMOVED FORCED DATE SORTING TO ALLOW MANUAL ORDERING
  return sessionsArray || [];
}

document.getElementById("addSessionBtn").onclick = () => {
  if (!selectedClient) { alert("Select a client first"); return;
  }
  const name = prompt("Enter session name:");
  if (!name) return;
  const session = { session_name: name, exercises: [], date: new Date().toISOString() };
  clientsData[selectedClient].sessions.push(session);
  saveUserJson(); renderSessions();
};
function renderSessions() {
  sessionList.innerHTML = "";
  if (!selectedClient) return;
  selectedSession = null;
  let clientTotalColorData = { red: 0, green: 0, yellow: 0, total: 0 };
  const sessions = clientsData[selectedClient]?.sessions || [];
  sessions.forEach((sess, idx) => {
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

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'edit-actions';

    const upBtn = document.createElement('button');
    upBtn.className = 'btn-icon btn-move';
    upBtn.innerHTML = '↑';
    upBtn.onclick = (e) => { e.stopPropagation();
    moveItem('session', idx, -1); };

    const downBtn = document.createElement('button');
    downBtn.className = 'btn-icon btn-move';
    downBtn.innerHTML = '↓';
    downBtn.onclick = (e) => { e.stopPropagation(); moveItem('session', idx, 1); };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete session "${sess.session_name}"?`, () => {
        const sessionIndex = clientsData[selectedClient].sessions.findIndex(s => s === sess);
        if (sessionIndex > -1) { clientsData[selectedClient].sessions.splice(sessionIndex, 1); saveUserJson(); renderSessions(); }
        if (selectedSession === sess) navigateTo(SCREENS.SESSIONS, 'back');
      });
    };

    actionsDiv.appendChild(upBtn);
    actionsDiv.appendChild(downBtn);
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(nameSpan); 
    li.appendChild(actionsDiv);
    // APPEND DYNAMIC ARROW
    li.appendChild(createDynamicArrow(sessionColorData));
    
    sessionList.appendChild(li);
  });
  const sessionsTitle = document.getElementById('sessionsScreenTitle');
  applyTitleStyling(sessionsTitle, 'Sessions', clientTotalColorData);
  hookEditables();
}

function selectSession(sessionObject) {
  selectedSession = sessionObject;
  selectedExercise = null;
  renderExercises(); navigateTo(SCREENS.EXERCISES, 'forward');
  
  // --- ADD THIS ---
  if (isTutorialMode) {
    setTimeout(() => showTutorialTip('exerciseList', 'Tap "Bench Press" to see the data.', 40), 400);
  }
}

const exerciseList = document.getElementById("exerciseList");
document.getElementById("addExerciseBtn").onclick = () => {
  if (!selectedSession) { alert("Select a session first"); return; }
  
  const name = prompt("Enter exercise name:");
  if (!name) return;

  // NEW: Character Limit Check
  if (name.length > 41) {
    alert(`Exercise name is too long (${name.length} chars).\nPlease limit to 41 characters.`);
    return;
  }

  const ex = { exercise: name, sets: [] };
  selectedSession.exercises.push(ex);
  saveUserJson(); renderExercises();
};

function renderExercises() {
  exerciseList.innerHTML = "";
  const sessionTitleElement = document.getElementById('sessionExercisesTitle');
  if (!selectedSession) { applyTitleStyling(sessionTitleElement, 'Exercises', null); return; }
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
    li.onclick = (e) => { if (editMode) { e.stopPropagation(); return; } 
    selectExercise(idx); };

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'edit-actions';

    const upBtn = document.createElement('button');
    upBtn.className = 'btn-icon btn-move';
    upBtn.innerHTML = '↑';
    upBtn.onclick = (e) => { e.stopPropagation(); moveItem('exercise', idx, -1); };

    const downBtn = document.createElement('button');
    downBtn.className = 'btn-icon btn-move';
    downBtn.innerHTML = '↓';
    downBtn.onclick = (e) => { e.stopPropagation(); moveItem('exercise', idx, 1); };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete exercise "${ex.exercise}"?`, () => {
        selectedSession.exercises.splice(idx, 1); saveUserJson(); renderExercises();
        if (selectedExercise === ex) navigateTo(SCREENS.EXERCISES, 'back');
      });
    };
    
    actionsDiv.appendChild(upBtn);
    actionsDiv.appendChild(downBtn);
    actionsDiv.appendChild(deleteBtn);

    setupListTextAnimation(nameSpan, ex.exercise, colorData);
    li.appendChild(nameSpan); 
    li.appendChild(actionsDiv);
    // APPEND DYNAMIC ARROW
    li.appendChild(createDynamicArrow(colorData));
    
    exerciseList.appendChild(li);
  });
  applyTitleStyling(sessionTitleElement, 'Exercises', sessionColorData);
  hookEditables();
}

// Inside selectExercise(idx)
function selectExercise(idx) {
  selectedExercise = selectedSession.exercises[idx];
  renderSets(); navigateTo(SCREENS.SETS, 'forward');
  document.getElementById("graphContainer").classList.add("hidden");
  
  // --- UPDATED TUTORIAL LOGIC ---
  if (isTutorialMode) {
    if (selectedExercise.exercise === 'Bench Press') {
       // Clear any existing timers
       if (tutorialTimer) clearTimeout(tutorialTimer);

       tutorialTimer = setTimeout(() => {
         // Step 1: Show Comparison
         showTutorialTip('comparisonBanner', 'This window shows your most current session stats vs your previous session.', 10);
         
         // Step 2: WAIT 5 SECONDS before pointing to Add Set
         tutorialTimer = setTimeout(() => {
            showTutorialTip('addSetBtn', 'Now, tap here to log a new set.', -10);
         }, 5000); // Increased from 3500 to 5000
       }, 400);
    }
  }
}
// ------------------ SPIRAL WIDGET LOGIC ------------------
const spiralState = {
    svg: null, hitPath: null, segmentsGroup: null, markersGroup: null, timeBall: null, dateDisplay: null,
    fullHistory: [], visibleHistory: [], hitPathLookup: [], workoutVisualPoints: [],
    totalLen: 0, isDragging: false, currentRange: '8w',
    CX: 250, CY: 250, START_RADIUS: 30, OFFSETS: { sets: -21, reps: -7, vol: 7, wpr: 21 },
    RADIAL_PITCH: 45, TURNS: 3.8,
    slider: null
};
function initSpiralElements() {
    if (spiralState.svg) return;
    spiralState.svg = document.getElementById('spiralCanvas');
    spiralState.hitPath = document.getElementById('hitPath');
    spiralState.segmentsGroup = document.getElementById('spiralSegments');
    spiralState.markersGroup = document.getElementById('markersGroup');
    spiralState.timeBall = document.getElementById('timeBall');
    spiralState.dateDisplay = document.getElementById('spiralDateDisplay');
    
    // RESTORED SLIDER HOOK
    spiralState.slider = document.getElementById('spiralSlider');
    if(spiralState.slider) {
        spiralState.slider.addEventListener('input', handleSliderMove);
    }

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
            currentSession = { dayStr: dayStr, timestamp: d.getTime(), sets: 0, reps: 0, volume: 0, rawSets: [] };
        }
        currentSession.sets++;
    
        currentSession.reps += (parseInt(set.reps) || 0);
        currentSession.volume += (parseFloat(set.volume) || 0);
        currentSession.rawSets.push(set);
    });
    if (currentSession) sessions.push(currentSession);
    sessions.forEach(s => { s.wpr = s.reps > 0 ? (s.volume / s.reps) : 0; });
    return sessions;
}

function getSpiralPoint(t, offset) {
    const totalAngle = Math.PI * 2 * spiralState.TURNS;
    const angle = t * totalAngle;
    const baseR = spiralState.START_RADIUS + (spiralState.RADIAL_PITCH * (angle / (Math.PI * 2)));
    const r = baseR + offset;
    return { x: spiralState.CX + r * Math.cos(angle), y: spiralState.CY + r * Math.sin(angle) };
}

function getSegmentD(tStart, tEnd, offset) {
    let d = "";
    const steps = 150;
    for(let i=0; i<=steps; i++) {
        const t = tStart + (i/steps) * (tEnd - tStart);
        const p = getSpiralPoint(t, offset);
        d += (i===0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
    }
    return d;
}

function getFullSpiralD(offset) {
    let d = "";
    const points = 1000;
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
    if (range === 'all') { spiralState.RADIAL_PITCH = 52; spiralState.TURNS = 3.1;
    } 
    else {
        spiralState.RADIAL_PITCH = 90;
        if (range === '4w') spiralState.TURNS = 1.3;
        else if (range === '8w') spiralState.TURNS = 1.8;
        else if (range === '12w') spiralState.TURNS = 2.0;
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
    
    spiralState.hitPathLookup = [];
    const res = 1000;
    for(let i=0; i<=res; i++) {
        const l = (i/res) * spiralState.totalLen;
        const pt = spiralState.hitPath.getPointAtLength(l);
        spiralState.hitPathLookup.push({ len: l, x: pt.x, y: pt.y });
    }

    if (!spiralState.visibleHistory || spiralState.visibleHistory.length === 0) { updateBallToLen(0); return;
    }

    const oldestTime = spiralState.visibleHistory[0].timestamp;
    const newestTime = spiralState.visibleHistory[spiralState.visibleHistory.length-1].timestamp;
    const timeSpan = newestTime - oldestTime || 1;
    spiralState.workoutVisualPoints = [];
    const totalSegments = spiralState.visibleHistory.length;
    const baseUnit = 3.5 / (totalSegments || 1);
    const tracks = { sets: [], reps: [], vol: [], wpr: [] };
    spiralState.visibleHistory.forEach((curr, i) => {
        const t = (curr.timestamp - oldestTime) / timeSpan;
        const p = getSpiralPoint(t, 0);
        let bestWpLen = 0, minWpDist = Infinity;
        for(let lp of spiralState.hitPathLookup) {
            const d = (lp.x - p.x)**2 + (lp.y - p.y)**2;
            if(d < minWpDist) { minWpDist = d; bestWpLen = lp.len; }
 
        }
        spiralState.workoutVisualPoints.push({ x: p.x, y: p.y, len: bestWpLen, index: i, data: curr });
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", p.x); circle.setAttribute("cy", p.y); circle.setAttribute("class", "workout-marker");
        spiralState.markersGroup.appendChild(circle);

        if(i === spiralState.visibleHistory.length - 1) return;
        const next = spiralState.visibleHistory[i+1];
        const tEnd = (next.timestamp - oldestTime) / timeSpan;
  
        tracks.sets.push(createSeg(curr.sets, next.sets, t, tEnd, spiralState.OFFSETS.sets, baseUnit));
        tracks.reps.push(createSeg(curr.reps, next.reps, t, tEnd, spiralState.OFFSETS.reps, baseUnit));
        tracks.vol.push(createSeg(curr.volume, next.volume, t, tEnd, spiralState.OFFSETS.vol, baseUnit));
        tracks.wpr.push(createSeg(curr.wpr, next.wpr, t, tEnd, spiralState.OFFSETS.wpr, baseUnit));
    });
    updateBallToLen(spiralState.totalLen);
    runTrack(tracks.sets); runTrack(tracks.reps); runTrack(tracks.vol); runTrack(tracks.wpr);
}

function createSeg(v1, v2, t1, t2, offset, baseUnit) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute('d', getSegmentD(t1, t2, offset));
    path.setAttribute('class', 'spiral-segment');
    const epsilon = 0.01; let speedFactor = 1.0;
    if (v2 > v1 + epsilon) { path.classList.add('seg-increase');
    speedFactor = 0.4;
    }
    else if (v2 < v1 - epsilon) { path.classList.add('seg-decrease'); speedFactor = 2.5;
    }
    else { path.classList.add('seg-neutral'); speedFactor = 1.0; }
    path.style.opacity = '0';
    spiralState.segmentsGroup.appendChild(path);
    return { el: path, duration: baseUnit * speedFactor };
}

function runTrack(segments, index = 0) {
    if (index >= segments.length) return;
    const segment = segments[index];
    const path = segment.el;
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    path.style.opacity = '0.9'; 
    const animation = path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: segment.duration * 1000, fill: 'forwards', easing: 'linear' });
    animation.onfinish = () => { runTrack(segments, index + 1); };
}

function updateSpiralData(sets) {
    initSpiralElements();
    spiralState.fullHistory = processSetsForSpiral(sets);

    // --- NEW: Check for empty history and reset UI to zeros ---
    if (spiralState.fullHistory.length === 0) {
        // 1. Reset Text Stats (Banner)
        const stats = ['sets', 'reps', 'volume', 'wpr'];
        stats.forEach(stat => {
            const arrowEl = document.getElementById(stat + 'Arrow');
            const spiralEl = document.getElementById(stat + 'Spiral');
            const dataEl = document.getElementById(stat + 'Data');

            if (arrowEl) { 
                arrowEl.innerHTML = '—'; 
                arrowEl.className = 'stat-arrow neutral'; 
            }
            if (spiralEl) { 
                spiralEl.setAttribute('class', 'comparison-spiral neutral'); 
            }
            if (dataEl) { 
                // Display zeros as requested
                dataEl.textContent = '0 (0 / 0%)'; 
                dataEl.className = 'stat-data neutral'; 
            }
        });

        // 2. Clear Spiral Graphics
        if (spiralState.segmentsGroup) spiralState.segmentsGroup.innerHTML = '';
        if (spiralState.markersGroup) spiralState.markersGroup.innerHTML = '';
        if (spiralState.timeBall) spiralState.timeBall.style.display = 'none';
        if (spiralState.dateDisplay) spiralState.dateDisplay.textContent = 'No Data';
        
        // 3. Ensure banner is visible but neutral
        document.getElementById('comparisonBanner').classList.remove('hidden');
        return;
    }
    // ----------------------------------------------------------

    setSpiralRange(spiralState.currentRange);
    document.getElementById('comparisonBanner').classList.remove('hidden');
}

function getSVGC(evt) {
    const pt = spiralState.svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
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
function getClosestDataIdx(currentLen) {
    let bestIdx = -1; let minDist = Infinity;
    spiralState.workoutVisualPoints.forEach((wp) => {
        const dist = Math.abs(currentLen - wp.len); 
        if(dist < minDist) { minDist = dist; bestIdx = wp.index; }
    });
    return bestIdx;
}
function updateBallToLen(len) {
    const pt = spiralState.hitPath.getPointAtLength(len);
    spiralState.timeBall.style.display = 'block'; 
    spiralState.timeBall.setAttribute('cx', pt.x); spiralState.timeBall.setAttribute('cy', pt.y);
    // SYNC SLIDER
    if(spiralState.slider && spiralState.totalLen > 0) {
        // Map length 0..totalLen -> 0..100
        const val = (len / spiralState.totalLen) * 100;
        spiralState.slider.value = val;
    }

    if (spiralState.workoutVisualPoints.length > 0) {
        const idx = getClosestDataIdx(len);
        updateDataByIndex(idx);
    }
}
function updateDataByIndex(idx) {
    // 1. Safety Check
    if (idx === -1 || !spiralState.visibleHistory[idx]) return;
    const curr = spiralState.visibleHistory[idx];
    const prev = idx > 0 ? spiralState.visibleHistory[idx-1] : { sets:0, reps:0, volume:0, wpr:0 };
    // 2. Highlight Spiral Marker
    document.querySelectorAll('.workout-marker').forEach(m => m.classList.remove('active'));
    if (spiralState.markersGroup.children[idx]) {
        spiralState.markersGroup.children[idx].classList.add('active');
    }

    // 3. Update Date Text
    const d = new Date(curr.timestamp);
    const dateStr = d.toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric'});
    spiralState.dateDisplay.textContent = dateStr;
    // 4. Update Stats & Collect Statuses
    const stats = [];
    stats.push(updateStatUI('sets', curr.sets, prev.sets));
    stats.push(updateStatUI('reps', curr.reps, prev.reps));
    stats.push(updateStatUI('volume', curr.volume, prev.volume));
    stats.push(updateStatUI('wpr', curr.wpr, prev.wpr));

    // 5. CALCULATE MOOD COLOR
    let green = 0, red = 0, yellow = 0;
    stats.forEach(s => {
        if (s === 'increase') green++;
        else if (s === 'decrease') red++;
        else yellow++;
    });
    let finalColor = 'var(--color-primary)'; // Default Blue
    if (green > red && green >= yellow) {
        finalColor = 'var(--color-green)';
    } else if (red > green && red >= yellow) {
        finalColor = 'var(--color-red)';
    } else if (yellow > green && yellow > red) {
        finalColor = 'var(--color-yellow)';
    } else {
        if (green > 0 && green >= red) finalColor = 'var(--color-green)';
        else if (red > 0) finalColor = 'var(--color-red)';
    }

    // 6. APPLY COLOR TO SLIDER (Corrected)
    if (spiralState.slider) {
        spiralState.slider.style.setProperty('--thumb-color', finalColor);
    }
    
    // 7. ENSURE TIME BALL IS WHITE (Reset)
    spiralState.timeBall.style.fill = '#ffffff';
    spiralState.timeBall.style.filter = 'none';
}
const handleSpiralStart = (e) => { spiralState.isDragging = true; spiralState.hitPath.setPointerCapture(e.pointerId); const c = getSVGC(e); updateBallToLen(getClosestLen(c.x, c.y));
}
const handleSpiralMove = (e) => { if(!spiralState.isDragging) return; e.preventDefault(); const c = getSVGC(e); updateBallToLen(getClosestLen(c.x, c.y));
}
const handleSpiralEnd = (e) => { if (!spiralState.isDragging) return; spiralState.isDragging = false; spiralState.hitPath.releasePointerCapture(e.pointerId);
}

// NEW SLIDER HANDLER

const handleSliderMove = (e) => {
    const val = parseFloat(e.target.value);
    const len = (val / 100) * spiralState.totalLen;
    updateBallToLen(len);

    // --- TUTORIAL INTERACTION LOGIC ---
    if (isTutorialMode && document.body.dataset.tutorialStep === "waiting-for-slider") {
        
        // 1. Debounce: Only trigger if they actually moved it somewhat
        if (val < 98) {
            // 2. Clear flag so this doesn't fire continuously while dragging
            document.body.dataset.tutorialStep = "slider-done";
            clearTutorialTips();

            // 3. Wait 2 seconds
            setTimeout(() => {
                // 4. Scroll to top
                document.querySelector('.app-container').scrollTo({ top: 0, behavior: 'smooth' });
                
                // 5. Point to Graph Button
                // Offset 20 pushes it DOWN closer to the button
                setTimeout(() => {
                    showTutorialTip('showGraphBtn', 'Tap "Show Graph" to see your progress.', 20);
                }, 600); 
            }, 2000);
        }
    }
}


// ------------------ SETS ------------------
const setsTable = document.querySelector("#setsTable tbody");
function getLastSet() {
    if (!selectedExercise || !selectedExercise.sets || selectedExercise.sets.length === 0) return null;
    const sortedSets = selectedExercise.sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return sortedSets[0];
}

function renderSets() {
  const setsContainer = document.getElementById("setsList");
  setsContainer.innerHTML = "";
  
  if (!selectedExercise) return;
  updateSpiralData(selectedExercise.sets);

  // 1. Sort sets Oldest -> Newest (to determine chronological set #)
  const ascendingSets = selectedExercise.sets.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // 2. Group by Day
  const setsByDay = new Map();
  ascendingSets.forEach(set => {
    const dateObj = new Date(set.timestamp);
    const dayString = dateObj.toDateString(); 
    if (!setsByDay.has(dayString)) setsByDay.set(dayString, []);
    setsByDay.get(dayString).push(set);
  });

  // 3. Sort Days Newest -> Oldest (Display order)
  const sortedDays = Array.from(setsByDay.keys()).sort((a, b) => new Date(b) - new Date(a));

  // 4. Render
  sortedDays.forEach((dayString, dayIndex) => {
    const daySets = setsByDay.get(dayString);

    daySets.forEach((s, setIdx) => {
      const originalIndex = selectedExercise.sets.indexOf(s);
      
      const dateObj = new Date(s.timestamp);
      const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const fullTimeStr = dateObj.toLocaleString();

      const li = document.createElement("li");
      li.className = "set-card";

      // --- CARD HTML ---
      const summary = document.createElement("div");
      summary.className = "set-summary";
      summary.innerHTML = `
        <div class="set-index-badge">${setIdx + 1}</div>
        <div class="set-main-data">
          <span class="set-reps-val">${s.reps}</span>
          <span class="set-x">x</span>
          <span class="set-weight-val">${s.weight}<span style="font-size:0.7em; margin-left:2px;">${getUnitLabel()}</span></span>
        </div>
        <div class="set-meta-data">
          <span class="set-vol">${s.volume} v</span>
          <span class="set-date">${dateStr}</span>
        </div>
      `;

      const details = document.createElement("div");
      details.className = "set-details";
      const currentNotes = s.notes || "";
      
      details.innerHTML = `
        <div class="set-details-header">
          <span>${fullTimeStr}</span>
        </div>
        <div class="note-input-wrapper">
          <textarea class="set-note-input" placeholder="Add notes..." maxlength="40" rows="1">${currentNotes}</textarea>
          <div class="char-count">${currentNotes.length}/40</div>
        </div>
        <div class="set-actions-row">
          <button class="btn-delete-set">Delete Set</button>
        </div>
      `;

      // --- LOGIC: Expand Toggle ---
      summary.onclick = (e) => {
        if (editMode && e.target.closest('.set-main-data')) return;
        li.classList.toggle("expanded");
      };

      // --- LOGIC: Editable Numbers (Reps/Weight) ---
      const mainDataDiv = summary.querySelector('.set-main-data');
      mainDataDiv.onclick = (e) => {
          if (!editMode) return;
          e.stopPropagation();

          let type = 'reps';
          if (e.target.closest('.set-weight-val')) type = 'weight';

          if (type === 'reps') {
             const newReps = prompt("Edit Reps:", s.reps);
             if (newReps && newReps !== String(s.reps)) {
                 selectedExercise.sets[originalIndex].reps = parseInt(newReps);
                 selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight;
                 saveUserJson(); 
                 renderSets();
                 exitEditMode(); // <--- AUTO-EXIT EDIT MODE
             }
          } else {
             const newWeight = prompt("Edit Weight:", s.weight);
             if (newWeight && newWeight !== String(s.weight)) {
                 selectedExercise.sets[originalIndex].weight = parseFloat(newWeight);
                 selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight;
                 saveUserJson(); 
                 renderSets();
                 exitEditMode(); // <--- AUTO-EXIT EDIT MODE
             }
          }
      };

      // --- LOGIC: Note Autosave ---
      const noteInput = details.querySelector(".set-note-input");
      const charCount = details.querySelector(".char-count");
      noteInput.addEventListener("input", (e) => { charCount.textContent = `${e.target.value.length}/40`; });
      noteInput.addEventListener("change", (e) => {
         selectedExercise.sets[originalIndex].notes = e.target.value;
         saveUserJson();
      });

      // --- LOGIC: Delete ---
      const delBtn = details.querySelector(".btn-delete-set");
      delBtn.onclick = (e) => {
         e.stopPropagation();
         showDeleteConfirm(`Delete Set ${setIdx + 1} from ${dateStr}?`, () => {
           selectedExercise.sets.splice(originalIndex, 1);
           saveUserJson();
           renderSets();
         });
      };

      li.appendChild(summary);
      li.appendChild(details);
      setsContainer.appendChild(li);
    });

    // 5. SEPARATOR LOGIC
    if (dayIndex < sortedDays.length - 1) {
      const divider = document.createElement("li");
      divider.className = "session-divider";
      setsContainer.appendChild(divider);
    }
  });

  runTitleOnlyLogic();
  startRestTimer(false);
}

// ------------------ CUSTOM MINIMAL GRAPH ENGINE ------------------
const chartState = {
    range: '12w',
    metrics: { wpr: true, reps: true, volume: false, sets: false },
    dataPoints: [],
    width: 0, height: 0
};

function initChart() {
    const stage = document.getElementById('chartStage');
    chartState.width = stage.clientWidth;
    chartState.height = stage.clientHeight;
}

function getChartData() {
    const now = new Date().getTime();
    let days = 3650;
    if(chartState.range === '4w') days = 28;
    if(chartState.range === '8w') days = 56;
    if(chartState.range === '12w') days = 84;
    const cutoff = now - (days * 24 * 60 * 60 * 1000);
    // Group sets by Day
    const dayMap = {};
    selectedExercise.sets.forEach(s => {
        const time = new Date(s.timestamp).getTime();
        if (time < cutoff) return;
        
        const dateKey = new Date(s.timestamp).toDateString();
        if (!dayMap[dateKey]) {
            dayMap[dateKey] = { timestamp: time, reps: 0, vol: 0, sets: 0 };
        }
        dayMap[dateKey].reps += (parseInt(s.reps) || 0);
 
        dayMap[dateKey].vol += (parseFloat(s.volume) || 0);
        dayMap[dateKey].sets += 1;
    });
    const points = Object.values(dayMap).map(d => {
        const wpr = d.reps > 0 ? d.vol / d.reps : 0;
        return { timestamp: d.timestamp, vol: d.vol, reps: d.reps, sets: d.sets, wpr: wpr };
    }).sort((a,b) => a.timestamp - b.timestamp);
    if(points.length === 0) return [];

    let maxReps = 0, maxVol = 0, maxWpr = 0, maxSets = 0;
    points.forEach(p => {
        if(p.reps > maxReps) maxReps = p.reps;
        if(p.vol > maxVol) maxVol = p.vol;
        if(p.wpr > maxWpr) maxWpr = p.wpr;
        if(p.sets > maxSets) maxSets = p.sets;
    });
    maxReps *= 1.1; maxVol *= 1.1; maxWpr *= 1.1; maxSets *= 1.1;
    const startTime = points[0].timestamp;
    const endTime = points[points.length-1].timestamp;
    const timeSpan = endTime - startTime || 1; 

    return points.map(p => {
        const xNorm = (p.timestamp - startTime) / timeSpan;
        const x = xNorm * chartState.width;
        return {
            x: x,
            yReps: maxReps ? chartState.height - ((p.reps / maxReps) * chartState.height) : chartState.height,
            yVol: maxVol ? chartState.height 
            - ((p.vol / maxVol) * chartState.height) : chartState.height,
            yWpr: maxWpr ? chartState.height - ((p.wpr / maxWpr) * chartState.height) : chartState.height,
            ySets: maxSets ? chartState.height - ((p.sets / maxSets) * chartState.height) : chartState.height,
            data: p
        };
    });
}

// UPDATED: Added Sprint Animation Logic + Leaf Spawner Hook
function drawChart() {
    // 1. STOP OLD LEAVES when redrawing
    stopLeafSpawner();
    chartState.dataPoints = getChartData();
    const points = chartState.dataPoints;
    const pointsGroup = document.getElementById('chartPoints');
    pointsGroup.innerHTML = '';
    document.getElementById('chartGrid').innerHTML = '';
    if (points.length < 1) return;

    const gridGroup = document.getElementById('chartGrid');
    for(let i=1; i<5; i++) {
        const x = (chartState.width / 5) * i;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x); line.setAttribute("y1", 0);
        line.setAttribute("x2", x); line.setAttribute("y2", chartState.height);
        line.setAttribute("class", "chart-grid-line");
        gridGroup.appendChild(line);
    }

    const buildPath = (key) => {
        return points.map((p, i) => {
            return (i === 0 ? 'M' : 'L') + ` ${p.x},${p[key]}`;
        }).join(' ');
    };

    const updateLine = (id, key, metricKey, colorClass) => {
        const el = document.getElementById(id);
        if (chartState.metrics[metricKey]) {
            el.setAttribute('d', buildPath(key));
            el.classList.add('active');
            points.forEach((p, idx) => {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", p.x); circle.setAttribute("cy", p[key]);
                circle.setAttribute("class", `chart-point ${colorClass}`);
                circle.dataset.idx = idx; 
                pointsGroup.appendChild(circle);
     
            });
            // TRIGGER SPRINT ANIMATION (SLOWER)
            const len = el.getTotalLength();
            el.style.strokeDasharray = len;
            el.style.strokeDashoffset = len;
            // Using WAAPI for smooth JS control
            el.animate([
                { strokeDashoffset: len },
                { strokeDashoffset: 0 }
            ], {
                duration: 2000, 
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)', 
                fill: 'forwards'
            });
        } else {
            el.classList.remove('active');
        }
    };
    updateLine('pathReps', 'yReps', 'reps', 'reps');
    updateLine('pathWpr', 'yWpr', 'wpr', 'wpr');
    updateLine('pathVol', 'yVol', 'volume', 'vol');
    updateLine('pathSets', 'ySets', 'sets', 'sets');
    if (points.length > 0) updateDetailView(points.length - 1);

    // 2. START LEAVES AFTER DELAY
    setTimeout(() => {
        // Only start if we are still on the graph screen
        if (currentScreen === SCREENS.GRAPH) {
             startLeafSpawner();
        }
    }, 2200);
}

const touchLayer = document.getElementById('touchLayer');
const handleInteraction = (clientX) => {
    const rect = touchLayer.getBoundingClientRect();
    const x = clientX - rect.left;
    let closestDist = Infinity;
    let closestIdx = -1;
    chartState.dataPoints.forEach((p, i) => {
        const dist = Math.abs(p.x - x);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });
    if (closestIdx !== -1) updateDetailView(closestIdx);
    // --- ADD THIS TUTORIAL LOGIC ---
    if (isTutorialMode) {
        clearTutorialTips(); // Remove bubble immediately
        const endBtn = document.getElementById('endTutorialBtn');
        if (endBtn) endBtn.classList.add('flash-active'); // Start red flash loop
    }
};

touchLayer.addEventListener('mousemove', (e) => handleInteraction(e.clientX));
touchLayer.addEventListener('touchmove', (e) => { e.preventDefault(); handleInteraction(e.touches[0].clientX); }, { passive: false });
touchLayer.addEventListener('touchstart', (e) => { e.preventDefault(); handleInteraction(e.touches[0].clientX); }, { passive: false });
function updateDetailView(idx) {
    const p = chartState.dataPoints[idx];
    if(!p) return;
    const cursor = document.getElementById('cursorLine');
    cursor.classList.remove('hidden');
    cursor.setAttribute('x1', p.x);
    cursor.setAttribute('x2', p.x);
    document.querySelectorAll('.chart-point').forEach(c => {
        c.classList.remove('active');
        if (parseInt(c.dataset.idx) === idx) c.classList.add('active');
    });
    const raw = p.data; 
    const dateStr = new Date(raw.timestamp).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric'
    });
    document.getElementById('headerReps').textContent = raw.reps;
    document.getElementById('headerWpr').textContent = raw.wpr.toFixed(1);
    document.getElementById('headerSets').textContent = raw.sets;
    document.getElementById('headerVol').textContent = raw.vol;
    document.getElementById('headerDate').textContent = dateStr;
}

['gRange4w', 'gRange8w', 'gRange12w', 'gRangeAll'].forEach(id => {
    document.getElementById(id).onclick = (e) => {
        document.querySelectorAll('.pill-group .filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        chartState.range = id.replace('gRange', '').toLowerCase();
        drawChart();
    };
});
document.querySelectorAll('.toggle-text').forEach(btn => {
    btn.onclick = () => {
        const m = btn.dataset.metric;
        chartState.metrics[m] = !chartState.metrics[m];
        btn.classList.toggle('active');
        drawChart();
    };
});
window.addEventListener('resize', () => { 
    if(currentScreen === SCREENS.GRAPH) { initChart(); drawChart(); }
    
    // --- NEW ADDITION HERE ---
    autoShrinkTitle();
    // -------------------------
});

function hideAllDetails() {
  stopLeafSpawner();
  // Stop leaves if user navigates away
  Object.values(SCREENS).forEach(screenId => { document.getElementById(screenId).classList.add('hidden'); });
  document.getElementById(SCREENS.CLIENTS).classList.remove('hidden');
  currentScreen = SCREENS.CLIENTS;
  document.getElementById("graphDiv").innerHTML = "";
}
function isSameDay(d1, d2) { return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function aggregateStats(setsArray) {
  if (!setsArray || setsArray.length === 0) return { sets: 0, reps: 0, volume: 0, wpr: 0 };
  const totalSets = setsArray.length;
  const totalReps = setsArray.reduce((sum, set) => sum + set.reps, 0);
  const totalVolume = setsArray.reduce((sum, set) => sum + set.volume, 0);
  const avgWpr = totalReps > 0 ?
  (totalVolume / totalReps) : 0;
  return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
}
function formatNum(num) { if (num % 1 === 0) return num.toString(); return num.toFixed(1);
}

function updateStatUI(statName, currentValue, previousValue) {
  const arrowEl = document.getElementById(statName + 'Arrow');
  const spiralEl = document.getElementById(statName + 'Spiral');
  const dataEl = document.getElementById(statName + 'Data');
  
  if (!arrowEl || !dataEl) return 'neutral';
  
  const status = calculateStatStatus(currentValue, previousValue);
  
  // --- ARROWS PRESERVED ---
  let arrow = '—';
  if (status === 'increase') arrow = '↑'; 
  else if (status === 'decrease') arrow = '↓'; 
  // ------------------------

  const change = currentValue - previousValue;
  let percentageChange = 0;
  
  if (previousValue !== 0) percentageChange = (change / previousValue) * 100;
  else if (currentValue > 0) percentageChange = 100;

  let currentString = '';
  const changeSign = change > 0 ? '+' : '';
  
  switch(statName) {
    case 'sets': currentString = `${formatNum(currentValue)} Sets`; break;
    case 'reps': currentString = `${formatNum(currentValue)} Reps`; break;
    case 'volume': currentString = `${formatNum(currentValue)} ${getUnitLabel()}`; break;
    case 'wpr': currentString = `${formatNum(currentValue)} ${getUnitRatioLabel()}`; break;
  }
  
  let changeString = `(${changeSign}${formatNum(change)} / ${changeSign}${Math.abs(percentageChange).toFixed(0)}%)`;
  if (status === 'neutral') changeString = `(0 / 0%)`;

  const classesToRemove = ['increase', 'decrease', 'neutral'];
  
  arrowEl.innerHTML = arrow;
  arrowEl.classList.remove(...classesToRemove); 
  arrowEl.classList.add(status);
  
  if(spiralEl) { 
      spiralEl.classList.remove(...classesToRemove); 
      void spiralEl.offsetWidth; 
      spiralEl.classList.add(status);
  }
  
  // Set the text
  const fullText = `${currentString} ${changeString}`;
  dataEl.textContent = fullText;
  
  dataEl.classList.remove(...classesToRemove); 
  dataEl.classList.add(status);

  // --- RE-CALIBRATED SMART FIT SYSTEM ---
  // 1. Reset base styles (Default behavior)
  dataEl.style.fontSize = ""; 
  dataEl.style.whiteSpace = "nowrap"; 
  dataEl.style.lineHeight = "";
  dataEl.style.maxWidth = "";
  dataEl.style.display = "";
  dataEl.style.textAlign = "";
  dataEl.style.marginLeft = "";

  // 2. Check Length and Adjust
  const len = fullText.length;

  // UPDATED: Only trigger if text is REALLY long (> 29 chars)
  // This lets "150 lb/rep (-150 / 50%)" (approx 24 chars) stay normal.
  if (len > 29) {
      dataEl.style.fontSize = "0.75rem"; // Shrink slightly
      dataEl.style.whiteSpace = "normal"; // Allow stacking
      dataEl.style.lineHeight = "1.2";
      
      // UPDATED: Widen the constraint to 240px. 
      // This allows the text to extend far to the left before wrapping.
      dataEl.style.maxWidth = "240px";    
      
      dataEl.style.display = "block";     
      dataEl.style.textAlign = "right";   
      dataEl.style.marginLeft = "auto";   
  } 
  
  return status;
}
function runTitleOnlyLogic() {
  const titleElement = document.getElementById('exerciseSetsTitleSpan');
  if (!selectedExercise) return;
  applyTitleStyling(titleElement, selectedExercise.exercise, null);
  const colorData = getExerciseColorData(selectedExercise);
  selectedExercise.colorData = colorData;
  applyTitleStyling(titleElement, selectedExercise.exercise, colorData);

  // --- NEW ADDITION HERE ---
  // If the Sets screen is currently visible, refit the text
  if (!document.getElementById('setsDiv').classList.contains('hidden')) {
      autoShrinkTitle();
  }
  // -------------------------
}
let editMode = false;
const editToggleBtn = document.getElementById("editToggleBtn");
editToggleBtn.onclick = () => {
  editMode = !editMode;
  editToggleBtn.textContent = editMode ? "Done" : "Edit";
  document.body.classList.toggle('edit-mode-active');
  if (!editMode) saveUserJson();
};
function makeEditable(element, type, parentIdx, sortedSets) {
  element.classList.add("editable");
  element.style.cursor = "pointer";
  element.addEventListener("click", (e) => {
    if (!editMode) return;
    e.stopPropagation();
    
    // --- FIX START: Sanitize text to replace Non-Breaking Spaces with regular spaces ---
    const rawText = element.textContent;
    const currentVal = rawText.replace(/\u00A0/g, ' '); 
    // --- FIX END ---

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
        if (clientsData[currentVal]) {
            const data = clientsData[currentVal];
            
            // OPTIMIZED RENAME: Delete the old ID from Firestore
            deleteClientFromFirestore(currentVal); // <--- Add this

            delete clientsData[currentVal]; 
            data.client_name = newVal; 
            clientsData[newVal] = data; 
            if (selectedClient === currentVal) selectedClient = newVal;
            renderClients(); 
        }
        break;
      case "Session":
        if (clientsData[selectedClient]) {
            const sessionToEdit = clientsData[selectedClient].sessions.find(s => s.session_name === currentVal); 
            if (sessionToEdit) {
                sessionToEdit.session_name = newVal; 
                renderSessions(); 
            }
        }
        break;
      case "Exercise":
        if (selectedSession) {
            // <--- NEW: Validation Logic for Rename
            if (newVal.length > 41) {
                alert(`Exercise name is too long (${newVal.length} chars).\nPlease keep it under 41 characters.`);
                return;
            }
            // -----------------------------------

            const exerciseToEdit = selectedSession.exercises.find(ex => ex.exercise === currentVal);
            if(exerciseToEdit) {
                exerciseToEdit.exercise = newVal;
                renderExercises(); 
            }
        }
        break;
      case "Set Reps":
        selectedExercise.sets[originalIndex].reps = parseInt(newVal) || selectedExercise.sets[originalIndex].reps;
        selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight; 
        renderSets(); 
        break;
      case "Set Weight":
        selectedExercise.sets[originalIndex].weight = parseFloat(newVal) || selectedExercise.sets[originalIndex].weight; 
        selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * selectedExercise.sets[originalIndex].weight; 
        renderSets(); 
        break;
      case "Set Notes":
        selectedExercise.sets[originalIndex].notes = newVal;
        renderSets(); 
        break;
    }
    saveUserJson();

    // --- NEW LINE: Auto-exit edit mode after saving ---
    exitEditMode();
  });
}

function hookEditables(sortedSets = []) {
  document.querySelectorAll("#clientList li > span").forEach(span => makeEditable(span, "Client"));
  document.querySelectorAll("#sessionList li > span").forEach((span, idx) => makeEditable(span, "Session"));
  document.querySelectorAll("#exerciseList li > span").forEach((span, idx) => makeEditable(span, "Exercise"));

  // REMOVED THE SETS TABLE LOOP HERE
  // Because renderSets() now handles its own edit logic internally (lines 142-160 in the code above).
}
let touchStartX = 0; let touchStartY = 0; let touchMoveX = 0; let touchMoveY = 0;
const MIN_SWIPE_DISTANCE = 85;
const MAX_START_EDGE = 150;
document.body.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; touchMoveX = 0; touchMoveY = 0; }, { passive: true });
document.body.addEventListener('touchmove', (e) => { touchMoveX = e.touches[0].clientX; touchMoveY = e.touches[0].clientY; }, { passive: true });
document.body.addEventListener('touchend', () => {
    if (touchMoveX === 0 && touchMoveY === 0) return;
    const deltaX = touchMoveX - touchStartX;
    const deltaY = touchMoveY - touchStartY;
    if (touchStartX > MAX_START_EDGE) return;
    if (deltaX < MIN_SWIPE_DISTANCE) return;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    switch (currentScreen) {
        case SCREENS.SESSIONS: document.getElementById('backToClientsBtn').click(); break;
        case SCREENS.EXERCISES: document.getElementById('backToSessionsBtn').click(); break;
        case SCREENS.SETS: document.getElementById('backToExercisesBtn').click(); break;
    
        case SCREENS.GRAPH: document.getElementById('backToSetsFromGraphBtn').click(); break;
    }
    touchStartX = 0; touchStartY = 0;
});
// ==========================================
// ORGANIC LEAF ANIMATION SYSTEM (FINAL)
// ==========================================

var leafInterval = null;
var activeLeafSpots = [];
// Tracks x/y coordinates to prevent overlapping

// 1. LEAF GEOMETRY GENERATOR (3 Clean Styles)
function generateOrganicLeafPath() {
    const style = Math.floor(Math.random() * 3);
    let d = "";

    switch (style) {
        case 0: // 1. THE CLASSIC (Beech)
            d += "M 0 0 Q 2 -32 0 -65 ";
            d += "C 15 -45, 12 -15, 0 0 ";
            d += "C -12 -15, -15 -45, 0 -65 ";
            d += "M 0 -20 L 6 -25 ";  d += "M 0 -20 L -6 -25 ";
            d += "M 0 -35 L 8 -40 ";  d += "M 0 -35 L -8 -40 ";
            d += "M 0 -50 L 5 -55 ";  d += "M 0 -50 L -5 -55 ";
            break;
        case 1: // 2. THE WILLOW (Lanceolate)
            d += "M 0 0 Q 1 -40 0 -75 ";
            d += "C 6 -55, 4 -15, 0 0 ";
            d += "C -4 -15, -6 -55, 0 -75 ";
            d += "M 0 -20 L 3 -30 "; d += "M 0 -20 L -3 -30 ";
            d += "M 0 -35 L 4 -45 "; d += "M 0 -35 L -4 -45 ";
            d += "M 0 -50 L 3 -60 "; d += "M 0 -50 L -3 -60 ";
            break;
        case 2: // 3. THE HEART (Cordate)
            d += "M 0 0 L 0 -60 ";
            d += "C 15 -50, 25 -25, 0 0 ";
            d += "C -25 -25, -15 -50, 0 -60 ";
            d += "M 0 -15 Q 8 -18, 10 -22 ";
            d += "M 0 -15 Q -8 -18, -10 -22 ";
            d += "M 0 -30 Q 6 -33, 8 -38 ";
            d += "M 0 -30 Q -6 -33, -8 -38 ";
            d += "M 0 -45 Q 3 -48, 4 -50 ";
            d += "M 0 -45 Q -3 -48, -4 -50 ";
            break;
    }
    return d;
}

// 2. SPAWNER CONTROLS
function startLeafSpawner() {
  if (leafInterval) clearInterval(leafInterval);
  leafInterval = setInterval(() => {
    // Keep the hard limit of 5 leaves for performance
    const activeLeaves = document.querySelectorAll('.leaf-group');
    if (activeLeaves.length >= 5) return;
    spawnRandomLeaf();
  }, 800);
}

function stopLeafSpawner() {
  if (leafInterval) clearInterval(leafInterval);
  leafInterval = null;
  // Clear all DOM elements
  document.querySelectorAll('.leaf-group').forEach(el => el.remove());
  // Clear the position tracking array
  activeLeafSpots = [];
}

// 3. SPAWN LOGIC (With Collision Detection)
function spawnRandomLeaf() {
  const pointsGroup = document.getElementById('chartPoints'); 
  if (!pointsGroup) return;
  const activeLines = Array.from(document.querySelectorAll('.chart-line.active'));
  if (activeLines.length === 0) return;

  // COLLISION DETECTION LOOP
  // Try up to 10 times to find a spot that isn't crowded
  let pt = null;
  let targetLine = null;
  let validSpot = false;

  for (let i = 0; i < 10; i++) {
      targetLine = activeLines[Math.floor(Math.random() * activeLines.length)];
      const len = targetLine.getTotalLength();
      if (len === 0) continue;

      const randLen = Math.random() * len;
      const candidate = targetLine.getPointAtLength(randLen);
      // Check distance against all current leaves (threshold: 60px)
      const isTooClose = activeLeafSpots.some(spot => {
          const dx = candidate.x - spot.x;
          const dy = candidate.y - spot.y;
          return (dx * dx + dy * dy) < 3600; // 60^2 = 3600
      });
      if (!isTooClose) {
          pt = candidate;
          validSpot = true;
          break;
      }
  }

  // If we couldn't find a free spot after 10 tries, skip this frame.
  if (!validSpot || !pt) return;

  // REGISTER SPOT
  const spotRef = { x: pt.x, y: pt.y };
  activeLeafSpots.push(spotRef);
  const computedStyle = window.getComputedStyle(targetLine);
  const strokeColor = computedStyle.stroke;

  // CREATE ELEMENTS
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "leaf-group");
  const rotation = (Math.random() * 90) - 45;
  const scale = 0.5 + (Math.random() * 0.5);
  g.setAttribute("transform", `translate(${pt.x}, ${pt.y}) rotate(${rotation}) scale(${scale})`);

  const gInner = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gInner.setAttribute("class", "leaf-inner");
  // 45% chance to sway
  if (Math.random() < 0.45) {
      gInner.classList.add('leaf-sway');
  }

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", generateOrganicLeafPath());
  path.setAttribute("class", "leaf-path");
  path.style.stroke = strokeColor;
  
  gInner.appendChild(path);
  g.appendChild(gInner);
  pointsGroup.appendChild(g);
  // ANIMATE
  const pathLen = path.getTotalLength();
  path.style.strokeDasharray = pathLen;
  path.style.strokeDashoffset = pathLen;
  const animation = path.animate([
    { strokeDashoffset: pathLen }, 
    { strokeDashoffset: 0 }        
  ], {
    duration: 1500,
    easing: 'ease-out',
    fill: 'forwards'
  });
  // CLEANUP
  animation.onfinish = () => {
    setTimeout(() => {
        if (!document.body.contains(path)) {
             const idx = activeLeafSpots.indexOf(spotRef);
             if (idx > -1) activeLeafSpots.splice(idx, 1);
             return;
        }

        const undraw = path.animate([
           
            { strokeDashoffset: 0 },
            { strokeDashoffset: pathLen }
        ], {
            duration: 1000,
            easing: 'ease-in',
            fill: 'forwards'
        });

        undraw.onfinish = () => {
            if 
            (document.body.contains(g)) g.remove();
            const idx = activeLeafSpots.indexOf(spotRef);
            if (idx > -1) activeLeafSpots.splice(idx, 1);
        };
    }, 5000);
  };
}

// ==========================================
// RANDOM LOGO ANIMATION LOADER (AUTO-CYCLE)
// ==========================================
function initRandomLogo() {
  const logoSvg = document.getElementById('animated-logo');
  if (!logoSvg) return;
  // Helper to apply a specific variant
  const applyVariant = (v) => {
      // 1. Clear all existing classes to reset
      logoSvg.removeAttribute('class');
      // 2. Force a reflow so the animation restarts from 0%
      // (This trick ensures the new animation plays immediately)
      void logoSvg.offsetWidth;
      // 3. Apply new class
      if (v > 0) {
          logoSvg.classList.add('logo-variant');
          logoSvg.classList.add(`logo-v${v}`);
          console.log(`Logo Animation: V${v}`);
      } else {
          console.log('Logo Animation: Original');
      }
  };

  // Function to pick a NEW random number (different from current)
  const pickNewVariant = (current) => {
      let next;
      do {
          next = Math.floor(Math.random() * 20);
          // 0 to 19 (20 total)
      } while (next === current);
      // Ensure we don't pick the same one twice in a row
      return next;
  };
  // --- INITIAL LOAD ---
  let currentVariant = Math.floor(Math.random() * 20);
  applyVariant(currentVariant);
  // --- AUTOMATIC CYCLING TIMER ---
  // The CSS animation is 10s total (approx 3s action + 7s float).
  // We switch exactly when it finishes to keep it seamless.
  setInterval(() => {
      currentVariant = pickNewVariant(currentVariant);
      applyVariant(currentVariant);
  }, 10000);
  // 10,000ms = 10 seconds

  // --- OPTIONAL CLICK INTERACTION ---
  // (Still allows manual skipping if user gets bored)
  logoSvg.addEventListener('click', () => {
      currentVariant = pickNewVariant(currentVariant);
      applyVariant(currentVariant);
  });
}

initRandomLogo();

// ==========================================
// DYNAMIC SPIRAL GENERATOR (Masked Segments)
// ==========================================
function initOrganicSpiral() {
    const svg = document.getElementById('dynamicSpiralSvg');
    if (!svg) return;

    // 1. Configuration
    const centerX = 50, centerY = 50, maxRadius = 46, turns = 5.2, points = 200;
    // 2. Generate the Spiral Path Data (d)
    let d = `M ${centerX} ${centerY}`;
    for (let i = 0; i <= points; i++) {
        const t = i / points;
        const angle = t * (Math.PI * 2 * turns);
        const radius = maxRadius * t;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        d += ` L ${x} ${y}`;
    }

    // 3. Clear existing SVG content
    svg.innerHTML = '';
    // 4. Create the Mask (This handles the animation/growing)
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
    mask.setAttribute("id", "spiralMask");
    
    const maskPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    maskPath.setAttribute("d", d);
    maskPath.setAttribute("stroke", "white");
    // White = Visible in mask
    maskPath.setAttribute("stroke-width", "3.5");
    maskPath.setAttribute("stroke-linecap", "round");
    // Round head for the snake
    maskPath.setAttribute("fill", "none");
    maskPath.setAttribute("class", "mask-animator");
    // CSS will animate this
    
    mask.appendChild(maskPath);
    defs.appendChild(mask);
    svg.appendChild(defs);
    // 5. Create the Colored Layers (Static image that gets revealed)
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("mask", "url(#spiralMask)");

    // Helper to create a segment
    const createPath = (color, type) => {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", d);
        p.setAttribute("stroke", color);
        p.setAttribute("stroke-width", "3.5");
        p.setAttribute("fill", "none");
        // "butt" linecap ensures the color break is a flat, straight line
        p.setAttribute("stroke-linecap", "butt");
        return p;
    };

    // Layer 1: Green Base (Background)
    const baseGreen = createPath('#34c759');
    group.appendChild(baseGreen);
    // We need the length to calculate dash offsets for segments
    // We append temporarily to measure, or create a temp element
    const tempPath = createPath('none');
    svg.appendChild(tempPath);
    const len = tempPath.getTotalLength();
    tempPath.remove();

    // Layer 2: Yellow Segment (22% to 45%)
    // dasharray: 0 (dot), Gap to Start, Draw Length, Gap to End
    const yellow = createPath('#ffcc00');
    const yStart = len * 0.22;
    const yLen = (len * 0.45) - yStart;
    yellow.setAttribute("stroke-dasharray", `0 ${yStart} ${yLen} ${len}`);
    group.appendChild(yellow);
    // Layer 3: Red Segment (45% to 72%)
    const red = createPath('#ff3b30');
    const rStart = len * 0.45;
    const rLen = (len * 0.72) - rStart;
    red.setAttribute("stroke-dasharray", `0 ${rStart} ${rLen} ${len}`);
    group.appendChild(red);
    svg.appendChild(group);

    // 6. Set CSS Variables for Animation
    svg.style.setProperty('--spiral-len', len);
}

// Run immediately
initOrganicSpiral();

// ==========================================
// INSTALL PROMPT LOGIC (First Time Only)
// ==========================================

function initInstallPrompt() {
    // 1. Check if already installed (Standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // 2. Check LocalStorage (Has user seen this?)
    const hasSeenPrompt = localStorage.getItem('trunk_install_prompt_seen');
    if (hasSeenPrompt) return;

    // 3. Detect OS
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const promptEl = document.getElementById('installPrompt');
    const textEl = document.getElementById('installText');
    const closeBtn = document.getElementById('closeInstallBtn');

    if (!promptEl) return;

    // IOS DETECTION
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        promptEl.classList.remove('hidden');
        promptEl.classList.add('ios-pos');
        textEl.textContent = "Install as App:\n1. Tap the menu dots (...), then tap share button below\n2. Scroll down\n3. Tap 'Add to Home Screen'";
    } 
    // ANDROID DETECTION
    else if (/android/i.test(userAgent)) {
        promptEl.classList.remove('hidden');
        promptEl.classList.add('android-pos');
        textEl.textContent = "Install as App:\n1. Tap the menu dots (⋮)\n2. Tap 'Install App' or 'Add to Home Screen'";
    }
    // If neither (Desktop/Other), do nothing.

    // 4. Close Logic
    closeBtn.onclick = () => {
        promptEl.classList.add('hidden');
        // Mark as seen so it never shows again
        localStorage.setItem('trunk_install_prompt_seen', 'true');
    };
}

// Run on load
window.addEventListener('load', () => {
    // Slight delay so it doesn't pop up instantly over the login
    setTimeout(initInstallPrompt, 2000);
});

// =====================================================
// NEW CALCULATOR MODAL LOGIC
// =====================================================

const addSetModal = document.getElementById('addSetModal');
const calcValueEl = document.getElementById('calcValue');
const calcModeLabel = document.getElementById('calcModeLabel');
const calcActionBtn = document.getElementById('calcActionBtn');
const plateGrid = document.getElementById('plateGrid');
const calcUnitEl = document.getElementById('calcUnit');

// State for the calculator
let calcState = {
  activeField: 'reps', 
  repsVal: '',
  weightVal: '',
  plates: {}, 
  plateStack: [],
  // NEW: Track if the current values are auto-filled
  isAutoFilled: { reps: false, weight: false }
};

function openAddSetModal() {
  // Initialize with Reps selected
  calcState = { 
      activeField: 'reps', 
      repsVal: '', 
      weightVal: '', 
      plates: {}, 
      plateStack: [],
      isAutoFilled: { reps: false, weight: false } 
  };

  // Set default weight AND reps if previous sets exist
  const lastSet = getLastSet();

  if (lastSet) {
      calcState.repsVal = String(lastSet.reps);     // NEW: Auto-fill Reps
      calcState.weightVal = String(lastSet.weight); // Existing: Auto-fill Weight
      
      // NEW: Mark both as auto-filled so next interaction clears them
      calcState.isAutoFilled.reps = true;
      calcState.isAutoFilled.weight = true;
  }

  updateCalcUI();
  resetPlateCounters();
  if(addSetModal) addSetModal.classList.remove('hidden');
}

// HELPER: surgical clear of auto-filled data on first touch
function checkAndClearAutoFill() {
    const field = calcState.activeField;
    
    // Only proceed if this specific field is currently flagged as auto-filled
    if (calcState.isAutoFilled && calcState.isAutoFilled[field]) {
        
        // 1. Clear the values
        if (field === 'reps') {
            calcState.repsVal = '';
        } else {
            calcState.weightVal = '';
            calcState.plateStack = [];
            resetPlateCounters(); // Visual reset for plates
        }

        // 2. Remove the flag so subsequent typing works normally
        calcState.isAutoFilled[field] = false;
    }
}

function closeAddSetModal() {
  addSetModal.classList.add('hidden');
}

document.getElementById('calcCloseBtn').onclick = closeAddSetModal;

// =====================================================
// REST TIMER ENGINE
// =====================================================

function startRestTimer(reset = false) {
    if (!selectedExercise) return;
    
    // Unique ID for this exercise's timer in LocalStorage
    const timerKey = `restTimer_${selectedExercise.exercise}`;
    
    if (reset) {
        // CASE 1: New Set Added -> Save NOW as the start time
        const now = Date.now();
        localStorage.setItem(timerKey, now);
    }

    // Clear any existing loop so we don't have doubles
    if (restTimerInterval) clearInterval(restTimerInterval);

    const timerEl = document.getElementById('restTimer');
    const textEl = document.getElementById('restTimerText');
    
    // Immediate Update (Run once before interval starts to avoid 1s delay)
    updateTimerUI(timerKey, timerEl, textEl);

    // Start Loop
    restTimerInterval = setInterval(() => {
        updateTimerUI(timerKey, timerEl, textEl);
    }, 1000);
}

function updateTimerUI(key, container, textSpan) {
    const startTime = localStorage.getItem(key);
    
    // If no time saved, or user deleted it, hide timer
    if (!startTime) {
        container.classList.add('hidden');
        if (restTimerInterval) clearInterval(restTimerInterval);
        return;
    }

    const diff = Date.now() - parseInt(startTime);
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    // TIMEOUT: If > 30 minutes, stop tracking to save battery/sanity
    if (minutes >= 30) {
        container.classList.add('hidden');
        if (restTimerInterval) clearInterval(restTimerInterval);
        localStorage.removeItem(key); // Cleanup
        return;
    }

    // Formatting: 00:00
    const mStr = minutes.toString().padStart(2, '0');
    const sStr = seconds.toString().padStart(2, '0');
    
    textSpan.textContent = `${mStr}:${sStr}`;
    container.classList.remove('hidden');
}

function stopRestTimerUI() {
    // Stops the visual update (CPU) but KEEPS the timestamp in storage
    if (restTimerInterval) clearInterval(restTimerInterval);
}

// Update the Screen & Button Text based on State
function updateCalcUI() {
    // 1. Update Text Displays
    const rDisp = document.getElementById('repsDisplay');
    const wDisp = document.getElementById('weightDisplay');
    
    if(rDisp) rDisp.textContent = calcState.repsVal || '0';
    if(wDisp) wDisp.textContent = calcState.weightVal || '0';

    // 2. Highlight Active Field
    const rBox = document.getElementById('repsBox');
    const wBox = document.getElementById('weightBox');
    
    // Reset classes
    if(rBox) rBox.className = 'calc-field-box';
    if(wBox) wBox.className = 'calc-field-box';

    // Apply Active State
    if (calcState.activeField === 'reps' && rBox) {
        rBox.classList.add('active');
    } else if (calcState.activeField === 'weight' && wBox) {
        wBox.classList.add('active');
    }

    // 3. Update Save Button Style
    // We always show "Save Set" now, no more "Next"
    if (calcActionBtn) {
        calcActionBtn.textContent = "Save Set";
        // Check if valid to visually indicate readiness
        const isValid = calcState.repsVal && calcState.weightVal;
        
        if (isValid) {
             calcActionBtn.style.backgroundColor = "var(--color-green)";
             calcActionBtn.classList.remove('btn-primary');
        } else {
             calcActionBtn.style.backgroundColor = "";
             calcActionBtn.classList.add('btn-primary');
        }
    }
}

// NEW: Add Click Listeners for the Split Boxes (Add this right after updateCalcUI)
document.getElementById('repsBox').onclick = () => {
    calcState.activeField = 'reps';
    updateCalcUI();
};
document.getElementById('weightBox').onclick = () => {
    calcState.activeField = 'weight';
    updateCalcUI();
};

// Handle Numpad Clicks
document.querySelectorAll('.num-btn').forEach(btn => {
  if (btn.id === 'calcBackspace') return;

  btn.onclick = (e) => {
    e.stopPropagation(); 
    checkAndClearAutoFill();
    const val = btn.dataset.val;
    
    // Determine which value we are editing based on activeField
    let currentStr = calcState.activeField === 'reps' ? calcState.repsVal : calcState.weightVal;

    if (val === '.' && currentStr.includes('.')) return;
    
    // Prevent multiple leading zeros
    if (currentStr === '0' && val !== '.') currentStr = val;
    else currentStr += val;

    // Save back to state
    if (calcState.activeField === 'reps') {
        // Validation: Cap reps at 999 to prevent UI break
        if (currentStr.length <= 3) calcState.repsVal = currentStr;
    } else {
        calcState.weightVal = currentStr;
        calcState.plateStack = []; // Clear plates if manually typing weight
    }

    updateCalcUI();
  };
});


// Handle Plate Clicks
document.querySelectorAll('.plate-btn').forEach(btn => {
  btn.onclick = (e) => {
    calcState.activeField = 'weight';
    checkAndClearAutoFill();

    const weight = parseFloat(btn.dataset.weight);
    
    // 1. Update UI Counter
    if (!calcState.plates[weight]) calcState.plates[weight] = 0;
    calcState.plates[weight]++;
    // ... existing badge logic ...

    // 2. Add to Total Weight
    let currentWeight = parseFloat(calcState.weightVal) || 0;
    currentWeight += weight;
    calcState.weightVal = currentWeight.toString();

    // 3. Add to History
    calcState.plateStack.push(weight);
    
    updateCalcUI();
  };
});

// Smart Backspace Handler
const backspaceBtn = document.getElementById('calcBackspace');
if (backspaceBtn) {
    backspaceBtn.onclick = (e) => {
        e.stopPropagation();

        // 1. AUTO-FILL CHECK (From previous step)
        if (calcState.isAutoFilled && calcState.isAutoFilled[calcState.activeField]) {
            checkAndClearAutoFill();
            updateCalcUI();
            return;
        }

        // SCENARIO 1: Undo a Plate (Only if Weight is active AND we have plate history)
        // FIX: Changed 'calcState.step' to 'calcState.activeField'
        if (calcState.activeField === 'weight' && calcState.plateStack.length > 0) {
            
            // 1. Remove the last added plate from history
            const removedWeight = calcState.plateStack.pop();

            // 2. Subtract from total
            let currentWeight = parseFloat(calcState.weightVal) || 0;
            currentWeight -= removedWeight;
            
            // Floating point math safety
            currentWeight = Math.round(currentWeight * 100) / 100;
            calcState.weightVal = currentWeight > 0 ? currentWeight.toString() : "";

            // 3. Decrement the visual "x1" counter
            if (calcState.plates[removedWeight] > 0) {
                calcState.plates[removedWeight]--;
                const plateBtn = document.querySelector(`.plate-btn[data-weight="${removedWeight}"]`);
                if (plateBtn) {
                    const badge = plateBtn.querySelector('.plate-count');
                    if (badge) {
                        badge.textContent = calcState.plates[removedWeight] > 0 
                            ? `x${calcState.plates[removedWeight]}` 
                            : "";
                        if (calcState.plates[removedWeight] === 0) badge.classList.add('hidden');
                    }
                }
            }
            
            updateCalcUI();
            return;
        }

        // SCENARIO 2: Normal Backspace (Delete last digit)
        // FIX: Changed 'calcState.step' to 'calcState.activeField'
        let currentStr = calcState.activeField === 'reps' ? calcState.repsVal : calcState.weightVal;
        
        // Safety check to ensure it's a string
        currentStr = String(currentStr || "");
        currentStr = currentStr.slice(0, -1);

        // FIX: Changed 'calcState.step' to 'calcState.activeField'
        if (calcState.activeField === 'reps') {
            calcState.repsVal = currentStr;
        } else {
            calcState.weightVal = currentStr;
        }

        updateCalcUI();
    };
}

function resetPlateCounters() {
  calcState.plates = {};
  document.querySelectorAll('.plate-count').forEach(el => el.classList.add('hidden'));
}

// Handle "Next" / "Save" Action
calcActionBtn.onclick = () => {
    // Direct Save
    finishAddSet();
};

function finishAddSet() {
  const reps = parseInt(calcState.repsVal);
  const weight = parseFloat(calcState.weightVal);
  
  // Validation: Ensure both are entered
  if (isNaN(reps) || isNaN(weight)) {
    // Visual feedback: shake or alert
    if (isNaN(reps)) calcState.activeField = 'reps';
    else calcState.activeField = 'weight';
    updateCalcUI();
    alert("Please enter both Reps and Weight.");
    return;
  }

  const notes = ""; // Notes are empty by default as requested
  const timestamp = new Date().toISOString();
  const volume = reps * weight;

  selectedExercise.sets.push({ reps, weight, volume, notes, timestamp });
  saveUserJson(); 
  renderSets();
  closeAddSetModal();
    // --- NEW: Start/Reset Timer ---
  startRestTimer(true); // true = reset to 00:00
  // -----------------------------

  // --- RE-INSERTING YOUR TUTORIAL LOGIC ---
  if (isTutorialMode && selectedExercise.exercise === 'Bench Press') {
      clearTutorialTips();
      if (tutorialTimer) clearTimeout(tutorialTimer);
          
      // Step 1: Point to the Spiral Widget immediately
      setTimeout(() => {
          showTutorialTip('spiralCanvas', 'This window displays your exercise history.', 20);
          
          // Step 2: Wait 3 seconds, then point to slider
          tutorialTimer = setTimeout(() => {
              document.body.dataset.tutorialStep = "waiting-for-slider";
              showTutorialTip('spiralSlider', 'Drag the toggle backwards to view the history.', 10);
          }, 3000); 
      }, 500);
  }
  // ----------------------------------------
}

// =====================================================
// FINAL CONNECTION FIXES (PASTE AT BOTTOM OF APP.JS)
// =====================================================

// 1. RESTORE GRAPH BUTTON LOGIC
document.getElementById("showGraphBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  
  const sets = selectedExercise.sets;
  if (!sets || sets.length === 0) { alert("No sets to graph"); return; }
  
  navigateTo(SCREENS.GRAPH, 'forward');
  
  const graphTitle = document.getElementById('graphTitle');
  // Use existing styling helper
  if(typeof applyTitleStyling === "function") {
      applyTitleStyling(graphTitle, selectedExercise.exercise, getExerciseColorData(selectedExercise));
  } else {
      graphTitle.textContent = selectedExercise.exercise;
  }

  // Draw the chart once the screen transition starts
  requestAnimationFrame(() => {
      if(typeof initChart === "function") initChart();
      if(typeof drawChart === "function") drawChart();
      
      // Tutorial Tip Hook
      if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
         setTimeout(() => showTutorialTip('touchLayer', 'Touch and drag across the graph to see details.', 50), 1000);
      }
  });
};

// 2. CONNECT THE NEW "ADD SET" BUTTON
document.getElementById("addSetBtn").onclick = () => {
  if (!selectedExercise) { alert("Select an exercise first"); return; }
  
  // Call the new modal function you added
  if (typeof openAddSetModal === "function") {
      openAddSetModal();
  } else {
      console.error("openAddSetModal function is missing!");
  }
};

// FIX: Alias the old function name to the new one so the app doesn't freeze
window.autoShrinkTitle = forceTitleResize;

// HELPER: Auto-Exit Edit Mode
function exitEditMode() {
  editMode = false;
  document.body.classList.remove('edit-mode-active');
  const btn = document.getElementById("editToggleBtn");
  if(btn) btn.textContent = "Edit";
}

// =====================================================
// SETTINGS UI LOGIC
// =====================================================
const settingsModal = document.getElementById('settingsModal');
const unitToggle = document.getElementById('unitToggle');
const colorToggle = document.getElementById('colorToggle');
const animToggle = document.getElementById('animToggle');

function openSettingsModal() {
    updateSettingsUI();
    settingsModal.classList.remove('hidden');
}

if(document.getElementById('closeSettingsBtn')) {
    document.getElementById('closeSettingsBtn').onclick = () => {
        settingsModal.classList.add('hidden');
    };
}

function updateSettingsUI() {
    if(!unitToggle) return;
    unitToggle.checked = (userSettings.units === 'kg'); 
    colorToggle.checked = userSettings.enableColors;
    animToggle.checked = userSettings.enableAnimations;
}

// 1. UNIT TOGGLE
if(unitToggle) {
    unitToggle.onclick = async (e) => {
        e.preventDefault(); 
        const willBeKg = !unitToggle.checked; 
        const confirmWipe = confirm(`WARNING: Switching to ${willBeKg ? 'Kilograms' : 'Pounds'} will DELETE ALL existing profile data.\n\nAre you sure?`);
        
        if (confirmWipe) {
            userSettings.units = willBeKg ? 'kg' : 'lbs';
            unitToggle.checked = willBeKg;
            await wipeAllUserData();
        }
    };
}

// 2. COLOR TOGGLE
if(colorToggle) {
    colorToggle.onclick = () => {
        userSettings.enableColors = colorToggle.checked;
        saveUserJson(); 
        refreshCurrentView();
    };
}

// 3. ANIMATION TOGGLE
if(animToggle) {
    animToggle.onclick = () => {
        userSettings.enableAnimations = animToggle.checked;
        saveUserJson(); 
        refreshCurrentView();
    };
}

// 4. LOGOUT
if(document.getElementById('settingsLogoutBtn')) {
    document.getElementById('settingsLogoutBtn').onclick = async () => {
        settingsModal.classList.add('hidden');
        await auth.signOut();
    };
}

function refreshCurrentView() {
    if (typeof currentScreen === 'undefined') return;
    if (currentScreen === SCREENS.CLIENTS) renderClients();
    else if (currentScreen === SCREENS.SESSIONS) renderSessions();
    else if (currentScreen === SCREENS.EXERCISES) renderExercises();
    else if (currentScreen === SCREENS.SETS) { renderSets(); runTitleOnlyLogic(); }
}
