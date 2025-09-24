
export interface AnalysisStatus {
  repo_id: string;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  error_message?: string;
  started_at: string;
  updated_at: string;
}

export interface SessionState {
  session_id: string;
  tutorial_id: string;
  current_step: number;
  last_activity: string;
}

export class KVService {
  constructor(private kv: KVNamespace) {}

  async setAnalysisStatus(repo_id: string, status: AnalysisStatus): Promise<void> {
    const key = `analysis:${repo_id}`;
    await this.kv.put(key, JSON.stringify(status), {
      expirationTtl: 60 * 60 * 24 // 24 hours
    });
  }

  async getAnalysisStatus(repo_id: string): Promise<AnalysisStatus | null> {
    const key = `analysis:${repo_id}`;
    const data = await this.kv.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteAnalysisStatus(repo_id: string): Promise<void> {
    const key = `analysis:${repo_id}`;
    await this.kv.delete(key);
  }

  async setSessionState(session_id: string, state: SessionState): Promise<void> {
    const key = `session:${session_id}`;
    await this.kv.put(key, JSON.stringify(state), {
      expirationTtl: 60 * 60 * 8 // 8 hours
    });
  }

  async getSessionState(session_id: string): Promise<SessionState | null> {
    const key = `session:${session_id}`;
    const data = await this.kv.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteSessionState(session_id: string): Promise<void> {
    const key = `session:${session_id}`;
    await this.kv.delete(key);
  }

  async cacheTutorialContent(tutorial_id: string, content: any): Promise<void> {
    const key = `tutorial:${tutorial_id}`;
    await this.kv.put(key, JSON.stringify(content), {
      expirationTtl: 60 * 60 * 24 * 7 // 7 days
    });
  }

  async getCachedTutorialContent(tutorial_id: string): Promise<any | null> {
    const key = `tutorial:${tutorial_id}`;
    const data = await this.kv.get(key);
    return data ? JSON.parse(data) : null;
  }

  async cacheRepoMetadata(repo_id: string, metadata: any): Promise<void> {
    const key = `repo:meta:${repo_id}`;
    await this.kv.put(key, JSON.stringify(metadata), {
      expirationTtl: 60 * 60 * 6 // 6 hours
    });
  }

  async getCachedRepoMetadata(repo_id: string): Promise<any | null> {
    const key = `repo:meta:${repo_id}`;
    const data = await this.kv.get(key);
    return data ? JSON.parse(data) : null;
  }

  async incrementRateLimit(key: string, windowSeconds = 3600): Promise<number> {
    const rateLimitKey = `rate:${key}`;
    const current = await this.kv.get(rateLimitKey);
    const count = current ? parseInt(current) + 1 : 1;
    
    await this.kv.put(rateLimitKey, count.toString(), {
      expirationTtl: windowSeconds
    });
    
    return count;
  }

  async getRateLimit(key: string): Promise<number> {
    const rateLimitKey = `rate:${key}`;
    const current = await this.kv.get(rateLimitKey);
    return current ? parseInt(current) : 0;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const options: KVNamespacePutOptions = {};
    if (ttlSeconds) {
      options.expirationTtl = ttlSeconds;
    }
    await this.kv.put(key, JSON.stringify(value), options);
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.kv.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    const options: KVNamespaceListOptions = {};
    if (prefix) {
      options.prefix = prefix;
    }
    
    const list = await this.kv.list(options);
    return list.keys.map(key => key.name);
  }
}
