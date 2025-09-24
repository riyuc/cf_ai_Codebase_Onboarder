/**
 * Repository Cloner - Creates complete virtual workspace from actual repo
 */

import type { GitHubService } from '../github';
import type { StorageService } from '../storage';
import type { FileNode } from '../components/ide/FileExplorer';

export interface RepoSnapshot {
  id: string;
  repoId: string;
  commitSha: string;
  files: FileNode[];
  totalFiles: number;
  created_at: string;
}

export class RepoCloner {
  constructor(
    private github: GitHubService,
    private storage: StorageService
  ) {}

  /**
   * Clone the entire repository at a specific commit
   */
  async cloneRepository(
    owner: string,
    repo: string,
    commitSha: string,
    tutorialId: string
  ): Promise<RepoSnapshot> {
    
    console.log(`Cloning ${owner}/${repo} at commit ${commitSha}`);
    
    // Get the complete file tree from GitHub
    const repoTree = await this.github.client.getRepoTree(owner, repo, commitSha);
    
    console.log(`Found ${repoTree.length} files in repository`);
    
    // Filter files for the IDE (skip binaries, node_modules, etc.)
    const relevantFiles = repoTree.filter(item => 
      item.type === 'blob' && 
      this.shouldIncludeFile(item.path) &&
      item.size < 200000 // Skip files larger than 200KB
    );

    console.log(`Filtered to ${relevantFiles.length} relevant files`);

    // Build hierarchical file structure
    const fileTree = await this.buildFileTree(relevantFiles, owner, repo, commitSha);
    
    const snapshot: RepoSnapshot = {
      id: `${tutorialId}-clone`,
      repoId: `${owner}/${repo}`,
      commitSha,
      files: fileTree,
      totalFiles: relevantFiles.length,
      created_at: new Date().toISOString()
    };

    // Cache the snapshot in R2
    await this.storage.r2.put(
      `clones/${snapshot.id}.json`,
      JSON.stringify(snapshot)
    );

    return snapshot;
  }

  /**
   * Build hierarchical file tree from flat GitHub tree
   */
  private async buildFileTree(
    githubFiles: any[],
    owner: string,
    repo: string,
    commitSha: string
  ): Promise<FileNode[]> {
    const tree: FileNode[] = [];
    const folderMap: Record<string, FileNode> = {};

    // Create folder structure first
    githubFiles.forEach(file => {
      const pathParts = file.path.split('/');
      
      // Create folders for each path segment
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderPath = pathParts.slice(0, i + 1).join('/');
        
        if (!folderMap[folderPath]) {
          const folderNode: FileNode = {
            id: folderPath,
            name: pathParts[i],
            type: 'folder',
            path: folderPath,
            children: [],
            expanded: i < 2 // Expand first 2 levels by default
          };
          folderMap[folderPath] = folderNode;
        }
      }
    });

    // Build hierarchy for folders
    Object.values(folderMap).forEach(folder => {
      const parentPath = folder.path.split('/').slice(0, -1).join('/');
      
      if (parentPath && folderMap[parentPath]) {
        folderMap[parentPath].children!.push(folder);
      } else {
        tree.push(folder);
      }
    });

    // Add files to their parent folders
    for (const file of githubFiles) {
      const fileName = file.path.split('/').pop()!;
      const parentPath = file.path.split('/').slice(0, -1).join('/');
      
      // Fetch file content
      let content = '';
      try {
        content = await this.github.getFileContent(owner, repo, file.path, commitSha);
      } catch (error) {
        console.warn(`Could not fetch content for ${file.path}:`, error);
        content = `// Could not load content for this file\n// Path: ${file.path}\n// Error: ${error}`;
      }

      const fileNode: FileNode = {
        id: file.path,
        name: fileName,
        type: 'file',
        path: file.path,
        content
      };

      // Add to parent folder or root
      if (parentPath && folderMap[parentPath]) {
        folderMap[parentPath].children!.push(fileNode);
      } else {
        tree.push(fileNode);
      }
    }

    return tree;
  }

  /**
   * Determine if a file should be included in the IDE
   */
  private shouldIncludeFile(path: string): boolean {
    // Skip common build/generated directories
    const skipDirs = [
      'node_modules/',
      '.git/',
      'dist/',
      'build/',
      'coverage/',
      '.next/',
      '.nuxt/',
      'vendor/',
      'target/',
      'bin/',
      'obj/',
      '__pycache__/',
      '.pytest_cache/',
      '.vscode/',
      '.idea/'
    ];

    if (skipDirs.some(dir => path.includes(dir))) {
      return false;
    }

    // Skip binary file extensions
    const binaryExts = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.mp3', '.mp4', '.avi', '.mov', '.wmv',
      '.class', '.jar', '.war', '.ear'
    ];

    if (binaryExts.some(ext => path.toLowerCase().endsWith(ext))) {
      return false;
    }

    // Include common source files
    const sourceExts = [
      '.js', '.ts', '.jsx', '.tsx', '.mjs',
      '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h',
      '.cs', '.php', '.rb', '.swift', '.kt',
      '.html', '.css', '.scss', '.sass', '.less',
      '.json', '.xml', '.yaml', '.yml', '.toml',
      '.md', '.txt', '.rst',
      '.sql', '.sh', '.bat', '.ps1',
      '.dockerfile', '.makefile'
    ];

    if (sourceExts.some(ext => path.toLowerCase().endsWith(ext))) {
      return true;
    }

    // Include important config files without extensions
    const configFiles = [
      'Dockerfile', 'Makefile', 'LICENSE', 'CHANGELOG', 'CONTRIBUTING',
      '.gitignore', '.editorconfig', '.npmrc', '.nvmrc',
      'Cargo.toml', 'go.mod', 'requirements.txt', 'setup.py',
      'pom.xml', 'build.gradle', 'CMakeLists.txt'
    ];

    const fileName = path.split('/').pop() || '';
    return configFiles.includes(fileName);
  }

  /**
   * Get cached repository snapshot
   */
  async getCachedSnapshot(tutorialId: string): Promise<RepoSnapshot | null> {
    try {
      const stored = await this.storage.r2.get(`clones/${tutorialId}-clone.json`);
      if (stored) {
        const content = await (stored as any).text();
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('Could not load cached snapshot:', error);
    }
    return null;
  }

  /**
   * Delete cached snapshot
   */
  async deleteCachedSnapshot(tutorialId: string): Promise<void> {
    await this.storage.r2.delete(`clones/${tutorialId}-clone.json`);
  }
}
