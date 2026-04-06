/* ============================================================
   Exam Logic - 會考英語閱讀練習
   ============================================================ */

const QUESTION_COUNTS = {107:41, 108:41, 109:41, 110:41, 111:43, 112:43, 113:43, 114:43};

let state = {
  year: 114,
  questions: [],
  currentIndex: 0,
  answers: {},      // { questionId: selectedLetter }
  score: 0,
  loading: false
};

// ---- localStorage helpers ----

function saveProgress() {
  const key = `exam_progress_${state.year}`;
  localStorage.setItem(key, JSON.stringify({
    answers: state.answers,
    score: state.score,
    currentIndex: state.currentIndex
  }));
}

function loadProgress(year) {
  const key = `exam_progress_${year}`;
  return JSON.parse(localStorage.getItem(key) || 'null');
}

function clearProgress(year) {
  localStorage.removeItem(`exam_progress_${year}`);
}

// ---- Year switching ----

function switchYear(year) {
  if (state.loading) return;
  // Update URL without reload
  history.replaceState(null, '', `exam.html?year=${year}`);
  initExam(year);
}

// ---- Init ----

async function initExam(year) {
  state.year = year;
  state.loading = true;

  // Update year tabs
  document.querySelectorAll('.year-tab').forEach(tab => {
    tab.classList.toggle('active', parseInt(tab.dataset.year) === year);
  });

  document.getElementById('examTitle').textContent = `${year}年 英語閱讀`;
  document.getElementById('examCounter').textContent = '載入中...';
  document.getElementById('mainContent').innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>載入試題中...</p>
    </div>`;

  try {
    const res = await fetch(`data/questions-${year}.json`);
    if (!res.ok) throw new Error('Failed to fetch');
    const questions = await res.json();

    state.questions = questions.filter(q => q.options && Object.keys(q.options).length >= 2);
    state.answers = {};
    state.score = 0;
    state.currentIndex = 0;

    // Restore progress
    const saved = loadProgress(year);
    if (saved) {
      state.answers = saved.answers || {};
      state.score = saved.score || 0;
      // Find first unanswered question
      const answeredIds = Object.keys(state.answers).map(Number);
      const firstUnanswered = state.questions.findIndex(q => !answeredIds.includes(q.id));
      state.currentIndex = firstUnanswered === -1 ? state.questions.length - 1 : firstUnanswered;
      if (saved.currentIndex !== undefined && firstUnanswered === -1) {
        state.currentIndex = saved.currentIndex;
      }
    }

    state.loading = false;

    // Check if all answered -> show summary
    if (Object.keys(state.answers).length >= state.questions.length && state.questions.length > 0) {
      renderSummary();
    } else {
      renderQuestion();
    }
  } catch (err) {
    state.loading = false;
    document.getElementById('mainContent').innerHTML = `
      <div class="exam-main">
        <div class="card" style="text-align:center; color:#d9534f;">
          <p style="font-size:1.5rem; margin-bottom:8px;">⚠️</p>
          <p>無法載入 ${year} 年試題</p>
          <p style="font-size:0.85rem; color:#888; margin-top:8px;">${err.message}</p>
        </div>
      </div>`;
  }
}

// ---- Render question ----

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  if (!q) return;

  const total = state.questions.length;
  const current = state.currentIndex + 1;
  const answered = Object.keys(state.answers).length;
  const pct = Math.round(answered / total * 100);

  // Update header
  document.getElementById('examTitle').textContent = `${state.year}年 英語閱讀`;
  document.getElementById('examCounter').textContent = `第 ${current} / ${total} 題`;
  document.getElementById('progressBar').style.width = pct + '%';

  // Build HTML
  let html = '<div class="exam-main">';

  // Passage (if applicable)
  if (q.passage) {
    html += `
      <div class="passage-block">
        <div class="passage-label">閱讀文章</div>
        ${escapeHtml(q.passage)}
      </div>`;
  }

  // Question
  const typeLabel = q.type === 'passage'
    ? '<span class="badge badge-passage">題組</span>'
    : '<span class="badge badge-single">單題</span>';

  const alreadyAnswered = state.answers[q.id];

  html += `
    <div class="question-block">
      <div class="question-number">${typeLabel} 第 ${q.id} 題</div>
      <div class="question-text">${escapeHtml(q.question || '（本題含圖片，請參考原始試題）')}</div>
      <div class="options-list" id="optionsList">`;

  const letters = ['A','B','C','D'];
  letters.forEach(letter => {
    const text = q.options[letter];
    if (!text) return;

    let btnClass = 'option-btn';
    if (alreadyAnswered) {
      if (letter === q.answer) btnClass += ' correct';
      else if (letter === alreadyAnswered && alreadyAnswered !== q.answer) btnClass += ' wrong';
    }

    const disabled = alreadyAnswered ? 'disabled' : '';
    html += `
      <button class="${btnClass}" ${disabled} onclick="selectAnswer('${letter}')">
        <span class="option-letter">${letter}</span>
        <span>${escapeHtml(text)}</span>
      </button>`;
  });

  html += `</div>`;

  // If no options (picture question)
  if (Object.keys(q.options).length < 2) {
    html += `<div class="answer-feedback correct" style="display:flex;">
      <span>⚠️</span>
      <span>本題含圖片，請參考原始試題。正確答案：<strong>${q.answer}</strong></span>
    </div>`;
  }

  // Feedback
  if (alreadyAnswered) {
    const isCorrect = alreadyAnswered === q.answer;
    html += `
      <div class="answer-feedback ${isCorrect ? 'correct' : 'wrong'}" style="display:flex;">
        <span>${isCorrect ? '✓' : '✗'}</span>
        <span>${isCorrect ? '答對了！' : `答錯了，正確答案是 <strong>${q.answer}</strong>`}</span>
      </div>`;
  }

  html += `</div>`; // question-block

  // Navigation
  html += `
    <div class="nav-buttons">
      <button class="nav-btn" onclick="prevQuestion()" ${state.currentIndex === 0 ? 'disabled' : ''}>← 上一題</button>
      <button class="nav-btn primary" onclick="nextQuestion()" id="nextBtn">
        ${state.currentIndex === total - 1 ? '查看結果' : '下一題 →'}
      </button>
    </div>`;

  html += '</div>'; // exam-main

  document.getElementById('mainContent').innerHTML = html;
}

// ---- Answer selection ----

function selectAnswer(letter) {
  const q = state.questions[state.currentIndex];
  if (!q || state.answers[q.id]) return;

  state.answers[q.id] = letter;
  if (letter === q.answer) {
    state.score++;
  }
  saveProgress();
  renderQuestion();

  // Auto advance after short delay
  setTimeout(() => {
    if (state.currentIndex < state.questions.length - 1) {
      nextQuestion();
    } else {
      renderSummary();
    }
  }, 1200);
}

// ---- Navigation ----

function prevQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    saveProgress();
    renderQuestion();
  }
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    saveProgress();
    renderQuestion();
  } else {
    renderSummary();
  }
}

// ---- Summary ----

function renderSummary() {
  const total = state.questions.length;
  const answered = Object.keys(state.answers).length;
  const correct = state.score;
  const pct = answered > 0 ? Math.round(correct / answered * 100) : 0;

  // Update header
  document.getElementById('examTitle').textContent = `${state.year}年 英語閱讀`;
  document.getElementById('examCounter').textContent = `完成 ${answered} / ${total} 題`;
  document.getElementById('progressBar').style.width = '100%';

  let grade, gradeColor, desc;
  if (pct >= 90) { grade = '精熟 A++'; gradeColor = '#2e9e5b'; desc = '表現優異！繼續保持！'; }
  else if (pct >= 80) { grade = '精熟 A+'; gradeColor = '#2e9e5b'; desc = '非常好！再衝上去！'; }
  else if (pct >= 70) { grade = '精熟 A'; gradeColor = '#1a6fc4'; desc = '不錯！繼續努力！'; }
  else if (pct >= 60) { grade = '基礎 B++'; gradeColor = '#1a6fc4'; desc = '繼續練習！'; }
  else if (pct >= 50) { grade = '基礎 B+'; gradeColor = '#f0a500'; desc = '多練習幾遍！'; }
  else if (pct >= 40) { grade = '基礎 B'; gradeColor = '#f0a500'; desc = '加強練習！'; }
  else { grade = '待加強'; gradeColor = '#d9534f'; desc = '多複習試題！'; }

  // Breakdown by type
  let singleCorrect = 0, singleTotal = 0, passageCorrect = 0, passageTotal = 0;
  state.questions.forEach(q => {
    const ans = state.answers[q.id];
    if (ans !== undefined) {
      if (q.type === 'single') {
        singleTotal++;
        if (ans === q.answer) singleCorrect++;
      } else {
        passageTotal++;
        if (ans === q.answer) passageCorrect++;
      }
    }
  });

  let html = `
    <div class="exam-main">
      <div class="card score-summary">
        <div class="score-circle">
          <div class="score-number">${correct}</div>
          <div class="score-total">/ ${answered} 題</div>
        </div>
        <div class="score-grade" style="color:${gradeColor}">${grade} (${pct}%)</div>
        <div class="score-desc">${desc}</div>

        <div class="stats-row" style="margin-bottom:24px;">
          <div class="stat-card">
            <div class="stat-number" style="font-size:1.3rem;">${singleTotal > 0 ? Math.round(singleCorrect/singleTotal*100) : 0}%</div>
            <div class="stat-label">單題正確率</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" style="font-size:1.3rem;">${passageTotal > 0 ? Math.round(passageCorrect/passageTotal*100) : 0}%</div>
            <div class="stat-label">題組正確率</div>
          </div>
        </div>

        <div class="score-actions">
          <button class="btn btn-outline" onclick="reviewAnswers()">複習答題</button>
          <button class="btn btn-primary" onclick="restartExam()">重新作答</button>
        </div>
      </div>

      <!-- Question review -->
      <div class="card" id="reviewCard" style="display:none;">
        <p class="section-title" style="margin-bottom:16px;">答題詳情</p>
        <div id="reviewList"></div>
      </div>

      <div class="card text-center" style="padding:16px;">
        <p style="font-size:0.85rem; color:#888; margin-bottom:12px;">練習其他年份</p>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
          ${[114,113,112,111,110,109,108,107].filter(y => y !== state.year).map(y =>
            `<a href="exam.html?year=${y}" class="btn btn-outline" style="padding:8px 14px; font-size:0.85rem;">${y}年</a>`
          ).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('mainContent').innerHTML = html;
}

function reviewAnswers() {
  const card = document.getElementById('reviewCard');
  const list = document.getElementById('reviewList');

  if (card.style.display === 'none') {
    card.style.display = 'block';
    let html = '';
    state.questions.forEach(q => {
      const userAns = state.answers[q.id];
      const isCorrect = userAns === q.answer;
      const icon = userAns === undefined ? '—' : (isCorrect ? '✓' : '✗');
      const color = userAns === undefined ? '#999' : (isCorrect ? '#2e9e5b' : '#d9534f');

      html += `
        <div style="display:flex; align-items:flex-start; gap:12px; padding:10px 0; border-bottom:1px solid #eee;">
          <span style="color:${color}; font-weight:700; font-size:1.1rem; min-width:24px;">${icon}</span>
          <div style="flex:1;">
            <span style="font-size:0.85rem; color:#888;">第 ${q.id} 題</span>
            <div style="font-size:0.9rem; margin-top:2px;">${escapeHtml((q.question||'').substring(0,80))}${(q.question||'').length > 80 ? '...' : ''}</div>
            ${!isCorrect && userAns ? `<div style="font-size:0.85rem; color:#d9534f; margin-top:4px;">你的答案: ${userAns} → 正確: ${q.answer}</div>` : ''}
          </div>
        </div>`;
    });
    list.innerHTML = html || '<p style="color:#888;">沒有作答紀錄</p>';
    card.scrollIntoView({ behavior: 'smooth' });
  } else {
    card.style.display = 'none';
  }
}

function restartExam() {
  clearProgress(state.year);
  state.answers = {};
  state.score = 0;
  state.currentIndex = 0;
  renderQuestion();
}

// ---- Utility ----

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}
