(function () {
    // Get settings from URL parameters
    const params = new URLSearchParams(window.location.search);
    const settings = {
        duration: parseInt(params.get('duration')) || 5,
        showSkip: params.get('showSkip') === 'true',
        gradientStart: params.get('gradientStart') || '#667eea',
        gradientEnd: params.get('gradientEnd') || '#764ba2',
        customText: params.get('customText') || 'Take a moment to breathe'
    };

    // Apply custom text to the title
    const title = document.querySelector('h1');
    if (title) title.textContent = settings.customText;

    // Apply gradient colors
    const overlay = document.getElementById('mindful-overlay');
    overlay.style.background = `linear-gradient(135deg, ${settings.gradientStart} 0%, ${settings.gradientEnd} 100%)`;

    // Hide skip button if needed
    const skipButton = document.querySelector('.skip-button');
    if (!settings.showSkip) skipButton.style.display = 'none';

    // Update timer duration
    const timerText = document.querySelector('.timer-text');
    const progressCircle = document.querySelector('.timer-progress');

    let secondsLeft = settings.duration;
    timerText.textContent = secondsLeft;

    // Update circle animation duration
    progressCircle.style.transition = `stroke-dashoffset ${settings.duration}s linear`;

    let timerInterval;

    function startTimer() {
        setTimeout(() => {
            progressCircle.classList.add('active');
        }, 100);

        timerInterval = setInterval(() => {
            secondsLeft--;
            timerText.textContent = secondsLeft;

            if (secondsLeft <= 0) {
                clearInterval(timerInterval);
                closeOverlay('completed');
            }
        }, 1000);
    }

    function closeOverlay(reason = 'skipped') {
        overlay.classList.add('fade-out');

        setTimeout(() => {
            window.parent.postMessage({ type: 'mindful-close', reason: reason }, '*');
        }, 500);
    }

    skipButton.addEventListener('click', () => {
        clearInterval(timerInterval);
        closeOverlay('skipped');
    });

    startTimer();
})();