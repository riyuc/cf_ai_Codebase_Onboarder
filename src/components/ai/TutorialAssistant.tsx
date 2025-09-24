/**
 * AI Tutorial Assistant - Provides guidance while working in GitHub.dev
 */

import { useState } from 'react';
import { Button } from '@/components/button/Button';
import { Card } from '@/components/card/Card';
import { Textarea } from '@/components/textarea/Textarea';
import { Bot, Send, Lightbulb, Code2, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';

interface AIMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface TutorialAssistantProps {
  tutorial: {
    id: string;
    title: string;
    repoData: { owner: string; repo: string; parentSha: string };
  };
  currentStep: {
    title: string;
    description: string;
    instructions: string;
  };
  stepNumber: number;
  onGetCodeExample: () => Promise<string>;
  onValidateImplementation: (userCode: string) => Promise<{ isValid: boolean; feedback: string }>;
}

export function TutorialAssistant({
  tutorial,
  currentStep,
  stepNumber,
  onGetCodeExample,
  onValidateImplementation
}: TutorialAssistantProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      type: 'system',
      content: `🎯 Welcome to Step ${stepNumber}: ${currentStep.title}\n\nI'm your AI coding assistant. I can help you with:\n• Code examples and patterns\n• Implementation hints\n• Code review and feedback\n• Questions about the repository\n\nWhat would you like help with?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const addMessage = (type: AIMessage['type'], content: string) => {
    const newMessage: AIMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage('user', userMessage);
    setLoading(true);

    try {
      // Call AI assistance API
      const response = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorialId: tutorial.id,
          stepNumber,
          question: userMessage,
          context: {
            repo: `${tutorial.repoData.owner}/${tutorial.repoData.repo}`,
            step: currentStep,
            tutorial: tutorial.title
          }
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        addMessage('assistant', data.response || 'I apologize, I couldn\'t generate a helpful response.');
      } else {
        addMessage('assistant', 'Sorry, I encountered an error. Please try rephrasing your question.');
      }
    } catch (error) {
      addMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetHint = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai-hint', {
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
        addMessage('assistant', `💡 **Hint**: ${data.hint}`);
      } else {
        addMessage('assistant', 'Sorry, I couldn\'t generate a hint right now.');
      }
    } catch (error) {
      addMessage('assistant', 'Sorry, I couldn\'t generate a hint right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetCodeExample = async () => {
    setLoading(true);
    try {
      const example = await onGetCodeExample();
      addMessage('assistant', `📝 **Code Example**:\n\n\`\`\`javascript\n${example}\n\`\`\`\n\nUse this as inspiration for your implementation!`);
    } catch (error) {
      addMessage('assistant', 'Sorry, I couldn\'t generate a code example right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeReview = async () => {
    const userCode = prompt('Paste your code here for AI review:');
    if (!userCode) return;

    setLoading(true);
    addMessage('user', `**Code for review:**\n\`\`\`javascript\n${userCode}\n\`\`\``);

    try {
      const result = await onValidateImplementation(userCode);
      const icon = result.isValid ? '✅' : '❌';
      const status = result.isValid ? 'Looking good!' : 'Needs improvement';
      addMessage('assistant', `${icon} **Code Review: ${status}**\n\n${result.feedback}`);
    } catch (error) {
      addMessage('assistant', 'Sorry, I couldn\'t review your code right now.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-blue-500" />
          <h3 className="font-semibold">AI Tutorial Assistant</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">
          Step {stepNumber}: {currentStep.title}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGetHint}
            disabled={loading}
            className="flex items-center gap-1 text-xs"
          >
            <Lightbulb size={12} />
            Get Hint
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGetCodeExample}
            disabled={loading}
            className="flex items-center gap-1 text-xs"
          >
            <Code2 size={12} />
            Code Example
          </Button>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleCodeReview}
          disabled={loading}
          className="w-full mt-2 flex items-center gap-1 text-xs"
        >
          <CheckCircle size={12} />
          Review My Code
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.type === 'system'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                  : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              <div className="text-xs opacity-70 mt-2">
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-blue-500 animate-pulse" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex-shrink-0">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask me anything about this step..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 resize-none text-sm"
            rows={2}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || loading}
            className="self-end"
          >
            <Send size={16} />
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          💡 Try: "How do I start?", "Show me an example", "Review my code"
        </div>
      </div>
    </Card>
  );
}
