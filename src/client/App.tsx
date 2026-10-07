import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  IConversation,
  IMessage,
  BotStatusState,
  ConversationMode,
  WsServerEvent,
  AppUiState,
} from '../shared/types.js';
import { api, RealtimeClient } from './api/client.js';
import { ToastProvider, useToast } from './components/Toast.js';
import { Header } from './components/Header.js';
import { NotConfiguredView } from './components/NotConfiguredView.js';
import { AdminLoginView } from './components/AdminLoginView.js';
import { ConversationList } from './components/ConversationList.js';
import { ChatView } from './components/ChatView.js';
import { CustomerDetails } from './components/CustomerDetails.js';
import { SettingsModal } from './components/SettingsModal.js';

function InboxApp() {
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<BotStatusState | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('cakstore_admin_authenticated') === 'true';
  });

  const { showToast } = useToast();

  const handleLoginSuccess = () => {
    localStorage.setItem('cakstore_admin_authenticated', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('cakstore_admin_authenticated');
    setIsAuthenticated(false);
    showToast('Logged out from Admin Portal', 'info');
  };

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  // Derive explicit application state
  const appUiState: AppUiState = useMemo(() => {
    if (!telegramStatus) return 'CONNECTING';
    if (!telegramStatus.configured || telegramStatus.connectionState === 'not_configured') {
      return 'NOT_CONFIGURED';
    }
    if (telegramStatus.connectionState === 'connecting') {
      return 'CONNECTING';
    }
    if (telegramStatus.connectionState === 'error') {
      return 'ERROR';
    }
    if (telegramStatus.connectionState === 'disconnected') {
      return 'DISCONNECTED';
    }
    if (conversations.length === 0) {
      return 'CONNECTED_EMPTY';
    }
    return 'CONNECTED_WITH_DATA';
  }, [telegramStatus, conversations.length]);

  // Load status
  const loadTelegramStatus = useCallback(async () => {
    try {
      const status = await api.getTelegramStatus();
      setTelegramStatus(status);
      return status;
    } catch (err) {
      setTelegramStatus((prev) =>
        prev
          ? { ...prev, connectionState: 'error', lastError: 'Could not connect to server API' }
          : null
      );
      return null;
    }
  }, []);

  // Load conversations from database
  const loadConversations = useCallback(
    async (showLoadingSpinner = false) => {
      if (showLoadingSpinner) setLoadingConversations(true);
      try {
        const data = await api.getConversations({
          search: searchQuery,
          mode: modeFilter !== 'ALL' ? modeFilter : undefined,
        });
        setConversations(data);

        // Auto-select first conversation only if real conversations exist and on desktop
        if (!selectedId && data.length > 0 && window.innerWidth >= 1024) {
          setSelectedId(data[0].id);
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to load conversations', 'error');
      } finally {
        if (showLoadingSpinner) setLoadingConversations(false);
      }
    },
    [searchQuery, modeFilter, selectedId, showToast]
  );

  // Load messages for selected conversation
  const loadMessages = useCallback(
    async (convId: string, showSpinner = true) => {
      if (showSpinner) setLoadingMessages(true);
      setMessageError(null);
      try {
        const data = await api.getMessages(convId);
        setMessages(data);

        // Mark as read in database
        await api.markAsRead(convId);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
        );
      } catch (err) {
        setMessageError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        if (showSpinner) setLoadingMessages(false);
      }
    },
    []
  );

  // Handle selected conversation change
  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId, true);
    } else {
      setMessages([]);
    }
  }, [selectedId, loadMessages]);

  // Initial loads
  useEffect(() => {
    void loadTelegramStatus().then((status) => {
      if (status?.configured) {
        void loadConversations(true);
      } else {
        setLoadingConversations(false);
      }
    });
  }, [loadTelegramStatus, loadConversations]);

  // WebSocket realtime subscriptions
  useEffect(() => {
    const realtime = new RealtimeClient();

    const unsubscribe = realtime.subscribe((event: WsServerEvent) => {
      switch (event.type) {
        case 'telegram:status':
          setTelegramStatus(event.payload);
          break;

        case 'conversation:created': {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === event.payload.id);
            if (exists) return prev;
            return [event.payload, ...prev];
          });
          break;
        }

        case 'conversation:updated': {
          setConversations((prev) => {
            const index = prev.findIndex((c) => c.id === event.payload.id);
            if (index === -1) {
              return [event.payload, ...prev];
            }
            const updated = [...prev];
            updated[index] = event.payload;
            return updated.sort(
              (a, b) =>
                new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            );
          });
          break;
        }

        case 'message:new': {
          const { message, conversation } = event.payload;

          setConversations((prev) => {
            const filtered = prev.filter((c) => c.id !== conversation.id);
            return [conversation, ...filtered];
          });

          setSelectedId((currentSelectedId) => {
            if (currentSelectedId === conversation.id) {
              setMessages((prevMsgs) => {
                const exists = prevMsgs.some((m) => m.id === message.id);
                if (exists) return prevMsgs;
                return [...prevMsgs, message];
              });
              void api.markAsRead(conversation.id);
            }
            return currentSelectedId;
          });
          break;
        }
      }
    });

    return () => {
      unsubscribe();
      realtime.destroy();
    };
  }, []);

  // Send message
  const handleSendMessage = async (text: string) => {
    if (!selectedId) return;
    const sent = await api.sendMessage(selectedId, text);
    setMessages((prev) => {
      if (prev.some((m) => m.id === sent.id)) return prev;
      return [...prev, sent];
    });
    showToast('Message delivered to customer Telegram', 'success');
  };

  // Update conversation mode
  const handleUpdateMode = async (mode: ConversationMode) => {
    if (!selectedId) return;
    try {
      const updated = await api.updateMode(selectedId, mode);
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(`Switched conversation to ${mode} mode`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update mode', 'error');
    }
  };

  // Require authentication before entering the support inbox
  if (!isAuthenticated) {
    return (
      <AdminLoginView
        onLoginSuccess={handleLoginSuccess}
        onBackToStore={() => {
          showToast('Storefront navigation (Admin demo)', 'info');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f4f5f7] text-slate-950 antialiased">
      {/* Neo-brutalist Top Header */}
      <Header
        status={telegramStatus}
        onRefresh={() => {
          void loadTelegramStatus();
          if (telegramStatus?.configured) {
            void loadConversations(true);
          }
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        isAuthenticated={isAuthenticated}
      />

      {/* Main Body */}
      {appUiState === 'NOT_CONFIGURED' ? (
        <NotConfiguredView
          status={telegramStatus}
          onRefresh={() => {
            void loadTelegramStatus().then((s) => {
              if (s?.configured) void loadConversations(true);
            });
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      ) : (
        <div className="flex-1 flex min-h-0 w-full overflow-hidden">
          {/* 1. LEFT COLUMN: Conversation List */}
          <div
            className={`w-full lg:w-80 xl:w-96 shrink-0 h-full flex flex-col ${
              selectedId ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelectConversation={(id) => setSelectedId(id)}
              onSearchChange={(q) => setSearchQuery(q)}
              onFilterChange={(m) => setModeFilter(m)}
              currentFilter={modeFilter}
              loading={loadingConversations}
              onRefresh={() => loadConversations(true)}
            />
          </div>

          {/* 2. CENTER COLUMN: Chat View */}
          <div
            className={`flex-1 h-full min-w-0 flex flex-col ${
              !selectedId ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <ChatView
              conversation={selectedConversation}
              messages={messages}
              loading={loadingMessages}
              error={messageError}
              onSendMessage={handleSendMessage}
              onUpdateMode={handleUpdateMode}
              onRefresh={() => selectedId && loadMessages(selectedId, false)}
              onBack={() => setSelectedId(null)}
              onToggleDetails={() => setIsDetailsOpen((prev) => !prev)}
              isDetailsOpen={isDetailsOpen}
            />
          </div>

          {/* 3. RIGHT COLUMN: Customer Details (Desktop sidebar + Mobile drawer) */}
          {/* Desktop sidebar */}
          {isDetailsOpen && selectedConversation && (
            <div className="hidden xl:block w-80 shrink-0 h-full">
              <CustomerDetails
                conversation={selectedConversation}
                onUpdateMode={handleUpdateMode}
              />
            </div>
          )}

          {/* Mobile / Tablet Drawer */}
          {isDetailsOpen && selectedConversation && (
            <div className="xl:hidden">
              <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
                onClick={() => setIsDetailsOpen(false)}
              />
              <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xs sm:max-w-sm bg-white shadow-2xl lg:hidden">
                <CustomerDetails
                  conversation={selectedConversation}
                  onUpdateMode={handleUpdateMode}
                  onCloseMobileDrawer={() => setIsDetailsOpen(false)}
                  isMobileDrawer={true}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        status={telegramStatus}
        onStatusUpdated={(status) => setTelegramStatus(status)}
      />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <InboxApp />
    </ToastProvider>
  );
}

export default App;
