/**
 * Main onboarder application component
 */

import { useState } from 'react';
import { RepoInput } from './RepoInput';
import { TutorialList } from './TutorialList';
import { InteractiveIDE } from '../ide/InteractiveIDE';

type AppState = 'input' | 'tutorials' | 'session' | 'ide';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

export interface SessionData {
  id: string;
  tutorial_id: string;
  tutorial_title: string;
  current_step: number;
  total_steps: number;
  completed: boolean;
  current_step_content: any;
  fileTree?: any[];
  parentSha?: string;
}

export function OnboarderApp() {
  const [state, setState] = useState<AppState>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [repoData, setRepoData] = useState<{ id: string; name: string } | null>(null);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);

  const handleRepoSubmit = async (repoUrl: string) => {
    setLoading(true);
    setError('');

    try {
      // Parse the URL to get repo info
      const parsed = new URL(repoUrl).pathname.split('/').filter(Boolean);
      if (parsed.length < 2) {
        throw new Error('Invalid GitHub URL format');
      }
      
      const repoId = `${parsed[0]}/${parsed[1]}`;
      
      // Check if repo already exists
      const existingResponse = await fetch(`/debug/repos`);
      const existingData = await existingResponse.json() as any;
      
      const existingRepo = existingData.repositories?.find((r: any) => r.id === repoId);
      
      if (existingRepo) {
        // Repository exists, use it directly
        setRepoData({
          id: existingRepo.id,
          name: existingRepo.name
        });
      } else {
        // Try to ingest new repository
        const ingestResponse = await fetch(`/test/ingest?repo=${encodeURIComponent(repoUrl)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!ingestResponse.ok) {
          throw new Error('Failed to analyze repository');
        }

        const ingestData = await ingestResponse.json() as any;
        
        if (!ingestData.success) {
          throw new Error(ingestData.error || 'Repository analysis failed');
        }

        // Safely access nested properties
        const repoResult = ingestData.test_results?.ingestion?.result;
        if (!repoResult?.repository) {
          throw new Error('Repository ingestion failed - no repository data returned');
        }

        // Set repo data
        setRepoData({
          id: repoResult.repository,
          name: repoResult.repository
        });
      }

      // Generate tutorials from commits
      const generateResponse = await fetch('/generate-tutorials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repoId: repoData?.id || repoId,
          limit: 3 
        })
      });

      if (generateResponse.ok) {
        const generateData = await generateResponse.json() as any;
        if (generateData.success) {
          setTutorials(generateData.tutorials || []);
        }
      }

      setState('tutorials');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTutorialSelect = async (tutorialId: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorialId })
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json() as any;
      
      if (data.success) {
        setCurrentSession({
          ...data.session,
          fileTree: data.fileTree || [],
          parentSha: data.parentSha
        });
        setState('ide'); // Go directly to IDE
      } else {
        throw new Error(data.error || 'Failed to start session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tutorial');
    } finally {
      setLoading(false);
    }
  };

  const handleStepAction = async (action: 'next' | 'previous' | 'complete') => {
    if (!currentSession) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/sessions/${currentSession.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error('Failed to update session');
      }

      const data = await response.json() as any;
      
      if (data.success) {
        setCurrentSession({
          ...data.session,
          fileTree: data.fileTree || [],
          parentSha: data.parentSha
        });
      } else {
        throw new Error(data.error || 'Failed to update session');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tutorial');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMore = async () => {
    if (!repoData) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/generate-tutorials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repoId: repoData.id,
          limit: 3 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate tutorials');
      }

      const data = await response.json() as any;
      
      if (data.success) {
        // Add new tutorials to existing list
        setTutorials(prev => [...prev, ...(data.tutorials || [])]);
      } else {
        throw new Error(data.error || 'Failed to generate tutorials');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tutorials');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToTutorials = () => {
    setState('tutorials');
    setCurrentSession(null);
    setError('');
  };

  const handleBackToInput = () => {
    setState('input');
    setRepoData(null);
    setTutorials([]);
    setCurrentSession(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4">
      <div className="container mx-auto py-8">
        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {state === 'input' && (
          <RepoInput
            onRepoSubmit={handleRepoSubmit}
            loading={loading}
            error={error}
          />
        )}

        {state === 'tutorials' && repoData && (
          <TutorialList
            tutorials={tutorials}
            repoName={repoData.name}
            onTutorialSelect={handleTutorialSelect}
            onGenerateMore={handleGenerateMore}
            loading={loading}
          />
        )}

        {state === 'ide' && currentSession && repoData && (
          <InteractiveIDE
            tutorial={{
              id: currentSession.tutorial_id,
              title: currentSession.tutorial_title,
              description: '',
              repoData: {
                owner: repoData.id.split('/')[0],
                repo: repoData.id.split('/')[1],
                parentSha: currentSession.parentSha || 'main'
              }
            }}
            currentStep={currentSession.current_step_content}
            onBack={() => {
              setState('tutorials');
              setCurrentSession(null);
            }}
            onStepComplete={() => handleStepAction('complete')}
            onStepNext={() => handleStepAction('next')}
            onStepPrevious={() => handleStepAction('previous')}
            stepNumber={currentSession.current_step + 1}
            totalSteps={currentSession.total_steps}
          />
        )}
      </div>
    </div>
  );
}
