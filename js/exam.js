// exam.js - 試題練習邏輯

let questions = [];      // 當前題目集
let current = 0;         // 當前題目索引
// answers[i] = { tries: string[], solved: boolean }
//   tries  : 所有嘗試（含錯誤），依序記錄
//   solved : 是否已答對
let answers = {};
let mode = 'year';       // year | mock | wrong | custom
let currentYear = null;
let mockTimer = null;
let mockSeconds = 3600;

// ── 模式選擇 ────────────────────────────────────────────────

function showSelect() {
  hide('screenExam'); hide('screenResult');
  show('screenSelect');
  hide('yearSelectPanel'); hide('customPanel');
  updateWrongBadge();
}

function showYearSelect(m) {
  mode = m;
  document.getElementById('yearSelectTitle').textContent = m === 'mock' ? '選擇模擬考年份' : '選擇練習年份';
  show('yearSelectPanel'); hide('customPanel');
}

function showCustomMode() {
  show('customPanel'); hide('yearSelectPanel');
}

function updateWrongBadge() {
  const w = Storage.getWrongQuestions();
  const cnt = Object.keys(w).length;
  const badge = document.getElementById('wrongCountBadge');
  badge.textContent = cnt > 0 ? `${cnt} 題` : '';
}

// ── 載入題目 ────────────────────────────────────────────────

async function startExam(year) {
  currentYear = year;
  const data = await loadYear(year);
  if (!data) return;
  questions = data;
  answers = {};
  current = 0;
  hide('screenSelect');
  show('screenExam');
  document.getElementById('examLabel').textContent = `${year}年`;
  if (mode === 'mock') startMockTimer();
  else hide('examTimer');
  renderQ();
}

async function startWrongPractice() {
  mode = 'wrong';
  const w = Storage.getWrongQuestions();
  const keys = Object.keys(w);
  if (keys.length === 0) { alert('目前沒有錯題！繼續加油！'); return; }

  const byYear = {};
  keys.forEach(k => {
    const [y, id] = k.split('-');
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(parseInt(id));
  });

  questions = [];
  for (const [year, ids] of Object.entries(byYear)) {
    const data = await loadYear(parseInt(year));
    if (!data) continue;
    ids.forEach(id => {
      const q = data.find(q => q.id === id);
      if (q) questions.push({ ...q, _year: parseInt(year) });
    });
  }

  if (questions.length === 0) return;
  shuffle(questions);
  answers = {}; current = 0;
  hide('screenSelect'); show('screenExam');
  document.getElementById('examLabel').textContent = '錯題練習';
  hide('examTimer');
  renderQ();
}

async function startCustomExam() {
  const checked = [...document.querySelectorAll('input[name="cy"]:checked')].map(el => parseInt(el.value));
  if (checked.length === 0) { alert('請至少選擇一個年份'); return; }
  const count = parseInt(document.getElementById('customCount').value) || 20;

  mode = 'custom';
  let pool = [];
  for (const year of checked) {
    const data = await loadYear(year);
    if (data) pool.push(...data.map(q => ({ ...q, _year: year })));
  }
  shuffle(pool);
  questions = pool.slice(0, count);
  answers = {}; current = 0;
  currentYear = checked[0];
  hide('screenSelect'); show('screenExam');
  document.getElementById('examLabel').textContent = '自訂練習';
  hide('examTimer');
  renderQ();
}

async function loadYear(year) {
  try {
    const res = await fetch(`data/questions-${year}.json`);
    return await res.json();
  } catch(e) {
    alert(`無法載入 ${year} 年題目`); return null;
  }
}

// ── 模擬考計時器 ────────────────────────────────────────────

function startMockTimer() {
  mockSeconds = 3600;
  show('examTimer');
  if (mockTimer) clearInterval(mockTimer);
  mockTimer = setInterval(() => {
    mockSeconds--;
    const m = String(Math.floor(mockSeconds/60)).padStart(2,'0');
    const s = String(mockSeconds%60).padStart(2,'0');
    document.getElementById('timerDisplay').textContent = `${m}:${s}`;
    if (mockSeconds <= 0) { clearInterval(mockTimer); showResult(); }
  }, 1000);
}

// ── 渲染題目 ────────────────────────────────────────────────

function renderQ() {
  const q = questions[current];
  if (!q) return;
  const total = questions.length;
  const state = answers[current] || { tries: [], solved: false };
  const gaveUp = !state.solved && state.tries.length >= 3;
  const done = state.solved || gaveUp;

  document.getElementById('examCounter').textContent = `第 ${current+1} / ${total} 題`;
  document.getElementById('progressBar').style.width = `${(current+1)/total*100}%`;
  document.getElementById('qNum').textContent = `第 ${q.id} 題`;
  document.getElementById('qText').textContent = q.question;

  // 段落
  const pb = document.getElementById('passageBox');
  if (q.passage) { pb.textContent = q.passage; show('passageBox'); }
  else hide('passageBox');

  // 選項
  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = ['A','B','C','D'].map(letter => {
    if (!q.options[letter]) return '';
    let cls = 'option-btn';
    let disabled = false;

    if (done) {
      // 題目結束：顯示正確答案與所有錯誤嘗試
      disabled = true;
      if (letter === q.answer) cls += ' opt-correct';
      else if (state.tries.includes(letter)) cls += ' opt-wrong';
    } else {
      // 作答中：已嘗試且錯誤的選項鎖定變紅
      if (state.tries.includes(letter)) {
        cls += ' opt-wrong';
        disabled = true;
      }
    }

    return `<button class="${cls}" onclick="selectAnswer('${letter}')" ${disabled ? 'disabled' : ''}>
      <span class="option-letter">${letter}</span>
      <span class="opt-text">${q.options[letter]}</span>
    </button>`;
  }).join('');

  // 回饋 / 提示
  const fb = document.getElementById('feedbackBox');
  if (state.solved) {
    fb.className = 'feedback-card feedback-correct';
    const tries = state.tries.length;
    fb.innerHTML = tries === 1
      ? '✓ 一次答對！繼續保持！'
      : `✓ 答對了！共嘗試 ${tries} 次`;
    show('feedbackBox');
  } else if (gaveUp) {
    fb.className = 'feedback-card feedback-wrong';
    fb.innerHTML = `💡 答案揭曉：正確答案是 <strong>${q.answer}</strong>　${q.options[q.answer]}`;
    show('feedbackBox');
  } else if (state.tries.length > 0) {
    fb.className = 'feedback-card feedback-wrong';
    fb.innerHTML = getHint(q, state.tries.length);
    show('feedbackBox');
  } else {
    hide('feedbackBox');
  }

  // 下一題按鈕：只有答對或揭曉後才出現
  if (done) {
    show('btnNext');
    document.getElementById('btnNext').textContent =
      current === total - 1 ? '查看結果 →' : '下一題 →';
  } else {
    hide('btnNext');
  }

  // 上一題按鈕
  document.getElementById('btnPrev').style.visibility = current > 0 ? 'visible' : 'hidden';
}

// ── 作答 ────────────────────────────────────────────────────

function selectAnswer(letter) {
  const q = questions[current];
  const state = answers[current] || { tries: [], solved: false };

  // 已結束或已嘗試此選項：忽略
  if (state.solved || state.tries.length >= 3) return;
  if (state.tries.includes(letter)) return;

  state.tries.push(letter);

  if (letter === q.answer) {
    state.solved = true;
  }

  answers[current] = state;
  renderQ();
}

function nextQ() {
  if (current >= questions.length - 1) { showResult(); return; }
  current++;
  renderQ();
}

function prevQ() {
  if (current <= 0) return;
  current--;
  renderQ();
}

// ── 提示產生 ────────────────────────────────────────────────

function getHint(q, attemptNum) {
  if (attemptNum === 1) {
    const kw = extractKeywords(q.question);
    return kw
      ? `再試一次！注意題目關鍵字：<strong>${kw}</strong>`
      : '再試一次！仔細重讀題目';
  }
  if (attemptNum === 2) {
    if (q.passage) {
      const clue = findPassageClue(q.passage, q.options[q.answer]);
      return clue
        ? `提示：文章中提到「<em>${clue}</em>」，找找看與答案的關係`
        : '提示：答案線索在文章裡，請重新仔細閱讀';
    } else {
      const half = Math.ceil(q.options[q.answer].length / 2);
      return `提示：正確選項開頭是「${q.options[q.answer].slice(0, half)}…」`;
    }
  }
  // attemptNum >= 3：由 renderQ 顯示揭曉訊息，不走這裡
  return '';
}

function extractKeywords(text) {
  const stop = new Set([
    'the','a','an','is','are','was','were','be','been','being',
    'have','has','had','do','does','did','will','would','could',
    'should','may','might','can','that','this','these','those',
    'it','its','in','on','at','to','for','of','with','by','from',
    'as','and','but','or','not','no','so','than','too','very',
    'just','what','how','when','where','which','who','he','she',
    'they','we','you','i','his','her','their','our','your','my',
    'him','them','us','me','then','also','about','after','before',
    'into','over','only','more','most','some','such'
  ]);
  const words = text.replace(/[^a-zA-Z\s]/g, ' ').toLowerCase().split(/\s+/);
  const unique = [...new Set(words.filter(w => w.length > 3 && !stop.has(w)))];
  return unique.slice(0, 3).join('、') || null;
}

function findPassageClue(passage, correctOption) {
  const optWords = correctOption.toLowerCase()
    .replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const sentences = passage
    .split(/(?<=[.!?])\s+|\n/)
    .map(s => s.trim()).filter(s => s.length > 10);

  let best = null, bestScore = 0;
  sentences.forEach(s => {
    const lower = s.toLowerCase();
    const score = optWords.filter(w => lower.includes(w)).length;
    if (score > bestScore) { bestScore = score; best = s; }
  });

  if (best && bestScore > 0) {
    return best.length > 55 ? best.slice(0, 55) + '…' : best;
  }
  return null;
}

// ── 結果 ────────────────────────────────────────────────────

function showResult() {
  if (mockTimer) clearInterval(mockTimer);

  const total = questions.length;

  // 統計：solved = 答對（無論幾次），otherwise = 未解出
  const wrongIds = [];
  let correct = 0;
  questions.forEach((q, i) => {
    const state = answers[i];
    const year = q._year || currentYear;
    if (state && state.solved) {
      correct++;
      Storage.markCorrect(year, q.id);
    } else {
      wrongIds.push(i);
      Storage.markWrong(year, q.id);
    }
  });

  const pct = Math.round(correct / total * 100);

  Storage.addExamResult({
    year: currentYear, mode, score: correct, total,
    wrongIds: wrongIds.map(i => questions[i].id)
  });

  // 分數
  document.getElementById('resultScore').textContent = `${correct} / ${total} (${pct}%)`;
  const gradeEl = document.getElementById('resultGrade');
  gradeEl.textContent = pct >= 80 ? '精熟 ⭐' : pct >= 60 ? '基礎 👍' : '待加強 💪';
  gradeEl.className = 'result-grade-tag grade-tag-' + (pct >= 80 ? 'a' : pct >= 60 ? 'b' : 'c');

  // 弱點分析
  let sCorr = 0, sTotal = 0, pCorr = 0, pTotal = 0;
  questions.forEach((q, i) => {
    const solved = answers[i]?.solved;
    if (q.type === 'single') { sTotal++; if (solved) sCorr++; }
    else { pTotal++; if (solved) pCorr++; }
  });
  document.getElementById('analysisGrid').innerHTML = `
    <div class="analysis-row">
      <div class="analysis-label">單題</div>
      <div class="analysis-track"><div class="analysis-fill" style="width:${sTotal ? Math.round(sCorr/sTotal*100) : 0}%"></div></div>
      <div class="analysis-val">${sCorr}/${sTotal}</div>
    </div>
    <div class="analysis-row">
      <div class="analysis-label">題組</div>
      <div class="analysis-track"><div class="analysis-fill" style="width:${pTotal ? Math.round(pCorr/pTotal*100) : 0}%"></div></div>
      <div class="analysis-val">${pCorr}/${pTotal}</div>
    </div>`;

  // 錯題列表
  document.getElementById('wrongCount2').textContent = `(${wrongIds.length} 題)`;
  if (wrongIds.length > 0) {
    document.getElementById('wrongList').innerHTML = wrongIds.map(i => {
      const q = questions[i];
      const state = answers[i];
      const triedLetters = state?.tries || [];
      return `<div class="wrong-item">
        <span class="wrong-qnum">第 ${q.id} 題</span>
        <span class="wrong-qtext">${q.question.slice(0,60)}${q.question.length>60?'…':''}</span>
        <span class="wrong-ans">
          你選：<strong class="mark-wrong">${triedLetters.join('、') || '未作答'}</strong>
          　正確：<strong class="mark-correct">${q.answer}</strong>
        </span>
      </div>`;
    }).join('');
    document.getElementById('btnRetryWrong').style.display = '';
  } else {
    document.getElementById('wrongList').innerHTML = '<p class="no-wrong">全對！太厲害了！🎉</p>';
    document.getElementById('btnRetryWrong').style.display = 'none';
  }

  hide('screenExam'); hide('screenSelect');
  show('screenResult');
}

function retryWrong() {
  // 重新練習本次未答對的題目
  const wrongQs = questions.filter((_, i) => !(answers[i]?.solved));
  questions = wrongQs;
  answers = {}; current = 0;
  mode = 'wrong';
  hide('screenResult'); show('screenExam');
  hide('examTimer');
  renderQ();
}

function exitExam() {
  if (mockTimer) clearInterval(mockTimer);
  showSelect();
}

// ── 工具 ────────────────────────────────────────────────────

function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }
function shuffle(arr) {
  for (let i = arr.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// 初始化
showSelect();
