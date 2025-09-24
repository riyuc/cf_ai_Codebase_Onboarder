export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string;
  html_url: string;
  clone_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  html_url: string;
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  files?: GitHubFile[];
  parents?: {
    sha: string;
    url: string;
  }[];
  parent?: GitHubCommit;
}

export interface GitHubFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url: string;
}

export interface GitHubCompare {
  base_commit: {
    sha: string;
  };
  commits: GitHubCommit[];
  files: GitHubFile[];
}

export interface RepoParseResult {
  owner: string;
  repo: string;
  isValid: boolean;
  error?: string;
}
