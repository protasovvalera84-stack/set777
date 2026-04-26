import { useState, useCallback, useMemo, useEffect } from "react";
import { ChatSidebar, type SearchResult } from "@/components/ChatSidebar";
import { ChatView } from "@/components/ChatView";
import { EmptyChat } from "@/components/EmptyChat";
import { AccountSettings } from "@/components/AccountSettings";
import { CallScreen, IncomingCallBanner, CallType } from "@/components/CallScreen";
import { GroupSettingsDialog } from "@/components/GroupSettingsDialog";
import { DmSettingsDialog } from "@/components/DmSettingsDialog";
import {
  contacts as defaultContacts, defaultProfile,
  Chat, Message, MediaAttachment, Story, StoryItem, UserProfile, Topic, ChatFolder,
} from "@/data/mockData";
import { useMesh } from "@/lib/MeshProvider";
import type { MatrixCall } from "matrix-js-sdk/lib/webrtc/call";
import { CallEvent } from "matrix-js-sdk/lib/webrtc/call";
import { CallEventHandlerEvent } from "matrix-js-sdk/lib/webrtc/callEventHandler";
import { getUserDisplayName } from "@/lib/meshClient";

interface IndexProps {
  initialProfile?: UserProfile;
  onProfileChange?: (p: UserProfile) => void;
  onLogout?: () => void;
}

const Index = ({ initialProfile, onProfileChange, onLogout }: IndexProps = {}) => {
  const mesh = useMesh();

  const [stories, setStories] = useState<Story[]>([]);
  const [profile, setProfile] = useState<UserProfile>(initialProfile || defaultProfile);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callType, setCallType] = useState<CallType>("audio");
  const [activeCall, setActiveCall] = useState<MatrixCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<MatrixCall | null>(null);
  const [incomingCallerName, setIncomingCallerName] = useState("");
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [dmSettingsOpen, setDmSettingsOpen] = useState(false);
  const [folders, setFolders] = useState<ChatFolder[]>([
    { id: "fav-default", name: "Favorites", chatIds: [] },
  ]);

  // Build chat list from server rooms (only room metadata, no messages)
  const chatList: Chat[] = useMemo(() => mesh.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    avatar: room.avatar,
    avatarUrl: room.avatarUrl,
    type: room.type,
    online: false,
    lastMessage: room.lastMessage,
    lastMessageTime: room.lastMessageTime,
    unread: room.unread,
    pinned: false,
    members: room.members,
    messages: [],
  })), [mesh.rooms]);

  // Only load messages for the selected chat
  const selectedChat = useMemo(() => {
    const chat = chatList.find((c) => c.id === selectedChatId);
    if (!chat) return null;
    const messages = mesh.getMessages(chat.id);
    return {
      ...chat,
      messages: messages.map((m) => ({
        id: m.id,
        senderId: m.isOwn ? "me" : m.senderId,
        text: m.text,
        timestamp: m.timestamp,
        read: true,
        media: m.mediaUrl ? [{
          id: m.id + "-media",
          type: m.mediaType || "image" as const,
          name: m.mediaName || "file",
          url: m.mediaUrl,
          size: 0,
          mimeType: m.mediaType === "video" ? "video/mp4" : m.mediaType === "audio" ? "audio/mpeg" : "image/jpeg",
        }] : undefined,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatList, selectedChatId, mesh.messageVersion]);

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSendMessage = useCallback(async (chatId: string, text: string, media?: MediaAttachment[], _topicId?: string | null) => {
    // Send media files first
    if (media && media.length > 0) {
      for (const attachment of media) {
        try {
          // Convert blob URL back to File
          const resp = await fetch(attachment.url);
          const blob = await resp.blob();
          const file = new File([blob], attachment.name, { type: attachment.mimeType });
          await mesh.sendMedia(chatId, file);
        } catch (err) {
          console.error("Failed to send media:", err);
        }
      }
    }
    // Send text if any
    if (text.trim()) {
      await mesh.sendMessage(chatId, text.trim());
    }
  }, [mesh]);

  const handleCreateChat = useCallback(async (chat: Chat) => {
    try {
      let roomId: string;
      if (chat.type === "dm") {
        const users = await mesh.searchUsers(chat.name);
        if (users.length > 0) {
          roomId = await mesh.createDm(users[0].userId);
        } else {
          roomId = await mesh.createDm(chat.name);
        }
      } else if (chat.type === "channel") {
        roomId = await mesh.createChannel(chat.name);
      } else {
        roomId = await mesh.createGroup(chat.name, []);
      }
      setSelectedChatId(roomId);
      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  }, [mesh]);

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

  // Listen for incoming calls
  useEffect(() => {
    const client = mesh.client;
    if (!client) return;

    const onIncoming = (call: MatrixCall) => {
      console.log("Incoming call from:", call.invitee);
      const callerId = call.getOpponentMember()?.userId || "Unknown";
      setIncomingCallerName(getUserDisplayName(client, callerId));
      setIncomingCall(call);
    };

    client.on(CallEventHandlerEvent.Incoming, onIncoming);
    return () => { client.removeListener(CallEventHandlerEvent.Incoming, onIncoming); };
  }, [mesh.client]);

  const handleCall = useCallback((type: CallType) => {
    if (!mesh.client || !selectedChatId) return;

    if (!mesh.client.supportsVoip()) {
      console.error("VoIP not supported by this client");
      return;
    }

    const call = mesh.client.createCall(selectedChatId);
    if (!call) {
      console.error("Failed to create call for room:", selectedChatId);
      return;
    }

    // Listen for errors before placing call
    call.on("error" as CallEvent, (err: unknown) => {
      console.error("Call error:", err);
    });

    setActiveCall(call);
    setCallType(type);
    setCallOpen(true);

    if (type === "video") {
      call.placeVideoCall().catch((err) => {
        console.error("Failed to place video call:", err);
        setCallOpen(false);
        setActiveCall(null);
      });
    } else {
      call.placeVoiceCall().catch((err) => {
        console.error("Failed to place voice call:", err);
        setCallOpen(false);
        setActiveCall(null);
      });
    }
  }, [mesh.client, selectedChatId]);

  const handleAcceptIncoming = useCallback((video: boolean) => {
    if (!incomingCall) return;
    setActiveCall(incomingCall);
    setCallType(video ? "video" : "audio");
    setCallOpen(true);
    setIncomingCall(null);
    // answer(audio, video) -- audio is always true, video depends on user choice
    incomingCall.answer(true, video).catch((err) => {
      console.error("Failed to answer call:", err);
      setCallOpen(false);
      setActiveCall(null);
    });
  }, [incomingCall]);

  const handleRejectIncoming = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.reject();
    setIncomingCall(null);
  }, [incomingCall]);

  const handleEndCall = useCallback(() => {
    setCallOpen(false);
    setActiveCall(null);
  }, []);

  const handleUpdateChat = (_updated: Chat) => {
    // Room updates handled by server sync
  };

  const handleDeleteChat = useCallback(async (chatId: string) => {
    await mesh.leaveRoom(chatId);
    if (selectedChatId === chatId) setSelectedChatId(null);
  }, [mesh, selectedChatId]);

  const handleBlockUser = (chatId: string) => {
    const chat = chatList.find((c) => c.id === chatId);
    if (chat) {
      console.log(`Blocked user in chat: ${chat.name}`);
    }
  };

  const handleSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];

    // Search users on the server
    const users = await mesh.searchUsers(query);
    for (const u of users) {
      // Don't show yourself in search results
      if (u.userId === mesh.userId) continue;
      results.push({
        type: "user",
        id: u.userId,
        name: u.displayName,
        avatar: u.displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??",
      });
    }

    // Also search public rooms
    try {
      const rooms = await mesh.getPublicRooms();
      for (const r of rooms) {
        if (r.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            type: "room",
            id: r.id,
            name: r.name,
            avatar: r.avatar,
            members: r.members,
          });
        }
      }
    } catch {
      // Public rooms search is optional, don't fail the whole search
    }

    return results;
  }, [mesh]);

  const handleStartDm = useCallback(async (userId: string) => {
    try {
      const roomId = await mesh.createDm(userId);
      setSelectedChatId(roomId);
      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch (err) {
      console.error("Failed to start DM:", err);
    }
  }, [mesh]);

  const handleJoinRoom = useCallback(async (roomId: string) => {
    try {
      const joined = await mesh.joinRoom(roomId);
      setSelectedChatId(joined);
      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch (err) {
      console.error("Failed to join room:", err);
    }
  }, [mesh]);

  const handleDeleteMessage = useCallback(async (chatId: string, messageId: string) => {
    try {
      await mesh.deleteMessage(chatId, messageId);
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  }, [mesh]);

  const handleBack = () => setSidebarOpen(true);

  // Show loading while connecting
  if (!mesh.ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl gradient-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Connecting to Meshlink...</p>
          <p className="text-[10px] text-muted-foreground/60">Syncing with server, please wait</p>
        </div>
      </div>
    );
  }

  // Show error if connection failed
  if (mesh.error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="h-12 w-12 rounded-2xl bg-destructive/20 flex items-center justify-center">
            <span className="text-destructive text-xl">!</span>
          </div>
          <p className="text-sm text-foreground font-medium">Connection Error</p>
          <p className="text-xs text-muted-foreground">{mesh.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl px-6 py-2.5 text-sm font-semibold gradient-primary text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
          >
            Retry
          </button>
          <button
            onClick={onLogout}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className={`${sidebarOpen ? "flex" : "hidden"} md:flex w-full md:w-auto flex-shrink-0`}>
        <ChatSidebar
          chats={chatList}
          stories={stories}
          profile={profile}
          folders={folders}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onCreateChat={handleCreateChat}
          onAddStory={handleAddStory}
          onOpenSettings={() => setSettingsOpen(true)}
          onFoldersChange={setFolders}
          onSearch={handleSearch}
          onStartDm={handleStartDm}
          onJoinRoom={handleJoinRoom}
        />
      </div>
      <div className={`${!sidebarOpen ? "flex" : "hidden"} md:flex flex-1 min-w-0`}>
        {selectedChat ? (
          <ChatView
            chat={selectedChat}
            onSendMessage={handleSendMessage}
            onBack={handleBack}
            onCall={selectedChat.type !== "channel" ? handleCall : undefined}
            onSettingsClick={
              selectedChat.type === "group" || selectedChat.type === "channel"
                ? () => setGroupSettingsOpen(true)
                : undefined
            }
            onDmSettingsClick={
              selectedChat.type === "dm" ? () => setDmSettingsOpen(true) : undefined
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
          contacts={defaultContacts}
          folders={folders}
          onClose={() => setGroupSettingsOpen(false)}
          onUpdateChat={handleUpdateChat}
          onDeleteChat={handleDeleteChat}
          onFoldersChange={setFolders}
        />
      )}

      {selectedChat && selectedChat.type === "dm" && (
        <DmSettingsDialog
          open={dmSettingsOpen}
          chat={selectedChat}
          folders={folders}
          onClose={() => setDmSettingsOpen(false)}
          onUpdateChat={handleUpdateChat}
          onDeleteChat={handleDeleteChat}
          onFoldersChange={setFolders}
          onBlockUser={handleBlockUser}
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
          matrixCall={activeCall}
          onEnd={handleEndCall}
        />
      )}

      {incomingCall && !callOpen && (
        <IncomingCallBanner
          callerName={incomingCallerName}
          onAccept={handleAcceptIncoming}
          onReject={handleRejectIncoming}
        />
      )}
    </div>
  );
};

export default Index;
