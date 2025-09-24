
export interface RepoSnapshot {
  repo_id: string;
  branch: string;
  commit_sha: string;
  created_at: string;
  file_count: number;
  size_bytes: number;
}

export interface CommitDiff {
  commit_sha: string;
  files: {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    patch?: string;
  }[];
}

export interface TutorialContent {
  tutorial_id: string;
  steps: {
    id: string;
    title: string;
    description: string;
    instructions: string;
  }[];
  fileTree?: any[];
  parentSha?: string;
}

export class R2Service {
  constructor(private r2: R2Bucket) {}

  async storeRepoSnapshot(repo_id: string, branch: string, commit_sha: string, zipData: ArrayBuffer): Promise<void> {
    const key = `repos/${repo_id}/snapshots/${branch}/${commit_sha}.tar.gz`;
    
    const metadata = {
      repo_id,
      branch,
      commit_sha,
      created_at: new Date().toISOString(),
      size_bytes: zipData.byteLength.toString()
    };

    await this.r2.put(key, zipData, {
      httpMetadata: {
        contentType: 'application/gzip'
      },
      customMetadata: metadata
    });
  }

  async getRepoSnapshot(repo_id: string, branch: string, commit_sha: string): Promise<ArrayBuffer | null> {
    const key = `repos/${repo_id}/snapshots/${branch}/${commit_sha}.tar.gz`;
    const object = await this.r2.get(key);
    return object ? await object.arrayBuffer() : null;
  }

  async listRepoSnapshots(repo_id: string): Promise<RepoSnapshot[]> {
    const prefix = `repos/${repo_id}/snapshots/`;
    const list = await this.r2.list({ prefix });
    
    return list.objects.map(obj => ({
      repo_id,
      branch: obj.customMetadata?.branch || 'unknown',
      commit_sha: obj.customMetadata?.commit_sha || 'unknown',
      created_at: obj.customMetadata?.created_at || obj.uploaded.toISOString(),
      file_count: 0, // Would need to extract to count
      size_bytes: obj.size
    }));
  }

  async storeCommitDiff(repo_id: string, commit_sha: string, diff: CommitDiff): Promise<void> {
    const key = `repos/${repo_id}/diffs/${commit_sha}.json`;
    
    await this.r2.put(key, JSON.stringify(diff), {
      httpMetadata: {
        contentType: 'application/json'
      },
      customMetadata: {
        repo_id,
        commit_sha,
        created_at: new Date().toISOString(),
        files_count: diff.files.length.toString()
      }
    });
  }

  async getCommitDiff(repo_id: string, commit_sha: string): Promise<CommitDiff | null> {
    const key = `repos/${repo_id}/diffs/${commit_sha}.json`;
    const object = await this.r2.get(key);
    
    if (!object) return null;
    
    const data = await object.text();
    return JSON.parse(data);
  }

  async storeTutorialContent(tutorial_id: string, content: TutorialContent): Promise<void> {
    const key = `tutorials/${tutorial_id}/content.json`;
    
    await this.r2.put(key, JSON.stringify(content), {
      httpMetadata: {
        contentType: 'application/json'
      },
      customMetadata: {
        tutorial_id,
        created_at: new Date().toISOString()
      }
    });
  }

  async getTutorialContent(tutorial_id: string): Promise<TutorialContent | null> {
    const key = `tutorials/${tutorial_id}/content.json`;
    const object = await this.r2.get(key);
    
    if (!object) return null;
    
    const data = await object.text();
    return JSON.parse(data);
  }

  async storeTutorialArtifact(tutorial_id: string, step_id: string, filename: string, content: string | ArrayBuffer): Promise<void> {
    const key = `tutorials/${tutorial_id}/artifacts/${step_id}/${filename}`;
    
    const isText = typeof content === 'string';
    await this.r2.put(key, content, {
      httpMetadata: {
        contentType: isText ? 'text/plain' : 'application/octet-stream'
      },
      customMetadata: {
        tutorial_id,
        step_id,
        filename,
        created_at: new Date().toISOString()
      }
    });
  }

  async getTutorialArtifact(tutorial_id: string, step_id: string, filename: string): Promise<string | ArrayBuffer | null> {
    const key = `tutorials/${tutorial_id}/artifacts/${step_id}/${filename}`;
    const object = await this.r2.get(key);
    
    if (!object) return null;
    
    const contentType = object.httpMetadata?.contentType;
    if (contentType?.startsWith('text/')) {
      return await object.text();
    } else {
      return await object.arrayBuffer();
    }
  }

  async listTutorialArtifacts(tutorial_id: string, step_id?: string): Promise<string[]> {
    const prefix = step_id 
      ? `tutorials/${tutorial_id}/artifacts/${step_id}/`
      : `tutorials/${tutorial_id}/artifacts/`;
    
    const list = await this.r2.list({ prefix });
    return list.objects.map(obj => obj.key);
  }

  async storeLearnerWorkspace(session_id: string, step_id: string, files: Record<string, string>): Promise<void> {
    const key = `sessions/${session_id}/workspace/${step_id}.json`;
    
    const workspace = {
      session_id,
      step_id,
      files,
      timestamp: new Date().toISOString()
    };

    await this.r2.put(key, JSON.stringify(workspace), {
      httpMetadata: {
        contentType: 'application/json'
      },
      customMetadata: {
        session_id,
        step_id,
        files_count: Object.keys(files).length.toString(),
        created_at: new Date().toISOString()
      }
    });
  }

  async getLearnerWorkspace(session_id: string, step_id: string): Promise<Record<string, string> | null> {
    const key = `sessions/${session_id}/workspace/${step_id}.json`;
    const object = await this.r2.get(key);
    
    if (!object) return null;
    
    const data = await object.text();
    const workspace = JSON.parse(data);
    return workspace.files;
  }

  async deleteRepoData(repo_id: string): Promise<void> {
    const prefixes = [
      `repos/${repo_id}/snapshots/`,
      `repos/${repo_id}/diffs/`
    ];

    for (const prefix of prefixes) {
      const list = await this.r2.list({ prefix });
      for (const obj of list.objects) {
        await this.r2.delete(obj.key);
      }
    }
  }

  async deleteTutorialData(tutorial_id: string): Promise<void> {
    const prefix = `tutorials/${tutorial_id}/`;
    const list = await this.r2.list({ prefix });
    
    for (const obj of list.objects) {
      await this.r2.delete(obj.key);
    }
  }

  async deleteSessionData(session_id: string): Promise<void> {
    const prefix = `sessions/${session_id}/`;
    const list = await this.r2.list({ prefix });
    
    for (const obj of list.objects) {
      await this.r2.delete(obj.key);
    }
  }

  async get(key: string): Promise<R2Object | null> {
    return await this.r2.get(key);
  }

  async put(key: string, data: ArrayBuffer | string, options?: R2PutOptions): Promise<void> {
    await this.r2.put(key, data, options);
  }

  async delete(key: string): Promise<void> {
    await this.r2.delete(key);
  }

  async list(options?: R2ListOptions): Promise<R2Objects> {
    return await this.r2.list(options);
  }
}
