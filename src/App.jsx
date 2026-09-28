import React, { useState, useEffect } from 'react';
import {
  Volume2, ArrowLeft, GraduationCap, Play, Plus, Trash2, Sun, Moon,
  ChevronRight, LogOut, User, Menu, X, Home, MessageSquare, Shield,
  Activity, Loader2, Hash, Briefcase, Bus, BookOpen, CheckCircle2, XCircle,
  Trophy, Users, Percent, Clock, RotateCcw, Megaphone, ClipboardList, Send,
  Key, Copy, Check, Smartphone, Monitor, Eye, EyeOff, Lock, UserPlus, Info
} from 'lucide-react';
import { categories as initialCategories } from './data';
import ChatAssistant from './ChatAssistant';
import { pekerjaanData } from './data/Pekerjaan';
import { transportasiData } from "./data/transportasi";
import { rumahData } from "./data/rumah";
import { jurusanVocab } from "./data/jurusan";
import { tambahanData } from "./data/tambahan";

/* ------------------------------------------------------------------ */
/*  Helper                                                             */
/* ------------------------------------------------------------------ */
const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function numberToWords(n) {
  if (n === 0) return "zero";
  if (n === 100) return "one hundred";
  let str = "";
  if (n >= 20) {
    str += tens[Math.floor(n / 10)];
    if (n % 10 > 0) str += "-" + ones[n % 10];
  } else {
    str += ones[n];
  }
  return str.trim();
}

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const uid = (p = '') => p + Date.now() + Math.random().toString(36).slice(2, 7);
const nowText = () => new Date().toLocaleTimeString() + ' - ' + new Date().toLocaleDateString();
const fmtTime = (t) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const LS = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del(key) { try { localStorage.removeItem(key); } catch {} },
};

// Token sekali pakai (acak kriptografis)
const genTokenCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(8);
  crypto.getRandomValues(a);
  return 'BN-' + [...a].map(n => chars[n % chars.length]).join('');
};

const deviceInfo = () => {
  const ua = navigator.userAgent;
  return { device: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'HP' : 'Desktop', ua };
};

/**
 * Panggil API server (Railway).
 * Mengembalikan { ok, status, data } atau null bila server/endpoint belum ada.
 * Kalau null, aplikasi memakai mode lokal (localStorage) sebagai cadangan.
 */
async function api(path, { method = 'GET', body, jwt } = {}) {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!(res.headers.get('content-type') || '').includes('application/json')) return null;
    return { ok: res.ok, status: res.status, data: await res.json() };
  } catch { return null; }
}

const stripSecret = ({ password, passwordHash, ...safe }) => safe;
const categoryIconMap = { pekerjaan: Briefcase, transportasi: Bus, rumah: Home };

const SEED_USERS = [
  // Ganti password ini. Untuk produksi, akun disimpan & di-hash di server.
  { id: 'a1', username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator' },
  { id: 'g1', username: 'guru1', password: 'guru123', role: 'guru', name: 'Bu Sari' },
  { id: 'g2', username: 'guru2', password: 'guru123', role: 'guru', name: 'Pak Budi' },
];

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */
export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  /* ---------------- SESI ---------------- */
  const [session, setSession] = useState(() => LS.get('kosakata_session', null)); // { user, jwt }
  const user = session?.user || null;
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'guru';
  const isStaff = isAdmin || isTeacher;
  const isBN = user?.role === 'siswa' && !!user.isBN;

  /* ---------------- DATA ---------------- */
  const [users, setUsers] = useState(() => {
    const saved = LS.get('kosakata_users', null);
    if (saved) return saved;
    LS.set('kosakata_users', SEED_USERS);
    return SEED_USERS;
  });
  const [tokens, setTokens] = useState(() => LS.get('kosakata_tokens', []));
  const [activityLogs, setActivityLogs] = useState(() => LS.get('kosakata_logs', []));
  const [studentReports, setStudentReports] = useState(() => LS.get('kosakata_reports', []));
  const [announcements, setAnnouncements] = useState(() => LS.get('kosakata_announcements', []));
  const [customQuizzes, setCustomQuizzes] = useState(() => LS.get('kosakata_custom_quizzes', []));

  const [categories, setCategories] = useState(() => {
    const base = { ...initialCategories, ...tambahanData };
    if (pekerjaanData) base.pekerjaan = pekerjaanData;
    if (transportasiData) base.transportasi = transportasiData;
    if (rumahData) base.rumah = rumahData;
    return base;
  });

  /* ---------------- UI ---------------- */
  const [screen, setScreen] = useState(() => {
    const s = LS.get('kosakata_session', null);
    if (!s) return 'auth';
    return s.user.role === 'siswa' ? 'home' : 'admin_dashboard';
  });
  const [activeCategoryKey, setActiveCategoryKey] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Auth form
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', username: '', password: '', token: '' });
  const [authErr, setAuthErr] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  // Kosakata
  const [newEnWord, setNewEnWord] = useState('');
  const [newIdWord, setNewIdWord] = useState('');

  // Guru: pengumuman, soal, token
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [quizTitleInput, setQuizTitleInput] = useState('');
  const [draftQuestions, setDraftQuestions] = useState([]);
  const [qText, setQText] = useState('');
  const [qOpts, setQOpts] = useState(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState(0);
  const [tokenCount, setTokenCount] = useState(1);
  const [copiedToken, setCopiedToken] = useState(null);

  // Pantau login
  const [logFilter, setLogFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Pengumuman dibaca (per siswa)
  const [annSeen, setAnnSeen] = useState(() => {
    const s = LS.get('kosakata_session', null);
    return s ? LS.get('kosakata_ann_seen_' + s.user.id, 0) : 0;
  });

  const [quizState, setQuizState] = useState({
    title: '', questions: [], allOptionsPool: [], idx: 0, score: 0,
    answered: false, selectedOption: null, currentOptions: [], results: []
  });

  /* ---------------- SINKRONISASI ---------------- */
  // Antar tab di perangkat yang sama
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.newValue) return;
      try {
        const v = JSON.parse(e.newValue);
        if (e.key === 'kosakata_logs') setActivityLogs(v);
        if (e.key === 'kosakata_reports') setStudentReports(v);
        if (e.key === 'kosakata_announcements') setAnnouncements(v);
        if (e.key === 'kosakata_custom_quizzes') setCustomQuizzes(v);
        if (e.key === 'kosakata_tokens') setTokens(v);
        if (e.key === 'kosakata_users') setUsers(v);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Antar perangkat: tarik data dari server (HP guru, HP siswa, dll)
  useEffect(() => {
    if (!session) return;
    const jwt = session.jwt;
    let offline = false; // server mati / endpoint belum ada: berhenti mengecek
    const pull = async (path, setter, key) => {
      if (offline) return;
      const r = await api(path, { jwt });
      if (r === null) { offline = true; return; }
      if (r.ok && Array.isArray(r.data)) { setter(r.data); LS.set(key, r.data); }
    };
    const run = () => {
      if (isStaff) {
        pull('/api/reports', setStudentReports, 'kosakata_reports');
        pull('/api/tokens', setTokens, 'kosakata_tokens');
        if (autoRefresh || screen !== 'staff_login') pull('/api/logs', setActivityLogs, 'kosakata_logs');
      }
      if (isStaff || isBN) {
        pull('/api/announcements', setAnnouncements, 'kosakata_announcements');
        pull('/api/quizzes', setCustomQuizzes, 'kosakata_custom_quizzes');
      }
    };
    run();
    const i = setInterval(run, 5000);
    return () => clearInterval(i);
  }, [session, isStaff, isBN, autoRefresh, screen]);

  /* ---------------- DATA YANG BOLEH DILIHAT ---------------- */
  // Server tetap harus memfilter hal yang sama; ini hanya lapisan tampilan.
  const visibleLogs = activityLogs.filter(l => isAdmin || l.teacherId === user?.id || l.userId === user?.id);
  const visibleReports = studentReports.filter(r => isAdmin || r.teacherId === user?.id);
  const visibleTokens = tokens.filter(t => isAdmin || t.teacherId === user?.id);
  // Siswa mandiri (tanpa token) tidak menerima pengumuman & soal guru
  const myAnnouncements = isBN
    ? announcements.filter(a => a.targets === 'all' || a.authorId === user.connectedTeacher)
    : [];
  const myQuizzes = isBN
    ? customQuizzes.filter(q => q.authorRole === 'admin' || q.authorId === user.connectedTeacher)
    : [];
  const staffAnnouncements = announcements.filter(a => isAdmin || a.authorId === user?.id);
  const staffQuizzes = customQuizzes.filter(q => isAdmin || q.authorId === user?.id);
  const unreadCount = myAnnouncements.filter(a => (a.ts || 0) > annSeen).length;

  /* ---------------- LOG ---------------- */
  const logActivity = (action, actor = user, kind = 'aktivitas', post = true) => {
    const { device, ua } = deviceInfo();
    const log = {
      id: uid('log_'),
      userId: actor?.id || 'guest',
      user: actor?.name || 'Tamu',
      role: actor?.role || 'tamu',
      isBN: !!actor?.isBN,
      teacherId: actor?.role === 'siswa' ? actor.connectedTeacher || null : null,
      kind, action, device, ua,
      ts: Date.now(),
      time: nowText(),
    };
    setActivityLogs(prev => {
      const updated = [log, ...prev].slice(0, 500);
      LS.set('kosakata_logs', updated);
      return updated;
    });
    if (post) api('/api/save-data', { method: 'POST', body: { type: 'log', ...log }, jwt: session?.jwt });
  };

  const saveQuizReport = (finalScore, totalQ, resultsArr, quizTitle) => {
    const item = {
      id: Date.now(),
      user: user.name,
      userId: user.id,
      teacherId: user.connectedTeacher || null,
      isBN: !!user.isBN,
      title: quizTitle,
      score: finalScore,
      total: totalQ,
      percentage: Math.round((finalScore / totalQ) * 100),
      details: resultsArr,
      time: nowText(),
      ts: Date.now(),
    };
    setStudentReports(prev => {
      const updated = [item, ...prev];
      LS.set('kosakata_reports', updated);
      return updated;
    });
    api('/api/save-data', { method: 'POST', body: { type: 'report', ...item }, jwt: session?.jwt });
    logActivity(`Menyelesaikan ${quizTitle} dengan skor ${finalScore}/${totalQ}`);
  };

  /* ---------------- AUTH ---------------- */
  const startSession = (rawUser, jwt, fromServer) => {
    const safe = stripSecret(rawUser);
    const s = { user: safe, jwt };
    LS.set('kosakata_session', s);
    setSession(s);
    setAnnSeen(LS.get('kosakata_ann_seen_' + safe.id, 0));
    setScreen(safe.role === 'siswa' ? 'home' : 'admin_dashboard');
    return safe;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthErr('');
    const username = loginForm.username.trim();
    if (!username || !loginForm.password) return setAuthErr('Isi username dan password.');
    setBusy(true);
    const r = await api('/api/login', { method: 'POST', body: { username, password: loginForm.password } });
    setBusy(false);

    let safe;
    if (r) {
      if (!r.ok) return setAuthErr(r.data?.error || 'Username atau password salah.');
      safe = startSession(r.data.user, r.data.token, true);
      logActivity('Login', safe, 'login', false); // server sudah mencatat login-nya sendiri
    } else {
      const found = users.find(u => u.username === username && u.password === loginForm.password);
      if (!found) return setAuthErr('Username atau password salah.');
      safe = startSession(found, null, false);
      const label = safe.role === 'siswa' ? (safe.isBN ? 'Login siswa BN' : 'Login siswa mandiri') : `Login ${safe.role}`;
      logActivity(label, safe, 'login');
    }
    setLoginForm({ username: '', password: '' });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setAuthErr('');
    const name = regForm.name.trim();
    const username = regForm.username.trim();
    const tokenCode = regForm.token.trim().toUpperCase();
    if (!name || !username || !regForm.password) return setAuthErr('Lengkapi nama, username, dan password.');
    if (regForm.password.length < 6) return setAuthErr('Password minimal 6 karakter.');
    setBusy(true);
    const r = await api('/api/register', { method: 'POST', body: { name, username, password: regForm.password, token: tokenCode } });
    setBusy(false);

    let safe;
    if (r) {
      if (!r.ok) return setAuthErr(r.data?.error || 'Pendaftaran gagal.');
      safe = startSession(r.data.user, r.data.token, true);
      logActivity(safe.isBN ? `Daftar dengan token, terhubung ${safe.teacherName}` : 'Daftar tanpa token (mandiri)', safe, 'login', false);
    } else {
      // Mode lokal: token hanya berlaku di perangkat ini. Aktifkan server agar benar-benar sekali pakai.
      if (users.some(u => u.username === username)) return setAuthErr('Username sudah dipakai.');
      let isBNLocal = false, connectedTeacher = null, teacherName = null;
      if (tokenCode) {
        const idx = tokens.findIndex(t => t.code === tokenCode && !t.used);
        if (idx === -1) return setAuthErr('Token tidak valid atau sudah dipakai.');
        isBNLocal = true;
        connectedTeacher = tokens[idx].teacherId;
        teacherName = tokens[idx].teacherName;
        const updated = tokens.map((t, i) => i === idx ? { ...t, used: true, usedBy: username, usedAt: Date.now() } : t);
        setTokens(updated);
        LS.set('kosakata_tokens', updated);
      }
      const newUser = { id: uid('u_'), username, password: regForm.password, name, role: 'siswa', isBN: isBNLocal, connectedTeacher, teacherName, createdAt: Date.now() };
      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      LS.set('kosakata_users', updatedUsers);
      safe = startSession(newUser, null, false);
      logActivity(isBNLocal ? `Daftar dengan token, terhubung ${teacherName}` : 'Daftar tanpa token (mandiri)', safe, 'login');
    }
    setRegForm({ name: '', username: '', password: '', token: '' });
  };

  const handleLogout = () => {
    logActivity('Keluar dari akun', user, 'logout');
    LS.del('kosakata_session');
    setSession(null);
    setScreen('auth');
    setAuthMode('login');
    setIsSidebarOpen(false);
  };

  /* ---------------- TOKEN (GURU/ADMIN) ---------------- */
  const handleGenerateTokens = async () => {
    const count = Math.min(Math.max(Number(tokenCount) || 1, 1), 50);
    const r = await api('/api/tokens', { method: 'POST', body: { count }, jwt: session.jwt });
    if (r?.ok && Array.isArray(r.data)) {
      setTokens(r.data);
      LS.set('kosakata_tokens', r.data);
    } else {
      const fresh = Array.from({ length: count }, () => ({
        code: genTokenCode(), teacherId: user.id, teacherName: user.name,
        used: false, usedBy: null, createdAt: Date.now(),
      }));
      const updated = [...fresh, ...tokens];
      setTokens(updated);
      LS.set('kosakata_tokens', updated);
    }
    logActivity(`Membuat ${count} token siswa BN`);
  };

  const copyToken = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedToken(code);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  /* ---------------- BELAJAR ---------------- */
  const speakWord = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.split('/')[0].trim());
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const generateOptionsForQuestion = (q, pool) => {
    if (q.options) return shuffle(q.options);
    const wrong = shuffle(pool.filter(a => a !== q.answer)).slice(0, 3);
    return shuffle([...wrong, q.answer]);
  };

  const getActiveWordsAndDetails = () => {
    if (activeCategoryKey?.startsWith('jurusan_')) {
      const sub = jurusanVocab?.categories?.[activeCategoryKey.replace('jurusan_', '')];
      return { name: sub?.name || 'Kosakata Jurusan', emoji: sub?.emoji || '🎓', words: sub?.words || [], Icon: null };
    }
    const cat = categories[activeCategoryKey];
    return { name: cat?.name || '', emoji: cat?.emoji || '📁', words: cat?.words || [], Icon: categoryIconMap[activeCategoryKey] || null };
  };

  const beginQuiz = (title, questions, pool) => {
    setQuizState({
      title, questions, allOptionsPool: pool, idx: 0, score: 0, answered: false,
      selectedOption: null, currentOptions: generateOptionsForQuestion(questions[0], pool), results: []
    });
    setScreen('quiz');
  };

  const startCategoryQuiz = (catKey) => {
    let wordsList, titleName;
    if (catKey.startsWith('jurusan_')) {
      const sub = jurusanVocab?.categories?.[catKey.replace('jurusan_', '')];
      wordsList = sub?.words || [];
      titleName = sub?.name || 'Jurusan';
    } else {
      wordsList = categories[catKey]?.words || [];
      titleName = categories[catKey]?.name || 'Kategori';
    }
    if (wordsList.length < 2) return alert('Kosakata belum cukup untuk membuat kuis (minimal 2 kata).');
    const questions = shuffle(wordsList.map(w => ({ question: w[0], answer: w[1] }))).slice(0, 10);
    beginQuiz(`Tes Kategori ${titleName}`, questions, wordsList.map(w => w[1]));
    logActivity(`Memulai kuis kategori: ${titleName}`);
  };

  const startNumberQuiz = () => {
    const questions = [];
    while (questions.length < 10) {
      const n = Math.floor(Math.random() * 100) + 1;
      if (!questions.some(q => q.question === String(n))) questions.push({ question: String(n), answer: numberToWords(n) });
    }
    beginQuiz('Tes Angka 1-100', questions, Array.from({ length: 100 }, (_, i) => numberToWords(i + 1)));
    logActivity('Memulai kuis Angka 1-100');
  };

  const startCustomQuiz = (quiz) => {
    const questions = shuffle(quiz.questions).map(q => ({ question: q.question, answer: q.answer, options: q.options }));
    beginQuiz(`Soal Guru: ${quiz.title}`, questions, []);
    logActivity(`Memulai soal dari guru: ${quiz.title}`);
  };

  const handleAnswer = (option) => {
    if (quizState.answered) return;
    const q = quizState.questions[quizState.idx];
    const isCorrect = option === q.answer;
    const results = [...quizState.results, { question: q.question, chosen: option, correct: q.answer, isCorrect }];
    const newScore = isCorrect ? quizState.score + 1 : quizState.score;
    setQuizState(prev => ({ ...prev, answered: true, selectedOption: option, score: newScore, results }));
    if (quizState.idx + 1 >= quizState.questions.length) saveQuizReport(newScore, quizState.questions.length, results, quizState.title);
  };

  const nextQuestion = () => {
    const nextIdx = quizState.idx + 1;
    if (nextIdx < quizState.questions.length) {
      setQuizState(prev => ({
        ...prev, idx: nextIdx, answered: false, selectedOption: null,
        currentOptions: generateOptionsForQuestion(prev.questions[nextIdx], prev.allOptionsPool)
      }));
    } else {
      setQuizState(prev => ({ ...prev, idx: nextIdx }));
    }
  };

  const handleAddWord = (e) => {
    e.preventDefault();
    if (!newEnWord.trim() || !newIdWord.trim() || !activeCategoryKey) return;
    const pair = [newEnWord.trim().toLowerCase(), newIdWord.trim().toLowerCase()];
    if (activeCategoryKey.startsWith('jurusan_')) {
      const sub = jurusanVocab?.categories?.[activeCategoryKey.replace('jurusan_', '')];
      if (sub) sub.words.push(pair);
      setCategories(prev => ({ ...prev }));
    } else {
      setCategories(prev => ({ ...prev, [activeCategoryKey]: { ...prev[activeCategoryKey], words: [...prev[activeCategoryKey].words, pair] } }));
    }
    logActivity(`Menambahkan kosakata baru: '${newEnWord}'`);
    setNewEnWord('');
    setNewIdWord('');
  };

  const handleDeleteWord = (i) => {
    if (!activeCategoryKey) return;
    if (activeCategoryKey.startsWith('jurusan_')) {
      const sub = jurusanVocab?.categories?.[activeCategoryKey.replace('jurusan_', '')];
      if (sub) sub.words = sub.words.filter((_, idx) => idx !== i);
      setCategories(prev => ({ ...prev }));
    } else {
      setCategories(prev => ({ ...prev, [activeCategoryKey]: { ...prev[activeCategoryKey], words: prev[activeCategoryKey].words.filter((_, idx) => idx !== i) } }));
    }
    logActivity('Menghapus kosakata');
  };

  /* ---------------- PENGUMUMAN (GURU/ADMIN) ---------------- */
  const handlePostAnnouncement = (e) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    const item = {
      id: Date.now(), title: annTitle.trim(), body: annBody.trim(),
      author: user.name, authorId: user.id, authorRole: user.role,
      targets: isAdmin ? 'all' : 'siswa-bn', // hanya siswa BN yang bisa menerima
      time: nowText(), ts: Date.now(),
    };
    setAnnouncements(prev => {
      const updated = [item, ...prev];
      LS.set('kosakata_announcements', updated);
      return updated;
    });
    api('/api/save-data', { method: 'POST', body: { type: 'announcement', ...item }, jwt: session.jwt });
    logActivity(`Membuat pengumuman: ${item.title}`);
    setAnnTitle('');
    setAnnBody('');
  };

  const handleDeleteAnnouncement = (id) => {
    setAnnouncements(prev => {
      const updated = prev.filter(a => a.id !== id);
      LS.set('kosakata_announcements', updated);
      return updated;
    });
    api('/api/announcements/' + id, { method: 'DELETE', jwt: session.jwt });
    logActivity('Menghapus pengumuman');
  };

  const openAnnouncements = () => {
    const now = Date.now();
    setAnnSeen(now);
    LS.set('kosakata_ann_seen_' + user.id, now);
    setScreen('announcements');
    setIsSidebarOpen(false);
  };

  /* ---------------- BUAT SOAL (GURU/ADMIN) ---------------- */
  const handleAddDraftQuestion = (e) => {
    e.preventDefault();
    const opts = qOpts.map(o => o.trim());
    if (!qText.trim()) return alert('Tulis pertanyaannya dulu.');
    if (opts.filter(Boolean).length < 2) return alert('Isi minimal 2 pilihan jawaban.');
    if (!opts[qCorrect]) return alert('Pilih jawaban benar dari pilihan yang sudah terisi.');
    setDraftQuestions(prev => [...prev, { question: qText.trim(), options: opts.filter(Boolean), answer: opts[qCorrect] }]);
    setQText('');
    setQOpts(['', '', '', '']);
    setQCorrect(0);
  };

  const handleSaveQuiz = () => {
    if (!quizTitleInput.trim()) return alert('Beri judul untuk kumpulan soal ini.');
    if (draftQuestions.length === 0) return alert('Tambahkan minimal 1 soal.');
    const item = {
      id: Date.now(), title: quizTitleInput.trim(),
      author: user.name, authorId: user.id, authorRole: user.role,
      time: nowText(), ts: Date.now(), questions: draftQuestions
    };
    setCustomQuizzes(prev => {
      const updated = [item, ...prev];
      LS.set('kosakata_custom_quizzes', updated);
      return updated;
    });
    api('/api/save-data', { method: 'POST', body: { type: 'quiz', ...item }, jwt: session.jwt });
    logActivity(`Membuat soal: ${item.title} (${item.questions.length} soal)`);
    setQuizTitleInput('');
    setDraftQuestions([]);
  };

  const handleDeleteQuiz = (id) => {
    setCustomQuizzes(prev => {
      const updated = prev.filter(q => q.id !== id);
      LS.set('kosakata_custom_quizzes', updated);
      return updated;
    });
    api('/api/quizzes/' + id, { method: 'DELETE', jwt: session.jwt });
    logActivity('Menghapus kumpulan soal');
  };

  const handleResetData = () => {
    if (!confirm('Hapus semua log dan laporan di perangkat ini?')) return;
    LS.del('kosakata_logs');
    LS.del('kosakata_reports');
    setActivityLogs([]);
    setStudentReports([]);
  };

  /* ---------------- TEMA ---------------- */
  const theme = isDarkMode ? {
    bg: 'bg-[#15181a] text-[#d9dfdb]',
    headerBg: 'bg-[#15181a]/85 border-[#2a3033]',
    card: 'bg-[#1d2123] border-[#2a3033] hover:border-[#4a5a53]',
    cardStatic: 'bg-[#1d2123] border-[#2a3033]',
    soft: 'bg-[#15181a]',
    subText: 'text-[#8a9691]',
    titleText: 'text-[#eef2ef]',
    accentText: 'text-[#9fc2b2]',
    inputBg: 'bg-[#15181a] border-[#2a3033] text-[#eef2ef] placeholder:text-[#5f6b66] focus:border-[#6f8f82]',
    btnSecondary: 'bg-[#1d2123] hover:bg-[#252a2d] text-[#cfd6d2] border-[#2a3033]',
    btnPrimary: 'bg-[#8fb3a3] hover:bg-[#a0c2b3] text-[#14201b]',
    sidebarBg: 'bg-[#1a1e20] border-[#2a3033]',
    divider: 'divide-[#2a3033]',
    line: 'border-[#2a3033]',
    hoverRow: 'hover:bg-[#23282a]',
    navActive: 'bg-[#26312d] text-[#b5d1c5]',
    navIdle: 'text-[#8a9691] hover:bg-[#23282a] hover:text-[#eef2ef]',
    chip: 'bg-[#26312d] text-[#b5d1c5]',
    good: 'text-[#9fc2b2]',
    bad: 'text-[#d9a49d]',
    badBox: 'bg-[#3a2726] text-[#d9a49d] border-[#54332f]',
    track: 'bg-[#2a3033]',
    bar: 'bg-[#8fb3a3]',
    warnBox: 'bg-[#3a2e1a] text-[#e6c98a] border-[#5a4423]',
  } : {
    bg: 'bg-[#eef1ef] text-[#2b3330]',
    headerBg: 'bg-[#eef1ef]/85 border-[#dde2de]',
    card: 'bg-[#f9faf9] border-[#dde2de] hover:border-[#9fb3a9] shadow-[0_1px_2px_rgba(40,60,50,0.05)]',
    cardStatic: 'bg-[#f9faf9] border-[#dde2de] shadow-[0_1px_2px_rgba(40,60,50,0.05)]',
    soft: 'bg-[#f0f3f1]',
    subText: 'text-[#6c7772]',
    titleText: 'text-[#1f2724]',
    accentText: 'text-[#3f6255]',
    inputBg: 'bg-[#f0f3f1] border-[#dde2de] text-[#1f2724] placeholder:text-[#9aa5a0] focus:border-[#6f8f82]',
    btnSecondary: 'bg-[#f9faf9] hover:bg-[#eef1ef] text-[#3a4540] border-[#dde2de]',
    btnPrimary: 'bg-[#4a6b5f] hover:bg-[#3f5e53] text-[#f6f9f7]',
    sidebarBg: 'bg-[#f9faf9] border-[#dde2de]',
    divider: 'divide-[#e3e8e4]',
    line: 'border-[#e3e8e4]',
    hoverRow: 'hover:bg-[#f0f3f1]',
    navActive: 'bg-[#e1e9e4] text-[#2f4a41]',
    navIdle: 'text-[#6c7772] hover:bg-[#eef1ef] hover:text-[#1f2724]',
    chip: 'bg-[#e6ece8] text-[#3f5e53]',
    good: 'text-[#3f6255]',
    bad: 'text-[#9a5a52]',
    badBox: 'bg-[#f3e4e1] text-[#8a4b43] border-[#e6cfca]',
    track: 'bg-[#dde2de]',
    bar: 'bg-[#4a6b5f]',
    warnBox: 'bg-[#fdf3dc] text-[#8a6a1f] border-[#e6d4a0]',
  };

  const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f8f82]/50';
  const fieldCls = `w-full px-4 py-3 border rounded-xl text-sm ${focusRing} ${theme.inputBg}`;

  const IconTile = ({ Icon, emoji, size = 'md' }) => {
    const box = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
    const ico = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    return (
      <div className={`${box} rounded-full flex items-center justify-center shrink-0 ${theme.chip}`}>
        {Icon ? <Icon className={ico} strokeWidth={1.5} /> : <span className={size === 'lg' ? 'text-2xl' : 'text-lg'}>{emoji}</span>}
      </div>
    );
  };

  const Logo = ({ size = 'md' }) => (
    <div className={`${size === 'lg' ? 'w-14 h-14' : 'w-10 h-10'} rounded-full flex items-center justify-center shrink-0 ${theme.btnPrimary}`}>
      <BookOpen className={size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'} strokeWidth={1.5} />
    </div>
  );

  const EmptyText = ({ children }) => (
    <div className="p-8 text-center"><p className={`text-sm ${theme.subText}`}>{children}</p></div>
  );

  const avgScore = visibleReports.length
    ? Math.round(visibleReports.reduce((a, r) => a + r.percentage, 0) / visibleReports.length)
    : 0;
  const uniqueStudents = new Set(visibleReports.map(r => r.userId || r.user)).size;

  const pageTitleMap = {
    admin_dashboard: isAdmin ? 'Dashboard Administrator' : 'Dashboard Guru',
    staff_login: 'Pantau Login',
    staff_token: 'Token Siswa BN',
    staff_soal: 'Buat Soal',
    staff_pengumuman: 'Pengumuman',
    announcements: 'Pengumuman',
    home: 'Beranda',
    jurusan_menu: 'Pilih Jurusan SMK',
    category_detail: 'Daftar Kosakata',
    numbers: 'Modul Angka',
    quiz: 'Kuis',
  };

  /* ================================================================ */
  /*  LOGIN / DAFTAR (wajib sebelum masuk aplikasi)                     */
  /* ================================================================ */
  if (!session) {
    return (
      <div className={`min-h-screen transition-colors duration-300 ${theme.bg} font-sans flex items-center justify-center p-4 relative`}>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className={`absolute top-5 right-5 p-2.5 rounded-full border ${theme.btnSecondary} ${focusRing}`} aria-label="Ganti tema">
          {isDarkMode ? <Sun className="w-4 h-4" strokeWidth={1.5} /> : <Moon className="w-4 h-4" strokeWidth={1.5} />}
        </button>

        <div className={`max-w-md w-full ${theme.cardStatic} border p-8 sm:p-10 rounded-3xl space-y-6`}>
          <div className="flex flex-col items-center text-center gap-4">
            <Logo size="lg" />
            <div>
              <h1 className={`text-2xl font-semibold tracking-tight ${theme.titleText}`}>Kosakata Yuk</h1>
              <p className={`text-sm ${theme.subText} mt-1.5`}>
                {authMode === 'login' ? 'Masuk dengan akunmu untuk mulai belajar' : 'Buat akun baru untuk mulai belajar'}
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl ${theme.soft} border ${theme.line}`}>
            {[['login', 'Masuk'], ['register', 'Daftar']].map(([m, label]) => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthErr(''); }} className={`py-2 rounded-lg text-sm font-medium transition ${focusRing} ${authMode === m ? theme.navActive : theme.navIdle}`}>
                {label}
              </button>
            ))}
          </div>

          {authErr && (
            <div className={`p-3 rounded-xl border text-xs font-medium ${theme.badBox}`} role="alert">{authErr}</div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium ${theme.subText} mb-2`}>Username</label>
                <div className="relative">
                  <span className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${theme.subText}`}><User className="w-4 h-4" strokeWidth={1.5} /></span>
                  <input type="text" autoComplete="username" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className={`${fieldCls} pl-11`} placeholder="Username" />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-medium ${theme.subText} mb-2`}>Password</label>
                <div className="relative">
                  <span className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${theme.subText}`}><Lock className="w-4 h-4" strokeWidth={1.5} /></span>
                  <input type={showPass ? 'text' : 'password'} autoComplete="current-password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className={`${fieldCls} pl-11 pr-11`} placeholder="Password" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className={`absolute inset-y-0 right-0 pr-4 flex items-center ${theme.subText}`} aria-label="Tampilkan password">
                    {showPass ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={busy} className={`w-full py-3 ${theme.btnPrimary} font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 ${focusRing}`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Masuk <ChevronRight className="w-4 h-4" strokeWidth={1.75} /></>}
              </button>
              <p className={`text-xs text-center ${theme.subText}`}>Guru dan admin juga masuk lewat sini dengan akun masing-masing.</p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium ${theme.subText} mb-2`}>Nama lengkap</label>
                <input type="text" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} className={fieldCls} placeholder="Contoh: Budi Santoso" />
              </div>
              <div>
                <label className={`block text-xs font-medium ${theme.subText} mb-2`}>Username</label>
                <input type="text" autoComplete="username" value={regForm.username} onChange={(e) => setRegForm({ ...regForm, username: e.target.value })} className={fieldCls} placeholder="Tanpa spasi" />
              </div>
              <div>
                <label className={`block text-xs font-medium ${theme.subText} mb-2`}>Password (minimal 6 karakter)</label>
                <input type={showPass ? 'text' : 'password'} autoComplete="new-password" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} className={fieldCls} placeholder="Password" />
              </div>
              <div>
                <label className={`block text-xs font-medium ${theme.subText} mb-2`}>Token dari guru (opsional)</label>
                <div className="relative">
                  <span className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${theme.subText}`}><Key className="w-4 h-4" strokeWidth={1.5} /></span>
                  <input type="text" value={regForm.token} onChange={(e) => setRegForm({ ...regForm, token: e.target.value })} className={`${fieldCls} pl-11 uppercase`} placeholder="BN-XXXXXXXX" />
                </div>
              </div>
              <div className={`p-3 rounded-xl border text-xs flex gap-2.5 ${theme.warnBox}`}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                <p>Siswa SMK BN wajib memakai token sekali pakai dari guru agar terhubung dengan guru dan menerima pengumuman serta soal. Tanpa token, kamu tetap bisa belajar, tetapi tidak terhubung dengan guru.</p>
              </div>
              <button type="submit" disabled={busy} className={`w-full py-3 ${theme.btnPrimary} font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 ${focusRing}`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-4 h-4" strokeWidth={1.75} /> Buat akun</>}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  APLIKASI UTAMA                                                   */
  /* ================================================================ */
  const navBtn = (active) =>
    `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${focusRing} ${active ? theme.navActive : theme.navIdle}`;
  const goto = (s) => { setScreen(s); setIsSidebarOpen(false); };

  const filteredLogs = visibleLogs.filter(l => logFilter === 'all' || l.kind === logFilter);
  const loginCountToday = visibleLogs.filter(l => l.kind === 'login' && new Date(l.ts).toDateString() === new Date().toDateString()).length;

  const DeviceTag = ({ device }) => (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${theme.chip}`}>
      {device === 'HP' ? <Smartphone className="w-3 h-3" strokeWidth={1.5} /> : <Monitor className="w-3 h-3" strokeWidth={1.5} />} {device}
    </span>
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme.bg} font-sans pb-12 flex relative overflow-x-hidden`}>
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm md:hidden" />}

      {/* ---------- Sidebar ---------- */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r ${theme.sidebarBg} transition-transform duration-300 flex flex-col justify-between ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className={`p-5 border-b ${theme.line} shrink-0`}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => goto(isStaff ? 'admin_dashboard' : 'home')}>
              <Logo />
              <h1 className={`text-lg font-semibold tracking-tight ${theme.titleText}`}>Kosakata Yuk</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className={`p-1.5 md:hidden ${theme.subText}`} aria-label="Tutup menu"><X className="w-5 h-5" strokeWidth={1.5} /></button>
          </div>

          <div className={`p-3 rounded-2xl border ${theme.line} ${theme.soft} flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${theme.chip}`}>
              {isAdmin ? <Shield className="w-4 h-4" strokeWidth={1.5} /> : isTeacher ? <GraduationCap className="w-4 h-4" strokeWidth={1.5} /> : user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <span className={`text-xs ${theme.subText} block`}>{isAdmin ? 'Administrator' : isTeacher ? 'Guru' : isBN ? `Siswa BN · ${user.teacherName}` : 'Siswa mandiri'}</span>
              <span className={`text-sm font-semibold ${theme.titleText} truncate block`}>{user.name}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-1">
            <span className={`px-3 text-xs font-medium ${theme.subText} block mb-2`}>Menu utama</span>
            {isStaff ? (
              <>
                <button onClick={() => goto('admin_dashboard')} className={navBtn(screen === 'admin_dashboard')}><Activity className="w-4 h-4" strokeWidth={1.5} /> Pantau nilai</button>
                <button onClick={() => goto('staff_login')} className={navBtn(screen === 'staff_login')}><Smartphone className="w-4 h-4" strokeWidth={1.5} /> Pantau login</button>
                <button onClick={() => goto('staff_token')} className={navBtn(screen === 'staff_token')}><Key className="w-4 h-4" strokeWidth={1.5} /> Token siswa BN</button>
                <button onClick={() => goto('staff_soal')} className={navBtn(screen === 'staff_soal')}><ClipboardList className="w-4 h-4" strokeWidth={1.5} /> Buat soal</button>
                <button onClick={() => goto('staff_pengumuman')} className={navBtn(screen === 'staff_pengumuman')}><Megaphone className="w-4 h-4" strokeWidth={1.5} /> Pengumuman</button>
              </>
            ) : (
              <>
                <button onClick={() => goto('home')} className={navBtn(screen === 'home')}><Home className="w-4 h-4" strokeWidth={1.5} /> Beranda</button>
                {isBN && (
                  <button onClick={openAnnouncements} className={`${navBtn(screen === 'announcements')} justify-between`}>
                    <span className="flex items-center gap-3"><Megaphone className="w-4 h-4" strokeWidth={1.5} /> Pengumuman</span>
                    {unreadCount > 0 && <span className={`text-xs px-2 py-0.5 rounded-full ${theme.btnPrimary}`}>{unreadCount}</span>}
                  </button>
                )}
                <button onClick={() => { setIsChatOpen(true); setIsSidebarOpen(false); }} className={navBtn(false)}><MessageSquare className="w-4 h-4" strokeWidth={1.5} /> Asisten AI</button>
              </>
            )}
          </div>

          {!isStaff && (
            <div className="space-y-1">
              <span className={`px-3 text-xs font-medium ${theme.subText} block mb-2`}>Modul belajar</span>
              <button onClick={() => { setActiveCategoryKey(null); goto('numbers'); }} className={navBtn(screen === 'numbers')}><Hash className="w-4 h-4" strokeWidth={1.5} /> Angka 1-100</button>
              <button onClick={() => goto('jurusan_menu')} className={navBtn(screen === 'jurusan_menu')}><GraduationCap className="w-4 h-4" strokeWidth={1.5} /> Kosakata jurusan SMK</button>
            </div>
          )}

          <div className="space-y-1">
            <span className={`px-3 text-xs font-medium ${theme.subText} block mb-2`}>Tampilan</span>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`${navBtn(false)} justify-between`}>
              <div className="flex items-center gap-3">
                {isDarkMode ? <Sun className="w-4 h-4" strokeWidth={1.5} /> : <Moon className="w-4 h-4" strokeWidth={1.5} />}
                <span>Mode gelap</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-md ${theme.chip}`}>{isDarkMode ? 'Aktif' : 'Mati'}</span>
            </button>
          </div>
        </div>

        <div className={`p-4 border-t ${theme.line} shrink-0`}>
          <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition ${theme.btnSecondary} ${focusRing}`}>
            <LogOut className="w-4 h-4" strokeWidth={1.5} /> Keluar
          </button>
        </div>
      </aside>

      {/* ---------- Konten ---------- */}
      <div className="flex-1 md:pl-72 flex flex-col min-h-screen">
        <header className={`sticky top-0 z-30 backdrop-blur-md border-b ${theme.headerBg} transition-colors px-4 sm:px-8 py-3.5 mb-8 flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className={`p-2.5 rounded-full border md:hidden ${theme.btnSecondary}`} aria-label="Buka menu"><Menu className="w-4 h-4" strokeWidth={1.5} /></button>
            <span className={`text-sm font-semibold ${theme.titleText}`}>{pageTitleMap[screen]}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isStaff && (
              <button onClick={() => setIsChatOpen(true)} className={`flex items-center gap-2 text-xs font-medium px-3.5 py-2.5 rounded-full transition ${theme.btnPrimary} ${focusRing}`}>
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} /> Asisten AI
              </button>
            )}
            {screen !== 'home' && !isStaff && (
              <button onClick={() => setScreen('home')} className={`flex items-center gap-2 text-xs font-medium px-3.5 py-2.5 rounded-full border transition ${theme.btnSecondary} ${focusRing}`}>
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} /> Beranda
              </button>
            )}
          </div>
        </header>

        <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 flex-1">

          {/* ===== STAFF: PANTAU NILAI ===== */}
          {isStaff && screen === 'admin_dashboard' && (
            <div className="space-y-6">
              <div className={`${theme.cardStatic} p-6 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                <div className="flex items-start gap-4">
                  <IconTile Icon={isTeacher ? GraduationCap : Shield} size="lg" />
                  <div>
                    <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>Pantau nilai siswa</h2>
                    <p className={`text-sm ${theme.subText} mt-1 max-w-lg`}>
                      {isAdmin ? 'Semua siswa, BN maupun mandiri.' : 'Siswa BN yang terhubung denganmu lewat token.'}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={handleResetData} className={`px-4 py-2.5 border rounded-full text-xs font-medium flex items-center gap-2 transition shrink-0 ${theme.btnSecondary} ${focusRing}`}>
                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Reset data lokal
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { Icon: Users, label: 'Siswa aktif', value: uniqueStudents },
                  { Icon: ClipboardList, label: 'Kuis selesai', value: visibleReports.length },
                  { Icon: Percent, label: 'Rata-rata nilai', value: `${avgScore}%` },
                ].map(({ Icon, label, value }) => (
                  <div key={label} className={`${theme.cardStatic} border rounded-2xl p-5 flex items-center gap-4`}>
                    <IconTile Icon={Icon} />
                    <div>
                      <p className={`text-xs ${theme.subText}`}>{label}</p>
                      <p className={`text-2xl font-semibold tracking-tight ${theme.titleText}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`${theme.cardStatic} border rounded-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${theme.line} flex justify-between items-center`}>
                  <h3 className={`font-semibold text-sm ${theme.titleText} flex items-center gap-2.5`}><Trophy className="w-4 h-4" strokeWidth={1.5} /> Hasil tes dan kuis</h3>
                  <span className={`text-xs ${theme.subText}`}>{visibleReports.length} laporan</span>
                </div>
                <div className={`divide-y ${theme.divider} max-h-[560px] overflow-y-auto`}>
                  {visibleReports.length === 0 ? <EmptyText>Belum ada siswa yang menyelesaikan kuis.</EmptyText> : visibleReports.map((report) => (
                    <div key={report.id} className={`p-4 space-y-3 transition ${theme.hoverRow}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${theme.btnPrimary}`}>{report.user?.charAt(0).toUpperCase()}</div>
                          <div>
                            <h4 className={`text-sm font-semibold ${theme.titleText}`}>{report.user} · {report.title}</h4>
                            <span className={`text-xs ${theme.subText} flex items-center gap-1`}><Clock className="w-3 h-3" strokeWidth={1.5} /> {report.time}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${theme.chip}`}>{report.score}/{report.total}</span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${theme.btnPrimary}`}>{report.percentage}%</span>
                        </div>
                      </div>
                      <div className={`pl-3 border-l-2 ${theme.line} pt-1`}>
                        <span className={`text-xs font-medium ${theme.subText} block mb-2`}>Analisis per soal</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {report.details.map((item, idx) => (
                            <div key={idx} className={`p-2.5 rounded-xl text-xs border flex items-center justify-between gap-2 ${theme.line} ${theme.soft}`}>
                              <span className={`font-medium capitalize ${theme.titleText}`}>{item.question}</span>
                              <div className="text-right">
                                <span className={`flex items-center justify-end gap-1 font-medium ${item.isCorrect ? theme.good : theme.bad}`}>
                                  {item.isCorrect ? <><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Benar</> : <><XCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> Salah ({item.chosen})</>}
                                </span>
                                {!item.isCorrect && <span className={`text-[11px] ${theme.subText}`}>Kunci: {item.correct}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== STAFF: PANTAU LOGIN ===== */}
          {isStaff && screen === 'staff_login' && (
            <div className="space-y-6">
              <div className={`${theme.cardStatic} p-6 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                <div className="flex items-start gap-4">
                  <IconTile Icon={Smartphone} size="lg" />
                  <div>
                    <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>Pantau login</h2>
                    <p className={`text-sm ${theme.subText} mt-1 max-w-lg`}>Lihat siapa yang masuk, dari HP atau komputer, dan apa yang mereka kerjakan. Data ikut terbarui dari perangkat mana pun.</p>
                  </div>
                </div>
                <button onClick={() => setAutoRefresh(!autoRefresh)} className={`px-4 py-2.5 border rounded-full text-xs font-medium flex items-center gap-2 shrink-0 ${theme.btnSecondary} ${focusRing}`}>
                  <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-[#4a9b78]' : 'bg-[#9aa5a0]'}`} /> {autoRefresh ? 'Otomatis' : 'Dijeda'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { Icon: User, label: 'Login hari ini', value: loginCountToday },
                  { Icon: Smartphone, label: 'Dari HP', value: visibleLogs.filter(l => l.kind === 'login' && l.device === 'HP').length },
                  { Icon: Monitor, label: 'Dari komputer', value: visibleLogs.filter(l => l.kind === 'login' && l.device === 'Desktop').length },
                ].map(({ Icon, label, value }) => (
                  <div key={label} className={`${theme.cardStatic} border rounded-2xl p-5 flex items-center gap-4`}>
                    <IconTile Icon={Icon} />
                    <div>
                      <p className={`text-xs ${theme.subText}`}>{label}</p>
                      <p className={`text-2xl font-semibold tracking-tight ${theme.titleText}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`${theme.cardStatic} border rounded-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${theme.line} flex flex-wrap items-center justify-between gap-3`}>
                  <div className="flex gap-1.5">
                    {[['all', 'Semua'], ['login', 'Login'], ['logout', 'Keluar'], ['aktivitas', 'Aktivitas']].map(([k, label]) => (
                      <button key={k} onClick={() => setLogFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${focusRing} ${logFilter === k ? theme.btnPrimary + ' border-transparent' : theme.btnSecondary}`}>{label}</button>
                    ))}
                  </div>
                  <span className={`text-xs ${theme.subText}`}>{filteredLogs.length} catatan</span>
                </div>
                <div className={`divide-y ${theme.divider} max-h-[560px] overflow-y-auto`}>
                  {filteredLogs.length === 0 ? <EmptyText>Belum ada catatan untuk filter ini.</EmptyText> : filteredLogs.map((log) => (
                    <div key={log.id} className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm ${theme.hoverRow}`}>
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md font-medium text-xs shrink-0 ${theme.chip}`}>{log.user}</span>
                        {log.role === 'siswa' && <span className={`text-[11px] ${theme.subText}`}>{log.isBN ? 'BN' : 'Mandiri'}</span>}
                        <span className={`${theme.titleText} truncate`}>{log.action}</span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <DeviceTag device={log.device} />
                        <span className={`text-xs ${theme.subText}`}>{log.ts ? fmtTime(log.ts) : log.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== STAFF: TOKEN ===== */}
          {isStaff && screen === 'staff_token' && (
            <div className="space-y-6">
              <div className={`${theme.cardStatic} p-6 border rounded-2xl flex items-start gap-4`}>
                <IconTile Icon={Key} size="lg" />
                <div>
                  <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>Token siswa BN</h2>
                  <p className={`text-sm ${theme.subText} mt-1`}>Berikan satu token ke tiap siswa SMK BN. Token hanya bisa dipakai sekali saat mendaftar, dan setelah itu siswa terhubung denganmu.</p>
                </div>
              </div>

              <div className={`${theme.cardStatic} border rounded-2xl p-5 flex flex-wrap items-end gap-3`}>
                <div>
                  <label className={`block text-xs font-medium ${theme.subText} mb-2`}>Jumlah token (1-50)</label>
                  <input type="number" min={1} max={50} value={tokenCount} onChange={(e) => setTokenCount(e.target.value)} className={`${fieldCls} w-32`} />
                </div>
                <button onClick={handleGenerateTokens} className={`px-6 py-3 ${theme.btnPrimary} font-medium rounded-full text-sm flex items-center gap-2 transition ${focusRing}`}>
                  <Plus className="w-4 h-4" strokeWidth={1.75} /> Buat token
                </button>
              </div>

              <div className={`${theme.cardStatic} border rounded-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${theme.line} flex justify-between items-center`}>
                  <h3 className={`font-semibold text-sm ${theme.titleText}`}>Daftar token</h3>
                  <span className={`text-xs ${theme.subText}`}>{visibleTokens.filter(t => !t.used).length} belum dipakai · {visibleTokens.filter(t => t.used).length} terpakai</span>
                </div>
                <div className={`divide-y ${theme.divider} max-h-[560px] overflow-y-auto`}>
                  {visibleTokens.length === 0 ? <EmptyText>Belum ada token. Buat token lewat formulir di atas.</EmptyText> : visibleTokens.map((t) => (
                    <div key={t.code} className={`p-3.5 flex items-center justify-between gap-3 ${theme.hoverRow}`}>
                      <div className="min-w-0">
                        <p className={`font-mono text-sm font-semibold ${t.used ? theme.subText + ' line-through' : theme.titleText}`}>{t.code}</p>
                        <p className={`text-xs ${theme.subText} mt-0.5`}>
                          {t.used ? `Dipakai oleh ${t.usedBy}` : 'Belum dipakai'}{isAdmin ? ` · ${t.teacherName}` : ''}
                        </p>
                      </div>
                      {!t.used && (
                        <button onClick={() => copyToken(t.code)} className={`px-3 py-1.5 border rounded-full text-xs font-medium flex items-center gap-1.5 shrink-0 ${theme.btnSecondary} ${focusRing}`}>
                          {copiedToken === t.code ? <><Check className="w-3.5 h-3.5" strokeWidth={1.75} /> Tersalin</> : <><Copy className="w-3.5 h-3.5" strokeWidth={1.75} /> Salin</>}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== STAFF: BUAT SOAL ===== */}
          {isStaff && screen === 'staff_soal' && (
            <div className="space-y-6">
              <div className={`${theme.cardStatic} p-6 border rounded-2xl flex items-start gap-4`}>
                <IconTile Icon={ClipboardList} size="lg" />
                <div>
                  <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>Buat soal untuk siswa BN</h2>
                  <p className={`text-sm ${theme.subText} mt-1`}>Soal hanya muncul di beranda siswa BN yang terhubung denganmu. Nilainya masuk ke panel pantau.</p>
                </div>
              </div>

              <div className={`${theme.cardStatic} border rounded-2xl p-5 space-y-5`}>
                <div>
                  <label className={`block text-xs font-medium ${theme.subText} mb-2`}>Judul kumpulan soal</label>
                  <input type="text" placeholder="Contoh: Ulangan Harian Bab 1" value={quizTitleInput} onChange={(e) => setQuizTitleInput(e.target.value)} className={fieldCls} />
                </div>

                <form onSubmit={handleAddDraftQuestion} className={`p-4 rounded-2xl border ${theme.line} ${theme.soft} space-y-3`}>
                  <label className={`block text-xs font-medium ${theme.subText}`}>Pertanyaan</label>
                  <textarea rows={2} placeholder="Contoh: Apa bahasa Inggris dari 'kucing'?" value={qText} onChange={(e) => setQText(e.target.value)} className={`${fieldCls} resize-none`} />
                  <label className={`block text-xs font-medium ${theme.subText} pt-1`}>Pilihan jawaban (pilih bulatan untuk jawaban benar)</label>
                  <div className="space-y-2">
                    {qOpts.map((opt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <input type="radio" name="correct" checked={qCorrect === i} onChange={() => setQCorrect(i)} className="w-4 h-4 accent-[#4a6b5f] shrink-0" aria-label={`Jawaban benar ${i + 1}`} />
                        <input type="text" placeholder={`Pilihan ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => setQOpts(prev => prev.map((o, idx) => idx === i ? e.target.value : o))} className={fieldCls} />
                      </div>
                    ))}
                  </div>
                  <button type="submit" className={`px-4 py-2.5 border rounded-full text-xs font-medium flex items-center gap-2 transition ${theme.btnSecondary} ${focusRing}`}>
                    <Plus className="w-4 h-4" strokeWidth={1.75} /> Tambah soal ke daftar
                  </button>
                </form>

                <div>
                  <p className={`text-xs font-medium ${theme.subText} mb-2`}>Daftar soal ({draftQuestions.length})</p>
                  {draftQuestions.length === 0 ? (
                    <p className={`text-sm ${theme.subText}`}>Belum ada soal. Tambahkan lewat formulir di atas.</p>
                  ) : (
                    <div className={`divide-y ${theme.divider} border ${theme.line} rounded-xl overflow-hidden`}>
                      {draftQuestions.map((q, i) => (
                        <div key={i} className="p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${theme.titleText}`}>{i + 1}. {q.question}</p>
                            <p className={`text-xs ${theme.subText} mt-0.5`}>Jawaban: <span className={theme.good}>{q.answer}</span> · {q.options.length} pilihan</p>
                          </div>
                          <button onClick={() => setDraftQuestions(prev => prev.filter((_, idx) => idx !== i))} className={`${theme.subText} p-1 shrink-0`} title="Hapus soal"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={handleSaveQuiz} className={`w-full sm:w-auto px-6 py-3 ${theme.btnPrimary} font-medium rounded-full text-sm flex items-center justify-center gap-2 transition ${focusRing}`}>
                  <Send className="w-4 h-4" strokeWidth={1.75} /> Simpan dan bagikan
                </button>
              </div>

              <div className={`${theme.cardStatic} border rounded-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${theme.line} flex justify-between items-center`}>
                  <h3 className={`font-semibold text-sm ${theme.titleText}`}>Soal yang sudah dibagikan</h3>
                  <span className={`text-xs ${theme.subText}`}>{staffQuizzes.length} kumpulan</span>
                </div>
                <div className={`divide-y ${theme.divider}`}>
                  {staffQuizzes.length === 0 ? <EmptyText>Belum ada soal yang dibagikan.</EmptyText> : staffQuizzes.map((quiz) => (
                    <div key={quiz.id} className={`p-4 flex items-center justify-between gap-3 ${theme.hoverRow}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <IconTile Icon={ClipboardList} size="sm" />
                        <div className="min-w-0">
                          <h4 className={`text-sm font-semibold ${theme.titleText} truncate`}>{quiz.title}</h4>
                          <span className={`text-xs ${theme.subText}`}>{quiz.questions.length} soal · {quiz.author} · {quiz.time}</span>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteQuiz(quiz.id)} className={`${theme.subText} p-1.5 shrink-0`} title="Hapus"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== STAFF: PENGUMUMAN ===== */}
          {isStaff && screen === 'staff_pengumuman' && (
            <div className="space-y-6">
              <div className={`${theme.cardStatic} p-6 border rounded-2xl flex items-start gap-4`}>
                <IconTile Icon={Megaphone} size="lg" />
                <div>
                  <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>Pengumuman untuk siswa BN</h2>
                  <p className={`text-sm ${theme.subText} mt-1`}>
                    {isAdmin ? 'Pengumuman dari admin diterima semua siswa BN.' : 'Pengumuman hanya diterima siswa BN yang terhubung denganmu.'} Siswa mandiri tidak menerima pesan.
                  </p>
                </div>
              </div>

              <form onSubmit={handlePostAnnouncement} className={`${theme.cardStatic} border rounded-2xl p-5 space-y-3`}>
                <input type="text" placeholder="Judul pengumuman" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} className={fieldCls} required />
                <textarea rows={4} placeholder="Isi pengumuman" value={annBody} onChange={(e) => setAnnBody(e.target.value)} className={`${fieldCls} resize-none`} required />
                <button type="submit" className={`px-6 py-3 ${theme.btnPrimary} font-medium rounded-full text-sm flex items-center gap-2 transition ${focusRing}`}>
                  <Send className="w-4 h-4" strokeWidth={1.75} /> Kirim pengumuman
                </button>
              </form>

              <div className={`${theme.cardStatic} border rounded-2xl overflow-hidden`}>
                <div className={`p-4 border-b ${theme.line} flex justify-between items-center`}>
                  <h3 className={`font-semibold text-sm ${theme.titleText}`}>Pengumuman terkirim</h3>
                  <span className={`text-xs ${theme.subText}`}>{staffAnnouncements.length} pengumuman</span>
                </div>
                <div className={`divide-y ${theme.divider}`}>
                  {staffAnnouncements.length === 0 ? <EmptyText>Belum ada pengumuman.</EmptyText> : staffAnnouncements.map((a) => (
                    <div key={a.id} className={`p-4 flex items-start justify-between gap-3 ${theme.hoverRow}`}>
                      <div className="min-w-0">
                        <h4 className={`text-sm font-semibold ${theme.titleText}`}>{a.title}</h4>
                        <p className={`text-sm ${theme.subText} mt-1 whitespace-pre-line`}>{a.body}</p>
                        <span className={`text-xs ${theme.subText} mt-2 block`}>{a.author} · {a.time}</span>
                      </div>
                      <button onClick={() => handleDeleteAnnouncement(a.id)} className={`${theme.subText} p-1.5 shrink-0`} title="Hapus"><Trash2 className="w-4 h-4" strokeWidth={1.5} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== SISWA BN: PENGUMUMAN ===== */}
          {!isStaff && screen === 'announcements' && (
            <div className="space-y-4">
              {!isBN ? (
                <div className={`${theme.cardStatic} border rounded-2xl`}><EmptyText>Pengumuman hanya untuk siswa BN yang mendaftar dengan token.</EmptyText></div>
              ) : myAnnouncements.length === 0 ? (
                <div className={`${theme.cardStatic} border rounded-2xl`}><EmptyText>Belum ada pengumuman dari {user.teacherName}.</EmptyText></div>
              ) : myAnnouncements.map((a) => (
                <div key={a.id} className={`${theme.cardStatic} border rounded-2xl p-5`}>
                  <h4 className={`text-sm font-semibold ${theme.titleText}`}>{a.title}</h4>
                  <p className={`text-sm ${theme.subText} mt-1 whitespace-pre-line`}>{a.body}</p>
                  <span className={`text-xs ${theme.subText} mt-3 block`}>{a.author} · {a.ts ? fmtTime(a.ts) : a.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* ===== HOME SISWA ===== */}
          {screen === 'home' && !isStaff && (
            <div className="space-y-8">
              <div className={`${theme.cardStatic} border p-6 sm:p-8 rounded-3xl flex items-center gap-5`}>
                <Logo size="lg" />
                <div>
                  <h2 className={`text-2xl sm:text-3xl font-semibold tracking-tight ${theme.titleText} capitalize`}>Halo, {user.name}</h2>
                  <p className={`text-sm ${theme.subText} mt-1.5 max-w-md`}>
                    {isBN ? `Kamu terhubung dengan ${user.teacherName}. Nilai dan aktivitas belajarmu tercatat untuk guru.` : 'Pilih kategori kosakata atau kerjakan kuis.'}
                  </p>
                </div>
              </div>

              {!isBN && (
                <div className={`p-4 rounded-2xl border text-xs flex gap-2.5 ${theme.warnBox}`}>
                  <Info className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p>Kamu belajar secara mandiri. Kamu tidak terhubung dengan guru, sehingga tidak menerima pengumuman atau soal dari guru.</p>
                </div>
              )}

              {isBN && myAnnouncements.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className={`text-sm font-semibold ${theme.titleText} flex items-center gap-2`}><Megaphone className="w-4 h-4" strokeWidth={1.5} /> Pengumuman terbaru</h2>
                    <button onClick={openAnnouncements} className={`text-xs font-medium ${theme.accentText}`}>Lihat semua{unreadCount > 0 ? ` (${unreadCount} baru)` : ''}</button>
                  </div>
                  {myAnnouncements.slice(0, 2).map((a) => (
                    <div key={a.id} className={`${theme.cardStatic} border rounded-2xl p-5`}>
                      <h4 className={`text-sm font-semibold ${theme.titleText}`}>{a.title}</h4>
                      <p className={`text-sm ${theme.subText} mt-1 whitespace-pre-line line-clamp-3`}>{a.body}</p>
                      <span className={`text-xs ${theme.subText} mt-3 block`}>{a.author} · {a.ts ? fmtTime(a.ts) : a.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {isBN && myQuizzes.length > 0 && (
                <div className="space-y-3">
                  <h2 className={`text-sm font-semibold ${theme.titleText} flex items-center gap-2`}><ClipboardList className="w-4 h-4" strokeWidth={1.5} /> Soal dari guru</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {myQuizzes.map((quiz) => (
                      <div key={quiz.id} className={`${theme.card} border p-5 rounded-2xl flex items-center justify-between gap-3 transition`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <IconTile Icon={ClipboardList} />
                          <div className="min-w-0">
                            <h4 className={`text-sm font-semibold ${theme.titleText} truncate`}>{quiz.title}</h4>
                            <p className={`text-xs ${theme.subText} mt-0.5`}>{quiz.questions.length} soal</p>
                          </div>
                        </div>
                        <button onClick={() => startCustomQuiz(quiz)} className={`px-4 py-2 ${theme.btnPrimary} rounded-full text-xs font-medium flex items-center gap-1.5 shrink-0 ${focusRing}`}>
                          <Play className="w-3 h-3 fill-current" /> Kerjakan
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className={`text-sm font-semibold ${theme.titleText} mb-4`}>Modul pelajaran</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div onClick={() => { setScreen('jurusan_menu'); logActivity('Membuka menu Kosakata Jurusan SMK'); }} className={`${theme.card} border p-5 rounded-2xl cursor-pointer transition flex flex-col justify-between gap-5 group`}>
                    <IconTile Icon={GraduationCap} />
                    <div>
                      <h4 className={`font-semibold ${theme.titleText} text-sm`}>Kosakata jurusan SMK</h4>
                      <p className={`text-xs ${theme.subText} mt-1`}>DKV, RPL, TP, Kuliner, dan lainnya</p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${theme.accentText}`}>
                      <span>Pilih jurusan</span> <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" strokeWidth={1.75} />
                    </div>
                  </div>

                  <div onClick={() => { setScreen('numbers'); logActivity('Membuka modul Angka 1-100'); }} className={`${theme.card} border p-5 rounded-2xl cursor-pointer transition flex flex-col justify-between gap-5`}>
                    <IconTile Icon={Hash} />
                    <div>
                      <h4 className={`font-semibold ${theme.titleText} text-sm`}>Angka 1-100</h4>
                      <p className={`text-xs ${theme.subText} mt-1`}>Latihan angka bahasa Inggris</p>
                    </div>
                  </div>

                  {Object.entries(categories).map(([key, cat]) => (
                    <div key={key} onClick={() => { setActiveCategoryKey(key); setScreen('category_detail'); logActivity(`Membuka kategori ${cat.name}`); }} className={`${theme.card} border p-5 rounded-2xl cursor-pointer transition flex flex-col justify-between gap-5`}>
                      <IconTile Icon={categoryIconMap[key]} emoji={cat.emoji} />
                      <div>
                        <h4 className={`font-semibold ${theme.titleText} text-sm`}>{cat.name}</h4>
                        <p className={`text-xs ${theme.subText} mt-1`}>{cat.words.length} kosakata</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== JURUSAN MENU ===== */}
          {screen === 'jurusan_menu' && !isStaff && (
            <div className="space-y-6">
              <div className={`${theme.cardStatic} p-6 border rounded-2xl flex items-center justify-between gap-4`}>
                <div className="flex items-center gap-4">
                  <IconTile Icon={GraduationCap} size="lg" />
                  <div>
                    <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>Kosakata jurusan SMK</h2>
                    <p className={`text-sm ${theme.subText} mt-1`}>Pilih jurusan untuk mulai belajar kosakata kejuruan</p>
                  </div>
                </div>
                <button onClick={() => setScreen('home')} className={`px-4 py-2.5 rounded-full text-xs font-medium border ${theme.btnSecondary} ${focusRing}`}>Kembali</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {jurusanVocab?.categories && Object.entries(jurusanVocab.categories).map(([subKey, subData]) => (
                  <div key={subKey} onClick={() => { setActiveCategoryKey(`jurusan_${subKey}`); setScreen('category_detail'); logActivity(`Membuka Jurusan: ${subData.name}`); }} className={`${theme.card} border p-5 rounded-2xl cursor-pointer transition flex items-center justify-between group`}>
                    <div className="flex items-center gap-4">
                      <IconTile emoji={subData.emoji} />
                      <div>
                        <h4 className={`font-semibold ${theme.titleText} text-sm`}>{subData.name}</h4>
                        <p className={`text-xs ${theme.subText} mt-0.5`}>{subData.words.length} kosakata</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${theme.subText} group-hover:translate-x-1 transition-transform`} strokeWidth={1.5} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== CATEGORY DETAIL ===== */}
          {screen === 'category_detail' && activeCategoryKey && !isStaff && (() => {
            const activeData = getActiveWordsAndDetails();
            return (
              <div className="space-y-6">
                <div className={`${theme.cardStatic} p-6 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                  <div className="flex items-center gap-4">
                    <IconTile Icon={activeData.Icon} emoji={activeData.emoji} size="lg" />
                    <div>
                      <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>{activeData.name}</h2>
                      <p className={`text-sm ${theme.subText} mt-0.5`}>{activeData.words.length} kosakata</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setScreen(activeCategoryKey.startsWith('jurusan_') ? 'jurusan_menu' : 'home')} className={`px-4 py-3 border rounded-full text-xs font-medium ${theme.btnSecondary} ${focusRing}`}>Kembali</button>
                    <button onClick={() => startCategoryQuiz(activeCategoryKey)} className={`px-5 py-3 ${theme.btnPrimary} font-medium rounded-full text-xs flex items-center gap-2 transition ${focusRing}`}>
                      <Play className="w-3.5 h-3.5 fill-current" /> Mulai kuis
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddWord} className={`${theme.cardStatic} p-3 border rounded-2xl flex flex-col sm:flex-row gap-2.5`}>
                  <input type="text" placeholder="Inggris (contoh: design)" value={newEnWord} onChange={(e) => setNewEnWord(e.target.value)} className={`flex-1 px-4 py-2.5 border rounded-xl text-sm ${focusRing} ${theme.inputBg}`} />
                  <input type="text" placeholder="Indonesia (contoh: desain)" value={newIdWord} onChange={(e) => setNewIdWord(e.target.value)} className={`flex-1 px-4 py-2.5 border rounded-xl text-sm ${focusRing} ${theme.inputBg}`} />
                  <button type="submit" className={`px-4 py-2.5 ${theme.btnPrimary} font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 ${focusRing}`}>
                    <Plus className="w-4 h-4" strokeWidth={1.75} /> Tambah kata
                  </button>
                </form>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {activeData.words.map(([en, id], idx) => (
                    <div key={idx} onClick={() => { speakWord(en); logActivity(`Mempelajari kata: '${en}'`); }} className={`${theme.card} border p-4 rounded-2xl flex flex-col justify-between cursor-pointer transition`}>
                      <div>
                        <span className={`text-base font-semibold ${theme.titleText} capitalize`}>{en}</span>
                        <p className={`text-xs ${theme.subText} mt-0.5 capitalize`}>{id}</p>
                      </div>
                      <div className={`flex justify-between items-center mt-4 pt-2.5 border-t ${theme.line}`} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleDeleteWord(idx)} className={`${theme.subText} p-1 rounded-md`} title="Hapus"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
                        <button onClick={() => speakWord(en)} className={`${theme.subText} p-1 rounded-md`} title="Suara"><Volume2 className="w-4 h-4" strokeWidth={1.5} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ===== NUMBERS ===== */}
          {screen === 'numbers' && !isStaff && (
            <div className="space-y-6">
              <div className={`${theme.cardStatic} p-6 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                <div className="flex items-center gap-4">
                  <IconTile Icon={Hash} size="lg" />
                  <div>
                    <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>Modul angka 1-100</h2>
                    <p className={`text-sm ${theme.subText} mt-0.5`}>Dengarkan pelafalan angka dalam bahasa Inggris</p>
                  </div>
                </div>
                <button onClick={startNumberQuiz} className={`px-5 py-3 ${theme.btnPrimary} font-medium rounded-full text-xs flex items-center gap-2 transition ${focusRing}`}>
                  <Play className="w-3.5 h-3.5 fill-current" /> Tes angka
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 max-h-[560px] overflow-y-auto pr-1">
                {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
                  const w = numberToWords(n);
                  return (
                    <div key={n} onClick={() => speakWord(w)} className={`${theme.card} border p-4 rounded-2xl flex flex-col justify-between cursor-pointer transition`}>
                      <span className={`text-2xl font-semibold tracking-tight ${theme.titleText}`}>{n}</span>
                      <div className="flex justify-between items-end mt-2">
                        <span className={`text-xs font-medium ${theme.subText} capitalize`}>{w}</span>
                        <Volume2 className={`w-4 h-4 ${theme.subText}`} strokeWidth={1.5} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== QUIZ ===== */}
          {screen === 'quiz' && !isStaff && (
            <div className="max-w-2xl mx-auto">
              {quizState.idx >= quizState.questions.length ? (
                <div className={`${theme.cardStatic} border rounded-3xl p-8 sm:p-10 text-center space-y-6`}>
                  <div className="flex justify-center"><IconTile Icon={Trophy} size="lg" /></div>
                  <h2 className={`text-xl font-semibold tracking-tight ${theme.titleText}`}>{quizState.title} selesai</h2>
                  <div>
                    <div className={`text-6xl font-semibold tracking-tight ${theme.accentText}`}>{Math.round((quizState.score / quizState.questions.length) * 100)}%</div>
                    <p className={`text-sm ${theme.subText} mt-2`}><span className={`${theme.titleText} font-semibold`}>{quizState.score}</span> dari {quizState.questions.length} jawaban benar</p>
                  </div>
                  <button onClick={() => setScreen('home')} className={`px-6 py-3 ${theme.btnPrimary} font-medium rounded-full text-sm ${focusRing}`}>Kembali ke beranda</button>
                </div>
              ) : (
                <div className={`${theme.cardStatic} border rounded-3xl p-6 sm:p-8 space-y-6`}>
                  <div className="space-y-3">
                    <div className={`flex justify-between items-center text-xs font-medium ${theme.subText}`}>
                      <span>Soal {quizState.idx + 1} dari {quizState.questions.length}</span>
                      <span>Skor {quizState.score}</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${theme.track}`}>
                      <div className={`h-full rounded-full transition-all duration-300 ${theme.bar}`} style={{ width: `${((quizState.idx + (quizState.answered ? 1 : 0)) / quizState.questions.length) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-center py-6">
                    <h3 className={`text-3xl font-semibold tracking-tight ${theme.titleText} capitalize`}>{quizState.questions[quizState.idx].question}</h3>
                    <p className={`text-sm ${theme.subText} mt-2`}>Pilih jawaban yang benar</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quizState.currentOptions.map((opt, i) => {
                      const correctAnswer = quizState.questions[quizState.idx].answer;
                      let btnStyle = theme.btnSecondary;
                      let Mark = null;
                      if (quizState.answered) {
                        if (opt === correctAnswer) { btnStyle = `${theme.btnPrimary} border-transparent font-semibold`; Mark = CheckCircle2; }
                        else if (opt === quizState.selectedOption) { btnStyle = theme.badBox; Mark = XCircle; }
                        else btnStyle = `${theme.btnSecondary} opacity-45`;
                      }
                      return (
                        <button key={i} onClick={() => handleAnswer(opt)} disabled={quizState.answered} className={`p-4 border rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 capitalize ${btnStyle} ${focusRing}`}>
                          {Mark && <Mark className="w-4 h-4 shrink-0" strokeWidth={1.75} />} {opt}
                        </button>
                      );
                    })}
                  </div>
                  {quizState.answered && (
                    <div className="pt-2 flex justify-end">
                      <button onClick={nextQuestion} className={`px-6 py-3 ${theme.btnPrimary} font-medium rounded-full text-sm flex items-center gap-2 ${focusRing}`}>
                        {quizState.idx + 1 >= quizState.questions.length ? 'Lihat hasil' : 'Soal berikutnya'} <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <ChatAssistant isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} isDarkMode={isDarkMode} />
    </div>
  );
}