# Codebase Onboarder

An AI-powered codebase learning platform that turns successful GitHub commits into interactive tutorials for newcomers. Built on Cloudflare Workers with real AI integration.

Deployed link: https://cf-ai.ducanh-nguyen-swe.workers.dev

## 🚀 Features

### Core Functionality

- **AI-Powered Tutorial Generation**: Automatically creates step-by-step tutorials from real GitHub commits
- **Interactive IDE**: Cursor-like coding environment with AI assistance
- **Real Repository Cloning**: Works with actual codebases at specific commit states
- **Contextual AI Help**: AI assistant that understands your current step and selected code

### AI Features

- **Code Analysis**: Right-click selected code for AI explanations and improvements
- **Code Examples**: AI generates contextual examples based on tutorial steps
- **Smart Suggestions**: AI provides hints and guidance throughout the learning process
- **Code Validation**: AI reviews your implementations and provides feedback

### Technical Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Workers
- **AI**: Cloudflare Workers AI (Llama 3.1 8B)
- **Storage**: Cloudflare D1, KV, R2, Vectorize
- **Editor**: Monaco Editor with enhanced features

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Cloudflare     │    │   GitHub API    │
│   (React)       │◄──►│   Workers        │◄──►│   Integration   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Storage Layer  │
                    │   D1 + KV + R2   │
                    └──────────────────┘
```

### Key Components

1. **Repository Ingestion**: Analyzes GitHub commits and extracts learning-worthy features
2. **AI Tutorial Generator**: Creates educational content from commit analysis
3. **Virtual Workspace**: Clones repositories at specific commit states
4. **Interactive IDE**: Monaco Editor with AI-powered features
5. **AI Assistant**: Contextual help and code analysis

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- GitHub repository access

### Local Development

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd cf-ai
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up Cloudflare resources**

   ```bash
   # Create D1 database
   npx wrangler d1 create cf-ai

   # Create KV namespace
   npx wrangler kv:namespace create STATUS_KV

   # Create R2 bucket
   npx wrangler r2 bucket create cf-ai-repo-snapshots

   # Create Vectorize index
   npx wrangler vectorize create cf-ai-index --dimensions=768
   ```

4. **Update wrangler.jsonc with your resource IDs**

   ```json
   {
     "d1_databases": [
       {
         "binding": "cf_ai",
         "database_name": "cf-ai",
         "database_id": "your-database-id"
       }
     ],
     "kv_namespaces": [
       {
         "binding": "STATUS_KV",
         "id": "your-kv-id"
       }
     ],
     "r2_buckets": [
       {
         "binding": "REPO_BUCKET",
         "bucket_name": "cf-ai-repo-snapshots"
       }
     ],
     "vectorize": [
       {
         "binding": "VECTORIZE",
         "index_name": "cf-ai-index"
       }
     ]
   }
   ```

5. **Initialize the database**

   ```bash
   npx wrangler d1 execute cf-ai --file=./schema.sql
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

### Deploy to Cloudflare

1. **Deploy the worker**

   ```bash
   npm run deploy
   ```

2. **Access your application**
   - Visit your Cloudflare Workers URL
   - Start by entering a GitHub repository URL

## 📖 Usage Guide

### 1. Repository Analysis

1. Enter a GitHub repository URL (e.g., `https://github.com/sindresorhus/slugify`)
2. The system analyzes commits and identifies learning-worthy features
3. AI generates step-by-step tutorials from successful implementations

### 2. Interactive Learning

1. Select a tutorial from the generated list
2. The IDE opens with the repository cloned at the parent commit
3. Follow AI-generated steps to implement the same feature
4. Use the AI assistant for help and code validation

### 3. AI-Powered Features

- **Right-click code**: Get AI explanations and improvements
- **Ask questions**: Chat with AI about your current step
- **Get examples**: AI generates code examples based on context
- **Validate code**: AI reviews your implementation

## 🛠️ API Endpoints

### Tutorial Management

- `GET /tutorials?repo={repoId}` - List tutorials for a repository
- `POST /tutorials` - Create a new tutorial
- `GET /tutorials/{id}` - Get tutorial details
- `POST /generate-tutorials` - Generate tutorials from commits

### Session Management

- `POST /sessions` - Start a learning session
- `POST /sessions/{id}/action` - Navigate tutorial steps

### AI Assistance

- `POST /api/ai-assist` - Get contextual AI help
- `POST /api/ai/code-analysis` - Analyze selected code
- `POST /api/ai/code-example` - Generate code examples

### Workspace Management

- `GET /api/workspace/{tutorialId}` - Get workspace files
- `POST /api/workspace` - Create new workspace

## 🔧 Configuration

### Environment Variables

```bash
# Required for AI functionality
AI_BINDING=your-ai-binding

# Optional: GitHub token for higher rate limits
GITHUB_TOKEN=your-github-token
```

### Database Schema

The application uses D1 for relational data:

- `repositories` - GitHub repository metadata
- `commits` - Commit information and analysis
- `tutorials` - Generated tutorial metadata
- `learner_sessions` - User learning progress

---

**Built with ❤️ using Cloudflare Workers AI**
