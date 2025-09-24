/**
 * Monaco Editor component with syntax highlighting and intellisense
 */

import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  fileName?: string;
  readOnly?: boolean;
  theme?: 'vs-dark' | 'light';
  onValidation?: (markers: editor.IMarker[]) => void;
}

export function CodeEditor({ 
  value, 
  onChange, 
  language, 
  fileName,
  readOnly = false,
  theme = 'vs-dark',
  onValidation
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (editorRef.current && fileName) {
      // Update the model's URI to reflect the current file
      const model = editorRef.current.getModel();
      if (model) {
        // This helps with IntelliSense and language features
        const monaco = (window as any).monaco;
        if (monaco) {
          const uri = monaco.Uri.file(fileName);
          const newModel = monaco.editor.createModel(value, language, uri);
          editorRef.current.setModel(newModel);
        }
      }
    }
  }, [fileName, language, value]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Monaco, "Courier New", monospace',
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on',
      contextmenu: true,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      readOnly
    });

    // Enable validation if callback provided
    if (onValidation) {
      const model = editor.getModel();
      if (model) {
        // Listen for validation markers
        monaco.editor.onDidChangeMarkers(() => {
          const markers = monaco.editor.getModelMarkers({
            resource: model.uri
          });
          onValidation(markers);
        });
      }
    }

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Save functionality - you can emit an event here
      console.log('Save shortcut pressed');
    });

    // Configure language-specific features
    if (language === 'typescript' || language === 'javascript') {
      // Enable TypeScript diagnostics
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false
      });

      // Configure compiler options
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
    <div className="h-full w-full">
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
          wordWrap: 'on'
        }}
      />
    </div>
  );
}
