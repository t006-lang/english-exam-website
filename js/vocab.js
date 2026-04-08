// vocab.js - 單字練習邏輯

let allWords = [];
let filteredWords = [];
let fcIndex = 0;
let fcFlipped = false;
let currentFilter = 'all';
let currentSearch = '';
let currentTopic = '';

// 測驗
let quizWords = [];
let quizIndex = 0;
let quizCorrect = 0;
const QUIZ_SIZE = 10;

// 智慧複習
let smartWords = [];
let smartIndex = 0;
let smartFlipped = false;

// ── 初始化 ──────────────────────────────────────────────────

async function init() {
  const res = await fetch('data/vocab-1200.json');
  allWords = await res.json();
  applyFilter();
  updateReviewBadge();
  renderStats();
}

// ── 分頁切換 ────────────────────────────────────────────────

function switchTab(tab) {
  ['flashcard','quiz','smart','stats'].forEach(t => {
    document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t===tab?'':'none';
  });
  document.querySelectorAll('.vtab').forEach((el,i) => el.classList.toggle('active', ['flashcard','quiz','smart','stats'][i]===tab));
  if (tab === 'quiz') startQuiz();
  if (tab === 'smart') loadSmartReview();
  if (tab === 'stats') renderStats();
}

// ── 篩選 ────────────────────────────────────────────────────

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.status-btn').forEach((el,i) => el.classList.toggle('active', ['all','new','learning','learned'][i]===f));
  applyFilter();
}

function doSearch() {
  currentSearch = document.getElementById('searchBox').value.toLowerCase();
  applyFilter();
}

function setTopic(topic) {
  currentTopic = topic;
  document.querySelectorAll('.topic-chip').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick') === `setTopic('${topic}')` || (topic === '' && el.getAttribute('onclick') === "setTopic('')"));
  });
  fcIndex = 0;
  applyFilter();
}

function applyFilter() {
  filteredWords = allWords.filter(w => {
    const d = Storage.getWordData(w.word);
    const statusMatch = currentFilter === 'all' || d.status === currentFilter || (currentFilter==='new' && d.status==='new');
    const searchMatch = !currentSearch || w.word.toLowerCase().includes(currentSearch) || w.chinese.includes(currentSearch);
    const topicMatch = !currentTopic || w.topic === currentTopic;
    return statusMatch && searchMatch && topicMatch;
  });
  fcIndex = 0;
  renderFlashcard();
}

// ── 單字卡 ──────────────────────────────────────────────────

function renderFlashcard() {
  if (filteredWords.length === 0) {
    document.getElementById('fcWord').textContent = '沒有符合的單字';
    document.getElementById('fcPos').textContent = '';
    document.getElementById('fcChinese').textContent = '';
    document.getElementById('fcProgress').textContent = '0 / 0';
    return;
  }
  const w = filteredWords[fcIndex];
  document.getElementById('fcWord').textContent = w.word;
  document.getElementById('fcPos').textContent = w.pos;
  document.getElementById('fcChinese').textContent = w.chinese;
  document.getElementById('fcWordSmall').textContent = w.word;
  document.getElementById('fcProgress').textContent = `${fcIndex+1} / ${filteredWords.length}`;
  document.getElementById('fcExample').innerHTML = '<span class="fc-example-loading">載入例句中…</span>';
  showCardFront();
}

// ── 發音 ─────────────────────────────────────────────────────

function speakWord() {
  if (!window.speechSynthesis) return;
  const word = filteredWords[fcIndex]?.word;
  if (!word) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = 'en-US';
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}

// ── 例句（從 JSON 資料讀取）──────────────────────────────────

function loadExample(word) {
  const el = document.getElementById('fcExample');
  if (!el) return;
  const w = filteredWords[fcIndex];
  if (w && w.example) {
    const highlighted = w.example.replace(
      new RegExp(`\\b(${w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi'),
      '<u>$1</u>'
    );
    el.innerHTML = `<div class="fc-example-text">📖 ${highlighted}</div>`;
  } else {
    el.innerHTML = '';
  }
}

function showCardFront() {
  fcFlipped = false;
  document.getElementById('cardFront').style.display = '';
  document.getElementById('cardBack').style.display = 'none';
  document.getElementById('flashcard').classList.remove('flipped');
}

function flipCard() {
  fcFlipped = !fcFlipped;
  document.getElementById('cardFront').style.display = fcFlipped ? 'none' : '';
  document.getElementById('cardBack').style.display = fcFlipped ? '' : 'none';
  if (fcFlipped) {
    loadExample();
  }
}

function fcNext() {
  if (filteredWords.length === 0) return;
  fcIndex = (fcIndex + 1) % filteredWords.length;
  renderFlashcard();
}

function fcPrev() {
  if (filteredWords.length === 0) return;
  fcIndex = (fcIndex - 1 + filteredWords.length) % filteredWords.length;
  renderFlashcard();
}

function markStatus(status) {
  if (filteredWords.length === 0) return;
  const w = filteredWords[fcIndex];
  Storage.updateWord(w.word, { status });
  Storage.addVocabHistory({ learned: status === 'learned' ? 1 : 0 });
  updateReviewBadge();
  fcNext();
}

// ── 測驗 ────────────────────────────────────────────────────

function canBlank(w) {
  if (!w.example) return false;
  const escaped = w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasSpecialPunct = /[./]/.test(w.word);
  const pattern = hasSpecialPunct
    ? new RegExp(escaped, 'i')
    : new RegExp(`\\b${escaped}\\b`, 'i');
  return pattern.test(w.example);
}

function startQuiz() {
  const base = filteredWords.length >= 4 ? filteredWords : allWords;
  // 只使用能正確插入空格的單字
  const pool = base.filter(canBlank).length >= 4
    ? base.filter(canBlank)
    : base;
  const shuffled = [...pool].sort(() => Math.random()-0.5);
  quizWords = shuffled.slice(0, QUIZ_SIZE);
  quizIndex = 0; quizCorrect = 0;
  document.getElementById('quizWrap').style.display = '';
  document.getElementById('quizEnd').style.display = 'none';
  document.getElementById('quizScore').textContent = 0;
  document.getElementById('quizTotal').textContent = 0;
  renderQuizQ();
}

function renderQuizQ() {
  if (quizIndex >= quizWords.length) { showQuizEnd(); return; }
  const w = quizWords[quizIndex];

  // 例句中的目標單字換成空格
  // 對含標點的特殊詞（a.m. / p.m. / Mr. / Mrs. / Ms. / a/an）用字面比對
  const blank = '______';
  const escaped = w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasSpecialPunct = /[./]/.test(w.word);
  const pattern = hasSpecialPunct
    ? new RegExp(escaped, 'gi')
    : new RegExp(`\\b${escaped}\\b`, 'gi');
  const sentence = w.example ? w.example.replace(pattern, blank) : blank;
  document.getElementById('quizWord').textContent = sentence;

  // 4個選項：1正確英文單字 + 3隨機英文單字
  const others = allWords.filter(x => x.word !== w.word).sort(() => Math.random()-0.5).slice(0, 3);
  const opts = [w, ...others].sort(() => Math.random()-0.5);

  document.getElementById('btnNextQuiz').style.display = 'none';
  document.getElementById('quizOptions').innerHTML = opts.map(o => `
    <button class="quiz-opt" onclick="selectQuizOpt(this,'${o.word}','${w.word}')">${o.word}</button>
  `).join('');
}

function selectQuizOpt(el, chosen, correct) {
  document.querySelectorAll('.quiz-opt').forEach(b => b.disabled = true);
  if (chosen === correct) {
    el.classList.add('opt-correct');
    quizCorrect++;
    Storage.markCorrect(0, chosen);
  } else {
    el.classList.add('opt-wrong');
    document.querySelectorAll('.quiz-opt').forEach(b => {
      if (b.textContent.trim() === correct) b.classList.add('opt-correct');
    });
    Storage.markWrong(0, chosen);
  }
  quizIndex++;
  document.getElementById('quizScore').textContent = quizCorrect;
  document.getElementById('quizTotal').textContent = quizIndex;
  document.getElementById('btnNextQuiz').style.display = '';
}

function nextQuizQ() {
  document.getElementById('btnNextQuiz').style.display = 'none';
  renderQuizQ();
}

function showQuizEnd() {
  Storage.addVocabHistory({ reviewed: quizWords.length });
  document.getElementById('quizWrap').style.display = 'none';
  document.getElementById('quizEnd').style.display = '';
  document.getElementById('quizEndScore').textContent = `${quizCorrect} / ${quizWords.length} (${Math.round(quizCorrect/quizWords.length*100)}%)`;
}

// ── 智慧複習 (SM-2 簡化版) ──────────────────────────────────

function loadSmartReview() {
  const today = new Date().toISOString().slice(0,10);
  smartWords = allWords.filter(w => {
    const d = Storage.getWordData(w.word);
    if (d.status === 'new') return false;
    if (!d.nextReview) return d.status === 'learning';
    return d.nextReview <= today;
  }).slice(0, 30);

  document.getElementById('reviewCount').textContent = smartWords.length;
  smartIndex = 0;

  if (smartWords.length === 0) {
    document.getElementById('smartWrap').style.display = 'none';
    document.getElementById('smartDone').style.display = '';
  } else {
    document.getElementById('smartWrap').style.display = '';
    document.getElementById('smartDone').style.display = 'none';
    renderSmartCard();
  }
}

function renderSmartCard() {
  if (smartIndex >= smartWords.length) {
    document.getElementById('smartWrap').style.display = 'none';
    document.getElementById('smartDone').style.display = '';
    return;
  }
  const w = smartWords[smartIndex];
  document.getElementById('smWord').textContent = w.word;
  document.getElementById('smPos').textContent = w.pos;
  document.getElementById('smChinese').textContent = w.chinese;
  document.getElementById('smWordSmall').textContent = w.word;
  document.getElementById('smCurrent').textContent = smartIndex + 1;
  document.getElementById('smTotal').textContent = smartWords.length;
  document.getElementById('smartActions').style.display = 'none';
  document.getElementById('smartFront').style.display = '';
  document.getElementById('smartBack').style.display = 'none';
  smartFlipped = false;
}

function flipSmartCard() {
  smartFlipped = !smartFlipped;
  document.getElementById('smartFront').style.display = smartFlipped ? 'none' : '';
  document.getElementById('smartBack').style.display = smartFlipped ? '' : 'none';
  if (smartFlipped) document.getElementById('smartActions').style.display = '';
}

function smartReview(result) {
  const w = smartWords[smartIndex];
  const d = Storage.getWordData(w.word);
  const today = new Date();
  let interval = d.interval || 1;
  let ef = d.easeFactor || 2.5;

  if (result === 'forgot') { interval = 1; ef = Math.max(1.3, ef - 0.2); }
  else if (result === 'vague') { interval = Math.max(1, Math.round(interval * 1.5)); }
  else { interval = Math.round(interval * ef); ef = Math.min(3.0, ef + 0.1); }

  const next = new Date(today);
  next.setDate(next.getDate() + interval);

  Storage.updateWord(w.word, {
    status: result === 'forgot' ? 'learning' : 'learned',
    interval, easeFactor: ef,
    nextReview: next.toISOString().slice(0,10),
    wrongCount: result === 'forgot' ? (d.wrongCount||0)+1 : d.wrongCount||0
  });
  Storage.addVocabHistory({ reviewed: 1, learned: result !== 'forgot' ? 1 : 0 });

  smartIndex++;
  renderSmartCard();
  updateReviewBadge();
}

// ── 統計 ────────────────────────────────────────────────────

function renderStats() {
  const vocab = Storage.getVocab();
  let nNew = 0, nLearning = 0, nLearned = 0;
  allWords.forEach(w => {
    const d = vocab[w.word];
    if (!d || d.status === 'new') nNew++;
    else if (d.status === 'learning') nLearning++;
    else nLearned++;
  });
  document.getElementById('stNew').textContent = nNew;
  document.getElementById('stLearning').textContent = nLearning;
  document.getElementById('stLearned').textContent = nLearned;
  document.getElementById('stTotal').textContent = allWords.length;

  // 圓餅圖
  const total = allWords.length;
  const canvas = document.getElementById('pieChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,200,200);
  const slices = [
    { val: nNew, color: '#94a3b8', label: '未學習' },
    { val: nLearning, color: '#60a5fa', label: '學習中' },
    { val: nLearned, color: '#34d399', label: '已熟悉' },
  ];
  let start = -Math.PI/2;
  slices.forEach(s => {
    const angle = (s.val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(100,100);
    ctx.arc(100,100,90,start,start+angle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    start += angle;
  });

  // 週歷史
  const history = Storage.getVocabHistory();
  const days = [];
  for (let i=6;i>=0;i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const ds = d.toISOString().slice(0,10);
    const h = history.find(h => h.date === ds);
    days.push({ date: ds.slice(5), learned: h?.learned||0 });
  }
  const max = Math.max(...days.map(d=>d.learned), 1);
  document.getElementById('weeklyBars').innerHTML = days.map(d => `
    <div class="week-item">
      <div class="week-bar" style="height:${Math.round(d.learned/max*60)}px"></div>
      <div class="week-date">${d.date}</div>
      <div class="week-val">${d.learned}</div>
    </div>`).join('');
}

function updateReviewBadge() {
  const today = new Date().toISOString().slice(0,10);
  const count = allWords.filter(w => {
    const d = Storage.getWordData(w.word);
    if (d.status === 'new') return false;
    if (!d.nextReview) return d.status === 'learning';
    return d.nextReview <= today;
  }).length;
  document.getElementById('reviewBadge').textContent = count > 0 ? count : '';
}

// 鍵盤快捷鍵
document.addEventListener('keydown', e => {
  const activeTab = document.querySelector('.vtab.active')?.textContent;
  if (activeTab?.includes('單字卡')) {
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
    if (e.key === 'ArrowRight') fcNext();
    if (e.key === 'ArrowLeft') fcPrev();
    if (e.key === 'l' || e.key === 'L') markStatus('learned');
  }
});

init();
