document.addEventListener("DOMContentLoaded", () => {

    const clientSelect = document.getElementById("clientSelect");
    const sessionsDiv = document.getElementById("sessionsDiv");
    const exercisesDiv = document.getElementById("exercisesDiv");
    const progressTableDiv = document.getElementById("progressTableDiv");
    const progressGraphDiv = document.getElementById("progressGraphDiv");

    let clientsData = {};

    // --- Automatically detect all JSON files in client_data ---
    // Note: GitHub Pages cannot dynamically list files in a folder,
    // so you still need to provide the filenames here once.
    // We'll make it easier: just add all client JSONs to this array
    const clientFiles = [
        "client_data/Josh.json",
        // Add other clients here: "client_data/Client2.json",
    ];

    async function loadClients() {
        for (const file of clientFiles) {
            try {
                const resp = await fetch(file);
                if (!resp.ok) throw new Error(`Failed to load ${file}`);
                const data = await resp.json();
                clientsData[data.client_name] = data;
            } catch (err) {
                console.error(err);
            }
        }

        // Populate dropdown
        for (const name in clientsData) {
            const opt = document.createElement("option");
            opt.value = name;
            opt.text = name;
            clientSelect.appendChild(opt);
        }
    }

    // --- Event listener for client selection ---
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

        // --- Progress Table ---
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

        // --- Interactive Graph ---
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

    // --- Initialize ---
    loadClients();

});
