/**
 * AI Assistant panel for providing contextual help and guidance
 */

import { useState } from 'react';
import { Button } from '@/components/button/Button';
import { Card } from '@/components/card/Card';
import { Textarea } from '@/components/textarea/Textarea';
import { Bot, Send, Lightbulb, CheckCircle, AlertCircle } from 'lucide-react';

interface AIMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
  nextStep?: string;
}

interface AIAssistantProps {
  currentStep: any;
  userCode: string;
  onValidateCode: (code: string) => Promise<ValidationResult>;
  onGetHint: () => Promise<string>;
  onRequestHelp: (question: string) => Promise<string>;
}

export function AIAssistant({ 
  currentStep, 
  userCode, 
  onValidateCode, 
  onGetHint,
  onRequestHelp 
}: AIAssistantProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      type: 'system',
      content: `Welcome! I'm here to help you implement: ${currentStep?.title || 'this step'}. Ask me questions or request hints anytime!`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

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
      const response = await onRequestHelp(userMessage);
      addMessage('assistant', response);
    } catch (error) {
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetHint = async () => {
    setLoading(true);
    try {
      const hint = await onGetHint();
      addMessage('assistant', `💡 **Hint**: ${hint}`);
    } catch (error) {
      addMessage('assistant', 'Sorry, I couldn\'t generate a hint right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCode = async () => {
    setLoading(true);
    try {
      const result = await onValidateCode(userCode);
      setValidation(result);
      
      if (result.isValid) {
        addMessage('system', '✅ Great! Your code looks correct. Ready for the next step?');
      } else {
        const errorMsg = `❌ Found some issues:\n${result.errors.join('\n')}`;
        const suggestionMsg = result.suggestions.length > 0 
          ? `\n\n💡 Suggestions:\n${result.suggestions.join('\n')}` 
          : '';
        addMessage('assistant', errorMsg + suggestionMsg);
      }
    } catch (error) {
      addMessage('assistant', 'Sorry, I couldn\'t validate your code right now.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800">
      {/* Header */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-blue-500" />
          <h3 className="text-sm font-semibold">AI Assistant</h3>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGetHint}
            disabled={loading}
            className="flex items-center gap-1"
          >
            <Lightbulb size={14} />
            Get Hint
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleValidateCode}
            disabled={loading || !userCode.trim()}
            className="flex items-center gap-1"
          >
            <CheckCircle size={14} />
            Validate Code
          </Button>
        </div>
      </div>

      {/* Validation Status */}
      {validation && (
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <Card className={`p-3 ${
            validation.isValid 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {validation.isValid ? (
                <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm font-medium">
                {validation.isValid ? 'Code Valid!' : 'Issues Found'}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.type === 'system'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800'
                  : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              <div className="text-xs opacity-70 mt-1">
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-blue-500" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
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
            className="flex-1 resize-none"
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
      </div>
    </div>
  );
}
