import type { GitHubCommit, GitHubFile } from './types';
import type { Commit } from '../storage/database';

export interface CommitAnalysis {
  sha: string;
  isLearningWorthy: boolean;
  category: 'feature' | 'fix' | 'refactor' | 'test' | 'docs' | 'other';
  reason: string;
  fileTypes: string[];
  linesChanged: number;
}

export class CommitAnalyzer {
  
  analyzeCommit(commit: GitHubCommit): CommitAnalysis {
    const message = commit.commit.message.toLowerCase();
    const files = commit.files || [];
    
    const analysis: CommitAnalysis = {
      sha: commit.sha,
      isLearningWorthy: false,
      category: 'other',
      reason: '',
      fileTypes: this.getFileTypes(files),
      linesChanged: this.getTotalLinesChanged(files)
    };

    if (files.length > 15) {
      analysis.reason = 'Too many files changed (bulk operation)';
      return analysis;
    }

    if (analysis.linesChanged < 5) {
      analysis.reason = 'Very small change';
      return analysis;
    }

    if (analysis.linesChanged > 500) {
      analysis.reason = 'Too many lines changed (likely auto-generated)';
      return analysis;
    }

    analysis.category = this.categorizeCommit(message, files);
    
    switch (analysis.category) {
      case 'feature':
        analysis.isLearningWorthy = true;
        analysis.reason = 'Adds new functionality';
        break;
      case 'fix':
        if (analysis.linesChanged >= 10 && files.length <= 5) {
          analysis.isLearningWorthy = true;
          analysis.reason = 'Substantial bug fix';
        } else {
          analysis.reason = 'Small bug fix';
        }
        break;
      case 'refactor':
        if (files.length <= 8 && analysis.linesChanged <= 200) {
          analysis.isLearningWorthy = true;
          analysis.reason = 'Code improvement/refactor';
        } else {
          analysis.reason = 'Large refactor (too complex)';
        }
        break;
      case 'test':
        analysis.isLearningWorthy = true;
        analysis.reason = 'Adds or improves tests';
        break;
      default:
        analysis.reason = 'Not a clear feature/improvement';
    }

    if (this.hasOnlyConfigFiles(files)) {
      analysis.isLearningWorthy = false;
      analysis.reason = 'Only configuration changes';
    }

    if (this.isVersionBump(message)) {
      analysis.isLearningWorthy = false;
      analysis.reason = 'Version bump';
    }

    return analysis;
  }

  convertToDbCommit(gitHubCommit: GitHubCommit, repoId: string): Omit<Commit, 'created_at'> {
    return {
      id: `${repoId}:${gitHubCommit.sha}`,
      repo_id: repoId,
      sha: gitHubCommit.sha,
      message: gitHubCommit.commit.message,
      author: gitHubCommit.commit.author.name,
      date: gitHubCommit.commit.author.date
    };
  }


  analyzeCommits(commits: GitHubCommit[]): CommitAnalysis[] {
    return commits.map(commit => this.analyzeCommit(commit));
  }


  getLearningCommits(commits: GitHubCommit[]): { commit: GitHubCommit, analysis: CommitAnalysis }[] {
    return commits
      .map(commit => ({
        commit,
        analysis: this.analyzeCommit(commit)
      }))
      .filter(({ analysis }) => analysis.isLearningWorthy);
  }


  private categorizeCommit(message: string, files: GitHubFile[]): CommitAnalysis['category'] {

    if (message.includes('add') || message.includes('feat') || message.includes('implement')) {
      return 'feature';
    }


    if (message.includes('fix') || message.includes('bug') || message.includes('resolve')) {
      return 'fix';
    }


    if (message.includes('refactor') || message.includes('improve') || message.includes('clean')) {
      return 'refactor';
    }


    if (message.includes('test') || this.hasMainlyTestFiles(files)) {
      return 'test';
    }

    if (message.includes('doc') || message.includes('readme') || this.hasMainlyDocFiles(files)) {
      return 'docs';
    }

    return 'other';
  }

  private getFileTypes(files: GitHubFile[]): string[] {
    const extensions = new Set<string>();
    
    files.forEach(file => {
      const ext = file.filename.split('.').pop()?.toLowerCase();
      if (ext) {
        extensions.add(ext);
      }
    });

    return Array.from(extensions);
  }

  private getTotalLinesChanged(files: GitHubFile[]): number {
    return files.reduce((total, file) => total + file.additions + file.deletions, 0);
  }

  private hasOnlyConfigFiles(files: GitHubFile[]): boolean {
    const configExtensions = ['json', 'yml', 'yaml', 'toml', 'ini', 'config'];
    const configNames = ['package.json', 'package-lock.json', 'yarn.lock', '.gitignore', 'dockerfile'];
    
    return files.every(file => {
      const ext = file.filename.split('.').pop()?.toLowerCase();
      const name = file.filename.toLowerCase();
      
      return configExtensions.includes(ext || '') || 
             configNames.some(configName => name.includes(configName));
    });
  }

  private hasMainlyTestFiles(files: GitHubFile[]): boolean {
    const testFiles = files.filter(file => 
      file.filename.includes('test') || 
      file.filename.includes('spec') ||
      file.filename.includes('__tests__')
    );
    
    return testFiles.length > files.length * 0.7;
  }

  private hasMainlyDocFiles(files: GitHubFile[]): boolean {
    const docExtensions = ['md', 'txt', 'rst'];
    const docFiles = files.filter(file => {
      const ext = file.filename.split('.').pop()?.toLowerCase();
      return docExtensions.includes(ext || '') || file.filename.toLowerCase().includes('readme');
    });
    
    return docFiles.length > files.length * 0.7;
  }

  private isVersionBump(message: string): boolean {
    return /v?\d+\.\d+\.\d+/.test(message) && 
           (message.includes('bump') || message.includes('release') || message.includes('version'));
  }
}
