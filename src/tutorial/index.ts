/**
 * Tutorial service that combines generation and session management
 */

import { TutorialGenerator } from './generator';
import type { GitHubService } from '../github';
import type { StorageService } from '../storage';
import type { LearnerSession } from '../storage/database';
import { generateId } from 'ai';

export interface TutorialSession {
  session: LearnerSession;
  tutorial: any;
  content: any;
  currentStepContent?: any;
  fileTree?: any[];
  parentSha?: string;
}

export class TutorialService {
  private generator: TutorialGenerator;

  constructor(
    github: GitHubService,
    storage: StorageService,
    aiModel?: any
  ) {
    this.generator = new TutorialGenerator(github, storage, aiModel);
  }

  /**
   * Create a tutorial from a commit
   */
  async createTutorial(commitId: string) {
    return await this.generator.generateTutorial(commitId);
  }

  /**
   * Get all tutorials for a repository
   */
  async getRepositoryTutorials(repoId: string) {
    return await this.generator.getTutorialsByRepo(repoId);
  }

  /**
   * Get tutorial details with content
   */
  async getTutorial(tutorialId: string) {
    return await this.generator.getTutorialWithContent(tutorialId);
  }

  /**
   * Start a new learning session
   */
  async startSession(tutorialId: string): Promise<TutorialSession> {
    // Get tutorial with content
    const { tutorial, content } = await this.getTutorial(tutorialId);

    // Create new session
    const sessionId = generateId();
    const session = await this.generator.storage.database.createSession({
      id: sessionId,
      tutorial_id: tutorialId,
      current_step: 0,
      completed_at: null
    });

    // Get first step content
    const currentStepContent = content.steps[0] || null;

    return {
      session,
      tutorial,
      content,
      currentStepContent,
      fileTree: content.fileTree || [],
      parentSha: content.parentSha
    };
  }

  /**
   * Get current session state
   */
  async getSession(sessionId: string): Promise<TutorialSession> {
    const session = await this.generator.storage.database.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { tutorial, content } = await this.getTutorial(session.tutorial_id);
    const currentStepContent = content.steps[session.current_step] || null;

    return {
      session,
      tutorial,
      content,
      currentStepContent,
      fileTree: content.fileTree || [],
      parentSha: content.parentSha
    };
  }

  /**
   * Advance to next step
   */
  async nextStep(sessionId: string): Promise<TutorialSession> {
    const session = await this.generator.storage.database.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { content } = await this.getTutorial(session.tutorial_id);
    
    // Check if we can advance
    if (session.current_step >= content.steps.length - 1) {
      // Complete the session
      await this.generator.storage.database.completeSession(sessionId);
      return await this.getSession(sessionId);
    }

    // Advance to next step
    const nextStep = session.current_step + 1;
    await this.generator.storage.database.updateSessionProgress(sessionId, nextStep);

    return await this.getSession(sessionId);
  }

  /**
   * Go back to previous step
   */
  async previousStep(sessionId: string): Promise<TutorialSession> {
    const session = await this.generator.storage.database.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if we can go back
    if (session.current_step <= 0) {
      return await this.getSession(sessionId);
    }

    // Go back to previous step
    const prevStep = session.current_step - 1;
    await this.generator.storage.database.updateSessionProgress(sessionId, prevStep);

    return await this.getSession(sessionId);
  }

  /**
   * Complete the tutorial session
   */
  async completeSession(sessionId: string): Promise<void> {
    await this.generator.storage.database.completeSession(sessionId);
  }

  /**
   * Generate tutorials for multiple commits in a repo
   */
  async generateRepositoryTutorials(repoId: string, limit = 3) {
    return await this.generator.generateTutorialsForRepo(repoId, limit);
  }
}

// Re-export for convenience
export * from './generator';
export { TutorialGenerator };
