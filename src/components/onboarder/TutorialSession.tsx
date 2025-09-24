/**
 * Tutorial session component for guided learning
 */

import { useState } from 'react';
import { Card } from '@/components/card/Card';
import { Button } from '@/components/button/Button';
import { ChevronLeft, ChevronRight, CheckCircle, ArrowLeft } from 'lucide-react';

interface TutorialStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  instructions: string;
}

interface SessionData {
  id: string;
  tutorial_id: string;
  tutorial_title: string;
  current_step: number;
  total_steps: number;
  completed: boolean;
  current_step_content: TutorialStep;
}

interface TutorialSessionProps {
  session: SessionData;
  onStepAction: (action: 'next' | 'previous' | 'complete') => void;
  onBack: () => void;
  onStartCoding?: () => void;
  loading?: boolean;
}

export function TutorialSession({ 
  session, 
  onStepAction, 
  onBack,
  onStartCoding,
  loading 
}: TutorialSessionProps) {
  const [showInstructions, setShowInstructions] = useState(true);

  const isFirstStep = session.current_step === 0;
  const isLastStep = session.current_step >= session.total_steps - 1;
  const progress = ((session.current_step + 1) / session.total_steps) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft size={16} />
            Back to Tutorials
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{session.tutorial_title}</h1>
            <p className="text-sm text-muted-foreground">
              Step {session.current_step + 1} of {session.total_steps}
            </p>
          </div>
          {session.completed && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle size={20} />
              <span className="font-medium">Completed!</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2">
          <div 
            className="bg-[#F48120] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current step content */}
      {session.current_step_content && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Step overview */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              {session.current_step_content.title}
            </h2>
            <p className="text-muted-foreground mb-4">
              {session.current_step_content.description}
            </p>
            
            <div className="space-y-2">
              <Button
                variant="secondary"
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full"
              >
                {showInstructions ? 'Hide' : 'Show'} Instructions
              </Button>
              {onStartCoding && (
                <Button
                  onClick={onStartCoding}
                  className="w-full"
                >
                  🚀 Start Coding
                </Button>
              )}
            </div>
          </Card>

          {/* Instructions */}
          <Card className={`p-6 transition-opacity ${showInstructions ? 'opacity-100' : 'opacity-50'}`}>
            <h3 className="font-medium mb-3">Instructions</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-line text-sm">
                {session.current_step_content.instructions}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between items-center">
        <Button
          variant="secondary"
          onClick={() => onStepAction('previous')}
          disabled={isFirstStep || loading}
          className="flex items-center gap-2"
        >
          <ChevronLeft size={16} />
          Previous Step
        </Button>

        <div className="flex gap-2">
          {isLastStep ? (
            <Button
              onClick={() => onStepAction('complete')}
              disabled={loading || session.completed}
              className="flex items-center gap-2"
            >
              <CheckCircle size={16} />
              {session.completed ? 'Completed!' : 'Complete Tutorial'}
            </Button>
          ) : (
            <Button
              onClick={() => onStepAction('next')}
              disabled={loading}
              className="flex items-center gap-2"
            >
              Next Step
              <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Step indicator dots */}
      <div className="mt-6 flex justify-center gap-2">
        {Array.from({ length: session.total_steps }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i <= session.current_step
                ? 'bg-[#F48120]'
                : 'bg-neutral-300 dark:bg-neutral-700'
            }`}
          />
        ))}
      </div>

      {/* Learning tips */}
      <Card className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Learning Tips</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Take your time to understand each step before moving on</li>
          <li>• Try implementing the solution yourself before looking at hints</li>
          <li>• Compare your approach with the original commit when done</li>
        </ul>
      </Card>
    </div>
  );
}
