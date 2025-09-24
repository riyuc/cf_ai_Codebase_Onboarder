import type { GitHubRepository, GitHubCommit, GitHubFile, RepoParseResult } from './types';

export class GitHubClient {
  private baseUrl = 'https://api.github.com';
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  parseRepositoryUrl(url: string): RepoParseResult {
    try {
      // Handle various GitHub URL formats:
      // https://github.com/owner/repo
      // https://github.com/owner/repo.git
      // github.com/owner/repo
      // git@github.com:owner/repo.git
      
      const patterns = [
        /^https?:\/\/github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/,
        /^git@github\.com:([^\/]+)\/([^\/\.]+)(\.git)?$/,
        /^github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2],
            isValid: true
          };
        }
      }

      return {
        owner: '',
        repo: '',
        isValid: false,
        error: 'Invalid GitHub URL format'
      };
    } catch (error) {
      return {
        owner: '',
        repo: '',
        isValid: false,
        error: 'Failed to parse URL'
      };
    }
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Codebase-Onboarder/1.0'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }


  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return await this.makeRequest<GitHubRepository>(`/repos/${owner}/${repo}`);
  }


  async getCommits(owner: string, repo: string, options?: {
    branch?: string;
    since?: string;
    until?: string;
    per_page?: number;
    page?: number;
  }): Promise<GitHubCommit[]> {
    const params = new URLSearchParams();
    
    if (options?.branch) params.append('sha', options.branch);
    if (options?.since) params.append('since', options.since);
    if (options?.until) params.append('until', options.until);
    params.append('per_page', (options?.per_page || 30).toString());
    params.append('page', (options?.page || 1).toString());

    const queryString = params.toString();
    const endpoint = `/repos/${owner}/${repo}/commits${queryString ? `?${queryString}` : ''}`;
    
    return await this.makeRequest<GitHubCommit[]>(endpoint);
  }


  async getCommit(owner: string, repo: string, sha: string): Promise<GitHubCommit> {
    const commit = await this.makeRequest<GitHubCommit>(`/repos/${owner}/${repo}/commits/${sha}`);
    
    // Get parent commit for "before" state
    const parentSha = commit.parents?.[0]?.sha;
    if (parentSha) {
      commit.parent = await this.makeRequest<any>(`/repos/${owner}/${repo}/commits/${parentSha}`);
    }

    return commit;
  }

  /**
   * Get repository content at a specific ref (commit SHA, branch, tag)
   */
  async getRepoContent(owner: string, repo: string, ref: string): Promise<any[]> {
    return await this.makeRequest<any>(`/repos/${owner}/${repo}/contents?ref=${ref}`);
  }

  /**
   * Get repository tree (recursive file list) at a specific ref
   */
  async getRepoTree(owner: string, repo: string, ref: string): Promise<any[]> {
    const response = await this.makeRequest<any>(`/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`);
    return response.tree || [];
  }


  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<{
    content: string;
    encoding: string;
    size: number;
  }> {
    const params = ref ? `?ref=${ref}` : '';
    const response = await this.makeRequest<any>(`/repos/${owner}/${repo}/contents/${path}${params}`);
    
    if (response.type !== 'file') {
      throw new Error('Path is not a file');
    }

    const content = response.encoding === 'base64' 
      ? atob(response.content.replace(/\n/g, ''))
      : response.content;

    return {
      content,
      encoding: response.encoding,
      size: response.size
    };
  }


  filterLearningCommits(commits: GitHubCommit[]): GitHubCommit[] {
    return commits.filter(commit => {
      const message = commit.commit.message.toLowerCase();
      
      if (message.includes('merge') && (message.includes('pull request') || message.includes('branch'))) {
        return false;
      }

      if (commit.commit.message.length < 10) {
        return false;
      }

      if (message.includes('update') && (message.includes('dependency') || message.includes('package'))) {
        return false;
      }

      if (message.includes('format') || message.includes('style') || message.includes('lint')) {
        return false;
      }

      return true;
    });
  }


  async getLearningCommits(owner: string, repo: string, options?: {
    branch?: string;
    limit?: number;
  }): Promise<GitHubCommit[]> {
    const limit = options?.limit || 20;
    
    const commits = await this.getCommits(owner, repo, {
      branch: options?.branch,
      per_page: Math.min(limit * 2, 100) // GitHub max is 100
    });

    const learningCommits = this.filterLearningCommits(commits);
    return learningCommits.slice(0, limit);
  }


  async isRepositoryAccessible(owner: string, repo: string): Promise<boolean> {
    try {
      await this.getRepository(owner, repo);
      return true;
    } catch (error) {
      return false;
    }
  }


  async getRepositoryStats(owner: string, repo: string): Promise<{
    isAccessible: boolean;
    defaultBranch: string;
    description: string | null;
    commitsCount: number;
  }> {
    try {
      const repo_info = await this.getRepository(owner, repo);
      const commits = await this.getCommits(owner, repo, { per_page: 1 });
      
      return {
        isAccessible: true,
        defaultBranch: repo_info.default_branch,
        description: repo_info.description,
        commitsCount: commits.length > 0 ? 1 : 0 // Simplified - just check if commits exist
      };
    } catch (error) {
      return {
        isAccessible: false,
        defaultBranch: '',
        description: null,
        commitsCount: 0
      };
    }
  }
}
