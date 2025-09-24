/**
 * Tutorial generation engine - converts commits into learning tutorials
 */

import type { GitHubService } from '../github';
import type { StorageService } from '../storage';
import type { Commit, Tutorial } from '../storage/database';
import type { TutorialContent } from '../storage/r2';
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
    private aiModel: any // AI model for generating content
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

    // Generate tutorial content using AI
    const tutorialContent = await this.generateTutorialContent(targetCommit, fullCommit, repository);

    // Create tutorial record
    const tutorialId = generateId();
    const tutorial = await this.storage.database.createTutorial({
      id: tutorialId,
      commit_id: commitId,
      title: tutorialContent.title,
      description: tutorialContent.description
    });

    // Store tutorial content in R2
    const content: TutorialContent = {
      tutorial_id: tutorialId,
      steps: tutorialContent.steps,
      fileTree, // Add file tree to tutorial content
      parentSha
    };

    await this.storage.r2.storeTutorialContent(tutorialId, content);

    return {
      tutorial,
      content
    };
  }

  /**
   * Generate tutorial content using AI
   */
  private async generateTutorialContent(
    commit: Commit, 
    fullCommit: any, 
    repository: any
  ): Promise<{
    title: string;
    description: string;
    steps: TutorialStep[];
  }> {
    // Build context for AI
    const context = this.buildContext(commit, fullCommit, repository);
    
    // Generate tutorial using AI
    const prompt = this.buildTutorialPrompt(context);
    
    // For MVP, let's create a simple template-based tutorial
    // In production, this would call the AI model
    return this.generateSimpleTutorial(context);
  }

  /**
   * Build context about the commit for AI generation
   */
  private buildContext(commit: Commit, fullCommit: any, repository: any): any {
    return {
      commit: {
        sha: commit.sha,
        message: commit.message,
        author: commit.author,
        date: commit.date
      },
      repository: {
        name: repository.name,
        url: repository.github_url
      },
      files: fullCommit.files || [],
      stats: fullCommit.stats || { additions: 0, deletions: 0, total: 0 }
    };
  }

  /**
   * Build AI prompt for tutorial generation
   */
  private buildTutorialPrompt(context: any): string {
    return `
You are an expert coding instructor. Create a step-by-step tutorial for a newcomer to implement the same feature that was added in this commit.

COMMIT DETAILS:
- Message: ${context.commit.message}
- Author: ${context.commit.author}
- Repository: ${context.repository.name}
- Files changed: ${context.files.length}
- Lines changed: ${context.stats.total}

FILES CHANGED:
${context.files.map((f: any) => `- ${f.filename} (${f.status}): +${f.additions} -${f.deletions}`).join('\n')}

Create a tutorial with:
1. A clear title that explains what the learner will build
2. A brief description of the learning outcome
3. 3-5 step-by-step instructions that guide the learner to implement the same feature
4. Each step should be actionable and specific

Focus on teaching the patterns and concepts, not just copying code.
`;
  }

  /**
   * Generate a simple template-based tutorial (MVP version)
   */
  private generateSimpleTutorial(context: any): {
    title: string;
    description: string;
    steps: TutorialStep[];
  } {
    // Extract key info from commit message
    const message = context.commit.message;
    const isFeature = message.toLowerCase().includes('add') || message.toLowerCase().includes('implement');
    const isFix = message.toLowerCase().includes('fix') || message.toLowerCase().includes('bug');

    // Generate title based on commit type
    let title = '';
    if (isFeature) {
      title = `Implement: ${message.split('\n')[0]}`;
    } else if (isFix) {
      title = `Fix: ${message.split('\n')[0]}`;
    } else {
      title = `Learn: ${message.split('\n')[0]}`;
    }

    // Generate description
    const description = `Learn how to implement the changes from commit ${context.commit.sha.substring(0, 8)} by ${context.commit.author}. ` +
      `This tutorial will guide you through the same implementation process.`;

    // Generate simple steps based on files changed
    const steps: TutorialStep[] = [];

    if (context.files.length === 0) {
      // No files information, create generic steps
      steps.push(
        {
          id: generateId(),
          title: 'Understand the Problem',
          description: 'Review what needs to be implemented',
          instructions: `Study the commit message: "${message}". Research what this change accomplishes and why it was needed.`
        },
        {
          id: generateId(),
          title: 'Plan Your Implementation',
          description: 'Break down the implementation approach',
          instructions: 'Think about what files might need to be changed and what the implementation approach should be.'
        },
        {
          id: generateId(),
          title: 'Implement the Change',
          description: 'Write the code to accomplish the same goal',
          instructions: 'Implement the feature following the same patterns used in the original commit.'
        },
        {
          id: generateId(),
          title: 'Test Your Implementation',
          description: 'Verify that your implementation works',
          instructions: 'Test your implementation to ensure it works correctly and follows the same behavior as the original commit.'
        }
      );
    } else {
      // Create steps based on actual files changed
      steps.push({
        id: generateId(),
        title: 'Understand the Changes',
        description: 'Review what files were modified and why',
        instructions: `This commit modified ${context.files.length} file(s): ${context.files.map((f: any) => f.filename).join(', ')}. ` +
          `Study each file to understand what changes were made.`
      });

      // Group files by type for better step organization
      const filesByType = this.groupFilesByType(context.files);
      
      Object.entries(filesByType).forEach(([type, files]: [string, any]) => {
        steps.push({
          id: generateId(),
          title: `Modify ${type} Files`,
          description: `Update the ${type} files as shown in the commit`,
          instructions: `Work on the following ${type} files: ${files.map((f: any) => f.filename).join(', ')}. ` +
            `Follow the same patterns shown in the original commit.`
        });
      });

      steps.push({
        id: generateId(),
        title: 'Verify Your Implementation',
        description: 'Test that your changes work correctly',
        instructions: 'Run tests and verify that your implementation matches the expected behavior from the original commit.'
      });
    }

    return {
      title,
      description,
      steps
    };
  }

  /**
   * Group files by type for better step organization
   */
  private groupFilesByType(files: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    files.forEach(file => {
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'other';
      
      let type = 'Other';
      if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
        type = 'JavaScript/TypeScript';
      } else if (['css', 'scss', 'sass'].includes(ext)) {
        type = 'Styles';
      } else if (['html', 'jsx', 'tsx'].includes(ext)) {
        type = 'Templates';
      } else if (['json', 'yml', 'yaml'].includes(ext)) {
        type = 'Configuration';
      } else if (['md', 'txt'].includes(ext)) {
        type = 'Documentation';
      }

      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(file);
    });

    return groups;
  }

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
