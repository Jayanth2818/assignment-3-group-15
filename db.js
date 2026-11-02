const sqlite3 = require('sqlite3').verbose();
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'sentinel.db');

// Connect to SQLite database
const db = new sqlite3.Database(DB_PATH);

// Promise-based wrappers for sqlite3
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize database schema and dummy accounts
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password TEXT,
          email TEXT,
          role TEXT
        )
      `, (err) => {
        if (err) return reject(err);

        // Insert required dummy accounts
        const insertUser = db.prepare(`
          INSERT OR IGNORE INTO users (username, password, email, role)
          VALUES (?, ?, ?, ?)
        `);

        insertUser.run('admin', 'admin123', 'admin@sentinel.test', 'Administrator');
        insertUser.run('alex', 'welcome123', 'alex@sentinel.test', 'Analyst');

        insertUser.finalize((finalizeErr) => {
          if (finalizeErr) return reject(finalizeErr);
          resolve();
        });
      });
    });
  });
}

// SQL injection detection helper (for classifying responses)
function hasSqlInjectionPatterns(input) {
  if (typeof input !== 'string') return false;
  // Detect classic SQL injection markers: quotes, comment syntax, boolean logic operators
  const patterns = [
    /'/,                // Single quote string delimiter
    /--/,               // Line comment
    /\/\*/,             // Block comment
    /\bOR\b/i,          // SQL OR boolean operator
    /\bAND\b/i,         // SQL AND boolean operator
    /\bUNION\b/i,       // SQL UNION operator
    /=\s*'|'\s*=\s*'/,  // '1'='1' or '=' comparisons
    /1\s*=\s*1/,        // 1=1 tautology
    /;\s*$/             // Query termination
  ];
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Vulnerable Authentication (Legacy Workflow)
 * Uses genuine SQL string concatenation as described in the assignment roadmap:
 * SELECT * FROM users WHERE username = 'INPUT_USER' AND password = 'INPUT_PASS';
 * 
 * NEVER displays actual passwords in query logs or result messages.
 */
async function authenticateVulnerable(username, password) {
  const safeUser = String(username || '');
  const safePass = String(password || '');

  // Genuine SQL string concatenation
  const rawQuery = `SELECT * FROM users WHERE username = '${safeUser}' AND password = '${safePass}'`;

  // Display query masks actual password for safety
  const displayQuery = `SELECT * FROM users WHERE username = '${safeUser}' AND password = '[REDACTED]'`;

  try {
    const user = await get(rawQuery);

    if (user) {
      // Determine if authentication succeeded through valid password or SQL Injection bypass
      const isActualPassword = (user.password === safePass);
      const isBypass = !isActualPassword || hasSqlInjectionPatterns(safeUser);

      if (isBypass) {
        return {
          status: 'SQL_INJECTION_BYPASS',
          title: 'SQL Injection Authentication Bypass',
          authenticated: true,
          user: { id: user.id, username: user.username, email: user.email, role: user.role },
          displayQuery,
          message: `SQL Injection Authentication Bypass: Authenticated as "${user.username}" without providing a valid password.`
        };
      } else {
        return {
          status: 'AUTH_SUCCESS',
          title: 'Authentication Successful',
          authenticated: true,
          user: { id: user.id, username: user.username, email: user.email, role: user.role },
          displayQuery,
          message: `Authentication Successful: Valid credentials verified for "${user.username}".`
        };
      }
    } else {
      return {
        status: 'AUTH_FAILED',
        title: 'Authentication Failed',
        authenticated: false,
        user: null,
        displayQuery,
        message: 'Authentication Failed: Invalid username or password.'
      };
    }
  } catch (err) {
    // SQLite syntax error (e.g., malformed injection syntax like unmatched single quote)
    return {
      status: 'SQL_ERROR',
      title: 'Database Query Error',
      authenticated: false,
      user: null,
      displayQuery,
      error: err.message,
      message: `Database syntax error: ${err.message}`
    };
  }
}

/**
 * Secure Authentication (Protected Workflow)
 * Uses parameterized queries / prepared statements:
 * SELECT * FROM users WHERE username = ? AND password = ?;
 * 
 * Input data is bound strictly as parameters, preventing query structure alteration.
 */
async function authenticateSecure(username, password) {
  const safeUser = String(username || '');
  const safePass = String(password || '');

  const queryStructure = 'SELECT * FROM users WHERE username = ? AND password = ?';
  const displayParams = `[ username: "${safeUser}", password: "[REDACTED]" ]`;

  try {
    const user = await get(queryStructure, [safeUser, safePass]);

    if (user) {
      return {
        status: 'AUTH_SUCCESS',
        title: 'Authentication Successful',
        authenticated: true,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
        queryStructure,
        displayParams,
        message: `Authentication Successful: Valid credentials verified for "${user.username}".`
      };
    } else {
      // Check if this was an injection attempt that was safely neutralized
      const injectionAttempted = hasSqlInjectionPatterns(safeUser) || hasSqlInjectionPatterns(safePass);

      if (injectionAttempted) {
        return {
          status: 'SQL_INJECTION_BLOCKED',
          title: 'SQL Injection Blocked',
          authenticated: false,
          user: null,
          queryStructure,
          displayParams,
          message: 'SQL Injection Blocked: Parameterized query treated input strictly as literal text data. Authentication failed.'
        };
      } else {
        return {
          status: 'AUTH_FAILED',
          title: 'Authentication Failed',
          authenticated: false,
          user: null,
          queryStructure,
          displayParams,
          message: 'Authentication Failed: Invalid username or password.'
        };
      }
    }
  } catch (err) {
    return {
      status: 'SQL_ERROR',
      title: 'Database Query Error',
      authenticated: false,
      user: null,
      queryStructure,
      displayParams,
      error: err.message,
      message: `Database error: ${err.message}`
    };
  }
}

// Fetch all users (for compatibility with other workspace modules)
async function getAllUsers() {
  try {
    return await all('SELECT id, username, password, email, role FROM users ORDER BY id ASC');
  } catch (err) {
    return [];
  }
}

module.exports = {
  db,
  initDatabase,
  authenticateVulnerable,
  authenticateSecure,
  getAllUsers,
  hasSqlInjectionPatterns
};
