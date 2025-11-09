const clientSelect = document.getElementById("clientSelect");
let clientsData = {};

// List of client JSON files
const clientFiles = ["client_data/Josh.json"]; // add more JSON filenames as needed

async function loadClients() {
    for (const file of clientFiles) {
        const resp = await fetch(file);
        const data = await resp.json();
        clientsData[data.client_name] = data;
    }

    // Populate client dropdown
    for (const clientName in clientsData) {
        const opt = document.createElement("option");
        opt.value = clientName;
        opt.text = clientName;
        clientSelect.appendChild(opt);
    }
}

clientSelect.addEventListener("change", (e) => {
    const clientName = e.target.value;
    if (clientName) {
        showSessions(clientName);
    }
});

function showSessions(clientName) {
    document.getElementById("sessionsList").innerHTML = "<p>Sessions will appear here.</p>";
    document.getElementById("exercisesList").innerHTML = "";
    document.getElementById("progressTable").innerHTML = "";
    document.getElementById("progressGraph").innerHTML = "";
}

// Load clients on page load
loadClients();
