/**
 * Debug endpoints to troubleshoot issues
 */

import { createStorageService } from '../storage';
import type { StorageEnv } from '../storage';

export async function handleDebugRepos(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const storage = createStorageService(env);
    
    // List all repositories in database
    const repositories = await storage.database.listRepositories();
    
    return Response.json({
      success: true,
      repositories: repositories.map(repo => ({
        id: repo.id,
        name: repo.name,
        url: repo.github_url,
        created_at: repo.created_at
      }))
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleDebugCommits(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const repoId = url.searchParams.get('repo');
    
    if (!repoId) {
      return Response.json({
        success: false,
        error: 'Missing repo parameter'
      }, { status: 400 });
    }

    const storage = createStorageService(env);
    const commits = await storage.database.getCommitsByRepo(repoId, 20);
    
    return Response.json({
      success: true,
      repo_id: repoId,
      commits: commits.map(commit => ({
        id: commit.id,
        sha: commit.sha.substring(0, 8),
        message: commit.message.substring(0, 100) + (commit.message.length > 100 ? '...' : ''),
        author: commit.author,
        date: commit.date
      }))
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleDebugClearRepo(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const repoId = url.searchParams.get('repo');
    
    if (!repoId) {
      return Response.json({
        success: false,
        error: 'Missing repo parameter'
      }, { status: 400 });
    }

    const storage = createStorageService(env);
    
    // This is a debug function - in production you wouldn't delete data like this
    // For now, we'll just clear KV status to allow re-ingestion
    await storage.kv.deleteAnalysisStatus(repoId);
    
    return Response.json({
      success: true,
      message: `Cleared analysis status for ${repoId}. Repository can be re-ingested.`
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
