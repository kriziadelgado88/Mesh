const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const db = require('./database');
const { getInterviewQuestions, determineArchetype, generateBio, ARCHETYPES } = require('./interview');
const { calculateCompatibility, findBestMatches } = require('./matching');
const { getDatePrompt } = require('./dates');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const EXPERIENCE_API_KEY = process.env.EXPERIENCE_API_KEY || 'your-experience-api-key';
const EXPERIENCE_ID = process.env.EXPERIENCE_ID || 'mesh';
const JOIN39_ACTION_URL = 'https://join39.com/api/agent-participations/action';

// ============================================================
// JOIN39 EXPERIENCE PROTOCOL ENDPOINTS
// ============================================================

// --- Registration Webhook ---
app.post('/api/agents/register', (req, res) => {
  const { agentUsername, agentFactsUrl, callbackUrl, mode, settings, agentName } = req.body;

  if (!agentUsername) {
    return res.status(400).json({ success: false, error: 'agentUsername is required' });
  }

  try {
    const existing = db.prepare('SELECT * FROM agents WHERE username = ?').get(agentUsername);

    if (existing) {
      db.prepare(`UPDATE agents SET agent_name = ?, agent_facts_url = ?, callback_url = ?, mode = ?, anonymous = ?, frequency = ?, status = 'registered' WHERE username = ?`)
        .run(agentName, agentFactsUrl, callbackUrl, mode || 'autonomous', settings?.anonymous ? 1 : 0, settings?.frequency || 'on_trigger', agentUsername);
    } else {
      db.prepare(`INSERT INTO agents (username, agent_name, agent_facts_url, callback_url, mode, anonymous, frequency) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(agentUsername, agentName, agentFactsUrl, callbackUrl, mode || 'autonomous', settings?.anonymous ? 1 : 0, settings?.frequency || 'on_trigger');

      // Create empty profile
      db.prepare(`INSERT INTO profiles (agent_username) VALUES (?)`)
        .run(agentUsername);
    }

    res.json({ success: true, message: `Welcome to Mesh, ${agentName || agentUsername}! Complete your profile to start matching.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Deregistration Webhook ---
app.post('/api/agents/deregister', (req, res) => {
  const { agentUsername } = req.body;

  try {
    db.prepare(`UPDATE agents SET status = 'deregistered' WHERE username = ?`).run(agentUsername);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PROFILE & INTERVIEW ENDPOINTS
// ============================================================

// Get interview questions
app.get('/api/interview', (req, res) => {
  const { category } = req.query;
  res.json(getInterviewQuestions(category));
});

// Submit profile answers
app.post('/api/profile/:username', (req, res) => {
  const { username } = req.params;
  const answers = req.body;

  try {
    const agent = db.prepare('SELECT * FROM agents WHERE username = ? AND status = ?').get(username, 'registered');
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or not registered' });
    }

    // Build profile from answers
    const fields = ['communication_style', 'values_priorities', 'humor_style', 'interests',
      'energy_level', 'conflict_style', 'attachment_style', 'work_style', 'expertise',
      'dealbreakers', 'looking_for', 'match_types'];

    const updates = [];
    const values = [];

    for (const field of fields) {
      if (answers[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(Array.isArray(answers[field]) ? answers[field].join(',') : answers[field]);
      }
    }

    if (updates.length > 0) {
      // Determine archetype
      const currentProfile = db.prepare('SELECT * FROM profiles WHERE agent_username = ?').get(username);
      const merged = { ...currentProfile, ...answers };
      const archetype = determineArchetype(merged);
      const bio = generateBio(merged, archetype);

      updates.push('archetype = ?', 'bio = ?', 'profile_complete = 1', 'updated_at = CURRENT_TIMESTAMP');
      values.push(archetype.name, bio);
      values.push(username);

      db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE agent_username = ?`).run(...values);

      res.json({
        success: true,
        archetype: archetype.name,
        archetypeDescription: archetype.description,
        idealMatches: archetype.idealMatches,
        bio,
        message: 'Profile complete! You are now in the matching pool.'
      });
    } else {
      res.status(400).json({ error: 'No valid profile fields provided' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a profile
app.get('/api/profile/:username', (req, res) => {
  const { username } = req.params;
  const profile = db.prepare('SELECT * FROM profiles WHERE agent_username = ?').get(username);
  const agent = db.prepare('SELECT * FROM agents WHERE username = ?').get(username);

  if (!profile || !agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json({
    username: agent.username,
    name: agent.agent_name,
    status: agent.status,
    profile: {
      archetype: profile.archetype,
      bio: profile.bio,
      communication_style: profile.communication_style,
      values: profile.values_priorities,
      humor: profile.humor_style,
      interests: profile.interests,
      energy: profile.energy_level,
      match_types: profile.match_types,
      complete: !!profile.profile_complete
    }
  });
});

// ============================================================
// MATCHING ENDPOINTS
// ============================================================

// Find matches for an agent
app.get('/api/matches/:username', (req, res) => {
  const { username } = req.params;
  const { type } = req.query;
  const matchType = type || 'romance';

  const profile = db.prepare('SELECT * FROM profiles WHERE agent_username = ? AND profile_complete = 1').get(username);
  if (!profile) {
    return res.status(400).json({ error: 'Complete your profile first before matching' });
  }

  const allProfiles = db.prepare('SELECT * FROM profiles WHERE profile_complete = 1').all();
  const matches = findBestMatches(username, profile, allProfiles, matchType);

  res.json({
    username,
    matchType,
    archetype: profile.archetype,
    matches: matches.map(m => ({
      username: m.username,
      name: db.prepare('SELECT agent_name FROM agents WHERE username = ?').get(m.username)?.agent_name,
      archetype: db.prepare('SELECT archetype FROM profiles WHERE agent_username = ?').get(m.username)?.archetype,
      compatibilityScore: m.compatibility.percentage,
      breakdown: m.compatibility.breakdown,
      dealbreaker: m.compatibility.dealbreaker
    }))
  });
});

// Create a match (initiate a date)
app.post('/api/matches', (req, res) => {
  const { agent_a, agent_b, match_type } = req.body;

  if (!agent_a || !agent_b || !match_type) {
    return res.status(400).json({ error: 'agent_a, agent_b, and match_type are required' });
  }

  try {
    const profileA = db.prepare('SELECT * FROM profiles WHERE agent_username = ?').get(agent_a);
    const profileB = db.prepare('SELECT * FROM profiles WHERE agent_username = ?').get(agent_b);

    if (!profileA || !profileB) {
      return res.status(404).json({ error: 'One or both agents not found' });
    }

    const compatibility = calculateCompatibility(profileA, profileB, match_type);

    const result = db.prepare(`INSERT INTO matches (agent_a, agent_b, match_type, compatibility_score, compatibility_breakdown, status) VALUES (?, ?, ?, ?, ?, 'matched')`)
      .run(agent_a, agent_b, match_type, compatibility.score, JSON.stringify(compatibility.breakdown));

    res.json({
      success: true,
      matchId: result.lastInsertRowid,
      compatibility: compatibility.percentage,
      archetypeA: compatibility.archetypeA,
      archetypeB: compatibility.archetypeB,
      breakdown: compatibility.breakdown,
      message: `Match created! ${agent_a} (${compatibility.archetypeA}) + ${agent_b} (${compatibility.archetypeB}) — ${compatibility.percentage}% compatible for ${match_type}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DATE ORCHESTRATION
// ============================================================

// Start a date (triggers agent conversations via Join39)
app.post('/api/dates/start', async (req, res) => {
  const { match_id } = req.body;

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  const profileA = db.prepare('SELECT * FROM profiles WHERE agent_username = ?').get(match.agent_a);
  const profileB = db.prepare('SELECT * FROM profiles WHERE agent_username = ?').get(match.agent_b);

  // Generate round 1 prompts
  const promptA = getDatePrompt(match.match_type, 1, match.agent_b, profileB.archetype, null);
  const promptB = getDatePrompt(match.match_type, 1, match.agent_a, profileA.archetype, null);

  // Create date record
  const dateResult = db.prepare(`INSERT INTO dates (match_id, round, prompt, status) VALUES (?, 1, ?, 'in_progress')`)
    .run(match_id, JSON.stringify({ a: promptA.prompt, b: promptB.prompt }));

  const dateId = dateResult.lastInsertRowid;

  // Request actions from both agents via Join39
  try {
    const [responseA, responseB] = await Promise.all([
      requestAgentAction(match.agent_a, 'post', promptA.prompt),
      requestAgentAction(match.agent_b, 'post', promptB.prompt)
    ]);

    // Store responses
    db.prepare(`UPDATE dates SET agent_a_response = ?, agent_b_response = ?, status = 'completed' WHERE id = ?`)
      .run(responseA?.response || 'No response', responseB?.response || 'No response', dateId);

    res.json({
      success: true,
      dateId,
      round: 1,
      roundName: promptA.roundName,
      agentA: { username: match.agent_a, response: responseA?.response },
      agentB: { username: match.agent_b, response: responseB?.response }
    });
  } catch (err) {
    // Store what we have even if one fails
    db.prepare(`UPDATE dates SET status = 'error' WHERE id = ?`).run(dateId);
    res.status(500).json({ error: `Date orchestration failed: ${err.message}`, dateId });
  }
});

// Continue a date (next round)
app.post('/api/dates/continue', async (req, res) => {
  const { match_id, round } = req.body;

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  // Get previous round responses
  const prevDate = db.prepare('SELECT * FROM dates WHERE match_id = ? AND round = ?').get(match_id, round - 1);
  if (!prevDate) return res.status(400).json({ error: 'Previous round not found' });

  const profileA = db.prepare('SELECT * FROM profiles WHERE agent_username = ?').get(match.agent_a);
  const profileB = db.prepare('SELECT * FROM profiles WHERE agent_username = ?').get(match.agent_b);

  // Generate next round prompts with previous responses
  const promptA = getDatePrompt(match.match_type, round, match.agent_b, profileB.archetype, prevDate.agent_b_response);
  const promptB = getDatePrompt(match.match_type, round, match.agent_a, profileA.archetype, prevDate.agent_a_response);

  const dateResult = db.prepare(`INSERT INTO dates (match_id, round, prompt, status) VALUES (?, ?, ?, 'in_progress')`)
    .run(match_id, round, JSON.stringify({ a: promptA.prompt, b: promptB.prompt }));

  const dateId = dateResult.lastInsertRowid;

  try {
    const [responseA, responseB] = await Promise.all([
      requestAgentAction(match.agent_a, 'reply', promptA.prompt),
      requestAgentAction(match.agent_b, 'reply', promptB.prompt)
    ]);

    db.prepare(`UPDATE dates SET agent_a_response = ?, agent_b_response = ?, status = 'completed' WHERE id = ?`)
      .run(responseA?.response || 'No response', responseB?.response || 'No response', dateId);

    res.json({
      success: true,
      dateId,
      round,
      roundName: promptA.roundName,
      agentA: { username: match.agent_a, response: responseA?.response },
      agentB: { username: match.agent_b, response: responseB?.response }
    });
  } catch (err) {
    db.prepare(`UPDATE dates SET status = 'error' WHERE id = ?`).run(dateId);
    res.status(500).json({ error: err.message, dateId });
  }
});

// Get date history for a match
app.get('/api/dates/:matchId', (req, res) => {
  const dates = db.prepare('SELECT * FROM dates WHERE match_id = ? ORDER BY round').all(req.params.matchId);
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.matchId);
  res.json({ match, dates });
});

// ============================================================
// HELPER: Request agent action via Join39
// ============================================================

async function requestAgentAction(agentUsername, actionType, context) {
  try {
    const response = await fetch(JOIN39_ACTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experienceId: EXPERIENCE_ID,
        agentUsername,
        actionType,
        context,
        apiKey: EXPERIENCE_API_KEY
      })
    });
    return await response.json();
  } catch (err) {
    console.error(`Failed to get action from ${agentUsername}:`, err.message);
    return { response: '[Agent did not respond]', error: err.message };
  }
}

// ============================================================
// PUBLIC API ENDPOINTS
// ============================================================

// List all agents (public profiles only)
app.get('/api/agents', (req, res) => {
  const agents = db.prepare(`
    SELECT a.username, a.agent_name, a.status, p.archetype, p.bio, p.match_types, p.profile_complete
    FROM agents a
    LEFT JOIN profiles p ON a.username = p.agent_username
    WHERE a.status = 'registered'
    ORDER BY p.profile_complete DESC, a.created_at DESC
  `).all();

  res.json(agents);
});

// List all matches (public leaderboard)
app.get('/api/leaderboard', (req, res) => {
  const matches = db.prepare(`
    SELECT m.*, a1.agent_name as name_a, a2.agent_name as name_b,
           p1.archetype as archetype_a, p2.archetype as archetype_b
    FROM matches m
    JOIN agents a1 ON m.agent_a = a1.username
    JOIN agents a2 ON m.agent_b = a2.username
    LEFT JOIN profiles p1 ON m.agent_a = p1.agent_username
    LEFT JOIN profiles p2 ON m.agent_b = p2.agent_username
    ORDER BY m.compatibility_score DESC
    LIMIT 20
  `).all();

  res.json(matches);
});

// Archetypes reference
app.get('/api/archetypes', (req, res) => {
  res.json(ARCHETYPES.map(a => ({
    name: a.name,
    description: a.description,
    idealMatches: a.idealMatches
  })));
});

// Stats
app.get('/api/stats', (req, res) => {
  const totalAgents = db.prepare('SELECT COUNT(*) as count FROM agents WHERE status = ?').get('registered')?.count || 0;
  const completedProfiles = db.prepare('SELECT COUNT(*) as count FROM profiles WHERE profile_complete = 1').get()?.count || 0;
  const totalMatches = db.prepare('SELECT COUNT(*) as count FROM matches').get()?.count || 0;
  const totalDates = db.prepare('SELECT COUNT(*) as count FROM dates WHERE status = ?').get('completed')?.count || 0;

  res.json({ totalAgents, completedProfiles, totalMatches, totalDates });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'mesh', version: '1.0.0' });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Mesh is live on port ${PORT}`);
});
