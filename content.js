(function () {
    if (window.mindfulBrowsingInjected) return;
    window.mindfulBrowsingInjected = true;

    let originalMediaStates = [];

    function pauseAllMedia() {
        originalMediaStates = [];

        // Handle video elements
        const videos = document.querySelectorAll('video');
        videos.forEach((video, index) => {
            originalMediaStates.push({
                element: video,
                type: 'video',
                wasPaused: video.paused,
                wasMuted: video.muted,
                volume: video.volume
            });

            if (!video.paused) {
                video.pause();
            }
            video.muted = true;
        });

        // Handle audio elements
        const audios = document.querySelectorAll('audio');
        audios.forEach((audio, index) => {
            originalMediaStates.push({
                element: audio,
                type: 'audio',
                wasPaused: audio.paused,
                wasMuted: audio.muted,
                volume: audio.volume
            });

            if (!audio.paused) {
                audio.pause();
            }
            audio.muted = true;
        });

        if (window.AudioContext || window.webkitAudioContext) {
            // Store reference to suspend audio contexts
            window.mindfulAudioContexts = [];
            if (window.AudioContext) {
                const originalAudioContext = window.AudioContext;
                window.AudioContext = function (...args) {
                    const ctx = new originalAudioContext(...args);
                    window.mindfulAudioContexts.push(ctx);
                    ctx.suspend();
                    return ctx;
                };
            }
        }

        console.log('Paused and muted all media elements:', originalMediaStates.length);
    }

    function restoreAllMedia() {
        originalMediaStates.forEach(state => {
            const element = state.element;
            if (element && element.parentNode) { // Make sure element still exists
                // Restore muted state
                element.muted = state.wasMuted;
                element.volume = state.volume;

                // Only resume playing if it was playing before
                if (!state.wasPaused) {
                    element.play().catch(e => {
                        // Handle autoplay restrictions gracefully
                        console.log('Could not resume media playback:', e);
                    });
                }
            }
        });

        // **NEW: Resume audio contexts**
        if (window.mindfulAudioContexts) {
            window.mindfulAudioContexts.forEach(ctx => {
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }
            });
            delete window.mindfulAudioContexts;
        }

        originalMediaStates = [];
        console.log('Restored all media states');
    }

    function setupMediaObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
                            // Immediately pause and mute new media elements
                            node.pause();
                            node.muted = true;
                        }
                        // Also check for media elements within added nodes
                        const mediaElements = node.querySelectorAll && node.querySelectorAll('video, audio');
                        if (mediaElements) {
                            mediaElements.forEach(media => {
                                media.pause();
                                media.muted = true;
                            });
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }

    async function injectOverlay() {
        if (!document.body) {
            setTimeout(injectOverlay, 10);
            return;
        }

        pauseAllMedia();

        const mediaObserver = setupMediaObserver();

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
                restoreAllMedia();
                mediaObserver.disconnect();

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