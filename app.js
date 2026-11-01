/**
 * Common Phrases — Pure Minimalist & Mobile-Optimized Application
 */

(function () {
  'use strict';

  // --- STATE ---
  let allPhrases = [];
  let filteredPhrases = [];
  let currentIndex = 0;
  let isFlipped = false;
  let currentView = 'card'; // 'card' | 'list' | 'quiz'
  let activeCategory = 'all';
  let searchQuery = '';

  // DOM Elements
  const els = {
    audioEl: document.getElementById('phrase-audio'),

    // Top Bar
    btnOpenCategories: document.getElementById('btn-open-categories'),
    currentCatDisplay: document.getElementById('current-cat-display'),
    viewSwitchButtons: document.querySelectorAll('.view-switch-btn'),
    cardCounter: document.getElementById('card-counter'),
    progressIndicator: document.getElementById('progress-indicator'),

    // Screens
    screenCard: document.getElementById('screen-card'),
    screenList: document.getElementById('screen-list'),
    screenQuiz: document.getElementById('screen-quiz'),

    // Flashcard Elements
    cardTouchZone: document.getElementById('card-touch-zone'),
    flashcard: document.getElementById('flashcard'),
    frontText: document.getElementById('front-text'),
    backText: document.getElementById('back-text'),
    frontCardNumber: document.getElementById('front-card-number'),
    backCardNumber: document.getElementById('back-card-number'),
    btnPlayFront: document.getElementById('btn-play-front'),
    btnPlayBack: document.getElementById('btn-play-back'),
    waveFront: document.getElementById('wave-front'),
    waveBack: document.getElementById('wave-back'),

    // Navigation Buttons
    btnPrev: document.getElementById('btn-prev'),
    btnFlip: document.getElementById('btn-flip'),
    btnNext: document.getElementById('btn-next'),

    // List Screen
    listContainer: document.getElementById('list-container'),

    // Quiz Screen
    quizEnText: document.getElementById('quiz-en-text'),
    btnQuizAudio: document.getElementById('btn-quiz-audio'),
    quizChoices: document.getElementById('quiz-choices'),
    quizStatus: document.getElementById('quiz-status'),
    quizScore: document.getElementById('quiz-score'),
    btnQuizNext: document.getElementById('btn-quiz-next'),

    // Category Bottom Sheet
    sheetOverlay: document.getElementById('sheet-overlay'),
    categorySheet: document.getElementById('category-sheet'),
    btnCloseSheet: document.getElementById('btn-close-sheet'),
    sheetSearchInput: document.getElementById('sheet-search-input'),
    categorySheetList: document.getElementById('category-sheet-list'),

    toast: document.getElementById('toast')
  };

  // Touch Swipe Variables
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let hasSwiped = false;

  // --- INITIALIZATION ---
  function init() {
    if (window.PHRASES_DATA && Array.isArray(window.PHRASES_DATA)) {
      allPhrases = window.PHRASES_DATA;
    } else {
      console.error('Data not loaded');
      return;
    }

    renderCategorySheet();
    applyFilters();
    bindEvents();
    renderCurrentCard();
    setupMobileAudioUnlock();
  }

  // --- AUDIO UNLOCK FOR MOBILE (IOS SAFARI / ANDROID) ---
  // Mobile browsers restrict audio playback unless unlocked during a user touch/click.
  let isAudioUnlocked = false;
  function setupMobileAudioUnlock() {
    const unlock = () => {
      if (isAudioUnlocked) return;
      // Prime the audio element silently
      els.audioEl.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      els.audioEl.play().then(() => {
        els.audioEl.pause();
        isAudioUnlocked = true;
      }).catch(() => {});
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('click', unlock, true);
    };
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('click', unlock, true);
  }

  // --- CATEGORY BOTTOM SHEET ---
  function openCategorySheet() {
    els.sheetOverlay.classList.add('open');
    els.categorySheet.classList.add('open');
  }

  function closeCategorySheet() {
    els.sheetOverlay.classList.remove('open');
    els.categorySheet.classList.remove('open');
  }

  function renderCategorySheet() {
    const catMap = new Map();
    allPhrases.forEach(p => {
      catMap.set(p.category, (catMap.get(p.category) || 0) + 1);
    });

    let html = `
      <button class="sheet-item ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">
        <span>📚 All Phrases</span>
        <span class="sheet-item-count">${allPhrases.length}</span>
      </button>
    `;

    for (const [cat, count] of catMap.entries()) {
      const cleanTitle = cat.replace(/^[A-Z]\.\s*/, '');
      const isActive = activeCategory === cat;
      html += `
        <button class="sheet-item ${isActive ? 'active' : ''}" data-cat="${escapeHtml(cat)}">
          <span>${escapeHtml(cleanTitle)}</span>
          <span class="sheet-item-count">${count}</span>
        </button>
      `;
    }

    els.categorySheetList.innerHTML = html;

    els.categorySheetList.querySelectorAll('.sheet-item').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.getAttribute('data-cat');
        currentIndex = 0;
        updateCategoryDisplay();
        applyFilters();
        closeCategorySheet();
      });
    });
  }

  function updateCategoryDisplay() {
    if (activeCategory === 'all') {
      els.currentCatDisplay.textContent = 'All Phrases';
    } else {
      const cleanTitle = activeCategory.replace(/^[A-Z]\.\s*/, '').split('(')[0].trim();
      els.currentCatDisplay.textContent = cleanTitle;
    }
  }

  // --- FILTERS ---
  function applyFilters() {
    filteredPhrases = allPhrases.filter(p => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const enMatch = p.english.toLowerCase().includes(q);
        const uzMatch = p.uzbek.toLowerCase().includes(q);
        if (!enMatch && !uzMatch) return false;
      }
      return true;
    });

    if (currentIndex >= filteredPhrases.length) currentIndex = 0;

    updateCounter();

    if (currentView === 'card') {
      renderCurrentCard();
    } else if (currentView === 'list') {
      renderListScreen();
    } else if (currentView === 'quiz') {
      renderQuizQuestion();
    }
  }

  function updateCounter() {
    const total = filteredPhrases.length;
    els.cardCounter.textContent = total > 0 ? `${currentIndex + 1}/${total}` : '0/0';
    const pct = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
    els.progressIndicator.style.width = `${pct}%`;
  }

  // --- CARD SCREEN LOGIC ---
  function renderCurrentCard() {
    if (filteredPhrases.length === 0) {
      els.frontText.textContent = "No phrases found.";
      els.backText.textContent = "Hech qanday ibora topilmadi.";
      els.btnPrev.disabled = true;
      els.btnNext.disabled = true;
      els.btnFlip.disabled = true;
      return;
    }

    els.btnPrev.disabled = false;
    els.btnNext.disabled = false;
    els.btnFlip.disabled = false;

    setCardFlipped(false);

    const phrase = filteredPhrases[currentIndex];
    els.frontText.textContent = phrase.english;
    els.backText.textContent = phrase.uzbek;
    els.frontCardNumber.textContent = `#${phrase.number}`;
    els.backCardNumber.textContent = `#${phrase.number}`;

    updateCounter();
  }

  function setCardFlipped(flipped) {
    isFlipped = flipped;
    if (isFlipped) {
      els.flashcard.classList.add('flipped');
    } else {
      els.flashcard.classList.remove('flipped');
    }
  }

  function toggleFlip() {
    setCardFlipped(!isFlipped);
  }

  function nextCard() {
    if (filteredPhrases.length === 0) return;
    currentIndex = (currentIndex + 1) % filteredPhrases.length;
    renderCurrentCard();
  }

  function prevCard() {
    if (filteredPhrases.length === 0) return;
    currentIndex = (currentIndex - 1 + filteredPhrases.length) % filteredPhrases.length;
    renderCurrentCard();
  }

  // --- AUDIO ENGINE (ZERO API CALLS, 100% PRE-RECORDED STATIC MP3s) ---
  function playPhraseAudio(phrase) {
    if (!phrase) return;

    setWaveAnimation(true);
    els.audioEl.pause();

    // Use relative path directly pointing to static file on Vercel
    els.audioEl.src = phrase.audio;

    const playPromise = els.audioEl.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        // Playing cleanly
      }).catch(err => {
        console.warn('Audio play restricted or offline, using speech synthesis fallback:', err);
        fallbackSpeech(phrase.english);
      });
    }

    els.audioEl.onended = () => setWaveAnimation(false);
    els.audioEl.onerror = () => {
      fallbackSpeech(phrase.english);
    };
  }

  function fallbackSpeech(text) {
    if (!('speechSynthesis' in window)) {
      setWaveAnimation(false);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/["“”]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.onend = () => setWaveAnimation(false);
    utterance.onerror = () => setWaveAnimation(false);
    window.speechSynthesis.speak(utterance);
  }

  function setWaveAnimation(playing) {
    if (playing) {
      els.btnPlayFront.classList.add('playing');
      els.btnPlayBack.classList.add('playing');
    } else {
      els.btnPlayFront.classList.remove('playing');
      els.btnPlayBack.classList.remove('playing');
    }
  }

  // --- VIEW 2: LIST SCREEN ---
  function renderListScreen() {
    if (filteredPhrases.length === 0) {
      els.listContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No phrases found.</div>';
      return;
    }

    let html = '';
    filteredPhrases.forEach((p, idx) => {
      html += `
        <div class="list-item-card" data-idx="${idx}">
          <div class="list-item-texts">
            <div class="list-en">${escapeHtml(p.english)}</div>
            <div class="list-uz">${escapeHtml(p.uzbek)}</div>
          </div>
          <button class="list-play-btn" data-audio-id="${p.id}" aria-label="Play audio">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
          </button>
        </div>
      `;
    });

    els.listContainer.innerHTML = html;

    els.listContainer.querySelectorAll('.list-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-audio-id');
        const phrase = allPhrases.find(p => p.id === id);
        if (phrase) playPhraseAudio(phrase);
      });
    });

    els.listContainer.querySelectorAll('.list-item-card').forEach(card => {
      card.addEventListener('click', () => {
        currentIndex = parseInt(card.getAttribute('data-idx'), 10);
        switchView('card');
      });
    });
  }

  // --- VIEW 3: PRACTICE QUIZ ---
  let quizTarget = null;
  let quizScore = 0;
  let quizCount = 0;
  let quizAnswered = false;

  function initQuiz() {
    quizScore = 0;
    quizCount = 0;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const pool = filteredPhrases.length >= 4 ? filteredPhrases : allPhrases;
    if (pool.length < 4) return;

    quizAnswered = false;
    els.btnQuizNext.style.display = 'none';
    els.quizStatus.textContent = 'Select the correct Uzbek translation';
    els.quizStatus.className = 'quiz-status';

    const randIdx = Math.floor(Math.random() * pool.length);
    quizTarget = pool[randIdx];

    els.quizEnText.textContent = quizTarget.english;
    els.quizScore.textContent = `Score: ${quizScore}/${quizCount}`;

    const distractors = [];
    while (distractors.length < 3) {
      const rand = pool[Math.floor(Math.random() * pool.length)];
      if (rand.id !== quizTarget.id && !distractors.some(d => d.id === rand.id)) {
        distractors.push(rand);
      }
    }

    const options = [quizTarget, ...distractors].sort(() => Math.random() - 0.5);

    let html = '';
    options.forEach(opt => {
      html += `
        <button class="quiz-choice-btn" data-id="${opt.id}">
          ${escapeHtml(opt.uzbek)}
        </button>
      `;
    });
    els.quizChoices.innerHTML = html;

    els.quizChoices.querySelectorAll('.quiz-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (quizAnswered) return;
        handleQuizAnswer(btn);
      });
    });
  }

  function handleQuizAnswer(clickedBtn) {
    quizAnswered = true;
    quizCount++;
    const chosenId = clickedBtn.getAttribute('data-id');
    const isCorrect = chosenId === quizTarget.id;

    if (isCorrect) {
      quizScore++;
      clickedBtn.classList.add('correct');
      els.quizStatus.textContent = '✓ Correct!';
      els.quizStatus.className = 'quiz-status correct';
    } else {
      clickedBtn.classList.add('wrong');
      els.quizStatus.textContent = `Correct: ${quizTarget.uzbek}`;
      els.quizStatus.className = 'quiz-status wrong';
      const correctBtn = els.quizChoices.querySelector(`[data-id="${quizTarget.id}"]`);
      if (correctBtn) correctBtn.classList.add('correct');
    }

    els.quizScore.textContent = `Score: ${quizScore}/${quizCount}`;
    els.btnQuizNext.style.display = 'block';
  }

  // --- VIEW SWITCHING ---
  function switchView(viewName) {
    currentView = viewName;
    els.viewSwitchButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    els.screenCard.style.display = viewName === 'card' ? 'flex' : 'none';
    els.screenList.style.display = viewName === 'list' ? 'block' : 'none';
    els.screenQuiz.style.display = viewName === 'quiz' ? 'block' : 'none';

    if (viewName === 'card') {
      renderCurrentCard();
    } else if (viewName === 'list') {
      renderListScreen();
    } else if (viewName === 'quiz') {
      initQuiz();
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    // Mode Switch
    els.viewSwitchButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        switchView(btn.getAttribute('data-view'));
      });
    });

    // Category Bottom Sheet Open / Close
    els.btnOpenCategories.addEventListener('click', openCategorySheet);
    els.btnCloseSheet.addEventListener('click', closeCategorySheet);
    els.sheetOverlay.addEventListener('click', closeCategorySheet);

    // Sheet Search
    els.sheetSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      currentIndex = 0;
      applyFilters();
    });

    // Flashcard Flip & Nav
    els.cardTouchZone.addEventListener('click', (e) => {
      if (hasSwiped) return;
      if (e.target.closest('.audio-action-btn')) return;
      toggleFlip();
    });

    els.btnFlip.addEventListener('click', toggleFlip);
    els.btnPrev.addEventListener('click', prevCard);
    els.btnNext.addEventListener('click', nextCard);

    // Audio Buttons
    els.btnPlayFront.addEventListener('click', (e) => {
      e.stopPropagation();
      playPhraseAudio(filteredPhrases[currentIndex]);
    });

    els.btnPlayBack.addEventListener('click', (e) => {
      e.stopPropagation();
      playPhraseAudio(filteredPhrases[currentIndex]);
    });

    // Quiz Controls
    els.btnQuizAudio.addEventListener('click', () => {
      if (quizTarget) playPhraseAudio(quizTarget);
    });
    els.btnQuizNext.addEventListener('click', renderQuizQuestion);

    // Touch Swipe Gestures
    els.cardTouchZone.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      hasSwiped = false;
    }, { passive: true });

    els.cardTouchZone.addEventListener('touchmove', (e) => {
      const curX = e.changedTouches[0].screenX;
      const curY = e.changedTouches[0].screenY;
      if (Math.abs(curX - touchStartX) > 20 && Math.abs(curX - touchStartX) > Math.abs(curY - touchStartY)) {
        hasSwiped = true;
      }
    }, { passive: true });

    els.cardTouchZone.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
        if (diffX < 0) {
          nextCard(); // Swipe left
        } else {
          prevCard(); // Swipe right
        }
      }
    }, { passive: true });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (currentView === 'card') {
        if (e.code === 'Space') {
          e.preventDefault();
          toggleFlip();
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          nextCard();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          prevCard();
        } else if (e.code === 'KeyA') {
          e.preventDefault();
          playPhraseAudio(filteredPhrases[currentIndex]);
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
