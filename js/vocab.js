/* ============================================================
   Vocabulary Logic - 會考英語練習
   ============================================================ */

let allWords = [];
let filteredWords = [];
let currentFilter = 'all';
let currentTab = 'flashcard';

// Flashcard state
let fc = {
  index: 0,
  flipped: false
};

// Quiz state
let quiz = {
  correct: 0,
  wrong: 0,
  currentWord: null,
  answered: false
};

// ---- localStorage helpers ----

function getLearnedSet() {
  return new Set(JSON.parse(localStorage.getItem('vocab_learned') || '[]'));
}

function saveLearnedSet(set) {
  localStorage.setItem('vocab_learned', JSON.stringify([...set]));
}

function getQuizStats() {
  return JSON.parse(localStorage.getItem('vocab_quiz_stats') || '{"correct":0,"wrong":0}');
}

function saveQuizStats() {
  localStorage.setItem('vocab_quiz_stats', JSON.stringify({ correct: quiz.correct, wrong: quiz.wrong }));
}

// ---- Init ----

async function initVocab() {
  try {
    const res = await fetch('data/vocab-1200.json');
    if (!res.ok) throw new Error('Failed to fetch vocab');
    allWords = await res.json();

    // Restore quiz stats
    const saved = getQuizStats();
    quiz.correct = saved.correct;
    quiz.wrong = saved.wrong;

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('filterBar').style.display = 'flex';

    applyFilter(currentFilter);
    switchTab('flashcard');

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboard);

  } catch (err) {
    document.getElementById('loadingState').innerHTML = `
      <p style="color:#d9534f;">⚠️ 無法載入單字資料</p>
      <p style="font-size:0.85rem; color:#888;">${err.message}</p>`;
  }
}

// ---- Filter ----

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  applyFilter(filter);
}

function applyFilter(filter) {
  const learned = getLearnedSet();

  if (filter === 'learned') {
    filteredWords = allWords.filter(w => learned.has(w.word));
  } else if (filter === 'unlearned') {
    filteredWords = allWords.filter(w => !learned.has(w.word));
  } else {
    filteredWords = [...allWords];
  }

  const learnedCount = learned.size;
  document.getElementById('filterCount').textContent =
    `已學會 ${learnedCount} / ${allWords.length} 個`;

  if (filteredWords.length === 0) {
    if (filter === 'learned') {
      showEmptyState('還沒有標記為已學會的單字', '去練習單字卡吧！');
    } else if (filter === 'unlearned') {
      showEmptyState('全部單字都學會了！', '太厲害了！');
    }
    return;
  }

  // Reset index if out of bounds
  if (fc.index >= filteredWords.length) {
    fc.index = 0;
  }

  if (currentTab === 'flashcard') {
    renderFlashcard();
  } else {
    renderQuizQuestion();
  }
}

function showEmptyState(msg, sub) {
  const tabContent = document.getElementById(`tabContent${currentTab.charAt(0).toUpperCase() + currentTab.slice(1)}`);
  if (tabContent) {
    const inner = tabContent.querySelector('.empty-placeholder');
    if (inner) inner.innerHTML = `<span class="empty-icon">🎉</span><p>${msg}</p><p style="font-size:0.85rem;color:#aaa;">${sub}</p>`;
  }
}

// ---- Tab switching ----

function switchTab(tab) {
  currentTab = tab;

  document.getElementById('tabFlashcard').classList.toggle('active', tab === 'flashcard');
  document.getElementById('tabQuiz').classList.toggle('active', tab === 'quiz');

  const flashcardContent = document.getElementById('tabContentFlashcard');
  const quizContent = document.getElementById('tabContentQuiz');

  if (tab === 'flashcard') {
    flashcardContent.style.display = 'block';
    quizContent.style.display = 'none';
    if (filteredWords.length > 0) renderFlashcard();
  } else {
    flashcardContent.style.display = 'none';
    quizContent.style.display = 'block';
    updateQuizStats();
    if (filteredWords.length > 0) renderQuizQuestion();
  }
}

// ---- Flashcard ----

function renderFlashcard() {
  if (filteredWords.length === 0) return;

  const word = filteredWords[fc.index];
  const learned = getLearnedSet();
  const isLearned = learned.has(word.word);

  // Reset flip state
  fc.flipped = false;
  document.getElementById('flashcard').classList.remove('flipped');

  // Update front
  document.getElementById('cardWord').textContent = word.word;
  document.getElementById('cardPos').textContent = word.pos || '';

  // Update back
  document.getElementById('cardChinese').textContent = word.chinese || '';
  document.getElementById('cardPosBack').textContent = word.pos || '';
  document.getElementById('cardWordSmall').textContent = word.word;

  // Update counter
  document.getElementById('fcCounter').textContent = `${fc.index + 1} / ${filteredWords.length}`;

  // Update prev/next buttons
  document.getElementById('fcPrevBtn').disabled = fc.index === 0;
  document.getElementById('fcNextBtn').disabled = fc.index === filteredWords.length - 1;

  // Update learned button
  const btn = document.getElementById('learnedBtn');
  btn.classList.toggle('learned', isLearned);
  btn.textContent = isLearned ? '✓ 已學會' : '標記為「已學會」';
}

function flipCard() {
  fc.flipped = !fc.flipped;
  document.getElementById('flashcard').classList.toggle('flipped', fc.flipped);
}

function fcPrev() {
  if (fc.index > 0) {
    fc.index--;
    renderFlashcard();
  }
}

function fcNext() {
  if (fc.index < filteredWords.length - 1) {
    fc.index++;
    renderFlashcard();
  }
}

function toggleLearned() {
  if (filteredWords.length === 0) return;

  const word = filteredWords[fc.index];
  const learned = getLearnedSet();

  if (learned.has(word.word)) {
    learned.delete(word.word);
  } else {
    learned.add(word.word);
  }

  saveLearnedSet(learned);

  // Re-apply filter (word may drop out of filtered list)
  const prevWord = word.word;
  applyFilter(currentFilter);

  // Try to stay near same position
  const newIdx = filteredWords.findIndex(w => w.word === prevWord);
  if (newIdx !== -1) {
    fc.index = newIdx;
  } else {
    // Word was removed from filter, move to next or prev
    fc.index = Math.min(fc.index, filteredWords.length - 1);
  }

  if (filteredWords.length > 0) {
    renderFlashcard();
  }

  // Update filter count
  const learnedCount = learned.size;
  document.getElementById('filterCount').textContent =
    `已學會 ${learnedCount} / ${allWords.length} 個`;
}

// ---- Quiz ----

function renderQuizQuestion() {
  if (filteredWords.length === 0) return;

  quiz.answered = false;

  // Pick a random word
  const randomIdx = Math.floor(Math.random() * filteredWords.length);
  quiz.currentWord = filteredWords[randomIdx];

  document.getElementById('quizWord').textContent = quiz.currentWord.word;
  document.getElementById('quizPos').textContent = quiz.currentWord.pos || '';

  // Generate 4 options (1 correct + 3 wrong)
  const correctChinese = quiz.currentWord.chinese;
  const wrongOptions = getRandomWrongOptions(quiz.currentWord, 3);

  const options = shuffle([correctChinese, ...wrongOptions]);

  const container = document.getElementById('quizOptions');
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.textContent = opt;
    btn.onclick = () => selectQuizAnswer(opt, correctChinese, btn);
    container.appendChild(btn);
  });

  document.getElementById('quizFeedback').style.display = 'none';
  document.getElementById('quizNextBtn').style.display = 'none';
}

function getRandomWrongOptions(currentWord, count) {
  const used = new Set([currentWord.chinese]);
  const pool = allWords.filter(w => w.word !== currentWord.word && !used.has(w.chinese));
  const shuffled = shuffle(pool);
  const result = [];
  for (const w of shuffled) {
    if (!used.has(w.chinese)) {
      used.add(w.chinese);
      result.push(w.chinese);
      if (result.length >= count) break;
    }
  }
  return result;
}

function selectQuizAnswer(selected, correct, clickedBtn) {
  if (quiz.answered) return;
  quiz.answered = true;

  const isCorrect = selected === correct;
  const feedback = document.getElementById('quizFeedback');

  // Highlight buttons
  document.querySelectorAll('.quiz-option-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correct) {
      btn.classList.add('correct');
    } else if (btn === clickedBtn && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    quiz.correct++;
    feedback.textContent = '✓ 答對了！';
    feedback.style.background = '#e6f7ed';
    feedback.style.color = '#2e9e5b';
  } else {
    quiz.wrong++;
    feedback.textContent = `✗ 答錯了！正確答案：${correct}`;
    feedback.style.background = '#fdecea';
    feedback.style.color = '#d9534f';
  }

  feedback.style.display = 'block';
  document.getElementById('quizNextBtn').style.display = 'block';

  saveQuizStats();
  updateQuizStats();

  // Auto advance after 1.5s
  setTimeout(() => {
    if (quiz.answered) {
      nextQuizQuestion();
    }
  }, 1800);
}

function nextQuizQuestion() {
  renderQuizQuestion();
}

function updateQuizStats() {
  const total = quiz.correct + quiz.wrong;
  const pct = total > 0 ? Math.round(quiz.correct / total * 100) : null;

  document.getElementById('quizCorrect').textContent = quiz.correct;
  document.getElementById('quizWrong').textContent = quiz.wrong;
  document.getElementById('quizPct').textContent = pct !== null ? pct + '%' : '—';
}

function resetQuizStats() {
  quiz.correct = 0;
  quiz.wrong = 0;
  saveQuizStats();
  updateQuizStats();
  renderQuizQuestion();
}

// ---- Keyboard navigation ----

function handleKeyboard(e) {
  if (currentTab !== 'flashcard') return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch(e.key) {
    case ' ':
    case 'Enter':
      e.preventDefault();
      flipCard();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      fcPrev();
      break;
    case 'ArrowRight':
      e.preventDefault();
      fcNext();
      break;
    case 'l':
    case 'L':
      toggleLearned();
      break;
  }
}

// ---- Utility ----

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
