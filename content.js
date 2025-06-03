(function () {
    if (window.mindfulBrowsingInjected) return;
    window.mindfulBrowsingInjected = true;

    async function injectOverlay() {
        if (!document.body) {
            setTimeout(injectOverlay, 10);
            return;
        }

        // Get settings
        const result = await chrome.storage.sync.get(['settings']);
        const settings = {
            timerDuration: 5,
            showSkipButton: true,
            gradientStart: '#667eea',
            gradientEnd: '#764ba2',
            customText: 'Take a moment to breathe',
            ...result.settings
        };

        // Notify background script that timer has started
        chrome.runtime.sendMessage({
            type: 'timer-started',
            duration: settings.timerDuration
        });

        // Create iframe with settings as URL parameters
        const iframe = document.createElement('iframe');
        iframe.id = 'mindful-overlay-iframe';
        const params = new URLSearchParams({
            duration: settings.timerDuration,
            showSkip: settings.showSkipButton,
            gradientStart: settings.gradientStart,
            gradientEnd: settings.gradientEnd,
            customText: settings.customText
        });
        iframe.src = chrome.runtime.getURL(`overlay.html?${params.toString()}`);
        iframe.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
            z-index: 2147483647;
            background: transparent;
            pointer-events: auto;
        `;

        const originalOverflow = document.body.style.overflow || '';
        document.body.style.overflow = 'hidden';

        document.documentElement.appendChild(iframe);

        function handleMessage(event) {
            if (event.source !== iframe.contentWindow) return;

            if (event.data.type === 'mindful-close') {
                // Notify background script based on how the timer ended
                chrome.runtime.sendMessage({
                    type: event.data.reason === 'completed' ? 'timer-completed' : 'timer-skipped'
                });

                window.removeEventListener('message', handleMessage);
                iframe.remove();
                document.body.style.overflow = originalOverflow;
                delete window.mindfulBrowsingInjected;
                clearInterval(checkInterval);
            }
        }

        window.addEventListener('message', handleMessage);

        let checkInterval = setInterval(() => {
            if (iframe.parentNode) {
                iframe.style.zIndex = '2147483647';
            } else {
                clearInterval(checkInterval);
            }
        }, 100);
    }

    injectOverlay();
})();