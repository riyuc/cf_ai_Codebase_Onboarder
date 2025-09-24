import { GitHubClient } from './client';
import { CommitAnalyzer } from './analyzer';
import type { StorageService } from '../storage';
import type { GitHubCommit } from './types';
import type { Repository, Commit } from '../storage/database';

export interface RepoIngestionResult {
  repository: Repository;
  commits: Commit[];
  learningCommits: number;
  totalCommits: number;
  errors: string[];
}

export class GitHubService {
  public client: GitHubClient;
  private analyzer: CommitAnalyzer;

  constructor(githubToken?: string) {
    this.client = new GitHubClient(githubToken);
    this.analyzer = new CommitAnalyzer();
  }


  parseRepositoryUrl(url: string) {
    return this.client.parseRepositoryUrl(url);
  }


  async isRepositoryAccessible(owner: string, repo: string): Promise<boolean> {
    return await this.client.isRepositoryAccessible(owner, repo);
  }


  async getRepositoryInfo(owner: string, repo: string) {
    return await this.client.getRepositoryStats(owner, repo);
  }


  async ingestRepository(
    url: string, 
    storage: StorageService,
    options?: {
      branch?: string;
      commitLimit?: number;
    }
  ): Promise<RepoIngestionResult> {
    const result: RepoIngestionResult = {
      repository: null as any,
      commits: [],
      learningCommits: 0,
      totalCommits: 0,
      errors: []
    };

    try {

      const parsed = this.client.parseRepositoryUrl(url);
      if (!parsed.isValid) {
        throw new Error(parsed.error || 'Invalid repository URL');
      }

      const { owner, repo } = parsed;


      const existing = await storage.database.getRepositoryByUrl(url);
      if (existing) {
        throw new Error('Repository already exists in database');
      }


      const repoInfo = await this.client.getRepository(owner, repo);
      

      const repoId = `${owner}/${repo}`;
      const repository = await storage.database.createRepository({
        id: repoId,
        github_url: url,
        name: repoInfo.full_name
      });
      result.repository = repository;


      await storage.kv.setAnalysisStatus(repoId, {
        repo_id: repoId,
        status: 'analyzing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });


      const githubCommits = await this.client.getLearningCommits(owner, repo, {
        branch: options?.branch || repoInfo.default_branch,
        limit: options?.commitLimit || 50
      });

      result.totalCommits = githubCommits.length;


      const commitAnalyses = this.analyzer.analyzeCommits(githubCommits);
      
      for (let i = 0; i < githubCommits.length; i++) {
        const githubCommit = githubCommits[i];
        const analysis = commitAnalyses[i];

        try {

          const dbCommit = this.analyzer.convertToDbCommit(githubCommit, repoId);          

          const storedCommit = await storage.database.createCommit(dbCommit);
          result.commits.push(storedCommit);

          if (analysis.isLearningWorthy && githubCommit.files) {
            await storage.r2.storeCommitDiff(repoId, githubCommit.sha, {
              commit_sha: githubCommit.sha,
              files: githubCommit.files.map(file => ({
                filename: file.filename,
                status: file.status,
                additions: file.additions,
                deletions: file.deletions,
                patch: file.patch
              }))
            });
            result.learningCommits++;
          }

        } catch (error) {
          result.errors.push(`Failed to store commit ${githubCommit.sha}: ${error}`);
        }
      }

      await storage.kv.setAnalysisStatus(repoId, {
        repo_id: repoId,
        status: 'completed',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    } catch (error) {
      if (result.repository) {
        await storage.kv.setAnalysisStatus(result.repository.id, {
          repo_id: result.repository.id,
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      throw error;
    }

    return result;
  }

  async getCommitDetails(owner: string, repo: string, sha: string): Promise<GitHubCommit> {
    return await this.client.getCommit(owner, repo, sha);
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const result = await this.client.getFileContent(owner, repo, path, ref);
    return result.content;
  }

  async refreshRepository(
    repoId: string,
    storage: StorageService,
    options?: {
      branch?: string;
      commitLimit?: number;
    }
  ): Promise<{ newCommits: number; errors: string[] }> {
    const repository = await storage.database.getRepository(repoId);
    if (!repository) {
      throw new Error('Repository not found');
    }

    const parsed = this.client.parseRepositoryUrl(repository.github_url);
    if (!parsed.isValid) {
      throw new Error('Invalid repository URL in database');
    }

    const { owner, repo } = parsed;

    const existingCommits = await storage.database.getCommitsByRepo(repoId);
    const existingShas = new Set(existingCommits.map(c => c.sha));

    const githubCommits = await this.client.getLearningCommits(owner, repo, {
      branch: options?.branch,
      limit: options?.commitLimit || 20
    });

    const newCommits = githubCommits.filter(c => !existingShas.has(c.sha));
    const errors: string[] = [];

    for (const githubCommit of newCommits) {
      try {
        const dbCommit = this.analyzer.convertToDbCommit(githubCommit, repoId);
        await storage.database.createCommit(dbCommit);

        const analysis = this.analyzer.analyzeCommit(githubCommit);
        if (analysis.isLearningWorthy && githubCommit.files) {
          await storage.r2.storeCommitDiff(repoId, githubCommit.sha, {
            commit_sha: githubCommit.sha,
            files: githubCommit.files.map(file => ({
              filename: file.filename,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              patch: file.patch
            }))
          });
        }
      } catch (error) {
        errors.push(`Failed to store commit ${githubCommit.sha}: ${error}`);
      }
    }

    return {
      newCommits: newCommits.length,
      errors
    };
  }
}

export * from './types';
export * from './client';
export * from './analyzer';
