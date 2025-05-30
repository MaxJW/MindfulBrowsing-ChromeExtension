// Default settings
const DEFAULT_SETTINGS = {
    timerDuration: 5,
    showSkipButton: true,
    gradientStart: "#667eea",
    gradientEnd: "#764ba2",
};

const DEFAULT_SITES = [
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "reddit.com",
    "tiktok.com",
];

// Load settings
async function loadSettings() {
    const result = await chrome.storage.sync.get(["settings"]);
    const settings = { ...DEFAULT_SETTINGS, ...result.settings };

    document.getElementById("timerDuration").value = settings.timerDuration;
    document.getElementById("showSkipButton").checked = settings.showSkipButton;
    document.getElementById("gradientStart").value = settings.gradientStart;
    document.getElementById("gradientEnd").value = settings.gradientEnd;

    // Apply the gradient colors to UI elements
    applyGradientColors(settings.gradientStart, settings.gradientEnd);
}

// Save settings
async function saveSettings() {
    const settings = {
        timerDuration: parseInt(document.getElementById("timerDuration").value),
        showSkipButton: document.getElementById("showSkipButton").checked,
        gradientStart: document.getElementById("gradientStart").value,
        gradientEnd: document.getElementById("gradientEnd").value,
    };

    await chrome.storage.sync.set({ settings });

    // Apply the new gradient colors immediately
    applyGradientColors(settings.gradientStart, settings.gradientEnd);

    // Show subtle saved feedback
    showSavedFeedback();
}

function showSavedFeedback() {
    // Create or get existing feedback element
    let feedback = document.getElementById('autoSaveFeedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'autoSaveFeedback';
        feedback.className = 'auto-save-feedback';
        feedback.textContent = 'Settings saved';
        document.querySelector('.content').appendChild(feedback);
    }

    // Show feedback
    feedback.classList.add('show');

    // Hide after delay
    setTimeout(() => {
        feedback.classList.remove('show');
    }, 1500);
}

// Load and display sites
async function loadSites() {
    const result = await chrome.storage.sync.get(["mindfulSites"]);
    const sites = result.mindfulSites || [];

    const sitesList = document.getElementById("sitesList");
    sitesList.innerHTML = "";

    if (sites.length === 0) {
        sitesList.innerHTML =
            '<div class="empty-state">No websites added yet<br><small>Add some sites to get started!</small></div>';
        return;
    }

    sites.forEach((site) => {
        const siteItem = document.createElement("div");
        siteItem.className = "site-item";

        const siteUrl = document.createElement("span");
        siteUrl.className = "site-url";
        siteUrl.textContent = site;

        const removeButton = document.createElement("button");
        removeButton.className = "remove-button";
        removeButton.textContent = "Remove";
        removeButton.onclick = () => removeSite(site);

        siteItem.appendChild(siteUrl);
        siteItem.appendChild(removeButton);
        sitesList.appendChild(siteItem);
    });
}

// Add a new site
async function addSite() {
    const input = document.getElementById("newSite");
    const errorDiv = document.getElementById("error");
    const site = input.value.trim().toLowerCase();

    errorDiv.style.display = "none";
    errorDiv.textContent = "";

    if (!site) {
        showError("Please enter a website");
        return;
    }

    if (!site.includes(".") && !site.includes("*")) {
        showError("Please enter a valid domain (e.g., example.com)");
        return;
    }

    const result = await chrome.storage.sync.get(["mindfulSites"]);
    const sites = result.mindfulSites || [];

    if (sites.includes(site)) {
        showError("This website is already in your list");
        return;
    }

    sites.push(site);
    await chrome.storage.sync.set({ mindfulSites: sites });

    input.value = "";
    loadSites();
}

// Remove a site
async function removeSite(siteToRemove) {
    const result = await chrome.storage.sync.get(["mindfulSites"]);
    const sites = result.mindfulSites || [];

    const updatedSites = sites.filter((site) => site !== siteToRemove);
    await chrome.storage.sync.set({ mindfulSites: updatedSites });

    loadSites();
}

// Reset everything
async function resetToDefaults() {
    if (
        confirm("This will reset all settings and websites to defaults. Continue?")
    ) {
        await chrome.storage.sync.set({
            mindfulSites: DEFAULT_SITES,
            settings: DEFAULT_SETTINGS,
        });
        loadSites();
        loadSettings();
    }
}

// Apply gradient colors to UI elements
function applyGradientColors(gradientStart, gradientEnd) {
    const gradient = `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`;

    // Apply to header
    const header = document.querySelector('.header');
    if (header) header.style.background = gradient;

    // Apply to buttons
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) saveButton.style.background = gradient;

    const addButton = document.getElementById('addButton');
    if (addButton) addButton.style.background = gradient;

    // Apply to section icons
    const sectionIcons = document.querySelectorAll('.section-icon');
    sectionIcons.forEach(icon => icon.style.background = gradient);

    // Apply to checkbox slider when checked
    const checkbox = document.getElementById('showSkipButton');
    const slider = checkbox.nextElementSibling;

    if (checkbox.checked) {
        slider.style.background = gradient;
    } else {
        // Reset to default unchecked color
        slider.style.background = '#ccc';
    }

    // Update CSS custom properties for dynamic elements
    document.documentElement.style.setProperty('--gradient-start', gradientStart);
    document.documentElement.style.setProperty('--gradient-end', gradientEnd);
    document.documentElement.style.setProperty('--dynamic-gradient', gradient);
}

function setupRealTimePreview() {
    const gradientStartInput = document.getElementById("gradientStart");
    const gradientEndInput = document.getElementById("gradientEnd");

    function updatePreview() {
        applyGradientColors(gradientStartInput.value, gradientEndInput.value);
    }

    // Update preview in real-time as user drags color picker
    gradientStartInput.addEventListener("input", updatePreview);
    gradientEndInput.addEventListener("input", updatePreview);
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById("error");
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
}

let saveTimeout;

function debouncedSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveSettings, 300); // Save 300ms after user stops changing
}

// Auto-save event listeners
document.getElementById("timerDuration").addEventListener("input", saveSettings);
document.getElementById("showSkipButton").addEventListener("change", saveSettings);
document.getElementById("gradientStart").addEventListener("input", debouncedSave);
document.getElementById("gradientEnd").addEventListener("input", debouncedSave);

// Keep the add site functionality
document.getElementById("addButton").addEventListener("click", addSite);
document.getElementById("newSite").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        addSite();
    }
});
document.getElementById("resetButton").addEventListener("click", resetToDefaults);

// Initialize
setupRealTimePreview();
loadSettings();
loadSites();