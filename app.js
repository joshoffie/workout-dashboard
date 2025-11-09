const clientSelect = document.getElementById("clientSelect");
let clientsData = {};
const clientFiles = ["client_data/Josh.json"]; // add JSON filenames here

// Load all clients
async function loadClients() {
    for (const file of clientFiles) {
        const resp = await fetch(file);
        const data = await resp.json();
        clientsData[data.client_name] = data;
    }

    for (const name in clientsData) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.text = name;
        clientSelect.appendChild(opt);
    }
}

clientSelect.addEventListener("change", (e) => {
    const name = e.target.value;
    if (name) showSessions(name);
});

function showSessions(clientName) {
    const client = clientsData[clientName];
    const div = document.getElementById("sessionsDiv");
    div.innerHTML = "<h3>Your Sessions:</h3>";
    client.sessions.forEach((sess, idx) => {
        const btn = document.createElement("button");
        btn.textContent = sess.session_name;
        btn.onclick = () => showExercises(clientName, idx);
        div.appendChild(btn);
    });

    document.getElementById("exercisesDiv").innerHTML = "";
    document.getElementById("progressTableDiv").innerHTML = "";
    document.getElementById("progressGraphDiv").innerHTML = "";
}

function showExercises(clientName, sessionIdx) {
    const client = clientsData[clientName];
    const session = client.sessions[sessionIdx];
    const div = document.getElementById("exercisesDiv");
    div.innerHTML = "<h4>Exercises:</h4>";
    
    session.exercises.forEach((ex, idx) => {
        const btn = document.createElement("button");
        btn.textContent = ex.exercise;
        btn.onclick = () => showProgress(clientName, sessionIdx, idx);
        div.appendChild(btn);
    });

    document.getElementById("progressTableDiv").innerHTML = "";
    document.getElementById("progressGraphDiv").innerHTML = "";
}

function showProgress(clientName, sessionIdx, exerciseIdx) {
    const ex = clientsData[clientName].sessions[sessionIdx].exercises[exerciseIdx];

    // --- Progress Table ---
    const tableDiv = document.getElementById("progressTableDiv");
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
    tableDiv.innerHTML = html;

    // --- Simple Graph ---
    const graphDiv = document.getElementById("progressGraphDiv");
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

    Plotly.newPlot(graphDiv, traces, { title: `${ex.exercise} Progress`, hovermode: 'x unified' });
}

// --- Initialize ---
loadClients();
