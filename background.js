// Default sites
const DEFAULT_SITES = [
    'facebook.com',
    'x.com',
    'reddit.com',
    'instagram.com',
    'youtube.com'
];

// Track tabs that have already shown the timer
const processedTabs = new Set();

// Track tabs with active timers
const activeTimers = new Map();

// Track tabs that should be exempted from timer (opened from same site)
const exemptedTabs = new Set();

// Track visited mindful sites per tab (tabId -> Set of domains)
const tabMindfulHistory = new Map();

// Track original mute state of tabs before we mute them
const originalMuteStates = new Map();

// Initialize storage with default sites
chrome.runtime.onInstalled.addListener(async () => {
    const result = await chrome.storage.sync.get(['mindfulSites', 'stats']);
    if (!result.mindfulSites) {
        await chrome.storage.sync.set({ mindfulSites: DEFAULT_SITES });
    }
    if (!result.stats) {
        await chrome.storage.sync.set({ stats: { tabsClosed: 0 } });
    }
});

// Get the current list of mindful sites
async function getMindfulSites() {
    const result = await chrome.storage.sync.get(['mindfulSites']);
    return result.mindfulSites || DEFAULT_SITES;
}

// Check if a URL matches any mindful site
function matchesMindfulSite(url, mindfulSites) {
    const hostname = url.hostname.replace('www.', '').toLowerCase();
    return mindfulSites.some(site => {
        const pattern = site.toLowerCase().replace('www.', '');
        // Support wildcards
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(hostname);
        }
        // Check if hostname includes the pattern
        return hostname.includes(pattern) || hostname === pattern;
    });
}

// Extract domain from URL
function getDomain(url) {
    try {
        return new URL(url).hostname.replace('www.', '').toLowerCase();
    } catch {
        return null;
    }
}

// Check if a domain has been visited before in this tab
function hasMindfulSiteBeenVisited(tabId, domain) {
    const visitedSites = tabMindfulHistory.get(tabId);
    return visitedSites && visitedSites.has(domain);
}

// Mark a mindful domain as visited in this tab
function markMindfulSiteAsVisited(tabId, domain) {
    if (!tabMindfulHistory.has(tabId)) {
        tabMindfulHistory.set(tabId, new Set());
    }
    tabMindfulHistory.get(tabId).add(domain);
    console.log(`Marked ${domain} as visited in tab ${tabId}`);
}

// Mute a tab and store its original state
async function muteTab(tabId) {
    try {
        // Get current tab info to check original mute state
        const tab = await chrome.tabs.get(tabId);

        // Store the original mute state
        originalMuteStates.set(tabId, tab.mutedInfo?.muted || false);

        // Mute the tab
        await chrome.tabs.update(tabId, { muted: true });
        console.log(`Muted tab ${tabId} (was ${tab.mutedInfo?.muted ? 'muted' : 'unmuted'})`);
    } catch (error) {
        console.error('Error muting tab:', error);
    }
}

// Restore original mute state of a tab
async function restoreTabMuteState(tabId) {
    try {
        const originalState = originalMuteStates.get(tabId);
        if (originalState !== undefined) {
            await chrome.tabs.update(tabId, { muted: originalState });
            console.log(`Restored tab ${tabId} mute state to: ${originalState ? 'muted' : 'unmuted'}`);
            originalMuteStates.delete(tabId);
        }
    } catch (error) {
        console.error('Error restoring tab mute state:', error);
    }
}

// Listen for tab creation to track same-site openings
chrome.tabs.onCreated.addListener(async (tab) => {
    // Check if this tab has an opener
    if (tab.openerTabId) {
        try {
            // Get the opener tab
            const openerTab = await chrome.tabs.get(tab.openerTabId);
            const mindfulSites = await getMindfulSites();

            // Get domains for both tabs
            const newTabDomain = getDomain(tab.url || tab.pendingUrl);
            const openerTabDomain = getDomain(openerTab.url);

            // If both tabs are from mindful sites, check if they're the same domain
            if (newTabDomain && openerTabDomain) {
                const newTabIsMindful = mindfulSites.some(site => {
                    const pattern = site.toLowerCase().replace('www.', '');
                    if (pattern.includes('*')) {
                        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                        return regex.test(newTabDomain);
                    }
                    return newTabDomain.includes(pattern) || newTabDomain === pattern;
                });

                const openerTabIsMindful = mindfulSites.some(site => {
                    const pattern = site.toLowerCase().replace('www.', '');
                    if (pattern.includes('*')) {
                        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                        return regex.test(openerTabDomain);
                    }
                    return openerTabDomain.includes(pattern) || openerTabDomain === pattern;
                });

                // If both are mindful sites and from the same domain, exempt the new tab
                if (newTabIsMindful && openerTabIsMindful && newTabDomain === openerTabDomain) {
                    exemptedTabs.add(tab.id);
                    console.log(`Tab ${tab.id} exempted from timer (opened from same site: ${newTabDomain})`);
                }
            }
        } catch (error) {
            console.error('Error checking opener tab:', error);
        }
    }
});

// Listen for navigation events
chrome.webNavigation.onCommitted.addListener(async (details) => {
    // Only process main frame navigations
    if (details.frameId !== 0) return;

    // Check if this tab is exempted from showing timer
    if (exemptedTabs.has(details.tabId)) {
        console.log(`Skipping timer for exempted tab ${details.tabId}`);
        exemptedTabs.delete(details.tabId); // Clean up after use
        return;
    }

    // Check if we've already processed this tab
    const tabKey = `${details.tabId}-${details.url}`;
    if (processedTabs.has(tabKey)) {
        processedTabs.delete(tabKey);
        return;
    }

    try {
        const url = new URL(details.url);
        const mindfulSites = await getMindfulSites();

        // Check if this is a mindful site
        if (matchesMindfulSite(url, mindfulSites)) {
            const domain = getDomain(details.url);

            // Check if this mindful domain has been visited before in this tab
            if (hasMindfulSiteBeenVisited(details.tabId, domain)) {
                console.log(`Skipping timer for ${domain} in tab ${details.tabId} (previously visited)`);
                return;
            }

            // Mark this domain as visited before showing the timer
            markMindfulSiteAsVisited(details.tabId, domain);

            // Inject the content script
            await chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                files: ['content.js'],
                injectImmediately: true
            });

            // Mark this tab as processed
            processedTabs.add(tabKey);
        }
    } catch (error) {
        console.error('Error processing navigation:', error);
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'timer-started') {
        // Track that this tab has an active timer
        activeTimers.set(sender.tab.id, {
            startTime: Date.now(),
            duration: request.duration
        });

        // Mute the tab when timer starts
        muteTab(sender.tab.id);
    } else if (request.type === 'timer-completed' || request.type === 'timer-skipped') {
        // Remove from active timers
        activeTimers.delete(sender.tab.id);

        // Restore original mute state when timer ends
        restoreTabMuteState(sender.tab.id);
    }
});

// Clean up processed tabs and check for active timers when they're closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
    // Check if this tab had an active timer
    if (activeTimers.has(tabId)) {
        // Increment the counter
        const result = await chrome.storage.sync.get(['stats']);
        const stats = result.stats || { tabsClosed: 0 };
        stats.tabsClosed++;
        await chrome.storage.sync.set({ stats });

        // Remove from active timers
        activeTimers.delete(tabId);
    }

    // Clean up exempted tabs
    exemptedTabs.delete(tabId);

    // Clean up tab history tracking
    tabMindfulHistory.delete(tabId);

    // Clean up mute state tracking
    originalMuteStates.delete(tabId);

    // Remove all entries for this tab
    const keysToRemove = [];
    for (const key of processedTabs) {
        if (key.startsWith(`${tabId}-`)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => processedTabs.delete(key));
});