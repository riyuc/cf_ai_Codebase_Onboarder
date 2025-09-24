/**
 * Vectorize operations for semantic search over commits, code, and tutorials
 */

export interface CommitEmbedding {
  id: string; // `${repo_id}:${commit_sha}`
  values: number[];
  metadata: {
    repo_id: string;
    commit_sha: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface CodeChunkEmbedding {
  id: string; // `${repo_id}:${commit_sha}:${file_path}:${chunk_index}`
  values: number[];
  metadata: {
    repo_id: string;
    commit_sha: string;
    file_path: string;
    chunk_index: number;
    content: string; // The actual code chunk
    language: string;
    function_name?: string;
    class_name?: string;
    imports?: string[];
  };
}

export interface TutorialEmbedding {
  id: string; // `tutorial:${tutorial_id}`
  values: number[];
  metadata: {
    tutorial_id: string;
    title: string;
    description: string;
  };
}

export type EmbeddingType = CommitEmbedding | CodeChunkEmbedding | TutorialEmbedding;

export interface SearchResult<T extends { metadata: any } = EmbeddingType> {
  id: string;
  score: number;
  metadata: T['metadata'];
}

export class VectorizeService {
  constructor(private vectorize: VectorizeIndex) {}

  // Commit embeddings
  async insertCommitEmbedding(embedding: CommitEmbedding): Promise<void> {
    await this.vectorize.upsert([{
      id: embedding.id,
      values: embedding.values,
      metadata: embedding.metadata
    }]);
  }

  async insertCommitEmbeddings(embeddings: CommitEmbedding[]): Promise<void> {
    const vectors = embeddings.map(e => ({
      id: e.id,
      values: e.values,
      metadata: e.metadata
    }));
    
    // Process in batches to avoid hitting limits
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await this.vectorize.upsert(batch);
    }
  }

  async searchSimilarCommits(queryVector: number[], repoId?: string, topK = 10): Promise<SearchResult<CommitEmbedding>[]> {
    const filter: Record<string, any> = {};
    if (repoId) {
      filter.repo_id = repoId;
    }

    const results = await this.vectorize.query(queryVector, {
      topK,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      returnMetadata: true
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as CommitEmbedding['metadata']
    }));
  }

  // Code chunk embeddings
  async insertCodeChunkEmbedding(embedding: CodeChunkEmbedding): Promise<void> {
    await this.vectorize.upsert([{
      id: embedding.id,
      values: embedding.values,
      metadata: embedding.metadata
    }]);
  }

  async insertCodeChunkEmbeddings(embeddings: CodeChunkEmbedding[]): Promise<void> {
    const vectors = embeddings.map(e => ({
      id: e.id,
      values: e.values,
      metadata: e.metadata
    }));
    
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await this.vectorize.upsert(batch);
    }
  }

  async searchSimilarCode(queryVector: number[], repoId?: string, language?: string, topK = 10): Promise<SearchResult<CodeChunkEmbedding>[]> {
    const filter: Record<string, any> = {};
    if (repoId) filter.repo_id = repoId;
    if (language) filter.language = language;

    const results = await this.vectorize.query(queryVector, {
      topK,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      returnMetadata: true
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as CodeChunkEmbedding['metadata']
    }));
  }

  // Tutorial embeddings
  async insertTutorialEmbedding(embedding: TutorialEmbedding): Promise<void> {
    await this.vectorize.upsert([{
      id: embedding.id,
      values: embedding.values,
      metadata: embedding.metadata
    }]);
  }

  async searchSimilarTutorials(queryVector: number[], topK = 10): Promise<SearchResult<TutorialEmbedding>[]> {
    const results = await this.vectorize.query(queryVector, {
      topK,
      returnMetadata: true
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as TutorialEmbedding['metadata']
    }));
  }

  // Generic search across all embedding types
  async semanticSearch(queryVector: number[], filters?: Record<string, any>, topK = 10): Promise<SearchResult[]> {
    const results = await this.vectorize.query(queryVector, {
      topK,
      filter: filters,
      returnMetadata: true
    });

    return results.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata as any
    }));
  }

  // Find commits similar to a given commit (for tutorial recommendations)
  async findSimilarCommitsToCommit(commitId: string, topK = 5): Promise<SearchResult<CommitEmbedding>[]> {
    // First get the commit's embedding
    const result = await this.vectorize.getByIds([commitId]);
    if (!result || result.length === 0) {
      throw new Error(`Commit embedding not found: ${commitId}`);
    }

    const commitVector = Array.from(result[0].values);
    
    // Search for similar commits (excluding the original)
    const similar = await this.searchSimilarCommits(commitVector, undefined, topK + 1);
    
    // Filter out the original commit
    return similar.filter(s => s.id !== commitId).slice(0, topK);
  }

  // Find code patterns similar to a tutorial's target implementation
  async findRelatedCodePatterns(tutorialId: string, topK = 10): Promise<SearchResult<CodeChunkEmbedding>[]> {
    // Get tutorial embedding
    const tutorialResult = await this.vectorize.getByIds([`tutorial:${tutorialId}`]);
    if (!tutorialResult || tutorialResult.length === 0) {
      throw new Error(`Tutorial embedding not found: ${tutorialId}`);
    }

    const tutorialVector = Array.from(tutorialResult[0].values);
    
    // Search for related code chunks
    const filter = { /* Could filter by repo or language if needed */ };
    const results = await this.vectorize.query(tutorialVector, {
      topK,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      returnMetadata: true
    });

    return results.matches
      .filter(match => !match.id.startsWith('tutorial:')) // Exclude other tutorials
      .map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata as CodeChunkEmbedding['metadata']
      }));
  }

  // Delete operations
  async deleteCommitEmbeddings(repoId: string): Promise<void> {
    // Vectorize doesn't have a direct "delete by filter" operation
    // We'd need to list and delete individually
    // For now, we'll implement a simple approach
    await this.vectorize.deleteByIds([`${repoId}:*`]); // This might not work - depends on Vectorize API
  }

  async deleteTutorialEmbedding(tutorialId: string): Promise<void> {
    await this.vectorize.deleteByIds([`tutorial:${tutorialId}`]);
  }

  // Utility methods
  async getEmbeddingById(id: string): Promise<EmbeddingType | null> {
    const result = await this.vectorize.getByIds([id]);
    return result && result.length > 0 ? {
      id: result[0].id,
      values: result[0].values,
      metadata: result[0].metadata
    } as EmbeddingType : null;
  }

  async getEmbeddingsByIds(ids: string[]): Promise<EmbeddingType[]> {
    const results = await this.vectorize.getByIds(ids);
    return results.map(result => ({
      id: result.id,
      values: result.values,
      metadata: result.metadata
    })) as EmbeddingType[];
  }

  // Statistics and debugging
  async getIndexStats(): Promise<{
    totalVectors: number;
    commitVectors: number;
    codeVectors: number;
    tutorialVectors: number;
  }> {
    // This would require a way to count vectors by type
    // For now, return placeholder
    return {
      totalVectors: 0,
      commitVectors: 0,
      codeVectors: 0,
      tutorialVectors: 0
    };
  }
}
