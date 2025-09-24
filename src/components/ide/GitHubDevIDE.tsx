/**
 * GitHub.dev IDE integration component
 */

import { useState } from 'react';
import { Button } from '@/components/button/Button';
import { Card } from '@/components/card/Card';
import { TutorialAssistant } from '../ai/TutorialAssistant';
import { ExternalLink, ArrowLeft, Code, CheckCircle } from 'lucide-react';

interface GitHubDevIDEProps {
  tutorial: {
    id: string;
    title: string;
    description: string;
    repoData: { owner: string; repo: string; parentSha: string };
  };
  currentStep: {
    id: string;
    title: string;
    description: string;
    instructions: string;
  };
  onBack: () => void;
  onStepComplete: () => void;
  onStepNext: () => void;
  onStepPrevious: () => void;
  stepNumber: number;
  totalSteps: number;
}

export function GitHubDevIDE({
  tutorial,
  currentStep,
  onBack,
  onStepComplete,
  onStepNext,
  onStepPrevious,
  stepNumber,
  totalSteps
}: GitHubDevIDEProps) {
  const [isIDEOpen, setIsIDEOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const gitHubDevUrl = `https://github.dev/${tutorial.repoData.owner}/${tutorial.repoData.repo}/tree/${tutorial.repoData.parentSha}`;
  const gitHubUrl = `https://github.com/${tutorial.repoData.owner}/${tutorial.repoData.repo}/commit/${tutorial.repoData.parentSha}`;

  const handleOpenIDE = () => {
    window.open(gitHubDevUrl, '_blank');
    setIsIDEOpen(true);
  };

  const handleMarkComplete = () => {
    setIsCompleted(true);
  };

  const handleGetCodeExample = async (): Promise<string> => {
    // Generate code example using AI
    try {
      const response = await fetch('/api/ai-example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorialId: tutorial.id,
          stepNumber,
          context: currentStep
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        return data.example || 'No example available';
      }
    } catch (error) {
      console.error('Failed to get code example:', error);
    }
    
    // Fallback example
    return `// Example implementation for: ${currentStep.title}
// This is a basic pattern you can follow

function implementFeature() {
  // TODO: Add your implementation here
  // Follow the commit message: "${tutorial.title}"
}

export default implementFeature;`;
  };

  const handleValidateImplementation = async (userCode: string) => {
    try {
      const response = await fetch('/api/ai-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorialId: tutorial.id,
          stepNumber,
          code: userCode,
          context: currentStep
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        return {
          isValid: data.isValid || false,
          feedback: data.feedback || 'Code review completed.'
        };
      }
    } catch (error) {
      console.error('Failed to validate code:', error);
    }

    // Fallback validation
    const hasBasicStructure = userCode.includes('function') || userCode.includes('const') || userCode.includes('export');
    return {
      isValid: hasBasicStructure,
      feedback: hasBasicStructure 
        ? 'Your code has good basic structure! Consider adding comments and error handling.'
        : 'Your code needs more structure. Try adding functions or constants to implement the feature.'
    };
  };

  const progress = (stepNumber / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
              <ArrowLeft size={16} />
              Back to Tutorials
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{tutorial.title}</h1>
              <p className="text-sm text-muted-foreground">
                Step {stepNumber} of {totalSteps}: {currentStep.title}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2">
            <div 
              className="bg-[#F48120] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Instructions */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">{currentStep.title}</h2>
          <p className="text-muted-foreground mb-4">{currentStep.description}</p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📋 Instructions:</h3>
            <div className="text-blue-800 dark:text-blue-200 whitespace-pre-line">
              {currentStep.instructions}
            </div>
          </div>
        </Card>

        {/* IDE Launch Section */}
        <Card className="p-6 mb-6">
          <div className="text-center">
            <div className="bg-[#F48120]/10 text-[#F48120] rounded-full p-4 inline-flex mb-4">
              <Code size={32} />
            </div>
            
            <h3 className="text-lg font-semibold mb-2">
              Ready to Code in VS Code!
            </h3>
            
            <p className="text-muted-foreground mb-4">
              Open the real repository in GitHub.dev (VS Code for the web) to implement this step.
              You'll have the full VS Code experience with the actual codebase!
            </p>

            <div className="space-y-3">
              <Button
                onClick={handleOpenIDE}
                className="flex items-center gap-2 text-lg px-6 py-3"
              >
                <ExternalLink size={20} />
                Open in VS Code Web
              </Button>
              
              <div className="text-xs text-muted-foreground">
                <p>Repository: {tutorial.repoData.owner}/{tutorial.repoData.repo}</p>
                <p>Commit: {tutorial.repoData.parentSha.substring(0, 8)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Helpful Links */}
        <Card className="p-6 mb-6">
          <h3 className="font-medium mb-3">🔗 Helpful Links</h3>
          <div className="space-y-2">
            <a
              href={gitHubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              <ExternalLink size={14} />
              View the target commit on GitHub
            </a>
            <a
              href={`https://github.com/${tutorial.repoData.owner}/${tutorial.repoData.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              <ExternalLink size={14} />
              View the full repository
            </a>
          </div>
        </Card>

        {/* AI Assistant Panel */}
        {isIDEOpen && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <div className="text-center">
                <h3 className="font-medium text-green-900 dark:text-green-100 mb-2">
                  🎯 Working in VS Code?
                </h3>
                <p className="text-green-800 dark:text-green-200 mb-4 text-sm">
                  Great! Take your time to implement the feature. When you're done, come back here to continue.
                </p>
                
                {!isCompleted && (
                  <Button
                    onClick={handleMarkComplete}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Mark Step as Complete
                  </Button>
                )}
              </div>
            </Card>

            <div className="h-96">
              <TutorialAssistant
                tutorial={tutorial}
                currentStep={currentStep}
                stepNumber={stepNumber}
                onGetCodeExample={handleGetCodeExample}
                onValidateImplementation={handleValidateImplementation}
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="secondary"
            onClick={onStepPrevious}
            disabled={stepNumber <= 1}
          >
            Previous Step
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {stepNumber} / {totalSteps}
            </span>
          </div>

          {stepNumber >= totalSteps ? (
            <Button
              onClick={onStepComplete}
              disabled={!isCompleted}
              className="flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Complete Tutorial
            </Button>
          ) : (
            <Button
              onClick={onStepNext}
              disabled={!isCompleted}
              className="flex items-center gap-2"
            >
              Next Step
            </Button>
          )}
        </div>

        {/* Step indicator dots */}
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < stepNumber
                  ? 'bg-green-500'
                  : i === stepNumber - 1
                  ? 'bg-[#F48120]'
                  : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
