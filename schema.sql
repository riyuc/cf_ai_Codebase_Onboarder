-- Database schema for Codebase Onboarder
-- Run with: npx wrangler d1 execute cf-ai --file=./schema.sql

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  github_url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Commits table
CREATE TABLE IF NOT EXISTS commits (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT NOT NULL,
  date DATETIME NOT NULL,
  is_learning_worthy BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);

-- Tutorials table
CREATE TABLE IF NOT EXISTS tutorials (
  id TEXT PRIMARY KEY,
  commit_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE
);

-- Learner sessions table
CREATE TABLE IF NOT EXISTS learner_sessions (
  id TEXT PRIMARY KEY,
  tutorial_id TEXT NOT NULL,
  current_step INTEGER DEFAULT 0,
  completed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_commits_repo_id ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_learning_worthy ON commits(is_learning_worthy);
CREATE INDEX IF NOT EXISTS idx_tutorials_commit_id ON tutorials(commit_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tutorial_id ON learner_sessions(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_sessions_completed ON learner_sessions(completed_at);
