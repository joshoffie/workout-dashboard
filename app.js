
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
        t: s.timestamp,
        p: s.plates || null // <--- NEW: Store Plate Data
    };
}

// Expand a single set (Short keys -> Long keys)
function expandSet(s) {
    return {
        reps: s.r ?? s.reps,
        weight: s.w ?? s.weight,
        volume: s.v ?? s.volume,
        notes: s.n ?? s.notes ?? "",
        timestamp: s.t ?? s.timestamp,
        plates: s.p ?? s.plates ?? null // <--- NEW: Retrieve Plate Data
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
    // Safety check: ensure clientObj and sessions exist before looping
    if (clientObj && clientObj.sessions) {
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
// TUTORIAL ENGINE (Fixed & Consolidated)
// =====================================================

// 1. GLOBAL VARIABLES
let isTutorialMode = false;
let tutorialTimer = null;
let tutorialStep = 0;
let stableWindowHeight = window.innerHeight; // Stores the height WITHOUT keyboard

// 2. FAKE DATA GENERATOR
function generateTutorialData() {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const sets = [];
  
  // Create 8 weeks of history
  for (let i = 0; i < 8; i++) {
    const weeksAgo = 7 - i;
    const date = new Date(now.getTime() - (weeksAgo * 7 * oneDay));
    const weight = 135 + (i * 5); // Progressive overload
    const reps = 8 + (i % 2);
    
    for (let s = 0; s < 3; s++) {
      sets.push({
        reps: reps,
        weight: weight,
        volume: reps * weight,
        notes: i === 7 ? "New PR!" : "Solid set",
        timestamp: new Date(date.getTime() + (s * 5 * 60000)).toISOString()
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
            { exercise: "Bench Press", sets: sets },
            { exercise: "Incline Dumbbell", sets: [] }
          ]
        }
      ]
    }
  };
}

// 3. START BUTTON LOGIC (With Error Catching)
const startTutorialBtn = document.getElementById('startTutorialBtn');
if (startTutorialBtn) {
    startTutorialBtn.onclick = () => {
      try {
        console.log("Starting Tutorial...");
        isTutorialMode = true;
        
        // Reset tutorial stage tracker
        document.body.dataset.tutorialStage = 'start';

        // 1. Hide Auth UI
        const loginModal = document.getElementById('loginModal');
        if (loginModal) loginModal.classList.add('hidden');

        // 2. Hide Login/Logout (Keep Edit/Settings Visible)
        const idsToHide = ['loginBtn', 'logoutBtn'];
        idsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // 3. Explicitly SHOW Edit & Settings (so they are usable)
        const editToggleBtn = document.getElementById('editToggleBtn');
        if (editToggleBtn) editToggleBtn.classList.remove('hidden');

        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.classList.remove('hidden');

        // 4. --- FIX: HIDE END BUTTON INITIALLY ---
        // User cannot exit until the end step
        const endBtn = document.getElementById('endTutorialBtn');
        if (endBtn) endBtn.classList.add('hidden');

        // 5. Load Data & Render
        clientsData = generateTutorialData();
        renderClients();

        // 6. Start Interaction
        setTimeout(() => {
          showTutorialTip('clientList', 'Tap the profile to see sessions.', 40);
        }, 500);

      } catch (err) {
        alert("Tutorial Error: " + err.message);
        console.error(err);
      }
    };
}

// 4. END BUTTON LOGIC
const endTutorialBtn = document.getElementById('endTutorialBtn');
if (endTutorialBtn) {
    endTutorialBtn.onclick = () => {
      isTutorialMode = false;
      document.body.removeAttribute('data-tutorial-stage');
      
      // Cleanup timers
      if (tutorialTimer) clearTimeout(tutorialTimer);
      tutorialTimer = null;
      clearTutorialTips();
      
      // 1. Hide End Button
      endTutorialBtn.classList.remove('flash-active');
      endTutorialBtn.classList.add('hidden');
      
      // 2. Show Login Modal (Back to start)
      document.getElementById('loginModal').classList.remove('hidden');
      const loginBtn = document.getElementById('loginBtn');
      if (loginBtn) loginBtn.classList.remove('hidden');

      // 3. --- FIX: HIDE EDIT & SETTINGS (Reset to Logged Out State) ---
      const editToggleBtn = document.getElementById('editToggleBtn');
      if (editToggleBtn) {
          editToggleBtn.classList.add('hidden');
          editToggleBtn.textContent = "Edit"; // Reset text
          editMode = false;
          document.body.classList.remove('edit-mode-active');
      }

      const settingsBtn = document.getElementById('settingsBtn');
      if (settingsBtn) settingsBtn.classList.add('hidden');

      // 4. Clear Data
      clientsData = {};
      hideAllDetails();
      renderClients();
    };
}

// [app.js] SMART TOOLTIP POSITIONING ENGINE
// [app.js] SMART TOOLTIP POSITIONING ENGINE
function showTutorialTip(targetId, text, ignoredOffset = 0, ignoredAlign = 'center', enableScroll = true) {
  clearTutorialTips();
  const target = document.getElementById(targetId);
  if (!target) return;
  
  if (enableScroll) {
      // Use 'nearest' to avoid jumping the whole page if the button is already visible
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // 1. Create & Append (To measure dimensions)
  const tip = document.createElement('div');
  tip.className = 'tutorial-tooltip';
  tip.textContent = text;
  document.body.appendChild(tip);
  
  // 2. Get Measurements
  const targetRect = target.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const screenW = window.innerWidth;
  // Robust scroll calculation that works on all browsers
  const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
  
  // --- HORIZONTAL LOGIC (Clamp to Screen) ---
  const targetCenterX = targetRect.left + (targetRect.width / 2);
  
  // Start centered on the target
  let left = targetCenterX - (tipRect.width / 2);
  
  // Safety Padding (10px from edge)
  const padding = 10; 
  
  // Clamp Left: Don't go off the left edge
  if (left < padding) left = padding;
  
  // Clamp Right: Don't go off the right edge
  if (left + tipRect.width > screenW - padding) {
      left = screenW - tipRect.width - padding;
  }
  
  // --- ARROW LOGIC (Point to Target) ---
  // Calculate where the arrow needs to be relative to the text box
  let arrowX = targetCenterX - left;
  
  // Keep arrow inside the box border-radius (don't let it float off the corner)
  const cornerLimit = 20; 
  if (arrowX < cornerLimit) arrowX = cornerLimit;
  if (arrowX > tipRect.width - cornerLimit) arrowX = tipRect.width - cornerLimit;
  
  // --- VERTICAL LOGIC (Safety Fix) ---
  let top;
  const gap = 15; // Space between button and tip
  const spaceAbove = targetRect.top; 

  // FIX: Increased threshold (+80px). 
  // If the button is in the top header area (like the Back button),
  // we FORCE the tooltip to appear BELOW it.
  if (spaceAbove > tipRect.height + gap + 80) {
      // POSITION ABOVE
      top = scrollY + targetRect.top - tipRect.height - gap;
      tip.classList.remove('tooltip-below');
  } else {
      // POSITION BELOW (Default for Header Buttons)
      top = scrollY + targetRect.bottom + gap;
      tip.classList.add('tooltip-below');
  }

  // 3. Apply Calculated Styles
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.style.setProperty('--arrow-x', `${arrowX}px`);
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
// UNIT CONVERSION ENGINE (Base Unit = LBS)
// =====================================================
const UNIT_mode = {
    current: 'lbs', // Default base
    LB_TO_KG: 0.45359237,

    init: function() {
        const saved = localStorage.getItem('trunk_unit_preference');
        if (saved) this.current = saved;
        this.applyToUI();
    },

    toggle: function() {
        sendHapticScoreToNative(-2); // <--- ADD THIS LINE (Toggle Click)
        this.current = this.current === 'lbs' ? 'kg' : 'lbs';
        localStorage.setItem('trunk_unit_preference', this.current);
        this.applyToUI();
        
        // FORCE RE-RENDER OF ALL SCREENS
        if (typeof renderClients === 'function') renderClients();
        // Check if we need to redraw specific screens based on visibility
        if (!document.getElementById('sessionsDiv').classList.contains('hidden')) renderSessions();
        if (!document.getElementById('exercisesDiv').classList.contains('hidden')) renderExercises();
        if (!document.getElementById('setsDiv').classList.contains('hidden')) renderSets();
        
        // If Graph is open, completely redraw it
        if (!document.getElementById('graphContainer').classList.contains('hidden')) {
             if(typeof initChart === 'function') { initChart(); drawChart(); }
        }
    },

    // DATABASE (LBS) -> UI (DISPLAY)
    toDisplay: function(lbsValue) {
        if (this.current === 'lbs') return parseFloat(parseFloat(lbsValue).toFixed(2));
        // Convert Lbs -> Kg (Round to 2 decimals for clean display)
        return parseFloat((lbsValue * this.LB_TO_KG).toFixed(2)); 
    },

    // UI (USER INPUT) -> DATABASE (LBS)
    toStorage: function(userValue) {
        if (this.current === 'lbs') return parseFloat(userValue);
        // Convert Kg -> Lbs (Save with high precision to prevent drift)
        return parseFloat((userValue / this.LB_TO_KG).toFixed(4));
    },

    getLabel: function() {
        return this.current;
    },

    applyToUI: function() {
        // Update Setting Switch
        const toggle = document.getElementById('settingUnitToggle');
        if (toggle) toggle.checked = (this.current === 'kg');
        
        // Update Calculator Unit Label
        const wLabel = document.querySelector('#weightBox .field-label');
        if (wLabel) wLabel.textContent = `WEIGHT (${this.current.toUpperCase()})`;
    }
};

// Start immediately
UNIT_mode.init();

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
  GRAPH: 'graphContainer',
  SETTINGS: 'settingsDiv',
  CALENDAR: 'calendarDiv'
};
let currentScreen = SCREENS.CLIENTS;
let lastActiveScreen = SCREENS.CLIENTS; // <--- NEW: Memory State

// [app.js] FULL Navigate To Function
function navigateTo(targetScreenId, direction = 'forward') {
  const targetScreen = document.getElementById(targetScreenId);
  const currentScreenEl = document.getElementById(currentScreen);
  if (!targetScreen || targetScreen === currentScreenEl) return;
  
  // 1. Pre-calculate size before showing
  forceTitleResize(targetScreenId);

  // 2. Render specific screens
switch (targetScreenId) {
    case SCREENS.CLIENTS: renderClients(); break;
    case SCREENS.SESSIONS: renderSessions(); break;
    case SCREENS.EXERCISES: renderExercises(); break;
    case SCREENS.SETS: renderSets(); break;
    case SCREENS.SETTINGS: 
        const settingsTitle = document.getElementById('settingsScreenTitle');
        if(settingsTitle && typeof applyTitleStyling === 'function') {
           applyTitleStyling(settingsTitle, 'Settings', null);
        }
        break;
    case SCREENS.CALENDAR:
          if(typeof renderCalendarScreen === 'function') renderCalendarScreen();
          break;
          
    // --- THIS CASE WAS OUTSIDE THE SWITCH IN YOUR CODE ---
    case SCREENS.GRAPH: 
        if(typeof initChart === 'function') setTimeout(initChart, 50);
        break;
    // ---------------------------------------------------
  } 

  // 3. Handle Animations
  const enterClass = (direction === 'forward') ? 'slide-in-right' : 'slide-in-left';
  const exitClass = (direction === 'forward') ? 'slide-out-left' : 'slide-out-right';

  targetScreen.classList.remove('hidden', 'slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  targetScreen.classList.add(enterClass);
  
  currentScreenEl.classList.remove('slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right');
  currentScreenEl.classList.add(exitClass);
  
  currentScreen = targetScreenId;

  // 4. Force Timer Check
  if (typeof masterClockTick === 'function') masterClockTick();

  // 5. Cleanup Animation Classes
  currentScreenEl.addEventListener('animationend', () => {
    currentScreenEl.classList.add('hidden');
    currentScreenEl.classList.remove(exitClass);
  }, { once: true });
  
  targetScreen.addEventListener('animationend', () => {
    targetScreen.classList.remove(enterClass);
  }, { once: true });

  // === TUTORIAL BACK-FLOW LOGIC ===
  if (typeof isTutorialMode !== 'undefined' && isTutorialMode && direction === 'back') {
      checkTutorialNavigation(targetScreenId);
  }
}

// Helper function to guide user back up the stack
function checkTutorialNavigation(targetScreenId) {
    const stage = document.body.dataset.tutorialStage;

    // 1. Came back from Graph -> Sets
    if (targetScreenId === SCREENS.SETS && stage === 'graph-touched') {
        document.body.dataset.tutorialStage = 'sets-returned';
        setTimeout(() => showTutorialTip('backToExercisesBtn', 'Go back to Exercises.', 30, 'left'), 600);
    }
    
    // 2. Came back from Sets -> Exercises
    else if (targetScreenId === SCREENS.EXERCISES && stage === 'sets-returned') {
        document.body.dataset.tutorialStage = 'exercises-returned';
        setTimeout(() => showTutorialTip('backToSessionsBtn', 'Go back to Sessions.', 30, 'left'), 600);
    }

    // 3. Came back from Exercises -> Sessions (TRIGGER CALENDAR)
    else if (targetScreenId === SCREENS.SESSIONS && stage === 'exercises-returned') {
        document.body.dataset.tutorialStage = 'sessions-returned';
        setTimeout(() => showTutorialTip('openCalendarBtn', 'Now, check the Calendar.', 40), 600);
    }

    // 4. Came back from Calendar -> Sessions (TRIGGER HOME)
    else if (targetScreenId === SCREENS.SESSIONS && stage === 'calendar-visited') {
        document.body.dataset.tutorialStage = 'calendar-done';
        setTimeout(() => showTutorialTip('backToClientsBtn', 'Go back to Home.', 30, 'left'), 600);
    }

    // 5. Came back from Sessions -> Home (TRIGGER SETTINGS)
    else if (targetScreenId === SCREENS.CLIENTS && stage === 'calendar-done') {
        document.body.dataset.tutorialStage = 'home-returned';
        setTimeout(() => showTutorialTip('settingsBtn', 'Finally, tap Settings.', 45, 'right'), 600);
    }
}

// [app.js] ROBUST SETTINGS & MEMORY SYSTEM

// 1. Define the Button
const settingsBtn = document.getElementById('settingsBtn');

// 2. Define the Exit Helper
function exitSettingsScreen() {
    // Safety Fallback: If memory is empty, go Home (Clients)
    if (!lastActiveScreen || lastActiveScreen === SCREENS.SETTINGS) {
        lastActiveScreen = SCREENS.CLIENTS;
    }

    // A. Animate Gear Backwards (Visual Feedback)
    if (settingsBtn) {
        // Reset animation class to allow re-triggering
        settingsBtn.classList.remove('gear-roll-back');
        void settingsBtn.offsetWidth; // Force Reflow
        settingsBtn.classList.add('gear-roll-back');
        
        // Cleanup class after animation
        setTimeout(() => {
            settingsBtn.classList.remove('gear-roll-back');
        }, 400);
    }

    // B. Navigate Back
    console.log("Exiting Settings -> Going to:", lastActiveScreen);
    navigateTo(lastActiveScreen, 'back');
}

// 3. Main Gear Button Logic
if (settingsBtn) {
    settingsBtn.onclick = () => {
        // SCENARIO A: We are ALREADY in Settings -> Exit
        if (currentScreen === SCREENS.SETTINGS) {
            exitSettingsScreen();
            return;
        }

        // SCENARIO B: We are OUTSIDE Settings -> Enter
        
        // 1. Capture Memory (Only if we aren't already in Settings)
        if (currentScreen !== SCREENS.SETTINGS) {
            console.log("Saving Memory State:", currentScreen);
            lastActiveScreen = currentScreen;
        }

        // 2. Go to Settings
        navigateTo(SCREENS.SETTINGS, 'forward');

        // 3. Tutorial Logic (Keep existing functionality)
        if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
            settingsBtn.classList.add('hidden'); 
            
            const editBtn = document.getElementById('editToggleBtn');
            if(editBtn) editBtn.classList.add('hidden');

            const endBtn = document.getElementById('endTutorialBtn');
            if (endBtn) {
                endBtn.classList.remove('hidden');
                endBtn.classList.add('flash-active');
            }

            // Tutorial Tips
            setTimeout(() => {
                if(typeof showTutorialTip === 'function') {
                    showTutorialTip('settingUnitToggle', 'Toggle between Lbs and Kg here.', 40);
                    setTimeout(() => {
                         showTutorialTip('endTutorialBtn', 'You are all set! Tap here to finish.', 40, 'right');
                    }, 3000); 
                }
            }, 500);
        }
    };
}

// 4. Update the "Back" Arrow inside Settings to use the same logic
const backFromSettingsBtn = document.getElementById('backToClientsFromSettingsBtn');
if (backFromSettingsBtn) {
    backFromSettingsBtn.onclick = () => {
        exitSettingsScreen();
    };
}

// 3. Logout Action (Inside Settings)
document.getElementById('settingsLogoutBtn').onclick = async () => {
    try {
        sendHapticScoreToNative(-2); // <--- ADD THIS (Switch Off)
        // Just Sign Out. The auth.onAuthStateChanged listener will handle 
        // hiding Settings and showing the Login Modal/Home screen.
        await auth.signOut();
    } catch (err) {
        console.error("Logout failed", err);
    }
};

// ------------------ AUTH ------------------
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");
const clientList = document.getElementById("clientList");
const modal = document.getElementById("loginModal");
const modalLoginBtn = document.getElementById("modalLoginBtn");
const modalAppleBtn = document.getElementById("modalAppleBtn");

const deleteModal = document.getElementById('deleteModal');
const deleteModalMessage = document.getElementById('deleteModalMessage');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');

auth.onAuthStateChanged(async (user) => {
  if (user) {
      // alert("DEBUG: User detected: " + user.email); // Uncomment if you need to prove it works
    // 1. LOGGED IN STATE
      sendHapticScoreToNative(-4); // <--- ADD THIS LINE (Success Pulse)
    if (typeof modal !== 'undefined') modal.classList.add("hidden");
    
    // --- FIX: Force UI Elements to Appear for Real Users ---
    const settingsBtn = document.getElementById('settingsBtn'); 
    const editToggleBtn = document.getElementById('editToggleBtn');
    
    if (settingsBtn) settingsBtn.classList.remove("hidden");
    if (editToggleBtn) editToggleBtn.classList.remove("hidden");
    
    if (userLabel) userLabel.textContent = `Logged in as ${user.displayName}`;
    
    // 2. FORCE RESET UI
    hideAllDetails(); 

    // 3. LOAD & RENDER DATA
    await loadUserJson();
    renderClients();

  } else {
    // 4. LOGGED OUT STATE
    // Only hide UI if we are NOT in tutorial mode
      // alert("DEBUG: No user found."); // Uncomment if you suspect it's failing silently
    if (!isTutorialMode) {
        if (typeof modal !== 'undefined') modal.classList.remove("hidden");
        
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.classList.add("hidden");
        
        const editToggleBtn = document.getElementById('editToggleBtn');
        if (editToggleBtn) editToggleBtn.classList.add("hidden");
    }
    
    if (userLabel) userLabel.textContent = "";
    clientsData = {};
    selectedClient = null;
    
    // Clear UI completely
    renderClients();
    hideAllDetails();
  }
});

// [app.js] Add this AFTER auth.onAuthStateChanged closes
auth.getRedirectResult().then((result) => {
  if (result.user) {
    console.log("Redirect login successful:", result.user);
  }
}).catch((error) => {
  console.error("Redirect login failed:", error);
  if (error.code === 'auth/unauthorized-domain') {
      alert("Configuration Error: You must add 'trunktracker.app' to the Authorized Domains list in the Firebase Console.");
  } else {
      alert("Login Error: " + error.message);
  }
});

// [app.js] Revert to Popup (Now safe for iOS)
// [app.js] Standard Popup Login
modalLoginBtn.onclick = async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    // We use standard Popup. The iOS App will now handle this 
    // by opening a temporary "Modal Layer" WebView.
    await auth.signInWithPopup(provider);
    
  } catch (err) {
    console.error("Login Error:", err);
    alert("Login failed: " + err.message);
  }
};
if (logoutBtn) {
    logoutBtn.onclick = async () => { 
        try {
            sendHapticScoreToNative(-2); // <--- ADD THIS (Switch Off)
            await auth.signOut(); 
        } catch(err) {
            console.error("Logout error:", err);
        }
    };
}

// [app.js] Apple Sign In Logic
if (modalAppleBtn) {
  modalAppleBtn.onclick = async () => {
    try {
      // 1. Setup the provider
      const provider = new firebase.auth.OAuthProvider('apple.com');
      
      // 2. Request name and email scopes (Apple only returns these on the very first login)
      provider.addScope('email');
      provider.addScope('name');
      
      // 3. Optional: Localize the flow to the user's browser language
      provider.setCustomParameters({
        locale: navigator.language || 'en'
      });

      // 4. Trigger the popup (handles iOS modal automatically via Firebase SDK)
      await auth.signInWithPopup(provider);
      
    } catch (err) {
      console.error("Apple Login Error:", err);
      // Friendly error handling
      if (err.code === 'auth/popup-closed-by-user') {
        // User just closed the popup, no need to alert
        return;
      }
      alert("Sign In with Apple failed: " + err.message);
    }
  };
}
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
  clientsData = {}; // Clear memory

  try {
      // 1. CHECK NEW SYSTEM FIRST (users/{uid}/clients)
      const newCollectionRef = db.collection("users").doc(uid).collection("clients");
      const newSnap = await newCollectionRef.get();

      if (!newSnap.empty) {
          console.log("Loaded data from optimized system.");
          newSnap.forEach(doc => {
              let clientObj = doc.data();
              // HYDRATE (Safety Check)
              if (typeof expandClientData === "function") {
                  clientObj = expandClientData(clientObj);
              }
              if (clientObj.order === undefined) clientObj.order = 999;
              clientsData[clientObj.client_name] = clientObj;
          });
      } 
      else { 
          // 2. CHECK LEGACY SYSTEM (clients/{uid})
          console.log("New system empty. Checking legacy...");
          const oldDocRef = db.collection("clients").doc(uid);
          const oldDocSnap = await oldDocRef.get();

          if (oldDocSnap.exists) {
              clientsData = oldDocSnap.data();
              
              // --- FIX: Run Safety Check on Legacy Data too ---
              Object.keys(clientsData).forEach(key => {
                  if (typeof expandClientData === "function") {
                      clientsData[key] = expandClientData(clientsData[key]);
                  }
                  if (clientsData[key].order === undefined) clientsData[key].order = 999;
              });
              // ------------------------------------------------

              console.log("Legacy data loaded.");
          } else {
              // 3. BRAND NEW USER
              console.log("No data found. Creating default profile...");
              const fullName = auth.currentUser.displayName || "User";
              const firstName = fullName.split(' ')[0];
              
              clientsData = {
                  [firstName]: {
                      client_name: firstName,
                      sessions: [],
                      order: 0
                  }
              };
              await saveUserJson();
          }
      }
      renderClients();
  } catch (err) {
      console.error("Error loading user data:", err);
      alert("Error loading data. Check console.");
  }
}

async function saveUserJson() {
  if (isTutorialMode) return;
  if (!auth.currentUser) return;
  
  const uid = auth.currentUser.uid;
  const batch = db.batch();
  const profilesRef = db.collection("users").doc(uid).collection("clients");

  // Loop through all clients in memory
  Object.values(clientsData).forEach(clientObj => {
      // 1. Optimize (Strip ColorData, Compress Sets)
      const optimizedData = cleanAndMinifyClient(clientObj);
      
      // 2. Queue Update
      const docRef = profilesRef.doc(clientObj.client_name);
      batch.set(docRef, optimizedData);
  });

  // 3. Commit all writes at once
  try {
      await batch.commit();
  } catch (err) {
      console.error("Save failed:", err);
  }
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
        sendHapticScoreToNative(-3); // <--- ADD THIS LINE (Mechanical Tick)
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

// =====================================================
// CUSTOM INPUT MODAL ENGINE (Native Replacement)
// =====================================================
const customInputModal = document.getElementById('customInputModal');
const customInputTitle = document.getElementById('customInputTitle');
const customInputField = document.getElementById('customInputField');
const customInputCount = document.getElementById('customInputCount');
const customInputSave = document.getElementById('customInputSave');
const customInputCancel = document.getElementById('customInputCancel');

let currentInputResolve = null; // Stores the Promise resolve function

// [app.js] showInputModal (With 0.5s Delay)
function showInputModal(title, initialValue = "", placeholder = "", type = "text") {
  return new Promise((resolve) => {
    currentInputResolve = resolve; 
    
    // 1. CAPTURE STABLE HEIGHT (Immediately)
    stableWindowHeight = window.innerHeight;

    // 2. Setup Keyboard Type
    if (type === 'number') {
        customInputField.setAttribute('inputmode', 'decimal'); 
        customInputField.setAttribute('type', 'number');
    } else {
        customInputField.setAttribute('inputmode', 'text');
        customInputField.setAttribute('type', 'text');
    }

    // 3. Setup Content
    customInputTitle.textContent = title;
    customInputField.value = initialValue;
    customInputField.placeholder = placeholder;
    customInputCount.textContent = `${initialValue.length}/40`;

    // 4. Force Reset Position
    const modalContainer = document.querySelector('.input-modal-card');
    if (modalContainer) {
        modalContainer.style.transform = 'scale(1) translateY(0)';
        modalContainer.style.animation = 'none'; 
        modalContainer.offsetHeight; /* trigger reflow */
        modalContainer.style.animation = 'modal-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
    }

    // 5. Show Modal
    customInputModal.classList.remove('hidden');
    
    // 6. DELAYED FOCUS (The 0.5s wait)
    // We wait 500ms for the modal animation to finish, THEN trigger keyboard.
    setTimeout(() => {
        customInputField.focus();
        
        // Select text if it exists
        if (initialValue) { try { customInputField.select(); } catch(e) {} }
        
        // Start the safety poll NOW (so we don't waste poll cycles during the wait)
        if (typeof startKeyboardPoll === 'function') startKeyboardPoll();
        
    }, 500); // <--- Half-second delay
  });
}

function closeInputModal(value) {
  customInputModal.classList.add('hidden');
  customInputField.blur(); // Hide keyboard
  
  // Clean Reset
  const modalContainer = document.querySelector('.input-modal-card');
  if (modalContainer) modalContainer.style.transform = 'scale(1) translateY(0)';

  // Resolve the promise
  if (currentInputResolve) {
      currentInputResolve(value);
      currentInputResolve = null;
  }

  // SCROLL TO TOP (Only if saved, not cancelled)
  if (value !== null) {
      setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 300); // Wait for keyboard to dismiss
  }
}


// Event Listeners for the Modal
if (customInputSave) {
    customInputSave.onclick = () => {
        const val = customInputField.value.trim();
        if (!val) {
            // Shake animation if empty?
            customInputField.parentElement.style.borderColor = 'var(--color-red)';
            setTimeout(() => customInputField.parentElement.style.borderColor = '', 500);
            return;
        }
        
        // Success Haptic
        if(typeof sendHapticScoreToNative === 'function') sendHapticScoreToNative(-4); // Success pulse
        
        // Visual Confirm
        customInputSave.classList.add('btn-save-anim');
        setTimeout(() => {
             customInputSave.classList.remove('btn-save-anim');
             closeInputModal(val);
        }, 200);
    };
}

if (customInputCancel) {
    customInputCancel.onclick = () => {
        closeInputModal(null); // Resolve with null
    };
}

// Character Count & Haptic on Type
if (customInputField) {
    customInputField.oninput = (e) => {
        const len = e.target.value.length;
        customInputCount.textContent = `${len}/40`;
        // Limit
        if (len > 40) {
            e.target.value = e.target.value.substring(0, 40);
            customInputCount.style.color = 'var(--color-red)';
        } else {
            customInputCount.style.color = '#555';
        }
    };
    
    // Enter key to save
    customInputField.onkeydown = (e) => {
        if (e.key === 'Enter') customInputSave.click();
    };
}

// ------------------ RENDER CLIENTS ------------------
function renderClients() {
    if (clientList) clientList.innerHTML = ""; // Safety check added
  let totalAppColorData = { red: 0, green: 0, yellow: 0, total: 0 };
  // Sort by the new 'order' property
  const sortedClients = Object.values(clientsData).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sortedClients.forEach((clientObj, idx) => {
    const name = clientObj.client_name;
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    const nameSpan = document.createElement("span");
    let clientColorData = { red: 0, green: 0, yellow: 0, total: 0 };
    const sessions = clientObj.sessions || [];
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
      if (editMode) { e.stopPropagation();
      return; }
      selectClient(name);
    };

    // NEW ACTIONS CONTAINER
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'edit-actions';
    
    const upBtn = document.createElement('button');
    upBtn.className = 'btn-icon btn-move';
    upBtn.innerHTML = '↑';
    upBtn.onclick = (e) => { e.stopPropagation();
    moveItem('client', idx, -1); };

    const downBtn = document.createElement('button');
    downBtn.className = 'btn-icon btn-move';
    downBtn.innerHTML = '↓';
    downBtn.onclick = (e) => { e.stopPropagation(); moveItem('client', idx, 1); };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon btn-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      showDeleteConfirm(`Are you sure you want to delete client "${name}"?`, async () => {
        sendHapticScoreToNative(-1); // <--- ADD THIS LINE (Destructive Buzz)
        // OPTIMIZED DELETE
        await deleteClientFromFirestore(name); // <--- Add this
        delete clientsData[name]; 
        saveUserJson(); 
        renderClients();
        if (selectedClient === name) navigateTo(SCREENS.CLIENTS, 'back');
      });
    };

    actionsDiv.appendChild(upBtn);
    actionsDiv.appendChild(downBtn);
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(nameSpan); 
    li.appendChild(actionsDiv);
    // APPEND DYNAMIC ARROW
    li.appendChild(createDynamicArrow(clientColorData));
    
    clientList.appendChild(li);
  });
  const clientsTitle = document.getElementById('clientsScreenTitle');
  applyTitleStyling(clientsTitle, 'Profiles', totalAppColorData);
  hookEditables();
}

document.getElementById("addClientBtn").onclick = async () => {
  const name = await showInputModal("New Profile Name", "", "e.g., Mike");
  if (!name) return;
  
  if (clientsData[name]) { alert("Client already exists."); return; }
  const newOrder = Object.keys(clientsData).length;
  clientsData[name] = { client_name: name, sessions: [], order: newOrder };
  saveUserJson(); renderClients();
};
function selectClient(name) {
  selectedClient = name;
  selectedSession = null; selectedExercise = null;
  renderSessions(); navigateTo(SCREENS.SESSIONS, 'forward');
  
  // --- TUTORIAL: Step 2 ---
  if (isTutorialMode) {
    document.body.dataset.tutorialStage = 'sessions';
    setTimeout(() => showTutorialTip('sessionList', 'Tap "Chest Day" to view your workout.', 40), 400);
  }
}

const sessionList = document.getElementById("sessionList");
function getSortedSessions(sessionsArray) {
  // REMOVED FORCED DATE SORTING TO ALLOW MANUAL ORDERING
  return sessionsArray || [];
}
document.getElementById("addSessionBtn").onclick = async () => {
  if (!selectedClient) { alert("Select a client first"); return; }
  
  const name = await showInputModal("New Session Name", "", "e.g., Push Day");
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
        sendHapticScoreToNative(-1); // <--- ADD THIS LINE (Destructive Buzz)
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

  // --- TUTORIAL: Step 3 ---
  if (isTutorialMode) {
    document.body.dataset.tutorialStage = 'exercises';
    setTimeout(() => showTutorialTip('exerciseList', 'Tap "Bench Press" to see the data.', 40), 400);
  }
}

const exerciseList = document.getElementById("exerciseList");
document.getElementById("addExerciseBtn").onclick = async () => {
  if (!selectedSession) { alert("Select a session first"); return; }
  
  const name = await showInputModal("New Exercise", "", "e.g., Bench Press");
  if (!name) return;

  // NEW: Character Limit Check (Redundant now due to modal limit, but good safety)
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
        sendHapticScoreToNative(-1); // <--- ADD THIS LINE (Destructive Buzz)
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

function selectExercise(idx) {
  selectedExercise = selectedSession.exercises[idx];
  renderSets(); navigateTo(SCREENS.SETS, 'forward');
  document.getElementById("graphContainer").classList.add("hidden");

  // --- TUTORIAL: Step 4 (The Hub) ---
  if (isTutorialMode) {
    document.body.dataset.tutorialStage = 'sets-view';
    if (tutorialTimer) clearTimeout(tutorialTimer);
    
    // Sequence: Recap -> Banner -> Add Set
    tutorialTimer = setTimeout(() => {
       showTutorialTip('smartRecapBox', '1. This summary analyzes your progress!', 20);
       
       tutorialTimer = setTimeout(() => {
          showTutorialTip('comparisonBanner', '2. This banner compares today vs. your last session.', 10);
          
          tutorialTimer = setTimeout(() => {
             showTutorialTip('addSetBtn', '3. Now, tap here to log a new set.', -10);
          }, 4000); 
       }, 4000);
    }, 500);
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
// [app.js] REPLACE handleSliderMove
const handleSliderMove = (e) => {
    const val = parseFloat(e.target.value);
    const len = (val / 100) * spiralState.totalLen;
    updateBallToLen(len);

    // --- TUTORIAL LOGIC ---
    // We check specifically for the stage set in finishAddSet
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode && document.body.dataset.tutorialStage === "waiting-for-slider") {
        
        // Only trigger if you actually moved it somewhat (less than 98%)
        if (val < 98) {
            // 1. Advance the stage immediately so this doesn't fire 100 times while dragging
            document.body.dataset.tutorialStage = 'slider-done';
            clearTutorialTips();

            // 2. Wait a moment, then scroll up and point to graph
            setTimeout(() => {
                // Scroll the SETS SCREEN to the top
                const setsScreen = document.getElementById('setsDiv');
                if (setsScreen) setsScreen.scrollTo({ top: 0, behavior: 'smooth' });
                
                // Point to the Graph button
                setTimeout(() => {
                    showTutorialTip('showGraphBtn', 'Tap "Show Graph" to see details.', 20);
                }, 600); // Small delay after scroll starts
            }, 1000);
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

// 1. NEW: Instantly hide timer to prevent "ghost" of previous exercise
  document.getElementById('restTimer').classList.add('hidden');
  
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
        const dispWeight = UNIT_mode.toDisplay(s.weight);
        const dispVol = UNIT_mode.toDisplay(s.volume);
        const uLabel = UNIT_mode.getLabel(); 
        const currentNotes = s.notes || ""; // Grab notes early for preview
        
      summary.className = "set-summary";
        summary.innerHTML = `
        <div class="set-index-badge">${setIdx + 1}</div>
        
        <div class="set-main-data">
          <span class="set-reps-val">${s.reps}</span>
          <span class="set-x">x</span>
          <span class="set-weight-val">${dispWeight}<span style="font-size:0.7em; margin-left:2px;">${uLabel}</span></span>
        </div>

        <div class="set-note-preview">
           ${currentNotes ? '"' + currentNotes + '"' : ''}
        </div>

        <div class="set-meta-data">
          <span class="set-vol">${Math.round(dispVol).toLocaleString()} ${uLabel}</span>
          <span class="set-date">${dateStr}</span>
        </div>
      `;

      const details = document.createElement("div");
      details.className = "set-details";
      
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

      // 1. Live Character Count
      noteInput.addEventListener("input", (e) => { 
          charCount.textContent = `${e.target.value.length}/40`; 
      });

      // 2. Define the Save & Cleanup Action
      const finishEditing = () => {
          const val = noteInput.value.trim();

          // A. Save to Data
          selectedExercise.sets[originalIndex].notes = val;
          saveUserJson();

          // B. SURGICAL UPDATE: Update the preview text immediately!
          const previewEl = summary.querySelector(".set-note-preview");
          if (previewEl) {
              previewEl.textContent = val ? '"' + val + '"' : '';
          }

          // C. Reset Viewport (Fixes the "Website Mode" bug)
          setTimeout(() => {
              window.scrollTo(0, 0); 
          }, 100);
      };

      // 3. Trigger on "Done" (Blur event)
      noteInput.addEventListener("change", finishEditing);

      // 4. Trigger on "Return" key
      noteInput.addEventListener("keydown", (e) => {
          if (e.key === 'Enter') {
              e.preventDefault(); 
              noteInput.blur(); // Triggers 'change' -> runs finishEditing()
          }
      });

      // --- LOGIC: Delete ---
      const delBtn = details.querySelector(".btn-delete-set");
      delBtn.onclick = (e) => {
         e.stopPropagation();
         showDeleteConfirm(`Delete Set ${setIdx + 1} from ${dateStr}?`, () => {
             sendHapticScoreToNative(-1); // <--- ADD THIS LINE (Destructive Buzz)
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

    // NEW HOOK:
  if(typeof generateSmartRecap === 'function') generateSmartRecap();
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

function drawChart() {
    // 1. STOP OLD LEAVES when redrawing
    stopLeafSpawner();
    
    // 2. GET DATA
    chartState.dataPoints = getChartData();
    const points = chartState.dataPoints;

    // --- NEW: UPDATE UNIT LABELS ---
    // This forces the "lb/r" text to become "kg/r" immediately
    const unitLabel = UNIT_mode.getLabel(); // 'kg' or 'lbs'
    document.querySelectorAll('.unit').forEach(el => {
        // We check if the unit is for W/R (contains '/r') or Volume
        if (el.previousElementSibling && el.previousElementSibling.classList.contains('wpr')) {
            el.textContent = `${unitLabel}/r`; 
        } else if (el.previousElementSibling && el.previousElementSibling.classList.contains('vol')) {
            el.textContent = unitLabel;
        }
    });
    // -------------------------------

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

    // 3. START LEAVES AFTER DELAY
    setTimeout(() => {
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
    // --- TUTORIAL: Step 8 (Touch Graph -> Go Back) ---
    if (isTutorialMode) {
        clearTutorialTips();
        // Set stage to 'graph-touched' so the back button logic knows what to do
        document.body.dataset.tutorialStage = 'graph-touched';
        
        // Point to the specific Back button on the Graph screen
        setTimeout(() => {
             showTutorialTip('backToSetsFromGraphBtn', 'Press here to return.', 30, 'left');
        }, 1000);
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

    // --- UNIT CONVERSION APPLIED HERE ---
    // 1. Reps and Sets don't change
    document.getElementById('headerReps').textContent = raw.reps;
    document.getElementById('headerSets').textContent = raw.sets;
    
    // 2. Volume and W/R need conversion from LBS -> KG/LBS
    const dispWpr = UNIT_mode.toDisplay(raw.wpr);
    const dispVol = UNIT_mode.toDisplay(raw.vol);

    // 3. Rounding for clean UI
    document.getElementById('headerWpr').textContent = formatNum(dispWpr);
    document.getElementById('headerVol').textContent = Math.round(dispVol).toLocaleString(); // Int for volume
    // ------------------------------------

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
  
  // 1. Safely hide all screens (Check if element exists first!)
  Object.values(SCREENS).forEach(screenId => { 
      const el = document.getElementById(screenId);
      if (el) el.classList.add('hidden'); 
  });

  // 2. Force show Clients (Home)
  const clientsDiv = document.getElementById(SCREENS.CLIENTS);
  if (clientsDiv) clientsDiv.classList.remove('hidden');
  
  currentScreen = SCREENS.CLIENTS;
  
  const graphDiv = document.getElementById("graphDiv");
  if (graphDiv) graphDiv.innerHTML = "";
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

function updateStatUI(statName, currentValueLBS, previousValueLBS) {
  const arrowEl = document.getElementById(statName + 'Arrow');
  const spiralEl = document.getElementById(statName + 'Spiral');
  const dataEl = document.getElementById(statName + 'Data');
  
  if (!arrowEl || !dataEl) return 'neutral';
  
  // 1. CALCULATE STATUS (Using Base Unit LBS)
  const status = calculateStatStatus(currentValueLBS, previousValueLBS);

  // 2. RESTORE ARROWS (Fixing the blank arrow issue)
  let arrow = '—';
  if (status === 'increase') arrow = '↑';
  else if (status === 'decrease') arrow = '↓'; 

  // 3. CONVERT FOR DISPLAY
  const isWeightMetric = (statName === 'volume' || statName === 'wpr');
  
  const displayCurrent = isWeightMetric 
      ? UNIT_mode.toDisplay(currentValueLBS) 
      : currentValueLBS;

  const diffLBS = currentValueLBS - previousValueLBS;
  const displayDiff = isWeightMetric
      ? UNIT_mode.toDisplay(diffLBS)
      : diffLBS;

  // 4. CALCULATE PERCENTAGE
  let percentageChange = 0;
  if (previousValueLBS !== 0) {
      percentageChange = (diffLBS / previousValueLBS) * 100;
  } else if (currentValueLBS > 0) {
      percentageChange = 100;
  }

  // 5. FORMAT STRINGS
  const unitLabel = UNIT_mode.getLabel(); // 'kg' or 'lbs'
  const changeSign = displayDiff > 0 ? '+' : '';
  
  let currentString = '';
  switch(statName) {
    case 'sets': 
        currentString = `${formatNum(displayCurrent)} Sets`; 
        break;
    case 'reps': 
        currentString = `${formatNum(displayCurrent)} Reps`; 
        break;
    case 'volume': 
        // Readable volume (e.g. "1,200")
        currentString = `${Math.round(displayCurrent).toLocaleString()} ${unitLabel}`; 
        break;
    case 'wpr': 
        currentString = `${formatNum(displayCurrent)} ${unitLabel}/r`; 
        break;
  }
  
  let changeString = `(${changeSign}${formatNum(displayDiff)} / ${changeSign}${Math.abs(percentageChange).toFixed(0)}%)`;
  if (status === 'neutral') changeString = `(0 / 0%)`;

  // 6. APPLY TO DOM
  const classesToRemove = ['increase', 'decrease', 'neutral'];
  
  // Apply Arrow
  arrowEl.innerHTML = arrow; 
  arrowEl.classList.remove(...classesToRemove); 
  arrowEl.classList.add(status);
  
  // Apply Spiral Color (if exists)
  if(spiralEl) { 
      spiralEl.classList.remove(...classesToRemove);
      void spiralEl.offsetWidth; // Force Reflow
      spiralEl.classList.add(status);
  }
  
  // Apply Text Data
  const fullText = `${currentString} ${changeString}`;
  dataEl.textContent = fullText;
  dataEl.classList.remove(...classesToRemove); 
  dataEl.classList.add(status);

  // 7. SMART FIT SYSTEM
  // Reset styles
  dataEl.style.fontSize = "";
  dataEl.style.whiteSpace = "nowrap"; 
  dataEl.style.lineHeight = "";
  dataEl.style.maxWidth = "";
  dataEl.style.display = "";
  dataEl.style.textAlign = "";
  dataEl.style.marginLeft = "";
  
  // Check length (Trigger shrink if > 29 chars)
  if (fullText.length > 29) {
      dataEl.style.fontSize = "0.75rem";
      dataEl.style.whiteSpace = "normal";
      dataEl.style.lineHeight = "1.2";
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
    sendHapticScoreToNative(-2); // <--- ADD THIS LINE (Toggle Click)
  editMode = !editMode;
  editToggleBtn.textContent = editMode ? "Done" : "Edit";
  document.body.classList.toggle('edit-mode-active');
  if (!editMode) saveUserJson();
};

// [app.js] Fix for the "Edit" glitch
function exitEditMode() {
  editMode = false;
  
  const btn = document.getElementById("editToggleBtn");
  if (btn) btn.textContent = "Edit";
  
  document.body.classList.remove('edit-mode-active');
  
  // Note: We do NOT call saveUserJson() here because 
  // makeEditable() calls it explicitly right before this function.
}

function makeEditable(element, type, parentIdx, sortedSets) {
  element.classList.add("editable");
  element.style.cursor = "pointer";
  
  // Need async listener
  element.addEventListener("click", async (e) => {
    if (!editMode) return;
    e.stopPropagation();
    
    // Sanitize text
    const rawText = element.textContent;
    const currentVal = rawText.replace(/\u00A0/g, ' '); 

    // Determine Input Type (Number vs Text)
    const isNumeric = (type.includes('Reps') || type.includes('Weight'));
    const inputType = isNumeric ? 'number' : 'text';

    // --- USE CUSTOM MODAL INSTEAD OF PROMPT ---
    const newVal = await showInputModal(`Edit ${type}`, currentVal, "", inputType);
    
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
            await deleteClientFromFirestore(currentVal);
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
            if (newVal.length > 41) {
                alert("Name too long."); return;
            }
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
        const userVal = parseFloat(newVal);
        if (!isNaN(userVal)) {
            const storageVal = UNIT_mode.toStorage(userVal);
            selectedExercise.sets[originalIndex].weight = storageVal;
            selectedExercise.sets[originalIndex].volume = selectedExercise.sets[originalIndex].reps * storageVal;
            renderSets();
        }
        break;
      case "Set Notes":
        selectedExercise.sets[originalIndex].notes = newVal;
        renderSets(); 
        break;
    }
    saveUserJson();
    if (typeof exitEditMode === 'function') {
        exitEditMode(); 
    } else {
        console.error("exitEditMode missing"); // Safety fallback
    }
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

// function initInstallPrompt() {
//     // 0. NATIVE APP CHECK (The "Identity Card")
//     // If we see our secret flag, stop immediately. No prompt.
//     if (navigator.userAgent.includes("TrunkNativeApp")) return;

//     // 1. NEW: Check if running inside the iOS App Wrapper
//     const urlParams = new URLSearchParams(window.location.search);
//     if (urlParams.get('source') === 'ios') return;
//     // 1. Check if already installed (Standalone mode)
//     const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
//     if (isStandalone) return;

//     // 2. Check LocalStorage (Has user seen this?)
//     const hasSeenPrompt = localStorage.getItem('trunk_install_prompt_seen');
//     if (hasSeenPrompt) return;

//     // 3. Detect OS
//     const userAgent = navigator.userAgent || navigator.vendor || window.opera;
//     const promptEl = document.getElementById('installPrompt');
//     const textEl = document.getElementById('installText');
//     const closeBtn = document.getElementById('closeInstallBtn');

//     if (!promptEl) return;

//     // IOS DETECTION
//     if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
//         promptEl.classList.remove('hidden');
//         promptEl.classList.add('ios-pos');
//         textEl.textContent = "Install as App:\n1. Tap the menu dots (...), then tap share button below\n2. Scroll down\n3. Tap 'Add to Home Screen'";
//     } 
//     // ANDROID DETECTION
//     else if (/android/i.test(userAgent)) {
//         promptEl.classList.remove('hidden');
//         promptEl.classList.add('android-pos');
//         textEl.textContent = "Install as App:\n1. Tap the menu dots (⋮)\n2. Tap 'Install App' or 'Add to Home Screen'";
//     }
//     // If neither (Desktop/Other), do nothing.

//     // 4. Close Logic
//     closeBtn.onclick = () => {
//         promptEl.classList.add('hidden');
//         // Mark as seen so it never shows again
//         localStorage.setItem('trunk_install_prompt_seen', 'true');
//     };
// }

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

// [app.js] UPDATED CALCULATOR MODAL OPENER
function openAddSetModal() {
  if (typeof clearTutorialTips === 'function') clearTutorialTips();

  // Reset State
  calcState = { 
      activeField: 'reps', repsVal: '', weightVal: '', 
      plates: {}, plateStack: [], isAutoFilled: { reps: false, weight: false } 
  };

  // 1. Update Label
  const wBoxLabel = document.querySelector('#weightBox .field-label');
  if (wBoxLabel && typeof UNIT_mode !== 'undefined') {
      wBoxLabel.textContent = `WEIGHT (${UNIT_mode.getLabel().toUpperCase()})`;
  }

  // 2. Generate Plates (Metric vs Imperial Logic)
  const plateGrid = document.getElementById('plateGrid');
  if (plateGrid) {
      plateGrid.innerHTML = '';
      const plates = (typeof UNIT_mode !== 'undefined' && UNIT_mode.current === 'lbs')
          ? [2.5, 5, 10, 25, 35, 45] 
          : [1.25, 2.5, 5, 10, 15, 20]; 

      plates.forEach(p => {
          const btn = document.createElement('button');
          btn.className = p < 10 ? 'plate-btn small' : 'plate-btn';
          btn.dataset.weight = p;
          // Note: added class 'plate-badge' for easier targeting
          btn.innerHTML = `${p}<span class="plate-count hidden plate-badge">x0</span>`;
          
          btn.onclick = (e) => {
                calcState.activeField = 'weight';
                if (typeof checkAndClearAutoFill === 'function') checkAndClearAutoFill();
                
                const weight = parseFloat(btn.dataset.weight);
                if (!calcState.plates[weight]) calcState.plates[weight] = 0;
                calcState.plates[weight]++;
                
                let currentWeight = parseFloat(calcState.weightVal) || 0;
                currentWeight += weight;
                currentWeight = Math.round(currentWeight * 100) / 100; 

                calcState.weightVal = currentWeight.toString();
                calcState.plateStack.push(weight);
                updateCalcUI();
                updatePlateBadges(); // <--- Helper Function
          };
          plateGrid.appendChild(btn);
      });
  }

  // 3. Auto-Fill Logic (NOW WITH PLATES!)
  if (typeof getLastSet === 'function') {
      const lastSet = getLastSet();
      if (lastSet) {
          calcState.repsVal = String(lastSet.reps);
          if (typeof UNIT_mode !== 'undefined') {
             calcState.weightVal = String(UNIT_mode.toDisplay(lastSet.weight));
          }
          calcState.isAutoFilled.reps = true;
          calcState.isAutoFilled.weight = true;

          // --- RESTORE PLATES ---
          if (lastSet.plates) {
              calcState.plates = JSON.parse(JSON.stringify(lastSet.plates)); // Deep copy
              
              // Rebuild the 'plateStack' so "Backspace" works correctly
              // We push them in arbitrary order since we don't save order, only counts.
              calcState.plateStack = [];
              for (const [wStr, count] of Object.entries(calcState.plates)) {
                  const w = parseFloat(wStr);
                  for(let i=0; i<count; i++) {
                      calcState.plateStack.push(w);
                  }
              }
          }
          // ----------------------
      }
  }

  updateCalcUI();
  updatePlateBadges(); // Ensure badges appear immediately
  if(addSetModal) addSetModal.classList.remove('hidden');
}

// NEW HELPER: Centralized Badge Updater
function updatePlateBadges() {
    const plateGrid = document.getElementById('plateGrid');
    if (!plateGrid) return;
    
    // Loop through buttons and check calcState
    const btns = plateGrid.querySelectorAll('.plate-btn');
    btns.forEach(btn => {
        const w = parseFloat(btn.dataset.weight);
        const count = calcState.plates[w] || 0;
        const badge = btn.querySelector('.plate-count');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = `x${count}`;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    });
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
// =====================================================
// TIMER SETTINGS ENGINE (Fully Restored & Robust)
// =====================================================
const timerSettingsModal = document.getElementById('timerSettingsModal');
const timerSettingsList = document.getElementById('timerSettingsList');
const openTimerSettingsBtn = document.getElementById('openTimerSettingsBtn');
const KEY_TIMER_CONFIG = 'trunk_timer_config';

// 1. DEFAULT CONFIG
let activeTimerConfig = [
    { seconds: 60, label: '1:00', isActive: true },
    { seconds: 180, label: '3:00', isActive: true },
    { seconds: 600, label: '10:00', isActive: true }
];

// 2. LOAD CONFIG
function loadTimerConfig() {
    const saved = localStorage.getItem(KEY_TIMER_CONFIG);
    if (saved) {
        try { activeTimerConfig = JSON.parse(saved); } catch (e) {}
    }
}

// 3. HELPER: PARSE INPUT ("1:30" -> 90)
// This is the magic function that was missing!
function parseTimeInput(str) {
    // Remove anything that isn't a number or colon
    const clean = str.replace(/[^0-9:]/g, '');
    
    if (clean.includes(':')) {
        // Handle "MM:SS" format
        const parts = clean.split(':');
        const m = parseInt(parts[0]) || 0;
        const s = parseInt(parts[1]) || 0;
        return (m * 60) + s;
    } else {
        // Handle raw seconds (e.g. "90")
        return parseInt(clean) || 0;
    }
}
// REPLACE your existing renderTimerSettings function with this:
function renderTimerSettings() {
    if (!timerSettingsList) return;
    timerSettingsList.innerHTML = '';
    
    activeTimerConfig.forEach((timer, index) => {
        const row = document.createElement('div');
        row.className = 'timer-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.marginBottom = '12px';
        row.style.padding = '10px';
        row.style.background = 'var(--color-bg)';
        row.style.borderRadius = '8px';

        // A. Toggle Switch
        const switchContainer = document.createElement('label');
        switchContainer.className = 'switch';
        switchContainer.style.marginRight = '12px';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = timer.isActive;
        input.onchange = (e) => {
            activeTimerConfig[index].isActive = e.target.checked;
            saveTimerConfig();
            if(typeof sendHapticScoreToNative === 'function') sendHapticScoreToNative(-2);
        };
        
        const slider = document.createElement('span');
        slider.className = 'slider round';
        switchContainer.appendChild(input);
        switchContainer.appendChild(slider);

        // B. Time Button (THIS IS THE UPDATED PART)
        const timeBtn = document.createElement('button');
        timeBtn.className = 'btn btn-secondary';
        timeBtn.style.marginRight = '12px';
        timeBtn.style.minWidth = '80px';
        
        // Format display (e.g., 1:30)
        const m = Math.floor(timer.seconds / 60);
        const s = timer.seconds % 60;
        const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
        timeBtn.textContent = timeStr;
        
        // --- NEW INTEGRATION START ---
        timeBtn.onclick = () => {
            // 1. Pass current time string to the Picker
            const currentM = Math.floor(timer.seconds / 60);
            const currentS = timer.seconds % 60;
            const currentStr = `${currentM}:${currentS.toString().padStart(2, '0')}`;

            // 2. Open the Wheel/Keypad Picker
            TimerPicker.open(currentStr, (newVal) => {
                // 3. Handle the 'Save' callback
                // Reuse your existing helper to convert "MM:SS" -> seconds
                const newSecs = parseTimeInput(newVal); 

                if (newSecs > 0) {
                    activeTimerConfig[index].seconds = newSecs;
                    // Update the label property too
                    activeTimerConfig[index].label = `${Math.floor(newSecs/60)}:${(newSecs%60).toString().padStart(2,'0')}`;
                    
                    saveTimerConfig();
                    renderTimerSettings(); // Re-render to show changes
                }
            });
        };
        // --- NEW INTEGRATION END ---

        // C. Label
        const label = document.createElement('div');
        label.style.fontWeight = '600';
        label.style.fontSize = '0.9rem';
        label.style.color = 'var(--color-text-muted)';
        label.textContent = timer.label || `Timer ${index + 1}`;

        // Assemble
        const leftGroup = document.createElement('div');
        leftGroup.style.display = 'flex';
        leftGroup.style.alignItems = 'center';
        leftGroup.appendChild(switchContainer);
        leftGroup.appendChild(timeBtn);

        row.appendChild(leftGroup);
        row.appendChild(label);
        
        timerSettingsList.appendChild(row);
    });
}

// 5. SAVE HELPER
function saveTimerConfig() {
    localStorage.setItem(KEY_TIMER_CONFIG, JSON.stringify(activeTimerConfig));
}

// 6. OPEN BUTTON
if (openTimerSettingsBtn) {
    openTimerSettingsBtn.onclick = () => {
        loadTimerConfig();
        renderTimerSettings();
        if (timerSettingsModal) {
            timerSettingsModal.classList.remove('hidden');
            timerSettingsModal.style.zIndex = "10002"; 
        }
    };
}

// 7. CLOSE LOGIC (Background Click)
if (timerSettingsModal) {
    timerSettingsModal.onclick = (e) => {
        if (e.target === timerSettingsModal) {
            timerSettingsModal.classList.add('hidden');
        }
    };
}

// 8. CLOSE BUTTON (The "Done" Button)
const closeTimerSettingsBtn = document.getElementById('closeTimerSettingsBtn');
if (closeTimerSettingsBtn) {
    closeTimerSettingsBtn.onclick = () => {
        timerSettingsModal.classList.add('hidden');
    };
}

// Initialize
loadTimerConfig();

// =====================================================
// MASTER TIMER ENGINE (Global + Local)
// =====================================================

// Single source of truth for the Header Timer
const KEY_GLOBAL_TIMER = "trunk_last_active_timer";
const TIMER_LIMIT_MS = 1800000; // 30 Minutes

let masterTimerInterval = null;
let foregroundHapticTimeouts = []; // Stores IDs for 1m, 3m, 10m haptics

// 1. TRIGGER (Only called when user actively saves a new set)
function startRestTimer(reset = false) {
    // DEBUG LOG 1: Did the function even start?
    console.log("🔎 JS DEBUG: startRestTimer called. Reset is: " + reset);

    if (!selectedExercise) {
        console.log("❌ JS DEBUG: No selectedExercise, cancelling.");
        return;
    }

    if (reset) {
        console.log("🔎 JS DEBUG: Inside Reset Block. Attempting to contact Native...");
        
        // ... (Your existing local storage code) ...
        const now = Date.now();
        const localKey = `restTimer_${selectedExercise.exercise}`;
        localStorage.setItem(localKey, now);
        
        const globalData = { time: now, label: selectedExercise.exercise };
        localStorage.setItem(KEY_GLOBAL_TIMER, JSON.stringify(globalData));
        
        masterClockTick();

        // ---------------------------------------------------------
        // D. TRIGGER HAPTICS & NOTIFICATIONS (Fixed Bridge)
        // ---------------------------------------------------------
        
        // 1. Prepare Data
        const timerBatches = activeTimerConfig
            .filter(t => t.isActive)
            .map(t => ({
                seconds: parseFloat(t.seconds),
                title: "Rest Timer",
                body: `${Math.floor(t.seconds/60)}m ${t.seconds%60}s Rest`
            }));

        // 2. Send to Native (THE FIX)
        if (window.webkit && window.webkit.messageHandlers.notificationHandler) {
            
            // Swift expects this EXACT structure:
            const payload = {
                command: "schedule", // <--- Matches line 121 in ViewController
                batches: timerBatches // <--- Matches line 122 in ViewController
            };
            
            console.log("🚀 JS Sending Payload:", payload);
            window.webkit.messageHandlers.notificationHandler.postMessage(payload);
            
        } else {
            console.log("❌ Native bridge not found");
        }

        // 3. Schedule JS Foreground Haptics
        foregroundHapticTimeouts.forEach(id => clearTimeout(id));
        foregroundHapticTimeouts = [];
        
        activeTimerConfig.forEach(t => {
            if (t.isActive) {
                const ms = t.seconds * 1000;
                foregroundHapticTimeouts.push(setTimeout(() => {
                    // Send haptic score (10 = Warning Bump)
                    if(typeof sendHapticScoreToNative === 'function') sendHapticScoreToNative(10);
                }, ms));
            }
        });

        // ---------------------------------------------------------
        // E. TRIGGER LIVE ACTIVITY (LOCK SCREEN WIDGET)
        // ---------------------------------------------------------
        try {
            const sets = selectedExercise.sets;
            if (sets && sets.length > 0) {
                const lastSet = sets[sets.length - 1]; 

                if (lastSet && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.liveActivityHandler) {
                    
                    let displayWeight = lastSet.weight;
                    let unitLabel = "lbs";
                    
                    if (typeof UNIT_mode !== 'undefined') {
                        displayWeight = UNIT_mode.toDisplay(lastSet.weight);
                        unitLabel = UNIT_mode.getLabel();
                    }
                    
                    const weightString = `${displayWeight} ${unitLabel}`;

                    const payload = {
                        exercise: selectedExercise.exercise,
                        weight: weightString,
                        reps: String(lastSet.reps),
                        startTime: now
                    };

                    window.webkit.messageHandlers.liveActivityHandler.postMessage(payload);
                    console.log("🚀 Sent Live Activity Payload", payload);
                }
            }
        } catch (err) {
            console.error("Live Activity Trigger Failed:", err);
        }
    }
}

// 2. THE MASTER TICK (Runs every second, updates EVERYTHING)
function masterClockTick() {
    const now = Date.now();
    
    // --- TASK 1: UPDATE GLOBAL HEADER ---
    const globalEl = document.getElementById('globalHeaderTimer');
    const globalText = document.getElementById('globalHeaderTimerText');
    const rawGlobal = localStorage.getItem(KEY_GLOBAL_TIMER);
    
    if (globalEl && globalText) {
        if (!rawGlobal) {
            globalEl.classList.add('hidden');
        } else {
            try {
                const data = JSON.parse(rawGlobal);
                const diff = now - parseInt(data.time);
                
                // EXPIRATION LOGIC (30 Mins)
                if (diff > TIMER_LIMIT_MS) { 
                    globalEl.classList.add('hidden');
                    localStorage.removeItem(KEY_GLOBAL_TIMER);
                } else {
                    globalText.textContent = formatTimer(diff);
                    globalEl.classList.remove('hidden');
                }
            } catch (e) { 
                console.error("Timer parse error", e);
                localStorage.removeItem(KEY_GLOBAL_TIMER);
            }
        }
    }

    // --- TASK 2: UPDATE LOCAL EXERCISE TIMER ---
    if (typeof SCREENS !== 'undefined' && currentScreen === SCREENS.SETS && selectedExercise) {
        const localEl = document.getElementById('restTimer');
        const localText = document.getElementById('restTimerText');
        const localKey = `restTimer_${selectedExercise.exercise}`;
        const localTime = localStorage.getItem(localKey);
        
        if (localEl && localText) {
            if (!localTime) {
                localEl.classList.add('hidden');
            } else {
                const diff = now - parseInt(localTime);
                if (diff > TIMER_LIMIT_MS) {
                    localEl.classList.add('hidden');
                    localStorage.removeItem(localKey);
                } else {
                    localText.textContent = formatTimer(diff);
                    localEl.classList.remove('hidden');
                }
            }
        }
    }
}

// Helper: Milliseconds -> MM:SS
function formatTimer(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// 3. INIT (Start the loop & Restore Haptics)
function initMasterClock() {
    if (masterTimerInterval) clearInterval(masterTimerInterval);
    masterClockTick(); 
    masterTimerInterval = setInterval(masterClockTick, 1000);

    // --- REHYDRATE FOREGROUND HAPTICS ---
    // If user refreshes, we restore the specific haptic timeouts
    // so they don't miss the buzz if the app is open.
    const rawGlobal = localStorage.getItem(KEY_GLOBAL_TIMER);
    if (rawGlobal) {
        try {
            const data = JSON.parse(rawGlobal);
            const elapsed = Date.now() - parseInt(data.time);
            
            // Clear lists first
            foregroundHapticTimeouts.forEach(id => clearTimeout(id));
            foregroundHapticTimeouts = [];

            // If < 1 min, schedule 1m buzz
            if (elapsed < 60000) {
                foregroundHapticTimeouts.push(setTimeout(() => {
                     if(typeof sendHapticScoreToNative === 'function') sendHapticScoreToNative(10);
                }, 60000 - elapsed));
            }
            // If < 3 mins, schedule 3m buzz
            if (elapsed < 180000) {
                foregroundHapticTimeouts.push(setTimeout(() => {
                     if(typeof sendHapticScoreToNative === 'function') sendHapticScoreToNative(30);
                }, 180000 - elapsed));
            }
            // If < 10 mins, schedule 10m buzz
            if (elapsed < 600000) {
                foregroundHapticTimeouts.push(setTimeout(() => {
                     if(typeof sendHapticScoreToNative === 'function') sendHapticScoreToNative(100);
                }, 600000 - elapsed));
            }
        } catch(e) { console.error("Rehydrate error", e); }
    }
}

// Start the engine
initMasterClock();

// Update the Screen & Button Text based on State
function updateCalcUI() {
    // 1. Update Text Display
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

// [app.js] REPS STEPPER LOGIC
const adjustReps = (delta) => {
    // 1. Ensure Reps is the active field
    calcState.activeField = 'reps';
    
    // 2. Clear auto-fill flag so strict typing doesn't wipe it later
    // (We are modifying the value intentionally, so we "claim" it)
    if (calcState.isAutoFilled && calcState.isAutoFilled.reps) {
        calcState.isAutoFilled.reps = false;
    }

    // 3. Get current val (default to 0 if empty)
    let current = parseInt(calcState.repsVal) || 0;
    
    // 4. Calculate new val (Prevent negatives)
    let newVal = current + delta;
    if (newVal < 0) newVal = 0;
    
    // 5. Save & Render
    calcState.repsVal = newVal.toString();
    
    // Optional: Add haptic tick for satisfaction
    if (typeof sendHapticScoreToNative === 'function') sendHapticScoreToNative(-3);

    updateCalcUI();
};

document.getElementById('btnRepDec').onclick = (e) => {
    e.stopPropagation(); // Don't trigger the box click
    adjustReps(-1);
};

document.getElementById('btnRepInc').onclick = (e) => {
    e.stopPropagation(); // Don't trigger the box click
    adjustReps(1);
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
                updatePlateBadges();
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
    updatePlateBadges(); // Use the new helper
  //document.querySelectorAll('.plate-count').forEach(el => el.classList.add('hidden'));
}

// Handle "Next" / "Save" Action
calcActionBtn.onclick = () => {
    // Direct Save
    finishAddSet();
};

// [app.js] REPLACE finishAddSet
function finishAddSet() {
    const reps = parseInt(calcState.repsVal);
    const displayWeight = parseFloat(calcState.weightVal);

    if (isNaN(reps) || isNaN(displayWeight)) return;

    // CONVERT TO LBS FOR STORAGE
    const weightLBS = UNIT_mode.toStorage(displayWeight);
    const volumeLBS = weightLBS * reps;

    const notes = ""; 
    const timestamp = new Date().toISOString();
    
    // --- NEW: CAPTURE PLATES ---
    // We only save plates that have a count > 0
    let savedPlates = null;
    if (calcState.plates && Object.keys(calcState.plates).length > 0) {
        savedPlates = {};
        for (const [plateWeight, count] of Object.entries(calcState.plates)) {
            if (count > 0) savedPlates[plateWeight] = count;
        }
        // If empty after filtering, keep null
        if (Object.keys(savedPlates).length === 0) savedPlates = null;
    }
    // ---------------------------

    selectedExercise.sets.push({ 
        reps: reps, 
        weight: weightLBS, 
        volume: volumeLBS, 
        notes, 
        timestamp,
        plates: savedPlates // <--- Add to object
    });

    saveUserJson();
    // --- NEW: CALCULATE "GREEN SCORE" FOR HAPTICS ---
    try {
        // We reuse your existing logic that calculates improvements
        // getExerciseColorData compares the current session vs previous session
        const colorData = getExerciseColorData(selectedExercise);
        
        // colorData returns { red, green, yellow, total }
        // We send the 'green' count to Swift
        if (colorData && typeof colorData.green === 'number') {
            sendHapticScoreToNative(colorData.green);
        }
    } catch (err) {
        console.error("Haptic calc failed", err);
    }
    // ------------------------------------------------
    renderSets();
    closeAddSetModal();
    startRestTimer(true);
    
    // --- TUTORIAL LOGIC ---
    if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
        // 1. Clear previous tips
        clearTutorialTips();
        if (tutorialTimer) clearTimeout(tutorialTimer);
        
        // 2. Set stage to generic 'post-log' first
        document.body.dataset.tutorialStage = 'post-log';

        // Sequence: Rest Timer -> Spiral -> Slider
        setTimeout(() => {
            showTutorialTip('restTimer', 'A rest timer starts automatically.', 30);
            
            tutorialTimer = setTimeout(() => {
                showTutorialTip('spiralCanvas', 'This spiral tracks your history.', 20);
                
                tutorialTimer = setTimeout(() => {
                    // CRITICAL: Set the specific stage that handleSliderMove looks for
                    document.body.dataset.tutorialStage = 'waiting-for-slider';
                    showTutorialTip('spiralSlider', 'Drag the slider backwards to see previous days data.', 10);
                }, 3500);
            }, 3500); 
        }, 500);
    }
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
// SETTINGS ENGINE (COLORS & ANIMATIONS)
// =====================================================

const settingColorToggle = document.getElementById('settingColorToggle');
const settingAnimToggle = document.getElementById('settingAnimToggle');

// 1. Initialize Settings (Run on App Load)
function initSettings() {
    // Check LocalStorage (Default to 'true' if null)
    const savedColors = localStorage.getItem('trunk_setting_colors');
    const savedAnims = localStorage.getItem('trunk_setting_anims');
    const savedHaptics = localStorage.getItem('trunk_setting_haptics');
    const settingHapticToggle = document.getElementById('settingHapticToggle');

    // Logic: If the value is "false", we DISABLE features. 
    // Defaults: We assume enabled unless specifically set to "false".
    
    // --- COLORS ---
    if (savedColors === 'false') {
        document.body.classList.add('no-colors');
        if(settingColorToggle) settingColorToggle.checked = false;
    } else {
        document.body.classList.remove('no-colors');
        if(settingColorToggle) settingColorToggle.checked = true;
    }

    // --- ANIMATIONS ---
    if (savedAnims === 'false') {
        document.body.classList.add('no-animations');
        if(settingAnimToggle) settingAnimToggle.checked = false;
    } else {
        document.body.classList.remove('no-animations');
        if(settingAnimToggle) settingAnimToggle.checked = true;
    }
    // --- HAPTICS ---
    // Default is TRUE. Only uncheck if explicitly saved as 'false'.
    if (settingHapticToggle) {
        settingHapticToggle.checked = (savedHaptics !== 'false');
    }
}

// 2. Event Listeners for Toggles
if (settingColorToggle) {
    settingColorToggle.addEventListener('change', (e) => {
        sendHapticScoreToNative(-2); // <--- ADD THIS (Toggle Click)
        const isEnabled = e.target.checked;
        if (isEnabled) {
            document.body.classList.remove('no-colors');
            localStorage.setItem('trunk_setting_colors', 'true');
        } else {
            document.body.classList.add('no-colors');
            localStorage.setItem('trunk_setting_colors', 'false');
        }
    });
}

if (settingAnimToggle) {
    settingAnimToggle.addEventListener('change', (e) => {
        sendHapticScoreToNative(-2); // <--- ADD THIS (Toggle Click)
        const isEnabled = e.target.checked;
        if (isEnabled) {
            document.body.classList.remove('no-animations');
            localStorage.setItem('trunk_setting_anims', 'true');
        } else {
            document.body.classList.add('no-animations');
            localStorage.setItem('trunk_setting_anims', 'false');
        }
    });
}

if (settingHapticToggle) {
    settingHapticToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        if (isEnabled) {
            localStorage.setItem('trunk_setting_haptics', 'true');
            // Give immediate feedback that it's back on
            sendHapticScoreToNative(-2); 
        } else {
            localStorage.setItem('trunk_setting_haptics', 'false');
        }
    });
}

// 3. Run Initialization immediately
initSettings();

// =====================================================
// CALENDAR ENGINE
// =====================================================

let calendarState = {
  currentDate: new Date(), // For tracking Month/Year view
  selectedDateStr: null,   // "YYYY-MM-DD" of clicked day
  workoutsMap: new Map()   // Cache of dates -> workout data
};

// 1. PREPARE DATA
// Flattens the nested structure (Client -> Sessions -> Exercises -> Sets)
// into a Map grouped by Date string.
function buildCalendarMap() {
  calendarState.workoutsMap.clear();
  
  if (!selectedClient || !clientsData[selectedClient]) return;
  
  const sessions = clientsData[selectedClient].sessions || [];
  
  sessions.forEach(sess => {
    // We treat the "Session" object essentially as a folder/category.
    // We dig into the ACTUAL sets to find when work occurred.
    if(sess.exercises) {
      sess.exercises.forEach(ex => {
        if(ex.sets) {
          ex.sets.forEach(set => {
             const d = new Date(set.timestamp);
             // Create clean local date string YYYY-MM-DD
             // We use local time to match user's wall-clock experience
             const year = d.getFullYear();
             const month = String(d.getMonth() + 1).padStart(2, '0');
             const day = String(d.getDate()).padStart(2, '0');
             const dateKey = `${year}-${month}-${day}`;
             
             if (!calendarState.workoutsMap.has(dateKey)) {
               calendarState.workoutsMap.set(dateKey, []);
             }
             
             // Push a lightweight ref to the data
             calendarState.workoutsMap.get(dateKey).push({
               exerciseName: ex.exercise,
               set: set,
               timestamp: d
             });
          });
        }
      });
    }
  });
}

// 2. MAIN RENDERER
function renderCalendarScreen() {
  // Re-scan data every time we open the screen to ensure fresh sync
  buildCalendarMap();
  
  // Update Title
  const title = document.getElementById('calendarScreenTitle');
  if (title) applyTitleStyling(title, 'History', null);
  
  // Default to today if nothing selected
  if (!calendarState.selectedDateStr) {
      const now = new Date();
      calendarState.selectedDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }

  renderCalendarGrid();
  renderDayDetails(calendarState.selectedDateStr);
}

// 3. GRID RENDERER
function renderCalendarGrid() {
  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('calMonthLabel');
  grid.innerHTML = '';
  
  const year = calendarState.currentDate.getFullYear();
  const month = calendarState.currentDate.getMonth(); // 0-indexed
  
  // Set Header
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthLabel.textContent = `${monthNames[month]} ${year}`;
  
  // Geometry
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Today Check
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  // Fill Empty Slots (Previous Month)
  for (let i = 0; i < firstDayOfMonth; i++) {
    const div = document.createElement('div');
    div.className = 'cal-day empty';
    grid.appendChild(div);
  }
  
  // Fill Days
  for (let d = 1; d <= daysInMonth; d++) {
    const div = document.createElement('div');
    div.className = 'cal-day';
    div.textContent = d;
    
    const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    
    // 1. Check Data
    if (calendarState.workoutsMap.has(dateKey)) {
      div.classList.add('has-data');
    }
    
    // 2. Check Today
    if (dateKey === todayKey) {
      div.classList.add('is-today');
    }
    
    // 3. Check Selected
    if (dateKey === calendarState.selectedDateStr) {
      div.classList.add('selected');
    }
    
    // Click Handler
    div.onclick = () => {
      // UI Update
      document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      
      // State Update
      calendarState.selectedDateStr = dateKey;
      renderDayDetails(dateKey);
    };
    
    grid.appendChild(div);
  }
}

// 4. CONTROLS
document.getElementById('calPrevBtn').onclick = () => {
  calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() - 1);
  renderCalendarGrid();
};

document.getElementById('calNextBtn').onclick = () => {
  calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() + 1);
  renderCalendarGrid();
};

// 5. DETAIL VIEW (The List Below)
function renderDayDetails(dateKey) {
  const container = document.getElementById('calDetailsList');
  const label = document.getElementById('calSelectedDateLabel');
  container.innerHTML = '';
  
  // Parse date for pretty label
  const [y, m, d] = dateKey.split('-');
  const dateObj = new Date(y, m-1, d);
  label.textContent = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  
  // Check if data exists
  if (!calendarState.workoutsMap.has(dateKey)) {
    container.innerHTML = `<li class="cal-empty-state">No workouts recorded this day.</li>`;
    return;
  }
  
  const rawData = calendarState.workoutsMap.get(dateKey);
  
  // GROUP BY EXERCISE
  // We want: Exercise Name -> List of Sets
  const groups = {};
  rawData.forEach(item => {
    if (!groups[item.exerciseName]) groups[item.exerciseName] = [];
    groups[item.exerciseName].push(item.set);
  });
  
  // Sort sets chronologically
  Object.keys(groups).forEach(exName => {
    groups[exName].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  });
  
  // RENDER GROUPS
  Object.keys(groups).forEach(exName => {
    const groupLi = document.createElement('li');
    groupLi.className = 'cal-exercise-group';
    
    const title = document.createElement('div');
    title.className = 'cal-exercise-title';
    title.textContent = exName;
    groupLi.appendChild(title);
    
    // Render set cards (Simplified version of Sets Page)
    groups[exName].forEach((s, idx) => {
       const setDiv = document.createElement('div');
       setDiv.className = 'set-card'; // Reuse existing card style
       setDiv.style.marginBottom = '0.5rem';
       
       const dispWeight = UNIT_mode.toDisplay(s.weight);
       const uLabel = UNIT_mode.getLabel();
       const noteText = s.notes ? `<div style="font-size:0.8rem; color:var(--color-text-muted); margin-top:4px;">📝 ${s.notes}</div>` : '';
       
       setDiv.innerHTML = `
        <div class="set-summary" style="padding: 0.75rem;">
            <div class="set-index-badge" style="width:24px; height:24px; font-size:0.75rem;">${idx + 1}</div>
            <div class="set-main-data">
                <span class="set-reps-val" style="font-size:1.1rem;">${s.reps}</span>
                <span class="set-x">x</span>
                <span class="set-weight-val" style="font-size:1rem;">${dispWeight} ${uLabel}</span>
            </div>
            <div class="set-meta-data">
                <span class="set-vol" style="font-size:0.75rem;">${Math.round(UNIT_mode.toDisplay(s.volume)).toLocaleString()} vol</span>
            </div>
        </div>
        ${s.notes ? `<div style="padding: 0 0.75rem 0.75rem 3.5rem;">${noteText}</div>` : ''}
       `;
       
       groupLi.appendChild(setDiv);
    });
    
    container.appendChild(groupLi);
  });
}

// =====================================================
// SMART RECAP ENGINE (Math-Based "AI") - V3 (High Variance)
// =====================================================

const RECAP_TEMPLATES = {
    // 1. STRENGTH GAIN (Max Weight Increased)
    strength: [
        ["New standard set.", "Top weight was up {diff}% compared to the previous session."],
        ["Power output increased.", "You moved {weight} {unit}, beating your last record."],
        ["Strength is trending up.", "That top set was heavier than last time."],
        ["Solid progression.", "You handled {weight} {unit} with authority."],
        ["Moving heavy loads.", "Max weight increased by {diff}% this workout."],
        ["Pushing the limit.", "You added weight to the bar and got the work done."],
        ["New territory unlocked.", "That {weight} {unit} set was your heaviest yet."],
        ["Gravity lost this round.", "You lifted {diff}% heavier than before."],
        ["Leveling up.", "Strength numbers are looking higher this session."],
        ["Bar bending power.", "You topped out at {weight} {unit} today."],
        ["Serious iron.", "That heaviest set was {diff}% more than your previous best."],
        ["Upward trajectory.", "You're getting comfortable with {weight} {unit}."],
        ["Breaking ceilings.", "You pushed past your previous top weight."],
        ["Heavy lifting.", "You peaked at {weight} {unit} across {sets} sets."],
        ["Strength gains detected.", "A {diff}% increase in max load is significant."],
        ["Dominated the weight.", "That {weight} {unit} set looked solid."],
        ["Climbing the ladder.", "Your top set was heavier than last session."],
        ["Force production up.", "You generated more power with {weight} {unit}."],
        ["New heavy single.", "You handled {diff}% more weight at the top end."],
        ["Iron sharpens iron.", "You successfully moved {weight} {unit} today."],
        ["Raising the bar.", "Literally. Max weight is up {diff}%."],
        ["Stronger today.", "You successfully handled {weight} {unit}."],
        ["Peak performance.", "That top set of {weight} {unit} sets a new standard."],
        ["Crushing it.", "Max load increased by {diff}%."],
        ["Heavy day.", "You didn't shy away from {weight} {unit}."],
        ["Strength metrics up.", "You're moving {diff}% more weight than last time."],
        ["Solid lift.", "That {weight} {unit} set was the highlight."],
        ["Power move.", "You increased your top weight by {diff}%."],
        ["Beating the logbook.", "Your heaviest set exceeded last session's."],
        ["Strong work.", "You took {weight} {unit} for a ride."],
        ["Progress secured.", "Max weight is up {diff}% from last time."],
        ["Gaining ground.", "You're handling {weight} {unit} better than ever."],
        ["Top end power.", "You pushed the max weight up by {diff}%."],
        ["Moving mountains.", "Well, {weight} {unit} to be exact."],
        ["Heavy hitter.", "You peaked at {weight} {unit} this session."],
        ["No plateau here.", "Strength is up {diff}%."],
        ["Weight room win.", "You handled {weight} {unit} today."],
        ["Incrementing up.", "Max load increased by {diff}%."],
        ["Quality strength.", "That top set of {weight} {unit} counts."],
        ["Built different.", "You moved {diff}% more weight than last time."],
        ["Standard raised.", "Your new target to beat is {weight} {unit}."],
        ["Pure power.", "You topped out at {weight} {unit}."],
        ["Strength verified.", "Metrics show a {diff}% increase in max load."],
        ["Heavy duty.", "You controlled {weight} {unit} today."]
    ],
    // 2. VOLUME GAIN (Total Volume Increased)
    volume: [
        ["High capacity session.", "Total volume was up {diff}% from last time."],
        ["Workhorse mentality.", "You logged {vol} {unit} of total volume here."],
        ["The tank was full.", "You moved significantly more total load than before."],
        ["Volume PR.", "That was a massive {diff}% increase in total work."],
        ["Endurance is building.", "You accumulated {vol} {unit} across {sets} sets."],
        ["Putting in the reps.", "Total workload increased by {diff}%."],
        ["Grinding it out.", "You did more total work this session than last."],
        ["Serious capacity.", "Volume numbers are trending upward."],
        ["Extra mileage.", "You pushed the volume {diff}% higher this time."],
        ["Full gas.", "You moved a total of {vol} {unit} today."],
        ["Building the engine.", "Total volume is up {diff}%."],
        ["Sweat equity.", "You accumulated {vol} {unit} of work."],
        ["High volume day.", "You increased total load by {diff}%."],
        ["Stacking the work.", "Across {sets} sets, you moved {vol} {unit}."],
        ["Capacity check passed.", "Volume increased by {diff}%."],
        ["Marathon session.", "You logged {vol} {unit} total."],
        ["Work capacity up.", "You handled {diff}% more total volume."],
        ["Heavy workload.", "You moved {vol} {unit} this session."],
        ["Turning up the volume.", "Total load increased by {diff}%."],
        ["Putting in hours.", "You accumulated {vol} {unit} today."],
        ["Filling the log.", "Volume is up {diff}% from last time."],
        ["Massive output.", "You moved {vol} {unit} total."],
        ["Grind mode.", "You increased total volume by {diff}%."],
        ["Volume metrics up.", "You logged {vol} {unit}."],
        ["Working hard.", "Total load is up {diff}%."],
        ["Big session.", "You moved {vol} {unit} across {sets} sets."],
        ["Endurance test.", "Volume increased by {diff}%."],
        ["Accumulation phase.", "You logged {vol} {unit} today."],
        ["More work done.", "Total load up {diff}%."],
        ["Volume king.", "You moved {vol} {unit} total."],
        ["Serious tonnage.", "You increased volume by {diff}%."],
        ["Capacity building.", "You logged {vol} {unit}."],
        ["Work rate up.", "Volume increased by {diff}%."],
        ["Heavy hauling.", "You moved {vol} {unit} today."],
        ["Total load up.", "A {diff}% increase in volume."],
        ["Busy session.", "You accumulated {vol} {unit}."],
        ["Volume gains.", "You increased workload by {diff}%."],
        ["Maximum effort.", "You moved {vol} {unit} total."],
        ["Workload increased.", "Volume is up {diff}%."],
        ["Getting it done.", "You logged {vol} {unit} today."],
        ["High output.", "Volume increased by {diff}%."]
    ],
    // 3. EFFICIENCY (WPR Up - Better weight per rep)
    efficiency: [
        ["Clean and efficient.", "You matched previous numbers with better focus."],
        ["Laser focused.", "Your average weight per rep trended up this session."],
        ["Quality over quantity.", "Every rep counted more in this workout."],
        ["Optimized performance.", "You maintained intensity with solid technique."],
        ["Smart training.", "You got the work done without wasted volume."],
        ["Effective session.", "Average load per rep was higher than last time."],
        ["Dialed in.", "Performance efficiency looked solid here."],
        ["Sharp execution.", "Your work-per-rep ratio is trending up."],
        ["High quality work.", "You made every set count today."],
        ["Efficiency gains.", "Your average weight per rep increased."],
        ["Precision training.", "You got more out of every rep."],
        ["Focus on form.", "Efficiency metrics look better than last time."],
        ["Quality control.", "Average load per rep is up."],
        ["Smart work.", "You maintained intensity with less waste."],
        ["Targeted effort.", "Your work-per-rep stat improved."],
        ["Clean reps.", "Efficiency is trending in the right direction."],
        ["Mastery.", "You're getting more out of each movement."],
        ["Professional work.", "Average weight per rep is up."],
        ["Calculated effort.", "You optimized your volume today."],
        ["Skillful lifting.", "Efficiency metrics are green."],
        ["Refined technique.", "Average load per rep increased."],
        ["Effective reps.", "You made the most of this session."],
        ["Streamlined session.", "Efficiency is up from last time."],
        ["Potent work.", "Your average weight per rep is higher."],
        ["Focused intensity.", "You optimized your workload."],
        ["High ROI.", "Better return on every rep today."],
        ["Technical win.", "Efficiency stats improved."],
        ["Smooth operation.", "Average load per rep is up."],
        ["Surgical precision.", "You made every rep count."],
        ["Efficient power.", "Work-per-rep increased."],
        ["Quality session.", "You focused on effective reps."],
        ["Smart gains.", "Efficiency is trending up."],
        ["Tactical lift.", "Average weight per rep increased."],
        ["No wasted motion.", "You improved your efficiency."],
        ["Solid focus.", "Work-per-rep stats look good."],
        ["High caliber.", "Average load per rep is up."],
        ["Expert handling.", "You optimized your sets today."],
        ["Effective training.", "Efficiency is better than last time."],
        ["Sharp session.", "Average weight per rep increased."]
    ],
    // 4. CONSISTENCY (Numbers are roughly the same)
    consistency: [
        ["Consistency is king.", "You matched your last performance perfectly."],
        ["Another brick in the wall.", "Steady work keeps the progress coming."],
        ["Showing up is the win.", "You maintained a solid baseline here."],
        ["Standard maintained.", "You hit your marks just like last time."],
        ["Clocking in.", "Another solid session in the books."],
        ["Reliable power.", "Performance remained stable and strong."],
        ["Staying the course.", "You matched the previous session's intensity."],
        ["Foundation work.", "Keeping these numbers steady builds long-term gains."],
        ["Holding the line.", "You maintained your strength levels today."],
        ["Steady state.", "Performance is consistent with last session."],
        ["Solid baseline.", "You matched your previous numbers."],
        ["Reliable work.", "Consistency is the key to growth."],
        ["Maintenance success.", "You held your ground today."],
        ["Routine execution.", "You hit the same metrics as last time."],
        ["Steady grind.", "You matched your previous performance."],
        ["Keeping pace.", "Performance remained steady."],
        ["Stable session.", "You maintained your baseline."],
        ["Locked in.", "You hit your numbers exactly."],
        ["Predictable power.", "Consistency is looking good."],
        ["Standard procedure.", "You matched last session's stats."],
        ["Even keel.", "Performance remained stable."],
        ["Reliable output.", "You maintained your strength."],
        ["Steady progress.", "Consistency builds results."],
        ["On track.", "You matched your previous efforts."],
        ["Holding steady.", "Performance is consistent."],
        ["Regular programming.", "You hit your marks."],
        ["Solid stability.", "You maintained your baseline."],
        ["Dependable work.", "You matched last time's numbers."],
        ["Steady rhythm.", "Performance remained stable."],
        ["Consistent effort.", "You held your ground."],
        ["Baseline secured.", "You matched your previous stats."],
        ["Regular maintenance.", "Consistency is key."],
        ["Steady hand.", "You hit the same numbers."],
        ["Firm foundation.", "Performance remained steady."],
        ["Repeat performance.", "You matched your last session."],
        ["Steady flow.", "Consistency looks good."],
        ["Balanced session.", "You maintained your baseline."],
        ["Even effort.", "You hit your numbers."],
        ["Reliable baseline.", "Performance remained stable."]
    ],
    // 5. RECOVERY (Numbers are down)
    recovery: [
        ["Recovery is key.", "A lighter session here sets up gains for next time."],
        ["Just getting it done.", "Motion is better than nothing. Keep going."],
        ["Listening to the body.", "Sometimes pulling back is the smart play."],
        ["Active recovery.", "Volume was lower, allowing for better restoration."],
        ["Reset and recharge.", "Took it lighter this session to recover."],
        ["Pacing yourself.", "A dip in volume is natural in long-term training."],
        ["Keeping the habit.", "You showed up, and that's what matters most."],
        ["Deload mindset.", "Lighter volume today for better recovery."],
        ["Strategic dip.", "Pulling back today to push forward tomorrow."],
        ["Recovery mode.", "Lower volume helps the body repair."],
        ["Light work.", "Sometimes less is more."],
        ["Preserving energy.", "A lighter session for recovery."],
        ["Flow state.", "Movement is the goal today."],
        ["Gentle session.", "Prioritizing recovery this time."],
        ["Smart regulation.", "Listening to your body's needs."],
        ["Backing off.", "Recovery is part of the process."],
        ["Easy day.", "Lighter volume for restoration."],
        ["Maintenance mode.", "Keeping the habit alive."],
        ["Restorative work.", "Lower intensity today."],
        ["Dialing back.", "Recovery is essential."],
        ["Smooth sailing.", "A lighter load for today."],
        ["Energy conservation.", "Prioritizing rest and repair."],
        ["Active rest.", "Movement helps recovery."],
        ["Checking the box.", "You showed up, that counts."],
        ["Light and easy.", "Recovering for the next heavy session."],
        ["Body maintenance.", "Lower volume today."],
        ["Smart pullback.", "Avoiding burnout is key."],
        ["Recharging.", "Lighter work today."],
        ["Health first.", "Prioritizing recovery."],
        ["Taking it easy.", "A dip in volume is okay."],
        ["Recovery focus.", "Lower intensity session."],
        ["Strategic rest.", "Preparing for future gains."],
        ["Habit stacking.", "You logged a session, regardless of volume."],
        ["Low stress.", "Active recovery day."],
        ["Resetting.", "Lower volume to recharge."],
        ["Sustainable pace.", "Listening to the body."],
        ["Grace period.", "Lighter work today."],
        ["Recovery gains.", "Rest is when you grow."]
    ],
    // 6. WELCOME (No history)
    welcome: [
        ["First entry logged.", "Let's set a strong baseline for next time."],
        ["The journey starts.", "Log your sets to unlock progress tracking."],
        ["Blank canvas.", "Time to make some history."],
        ["Day one.", "Great start. Now let's build on this."],
        ["Baseline set.", "Future progress will be measured against this."],
        ["History begins.", "This is your first log for this exercise."],
        ["Starting line.", "A solid foundation for future gains."],
        ["Opening entry.", "Your tracking journey begins here."],
        ["First step.", "Consistency starts with this log."],
        ["New chapter.", "Let's see where you take this."],
        ["Benchmark set.", "Next time, we try to beat this."],
        ["Data point one.", "Building your history starts now."],
        ["Fresh start.", "This is the baseline to grow from."],
        ["Welcome aboard.", "Great first session logged."],
        ["Initial log.", "Setting the standard for future workouts."],
        ["Ground zero.", "The only way is up from here."],
        ["First reps.", "Your history starts today."],
        ["Foundation laid.", "Solid start to your tracking."],
        ["In the books.", "First session complete."],
        ["Starting strong.", "A great baseline established."],
        ["Hello world.", "Your fitness journey is now tracked."],
        ["Page one.", "Writing your strength history."],
        ["First of many.", "Great job logging your first session."],
        ["Baseline established.", "Future you will thank you."],
        ["Getting started.", "Consistency is the next step."],
        ["Log initiated.", "Ready to track your progress."],
        ["First set down.", "Building a habit starts now."],
        ["Opening move.", "A solid start."],
        ["Fresh page.", "Let's fill this with PRs."],
        ["Launchpad.", "Your progress starts here."],
        ["First block.", "Building your fitness data."],
        ["Genesis.", "The beginning of your logs."],
        ["Starting point.", "Measure your growth from here."],
        ["Entry one.", "Let's keep this streak going."],
        ["Welcome to tracking.", "First session logged."],
        ["Origin story.", "Your strength history begins."],
        ["Day 1 complete.", "Great start."],
        ["Founding session.", "The baseline is set."]
    ]
};

function generateSmartRecap() {
    const box = document.getElementById('smartRecapBox');
    const textEl = document.getElementById('smartRecapText');
    if (!box || !textEl || !selectedExercise) return;

    // 1. Get Data
    const sets = selectedExercise.sets;
    
    // FIX: If no sets exist, HIDE the box completely
    if (!sets || sets.length === 0) {
        box.classList.add('hidden');
        return;
    }

    // 2. Sort & Group
    const sortedSets = sets.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const mostRecentDate = new Date(sortedSets[0].timestamp);
    
    // Split into "Current Session" and "Last Time"
    const currentSets = sortedSets.filter(s => isSameDay(new Date(s.timestamp), mostRecentDate));
    const previousSet = sortedSets.find(s => !isSameDay(new Date(s.timestamp), mostRecentDate));

    // FIX: Only show Welcome text if we have data BUT no history
    if (!previousSet) {
        setRecapText(box, textEl, RECAP_TEMPLATES.welcome, 'recap-neutral');
        return;
    }

    const previousDate = new Date(previousSet.timestamp);
    const prevSets = sortedSets.filter(s => isSameDay(new Date(s.timestamp), previousDate));

    // 3. Calculate Metrics
    const currStats = getSessionStats(currentSets);
    const prevStats = getSessionStats(prevSets);
    const unit = UNIT_mode.getLabel();

    // 4. LOGIC TREE (The "AI" Decision Making)
    let selectedCategory = 'consistency';
    let moodClass = 'recap-neutral';
    let diff = 0;
    
    // Formatting numbers for the templates
    const maxWeightStr = UNIT_mode.toDisplay(currStats.maxWeight);
    const totalVolStr = Math.round(UNIT_mode.toDisplay(currStats.volume)).toLocaleString();

    // A. Did we lift heavier? (Max Weight > 2.5% increase)
    if (currStats.maxWeight > prevStats.maxWeight * 1.025) {
        selectedCategory = 'strength';
        moodClass = 'recap-happy';
        diff = calculatePercentDiff(currStats.maxWeight, prevStats.maxWeight);
    } 
    // B. Did we do significantly more work? (Volume > 5% increase)
    else if (currStats.volume > prevStats.volume * 1.05) {
        selectedCategory = 'volume';
        moodClass = 'recap-happy';
        diff = calculatePercentDiff(currStats.volume, prevStats.volume);
    }
    // C. Did we dip significantly? (Volume < 85%)
    else if (currStats.volume < prevStats.volume * 0.85) {
        selectedCategory = 'recovery';
        moodClass = 'recap-sad'; 
    }
    // D. Efficiency check (WPR is up but volume is same/down)
    else if (currStats.wpr > prevStats.wpr * 1.02) {
        selectedCategory = 'efficiency';
        moodClass = 'recap-happy';
    }

    // 5. Pick a RANDOM Template (Requirement B: Different every time)
    const templates = RECAP_TEMPLATES[selectedCategory];
    const templateIdx = Math.floor(Math.random() * templates.length);
    const rawTemplate = templates[templateIdx];

    // 6. Fill Variables (Safe Replace)
    let sentence1 = rawTemplate[0];
    let sentence2 = rawTemplate[1]
        .replace('{diff}', Math.abs(Math.round(diff)))
        .replace('{weight}', maxWeightStr)
        .replace('{vol}', totalVolStr)
        .replace('{sets}', currStats.sets)
        .replace('{unit}', unit);

    // 7. Render
    textEl.innerHTML = `${sentence1} <span style="opacity:0.7">${sentence2}</span>`;
    textEl.className = `smart-recap-text ${moodClass}`;
    box.classList.remove('hidden');
}

// Helper: Calculate simple stats
function getSessionStats(setList) {
    let vol = 0;
    let maxW = 0;
    let reps = 0;
    setList.forEach(s => {
        vol += s.volume;
        reps += s.reps;
        if (s.weight > maxW) maxW = s.weight;
    });
    return { volume: vol, maxWeight: maxW, wpr: reps > 0 ? vol/reps : 0, sets: setList.length };
}

function calculatePercentDiff(a, b) {
    if (b === 0) return 100;
    return ((a - b) / b) * 100;
}

function setRecapText(box, el, templates, cssClass) {
    const idx = Math.floor(Math.random() * templates.length);
    const t = templates[idx];
    el.innerHTML = `${t[0]} <span style="opacity:0.7">${t[1]}</span>`;
    el.className = `smart-recap-text ${cssClass}`;
    box.classList.remove('hidden');
}

// ==========================================
// MASTER NAVIGATION RE-BIND (Fixes "Stuck" Buttons)
// ==========================================

// 1. Sessions Screen -> Back to Home (Clients)
const backToClientsBtn = document.getElementById('backToClientsBtn');
if (backToClientsBtn) {
    backToClientsBtn.onclick = () => {
        navigateTo(SCREENS.CLIENTS, 'back');
    };
}

// 2. Exercises Screen -> Back to Sessions
const backToSessionsBtn = document.getElementById('backToSessionsBtn');
if (backToSessionsBtn) {
    backToSessionsBtn.onclick = () => {
        navigateTo(SCREENS.SESSIONS, 'back');
    };
}

// 3. Sets Screen -> Back to Exercises (The one you just reported)
const backToExercisesBtn = document.getElementById('backToExercisesBtn');
if (backToExercisesBtn) {
    backToExercisesBtn.onclick = () => {
        navigateTo(SCREENS.EXERCISES, 'back');
        
        // Cleanup: Hide timer on Sets screen so it doesn't linger visually
        const localTimer = document.getElementById('restTimer');
        if (localTimer) localTimer.classList.add('hidden');
    };
}

// 4. Calendar Screen -> Back to Sessions
const backToSessionsFromCalBtn = document.getElementById('backToSessionsFromCalBtn');
if (backToSessionsFromCalBtn) {
    backToSessionsFromCalBtn.onclick = () => {
        navigateTo(SCREENS.SESSIONS, 'back');
    };
}

const backToSetsFromGraphBtn = document.getElementById('backToSetsFromGraphBtn');
if (backToSetsFromGraphBtn) {
    backToSetsFromGraphBtn.onclick = () => {
        // 1. Clear any specific tips relating to the graph
        clearTutorialTips();
        
        // 2. Perform the navigation
        navigateTo(SCREENS.SETS, 'back');
        
        // 3. Cleanup: Hide the cursor line so it doesn't get stuck
        const cursor = document.getElementById('cursorLine');
        if (cursor) cursor.classList.add('hidden');
    };
}

// [app.js] FIX: Connect the Calendar Button & Tutorial Step
const openCalendarBtn = document.getElementById('openCalendarBtn');
if (openCalendarBtn) {
    openCalendarBtn.onclick = () => {
        // 1. Safety Check
        if (!selectedClient) return;

        // 2. Navigate
        navigateTo(SCREENS.CALENDAR, 'forward');

        // 3. TUTORIAL LOGIC: Advance to the next step
        if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
             document.body.dataset.tutorialStage = 'calendar-visited';
             
             // Point to the grid
             setTimeout(() => showTutorialTip('calendarGrid', 'This grid tracks your workout consistency.', -20), 500);
             
             // Then point to the back button
             setTimeout(() => {
                 showTutorialTip('backToSessionsFromCalBtn', 'Tap back to return.', 30, 'left');
             }, 4000);
        }
    };
}

// ==========================================
// FINAL INTERACTION PATCH (The "Missing Links")
// ==========================================

// 1. SETTINGS: Lbs/Kg Toggle Listener (CRITICAL - Was missing)
const unitToggle = document.getElementById('settingUnitToggle');
if (unitToggle) {
    unitToggle.onchange = () => {
        // Trigger the toggle logic
        if (typeof UNIT_mode !== 'undefined') {
            UNIT_mode.toggle();
        }
        
        // TUTORIAL HOOK: If we are in the settings step, this interaction counts
        if (typeof isTutorialMode !== 'undefined' && isTutorialMode) {
            // Optional: You could advance the tutorial here if you wanted, 
            // but the current flow waits for the "End Tutorial" button.
            // We just ensure the tooltip doesn't block visibility.
             clearTutorialTips();
             setTimeout(() => {
                 showTutorialTip('endTutorialBtn', 'You are all set! Tap here to finish.', 40, 'right');
             }, 500);
        }
    };
}


// ==========================================
// ACCOUNT DELETION LOGIC (SAFE LOAD V2)
// ==========================================
window.addEventListener('load', () => {
    
    const btnDeleteAccount = document.getElementById("btnDeleteAccount");

    // Debugging: Check if we actually found the button
    if (!btnDeleteAccount) {
        console.error("⚠️ Delete Button NOT found. Check HTML ID.");
        return;
    }
    
    console.log("✅ Delete Button connected successfully.");

    btnDeleteAccount.onclick = async () => {
        const user = auth.currentUser;

        if (!user) {
            alert("Error: No user currently signed in.");
            return;
        }
        // --- WARNING 1 (Standard Warning) ---
        sendHapticScoreToNative(-1); // <--- ADD THIS (3 Heavy Thuds)

        // --- WARNING 1 ---
        const firstConfirm = confirm(
            "⚠️ DELETE ACCOUNT?\n\nAre you sure you want to delete your account? This will permanently erase all your workouts and history.\n\nThis action cannot be undone."
        );
        if (!firstConfirm) return;
        // --- WARNING 2 (PANIC MODE) ---
        sendHapticScoreToNative(-5); // <--- ADD THIS (5 Rapid Heavy Thuds)

        // --- WARNING 2 (FINAL) ---
        const secondConfirm = confirm(
            "🚨 FINAL WARNING\n\nAll data will be lost forever.\n\nClick OK to permanently delete your account now."
        );
        if (!secondConfirm) return;

        // --- EXECUTE DELETION ---
        try {
            // UI Feedback: Show loading state
            const originalText = btnDeleteAccount.innerHTML; // Save icon/text
            btnDeleteAccount.innerText = "Deleting...";
            btnDeleteAccount.disabled = true;

            // 1. Delete User Data from Firestore
            const db = firebase.firestore();
            // Note: This only deletes the main document. 
            // If you have subcollections, they are usually orphaned but inaccessible. 
            // For a simple app, this satisfies requirements.
            await db.collection('users').doc(user.uid).delete();
            console.log("✅ User data deleted from Firestore");

            // 2. Delete Authentication User
            await user.delete();
            console.log("✅ User auth deleted");

            // 3. Success & Redirect
            alert("Your account has been deleted.");
            window.location.reload(); 

        } catch (error) {
            console.error("Delete Error:", error);
            
            // SPECIAL HANDLING: Requires Recent Login
            if (error.code === 'auth/requires-recent-login') {
                alert("Security Limit: You must have logged in recently to delete your account.\n\nPlease log out, log back in, and try again immediately.");
            } else {
                alert("Error deleting account: " + error.message);
            }

            // Reset button state on error
            btnDeleteAccount.innerHTML = "Delete Account & Data"; // Reset text (loses icon temporarily but functional)
            btnDeleteAccount.disabled = false;
        }
    };
});

function sendHapticScoreToNative(greenScore) {
    // 0. SETTING CHECK
    // If the user disabled haptics, stop immediately.
    if (localStorage.getItem('trunk_setting_haptics') === 'false') return;

    // Check if we are inside the iOS Wrapper (WKWebView)
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.hapticHandler) {
        window.webkit.messageHandlers.hapticHandler.postMessage(greenScore);
    } else {
        console.log("Haptic Debug: Score would be " + greenScore);
    }
}

// =====================================================
// ROBUST IOS KEYBOARD MANAGER (Reference Height Fix)
// =====================================================

function adjustModalPosition() {
    const modalContainer = document.querySelector('.input-modal-card');
    const overlay = document.getElementById('customInputModal');
    
    // Exit if modal isn't open
    if (!overlay || overlay.classList.contains('hidden') || !modalContainer) return;

    if (window.visualViewport) {
        const currentViewportHeight = window.visualViewport.height;
        
        // LOGIC: Compare current viewport vs the "Stable" height we captured earlier.
        // This works even if window.innerHeight shrinks behind the scenes.
        const heightLost = stableWindowHeight - currentViewportHeight;

        // If we lost more than 150px, the keyboard is definitely open.
        if (heightLost > 150) {
            // Shift up by half the keyboard height + a little buffer
            const shiftAmount = Math.floor(heightLost / 2) + 10;
            modalContainer.style.transform = `scale(1) translateY(-${shiftAmount}px)`;
        } else {
            // Keyboard is closed (or closing) -> Reset
            modalContainer.style.transform = 'scale(1) translateY(0)';
        }
    }
}

// 1. Listeners
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjustModalPosition);
    window.visualViewport.addEventListener('scroll', adjustModalPosition);
}

// 2. Safety Poll
// This runs rapidly for 1 second after opening to catch any missed events
let keyboardPollInterval = null;
function startKeyboardPoll() {
    if (keyboardPollInterval) clearInterval(keyboardPollInterval);
    let checks = 0;
    
    // Check every 50ms
    keyboardPollInterval = setInterval(() => {
        adjustModalPosition();
        checks++;
        // Stop after 1 second (20 checks)
        if (checks > 20) clearInterval(keyboardPollInterval); 
    }, 50);
}

// 3. Backup Resize Listener 
// Sometimes rotation or other resizing events happen when modal is closed; update our stable reference.
window.addEventListener('resize', () => {
    // Only update stable height if the modal is CLOSED. 
    // If it's open, we trust the value we captured when it opened.
    const overlay = document.getElementById('customInputModal');
    if (overlay && overlay.classList.contains('hidden')) {
        stableWindowHeight = window.innerHeight;
    }
});

// ==========================================
// ROBUST TIMER PICKER (List vs Editor Logic)
// ==========================================

const TimerPicker = {
    state: {
        minutes: 0,
        seconds: 0,
        isWheelMode: true,
        saveCallback: null
    },
    
    dom: {}, 

    init() {
        // Cache DOM Elements
        this.dom = {
            listView: document.getElementById('timerListView'),
            editorView: document.getElementById('timerEditorView'),
            modalTitle: document.getElementById('timerModalTitle'),
            
            wheelView: document.getElementById('timerWheelView'),
            keypadView: document.getElementById('timerKeypadView'),
            minCol: document.getElementById('pickerMin'),
            secCol: document.getElementById('pickerSec'),
            manualInput: document.getElementById('timerManualInput'),
            
            btnWheel: document.getElementById('modeWheelBtn'),
            btnKeypad: document.getElementById('modeKeypadBtn'),
            btnSave: document.getElementById('saveEditorBtn'),
            btnCancel: document.getElementById('cancelEditorBtn')
        };

        // Safety Check
        if (!this.dom.listView || !this.dom.editorView) {
            console.error("TimerPicker: HTML structure missing.");
            return;
        }

        // --- FIX: REMOVE CSS PADDING TO PREVENT DOUBLE SPACING ---
        // We use JS spacers instead of CSS padding for better scroll snapping.
        if (this.dom.minCol) this.dom.minCol.style.padding = '0';
        if (this.dom.secCol) this.dom.secCol.style.padding = '0';

        this.populateWheels();
        this.bindEvents();
    },

    populateWheels() {
        // Spacer allows the first item (Index 0) to sit exactly in the middle (90px)
        // Container (180px) / 2 = 90px. Item (40px) / 2 = 20px. 90 - 20 = 70px spacer.
        const spacer = `<div style="height: 70px; flex-shrink: 0;"></div>`;
        
        // Minutes (0-60)
        let minHTML = spacer;
        for (let i = 0; i <= 60; i++) {
            minHTML += `<div class="picker-item" style="height:40px; display:flex; align-items:center; justify-content:center; scroll-snap-align:center; font-size:1.5rem; font-weight:600;">${i.toString().padStart(2,'0')}</div>`;
        }
        minHTML += spacer;
        this.dom.minCol.innerHTML = minHTML;

        // Seconds (0-59)
        let secHTML = spacer;
        for (let i = 0; i <= 59; i++) {
            secHTML += `<div class="picker-item" style="height:40px; display:flex; align-items:center; justify-content:center; scroll-snap-align:center; font-size:1.5rem; font-weight:600;">${i.toString().padStart(2,'0')}</div>`;
        }
        secHTML += spacer;
        this.dom.secCol.innerHTML = secHTML;
    },

    bindEvents() {
        // Toggle Wheel/Keypad
        this.dom.btnWheel.onclick = () => this.switchMode(true);
        this.dom.btnKeypad.onclick = () => this.switchMode(false);

        // Cancel Button
        this.dom.btnCancel.onclick = () => {
            this.closeEditor();
        };

        // Save Button
        this.dom.btnSave.onclick = () => {
            const timeStr = `${this.state.minutes}:${this.state.seconds.toString().padStart(2,'0')}`;
            if (this.state.saveCallback) this.state.saveCallback(timeStr);
            this.closeEditor();
        };

        // Scroll Listeners (Debounced)
        let scrollTimeout;
        const onScroll = (type) => {
            clearTimeout(scrollTimeout);
            // Wait 50ms for scroll to settle slightly before updating state
            scrollTimeout = setTimeout(() => this.handleScroll(type), 50);
        };
        this.dom.minCol.onscroll = () => onScroll('min');
        this.dom.secCol.onscroll = () => onScroll('sec');

        // Manual Input Sync
        this.dom.manualInput.oninput = (e) => {
            let val = e.target.value.replace(/[^0-9]/g, '');
            if (val.length > 4) val = val.substring(0, 4);
            
            if (val.length >= 3) {
                this.state.minutes = parseInt(val.slice(0, val.length - 2), 10) || 0;
                this.state.seconds = parseInt(val.slice(-2), 10);
            } else {
                this.state.minutes = 0;
                this.state.seconds = parseInt(val, 10) || 0;
            }
        };
    },

    open(initialTimeStr, onSave) {
        this.state.saveCallback = onSave;
        
        const parts = initialTimeStr.split(':');
        const m = parseInt(parts[0], 10) || 0;
        const s = parseInt(parts[1], 10) || 0;
        this.state.minutes = m;
        this.state.seconds = s;

        // UI Updates
        this.dom.listView.classList.add('hidden');
        this.dom.editorView.classList.remove('hidden');
        this.dom.modalTitle.textContent = "Edit Time"; 

        this.switchMode(true);
        
        // Wait for display change to apply scrollTop
        setTimeout(() => {
            this.dom.minCol.scrollTop = m * 40;
            this.dom.secCol.scrollTop = s * 40;
            this.dom.manualInput.value = initialTimeStr;
        }, 50);
    },

    closeEditor() {
        this.dom.editorView.classList.add('hidden');
        this.dom.listView.classList.remove('hidden');
        this.dom.modalTitle.textContent = "Custom Timers";
    },

    switchMode(isWheel) {
        this.state.isWheelMode = isWheel;
        if (isWheel) {
            this.dom.btnWheel.classList.add('active');
            this.dom.btnWheel.style.background = 'var(--color-card)';
            this.dom.btnKeypad.classList.remove('active');
            this.dom.btnKeypad.style.background = 'transparent';
            
            this.dom.wheelView.classList.remove('hidden');
            this.dom.keypadView.classList.add('hidden');
            
            // Sync wheel to current state
            this.dom.minCol.scrollTop = this.state.minutes * 40;
            this.dom.secCol.scrollTop = this.state.seconds * 40;
        } else {
            this.dom.btnKeypad.classList.add('active');
            this.dom.btnKeypad.style.background = 'var(--color-card)';
            this.dom.btnWheel.classList.remove('active');
            this.dom.btnWheel.style.background = 'transparent';

            this.dom.wheelView.classList.add('hidden');
            this.dom.keypadView.classList.remove('hidden');
            
            const mm = this.state.minutes;
            const ss = this.state.seconds.toString().padStart(2, '0');
            this.dom.manualInput.value = `${mm}:${ss}`;
            this.dom.manualInput.focus();
        }
    },

    handleScroll(type) {
        const col = type === 'min' ? this.dom.minCol : this.dom.secCol;
        // With padding removed, scrollTop 0 = Index 0 (Thanks to the 70px spacer)
        const index = Math.round(col.scrollTop / 40);
        
        if (type === 'min') this.state.minutes = index;
        else this.state.seconds = index;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TimerPicker.init();
});
