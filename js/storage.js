// storage.js - 統一管理 localStorage

const Storage = {
  KEYS: {
    EXAM_HISTORY: 'exam_history',
    WRONG_QUESTIONS: 'wrong_questions',
    EXAM_PROGRESS: 'exam_progress',
    VOCAB: 'vocab_data',
    VOCAB_HISTORY: 'vocab_history',
  },

  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  },

  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.error(e); }
  },

  // 考試歷史
  getExamHistory() { return this.get(this.KEYS.EXAM_HISTORY) || []; },
  addExamResult(result) {
    const h = this.getExamHistory();
    h.unshift({ ...result, date: new Date().toISOString().slice(0,10) });
    this.set(this.KEYS.EXAM_HISTORY, h.slice(0, 100));
  },

  // 錯題本
  getWrongQuestions() { return this.get(this.KEYS.WRONG_QUESTIONS) || {}; },
  markWrong(year, qId) {
    const w = this.getWrongQuestions();
    const key = `${year}-${qId}`;
    w[key] = { year, qId, date: new Date().toISOString().slice(0,10), count: (w[key]?.count||0)+1 };
    this.set(this.KEYS.WRONG_QUESTIONS, w);
  },
  markCorrect(year, qId) {
    const w = this.getWrongQuestions();
    const key = `${year}-${qId}`;
    if (w[key]) { w[key].correctCount = (w[key].correctCount||0)+1; }
    this.set(this.KEYS.WRONG_QUESTIONS, w);
  },
  removeWrong(year, qId) {
    const w = this.getWrongQuestions();
    delete w[`${year}-${qId}`];
    this.set(this.KEYS.WRONG_QUESTIONS, w);
  },

  // 考試進度（中途離開）
  getProgress(year) {
    const p = this.get(this.KEYS.EXAM_PROGRESS) || {};
    return p[year] || null;
  },
  saveProgress(year, data) {
    const p = this.get(this.KEYS.EXAM_PROGRESS) || {};
    p[year] = data;
    this.set(this.KEYS.EXAM_PROGRESS, p);
  },
  clearProgress(year) {
    const p = this.get(this.KEYS.EXAM_PROGRESS) || {};
    delete p[year];
    this.set(this.KEYS.EXAM_PROGRESS, p);
  },

  // 單字學習
  getVocab() { return this.get(this.KEYS.VOCAB) || {}; },
  getWordData(word) {
    const v = this.getVocab();
    return v[word] || { status: 'new', interval: 1, nextReview: null, easeFactor: 2.5, wrongCount: 0 };
  },
  updateWord(word, data) {
    const v = this.getVocab();
    v[word] = { ...(v[word]||{}), ...data };
    this.set(this.KEYS.VOCAB, v);
  },
  getVocabHistory() { return this.get(this.KEYS.VOCAB_HISTORY) || []; },
  addVocabHistory(entry) {
    const h = this.getVocabHistory();
    const today = new Date().toISOString().slice(0,10);
    const idx = h.findIndex(e => e.date === today);
    if (idx >= 0) {
      h[idx].learned = (h[idx].learned||0) + (entry.learned||0);
      h[idx].reviewed = (h[idx].reviewed||0) + (entry.reviewed||0);
    } else {
      h.unshift({ date: today, ...entry });
    }
    this.set(this.KEYS.VOCAB_HISTORY, h.slice(0, 30));
  },

  // 統計
  getStats() {
    const history = this.getExamHistory();
    const wrong = this.getWrongQuestions();
    const vocab = this.getVocab();
    const totalAttempted = history.length;
    const avgScore = totalAttempted ? Math.round(history.reduce((s,h) => s + h.score/h.total*100, 0) / totalAttempted) : 0;
    const wrongCount = Object.keys(wrong).length;
    const learnedWords = Object.values(vocab).filter(w => w.status === 'learned').length;
    const learningWords = Object.values(vocab).filter(w => w.status === 'learning').length;
    return { totalAttempted, avgScore, wrongCount, learnedWords, learningWords };
  }
};
