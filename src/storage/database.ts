export interface Repository {
  id: string;
  github_url: string;
  name: string;
  created_at: string;
}

export interface Commit {
  id: string;
  repo_id: string;
  sha: string;
  message: string;
  author: string;
  date: string;
  created_at: string;
}

export interface Tutorial {
  id: string;
  commit_id: string;
  title: string;
  description: string;
  created_at: string;
}

export interface LearnerSession {
  id: string;
  tutorial_id: string;
  current_step: number;
  started_at: string;
  completed_at: string | null;
}

export class DatabaseService {
  constructor(private db: D1Database) {}

  async initializeTables(): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        github_url TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS commits (
        id TEXT PRIMARY KEY,
        repo_id TEXT REFERENCES repositories(id),
        sha TEXT NOT NULL,
        message TEXT,
        author TEXT,
        date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS tutorials (
        id TEXT PRIMARY KEY,
        commit_id TEXT REFERENCES commits(id),
        title TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS learner_sessions (
        id TEXT PRIMARY KEY,
        tutorial_id TEXT REFERENCES tutorials(id),
        current_step INTEGER DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_commits_repo_id ON commits(repo_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tutorials_commit_id ON tutorials(commit_id)`
    ];

    for (const statement of statements) {
      await this.db.prepare(statement).run();
    }
  }

  async createRepository(repo: Omit<Repository, 'created_at'>): Promise<Repository> {
    const result = await this.db
      .prepare(`
        INSERT INTO repositories (id, github_url, name)
        VALUES (?, ?, ?)
        RETURNING *
      `)
      .bind(repo.id, repo.github_url, repo.name)
      .first<Repository>();
    
    if (!result) throw new Error('Failed to create repository');
    return result;
  }

  async getRepository(id: string): Promise<Repository | null> {
    return await this.db
      .prepare('SELECT * FROM repositories WHERE id = ?')
      .bind(id)
      .first<Repository>();
  }

  async getRepositoryByUrl(github_url: string): Promise<Repository | null> {
    return await this.db
      .prepare('SELECT * FROM repositories WHERE github_url = ?')
      .bind(github_url)
      .first<Repository>();
  }

  async listRepositories(): Promise<Repository[]> {
    const result = await this.db
      .prepare('SELECT * FROM repositories ORDER BY created_at DESC')
      .all<Repository>();
    return result.results;
  }

  async createCommit(commit: Omit<Commit, 'created_at'>): Promise<Commit> {
    const result = await this.db
      .prepare(`
        INSERT INTO commits (id, repo_id, sha, message, author, date)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *
      `)
      .bind(commit.id, commit.repo_id, commit.sha, commit.message, commit.author, commit.date)
      .first<Commit>();
    
    if (!result) throw new Error('Failed to create commit');
    return result;
  }

  async getCommitsByRepo(repo_id: string, limit = 50): Promise<Commit[]> {
    const result = await this.db
      .prepare('SELECT * FROM commits WHERE repo_id = ? ORDER BY date DESC LIMIT ?')
      .bind(repo_id, limit)
      .all<Commit>();
    return result.results;
  }

  async createTutorial(tutorial: Omit<Tutorial, 'created_at'>): Promise<Tutorial> {
    const result = await this.db
      .prepare(`
        INSERT INTO tutorials (id, commit_id, title, description)
        VALUES (?, ?, ?, ?)
        RETURNING *
      `)
      .bind(tutorial.id, tutorial.commit_id, tutorial.title, tutorial.description)
      .first<Tutorial>();
    
    if (!result) throw new Error('Failed to create tutorial');
    return result;
  }

  async getTutorial(id: string): Promise<Tutorial | null> {
    return await this.db
      .prepare('SELECT * FROM tutorials WHERE id = ?')
      .bind(id)
      .first<Tutorial>();
  }

  async getTutorialsByRepo(repo_id: string): Promise<Tutorial[]> {
    const result = await this.db
      .prepare(`
        SELECT t.* FROM tutorials t
        JOIN commits c ON t.commit_id = c.id
        WHERE c.repo_id = ?
        ORDER BY t.created_at DESC
      `)
      .bind(repo_id)
      .all<Tutorial>();
    return result.results;
  }

  async createSession(session: Omit<LearnerSession, 'started_at'>): Promise<LearnerSession> {
    const result = await this.db
      .prepare(`
        INSERT INTO learner_sessions (id, tutorial_id, current_step, completed_at)
        VALUES (?, ?, ?, ?)
        RETURNING *
      `)
      .bind(session.id, session.tutorial_id, session.current_step, session.completed_at)
      .first<LearnerSession>();
    
    if (!result) throw new Error('Failed to create session');
    return result;
  }

  async getSession(id: string): Promise<LearnerSession | null> {
    return await this.db
      .prepare('SELECT * FROM learner_sessions WHERE id = ?')
      .bind(id)
      .first<LearnerSession>();
  }

  async updateSessionProgress(id: string, current_step: number): Promise<void> {
    await this.db
      .prepare('UPDATE learner_sessions SET current_step = ? WHERE id = ?')
      .bind(current_step, id)
      .run();
  }

  async completeSession(id: string): Promise<void> {
    await this.db
      .prepare('UPDATE learner_sessions SET completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(id)
      .run();
  }
}
