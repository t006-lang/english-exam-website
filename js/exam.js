// exam.js - 試題練習邏輯

let questions = [];      // 當前題目集
let current = 0;         // 當前題目索引
let answers = {};        // { index: 'A'/'B'/'C'/'D' }
let mode = 'year';       // year | mock | wrong | custom
let currentYear = null;
let mockTimer = null;
let mockSeconds = 3600;
let wrongIds = [];       // 答錯的索引陣列

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
  wrongIds = [];
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

  // 按年份分組載入
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
  answers = {}; wrongIds = []; current = 0;
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
  answers = {}; wrongIds = []; current = 0;
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
    const chosen = answers[current];
    let cls = 'option-btn';
    if (chosen) {
      if (letter === q.answer) cls += ' opt-correct';
      else if (letter === chosen) cls += ' opt-wrong';
    }
    return `<button class="${cls}" onclick="selectAnswer('${letter}')" ${chosen ? 'disabled' : ''}>
      <span class="option-letter">${letter}</span>
      <span class="opt-text">${q.options[letter]}</span>
    </button>`;
  }).join('');

  // 回饋
  const fb = document.getElementById('feedbackBox');
  if (answers[current]) {
    const correct = answers[current] === q.answer;
    fb.className = 'feedback-card ' + (correct ? 'feedback-correct' : 'feedback-wrong');
    fb.innerHTML = correct
      ? `✓ 答對了！正確答案是 ${q.answer}`
      : `✗ 答錯了！正確答案是 <strong>${q.answer}</strong>：${q.options[q.answer]}`;
    show('feedbackBox');
    show('btnNext');
  } else {
    hide('feedbackBox');
    hide('btnNext');
  }

  // 上一題按鈕
  document.getElementById('btnPrev').style.visibility = current > 0 ? 'visible' : 'hidden';

  // 最後一題：改顯示「查看結果」
  if (current === total - 1 && answers[current]) {
    document.getElementById('btnNext').textContent = '查看結果 →';
  } else {
    document.getElementById('btnNext').textContent = '下一題 →';
  }
}

// ── 作答 ────────────────────────────────────────────────────

function selectAnswer(letter) {
  if (answers[current] !== undefined) return;
  const q = questions[current];
  answers[current] = letter;

  const year = q._year || currentYear;
  if (letter !== q.answer) {
    wrongIds.push(current);
    Storage.markWrong(year, q.id);
  } else {
    Storage.markCorrect(year, q.id);
  }
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

// ── 結果 ────────────────────────────────────────────────────

function showResult() {
  if (mockTimer) clearInterval(mockTimer);

  const total = questions.length;
  const answered = Object.keys(answers).length;
  const correct = Object.values(answers).filter((a,i) => a === questions[i].answer).length;
  const pct = Math.round(correct/total*100);

  // 儲存結果
  const year = currentYear;
  Storage.addExamResult({
    year, mode, score: correct, total,
    wrongIds: wrongIds.map(i => questions[i].id)
  });

  // 分數顯示
  document.getElementById('resultScore').textContent = `${correct} / ${total} (${pct}%)`;
  const grade = pct >= 80 ? '精熟 ⭐' : pct >= 60 ? '基礎 👍' : '待加強 💪';
  const gradeCls = pct >= 80 ? 'grade-a' : pct >= 60 ? 'grade-b' : 'grade-c';
  const gradeEl = document.getElementById('resultGrade');
  gradeEl.textContent = grade;
  gradeEl.className = 'result-grade-tag grade-tag-' + (pct >= 80 ? 'a' : pct >= 60 ? 'b' : 'c');

  // 弱點分析
  const singles = questions.filter(q => q.type === 'single');
  const passages = questions.filter(q => q.type === 'passage');
  const singleCorrect = singles.filter((_,i) => answers[questions.indexOf(singles[i])] === singles[i]?.answer).length;

  // 簡化計算：遍歷所有答題
  let sCorr = 0, sTotal = 0, pCorr = 0, pTotal = 0;
  questions.forEach((q, i) => {
    if (q.type === 'single') { sTotal++; if(answers[i]===q.answer) sCorr++; }
    else { pTotal++; if(answers[i]===q.answer) pCorr++; }
  });
  document.getElementById('analysisGrid').innerHTML = `
    <div class="analysis-row">
      <div class="analysis-label">單題</div>
      <div class="analysis-track"><div class="analysis-fill" style="width:${sTotal?Math.round(sCorr/sTotal*100):0}%"></div></div>
      <div class="analysis-val">${sCorr}/${sTotal}</div>
    </div>
    <div class="analysis-row">
      <div class="analysis-label">題組</div>
      <div class="analysis-track"><div class="analysis-fill" style="width:${pTotal?Math.round(pCorr/pTotal*100):0}%"></div></div>
      <div class="analysis-val">${pCorr}/${pTotal}</div>
    </div>`;

  // 錯題列表
  document.getElementById('wrongCount2').textContent = `(${wrongIds.length} 題)`;
  if (wrongIds.length > 0) {
    document.getElementById('wrongList').innerHTML = wrongIds.map(i => {
      const q = questions[i];
      return `<div class="wrong-item">
        <span class="wrong-qnum">第 ${q.id} 題</span>
        <span class="wrong-qtext">${q.question.slice(0,60)}${q.question.length>60?'…':''}</span>
        <span class="wrong-ans">你選：<strong class="mark-wrong">${answers[i]}</strong> 正確：<strong class="mark-correct">${q.answer}</strong></span>
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
  const wrongQs = wrongIds.map(i => questions[i]);
  questions = wrongQs;
  answers = {}; wrongIds = []; current = 0;
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
  for (let i=arr.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}

// 初始化
showSelect();
