/**
 * Tutorial generation engine - converts commits into learning tutorials
 */

import type { GitHubService } from '../github';
import type { StorageService } from '../storage';
import type { Tutorial } from '../storage/database';
import type { TutorialContent } from '../storage/r2';
import type { AIService } from '../ai/service';
import { generateId } from 'ai';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  instructions: string;
}

export interface GeneratedTutorial {
  tutorial: Tutorial;
  content: TutorialContent;
}

export class TutorialGenerator {
  constructor(
    private github: GitHubService,
    public storage: StorageService,
    private aiService: AIService
  ) {}

  /**
   * Generate a tutorial from a commit
   */
  async generateTutorial(commitId: string): Promise<GeneratedTutorial> {
    // Get commit from database
    const commit = await this.storage.database.getCommitsByRepo(commitId.split(':')[0]);
    const targetCommit = commit.find(c => c.id === commitId);
    
    if (!targetCommit) {
      throw new Error('Commit not found');
    }

    // Get repository info
    const repository = await this.storage.database.getRepository(targetCommit.repo_id);
    if (!repository) {
      throw new Error('Repository not found');
    }

    // Parse repo URL to get owner/repo
    const parsed = this.github.parseRepositoryUrl(repository.github_url);
    if (!parsed.isValid) {
      throw new Error('Invalid repository URL');
    }

    // Get full commit details from GitHub, including parent
    const fullCommit = await this.github.getCommitDetails(parsed.owner, parsed.repo, targetCommit.sha);

    // Get the file tree from the parent commit (before the changes)
    const parentSha = fullCommit.parents?.[0]?.sha;
    if (!parentSha) {
      throw new Error('Commit has no parent, cannot determine "before" state');
    }

    const fileTree = await this.github.client.getRepoTree(parsed.owner, parsed.repo, parentSha);

    // Fetch content for each file in the tree
    for (const item of fileTree) {
      if (item.type === 'blob') { // blob means file
        try {
          item.content = await this.github.getFileContent(parsed.owner, parsed.repo, item.path, parentSha);
        } catch (error) {
          console.warn(`Could not fetch content for ${item.path}:`, error);
          item.content = `// Could not load content for this file`;
        }
      }
    }

    // Analyze codebase context for better AI guidance
    const codebaseContext = await this.aiService.analyzeCodebase(fileTree, repository);

    // Generate tutorial content using AI with codebase context
    const tutorialContent = await this.aiService.generateTutorialContent(
      targetCommit, 
      fullCommit.files || [], 
      repository,
      codebaseContext
    );

    // Create tutorial record
    const tutorialId = generateId();
    const tutorial = await this.storage.database.createTutorial({
      id: tutorialId,
      commit_id: commitId,
      title: tutorialContent.title,
      description: tutorialContent.description
    });

    // Convert AI steps to our format
    const steps = tutorialContent.steps.map((step, index) => ({
      id: generateId(),
      title: step.title,
      description: step.description,
      instructions: step.instructions,
      codeExample: step.codeExample,
      hints: step.hints
    }));

    // Store tutorial content in R2
    const content: TutorialContent = {
      tutorial_id: tutorialId,
      steps,
      fileTree, // Add file tree to tutorial content
      parentSha
    };

    await this.storage.r2.storeTutorialContent(tutorialId, content);

    return {
      tutorial,
      content
    };
  }

  // Removed - now using AIService directly

  /**
   * Get all tutorials for a repository
   */
  async getTutorialsByRepo(repoId: string): Promise<Tutorial[]> {
    return await this.storage.database.getTutorialsByRepo(repoId);
  }

  /**
   * Get tutorial with full content
   */
  async getTutorialWithContent(tutorialId: string): Promise<{
    tutorial: Tutorial;
    content: TutorialContent;
  }> {
    const tutorial = await this.storage.database.getTutorial(tutorialId);
    if (!tutorial) {
      throw new Error('Tutorial not found');
    }

    const content = await this.storage.r2.getTutorialContent(tutorialId);
    if (!content) {
      throw new Error('Tutorial content not found');
    }

    return { tutorial, content };
  }

  /**
   * Generate tutorials for all commits in a repository
   */
  async generateTutorialsForRepo(repoId: string, limit = 5): Promise<GeneratedTutorial[]> {
    const commits = await this.storage.database.getCommitsByRepo(repoId, limit);
    const results: GeneratedTutorial[] = [];

    for (const commit of commits) {
      try {
        const tutorial = await this.generateTutorial(commit.id);
        results.push(tutorial);
      } catch (error) {
        console.error(`Failed to generate tutorial for commit ${commit.id}:`, error);
      }
    }

    return results;
  }
}
