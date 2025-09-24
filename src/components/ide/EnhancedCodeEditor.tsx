/**
 * Enhanced Monaco Editor with Cursor-like AI features
 */

import { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface CodeSelection {
  text: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

interface EnhancedCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  fileName?: string;
  readOnly?: boolean;
  theme?: 'vs-dark' | 'light';
  onSelectionChange?: (selection: CodeSelection | undefined) => void;
  onAIRequest?: (action: string, selection?: CodeSelection) => void;
}

export function EnhancedCodeEditor({ 
  value, 
  onChange, 
  language, 
  fileName,
  readOnly = false,
  theme = 'vs-dark',
  onSelectionChange,
  onAIRequest
}: EnhancedCodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [currentSelection, setCurrentSelection] = useState<CodeSelection | undefined>(undefined);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Monaco, "Courier New", monospace',
      lineNumbers: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      contextmenu: true,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      readOnly,
      // Enable selection highlighting
      renderLineHighlight: 'all',
      selectionHighlight: true,
      occurrencesHighlight: 'singleFile'
    });

    // Handle selection changes
    editor.onDidChangeCursorSelection((e) => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText = editor.getModel()?.getValueInRange(selection);
        if (selectedText) {
          const selectionData: CodeSelection = {
            text: selectedText,
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
            startColumn: selection.startColumn,
            endColumn: selection.endColumn
          };
          setCurrentSelection(selectionData);
          onSelectionChange?.(selectionData);
        }
      } else {
        setCurrentSelection(undefined);
        onSelectionChange?.(undefined);
      }
    });

    // Add AI-powered context menu actions
    editor.addAction({
      id: 'ai-explain-code',
      label: '🤖 Explain this code',
      contextMenuGroupId: 'ai-actions',
      run: () => {
        if (currentSelection) {
          onAIRequest?.('explain', currentSelection);
        }
      }
    });

    editor.addAction({
      id: 'ai-improve-code',
      label: '✨ Improve this code',
      contextMenuGroupId: 'ai-actions',
      run: () => {
        if (currentSelection) {
          onAIRequest?.('improve', currentSelection);
        }
      }
    });

    editor.addAction({
      id: 'ai-add-comments',
      label: '📝 Add comments',
      contextMenuGroupId: 'ai-actions',
      run: () => {
        if (currentSelection) {
          onAIRequest?.('comment', currentSelection);
        }
      }
    });

    editor.addAction({
      id: 'ai-debug-code',
      label: '🐛 Debug this code',
      contextMenuGroupId: 'ai-actions',
      run: () => {
        if (currentSelection) {
          onAIRequest?.('debug', currentSelection);
        }
      }
    });

    // Add keyboard shortcuts for AI features
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      // Ctrl+K for AI chat (like Cursor)
      onAIRequest?.('chat', currentSelection || undefined);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyA, () => {
      // Ctrl+Shift+A for AI suggestions
      onAIRequest?.('suggest', currentSelection || undefined);
    });

    // Configure language-specific features
    if (language === 'typescript' || language === 'javascript') {
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false
      });

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types']
      });
    }

    // Add AI completion provider (basic implementation)
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: async (model: any, _position: any) => {
        // This would call your AI service for code completions
        // For now, return empty suggestions
        return { suggestions: [] };
      }
    });
  };

  const getLanguageFromFileName = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'c':
        return 'c';
      case 'cs':
        return 'csharp';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'swift':
        return 'swift';
      case 'kt':
        return 'kotlin';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'scss':
        return 'scss';
      case 'json':
        return 'json';
      case 'xml':
        return 'xml';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'md':
        return 'markdown';
      case 'sql':
        return 'sql';
      case 'sh':
        return 'shell';
      default:
        return 'plaintext';
    }
  };

  const detectedLanguage = fileName ? getLanguageFromFileName(fileName) : language;

  return (
    <div className="h-full w-full relative">
      {/* Selection Info Overlay */}
      {currentSelection && (
        <div className="absolute top-2 right-2 z-10 bg-blue-500 text-white text-xs px-2 py-1 rounded">
          {currentSelection.text.length} chars selected
        </div>
      )}
      
      <Editor
        height="100%"
        value={value}
        language={detectedLanguage}
        theme={theme}
        onChange={(newValue) => onChange(newValue || '')}
        onMount={handleEditorDidMount}
        options={{
          selectOnLineNumbers: true,
          roundedSelection: false,
          readOnly,
          cursorStyle: 'line',
          automaticLayout: true,
          wordWrap: 'on',
          // Enhanced selection features
          selectionHighlight: true,
          occurrencesHighlight: 'singleFile',
          renderLineHighlight: 'all'
        }}
      />
    </div>
  );
}
