/**
 * Common Phrases Flashcards — Modern, Touch-Friendly App Logic
 */

(function () {
  'use strict';

  // --- STATE ---
  let allPhrases = [];
  let filteredPhrases = [];
  let currentIndex = 0;
  let isFlipped = false;
  let currentView = 'flashcard'; // 'flashcard' | 'browse' | 'quiz'
  let activeModule = 'all'; // 'all' | 'curator' | 'attendance' | 'mastered' | 'review'
  let activeCategory = 'all';
  let searchQuery = '';
  
  // Settings
  let playbackSpeed = 1.0;
  let autoSpeak = true;
  let isAutoplaying = false;
  let autoplayTimer = null;
  let areTranslationsHidden = false;

  // Persistence (LocalStorage)
  let masteredSet = new Set(JSON.parse(localStorage.getItem('common_mastered') || '[]'));
  let reviewSet = new Set(JSON.parse(localStorage.getItem('common_review') || '[]'));

  // Audio Player
  const audioPlayer = new Audio();
  let currentPlayingId = null;

  // Touch Swipe State
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let isSwiping = false;

  // DOM ELEMENTS
  const els = {
    // Header & Views
    tabButtons: document.querySelectorAll('.tab-btn'),
    viewFlashcard: document.getElementById('view-flashcard'),
    viewBrowse: document.getElementById('view-browse'),
    viewQuiz: document.getElementById('view-quiz'),
    totalBadgeCount: document.getElementById('total-badge-count'),
    masteredCount: document.getElementById('mastered-count'),
    reviewCount: document.getElementById('review-count'),
    headerCatPill: document.getElementById('header-cat-pill'),

    // Drawer Elements
    btnOpenDrawer: document.getElementById('btn-open-drawer'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    categoriesDrawer: document.getElementById('categories-drawer'),
    drawerCategoryList: document.getElementById('drawer-category-list'),
    drawerModuleItems: document.querySelectorAll('.drawer-item[data-module]'),

    // Search
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),

    // Flashcard View
    currentCardNum: document.getElementById('current-card-num'),
    filteredTotalNum: document.getElementById('filtered-total-num'),
    activeCategoryDisplay: document.getElementById('active-category-display'),
    activeMasteryChip: document.getElementById('active-mastery-chip'),
    flashcardProgress: document.getElementById('flashcard-progress'),
    cardWrapper: document.getElementById('card-wrapper'),
    flashcard: document.getElementById('flashcard'),
    
    cardFrontCat: document.getElementById('card-front-cat'),
    cardFrontNum: document.getElementById('card-front-num'),
    cardFrontText: document.getElementById('card-front-text'),
    btnPlayCard: document.getElementById('btn-play-card'),
    audioWaveFront: document.getElementById('audio-wave-front'),
    
    cardBackCat: document.getElementById('card-back-cat'),
    cardBackNum: document.getElementById('card-back-num'),
    cardBackText: document.getElementById('card-back-text'),
    btnPlayCardBack: document.getElementById('btn-play-card-back'),
    audioWaveBack: document.getElementById('audio-wave-back'),
    btnMarkMaster: document.getElementById('btn-mark-master'),
    btnMarkReview: document.getElementById('btn-mark-review'),

    // Navigation & Aux
    btnPrevCard: document.getElementById('btn-prev-card'),
    btnFlipCard: document.getElementById('btn-flip-card'),
    btnNextCard: document.getElementById('btn-next-card'),
    btnShuffle: document.getElementById('btn-shuffle'),
    btnAutoplay: document.getElementById('btn-autoplay'),
    autoplayIcon: document.getElementById('autoplay-icon'),
    autoplayText: document.getElementById('autoplay-text'),
    btnAutoSpeak: document.getElementById('btn-auto-speak'),
    speedButtons: document.querySelectorAll('.speed-opt'),

    // Browse View
    browseShowingCount: document.getElementById('browse-showing-count'),
    browseGrid: document.getElementById('browse-grid'),
    btnToggleAllTranslations: document.getElementById('btn-toggle-all-translations'),

    // Quiz View
    quizCatBadge: document.getElementById('quiz-cat-badge'),
    quizScorePill: document.getElementById('quiz-score-pill'),
    quizQuestionEn: document.getElementById('quiz-question-en'),
    btnQuizAudio: document.getElementById('btn-quiz-audio'),
    quizOptionsList: document.getElementById('quiz-options-list'),
    quizFeedbackText: document.getElementById('quiz-feedback-text'),
    btnQuizNext: document.getElementById('btn-quiz-next'),

    toast: document.getElementById('toast')
  };

  // Web Audio subtle click / flip tone
  let audioCtx = null;
  function playHapticTone(type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      const now = audioCtx.currentTime;
      if (type === 'flip') {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch (e) {}
  }

  // --- INITIALIZATION ---
  function init() {
    if (window.PHRASES_DATA && Array.isArray(window.PHRASES_DATA)) {
      allPhrases = window.PHRASES_DATA;
    } else {
      console.error('Phrases data not loaded!');
      return;
    }

    renderDrawerCategories();
    updateMasteryStats();
    applyFilters();
    bindEvents();
    bindTouchGestures();
    renderCurrentCard();
  }

  // --- DRAWER OPEN/CLOSE ---
  function openDrawer() {
    els.categoriesDrawer.classList.add('open');
    els.drawerBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    els.categoriesDrawer.classList.remove('open');
    els.drawerBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  // --- RENDER DRAWER CATEGORIES ---
  function renderDrawerCategories() {
    const catMap = new Map();
    allPhrases.forEach(p => {
      catMap.set(p.category, (catMap.get(p.category) || 0) + 1);
    });

    let html = `
      <button class="drawer-item ${activeCategory === 'all' ? 'active' : ''}" data-category="all">
        <span class="drawer-item-icon">📂</span>
        <span class="drawer-item-label">All Categories</span>
        <span class="drawer-item-count">${allPhrases.length}</span>
      </button>
    `;

    for (const [cat, count] of catMap.entries()) {
      const isClassroom = cat.match(/^[A-N]\./);
      const icon = isClassroom ? '💬' : '📋';
      const isActive = activeCategory === cat;
      html += `
        <button class="drawer-item ${isActive ? 'active' : ''}" data-category="${escapeHtml(cat)}">
          <span class="drawer-item-icon">${icon}</span>
          <span class="drawer-item-label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</span>
          <span class="drawer-item-count">${count}</span>
        </button>
      `;
    }

    els.drawerCategoryList.innerHTML = html;

    // Attach listeners
    els.drawerCategoryList.querySelectorAll('.drawer-item[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        els.drawerCategoryList.querySelectorAll('.drawer-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.getAttribute('data-category');
        currentIndex = 0;
        updateHeaderIndicator();
        applyFilters();
        closeDrawer();
      });
    });
  }

  function cleanCategoryTitle(raw) {
    if (!raw) return 'All';
    // Remove "A. " or similar letter prefixes
    let clean = raw.replace(/^[A-Z]\.\s*/, '');
    // Take part before parenthesis if too long
    return clean.split('(')[0].trim();
  }

  function updateHeaderIndicator() {
    if (activeCategory !== 'all') {
      const shortCat = cleanCategoryTitle(activeCategory);
      els.headerCatPill.textContent = shortCat;
      els.activeCategoryDisplay.textContent = shortCat;
    } else if (activeModule !== 'all') {
      const modLabels = {
        curator: "Classroom",
        attendance: "Attendance",
        mastered: "Mastered",
        review: "Review"
      };
      const label = modLabels[activeModule] || "All";
      els.headerCatPill.textContent = label;
      els.activeCategoryDisplay.textContent = label;
    } else {
      els.headerCatPill.textContent = "All";
      els.activeCategoryDisplay.textContent = "All Categories";
    }
  }

  // --- FILTERS & SEARCH ---
  function applyFilters() {
    filteredPhrases = allPhrases.filter(item => {
      // Module Filter
      if (activeModule === 'curator' && !item.id.startsWith('curator_')) return false;
      if (activeModule === 'attendance' && !item.id.startsWith('late_')) return false;
      if (activeModule === 'mastered' && !masteredSet.has(item.id)) return false;
      if (activeModule === 'review' && !reviewSet.has(item.id)) return false;

      // Category Filter
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const enMatch = item.english.toLowerCase().includes(q);
        const uzMatch = item.uzbek.toLowerCase().includes(q);
        const catMatch = item.category.toLowerCase().includes(q);
        if (!enMatch && !uzMatch && !catMatch) return false;
      }

      return true;
    });

    if (currentIndex >= filteredPhrases.length) {
      currentIndex = 0;
    }

    updateCounterDisplays();

    if (currentView === 'flashcard') {
      renderCurrentCard();
    } else if (currentView === 'browse') {
      renderBrowseGrid();
    } else if (currentView === 'quiz') {
      renderQuizQuestion();
    }
  }

  function updateCounterDisplays() {
    const total = filteredPhrases.length;
    els.filteredTotalNum.textContent = total;
    els.totalBadgeCount.textContent = allPhrases.length;
    els.browseShowingCount.textContent = total;
    updateMasteryStats();
  }

  function updateMasteryStats() {
    els.masteredCount.textContent = masteredSet.size;
    els.reviewCount.textContent = reviewSet.size;
    localStorage.setItem('common_mastered', JSON.stringify([...masteredSet]));
    localStorage.setItem('common_review', JSON.stringify([...reviewSet]));
  }

  // --- VIEW SWITCHING ---
  function switchView(viewName) {
    currentView = viewName;
    els.tabButtons.forEach(btn => {
      const isTarget = btn.getAttribute('data-view') === viewName;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget);
    });

    els.viewFlashcard.style.display = viewName === 'flashcard' ? 'flex' : 'none';
    els.viewBrowse.style.display = viewName === 'browse' ? 'flex' : 'none';
    els.viewQuiz.style.display = viewName === 'quiz' ? 'block' : 'none';

    stopAutoplay();

    if (viewName === 'flashcard') {
      renderCurrentCard();
    } else if (viewName === 'browse') {
      renderBrowseGrid();
    } else if (viewName === 'quiz') {
      initQuiz();
    }
  }

  // --- FLASHCARD ENGINE ---
  function renderCurrentCard() {
    if (filteredPhrases.length === 0) {
      els.cardFrontText.textContent = "No phrases match your selection.";
      els.cardFrontCat.textContent = "Empty";
      els.cardFrontNum.textContent = "#0";
      els.cardBackText.textContent = "Hech qanday ibora topilmadi.";
      els.btnPrevCard.disabled = true;
      els.btnNextCard.disabled = true;
      els.btnFlipCard.disabled = true;
      els.currentCardNum.textContent = 0;
      els.flashcardProgress.style.width = '0%';
      return;
    }

    els.btnPrevCard.disabled = false;
    els.btnNextCard.disabled = false;
    els.btnFlipCard.disabled = false;

    setCardFlipped(false);

    const phrase = filteredPhrases[currentIndex];

    // Numbers & Progress
    els.currentCardNum.textContent = currentIndex + 1;
    els.filteredTotalNum.textContent = filteredPhrases.length;
    const pct = ((currentIndex + 1) / filteredPhrases.length) * 100;
    els.flashcardProgress.style.width = `${pct}%`;

    // Active Category
    const shortCategory = cleanCategoryTitle(phrase.category);
    els.activeCategoryDisplay.textContent = shortCategory;
    
    // Mastery chip
    if (masteredSet.has(phrase.id)) {
      els.activeMasteryChip.textContent = "⭐ Mastered";
      els.activeMasteryChip.className = "status-badge-chip mastered";
    } else if (reviewSet.has(phrase.id)) {
      els.activeMasteryChip.textContent = "⚠️ Review";
      els.activeMasteryChip.className = "status-badge-chip learning";
    } else {
      els.activeMasteryChip.textContent = "Learning";
      els.activeMasteryChip.className = "status-badge-chip learning";
    }

    // Card Front
    els.cardFrontCat.textContent = shortCategory;
    els.cardFrontNum.textContent = `#${phrase.number}`;
    els.cardFrontText.textContent = phrase.english;

    // Card Back
    els.cardBackCat.textContent = "O'zbekcha";
    els.cardBackNum.textContent = `#${phrase.number}`;
    els.cardBackText.textContent = phrase.uzbek;

    // Auto-play audio if enabled
    if (autoSpeak && currentView === 'flashcard' && !isAutoplaying) {
      playPhraseAudio(phrase);
    }
  }

  function setCardFlipped(state) {
    isFlipped = state;
    if (isFlipped) {
      els.flashcard.classList.add('flipped');
      playHapticTone('flip');
    } else {
      els.flashcard.classList.remove('flipped');
    }
  }

  function toggleCardFlip() {
    setCardFlipped(!isFlipped);
  }

  function goToCard(idx) {
    if (filteredPhrases.length === 0) return;
    if (idx < 0) idx = filteredPhrases.length - 1;
    if (idx >= filteredPhrases.length) idx = 0;
    currentIndex = idx;
    renderCurrentCard();
  }

  function nextCard() {
    goToCard(currentIndex + 1);
  }

  function prevCard() {
    goToCard(currentIndex - 1);
  }

  function shuffleCards() {
    for (let i = filteredPhrases.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filteredPhrases[i], filteredPhrases[j]] = [filteredPhrases[j], filteredPhrases[i]];
    }
    currentIndex = 0;
    renderCurrentCard();
    showToast("Cards shuffled");
  }

  // --- TOUCH GESTURE SUPPORT (MOBILE SWIPE) ---
  function bindTouchGestures() {
    els.cardWrapper.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      isSwiping = false;
    }, { passive: true });

    els.cardWrapper.addEventListener('touchmove', (e) => {
      const currentX = e.changedTouches[0].screenX;
      const currentY = e.changedTouches[0].screenY;
      const diffX = Math.abs(currentX - touchStartX);
      const diffY = Math.abs(currentY - touchStartY);
      if (diffX > 15 && diffX > diffY) {
        isSwiping = true;
      }
    }, { passive: true });

    els.cardWrapper.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipeGesture();
    }, { passive: true });
  }

  function handleSwipeGesture() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    const threshold = 45; // Minimum swipe distance in px

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
      if (diffX < 0) {
        // Swipe Left -> Next Card
        nextCard();
      } else {
        // Swipe Right -> Prev Card
        prevCard();
      }
    }
  }

  // --- AUDIO PLAYBACK ---
  function playPhraseAudio(phrase, onEnded) {
    if (!phrase) return;

    audioPlayer.pause();
    window.speechSynthesis.cancel();
    setWaveAnimation(false);

    currentPlayingId = phrase.id;
    setWaveAnimation(true);

    audioPlayer.src = phrase.audio;
    audioPlayer.playbackRate = playbackSpeed;

    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {}).catch(() => {
        fallbackSpeechSynthesis(phrase.english, onEnded);
      });
    }

    audioPlayer.onended = () => {
      setWaveAnimation(false);
      currentPlayingId = null;
      if (onEnded) onEnded();
    };

    audioPlayer.onerror = () => {
      fallbackSpeechSynthesis(phrase.english, onEnded);
    };
  }

  function fallbackSpeechSynthesis(text, onEnded) {
    if (!('speechSynthesis' in window)) {
      setWaveAnimation(false);
      return;
    }
    const cleanText = text.replace(/["“”]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = playbackSpeed;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Daniel')));
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onend = () => {
      setWaveAnimation(false);
      currentPlayingId = null;
      if (onEnded) onEnded();
    };
    utterance.onerror = () => {
      setWaveAnimation(false);
      currentPlayingId = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  function setWaveAnimation(isPlaying) {
    if (isPlaying) {
      els.btnPlayCard.classList.add('playing');
      els.btnPlayCardBack.classList.add('playing');
    } else {
      els.btnPlayCard.classList.remove('playing');
      els.btnPlayCardBack.classList.remove('playing');
    }
  }

  // --- AUTOPLAY SLIDESHOW ---
  function toggleAutoplay() {
    if (isAutoplaying) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  }

  function startAutoplay() {
    isAutoplaying = true;
    els.autoplayIcon.textContent = '⏸';
    els.autoplayText.textContent = 'Stop';
    els.btnAutoplay.classList.add('active');
    runAutoplayStep();
  }

  function stopAutoplay() {
    isAutoplaying = false;
    clearTimeout(autoplayTimer);
    els.autoplayIcon.textContent = '▶';
    els.autoplayText.textContent = 'Autoplay';
    els.btnAutoplay.classList.remove('active');
  }

  function runAutoplayStep() {
    if (!isAutoplaying || filteredPhrases.length === 0) return;

    setCardFlipped(false);
    const phrase = filteredPhrases[currentIndex];

    playPhraseAudio(phrase, () => {
      if (!isAutoplaying) return;
      autoplayTimer = setTimeout(() => {
        if (!isAutoplaying) return;
        setCardFlipped(true);
        autoplayTimer = setTimeout(() => {
          if (!isAutoplaying) return;
          nextCard();
          autoplayTimer = setTimeout(runAutoplayStep, 400);
        }, 2200);
      }, 1200);
    });
  }

  // --- MASTERY & BOOKMARKS ---
  function markMastered(id) {
    reviewSet.delete(id);
    if (masteredSet.has(id)) {
      masteredSet.delete(id);
      showToast("Removed from Mastered");
    } else {
      masteredSet.add(id);
      playHapticTone('success');
      showToast("✓ Marked as Mastered");
    }
    updateMasteryStats();
    renderCurrentCard();
  }

  function markReview(id) {
    masteredSet.delete(id);
    if (reviewSet.has(id)) {
      reviewSet.delete(id);
      showToast("Removed from Review");
    } else {
      reviewSet.add(id);
      showToast("⚠️ Marked for Review");
    }
    updateMasteryStats();
    renderCurrentCard();
  }

  // --- VIEW 2: BROWSE GRID ---
  function renderBrowseGrid() {
    if (filteredPhrases.length === 0) {
      els.browseGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">🔍</div>
          <h3>No phrases found</h3>
          <p>Try clearing your search query or choosing another category from the drawer.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filteredPhrases.forEach((p, idx) => {
      const isMastered = masteredSet.has(p.id);
      const isReview = reviewSet.has(p.id);
      const starIcon = isMastered ? '⭐' : (isReview ? '⚠️' : '');
      const shortCat = cleanCategoryTitle(p.category);

      html += `
        <div class="phrase-card" data-id="${p.id}" data-index="${idx}">
          <div class="phrase-card-top">
            <span class="phrase-cat-badge">${escapeHtml(shortCat)}</span>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span>${starIcon}</span>
              <span class="phrase-num">#${p.number}</span>
            </div>
          </div>
          
          <div class="phrase-card-body">
            <div class="phrase-en">${escapeHtml(p.english)}</div>
            <div class="phrase-uz" style="${areTranslationsHidden ? 'filter: blur(5px);' : ''}">
              ${escapeHtml(p.uzbek)}
            </div>
          </div>

          <div class="phrase-card-footer">
            <button class="btn-play-mini" data-play-id="${p.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              <span>Listen</span>
            </button>
            <button class="btn-card-flip-mini" data-study-idx="${idx}">
              Open in Card ↗
            </button>
          </div>
        </div>
      `;
    });

    els.browseGrid.innerHTML = html;

    els.browseGrid.querySelectorAll('[data-play-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-play-id');
        const phrase = allPhrases.find(p => p.id === id);
        if (phrase) playPhraseAudio(phrase);
      });
    });

    els.browseGrid.querySelectorAll('[data-study-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-study-idx'), 10);
        currentIndex = idx;
        switchView('flashcard');
      });
    });
  }

  // --- VIEW 3: PRACTICE QUIZ ---
  let quizCurrentQuestion = null;
  let quizScore = 0;
  let quizTotal = 0;
  let quizAnswered = false;

  function initQuiz() {
    quizScore = 0;
    quizTotal = 0;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const pool = filteredPhrases.length >= 4 ? filteredPhrases : allPhrases;
    if (pool.length < 4) {
      els.quizQuestionEn.textContent = "Not enough phrases for quiz!";
      return;
    }

    quizAnswered = false;
    els.btnQuizNext.style.display = 'none';
    els.quizFeedbackText.textContent = 'Choose the correct translation:';
    els.quizFeedbackText.className = 'quiz-feedback-text';

    const targetIdx = Math.floor(Math.random() * pool.length);
    quizCurrentQuestion = pool[targetIdx];

    els.quizCatBadge.textContent = cleanCategoryTitle(quizCurrentQuestion.category);
    els.quizQuestionEn.textContent = quizCurrentQuestion.english;
    els.quizScorePill.textContent = `Score: ${quizScore} / ${quizTotal}`;

    const distractors = [];
    while (distractors.length < 3) {
      const rand = pool[Math.floor(Math.random() * pool.length)];
      if (rand.id !== quizCurrentQuestion.id && !distractors.some(d => d.id === rand.id)) {
        distractors.push(rand);
      }
    }

    const options = [quizCurrentQuestion, ...distractors].sort(() => Math.random() - 0.5);

    let html = '';
    options.forEach(opt => {
      html += `
        <button class="quiz-opt-btn" data-opt-id="${opt.id}">
          <span>${escapeHtml(opt.uzbek)}</span>
          <span class="quiz-check-icon"></span>
        </button>
      `;
    });
    els.quizOptionsList.innerHTML = html;

    playPhraseAudio(quizCurrentQuestion);

    els.quizOptionsList.querySelectorAll('.quiz-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (quizAnswered) return;
        handleQuizAnswer(btn);
      });
    });
  }

  function handleQuizAnswer(clickedBtn) {
    quizAnswered = true;
    quizTotal++;
    const selectedId = clickedBtn.getAttribute('data-opt-id');
    const isCorrect = selectedId === quizCurrentQuestion.id;

    if (isCorrect) {
      quizScore++;
      clickedBtn.classList.add('correct');
      clickedBtn.querySelector('.quiz-check-icon').textContent = '✓ Correct';
      els.quizFeedbackText.textContent = '🎉 Correct!';
      els.quizFeedbackText.className = 'quiz-feedback-text correct';
      playHapticTone('success');
      markMastered(quizCurrentQuestion.id);
    } else {
      clickedBtn.classList.add('wrong');
      clickedBtn.querySelector('.quiz-check-icon').textContent = '✗';
      els.quizFeedbackText.textContent = `Correct: ${quizCurrentQuestion.uzbek}`;
      els.quizFeedbackText.className = 'quiz-feedback-text wrong';

      const correctBtn = els.quizOptionsList.querySelector(`[data-opt-id="${quizCurrentQuestion.id}"]`);
      if (correctBtn) correctBtn.classList.add('correct');
      markReview(quizCurrentQuestion.id);
    }

    els.quizScorePill.textContent = `Score: ${quizScore} / ${quizTotal}`;
    els.btnQuizNext.style.display = 'block';
  }

  // --- TOAST NOTIFICATIONS ---
  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
    }, 1800);
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
    // Drawer open / close
    els.btnOpenDrawer.addEventListener('click', openDrawer);
    els.btnCloseDrawer.addEventListener('click', closeDrawer);
    els.drawerBackdrop.addEventListener('click', closeDrawer);
    els.activeCategoryDisplay.addEventListener('click', openDrawer);

    // Escape key closes drawer
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.categoriesDrawer.classList.contains('open')) {
        closeDrawer();
      }
    });

    // Navigation Tabs
    els.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        switchView(btn.getAttribute('data-view'));
      });
    });

    // Drawer Module filters
    els.drawerModuleItems.forEach(btn => {
      btn.addEventListener('click', () => {
        els.drawerModuleItems.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeModule = btn.getAttribute('data-module');
        activeCategory = 'all';
        els.drawerCategoryList.querySelectorAll('.drawer-item').forEach(b => b.classList.remove('active'));
        const allCatBtn = els.drawerCategoryList.querySelector('[data-category="all"]');
        if (allCatBtn) allCatBtn.classList.add('active');
        currentIndex = 0;
        updateHeaderIndicator();
        applyFilters();
        closeDrawer();
      });
    });

    // Search
    els.searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      els.searchClear.classList.toggle('visible', searchQuery.length > 0);
      currentIndex = 0;
      applyFilters();
    });

    els.searchClear.addEventListener('click', () => {
      els.searchInput.value = '';
      searchQuery = '';
      els.searchClear.classList.remove('visible');
      currentIndex = 0;
      applyFilters();
    });

    // Card Flip (click / tap)
    els.cardWrapper.addEventListener('click', (e) => {
      if (isSwiping) return; // Prevent flip on swipe gesture
      if (e.target.closest('.audio-play-large-btn') || e.target.closest('.btn-mastery')) return;
      toggleCardFlip();
    });

    els.btnFlipCard.addEventListener('click', toggleCardFlip);

    // Prev / Next
    els.btnPrevCard.addEventListener('click', prevCard);
    els.btnNextCard.addEventListener('click', nextCard);

    // Audio Play Buttons
    els.btnPlayCard.addEventListener('click', (e) => {
      e.stopPropagation();
      playPhraseAudio(filteredPhrases[currentIndex]);
    });

    els.btnPlayCardBack.addEventListener('click', (e) => {
      e.stopPropagation();
      playPhraseAudio(filteredPhrases[currentIndex]);
    });

    // Card Mastery
    els.btnMarkMaster.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = filteredPhrases[currentIndex];
      if (p) markMastered(p.id);
    });

    els.btnMarkReview.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = filteredPhrases[currentIndex];
      if (p) markReview(p.id);
    });

    // Shuffle & Autoplay
    els.btnShuffle.addEventListener('click', shuffleCards);
    els.btnAutoplay.addEventListener('click', toggleAutoplay);

    // Speed Selector
    els.speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        els.speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        playbackSpeed = parseFloat(btn.getAttribute('data-speed'));
        audioPlayer.playbackRate = playbackSpeed;
        showToast(`Speed: ${playbackSpeed}x`);
      });
    });

    // Auto-Speak on flip
    els.btnAutoSpeak.addEventListener('click', () => {
      autoSpeak = !autoSpeak;
      els.btnAutoSpeak.classList.toggle('active', autoSpeak);
      els.btnAutoSpeak.querySelector('span').textContent = autoSpeak ? '🔊 Auto' : '🔈 Muted';
      showToast(autoSpeak ? "Auto-audio on" : "Auto-audio off");
    });

    // Browse Toggle Translations
    els.btnToggleAllTranslations.addEventListener('click', () => {
      areTranslationsHidden = !areTranslationsHidden;
      renderBrowseGrid();
    });

    // Quiz Controls
    els.btnQuizAudio.addEventListener('click', () => {
      if (quizCurrentQuestion) playPhraseAudio(quizCurrentQuestion);
    });

    els.btnQuizNext.addEventListener('click', renderQuizQuestion);

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (document.activeElement === els.searchInput) return;

      if (currentView === 'flashcard') {
        if (e.code === 'Space') {
          e.preventDefault();
          toggleCardFlip();
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          nextCard();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          prevCard();
        } else if (e.code === 'KeyA') {
          e.preventDefault();
          playPhraseAudio(filteredPhrases[currentIndex]);
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          const p = filteredPhrases[currentIndex];
          if (p) markMastered(p.id);
        } else if (e.code === 'KeyS') {
          e.preventDefault();
          shuffleCards();
        }
      }
    });
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);
})();
