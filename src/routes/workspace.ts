/**
 * Workspace API endpoints for repository cloning and management
 */

import { RepoCloner } from '../workspace/cloner';
import { GitHubService } from '../github';
import { createStorageService } from '../storage';
import type { StorageEnv } from '../storage';

export async function handleGetWorkspace(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const tutorialId = url.pathname.split('/').pop();

    if (!tutorialId) {
      return Response.json({
        success: false,
        error: 'Missing tutorial ID'
      }, { status: 400 });
    }

    const storage = createStorageService(env);
    const github = new GitHubService();
    const cloner = new RepoCloner(github, storage);

    // Check if we have a cached workspace
    let workspace = await cloner.getCachedSnapshot(tutorialId);

    if (!workspace) {
      // Get tutorial to find the repository info
      const tutorial = await storage.database.getTutorial(tutorialId);
      if (!tutorial) {
        return Response.json({
          success: false,
          error: 'Tutorial not found'
        }, { status: 404 });
      }

      // Get the commit to find the parent SHA
      const commits = await storage.database.getCommitsByRepo(tutorial.commit_id.split(':')[0]);
      const targetCommit = commits.find(c => c.id === tutorial.commit_id);
      
      if (!targetCommit) {
        return Response.json({
          success: false,
          error: 'Commit not found'
        }, { status: 404 });
      }

      // Get repository info to parse owner/repo
      const repository = await storage.database.getRepository(targetCommit.repo_id);
      if (!repository) {
        return Response.json({
          success: false,
          error: 'Repository not found'
        }, { status: 404 });
      }

      const parsed = github.parseRepositoryUrl(repository.github_url);
      if (!parsed.isValid) {
        return Response.json({
          success: false,
          error: 'Invalid repository URL'
        }, { status: 400 });
      }

      // Get the parent commit SHA
      const fullCommit = await github.getCommitDetails(parsed.owner, parsed.repo, targetCommit.sha);
      const parentSha = fullCommit.parents?.[0]?.sha;
      
      if (!parentSha) {
        return Response.json({
          success: false,
          error: 'No parent commit found'
        }, { status: 400 });
      }

      // Clone the repository at the parent commit
      workspace = await cloner.cloneRepository(
        parsed.owner,
        parsed.repo,
        parentSha,
        tutorialId
      );
    }

    return Response.json({
      success: true,
      workspace: {
        id: workspace.id,
        files: workspace.files,
        totalFiles: workspace.totalFiles,
        created_at: workspace.created_at
      }
    });

  } catch (error) {
    console.error('Workspace creation error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleCreateWorkspace(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as {
      tutorialId: string;
      owner: string;
      repo: string;
      commitSha: string;
    };

    if (!body.tutorialId || !body.owner || !body.repo || !body.commitSha) {
      return Response.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    const storage = createStorageService(env);
    const github = new GitHubService();
    const cloner = new RepoCloner(github, storage);

    const workspace = await cloner.cloneRepository(
      body.owner,
      body.repo,
      body.commitSha,
      body.tutorialId
    );

    return Response.json({
      success: true,
      workspace: {
        id: workspace.id,
        files: workspace.files,
        totalFiles: workspace.totalFiles,
        created_at: workspace.created_at
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
