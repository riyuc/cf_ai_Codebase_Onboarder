
import { DatabaseService } from './database';
import { KVService } from './kv';
import { R2Service } from './r2';
import { VectorizeService } from './vectorize';

export interface StorageEnv {
  cf_ai: D1Database; // D1 database binding
  STATUS_KV: KVNamespace; // KV namespace binding
  cf_ai_repo_snapshots: R2Bucket; // R2 bucket binding
  VECTORIZE: VectorizeIndex; // Vectorize index binding
}

export class StorageService {
  public readonly database: DatabaseService;
  public readonly kv: KVService;
  public readonly r2: R2Service;
  public readonly vectorize: VectorizeService;

  constructor(env: StorageEnv) {
    this.database = new DatabaseService(env.cf_ai);
    this.kv = new KVService(env.STATUS_KV);
    this.r2 = new R2Service(env.cf_ai_repo_snapshots);
    this.vectorize = new VectorizeService(env.VECTORIZE);
  }

  async initialize(): Promise<void> {
    await this.database.initializeTables();
  }

  async healthCheck(): Promise<{
    database: boolean;
    kv: boolean;
    r2: boolean;
    vectorize: boolean;
  }> {
    const results = {
      database: false,
      kv: false,
      r2: false,
      vectorize: false
    };

    try {
      await this.database.listRepositories();
      results.database = true;
    } catch (e) {
      console.error('Database health check failed:', e);
    }

    try {
      await this.kv.set('health-check', 'ok', 60);
      const value = await this.kv.get('health-check');
      results.kv = value === 'ok';
      await this.kv.delete('health-check');
    } catch (e) {
      console.error('KV health check failed:', e);
    }

    try {
      await this.r2.put('health-check', 'ok');
      const object = await this.r2.get('health-check');
      results.r2 = object !== null;
      await this.r2.delete('health-check');
    } catch (e) {
      console.error('R2 health check failed:', e);
    }

    try {
      await this.vectorize.getIndexStats();
      results.vectorize = true;
    } catch (e) {
      console.error('Vectorize health check failed:', e);
    }

    return results;
  }

  async cleanupRepositoryData(repoId: string): Promise<void> {
    try {
      await this.r2.deleteRepoData(repoId);
      
      await this.vectorize.deleteCommitEmbeddings(repoId);
      
      await this.kv.deleteAnalysisStatus(repoId);
      
    } catch (e) {
      console.error(`Failed to cleanup repository data for ${repoId}:`, e);
      throw e;
    }
  }

  async cleanupTutorialData(tutorialId: string): Promise<void> {
    try {
      await this.r2.deleteTutorialData(tutorialId);
      
      await this.vectorize.deleteTutorialEmbedding(tutorialId);
      
      await this.kv.delete(`tutorial:${tutorialId}`);
      
    } catch (e) {
      console.error(`Failed to cleanup tutorial data for ${tutorialId}:`, e);
      throw e;
    }
  }

  async cleanupSessionData(sessionId: string): Promise<void> {
    try {
      await this.r2.deleteSessionData(sessionId);
      
      await this.kv.deleteSessionState(sessionId);
      
    } catch (e) {
      console.error(`Failed to cleanup session data for ${sessionId}:`, e);
      throw e;
    }
  }
}

export * from './database';
export * from './kv';
export * from './r2';
export * from './vectorize';

export function createStorageService(env: StorageEnv): StorageService {
  return new StorageService(env);
}
