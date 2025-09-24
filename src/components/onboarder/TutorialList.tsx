/**
 * Tutorial list component showing available tutorials for a repository
 */

import { Card } from '@/components/card/Card';
import { Button } from '@/components/button/Button';
import { BookOpen, Clock, ChevronRight } from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

interface TutorialListProps {
  tutorials: Tutorial[];
  repoName: string;
  onTutorialSelect: (tutorialId: string) => void;
  onGenerateMore: () => void;
  loading?: boolean;
}

export function TutorialList({ 
  tutorials, 
  repoName, 
  onTutorialSelect, 
  onGenerateMore,
  loading 
}: TutorialListProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">
          Learning Tutorials for {repoName}
        </h1>
        <p className="text-muted-foreground">
          Interactive tutorials generated from successful commits. Choose one to start learning!
        </p>
      </div>

      {tutorials.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No tutorials available yet</h3>
          <p className="text-muted-foreground mb-4">
            Generate tutorials from this repository's commits to get started.
          </p>
          <Button onClick={onGenerateMore} disabled={loading}>
            Generate Tutorials
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 mb-6">
            {tutorials.map((tutorial) => (
              <Card key={tutorial.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{tutorial.title}</h3>
                    <p className="text-muted-foreground mb-4 line-clamp-2">
                      {tutorial.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>Created {formatDate(tutorial.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => onTutorialSelect(tutorial.id)}
                    className="ml-4 flex items-center gap-2"
                  >
                    Start Tutorial
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button 
              variant="secondary" 
              onClick={onGenerateMore}
              disabled={loading}
            >
              Generate More Tutorials
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
