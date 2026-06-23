'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { MAX_SCRIPT_LENGTH } from '@/lib/constants';

interface ScriptUploaderProps {
  onSubmit: (text: string, title: string) => void;
  isAnalyzing: boolean;
}

export function ScriptUploader({ onSubmit, isAnalyzing }: ScriptUploaderProps) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (content) {
            setText(content.slice(0, MAX_SCRIPT_LENGTH));
            if (!title) {
              setTitle(file.name.replace('.txt', ''));
            }
          }
        };
        reader.readAsText(file);
      } else {
        alert('Please upload a valid .txt file');
      }
    }
  }, [title]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text, title.trim() || 'Untitled Script');
  };

  return (
    <div className="w-full flex flex-col gap-6">

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="text-sm text-text-secondary font-medium ml-1">
            Presentation Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Q3 All-Hands Meeting"
            className="input-glass w-full px-4 py-3 rounded-xl bg-bg-glass border border-border-glass focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all text-text-primary placeholder:text-text-muted"
            disabled={isAnalyzing}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-end ml-1 mb-1">
            <label htmlFor="script" className="text-sm text-text-secondary font-medium">
              Script Content
            </label>
            <span className={cn(
              "text-xs",
              text.length > MAX_SCRIPT_LENGTH ? "text-red-400" : "text-text-muted"
            )}>
              {text.length} / {MAX_SCRIPT_LENGTH} chars
            </span>
          </div>
          
          <div 
            className={cn(
              "relative rounded-xl overflow-hidden transition-all duration-300",
              isDragging ? "ring-2 ring-accent-primary shadow-[0_0_20px_rgba(0,210,255,0.2)]" : ""
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              id="script"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_SCRIPT_LENGTH))}
              placeholder="Paste your script here, or drag and drop a .txt file..."
              className="w-full h-64 md:h-80 p-4 bg-bg-glass border border-border-glass rounded-xl resize-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none text-text-primary placeholder:text-text-muted transition-all"
              disabled={isAnalyzing}
            />
            
            {!text && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-40">
                <Upload className="w-10 h-10 mb-3 text-text-secondary" />
                <p className="text-sm">Drag and drop a .txt file</p>
              </div>
            )}
          </div>
        </div>

        <Button 
          type="submit" 
          variant="primary" 
          className="w-full mt-2 py-6 text-lg"
          disabled={!text.trim() || text.length > MAX_SCRIPT_LENGTH || isAnalyzing}
          icon={isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
        >
          {isAnalyzing ? 'Analyzing Script...' : 'Analyze Script'}
        </Button>
      </form>
    </div>
  );
}
