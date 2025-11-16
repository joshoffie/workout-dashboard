// ... existing code ... -->
function aggregateStats(setsArray) {
  if (!setsArray || setsArray.length === 0) {
// ... existing code ... -->
  const avgWpr = totalReps > 0 ? (totalVolume / totalReps) : 0; // Avg Weight per Rep

  return { sets: totalSets, reps: totalReps, volume: totalVolume, wpr: avgWpr };
}

// --- NEW (STEP 3A) ---
/**
 * Updates a single stat row in the comparison banner.
 * @param {string} statName - The prefix ('sets', 'reps', 'volume', 'wpr')
 * @param {number} currentValue - The current workout's value
 * @param {number} previousValue - The previous workout's value
 */
function updateStatUI(statName, currentValue, previousValue) {
  const arrowEl = document.getElementById(statName + 'Arrow');
  const spiralEl = document.getElementById(statName + 'Spiral');
  
  if (!arrowEl || !spiralEl) {
    console.warn(`Could not find UI elements for stat: ${statName}`);
    return;
  }

  let status = 'neutral';
  let arrow = '—'; // Neutral arrow

  // Use a small epsilon for floating point comparison (for wpr)
  const epsilon = 0.01; 

  if (currentValue > previousValue + epsilon) {
    status = 'increase';
    arrow = '▲'; // Up arrow
  } else if (currentValue < previousValue - epsilon) {
    status = 'decrease';
    arrow = '▼'; // Down arrow
  }

  // Update Arrow
  arrowEl.textContent = arrow;
  arrowEl.classList.remove('increase', 'decrease', 'neutral');
  arrowEl.classList.add(status);

  // Update Spiral
  spiralEl.classList.remove('increase', 'decrease', 'neutral');
  spiralEl.classList.add(status);
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
  
  console.log("--- WORKOUT COMPARISON (STEP 3A) ---"); // <-- Updated log
  
  // 1. Get all sets and sort them, most recent first
// ... existing code ... -->
  const previousDaySets = allSets.filter(set => isSameDay(new Date(set.timestamp), previousWorkoutDate));

  // 8. Aggregate stats for both days
  const currentStats = aggregateStats(currentDaySets);
  const prevStats = aggregateStats(previousDaySets);

  // 9. Log everything to the console for this step
  console.log(`[runComparisonLogic] Most Recent Date: ${mostRecentDate.toDateString()}`);
  console.log("[runComparisonLogic] Current Stats:", currentStats);
  console.log(`[runComparisonLogic] Previous Workout Date: ${previousWorkoutDate.toDateString()}`);
  console.log("[runComparisonLogic] Previous Stats:", prevStats);
  console.log("-------------------------------------");
  
  // --- MODIFIED (STEP 3A) ---
  // Hook up the data to the UI
  updateStatUI('sets', currentStats.sets, prevStats.sets);
  updateStatUI('reps', currentStats.reps, prevStats.reps);
  updateStatUI('volume', currentStats.volume, prevStats.volume);
  updateStatUI('wpr', currentStats.wpr, prevStats.wpr);
  
  // Show the banner
  banner.classList.remove('hidden');
}


// ------------------ EDIT MODE ------------------
// ... existing code ... -->
