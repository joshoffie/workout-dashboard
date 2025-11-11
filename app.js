document.addEventListener("DOMContentLoaded", () => {

    const clientSelect = document.getElementById("clientSelect");
    const sessionsDiv = document.getElementById("sessionsDiv");
    const exercisesDiv = document.getElementById("exercisesDiv");
    const progressTableDiv = document.getElementById("progressTableDiv");
    const progressGraphDiv = document.getElementById("progressGraphDiv");

    let clientsData = {};

    // ----------------------------
    // ✅ Load user JSON from Firebase
    // ----------------------------
    async function loadUserJson() {
        if (!window.currentUser) {
            console.log("User not logged in yet.");
            return;
        }

        const uid = window.currentUser.uid;
        const docRef = doc(window.db, "clients", uid);

        const snap = await getDoc(docRef);

        if (snap.exists()) {
            console.log("Loaded user JSON:", snap.data());
            clientsData = { [snap.data().client_name]: snap.data() };
            populateClientDropdown();
        } else {
            console.log("No profile found — creating new one...");

            // Create a new empty JSON structure
            const newJson = {
                client_name: window.currentUser.displayName || "User",
                sessions: []
            };

            await setDoc(docRef, newJson);
            clientsData = { [newJson.client_name]: newJson };
            populateClientDropdown();
        }
    }

    // ----------------------------
    // Populate dropdown
    // ----------------------------
    function populateClientDropdown() {
        clientSelect.innerHTML = `<option value="">-- Select --</option>`;
        for (const name in clientsData) {
            const opt = document.createElement("option");
            opt.value = name;
            opt.text = name;
            clientSelect.appendChild(opt);
        }
    }

    // ----------------------------
    // When user selects themselves
    // ----------------------------
    clientSelect.addEventListener("change", (e) => {
        const clientName = e.target.value;
        if (clientName) showSessions(clientName);
    });

    function showSessions(clientName) {
        const client = clientsData[clientName];
        sessionsDiv.innerHTML = "<h3>Your Sessions:</h3>";
        exercisesDiv.innerHTML = "";
        progressTableDiv.innerHTML = "";
        progressGraphDiv.innerHTML = "";

        client.sessions.forEach((sess, idx) => {
            const btn = document.createElement("button");
            btn.textContent = sess.session_name;
            btn.onclick = () => showExercises(clientName, idx);
            sessionsDiv.appendChild(btn);
        });
    }

    function showExercises(clientName, sessionIdx) {
        const session = clientsData[clientName].sessions[sessionIdx];
        exercisesDiv.innerHTML = "<h4>Exercises:</h4>";
        progressTableDiv.innerHTML = "";
        progressGraphDiv.innerHTML = "";

        session.exercises.forEach((ex, idx) => {
            const btn = document.createElement("button");
            btn.textContent = ex.exercise;
            btn.onclick = () => showProgress(clientName, sessionIdx, idx);
            exercisesDiv.appendChild(btn);
        });
    }

    function showProgress(clientName, sessionIdx, exerciseIdx) {
        const ex = clientsData[clientName].sessions[sessionIdx].exercises[exerciseIdx];

        let html = "<h4>Set Progress:</h4><table><tr><th>Reps</th><th>Weight</th><th>Volume</th><th>Notes</th><th>Timestamp</th></tr>";
        ex.sets.forEach(s => {
            html += `<tr>
                        <td>${s.reps}</td>
                        <td>${s.weight}</td>
                        <td>${s.volume}</td>
                        <td>${s.notes}</td>
                        <td>${s.timestamp}</td>
                     </tr>`;
        });
        html += "</table>";
        progressTableDiv.innerHTML = html;

        // Graph
        const dates = ex.sets.map(s => s.timestamp);
        const reps = ex.sets.map(s => s.reps);
        const weight = ex.sets.map(s => s.weight);
        const volume = ex.sets.map(s => s.volume);
        const wpr = ex.sets.map(s => s.volume / s.reps);

        const traces = [
            { x: dates, y: reps, type: 'scatter', mode: 'lines+markers', name: 'Reps' },
            { x: dates, y: weight, type: 'scatter', mode: 'lines+markers', name: 'Weight' },
            { x: dates, y: volume, type: 'scatter', mode: 'lines+markers', name: 'Volume' },
            { x: dates, y: wpr, type: 'scatter', mode: 'lines+markers', name: 'Weight/Rep' }
        ];

        Plotly.newPlot(progressGraphDiv, traces, { title: `${ex.exercise} Progress`, hovermode: 'x unified' });
    }

    // ----------------------------
    // Detect login and load JSON
    // ----------------------------
    document.addEventListener("firebaseLoaded", loadUserJson);
    
    // If Firebase already fired auth state before DOM loaded
    setTimeout(loadUserJson, 1000);
});
