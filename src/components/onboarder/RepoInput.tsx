/**
 * Repository input component for starting the onboarding process
 */

import { useState } from 'react';
import { Button } from '@/components/button/Button';
import { Input } from '@/components/input/Input';
import { Card } from '@/components/card/Card';
import { Loader } from '@/components/loader/Loader';

interface RepoInputProps {
  onRepoSubmit: (url: string) => void;
  loading?: boolean;
  error?: string;
}

export function RepoInput({ onRepoSubmit, loading, error }: RepoInputProps) {
  const [repoUrl, setRepoUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoUrl.trim()) {
      onRepoSubmit(repoUrl.trim());
    }
  };

  const exampleRepos = [
    'https://github.com/sindresorhus/slugify',
    'https://github.com/hotwired/stimulus',
    'https://github.com/expressjs/express'
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Codebase Onboarder</h1>
          <p className="text-lg text-muted-foreground">
            Turn successful commits into interactive learning tutorials for newcomers
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="repo-url" className="block text-sm font-medium mb-2">
              GitHub Repository URL
            </label>
            <Input
              id="repo-url"
              type="url"
              placeholder="https://github.com/owner/repository"
              value={repoUrl}
              onValueChange={(value) => setRepoUrl(value)}
              disabled={loading}
              className="w-full"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={!repoUrl.trim() || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2" />
                Analyzing Repository...
              </>
            ) : (
              'Start Onboarding'
            )}
          </Button>
        </form>

        <div className="mt-8">
          <p className="text-sm text-muted-foreground mb-3">Try these examples:</p>
          <div className="space-y-2">
            {exampleRepos.map((url) => (
              <button
                key={url}
                onClick={() => setRepoUrl(url)}
                disabled={loading}
                className="block w-full text-left text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                {url}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <h3 className="text-sm font-medium mb-3">How it works:</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-[#F48120] font-bold">1.</span>
              <span>We analyze your repository's commits to find learning-worthy features</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#F48120] font-bold">2.</span>
              <span>AI generates step-by-step tutorials from successful implementations</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#F48120] font-bold">3.</span>
              <span>Newcomers learn by implementing the same features with guidance</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
