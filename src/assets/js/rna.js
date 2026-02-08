import { createTimeline, set, stagger } from './anime.js';

/**
 * RNA Sequence Logic
 */

const CONFIG = {
    slideDuration: 800,
    waveDuration: 2000,
    holdDuration: 2000,
};

let rnaData = [];
let sequenceList = [];
let currentIndex = 0;
let isAnimating = false;

// DOM Elements
let container;
let activeLine = null;
let nextLine = null;

function initRna() {
    const dataEl = document.getElementById('rna-sequences-data');
    if (!dataEl) return;

    try { rnaData = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!rnaData?.length) return;

    container = document.querySelector('.rna-sequence');
    if (!container) return;

    // Wait for fonts to load to ensure accurate width calculations
    // Add a timeout fallback in case fonts hang
    const fontPromise = document.fonts.ready;
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1000));

    Promise.race([fontPromise, timeoutPromise]).then(() => {
        startApp();
    });
}

function startApp() {
    console.log('startApp called');
    // Shuffle for random start on every refresh
    shuffleArray(rnaData);
    sequenceList = rnaData;

    // Pick a random start index to ensure variety
    currentIndex = Math.floor(Math.random() * sequenceList.length);

    container.innerHTML = '';
    container.dataset.rnaReady = "true";

    activeLine = createLineElement();
    nextLine = createLineElement();

    container.appendChild(activeLine);
    container.appendChild(nextLine);

    // Initial Render
    renderContentToLine(activeLine, sequenceList[currentIndex]);

    // Align and Show
    alignLine(activeLine);
    set(activeLine, { opacity: 1 });

    // Prepare Next Line
    set(nextLine, { translateX: '-100vw', opacity: 0 });

    // Start Loop
    console.log('Scheduling animateLoop');
    setTimeout(animateLoop, CONFIG.holdDuration);
}

function animateLoop() {
    console.log('animateLoop called, isAnimating:', isAnimating);
    if (isAnimating) return;
    isAnimating = true;

    // Prepare Next Line Content
    currentIndex = (currentIndex + 1) % sequenceList.length;
    renderContentToLine(nextLine, sequenceList[currentIndex]);

    // Calculate Alignment
    const nextLineTargetX = calculateCenteredX(nextLine);
    const startX = nextLineTargetX - window.innerWidth;

    set(nextLine, {
        translateX: startX,
        opacity: 1
    });

    const activeLineCurrentX = calculateCenteredX(activeLine);
    const activeLineTargetX = activeLineCurrentX + window.innerWidth;

    console.log('Creating timeline');
    // Create Timeline
    const timeline = createTimeline({
        autoplay: true,
        easing: 'easeInOutQuad'
    });

    timeline.then(() => {
        console.log('Timeline promise resolved');
        // Swap References
        const temp = activeLine;
        activeLine = nextLine;
        nextLine = temp;

        // Reset the "old" active line
        set(nextLine, { opacity: 0 });

        isAnimating = false;
        setTimeout(animateLoop, CONFIG.holdDuration);
    });

    // ... (add animations) ...

    timeline.play(); // Explicitly play

    // 1. Slide Transition
    timeline
        .add({
            targets: activeLine,
            translateX: activeLineTargetX,
            duration: CONFIG.slideDuration,
            easing: 'easeInQuad'
        }, 0)
        .add({
            targets: nextLine,
            translateX: [startX, nextLineTargetX],
            duration: CONFIG.slideDuration,
            easing: 'easeOutQuad'
        }, 0);

    // 2. Wave Animation on Next Line
    const chars = nextLine.querySelectorAll('.rna-phrase-char');
    console.log('Found chars:', chars.length);

    timeline.add({
        targets: chars,
        translateZ: [
            { value: 0, duration: 0 },
            { value: 400, duration: CONFIG.waveDuration / 2 },
            { value: 0, duration: CONFIG.waveDuration / 2 }
        ],
        scale: [
            { value: 1, duration: 0 },
            { value: 2.0, duration: CONFIG.waveDuration / 2 },
            { value: 1, duration: CONFIG.waveDuration / 2 }
        ],
        opacity: [
            { value: 0.8, duration: 0 },
            { value: 1, duration: CONFIG.waveDuration / 2 },
            { value: 0.8, duration: CONFIG.waveDuration / 2 }
        ],
        delay: stagger(100, { from: 'center', start: 0 }),
        easing: 'easeInOutSine'
    }, '-=600');

    // Update static text
    const currentData = sequenceList[currentIndex];
    updateText('[data-rna-root]', currentData.root);
    updateText('[data-rna-phrase]', currentData.phrase);
}

function createLineElement() {
    const el = document.createElement('div');
    el.classList.add('rna-sequence-line');
    return el;
}

function renderContentToLine(lineEl, dataItem) {
    // Fillers: Join all sequences
    let fillerText = "";
    rnaData.forEach(item => {
        fillerText += item.sequence;
    });

    // Repeat to ensure length
    while (fillerText.length < 300) {
        fillerText += fillerText;
    }

    const fillersHtml = `<span class="rna-fillers">${fillerText}</span>`;

    // Use sequence instead of phrase for the scrolling line
    const phraseHtml = dataItem.sequence.split('').map(c =>
        `<span class="rna-phrase-char" style="display:inline-block; white-space:pre;">${c}</span>`
    ).join('');

    const phraseWrapper = `<span class="rna-phrase-wrapper">${phraseHtml}</span>`;

    lineEl.innerHTML = fillersHtml + phraseWrapper;
}

function calculateCenteredX(lineEl) {
    const phraseWrapper = lineEl.querySelector('.rna-phrase-wrapper');
    const fillerSpan = lineEl.querySelector('.rna-fillers');

    if (!phraseWrapper || !fillerSpan) return 0;

    // Use getBoundingClientRect for sub-pixel precision
    const fillersWidth = fillerSpan.getBoundingClientRect().width;
    const phraseWidth = phraseWrapper.getBoundingClientRect().width;
    const screenWidth = window.innerWidth;

    // Goal: Center of Phrase (pink) = Center of Screen
    // Left of Phrase = x + fillersWidth
    // Center of Phrase = x + fillersWidth + (phraseWidth / 2)
    // screenWidth / 2 = x + fillersWidth + (phraseWidth / 2)
    // x = (screenWidth / 2) - fillersWidth - (phraseWidth / 2)

    return (screenWidth / 2) - fillersWidth - (phraseWidth / 2);
}

function alignLine(lineEl) {
    const x = calculateCenteredX(lineEl);
    set(lineEl, { translateX: x });
}

function updateText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRna);
} else {
    initRna();
}
