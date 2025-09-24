/**
 * File explorer component for the interactive IDE
 */

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, FileText, FolderPlus } from 'lucide-react';
import { Button } from '@/components/button/Button';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
  expanded?: boolean;
}

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  selectedFile?: FileNode;
  onFileUpdate?: (files: FileNode[]) => void;
  onCreateFile?: (parentPath: string, fileName: string) => void;
  onCreateFolder?: (parentPath: string, folderName: string) => void;
}

export function FileExplorer({ files, onFileSelect, selectedFile, onFileUpdate, onCreateFile, onCreateFolder }: FileExplorerProps) {
  const [localFiles, setLocalFiles] = useState<FileNode[]>(files);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');

  useEffect(() => {
    console.log('FileExplorer received files:', files);
    setLocalFiles(files);
  }, [files]);

  const toggleFolder = (nodeId: string) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId && node.type === 'folder') {
          return { ...node, expanded: !node.expanded };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };

    const updatedFiles = updateNode(localFiles);
    setLocalFiles(updatedFiles);
    onFileUpdate?.(updatedFiles);
  };

  const handleCreateNew = () => {
    if (!newFileName.trim()) return;

    const fileName = newFileName.trim();
    const parentPath = ''; // For MVP, create in root

    if (createType === 'file') {
      onCreateFile?.(parentPath, fileName);
    } else {
      onCreateFolder?.(parentPath, fileName);
    }

    setNewFileName('');
    setShowCreateMenu(false);
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Simple context menu implementation
    const x = e.clientX;
    const y = e.clientY;
    
    // Create context menu element
    const menu = document.createElement('div');
    menu.className = 'fixed bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-50 py-1';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    const createFileItem = document.createElement('button');
    createFileItem.className = 'w-full text-left px-3 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2';
    createFileItem.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/></svg> New File';
    createFileItem.onclick = () => {
      const fileName = prompt('Enter file name:');
      if (fileName) {
        onCreateFile?.(node.type === 'folder' ? node.path : '', fileName);
      }
      document.body.removeChild(menu);
    };
    
    const createFolderItem = document.createElement('button');
    createFolderItem.className = 'w-full text-left px-3 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2';
    createFolderItem.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg> New Folder';
    createFolderItem.onclick = () => {
      const folderName = prompt('Enter folder name:');
      if (folderName) {
        onCreateFolder?.(node.type === 'folder' ? node.path : '', folderName);
      }
      document.body.removeChild(menu);
    };
    
    menu.appendChild(createFileItem);
    menu.appendChild(createFolderItem);
    document.body.appendChild(menu);
    
    // Remove menu when clicking elsewhere
    const removeMenu = () => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
      document.removeEventListener('click', removeMenu);
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 100);
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isSelected = selectedFile?.id === node.id;
    const paddingLeft = depth * 16 + 8;

    if (node.type === 'folder') {
      return (
        <div key={node.id}>
          <div
            className={`flex items-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 py-1 px-2 ${
              isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''
            }`}
            style={{ paddingLeft }}
            onClick={() => toggleFolder(node.id)}
            onContextMenu={(e) => handleContextMenu(e, node)}
          >
            <div className="flex items-center gap-1">
              {node.expanded ? (
                <ChevronDown size={14} className="text-neutral-500" />
              ) : (
                <ChevronRight size={14} className="text-neutral-500" />
              )}
              {node.expanded ? (
                <FolderOpen size={16} className="text-blue-500" />
              ) : (
                <Folder size={16} className="text-blue-500" />
              )}
              <span className="text-sm font-medium">{node.name}</span>
            </div>
          </div>
          {node.expanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={node.id}
        className={`flex items-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 py-1 px-2 ${
          isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''
        }`}
        style={{ paddingLeft }}
        onClick={() => onFileSelect(node)}
        onContextMenu={(e) => handleContextMenu(e, node)}
      >
        <div className="flex items-center gap-2">
          <File size={16} className="text-neutral-400" />
          <span className="text-sm">{node.name}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col">
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Explorer
          </h3>
          <span className="text-xs text-muted-foreground hidden sm:block">Right-click to create files</span>
        </div>
      </div>
      <div 
        className="flex-1 overflow-auto min-h-0"
        onContextMenu={(e) => {
          // Only handle context menu if not on a specific node
          if (e.target === e.currentTarget || (e.target as Element).closest('.explorer-empty')) {
            handleContextMenu(e, { id: '', name: '', type: 'folder', path: '' } as FileNode);
          }
        }}
      >
        {localFiles.length === 0 ? (
          <div 
            className="explorer-empty p-4 text-center text-muted-foreground h-full"
            onContextMenu={(e) => handleContextMenu(e, { id: '', name: '', type: 'folder', path: '' } as FileNode)}
          >
            <p className="text-sm">No files to display</p>
            <p className="text-xs mt-1">Right-click to create files</p>
          </div>
        ) : (
          <div className="min-h-full">
            {localFiles.map(node => renderNode(node))}
            {/* Empty space for context menu */}
            <div 
              className="explorer-empty h-20 w-full"
              onContextMenu={(e) => handleContextMenu(e, { id: '', name: '', type: 'folder', path: '' } as FileNode)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
