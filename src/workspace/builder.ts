/**
 * Virtual Workspace Builder - Creates realistic coding environments
 */

import type { GitHubService } from '../github';
import type { StorageService } from '../storage';
import type { FileNode } from '../components/ide/FileExplorer';

export interface WorkspaceSnapshot {
  id: string;
  repoId: string;
  commitSha: string; // The parent commit SHA (before state)
  files: FileNode[];
  created_at: string;
}

export class WorkspaceBuilder {
  constructor(
    private github: GitHubService,
    private storage: StorageService
  ) {}

  /**
   * Create a virtual workspace from a repository at a specific commit
   */
  async createWorkspace(
    owner: string,
    repo: string,
    commitSha: string,
    tutorialId: string
  ): Promise<WorkspaceSnapshot> {
    
    // Get the full file tree from GitHub
    const repoTree = await this.github.client.getRepoTree(owner, repo, commitSha);
    
    // Filter to only include text files (skip binaries, large files)
    const textFiles = repoTree.filter(item => 
      item.type === 'blob' && 
      this.isTextFile(item.path) &&
      item.size < 100000 // Skip files larger than 100KB
    );

    // Build the workspace file structure
    const workspace: WorkspaceSnapshot = {
      id: `${tutorialId}-workspace`,
      repoId: `${owner}/${repo}`,
      commitSha,
      files: [],
      created_at: new Date().toISOString()
    };

    // Create a simplified file structure for the MVP
    const fileStructure = this.buildFileStructure(textFiles, owner, repo, commitSha);
    workspace.files = fileStructure;

    // Store the workspace in R2 for future use
    await this.storage.r2.put(
      `workspaces/${workspace.id}.json`,
      JSON.stringify(workspace)
    );

    return workspace;
  }

  /**
   * Build a realistic file structure with essential files
   */
  private buildFileStructure(
    githubFiles: any[],
    owner: string,
    repo: string,
    commitSha: string
  ): FileNode[] {
    const importantFiles = [
      'package.json',
      'README.md',
      'index.js',
      'index.ts',
      'src/index.js',
      'src/index.ts',
      'src/main.js',
      'src/main.ts',
      'lib/index.js',
      'lib/index.ts'
    ];

    // Find the most important files from the repo
    const selectedFiles = githubFiles.filter(file => 
      importantFiles.some(important => file.path.includes(important)) ||
      file.path.endsWith('.js') ||
      file.path.endsWith('.ts') ||
      file.path.endsWith('.json') ||
      file.path.endsWith('.md')
    ).slice(0, 10); // Limit to 10 files for MVP

    // Build the file tree structure
    const files: FileNode[] = [
      {
        id: 'src',
        name: 'src',
        type: 'folder',
        path: 'src',
        expanded: true,
        children: [
          {
            id: 'src/index.js',
            name: 'index.js',
            type: 'file',
            path: 'src/index.js',
            content: `// Main implementation file for: ${repo}
// 
// This is where you'll implement the tutorial changes
// Original repository: https://github.com/${owner}/${repo}
// Commit state: ${commitSha}

// TODO: Implement the feature from the tutorial
// Follow the step-by-step instructions in the AI assistant

`
          },
          {
            id: 'src/lib.js',
            name: 'lib.js',
            type: 'file',
            path: 'src/lib.js',
            content: '// Library functions\n// Add your helper functions here\n\n'
          }
        ]
      },
      {
        id: 'test',
        name: 'test',
        type: 'folder',
        path: 'test',
        expanded: false,
        children: [
          {
            id: 'test/index.test.js',
            name: 'index.test.js',
            type: 'file',
            path: 'test/index.test.js',
            content: `// Tests for the tutorial implementation
// 
// Write tests to verify your implementation works correctly

describe('Tutorial Implementation', () => {
  test('should implement the feature correctly', () => {
    // TODO: Write your tests here
  });
});
`
          }
        ]
      },
      {
        id: 'package.json',
        name: 'package.json',
        type: 'file',
        path: 'package.json',
        content: `{
  "name": "${repo}-tutorial",
  "version": "1.0.0",
  "description": "Tutorial implementation of ${repo}",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "node test/index.test.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/${owner}/${repo}.git"
  }
}
`
      },
      {
        id: 'README.md',
        name: 'README.md',
        type: 'file',
        path: 'README.md',
        content: `# Tutorial: ${repo}

## What You'll Learn
You'll implement the same feature that was added in a real commit to this repository.

## Getting Started
1. Open \`src/index.js\` to start coding
2. Follow the instructions in the AI assistant
3. Run tests to verify your implementation

## Repository Context
- Original repo: https://github.com/${owner}/${repo}
- Base commit: ${commitSha}
- Your goal: Implement the tutorial feature

## Need Help?
Use the AI assistant panel for hints and guidance!
`
      }
    ];

    return files;
  }

  /**
   * Check if a file is likely a text file (safe to load in editor)
   */
  private isTextFile(path: string): boolean {
    const textExtensions = [
      '.js', '.ts', '.jsx', '.tsx',
      '.json', '.md', '.txt', '.yml', '.yaml',
      '.html', '.css', '.scss', '.sass',
      '.py', '.java', '.go', '.rs', '.php',
      '.rb', '.swift', '.kt', '.cpp', '.c', '.h',
      '.sql', '.sh', '.bat', '.ps1',
      '.xml', '.toml', '.ini', '.env'
    ];

    const binaryPatterns = [
      'node_modules/',
      '.git/',
      'dist/',
      'build/',
      'coverage/',
      '.png', '.jpg', '.jpeg', '.gif', '.ico',
      '.woff', '.woff2', '.ttf', '.eot',
      '.zip', '.tar', '.gz', '.exe', '.dll'
    ];

    // Skip binary files and build artifacts
    if (binaryPatterns.some(pattern => path.includes(pattern))) {
      return false;
    }

    // Include known text extensions
    if (textExtensions.some(ext => path.endsWith(ext))) {
      return true;
    }

    // Include common config files without extensions
    const configFiles = [
      'Dockerfile', 'Makefile', 'LICENSE', 'CHANGELOG',
      '.gitignore', '.editorconfig', '.npmrc'
    ];
    
    const fileName = path.split('/').pop() || '';
    return configFiles.includes(fileName);
  }

  /**
   * Get workspace for a tutorial (create if doesn't exist)
   */
  async getWorkspace(tutorialId: string): Promise<WorkspaceSnapshot | null> {
    try {
      const stored = await this.storage.r2.get(`workspaces/${tutorialId}-workspace.json`);
      if (stored) {
        const content = await stored.text();
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Could not load stored workspace:', error);
    }
    return null;
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(tutorialId: string): Promise<void> {
    await this.storage.r2.delete(`workspaces/${tutorialId}-workspace.json`);
  }
}
