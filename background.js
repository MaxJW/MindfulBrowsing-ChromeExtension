// Default sites
const DEFAULT_SITES = [
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'youtube.com',
    'reddit.com',
    'tiktok.com'
  ];

  // Track tabs that have already shown the timer
  const processedTabs = new Set();

  // Initialize storage with default sites
  chrome.runtime.onInstalled.addListener(async () => {
    const result = await chrome.storage.sync.get(['mindfulSites']);
    if (!result.mindfulSites) {
      await chrome.storage.sync.set({ mindfulSites: DEFAULT_SITES });
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

  // Listen for navigation events
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    // Only process main frame navigations
    if (details.frameId !== 0) return;

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

  // Clean up processed tabs when they're closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    const keysToRemove = [];
    for (const key of processedTabs) {
      if (key.startsWith(`${tabId}-`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => processedTabs.delete(key));
  });