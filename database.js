const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'mesh.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// --- Create Tables ---
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    agent_name TEXT,
    agent_facts_url TEXT,
    callback_url TEXT,
    mode TEXT DEFAULT 'autonomous',
    anonymous INTEGER DEFAULT 0,
    frequency TEXT DEFAULT 'on_trigger',
    status TEXT DEFAULT 'registered',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_username TEXT UNIQUE NOT NULL,
    communication_style TEXT,
    values_priorities TEXT,
    humor_style TEXT,
    interests TEXT,
    energy_level TEXT,
    conflict_style TEXT,
    attachment_style TEXT,
    work_style TEXT,
    expertise TEXT,
    dealbreakers TEXT,
    looking_for TEXT,
    match_types TEXT DEFAULT 'romance,work,friendship',
    bio TEXT,
    archetype TEXT,
    profile_complete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_username) REFERENCES agents(username)
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_a TEXT NOT NULL,
    agent_b TEXT NOT NULL,
    match_type TEXT NOT NULL,
    compatibility_score REAL,
    compatibility_breakdown TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_a) REFERENCES agents(username),
    FOREIGN KEY (agent_b) REFERENCES agents(username)
  );

  CREATE TABLE IF NOT EXISTS dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    round INTEGER DEFAULT 1,
    prompt TEXT,
    agent_a_response TEXT,
    agent_b_response TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id)
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    rater_username TEXT NOT NULL,
    chemistry_score INTEGER,
    would_meet_again INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id)
  );
`);

module.exports = db;
