import { useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatView } from "@/components/ChatView";
import { EmptyChat } from "@/components/EmptyChat";
import { AccountSettings } from "@/components/AccountSettings";
import { CallScreen, CallType } from "@/components/CallScreen";
import { GroupSettingsDialog } from "@/components/GroupSettingsDialog";
import {
  chats as initialChats, contacts, defaultProfile,
  Chat, Message, MediaAttachment, Story, StoryItem, UserProfile, Topic,
} from "@/data/mockData";

const initialStories: Story[] = [
  {
    id: "s1",
    userId: "alice",
    userName: "Alice Nakamoto",
    avatar: "AN",
    items: [
      { id: "si1", type: "image", url: "https://picsum.photos/seed/mesh1/800/1200", caption: "New relay node deployed", timestamp: "2h ago" },
    ],
    viewed: false,
  },
  {
    id: "s2",
    userId: "bob",
    userName: "Bob Chen",
    avatar: "BC",
    items: [
      { id: "si2", type: "image", url: "https://picsum.photos/seed/mesh2/800/1200", caption: "QUIC upgrade testing", timestamp: "4h ago" },
    ],
    viewed: true,
  },
];

interface IndexProps {
  initialProfile?: UserProfile;
  onProfileChange?: (p: UserProfile) => void;
  onLogout?: () => void;
}

const Index = ({ initialProfile, onProfileChange, onLogout }: IndexProps = {}) => {
  const [chatList, setChatList] = useState<Chat[]>(initialChats);
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [profile, setProfile] = useState<UserProfile>(initialProfile || defaultProfile);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callType, setCallType] = useState<CallType>("audio");
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);

  const selectedChat = chatList.find((c) => c.id === selectedChatId) ?? null;

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    setChatList((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? { ...chat, unread: 0, messages: chat.messages.map((m) => ({ ...m, read: true })) }
          : chat,
      ),
    );
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSendMessage = (chatId: string, text: string, media?: MediaAttachment[], topicId?: string | null) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: "me",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: false,
      media,
      topicId: topicId ?? undefined,
    };
    const lastMsg = media && media.length > 0 && !text
      ? `[${media[0].type === "image" ? "Photo" : media[0].type === "video" ? "Video" : "Audio"}]`
      : text;
    setChatList((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        // Update topic messageCount if applicable
        const updatedTopics = topicId && chat.topics
          ? chat.topics.map((t) =>
              t.id === topicId
                ? { ...t, messageCount: t.messageCount + 1, lastMessage: lastMsg, lastMessageTime: "now" }
                : t,
            )
          : chat.topics;
        return {
          ...chat,
          messages: [...chat.messages, newMessage],
          lastMessage: lastMsg,
          lastMessageTime: "now",
          topics: updatedTopics,
        };
      }),
    );
  };

  const handleCreateChat = (chat: Chat) => {
    setChatList((prev) => [chat, ...prev]);
    setSelectedChatId(chat.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleAddStory = (items: StoryItem[]) => {
    const existing = stories.find((s) => s.userId === "me");
    if (existing) {
      setStories((prev) =>
        prev.map((s) => s.userId === "me" ? { ...s, items: [...s.items, ...items] } : s),
      );
    } else {
      setStories((prev) => [
        { id: `story-${Date.now()}`, userId: "me", userName: profile.name, avatar: profile.avatarInitials, items, viewed: true },
        ...prev,
      ]);
    }
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
    onProfileChange?.(updated);
  };

  const handleCall = (type: CallType) => {
    setCallType(type);
    setCallOpen(true);
  };

  const handleCreateTopic = (chatId: string, name: string, icon: string) => {
    const newTopic: Topic = {
      id: `topic-${Date.now()}`,
      name,
      icon,
      messageCount: 0,
      lastMessage: "Topic created",
      lastMessageTime: "now",
    };
    setChatList((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, topics: [...(c.topics || []), newTopic] } : c,
      ),
    );
  };

  const handleDeleteTopic = (chatId: string, topicId: string) => {
    setChatList((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, topics: (c.topics || []).filter((t) => t.id !== topicId) } : c,
      ),
    );
  };

  const handleUpdateChat = (updated: Chat) => {
    setChatList((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  };

  const handleDeleteChat = (chatId: string) => {
    setChatList((prev) => prev.filter((c) => c.id !== chatId));
    if (selectedChatId === chatId) setSelectedChatId(null);
  };

  const handleBack = () => setSidebarOpen(true);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className={`${sidebarOpen ? "flex" : "hidden"} md:flex w-full md:w-auto flex-shrink-0`}>
        <ChatSidebar
          chats={chatList}
          stories={stories}
          profile={profile}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onCreateChat={handleCreateChat}
          onAddStory={handleAddStory}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>
      <div className={`${!sidebarOpen ? "flex" : "hidden"} md:flex flex-1 min-w-0`}>
        {selectedChat ? (
          <ChatView
            chat={selectedChat}
            onSendMessage={handleSendMessage}
            onBack={handleBack}
            onCall={selectedChat.type !== "channel" ? handleCall : undefined}
            onCreateTopic={selectedChat.type === "group" ? handleCreateTopic : undefined}
            onDeleteTopic={selectedChat.type === "group" ? handleDeleteTopic : undefined}
            onSettingsClick={
              selectedChat.type === "group" || selectedChat.type === "channel"
                ? () => setGroupSettingsOpen(true)
                : undefined
            }
          />
        ) : (
          <EmptyChat />
        )}
      </div>

      {selectedChat && (selectedChat.type === "group" || selectedChat.type === "channel") && (
        <GroupSettingsDialog
          open={groupSettingsOpen}
          chat={selectedChat}
          contacts={contacts}
          onClose={() => setGroupSettingsOpen(false)}
          onUpdateChat={handleUpdateChat}
          onDeleteChat={handleDeleteChat}
        />
      )}

      <AccountSettings
        open={settingsOpen}
        profile={profile}
        onClose={() => setSettingsOpen(false)}
        onUpdate={handleUpdateProfile}
        onLogout={() => { setSettingsOpen(false); onLogout?.(); }}
      />

      {selectedChat && (
        <CallScreen
          open={callOpen}
          type={callType}
          contactName={selectedChat.name}
          contactAvatar={selectedChat.avatar}
          onEnd={() => setCallOpen(false)}
        />
      )}
    </div>
  );
};

export default Index;
