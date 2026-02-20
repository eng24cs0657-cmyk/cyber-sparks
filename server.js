/**
 * Backend Server - Express + Node.js
 * Handles Gemini API calls, exposes REST endpoints for frontend
 * Frontend -> Backend -> Gemini API
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyCWyiRrjusdrqLxVaxBUscRjJ6szMRR_j8';
const USE_LOCAL_AI = !GOOGLE_API_KEY || GOOGLE_API_KEY === 'AIzaSyCWyiRrjusdrqLxVaxBUscRjJ6szMRR_j8';
if (USE_LOCAL_AI) {
    console.warn('No valid GOOGLE_API_KEY found — using local AI fallback.');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static files from root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

/**
 * Call Google Gemini API
 */
async function callGoogleAPI(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ],
                generationConfig: {
                    maxOutputTokens: 800,
                    temperature: 0.3
                }
            })
        });

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`Google API ${resp.status}: ${txt}`);
        }

        const data = await resp.json();
        const text =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            data?.response?.output_text ||
            JSON.stringify(data);
        return String(text || '').trim();
    } catch (e) {
        console.error('callGoogleAPI error:', e.message);
        throw e;
    }
}

/**
 * Parse JSON from AI response (robust extraction + repair)
 */
function parseJSONFromText(text, expected = 'object') {
    if (!text || typeof text !== 'string') return null;
    let t = text
        .replace(/```(?:json|js|javascript)?\n?/gi, '')
        .replace(/```/g, '')
        .trim();
    const objMatch = t.match(/\{[\s\S]*\}/);
    const arrMatch = t.match(/\[[\s\S]*\]/);
    let candidate = null;
    if (expected === 'array' && arrMatch) candidate = arrMatch[0];
    else if (expected === 'object' && objMatch) candidate = objMatch[0];
    else candidate = arrMatch?.[0] || objMatch?.[0] || t;

    try { return JSON.parse(candidate); } catch (e) { }

    let repaired = candidate
        .replace(/\r?\n/g, ' ')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*\]/g, ']')
        .replace(/'/g, '"');
    repaired = repaired.replace(/([\{,\s])(\w+)\s*:/g, '$1"$2":');

    try { return JSON.parse(repaired); } catch (e) {
        console.warn('parseJSONFromText: failed to repair JSON');
        return null;
    }
}

// Local deterministic AI generators (used when GOOGLE_API_KEY is not set)
function generateKnowledgeGraph(subject = 'Mathematics', numConcepts = 6) {
    const concepts = [];
    for (let i = 0; i < numConcepts; i++) {
        concepts.push({
            name: `${subject} concept ${i + 1}`,
            level: Math.min(6, Math.max(1, Math.floor((i / numConcepts) * 6) + 1)),
            description: `Auto-generated concept ${i + 1} for ${subject}`,
            difficulty: Math.min(5, (i % 5) + 1)
        });
    }
    const dependencies = {};
    for (let i = 1; i < concepts.length; i++) {
        dependencies[concepts[i].name] = [concepts[i - 1].name];
    }
    return { concepts, dependencies };
}

function generateQuizQuestionsLocal(subject = 'Personalized Study', topic = 'Basics', difficulty = 'medium', numQuestions = 3) {
    const questions = [];
    for (let i = 0; i < numQuestions; i++) {
        questions.push({
            id: i + 1,
            question: `Diagnostic ${subject} question: Regarding ${topic}, which of these is a key foundational principle?`,
            options: [`Standard ${topic} practice`, `Advanced ${subject} methodology`, `Fundamental ${topic} theory`, `None of the above`],
            correctIndex: 2,
            explanation: `Understanding the foundational theory of ${topic} is critical for mastering ${subject}.`
        });
    }
    return questions;
}

function generateStudyPlanLocal(subject = 'Mathematics', duration = 4, durationUnit = 'weeks') {
    return {
        subject,
        totalDuration: `${duration} ${durationUnit}`,
        dailyStudyTime: '1-2 hours',
        phases: [
            { name: 'Fundamentals', duration: '1 week', topics: ['Basics'], objectives: ['Learn core concepts'], activities: ['Read, practice'], resources: ['Videos'] },
            { name: 'Practice', duration: `${Math.max(1, duration - 2)} weeks`, topics: ['Problems'], objectives: ['Apply knowledge'], activities: ['Exercises'], resources: ['Practice sets'] },
            { name: 'Assessment', duration: '1 week', topics: ['Review'], objectives: ['Solidify understanding'], activities: ['Mock tests'], resources: ['Tests'] }
        ],
        milestones: [{ week: 1, milestone: 'Foundations', metrics: '70%+' }],
        dailySchedule: { Monday: ['Concept review', 'Practice'], Tuesday: ['New concept', 'Examples'] },
        resources: ['YouTube', 'Khan Academy'],
        tips: ['Study consistently', 'Active practice']
    };
}

function generateCompleteLearningModuleLocal(subject = 'Mathematics', topic = 'basics') {
    return {
        basics: [{ concept: 'Foundation', definition: 'Basic principles' }, { concept: 'Core', definition: 'Core ideas' }],
        flowchart: [{ step: 1, title: 'Start', description: 'Learn basics' }, { step: 2, title: 'Practice', description: 'Do exercises' }],
        quiz: generateQuizQuestionsLocal(subject, topic, 'medium', 3),
        youtubeTopics: [`${subject} ${topic} basics`, `${subject} ${topic} tutorial`],
        recapTimetable: { Monday: ['Review basics', 'Practice problems'], Tuesday: ['Watch tutorial'] },
        conceptMap: [{ name: 'Foundation', type: 'foundational' }, { name: 'Core', type: 'intermediate' }]
    };
}

function generateQuizAssignmentsLocal(subject = 'Mathematics', topic = 'basics', numAssignments = 3) {
    const assignments = [];
    for (let i = 0; i < numAssignments; i++) {
        assignments.push({ id: i + 1, title: `${topic} assignment ${i + 1}`, dueInDays: 3 + i, quiz: generateQuizQuestionsLocal(subject, topic, 'easy', 3) });
    }
    return { importantTopics: [{ name: topic, priority: 'high', prerequisites: ['foundation'] }], assignments };
}

function generateAiQuizLocal(subject = 'General', topic = 'basics', userProfile = {}, numQuestions = 5) {
    return { importantTopics: [{ name: topic, priority: 'high', prerequisites: ['foundation'] }], quiz: generateQuizQuestionsLocal(subject, topic, 'medium', numQuestions) };
}

/**
 * POST /api/knowledge-graph
 */
app.post('/api/knowledge-graph', async (req, res) => {
    try {
        const { subject = 'Mathematics', numConcepts = 12 } = req.body;
        const prompt = `You are an expert educator and graph theorist. Generate a detailed Knowledge Graph for "${subject}" with exactly ${numConcepts} interconnected concepts.
Return ONLY valid JSON with this structure:
{
  "concepts": [
    { "name": "concept name", "level": 1-6, "description": "brief explanation", "difficulty": 1-5 }
  ],
  "dependencies": {
    "conceptB": ["conceptA"], // means conceptA is a prerequisite for conceptB
    ...
  }
}
Ensure the graph has a logical flow (Prerequisites -> Advanced Topics). No cycles. Focus on "${subject}".`;

        if (USE_LOCAL_AI) {
            const parsed = generateKnowledgeGraph(subject, numConcepts);
            return res.json(parsed);
        }

        const resp = await callGoogleAPI(prompt);
        const parsed = parseJSONFromText(resp, 'object');

        if (!parsed || !parsed.concepts) {
            throw new Error('Invalid AI response');
        }

        res.json(parsed);
    } catch (error) {
        console.error('POST /api/knowledge-graph error:', error.message);
        res.status(500).json({
            error: error.message,
            fallback: generateKnowledgeGraph(req.body.subject, req.body.numConcepts)
        });
    }
});

/**
 * POST /api/quiz-questions
 * Generates an AI assessment that assesses learning gaps and suggests prerequisites
 */
app.post('/api/quiz-questions', async (req, res) => {
    try {
        const { subject = 'Mathematics', topic = 'basics', difficulty = 'medium', numQuestions = 3 } = req.body;
        const prompt = `Create a curated assessment of ${numQuestions} multiple-choice questions for "${subject}" on the specific topic: "${topic}".
Difficulty level: ${difficulty}.
For each question, also identify:
1. "targetConcept": the specific concept being tested.
2. "prerequisiteGap": if the student gets this wrong, what specific foundational knowledge are they likely missing?

Return ONLY a JSON array:
[
  {
    "id": 1,
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "...",
    "targetConcept": "...",
    "prerequisiteGap": "..."
  }
]`;

        if (USE_LOCAL_AI) {
            const questions = generateQuizQuestionsLocal(subject, topic, difficulty, numQuestions);
            return res.json(questions.map(q => ({ ...q, targetConcept: topic, prerequisiteGap: 'Basic understanding' })));
        }

        const resp = await callGoogleAPI(prompt);
        const parsed = parseJSONFromText(resp, 'array');

        if (!Array.isArray(parsed)) {
            throw new Error('Invalid AI response');
        }

        res.json(parsed);
    } catch (error) {
        console.error('POST /api/quiz-questions error:', error.message);
        res.status(500).json({
            error: error.message,
            fallback: generateQuizQuestionsLocal(req.body.subject, req.body.topic, req.body.difficulty, req.body.numQuestions)
        });
    }
});

/**
 * POST /api/study-plan
 * Generate a comprehensive study plan for a subject
 */
app.post('/api/study-plan', async (req, res) => {
    const { subject = 'Mathematics', duration = 4, durationUnit = 'weeks' } = req.body;
    try {

        const prompt = `Create a detailed ${duration}-${durationUnit} study plan for mastering "${subject}". Return ONLY valid JSON with this exact structure:
{
  "subject": "${subject}",
  "totalDuration": "${duration} ${durationUnit}",
  "dailyStudyTime": "X hours",
  "phases": [
    {
      "name": "Phase name",
      "duration": "X days/weeks",
      "topics": ["topic1", "topic2"],
      "objectives": ["objective1", "objective2"],
      "activities": ["activity1", "activity2"],
      "resources": ["resource1", "resource2"]
    }
  ],
  "milestones": [
    {
      "week": 1,
      "milestone": "Understand foundations",
      "metrics": "Score 70%+ on fundamentals quiz"
    }
  ],
  "dailySchedule": {
    "Monday": ["09:00 - Concept review", "10:30 - Practice problems", "12:00 - Lunch break"],
    "Tuesday": ["09:00 - New concept", "10:30 - Examples and exercises"]
  },
  "resources": ["YouTube", "Khan Academy", "Practice sets", "Discussion forums"],
  "tips": ["tip1", "tip2", "tip3"]
}`;

        if (USE_LOCAL_AI) {
            const parsed = generateStudyPlanLocal(subject, duration, durationUnit);
            return res.json(parsed);
        }

        const resp = await callGoogleAPI(prompt);
        const parsed = parseJSONFromText(resp, 'object');

        if (!parsed || !parsed.phases) {
            return res.status(400).json({
                error: 'Invalid response from AI',
                fallback: {
                    subject: subject,
                    totalDuration: `${duration} ${durationUnit}`,
                    dailyStudyTime: '2-3 hours',
                    phases: [
                        { name: 'Fundamentals', duration: '1 week', topics: ['Basics'], objectives: ['Learn core concepts'], activities: ['Study, practice problems'], resources: ['Videos, textbooks'] },
                        { name: 'Intermediate', duration: '2 weeks', topics: ['Application'], objectives: ['Apply concepts'], activities: ['Problem solving'], resources: ['Practice sets'] },
                        { name: 'Mastery', duration: '1 week', topics: ['Advanced'], objectives: ['Master the subject'], activities: ['Assessments'], resources: ['Tests, projects'] }
                    ],
                    milestones: [
                        { week: 1, milestone: 'Learn foundations', metrics: '70%+ on basics' },
                        { week: 3, milestone: 'Apply knowledge', metrics: '80%+ on practice' },
                        { week: 4, milestone: 'Achieve mastery', metrics: '90%+ on assessment' }
                    ],
                    tips: ['Study consistently daily', 'Take breaks every 45 mins', 'Review previous concepts', 'Practice actively, not passively']
                }
            });
        }

        res.json(parsed);
    } catch (error) {
        console.error('POST /api/study-plan error:', error.message);
        res.status(500).json({
            error: error.message,
            fallback: {
                subject: subject,
                totalDuration: `${duration} ${durationUnit}`,
                dailyStudyTime: '2-3 hours',
                phases: [
                    { name: 'Fundamentals', duration: '1 week', topics: ['Basics'], objectives: ['Learn'], activities: ['Study'], resources: ['Resources'] }
                ],
                tips: ['Study daily', 'Take breaks', 'Practice']
            }
        });
    }
});

/**
 * POST /api/complete-learning-module
 * Generate complete learning module with quiz, flowchart, basics, youtube links, and timetable
 */
app.post('/api/complete-learning-module', async (req, res) => {
    const { subject = 'Mathematics', topic = 'basics' } = req.body;
    try {

        // Generate comprehensive prompt
        const prompt = `You are an expert educator. For the subject "${subject}" and topic "${topic}", generate a COMPLETE JSON response with:

1. "basics": Array of 5-7 fundamental concepts and definitions
2. "flowchart": Step-by-step learning progression (array of steps with descriptions)
3. "quiz": Array of 3 MCQs (with id, question, options array of 4, correctIndex, explanation)
4. "youtubeTopics": Array of 5 specific YouTube search queries for learning this topic
5. "recapTimetable": Object with days (Mon-Sun) containing 2-3 learning activities each
6. "conceptMap": Array of 5-8 key concepts with their relationships

Return ONLY valid JSON. Example structure:
{
  "basics": [{"concept": "name", "definition": "explanation"}],
  "flowchart": [{"step": 1, "title": "title", "description": "desc"}],
  "quiz": [{"id": 1, "question": "?", "options": ["a","b","c","d"], "correctIndex": 0, "explanation": "ex"}],
  "youtubeTopics": ["topic 1", "topic 2", ...],
  "recapTimetable": {"Monday": ["activity1", "activity2"], ...},
  "conceptMap": [{"name": "concept", "type": "foundational/intermediate/advanced"}]
}`;

        if (USE_LOCAL_AI) {
            const parsed = generateCompleteLearningModuleLocal(subject, topic);
            return res.json(parsed);
        }

        const resp = await callGoogleAPI(prompt);
        const parsed = parseJSONFromText(resp, 'object');

        if (!parsed || !parsed.basics) {
            return res.status(400).json({
                error: 'Invalid response from AI',
                fallback: getDefaultLearningModule(subject, topic)
            });
        }

        res.json(parsed);
    } catch (error) {
        console.error('POST /api/complete-learning-module error:', error.message);
        res.status(500).json({
            error: error.message,
            fallback: getDefaultLearningModule(req.body.subject || 'Mathematics', req.body.topic || 'basics')
        });
    }
});

/**
 * POST /api/quiz-assignments
 * Generate AI-driven quiz assignments and return important topics with prerequisites
 */
app.post('/api/quiz-assignments', async (req, res) => {
    const { subject = 'Mathematics', topic = 'basics', numAssignments = 3 } = req.body;
    try {
        const prompt = `You are an expert educator. For the subject "${subject}" and topic "${topic}", return ONLY valid JSON with the following structure:\n{\n  "importantTopics": [ {"name":"topic name","priority":"high|medium|low","prerequisites":["prereq1","prereq2"]} ],\n  "assignments": [ {"id":1,"title":"Assignment title","dueInDays":3,"quiz":[{"id":1,"question":"?","options":["a","b","c","d"],"correctIndex":0,"explanation":""}]} ]\n}\nMake sure to include ${numAssignments} assignments (if applicable), and each assignment should contain 3-5 quiz questions at appropriate difficulties. Keep JSON strictly valid.`;

        if (USE_LOCAL_AI) {
            const parsed = generateQuizAssignmentsLocal(subject, topic, numAssignments);
            return res.json(parsed);
        }

        const resp = await callGoogleAPI(prompt);
        const parsed = parseJSONFromText(resp, 'object');

        if (!parsed || !parsed.importantTopics) {
            return res.status(400).json({
                error: 'Invalid response from AI',
                fallback: {
                    importantTopics: [{ name: topic, priority: 'high', prerequisites: ['foundation'] }],
                    assignments: [{ id: 1, title: `Intro ${topic}`, dueInDays: 3, quiz: [{ id: 1, question: 'What is 1+1?', options: ['1', '2', '3', '4'], correctIndex: 1, explanation: '1+1=2' }] }]
                }
            });
        }

        res.json(parsed);
    } catch (error) {
        console.error('POST /api/quiz-assignments error:', error.message);
        res.status(500).json({
            error: error.message,
            fallback: {
                importantTopics: [{ name: topic, priority: 'high', prerequisites: ['Foundation'] }],
                assignments: [{ id: 1, title: `Introduction to ${topic}`, dueInDays: 3, quiz: generateQuizQuestionsLocal(subject, topic, 'easy', 3) }]
            }
        });
    }
});

/**
 * Default learning module fallback
 */
function getDefaultLearningModule(subject, topic) {
    return {
        basics: [
            { concept: 'Foundation', definition: 'Basic principles and definitions' },
            { concept: 'Core Concept', definition: 'Essential understanding of the topic' },
            { concept: 'Application', definition: 'How to use this knowledge' }
        ],
        flowchart: [
            { step: 1, title: 'Learn Basics', description: 'Understand fundamental concepts' },
            { step: 2, title: 'Practice', description: 'Apply knowledge through problems' },
            { step: 3, title: 'Master', description: 'Achieve mastery through assessment' }
        ],
        quiz: [
            { id: 1, question: 'What is the first step in learning?', options: ['Foundation', 'Application', 'Testing', 'Review'], correctIndex: 0, explanation: 'Learning begins with understanding the basics' }
        ],
        youtubeTopics: [
            `${subject} ${topic} basics`,
            `${subject} ${topic} tutorial`,
            `${subject} ${topic} explained`,
            `${subject} ${topic} practice problems`,
            `${subject} ${topic} advanced`
        ],
        recapTimetable: {
            'Monday': ['09:00 - Learn basics (60 min)', '10:00 - Understand concepts (30 min)'],
            'Tuesday': ['09:00 - Watch tutorial (45 min)', '09:45 - Practice problems (45 min)'],
            'Wednesday': ['10:00 - Concept review (60 min)', '11:00 - Self-assessment (30 min)'],
            'Thursday': ['09:00 - Problem solving (90 min)', '10:30 - Review mistakes (30 min)'],
            'Friday': ['10:00 - Practice test (60 min)', '11:00 - Week recap (30 min)'],
            'Saturday': ['10:00 - Extra practice (90 min)', '11:30 - Resource exploration (30 min)'],
            'Sunday': ['10:00 - Light review (30 min)', '10:30 - Plan next week (30 min)']
        },
        conceptMap: [
            { name: 'Foundation', type: 'foundational' },
            { name: 'Core Concept', type: 'intermediate' },
            { name: 'Application', type: 'intermediate' },
            { name: 'Advanced Topic', type: 'advanced' }
        ]
    };
}

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * GET / (root diagnostics)
 */
app.get('/api', (req, res) => {
    res.json({
        message: 'Adaptive Learning Backend API',
        endpoints: {
            health: 'GET /api/health',
            knowledgeGraph: 'POST /api/knowledge-graph { subject, numConcepts }',
            quizQuestions: 'POST /api/quiz-questions { subject, topic, difficulty, numQuestions }'
        }
    });
});

/**
 * POST /api/ai-quiz
 * Generate AI-driven quiz + important topics/prerequisites based on user profile
 * Request body: { subject, topic, userProfile: { skillLevel, successRate, pace }, numQuestions }
 */
app.post('/api/ai-quiz', async (req, res) => {
    const { subject = 'General', topic = 'basics', userProfile = {}, numQuestions = 5 } = req.body;
    try {
        // Derive difficulty from userProfile.successRate
        let difficulty = 'medium';
        const success = parseInt(userProfile.successRate || 0, 10);
        if (!isNaN(success)) {
            if (success >= 85) difficulty = 'expert';
            else if (success >= 70) difficulty = 'hard';
            else if (success >= 50) difficulty = 'medium';
            else difficulty = 'easy';
        } else if (userProfile.skillLevel) {
            const lvl = String(userProfile.skillLevel).toLowerCase();
            if (lvl === 'beginner') difficulty = 'easy';
            else if (lvl === 'intermediate') difficulty = 'medium';
            else if (lvl === 'advanced') difficulty = 'hard';
        }

        if (USE_LOCAL_AI) {
            return res.json({
                importantTopics: [{ name: topic, priority: 'high', prerequisites: ['Foundation'] }],
                quiz: generateQuizQuestionsLocal(subject, topic, difficulty, numQuestions)
            });
        }

        const prompt = `You are an expert educator. For the subject "${subject}" and topic "${topic}", produce a JSON object containing:\n` +
            `1) importantTopics: an array of objects { name, priority: high|medium|low, prerequisites: [..] }\n` +
            `2) quiz: an array of ${numQuestions} multiple-choice questions suitable for ${difficulty} difficulty, each with id, question, options (4), correctIndex, explanation\n` +
            `Return ONLY valid JSON. Keep answers concise and ensure JSON parses cleanly.`;

        const resp = await callGoogleAPI(prompt);
        const parsed = parseJSONFromText(resp, 'object');

        if (!parsed || (!parsed.quiz && !parsed.importantTopics)) {
            return res.status(400).json({
                error: 'Invalid response from AI',
                fallback: {
                    importantTopics: [{ name: topic, priority: 'high', prerequisites: ['Foundation'] }],
                    quiz: generateQuizQuestionsLocal(subject, topic, difficulty, numQuestions)
                }
            });
        }

        res.json(parsed);
    } catch (error) {
        console.error('POST /api/ai-quiz error:', error.message);
        res.status(500).json({
            error: error.message,
            fallback: {
                importantTopics: [{ name: topic, priority: 'high', prerequisites: ['Foundation'] }],
                quiz: generateQuizQuestionsLocal(subject, topic, difficulty, numQuestions)
            }
        });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`\n✅ Backend server running on http://localhost:${PORT}`);
    console.log(`📚 API endpoints:`);
    console.log(`   POST /api/knowledge-graph`);
    console.log(`   POST /api/quiz-questions`);
    console.log(`   POST /api/study-plan`);
    console.log(`   POST /api/complete-learning-module`);
    console.log(`   GET  /api/health\n`);
});
