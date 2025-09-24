import { GitHubService } from '../github';
import { createStorageService } from '../storage';
import type { StorageEnv } from '../storage';

export async function handleTestIngest(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const storage = createStorageService(env);
    await storage.initialize();

    const url = new URL(request.url);
    const repoUrl = url.searchParams.get('repo') || 'https://github.com/octocat/Hello-World';
    const commitLimit = parseInt(url.searchParams.get('limit') || '5');

    const github = new GitHubService();

    const parsed = github.parseRepositoryUrl(repoUrl);
    if (!parsed.isValid) {
      return Response.json({
        success: false,
        error: `Invalid repo URL: ${parsed.error}`
      }, { status: 400 });
    }

    const isAccessible = await github.isRepositoryAccessible(parsed.owner, parsed.repo);
    if (!isAccessible) {
      return Response.json({
        success: false,
        error: 'Repository is not accessible (may be private or not exist)'
      }, { status: 400 });
    }

    const repoInfo = await github.getRepositoryInfo(parsed.owner, parsed.repo);

    const healthCheck = await storage.healthCheck();

    let ingestionResult = null;
    let ingestionError = null;

    try {
      ingestionResult = await github.ingestRepository(repoUrl, storage, {
        commitLimit
      });
    } catch (error) {
      ingestionError = error instanceof Error ? error.message : 'Unknown error';
    }

    return Response.json({
      success: true,
      test_results: {
        parsed_url: parsed,
        repo_accessible: isAccessible,
        repo_info: repoInfo,
        storage_health: healthCheck,
        ingestion: {
          success: ingestionResult !== null,
          error: ingestionError,
          result: ingestionResult ? {
            repository: ingestionResult.repository.name,
            total_commits: ingestionResult.totalCommits,
            learning_commits: ingestionResult.learningCommits,
            errors: ingestionResult.errors
          } : null
        }
      }
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleTestTutorials(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const storage = createStorageService(env);
    
    const url = new URL(request.url);
    const repoId = url.searchParams.get('repo') || 'sindresorhus/is';

    const commits = await storage.database.getCommitsByRepo(repoId, 2);
    
    if (commits.length === 0) {
      return Response.json({
        success: false,
        error: 'No commits found for this repository. Run /test/ingest first.'
      });
    }

    const { TutorialService } = await import('../tutorial');
    const { GitHubService } = await import('../github');
    
    const github = new GitHubService();
    const tutorialService = new TutorialService(github, storage);

    const tutorial = await tutorialService.createTutorial(commits[0].id);

    return Response.json({
      success: true,
      commit: {
        sha: commits[0].sha.substring(0, 8),
        message: commits[0].message.substring(0, 60) + '...'
      },
      tutorial: {
        id: tutorial.tutorial.id,
        title: tutorial.tutorial.title,
        description: tutorial.tutorial.description,
        steps_count: tutorial.content.steps.length,
        steps: tutorial.content.steps.map((step, i) => ({
          step: i + 1,
          title: step.title,
          description: step.description
        }))
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleTestStatus(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const storage = createStorageService(env);
    
    const url = new URL(request.url);
    const repoId = url.searchParams.get('repo');
    
    if (!repoId) {
      return Response.json({
        success: false,
        error: 'Missing repo parameter'
      }, { status: 400 });
    }

    const status = await storage.kv.getAnalysisStatus(repoId);
    
    const repository = await storage.database.getRepository(repoId);
    
    const commits = await storage.database.getCommitsByRepo(repoId, 10);

    return Response.json({
      success: true,
      repository,
      analysis_status: status,
      recent_commits: commits.map(c => ({
        sha: c.sha.substring(0, 8),
        message: c.message.substring(0, 60) + (c.message.length > 60 ? '...' : ''),
        author: c.author,
        date: c.date
      }))
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
