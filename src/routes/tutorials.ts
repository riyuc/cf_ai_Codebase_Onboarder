import { TutorialService } from '../tutorial';
import { GitHubService } from '../github';
import { createStorageService } from '../storage';
import type { StorageEnv } from '../storage';

export async function handleGetFileContent(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as {
      owner: string;
      repo: string;
      path: string;
      ref: string;
    };

    if (!body.owner || !body.repo || !body.path || !body.ref) {
      return Response.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    const github = new GitHubService();
    const content = await github.getFileContent(body.owner, body.repo, body.path, body.ref);

    return Response.json({
      success: true,
      content
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleGetTutorials(request: Request, env: StorageEnv): Promise<Response> {
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
    const github = new GitHubService();
    const tutorialService = new TutorialService(github, storage);

    const tutorials = await tutorialService.getRepositoryTutorials(repoId);

    return Response.json({
      success: true,
      tutorials: tutorials.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        created_at: t.created_at
      }))
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleCreateTutorial(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as { commitId?: string };
    const { commitId } = body;

    if (!commitId) {
      return Response.json({
        success: false,
        error: 'Missing commitId in request body'
      }, { status: 400 });
    }

    const storage = createStorageService(env);
    const github = new GitHubService();
    const tutorialService = new TutorialService(github, storage);

    const result = await tutorialService.createTutorial(commitId);

    return Response.json({
      success: true,
      tutorial: {
        id: result.tutorial.id,
        title: result.tutorial.title,
        description: result.tutorial.description,
        steps: result.content.steps.length,
        created_at: result.tutorial.created_at
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleGetTutorial(request: Request, env: StorageEnv): Promise<Response> {
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
    const tutorialService = new TutorialService(github, storage);

    const { tutorial, content } = await tutorialService.getTutorial(tutorialId);

    return Response.json({
      success: true,
      tutorial: {
        id: tutorial.id,
        title: tutorial.title,
        description: tutorial.description,
        created_at: tutorial.created_at,
        steps: content.steps.map((step, index) => ({
          id: step.id,
          step_number: index + 1,
          title: step.title,
          description: step.description,
          instructions: step.instructions
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

export async function handleStartSession(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as { tutorialId?: string };
    const { tutorialId } = body;

    if (!tutorialId) {
      return Response.json({
        success: false,
        error: 'Missing tutorialId in request body'
      }, { status: 400 });
    }

    const storage = createStorageService(env);
    const github = new GitHubService();
    const tutorialService = new TutorialService(github, storage);

    const session = await tutorialService.startSession(tutorialId);

    return Response.json({
      success: true,
      session: {
        id: session.session.id,
        tutorial_id: session.tutorial.id,
        tutorial_title: session.tutorial.title,
        current_step: session.session.current_step,
        total_steps: session.content.steps.length,
        completed: !!session.session.completed_at,
        current_step_content: session.currentStepContent
      },
      fileTree: session.fileTree,
      parentSha: session.parentSha
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleSessionAction(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sessionId = url.pathname.split('/')[2]; // /sessions/{id}/action
    const body = await request.json() as { action?: string };
    const { action } = body; // 'next', 'previous', 'complete'

    if (!sessionId || !action) {
      return Response.json({
        success: false,
        error: 'Missing sessionId or action'
      }, { status: 400 });
    }

    const storage = createStorageService(env);
    const github = new GitHubService();
    const tutorialService = new TutorialService(github, storage);

    let session;
    
    switch (action) {
      case 'next':
        session = await tutorialService.nextStep(sessionId);
        break;
      case 'previous':
        session = await tutorialService.previousStep(sessionId);
        break;
      case 'complete':
        await tutorialService.completeSession(sessionId);
        session = await tutorialService.getSession(sessionId);
        break;
      default:
        return Response.json({
          success: false,
          error: 'Invalid action. Use: next, previous, or complete'
        }, { status: 400 });
    }

    return Response.json({
      success: true,
      session: {
        id: session.session.id,
        tutorial_id: session.tutorial.id,
        tutorial_title: session.tutorial.title,
        current_step: session.session.current_step,
        total_steps: session.content.steps.length,
        completed: !!session.session.completed_at,
        current_step_content: session.currentStepContent
      },
      fileTree: session.fileTree,
      parentSha: session.parentSha
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleGenerateTutorials(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as { repoId?: string; limit?: number };
    const { repoId, limit = 3 } = body;

    if (!repoId) {
      return Response.json({
        success: false,
        error: 'Missing repoId in request body'
      }, { status: 400 });
    }

    const storage = createStorageService(env);
    const github = new GitHubService();
    const tutorialService = new TutorialService(github, storage);

    const tutorials = await tutorialService.generateRepositoryTutorials(repoId, limit);

    return Response.json({
      success: true,
      generated: tutorials.length,
      tutorials: tutorials.map(t => ({
        id: t.tutorial.id,
        title: t.tutorial.title,
        description: t.tutorial.description,
        steps: t.content.steps.length,
        created_at: t.tutorial.created_at
      }))
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
