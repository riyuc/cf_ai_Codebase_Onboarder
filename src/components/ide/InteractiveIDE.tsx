/**
 * Main Interactive IDE component that combines all IDE features
 */

import { useState, useEffect } from 'react';
import { FileExplorer, type FileNode } from './FileExplorer';
import { EnhancedCodeEditor } from './EnhancedCodeEditor';
import { TutorialAssistant } from '../ai/TutorialAssistant';
import { Button } from '@/components/button/Button';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';

interface InteractiveIDEProps {
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
  fileTree?: any[];
}

export function InteractiveIDE({
  tutorial,
  currentStep,
  onBack,
  onStepComplete,
  onStepNext,
  onStepPrevious,
  stepNumber,
  totalSteps,
  fileTree
}: InteractiveIDEProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | undefined>();
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [currentCodeSelection, setCurrentCodeSelection] = useState<any>();
  const [codebaseContext, setCodebaseContext] = useState<any>(null);

  useEffect(() => {
    // Create a realistic workspace that simulates the actual repository
    const createRealisticWorkspace = async (): Promise<FileNode[]> => {
      try {
        console.log('Fetching workspace for tutorial:', tutorial.id);
        
        // Fetch workspace data from our new API
        const response = await fetch(`/api/workspace/${tutorial.id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        console.log('Workspace API response status:', response.status);

        if (response.ok) {
          const data = await response.json() as any;
          console.log('Workspace API response data:', data);
          
          if (data.success && data.workspace?.files) {
            console.log('SUCCESS: Using real repository files!', data.workspace.files.length, 'files');
            
            // Analyze codebase context for better AI guidance
            try {
              const analysisResponse = await fetch('/api/ai/codebase-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileTree: data.workspace.files,
                  repository: tutorial.repoData
                })
              });
              
              if (analysisResponse.ok) {
                const analysisData = await analysisResponse.json() as any;
                if (analysisData.success) {
                  console.log('Codebase context analyzed:', analysisData.codebaseContext);
                  setCodebaseContext(analysisData.codebaseContext);
                }
              }
            } catch (error) {
              console.warn('Failed to analyze codebase context:', error);
            }
            
            return data.workspace.files;
          } else {
            console.warn('API succeeded but no workspace files found:', data);
          }
        } else {
          const errorText = await response.text();
          console.error('Workspace API failed:', response.status, errorText);
        }
      } catch (error) {
        console.error('Could not load workspace from API:', error);
        throw new Error('Failed to load repository workspace. Repository cloning failed.');
      }

      // No fallback - we want real repository files only
      throw new Error('No workspace data available from API');
    };

    // Initialize the workspace
    const initWorkspace = async () => {
      try {
        const workspaceFiles = await createRealisticWorkspace();
        console.log('Setting files in IDE:', workspaceFiles);
        setFiles(workspaceFiles);
      
      // Auto-select the main implementation file
      const findMainFile = (nodes: FileNode[]): FileNode | undefined => {
        for (const node of nodes) {
          if (node.type === 'file' && node.path === 'src/index.js') {
            return node;
          }
          if (node.children) {
            const found = findMainFile(node.children);
            if (found) return found;
          }
        }
        // Fallback to first file
        for (const node of nodes) {
          if (node.type === 'file') return node;
          if (node.children) {
            const found = findMainFile(node.children);
            if (found) return found;
          }
        }
      };
      
        const mainFile = findMainFile(workspaceFiles);
        if (mainFile) {
          console.log('Selecting main file:', mainFile);
          setSelectedFile(mainFile);
        }
      } catch (error) {
        console.error('Failed to initialize workspace:', error);
        // Show error state instead of crashing
        setFiles([]);
        setSelectedFile(undefined);
      }
    };

    initWorkspace();
  }, [tutorial, currentStep, stepNumber]);

  const fetchFileContent = async (path: string): Promise<string> => {
    try {
      console.log('Fetching file content for:', path, 'with repoData:', tutorial.repoData);
      
      const response = await fetch(`/api/file-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: tutorial.repoData.owner,
          repo: tutorial.repoData.repo,
          path,
          ref: tutorial.repoData.parentSha
        })
      });
      
      console.log('Response status:', response.status, 'OK:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', errorText);
        return `// Error loading file: ${response.status} ${errorText}`;
      }
      
      const data = await response.json() as any;
      console.log('File content data:', data);
      
      return data.content || '// Empty file';
    } catch (error) {
      console.error('Fetch error:', error);
      return `// Error loading file: ${error}`;
    }
  };

  useEffect(() => {
    // Detect system theme
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'vs-dark' : 'light');
  }, []);

  const handleFileSelect = async (file: FileNode) => {
    try {
      if (file.type === 'file') {
        if (!file.content) {
          console.log('File has no content, fetching for:', file.path);
          // Fetch content on demand
          const content = await fetchFileContent(file.path);
          file.content = content;
        }
        console.log('Selecting file:', file.name, 'with content length:', file.content?.length);
        setSelectedFile(file);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      // Don't crash the app, just show an error in the file
      setSelectedFile({
        ...file,
        content: `// Error loading file: ${error}\n// Please try again or select a different file.`
      });
    }
  };

  const handleCodeChange = (newContent: string) => {
    if (!selectedFile) return;

    const updateFileContent = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === selectedFile.id) {
          return { ...node, content: newContent };
        }
        if (node.children) {
          return { ...node, children: updateFileContent(node.children) };
        }
        return node;
      });
    };

    const updatedFiles = updateFileContent(files);
    setFiles(updatedFiles);
    setSelectedFile({ ...selectedFile, content: newContent });
  };

  const handleCreateFile = (parentPath: string, fileName: string) => {
    const newFile: FileNode = {
      id: parentPath ? `${parentPath}/${fileName}` : fileName,
      name: fileName,
      type: 'file',
      path: parentPath ? `${parentPath}/${fileName}` : fileName,
      content: `// New file: ${fileName}
// Created during tutorial: ${tutorial.title}

// Start implementing here...

`
    };

    const addFileToTree = (nodes: FileNode[]): FileNode[] => {
      if (!parentPath) {
        // Add to root
        return [...nodes, newFile];
      }

      return nodes.map(node => {
        if (node.path === parentPath && node.type === 'folder') {
          return {
            ...node,
            children: [...(node.children || []), newFile],
            expanded: true
          };
        }
        if (node.children) {
          return { ...node, children: addFileToTree(node.children) };
        }
        return node;
      });
    };

    const updatedFiles = addFileToTree(files);
    setFiles(updatedFiles);
    setSelectedFile(newFile);
  };

  const handleCreateFolder = (parentPath: string, folderName: string) => {
    const newFolder: FileNode = {
      id: parentPath ? `${parentPath}/${folderName}` : folderName,
      name: folderName,
      type: 'folder',
      path: parentPath ? `${parentPath}/${folderName}` : folderName,
      children: [],
      expanded: true
    };

    const addFolderToTree = (nodes: FileNode[]): FileNode[] => {
      if (!parentPath) {
        // Add to root
        return [...nodes, newFolder];
      }

      return nodes.map(node => {
        if (node.path === parentPath && node.type === 'folder') {
          return {
            ...node,
            children: [...(node.children || []), newFolder],
            expanded: true
          };
        }
        if (node.children) {
          return { ...node, children: addFolderToTree(node.children) };
        }
        return node;
      });
    };

    const updatedFiles = addFolderToTree(files);
    setFiles(updatedFiles);
  };

  const handleValidateCode = async (code: string) => {
    // Mock validation for MVP - replace with actual AI validation
    return new Promise<any>((resolve) => {
      setTimeout(() => {
        const hasBasicStructure = code.includes('function') || code.includes('const') || code.includes('class');
        const hasComments = code.includes('//') || code.includes('/*');
        
        resolve({
          isValid: hasBasicStructure,
          errors: hasBasicStructure ? [] : ['Missing basic code structure'],
          suggestions: hasComments ? [] : ['Consider adding comments to explain your code'],
          nextStep: hasBasicStructure ? 'Ready to proceed to next step!' : undefined
        });
      }, 1000);
    });
  };

  const handleGetHint = async () => {
    // Mock hint generation - replace with actual AI
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        const hints = [
          `For this step: "${currentStep.title}", try focusing on the main function first.`,
          `Remember to follow the patterns shown in the commit message: "${tutorial.title}".`,
          `Start by setting up the basic structure, then add the implementation details.`,
          `Don't forget to handle edge cases and add proper error handling.`
        ];
        const randomHint = hints[Math.floor(Math.random() * hints.length)];
        resolve(randomHint);
      }, 800);
    });
  };

  const handleRequestHelp = async (question: string) => {
    // Mock AI help - replace with actual AI chat
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        if (question.toLowerCase().includes('error')) {
          resolve('To debug errors, check the console and make sure all variables are properly defined. Common issues include missing imports or typos in variable names.');
        } else if (question.toLowerCase().includes('how')) {
          resolve(`For this step, you need to implement the changes shown in the commit. Focus on understanding what the original author was trying to accomplish and follow similar patterns.`);
        } else {
          resolve(`Great question! For "${currentStep.title}", the key is to break down the problem into smaller parts. Start with the basic structure and gradually add complexity.`);
        }
      }, 1000);
    });
  };

  const handleReset = () => {
    if (selectedFile) {
      handleCodeChange('// Start implementing here...\n\n');
    }
  };

  const handleRunCode = () => {
    // Mock code execution - in real implementation, this could run in a sandbox
    alert('Code execution coming soon! For now, use the validation feature to check your implementation.');
  };

  const progress = (stepNumber / totalSteps) * 100;

  return (
    <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft size={16} />
            Back
          </Button>
          <div>
            <h1 className="font-semibold">{tutorial.title}</h1>
            <p className="text-sm text-muted-foreground">
              Step {stepNumber} of {totalSteps}: {currentStep.title}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Reset
          </Button>
          <Button
            variant="secondary"
            onClick={handleRunCode}
            className="flex items-center gap-2"
          >
            <Play size={16} />
            Run
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-neutral-200 dark:bg-neutral-800 flex-shrink-0">
        <div 
          className="h-full bg-[#F48120] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main IDE Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* File Explorer */}
        <div className="w-48 sm:w-64 min-w-48 sm:min-w-64 max-w-48 sm:max-w-64 flex-shrink-0 overflow-hidden">
          <FileExplorer
            files={files}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onFileUpdate={setFiles}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
          />
        </div>

        {/* Code Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Editor Tabs */}
          {selectedFile && (
            <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-shrink-0">
              <div className="px-4 py-2">
                <span className="text-sm font-medium truncate">{selectedFile.name}</span>
              </div>
            </div>
          )}
          
          {/* Editor */}
          <div className="flex-1 min-h-0">
            {selectedFile ? (
              <EnhancedCodeEditor
                value={selectedFile.content || ''}
                onChange={handleCodeChange}
                language="javascript"
                fileName={selectedFile.name}
                theme={theme}
                onSelectionChange={setCurrentCodeSelection}
                onAIRequest={async (action, selection) => {
                  console.log('AI Request:', action, 'Selection:', selection);
                  
                  try {
                    let response;
                    
                    switch (action) {
                      case 'explain':
                        response = await fetch('/api/ai/code-analysis', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            code: selection?.text || '',
                            fileName: selectedFile?.name || 'unknown',
                            language: 'javascript',
                            tutorialStep: currentStep.title,
                            codebaseContext
                          })
                        });
                        if (response.ok) {
                          const data = await response.json() as any;
                          alert(`AI Explanation:\n\n${data.analysis?.explanation || 'No explanation available'}`);
                        }
                        break;
                        
                      case 'improve':
                        response = await fetch('/api/ai/code-analysis', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            code: selection?.text || '',
                            fileName: selectedFile?.name || 'unknown',
                            language: 'javascript',
                            tutorialStep: currentStep.title,
                            codebaseContext
                          })
                        });
                        if (response.ok) {
                          const data = await response.json() as any;
                          const improvements = data.analysis?.improvements || [];
                          alert(`AI Improvements:\n\n${improvements.join('\n• ')}`);
                        }
                        break;
                        
                      case 'chat':
                        // Open AI chat with selected code context
                        const chatMessage = prompt('Ask about the selected code:', selection?.text || '');
                        if (chatMessage) {
                          // This would integrate with the AI Assistant
                          console.log('AI Chat:', chatMessage, 'Context:', selection);
                        }
                        break;
                        
                      default:
                        console.log('AI Action not implemented:', action);
                    }
                  } catch (error) {
                    console.error('AI request failed:', error);
                    alert('AI service temporarily unavailable. Please try again.');
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p>Select a file to start coding</p>
                  <p className="text-xs mt-1">Or right-click to create a new file</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant */}
        <div className="hidden lg:block w-80 min-w-80 max-w-80 flex-shrink-0 overflow-hidden">
          <TutorialAssistant
            tutorial={tutorial}
            currentStep={currentStep}
            stepNumber={stepNumber}
            codebaseContext={codebaseContext}
            onGetCodeExample={async () => {
              // Call real AI for code examples
              try {
                const response = await fetch('/api/ai/code-example', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    step: currentStep.title,
                    language: 'javascript',
                    selectedCode: currentCodeSelection?.text,
                    repository: `${tutorial.repoData.owner}/${tutorial.repoData.repo}`
                  })
                });
                
                if (response.ok) {
                  const data = await response.json() as any;
                  return data.example || '// AI-generated example coming soon...';
                }
              } catch (error) {
                console.error('Failed to get AI code example:', error);
              }
              
              return `// AI-generated example for: ${currentStep.title}\n// Selected code: ${currentCodeSelection?.text || 'No selection'}`;
            }}
            onValidateImplementation={async (code: string) => {
              // Call real AI for code validation
              try {
                const response = await fetch('/api/ai/code-analysis', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code,
                    fileName: selectedFile?.name || 'unknown',
                    language: 'javascript',
                    tutorialStep: currentStep.title,
                    codebaseContext
                  })
                });
                
                if (response.ok) {
                  const data = await response.json() as any;
                  return {
                    isValid: true,
                    feedback: data.analysis?.explanation || 'Code looks good!'
                  };
                }
              } catch (error) {
                console.error('Failed to validate code with AI:', error);
              }
              
              // Fallback to mock validation
              return handleValidateCode(code);
            }}
            selectedCode={currentCodeSelection?.text}
            fileName={selectedFile?.name}
          />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex-shrink-0">
        <div className="flex items-center justify-between">
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
            <Button onClick={onStepComplete}>
              Complete Tutorial
            </Button>
          ) : (
            <Button onClick={onStepNext}>
              Next Step
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
