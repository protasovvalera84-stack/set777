/**
 * MeshProvider -- React context that holds the live Meshlink client.
 *
 * After login/register the App stores a MeshlinkSession. This provider
 * creates a client, starts sync, and exposes helpers that the
 * ChatSidebar / ChatView components consume.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import * as sdk from "matrix-js-sdk";
import {
  createClientWithStore,
  startClient,
  stopClient,
  getUserDisplayName,
  getInitials,
  uploadMedia,
  mxcToUrl,
  mxcToThumbnail,
  type MeshlinkSession,
  type MeshClient,
  type MeshRoom as SdkRoom,
  type MeshEvent,
} from "@/lib/meshClient";

/* ------------------------------------------------------------------ */
/*  Public types consumed by UI components                            */
/* ------------------------------------------------------------------ */

export interface MeshRoom {
  id: string;
  name: string;
  avatar: string;
  avatarUrl: string | null;
  type: "dm" | "group" | "channel";
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  members: number;
}

export interface MeshMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio";
  mediaName?: string;
}

/* ------------------------------------------------------------------ */
/*  Context value                                                     */
/* ------------------------------------------------------------------ */

interface MeshContextValue {
  client: MeshClient | null;
  ready: boolean;
  error: string | null;
  userId: string;
  rooms: MeshRoom[];
  messageVersion: number;
  getMessages: (roomId: string) => MeshMessage[];
  sendMessage: (roomId: string, text: string) => Promise<void>;
  sendMedia: (roomId: string, file: File) => Promise<void>;
  deleteMessage: (roomId: string, eventId: string) => Promise<void>;
  createDm: (userId: string) => Promise<string>;
  createGroup: (name: string, userIds: string[]) => Promise<string>;
  createChannel: (name: string) => Promise<string>;
  joinRoom: (roomIdOrAlias: string) => Promise<string>;
  leaveRoom: (roomId: string) => Promise<void>;
  inviteUser: (roomId: string, userId: string) => Promise<void>;
  searchUsers: (term: string) => Promise<{ userId: string; displayName: string }[]>;
  getPublicRooms: () => Promise<MeshRoom[]>;
}

const MeshContext = createContext<MeshContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useMesh(): MeshContextValue {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error("useMesh must be used inside <MeshProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function roomToMesh(room: SdkRoom, myUserId: string, directRoomIds: Set<string>): MeshRoom {
  const members = room.getJoinedMembers();

  // Determine room type using multiple signals:

  // 1. Check join_rule first -- public rooms are always channels
  let joinRule = "invite";
  try {
    joinRule = room.getJoinRule();
  } catch { /* default to invite */ }

  const isPublic = joinRule === "public";

  // 2. Check if explicitly marked as DM in m.direct account data
  const isMarkedDirect = directRoomIds.has(room.roomId);

  // 3. Determine final type
  let roomType: "dm" | "group" | "channel";
  if (isPublic) {
    // Public rooms are always channels, regardless of member count
    roomType = "channel";
  } else if (isMarkedDirect) {
    // Explicitly marked as DM
    roomType = "dm";
  } else if (members.length === 2 && !room.isSpaceRoom() && !room.name) {
    // Unnamed room with exactly 2 members -- likely a DM that wasn't marked
    roomType = "dm";
  } else {
    // Everything else is a group
    roomType = "group";
  }

  console.debug(`Room "${room.name || room.roomId}": joinRule=${joinRule}, markedDirect=${isMarkedDirect}, members=${members.length} -> type=${roomType}`);

  const timeline = room.getLiveTimeline().getEvents();
  const lastEvt = [...timeline].reverse().find(
    (e) => e.getType() === "m.room.message",
  );
  let lastMessage = "";
  let lastMessageTime = "";
  if (lastEvt) {
    const content = lastEvt.getContent();
    lastMessage = typeof content.body === "string" ? content.body : "";
    const ts = lastEvt.getTs();
    lastMessageTime = formatTime(ts);
  }

  let name = room.name || "Unnamed";
  if (roomType === "dm") {
    const other = members.find((m) => m.userId !== myUserId);
    if (other) name = other.name || other.userId;
  }

  return {
    id: room.roomId,
    name,
    avatar: getInitials(name),
    avatarUrl: null,
    type: roomType,
    lastMessage,
    lastMessageTime,
    unread: room.getUnreadNotificationCount("total") || 0,
    members: members.length,
  };
}

function eventToMesh(evt: MeshEvent, client: MeshClient): MeshMessage | null {
  if (evt.getType() !== "m.room.message") return null;
  if (evt.isRedacted()) return null;
  const content = evt.getContent();
  const senderId = evt.getSender()!;
  const msgtype = content.msgtype as string;

  let text = typeof content.body === "string" ? content.body : "";
  let mediaUrl: string | undefined;
  let mediaType: "image" | "video" | "audio" | undefined;
  let mediaName: string | undefined;

  if (msgtype === "m.image" && content.url) {
    mediaUrl = mxcToThumbnail(content.url as string, 800, 600);
    mediaType = "image";
    mediaName = text;
    text = "";
  } else if (msgtype === "m.video" && content.url) {
    mediaUrl = mxcToUrl(content.url as string);
    mediaType = "video";
    mediaName = text;
    text = "";
  } else if (msgtype === "m.audio" && content.url) {
    mediaUrl = mxcToUrl(content.url as string);
    mediaType = "audio";
    mediaName = text;
    text = "";
  } else if (msgtype === "m.file" && content.url) {
    mediaUrl = mxcToUrl(content.url as string);
    mediaName = text;
    text = "";
  }

  return {
    id: evt.getId()!,
    senderId,
    senderName: getUserDisplayName(client, senderId),
    text,
    timestamp: formatTime(evt.getTs()),
    isOwn: senderId === client.getUserId(),
    mediaUrl,
    mediaType,
    mediaName,
  };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  session: MeshlinkSession;
  children: ReactNode;
}

export function MeshProvider({ session, children }: Props) {
  const clientRef = useRef<MeshClient | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<MeshRoom[]>([]);
  const [messageVersion, setMessageVersion] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshRooms = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;

    // Build set of DM room IDs from m.direct account data
    const directRoomIds = new Set<string>();
    try {
      const directEvent = c.getAccountData("m.direct");
      if (directEvent) {
        const directMap = directEvent.getContent() as Record<string, string[]>;
        for (const roomIds of Object.values(directMap)) {
          if (Array.isArray(roomIds)) {
            for (const id of roomIds) directRoomIds.add(id);
          }
        }
      }
    } catch {
      // m.direct may not exist yet
    }

    const allRooms = c.getRooms();
    const meshRooms = allRooms
      .filter((r) => r.getMyMembership() === "join")
      .map((r) => roomToMesh(r, session.userId, directRoomIds))
      .sort((a, b) => {
        if (!a.lastMessageTime && b.lastMessageTime) return 1;
        if (a.lastMessageTime && !b.lastMessageTime) return -1;
        return 0;
      });
    setRooms(meshRooms);
  }, [session.userId]);

  // Debounced refresh -- batches rapid events into one update
  const debouncedRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshRooms();
    }, 150);
  }, [refreshRooms]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const client = await createClientWithStore(session);
      if (cancelled) { client.stopClient(); return; }
      clientRef.current = client;

      const onEvent = () => {
        if (!cancelled) {
          debouncedRefresh();
          setMessageVersion((v) => v + 1);
        }
      };

      const onMyMembership = (room: SdkRoom, membership: string) => {
        if (membership === "invite") {
          client.joinRoom(room.roomId).catch((err) => {
            console.error("Failed to auto-join room:", room.roomId, err);
          });
        }
        if (!cancelled) {
          debouncedRefresh();
          setMessageVersion((v) => v + 1);
        }
      };

      client.on(sdk.RoomEvent.Timeline, onEvent);
      client.on(sdk.RoomEvent.Name, onEvent);
      client.on(sdk.RoomEvent.MyMembership, onMyMembership);
      client.on(sdk.RoomMemberEvent.Membership, onEvent);

      await startClient(client);
      if (!cancelled) {
        setReady(true);
        refreshRooms();
      }
    }

    init().catch((err) => {
      console.error("Failed to initialize Meshlink client:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setReady(true); // Set ready so UI shows error instead of infinite loading
    });

    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        stopClient(clientRef.current);
        clientRef.current = null;
      }
    };
  }, [session, refreshRooms, debouncedRefresh]);

  // --- Actions ---

  const getMessages = useCallback(
    (roomId: string): MeshMessage[] => {
      const c = clientRef.current;
      if (!c) return [];
      const room = c.getRoom(roomId);
      if (!room) return [];
      const events = room.getLiveTimeline().getEvents();
      return events
        .map((e) => eventToMesh(e, c))
        .filter((m): m is MeshMessage => m !== null);
    },
    [],
  );

  const sendMessage = useCallback(async (roomId: string, text: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.sendTextMessage(roomId, text);
  }, []);

  const sendMedia = useCallback(async (roomId: string, file: File) => {
    const c = clientRef.current;
    if (!c) return;
    const mxcUri = await uploadMedia(session.accessToken, file);
    let msgtype = "m.file";
    if (file.type.startsWith("image/")) msgtype = "m.image";
    else if (file.type.startsWith("video/")) msgtype = "m.video";
    else if (file.type.startsWith("audio/")) msgtype = "m.audio";
    await c.sendMessage(roomId, {
      msgtype,
      body: file.name,
      url: mxcUri,
      info: { mimetype: file.type, size: file.size },
    });
  }, [session.accessToken]);

  const deleteMessage = useCallback(async (roomId: string, eventId: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.redactEvent(roomId, eventId);
  }, []);

  const createDm = useCallback(async (targetUserId: string): Promise<string> => {
    const c = clientRef.current;
    if (!c) throw new Error("Not connected");

    // Check if we already have a DM with this user
    const existingRooms = c.getRooms();
    for (const room of existingRooms) {
      if (room.getMyMembership() !== "join") continue;
      const members = room.getJoinedMembers();
      const invited = room.getMembersWithMembership("invite");
      const allMembers = [...members, ...invited];
      if (allMembers.length <= 2 && allMembers.some((m) => m.userId === targetUserId)) {
        return room.roomId;
      }
    }

    const resp = await c.createRoom({
      preset: "trusted_private_chat" as sdk.Preset,
      invite: [targetUserId],
      is_direct: true,
      initial_state: [{
        type: "m.room.guest_access",
        state_key: "",
        content: { guest_access: "can_join" },
      }],
    });

    // Mark as direct message in account data
    try {
      const directEvent = c.getAccountData("m.direct");
      const directMap: Record<string, string[]> = directEvent ? { ...directEvent.getContent() } : {};
      if (!directMap[targetUserId]) directMap[targetUserId] = [];
      if (!directMap[targetUserId].includes(resp.room_id)) {
        directMap[targetUserId].push(resp.room_id);
      }
      await c.setAccountData("m.direct", directMap);
    } catch (err) {
      console.warn("Failed to set m.direct account data:", err);
    }

    return resp.room_id;
  }, []);

  const createGroup = useCallback(
    async (name: string, userIds: string[]): Promise<string> => {
      const c = clientRef.current;
      if (!c) throw new Error("Not connected");
      const resp = await c.createRoom({
        name,
        preset: "private_chat" as sdk.Preset,
        invite: userIds,
      });
      return resp.room_id;
    },
    [],
  );

  const createChannel = useCallback(
    async (name: string): Promise<string> => {
      const c = clientRef.current;
      if (!c) throw new Error("Not connected");
      const resp = await c.createRoom({
        name,
        preset: "public_chat" as sdk.Preset,
        visibility: "public" as sdk.Visibility,
        room_alias_name: name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      });
      return resp.room_id;
    },
    [],
  );

  const joinRoom = useCallback(async (roomIdOrAlias: string): Promise<string> => {
    const c = clientRef.current;
    if (!c) throw new Error("Not connected");
    const resp = await c.joinRoom(roomIdOrAlias);
    return resp.roomId;
  }, []);

  const leaveRoom = useCallback(async (roomId: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.leave(roomId);
    try { await c.forget(roomId); } catch { /* ok */ }
    refreshRooms();
  }, [refreshRooms]);

  const inviteUser = useCallback(async (roomId: string, userId: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.invite(roomId, userId);
  }, []);

  const searchUsers = useCallback(
    async (term: string): Promise<{ userId: string; displayName: string }[]> => {
      const c = clientRef.current;
      if (!c) return [];
      try {
        const resp = await c.searchUserDirectory({ term, limit: 50 });
        return resp.results.map((r) => ({
          userId: r.user_id,
          displayName: r.display_name || r.user_id,
        }));
      } catch (err) {
        console.warn("searchUserDirectory SDK failed, trying direct fetch:", err);
        // Fallback: direct API call (SDK sometimes has issues with this endpoint)
        try {
          const resp = await fetch(
            `${session.homeserverUrl}/_matrix/client/v3/user_directory/search`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.accessToken}`,
              },
              body: JSON.stringify({ search_term: term, limit: 50 }),
            },
          );
          if (!resp.ok) {
            console.error("User directory search failed:", resp.status, await resp.text());
            return [];
          }
          const data = await resp.json();
          return ((data as { results?: { user_id: string; display_name?: string }[] }).results || []).map((r) => ({
            userId: r.user_id,
            displayName: r.display_name || r.user_id,
          }));
        } catch (fetchErr) {
          console.error("User directory search fetch failed:", fetchErr);
          return [];
        }
      }
    },
    [session.homeserverUrl, session.accessToken],
  );

  const publicRoomsCache = useRef<{ data: MeshRoom[]; ts: number }>({ data: [], ts: 0 });

  const getPublicRooms = useCallback(async (): Promise<MeshRoom[]> => {
    // Cache for 30 seconds
    if (Date.now() - publicRoomsCache.current.ts < 30000) {
      return publicRoomsCache.current.data;
    }
    const c = clientRef.current;
    if (!c) return [];
    try {
      const resp = await c.publicRooms({ limit: 50 });
      const result = (resp.chunk || []).map((r) => ({
        id: r.room_id,
        name: r.name || r.canonical_alias || "Unnamed",
        avatar: getInitials(r.name || "??"),
        avatarUrl: null,
        type: "group" as const,
        lastMessage: r.topic || "",
        lastMessageTime: "",
        unread: 0,
        members: r.num_joined_members || 0,
      }));
      publicRoomsCache.current = { data: result, ts: Date.now() };
      return result;
    } catch {
      return [];
    }
  }, []);

  const value: MeshContextValue = {
    client: clientRef.current,
    ready,
    error,
    userId: session.userId,
    rooms,
    messageVersion,
    getMessages,
    sendMessage,
    sendMedia,
    deleteMessage,
    createDm,
    createGroup,
    createChannel,
    joinRoom,
    leaveRoom,
    inviteUser,
    searchUsers,
    getPublicRooms,
  };

  return (
    <MeshContext.Provider value={value}>{children}</MeshContext.Provider>
  );
}
