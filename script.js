/**
 * Knowledge Graph Adaptive Learning - Client Side Logic
 * Connects to the Express backend for AI generation
 */

// Configuration
const BACKEND_URL = ''; // Empty string means current origin
let sessionStartTime = new Date();
let currentTopic = '';
let currentSubject = '';
let sessionHistory = JSON.parse(localStorage.getItem('sessionHistory')) || [];

// Core Models & Engines
class KnowledgeGraph {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.dependencies = {};
  }

  setData(data) {
    this.nodes = data.concepts || [];
    this.dependencies = data.dependencies || {};
    this.edges = [];

    // Convert dependencies to edges
    for (const [target, sources] of Object.entries(this.dependencies)) {
      sources.forEach(source => {
        this.edges.push({ from: source, to: target });
      });
    }
  }

  getAllConcepts() {
    return this.nodes;
  }
}

class LearningEngine {
  constructor() {
    this.learnerProfile = {
      skillLevel: 'beginner',
      pace: 'medium',
      consistency: 'low',
      successRate: 0
    };
  }

  async analyzeLearnerProfile(sessionData) {
    if (!sessionData || sessionData.length === 0) return this.learnerProfile;

    let avgScore = 0, avgDuration = 0;
    sessionData.forEach(s => {
      avgScore += s.score || 0;
      avgDuration += s.duration || 0;
    });

    avgScore = avgScore / sessionData.length;
    avgDuration = avgDuration / sessionData.length;
    const successRate = sessionData.filter(s => s.score >= 70).length / sessionData.length;

    this.learnerProfile = {
      skillLevel: avgScore < 40 ? 'beginner' : avgScore < 70 ? 'intermediate' : 'advanced',
      pace: avgDuration < 300 ? 'fast' : avgDuration < 900 ? 'medium' : 'slow',
      consistency: sessionData.length > 10 ? 'high' : sessionData.length > 5 ? 'medium' : 'low',
      successRate: Math.round(successRate * 100)
    };

    return this.learnerProfile;
  }
}

class GapAnalyzer {
  constructor() {
    this.studentUnderstanding = new Map(); // conceptName -> score (0-100)
    this.identifiedGaps = [];
  }

  assessConcept(concept, isCorrect) {
    const current = this.studentUnderstanding.get(concept) || 0;
    const newValue = isCorrect ? Math.min(100, current + 25) : Math.max(0, current - 15);
    this.studentUnderstanding.set(concept, newValue);

    if (newValue < 50) {
      if (!this.identifiedGaps.includes(concept)) this.identifiedGaps.push(concept);
    } else {
      this.identifiedGaps = this.identifiedGaps.filter(g => g !== concept);
    }
  }
}

class PersonalizationEngine {
  getCustomUIColor(skillLevel) {
    const themes = {
      beginner: '#6366f1',    // Indigo
      intermediate: '#f59e0b', // Amber
      advanced: '#10b981'    // Emerald
    };
    return themes[skillLevel] || themes.beginner;
  }

  getCustomQuestionCount(skillLevel) {
    if (skillLevel === 'beginner') return 3;
    if (skillLevel === 'advanced') return 8;
    return 5;
  }
}

// Global instances
const kg = new KnowledgeGraph();
const learningEngine = new LearningEngine();
const gapAnalyzer = new GapAnalyzer();
const personalizationEngine = new PersonalizationEngine();

// UI Elements & State
let network = null;
let charts = {};

// --- AUTHENTICATION ---
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.clear();
    location.reload();
  }
}

// --- CORE FUNCTIONALITY ---
async function generateLearningPath() {
  const subjectInput = document.getElementById('subject');
  const topic = subjectInput.value.trim();
  if (!topic) return alert('Please enter a topic!');

  currentTopic = topic;
  currentSubject = topic;

  const loading = document.getElementById('loadingStatus');
  loading.textContent = '🧠 AI is designing your personalized knowledge graph...';

  try {
    // 1. Fetch Knowledge Graph
    const resp = await fetch(`${BACKEND_URL}/api/knowledge-graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: topic, numConcepts: 10 })
    });
    const data = await resp.json();
    const finalData = data.concepts ? data : data.fallback;
    kg.setData(finalData);

    // 2. Render Graph
    renderKnowledgeGraph();

    // 3. Fetch Initial Assessment
    await refreshAssessmentQuestions(topic);

    // 4. Generate Comprehensive Content (YouTube, Timetable, Basics)
    // User requested "everything" upfront
    loading.textContent = '📚 Curating YouTube channels & study timetable...';
    await generateAdvancedLearningModule();

    // 5. Update Personalization
    await analyzeAndPersonalize();

    // 6. Provide Feedback
    loading.textContent = '';

    // Scroll to the content
    document.getElementById('completeLearningSection').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    console.error(e);
    loading.textContent = '❌ Error generating complete path. Please try again.';
  }
}

async function refreshAssessmentQuestions(topic) {
  const container = document.getElementById('assessmentQuestions');
  container.innerHTML = '<div class="spinner"></div><p>Coming up with relevant questions...</p>';

  try {
    const resp = await fetch(`${BACKEND_URL}/api/quiz-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: topic, topic: topic, difficulty: 'medium', numQuestions: 4 })
    });
    const data = await resp.json();
    const questions = Array.isArray(data) ? data : data.fallback || [];
    renderAssessment(questions);
    document.getElementById('analyzeGapsBtn').style.display = 'block';
  } catch (e) {
    container.innerHTML = '<p>Failed to load questions.</p>';
  }
}

function renderAssessment(questions) {
  const container = document.getElementById('assessmentQuestions');
  container.innerHTML = '';

  questions.forEach((q, idx) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'quiz-item';
    qDiv.innerHTML = `
      <p><strong>Q${idx + 1}:</strong> ${q.question}</p>
      <div class="options-grid">
        ${q.options.map((opt, i) => `
          <label class="option-item">
            <input type="radio" name="q_${q.id}" value="${i}">
            <span>${opt}</span>
          </label>
        `).join('')}
      </div>
      <input type="hidden" id="correct_${q.id}" value="${q.correctIndex}">
      <input type="hidden" id="concept_${q.id}" value="${q.targetConcept || ''}">
    `;
    container.appendChild(qDiv);
  });
}

async function submitAssessment() {
  const questions = document.querySelectorAll('.quiz-item');
  let score = 0;

  questions.forEach(q => {
    const id = q.querySelector('input').name.split('_')[1];
    const selected = q.querySelector('input:checked');
    const correct = document.getElementById(`correct_${id}`).value;
    const concept = document.getElementById(`concept_${id}`).value;

    const isCorrect = selected && selected.value == correct;
    if (isCorrect) score++;

    if (concept) gapAnalyzer.assessConcept(concept, isCorrect);
  });

  const percentage = Math.round((score / questions.length) * 100);
  alert(`Assessment Complete! Score: ${percentage}%`);

  // Track history
  sessionHistory.push({
    topic: currentTopic,
    score: percentage,
    duration: (new Date() - sessionStartTime) / 1000,
    timestamp: new Date()
  });
  localStorage.setItem('sessionHistory', JSON.stringify(sessionHistory));

  // Trigger learning module and plan
  await generateAdvancedLearningModule();
  updateCharts();
  analyzeAndPersonalize();
}

async function generateAdvancedLearningModule() {
  const section = document.getElementById('completeLearningSection');
  section.style.display = 'block';

  try {
    const resp = await fetch(`${BACKEND_URL}/api/complete-learning-module`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: currentSubject, topic: currentTopic })
    });
    const data = await resp.json();
    const final = data.basics ? data : data.fallback;

    renderLearningModule(final);
    await generateStudyPlan();
  } catch (e) {
    console.warn('Failed module generation');
  }
}

function renderLearningModule(data) {
  // Basics
  const basics = document.getElementById('basicsContainer');
  basics.innerHTML = data.basics.map(b => `
    <div class="basic-card">
      <h4>${b.concept}</h4>
      <p>${b.definition}</p>
    </div>
  `).join('');

  // Flowchart
  const flow = document.getElementById('flowchartContainer');
  flow.innerHTML = data.flowchart.map(s => `
    <div class="flow-step">
      <div class="step-num">${s.step}</div>
      <div class="step-content">
        <strong>${s.title}</strong>
        <p>${s.description}</p>
      </div>
    </div>
  `).join('');

  // YouTube
  const yt = document.getElementById('youtubeTopicsContainer');
  yt.innerHTML = data.youtubeTopics.map(t => `
    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(t)}" target="_blank" class="yt-link">
      📺 ${t}
    </a>
  `).join('');
}

async function generateStudyPlan() {
  const section = document.getElementById('studyPlanSection');
  section.style.display = 'block';

  try {
    const resp = await fetch(`${BACKEND_URL}/api/study-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: currentTopic, duration: 4, durationUnit: 'weeks' })
    });
    const data = await resp.json();
    const plan = data.phases ? data : data.fallback;

    document.getElementById('planDuration').textContent = plan.totalDuration;
    document.getElementById('planStudyTime').textContent = plan.dailyStudyTime;

    const phases = document.getElementById('phasesContainer');
    phases.innerHTML = plan.phases.map(p => `
      <div class="phase-card">
        <h4>${p.name} (${p.duration})</h4>
        <ul>${p.topics.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
    `).join('');
  } catch (e) {
    console.warn('Failed plan generation');
  }
}

// --- GRAPH RENDERING (Vis.js) ---
function renderKnowledgeGraph() {
  const container = document.getElementById('knowledgeGraph');
  const concepts = kg.getAllConcepts();

  const visNodes = concepts.map(c => ({
    id: c.name,
    label: c.name,
    title: c.description,
    value: c.level,
    group: 'level' + c.level,
    color: getDifficultyColor(c.difficulty)
  }));

  const visEdges = kg.edges;

  const data = { nodes: new vis.DataSet(visNodes), edges: new vis.DataSet(visEdges) };
  const options = {
    nodes: { shape: 'dot', font: { color: '#ffffff' } },
    edges: { arrows: 'to', color: '#6366f1' },
    physics: {
      enabled: true,
      stabilization: {
        iterations: 200, // Pre-calculate layout
        updateInterval: 50
      }
    },
    groups: {
      level1: { color: '#818cf8' },
      level6: { color: '#4338ca' }
    }
  };

  network = new vis.Network(container, data, options);

  // Freeze graph after layout
  network.once("stabilizationIterationsDone", function () {
    network.setOptions({ physics: false });
  });
}

function getDifficultyColor(diff) {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#7c3aed'];
  return colors[diff - 1] || '#6366f1';
}

// --- CHARTS (Chart.js) ---
function initializeCharts() {
  const chartConfigs = {
    gap: { type: 'radar', id: 'gapChart', labels: ['Understanding', 'Foundations', 'Prerequisites', 'Advanced', 'Application'] },
    perf: { type: 'line', id: 'performanceChart', labels: [] },
    timeline: { type: 'line', id: 'progressTimelineChart', labels: [] },
    mastery: { type: 'bar', id: 'masteryChart', labels: [] },
    velocity: { type: 'line', id: 'velocityChart', labels: [] },
    difficulty: { type: 'scatter', id: 'difficultyChart', labels: [] },
    timeDist: { type: 'doughnut', id: 'timeDistributionChart', labels: ['Reading', 'Quizzes', 'Videos', 'Practice'] },
    skill: { type: 'line', id: 'skillLevelChart', labels: [] },
    comparative: { type: 'radar', id: 'comparativeChart', labels: ['Topic A', 'Topic B', 'Topic C', 'Topic D'] }
  };

  for (const [key, config] of Object.entries(chartConfigs)) {
    const el = document.getElementById(config.id);
    if (!el) continue;
    const ctx = el.getContext('2d');
    charts[key] = new Chart(ctx, {
      type: config.type,
      data: {
        labels: config.labels,
        datasets: [{
          label: config.id.replace('Chart', ''),
          data: config.type === 'radar' ? [0, 0, 0, 0, 0] : [],
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: '#6366f1',
          borderWidth: 2,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }
}

function updateCharts() {
  if (!charts.perf) return;

  const lastSessions = sessionHistory.slice(-10);
  const labels = lastSessions.map((_, i) => `Session ${i + 1}`);
  const scores = lastSessions.map(s => s.score);

  // Update Performance
  charts.perf.data.labels = labels;
  charts.perf.data.datasets[0].data = scores;
  charts.perf.update();

  // Update Timeline
  charts.timeline.data.labels = labels;
  charts.timeline.data.datasets[0].data = scores;
  charts.timeline.update();

  // Update Mastery
  charts.mastery.data.labels = lastSessions.map(s => (s.topic || 'General').substring(0, 10));
  charts.mastery.data.datasets[0].data = scores;
  charts.mastery.update();

  // Update Radar with simulated profile
  if (charts.gap) {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
    charts.gap.data.datasets[0].data = [avg, avg * 0.9, avg * 1.1, avg * 0.7, avg * 0.85];
    charts.gap.update();
  }

  // Time Distribution (Mock)
  if (charts.timeDist) {
    charts.timeDist.data.datasets[0].data = [30, 20, 25, 25];
    charts.timeDist.update();
  }
}

// --- PREMIUM HUB LOGIC ---
async function analyzeAndPersonalize() {
  const profile = await learningEngine.analyzeLearnerProfile(sessionHistory);

  // Update Hub UI
  const badge = document.getElementById('hubStatusBadge');
  if (badge) badge.textContent = `Adaptive Level: ${profile.skillLevel.toUpperCase()}`;

  document.getElementById('hubMastery').textContent = `${profile.successRate}%`;
  document.getElementById('hubConsistency').textContent = profile.consistency.toUpperCase();
  document.getElementById('hubPace').textContent = profile.pace.toUpperCase();

  // Color Theme
  const customColor = personalizationEngine.getCustomUIColor(profile.skillLevel);
  document.documentElement.style.setProperty('--primary-color', customColor);

  const panel = document.getElementById('personalizationPanel');
  if (panel) panel.style.display = 'block';
}

async function refreshPersonalizedQuiz() {
  const container = document.getElementById('hubQuizContainer');
  container.innerHTML = '<div class="spinner"></div><p>AI is crafting your mastery quiz...</p>';

  try {
    const profile = learningEngine.learnerProfile;
    const resp = await fetch(`${BACKEND_URL}/api/ai-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: currentSubject,
        topic: currentTopic,
        userProfile: profile,
        numQuestions: 5
      })
    });
    const data = await resp.json();
    const final = data.quiz ? data : data.fallback;
    renderPremiumQuiz(final);
  } catch (e) {
    container.innerHTML = '<p>Failed to load master quiz.</p>';
  }
}

function renderPremiumQuiz(data) {
  const container = document.getElementById('hubQuizContainer');
  let html = `<form id="hubQuizForm" class="hub-quiz-form">`;

  data.quiz.forEach((q, idx) => {
    html += `
      <div class="hub-quiz-q-card">
        <div class="hub-q-text">${idx + 1}. ${q.question}</div>
        <div class="hub-options-grid">
          ${q.options.map((opt, i) => `
            <label class="hub-option-btn">
              <input type="radio" name="hubq_${q.id}" value="${i}" required>
              <span>${opt}</span>
            </label>
          `).join('')}
        </div>
        <input type="hidden" name="hubq_${q.id}_correct" value="${q.correctIndex || 0}">
      </div>
    `;
  });

  html += `<button type="submit" class="btn-primary btn-glow" style="margin-top:20px">Submit Mastery Check</button></form>`;
  container.innerHTML = html;

  document.getElementById('hubQuizForm').onsubmit = (e) => {
    e.preventDefault();
    alert('Mastery Check Submitted! Your profile is updating...');
    container.innerHTML = `<div class="hub-results-overlay"><h3>Check Complete!</h3><p>Your skill level is evolving.</p></div>`;
    analyzeAndPersonalize();
  };
}

// Helpers
function resetGraphLayout() { if (network) network.stabilize(); }
function expandGraph() { alert('Fullscreen mode activated'); }
function resetAssessment() { location.reload(); }
function exportReport() { window.print(); }
function toggleGraphView() { alert('Switching between Force and Hierarchical view...'); }

// Initialize app on page load
window.addEventListener('load', () => {
  initializeCharts();
});

// Render a "Welcome" decorative graph
function renderWelcomeGraph() {
  const container = document.getElementById('knowledgeGraph');
  if (!container) return;

  const nodes = new vis.DataSet([
    { id: 1, label: 'You', color: '#6366f1', size: 30, font: { color: '#fff', size: 16 }, x: 0, y: 0 },
    { id: 2, label: 'Science', color: '#a855f7', x: -100, y: -100 },
    { id: 3, label: 'History', color: '#ec4899', x: 100, y: -100 },
    { id: 4, label: 'Math', color: '#3b82f6', x: 100, y: 100 },
    { id: 5, label: 'Coding', color: '#10b981', x: -100, y: 100 },
    { id: 6, label: 'Art', color: '#f59e0b', x: 0, y: -150 },
    { id: 7, label: 'Future', color: '#ef4444', x: 0, y: 150 }
  ]);

  const edges = new vis.DataSet([
    { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 1, to: 4 },
    { from: 1, to: 5 }, { from: 1, to: 6 }, { from: 2, to: 7 },
    { from: 5, to: 7 }, { from: 3, to: 6 }
  ]);

  const options = {
    nodes: { shape: 'dot', size: 20, font: { face: 'Inter', color: '#1e293b' }, borderWidth: 2 },
    edges: { width: 1, color: { color: 'rgba(99, 102, 241, 0.3)', highlight: '#6366f1' }, smooth: { type: 'continuous' } },
    physics: { enabled: false }, // STATIC GRAPH: No auto-movement
    interaction: { dragNodes: true, zoomView: true, dragView: true }
  };

  network = new vis.Network(container, { nodes, edges }, options);
}

// Hook into the existing showMainApp from index.html (we need to expose this or run it when mainApp is visible)
// Since showMainApp is in index.html, we'll listen for a custom event or check visibility
// For simplicity, let's just expose a global init function
window.initDashboardVisuals = function () {
  renderWelcomeGraph();
};