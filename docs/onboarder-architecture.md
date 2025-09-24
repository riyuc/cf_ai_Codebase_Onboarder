# Codebase Onboarder Architecture

## Vision

Transform GitHub repository commits into interactive tutorials that help newcomers learn by implementing the same features that experienced team members have already built. AI guides learners through step-by-step implementation while they learn the codebase patterns.

## Core Concept

1. **Commit Analysis**: Analyze successful commits from the repo to identify meaningful features/patterns
2. **Tutorial Generation**: Convert selected commits into step-by-step learning modules
3. **AI-Guided Implementation**: Help newcomers implement the same features with hints, validation, and feedback

## High-Level Flow

```
GitHub Repo URL → Commit Analysis → Tutorial Selection → Guided Implementation
```

## Components

### 1. Commit Analysis Pipeline

- **Input**: GitHub repo URL, branch, date range
- **Process**:
  - Fetch commit history via GitHub API
  - Analyze commit diffs to identify feature additions (not just bug fixes)
  - Extract patterns: new components, API endpoints, database changes, tests
  - Categorize by complexity/learning value
- **Output**: Structured commit metadata with learning potential scores

### 2. Tutorial Generation Engine

- **Input**: Selected commits + codebase context
- **Process**:
  - Break down commit into logical steps
  - Generate pre-implementation setup (branch creation, file structure)
  - Create step-by-step implementation guide
  - Prepare validation checkpoints
- **Output**: Interactive tutorial with checkpoints

### 3. AI-Guided Implementation

- **Real-time assistance**:
  - Code completion suggestions based on the target commit
  - Validation: compare learner's code against expected patterns
  - Hints when stuck (without giving away the solution)
  - Code review-style feedback
- **Learning reinforcement**:
  - Explain why certain patterns are used
  - Point out codebase conventions
  - Suggest improvements or alternatives

## Data Architecture

### Storage Layer

- **R2**: Store repo snapshots, commit diffs, generated tutorials
- **D1**: Metadata (repos, commits, learner progress, tutorial ratings)
- **Vectorize**: Commit embeddings for similarity search, code pattern matching
- **KV**: Session state, quick lookups for active tutorials

### Database Schema (D1)

```sql
-- Repository metadata
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  github_url TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT,
  last_analyzed DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analyzed commits with learning value
CREATE TABLE commits (
  id TEXT PRIMARY KEY,
  repo_id TEXT REFERENCES repositories(id),
  sha TEXT NOT NULL,
  message TEXT,
  author TEXT,
  date DATETIME,
  files_changed INTEGER,
  learning_score REAL, -- 0-1 based on educational value
  complexity_level TEXT, -- beginner, intermediate, advanced
  category TEXT, -- feature, refactor, test, docs
  tutorial_generated BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Generated tutorials
CREATE TABLE tutorials (
  id TEXT PRIMARY KEY,
  commit_id TEXT REFERENCES commits(id),
  title TEXT NOT NULL,
  description TEXT,
  estimated_time_minutes INTEGER,
  steps_count INTEGER,
  difficulty TEXT,
  prerequisites TEXT, -- JSON array
  learning_objectives TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Learner progress tracking
CREATE TABLE learner_sessions (
  id TEXT PRIMARY KEY,
  tutorial_id TEXT REFERENCES tutorials(id),
  learner_id TEXT, -- anonymous or user ID
  current_step INTEGER DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  feedback_rating INTEGER, -- 1-5
  notes TEXT
);
```

## API Endpoints

### Analysis & Tutorial Management

- `POST /analyze` - Analyze repo commits, generate learning opportunities
- `GET /repos/:repoId/tutorials` - List available tutorials for a repo
- `GET /tutorials/:tutorialId` - Get tutorial details and steps

### Guided Implementation

- `POST /sessions` - Start a new learning session
- `GET /sessions/:sessionId` - Get current session state
- `POST /sessions/:sessionId/validate` - Validate current step implementation
- `POST /sessions/:sessionId/hint` - Request AI hint for current step
- `POST /sessions/:sessionId/complete` - Mark step/tutorial complete

### Repository Management

- `GET /repos` - List analyzed repositories
- `GET /repos/:repoId/status` - Analysis progress and statistics

## Implementation Strategy

### Phase 1: Core Pipeline

1. GitHub API integration for commit fetching
2. Basic commit analysis (file changes, commit message parsing)
3. Simple tutorial generation for obvious features
4. Basic progress tracking

### Phase 2: AI Enhancement

1. Commit learning value scoring using LLM analysis
2. Intelligent step breakdown
3. Real-time code validation and hints
4. Pattern recognition for similar implementations

### Phase 3: Advanced Features

1. Adaptive difficulty based on learner progress
2. Team-specific pattern recognition
3. Integration with existing onboarding workflows
4. Analytics and improvement suggestions

## Example User Journey

1. **Manager**: Enters repo URL, selects commits to turn into tutorials
2. **System**: Analyzes commits, generates structured learning modules
3. **Newcomer**: Browses available tutorials, picks "Implement User Authentication"
4. **Guided Learning**:
   - Step 1: "Set up the user model" (AI shows expected file structure)
   - Step 2: "Create login endpoint" (AI validates API design)
   - Step 3: "Add frontend form" (AI checks component patterns)
   - Step 4: "Write tests" (AI ensures coverage matches team standards)
5. **Completion**: Newcomer has implemented the feature and learned codebase patterns

## Benefits

- **Faster Onboarding**: Learn by doing real features
- **Pattern Learning**: Absorb team conventions organically
- **Confidence Building**: Implement meaningful changes early
- **Knowledge Retention**: Active learning vs passive documentation reading
- **Team Alignment**: Everyone learns the same proven patterns
