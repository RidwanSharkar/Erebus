import React, { useState, useRef, useEffect } from 'react';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { COOP_DEV_LOCALHOST_FEATURES } from '@/components/environment/ThroneRoom';
import { resolveDevBossChatCamp } from '@/utils/devBossChatCommands';

interface ChatUIProps {
  isVisible?: boolean;
}

export default function ChatUI({ isVisible = true }: ChatUIProps) {
  const { chatMessages, isChatOpen, sendChatMessage, closeChat, enterCombatArena } = useMultiplayer();
  const [inputMessage, setInputMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isChatOpen]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const trimmed = inputMessage.trim();
      if (trimmed) {
        const devCamp = resolveDevBossChatCamp(trimmed);
        if (devCamp) {
          enterCombatArena(devCamp);
          setInputMessage('');
          closeChat();
          return;
        }
        sendChatMessage(trimmed);
        setInputMessage('');
      }
      closeChat();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeChat();
      setInputMessage('');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(event.target.value);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Chat Messages Display */}
      <div className="max-w-xs" data-block-game-input>
        <div className="bg-black bg-opacity-30 backdrop-blur-sm rounded-lg border border-gray-600 p-2 max-h-24 overflow-y-auto">
          {chatMessages.length > 0 ? (
            <div className="space-y-0.125">
              {chatMessages.map((message) => (
                <div key={message.id} className="text-sm">
                  <span className="text-blue-400 font-medium">{message.playerName}:</span>
                  <span className="text-white ml-1">{message.message}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : !isChatOpen ? (
            <div className="text-gray-400 text-xs italic">
              {COOP_DEV_LOCALHOST_FEATURES
                ? 'Enter to Chat'
                : 'Enter to Chat'}
            </div>
          ) : null}
        </div>
      </div>

      {/* Chat Input */}
      {isChatOpen && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50" data-block-game-input>
          <div className="bg-black bg-opacity-90 backdrop-blur-sm rounded-lg border border-gray-600 p-2 min-w-96">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter or Esc)"
              className="w-full bg-transparent text-white placeholder-gray-400 outline-none border-none"
              maxLength={150}
              autoComplete="off"
            />
          </div>
        </div>
      )}
    </>
  );
}
