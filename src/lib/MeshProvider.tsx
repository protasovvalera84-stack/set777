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

// Registry alias for discovering public groups/channels
const REGISTRY_ALIAS_LOCAL = "meshlink-registry";

/** Ensure the registry room exists. Creates it if not found. Returns room_id or null. */
async function ensureRegistry(baseUrl: string, token: string, serverName: string): Promise<string | null> {
  const fullAlias = `#${REGISTRY_ALIAS_LOCAL}:${serverName}`;
  try {
    // Try to find existing registry
    const resp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(fullAlias)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      // Join it
      await fetch(`${baseUrl}/_matrix/client/v3/join/${encodeURIComponent(data.room_id)}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: "{}",
      }).catch(() => {});
      return data.room_id;
    }
    // Not found — create it
    const createResp = await fetch(`${baseUrl}/_matrix/client/v3/createRoom`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: "Meshlink Room Registry",
        preset: "public_chat",
        visibility: "public",
        room_alias_name: REGISTRY_ALIAS_LOCAL,
        initial_state: [
          { type: "m.room.join_rules", content: { join_rule: "public" }, state_key: "" },
          { type: "m.room.history_visibility", content: { history_visibility: "world_readable" }, state_key: "" },
        ],
      }),
    });
    if (createResp.ok) {
      const data = await createResp.json() as any;
      return data.room_id;
    }
    return null;
  } catch {
    return null;
  }
}

/** Register a room in the registry */
async function registerInRegistry(baseUrl: string, token: string, serverName: string, roomId: string, name: string, type: string): Promise<void> {
  const registryId = await ensureRegistry(baseUrl, token, serverName);
  if (!registryId) return;
  try {
    await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(registryId)}/state/org.meshlink.registry/${encodeURIComponent(roomId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, type, room_id: roomId, ts: Date.now() }),
    });
  } catch { /* non-critical */ }
}

/** Search rooms in the registry */
async function searchRegistry(baseUrl: string, token: string, serverName: string, query: string): Promise<{ id: string; name: string; type: string }[]> {
  const registryId = await ensureRegistry(baseUrl, token, serverName);
  if (!registryId) return [];
  try {
    const resp = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(registryId)}/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return [];
    const events = await resp.json() as any[];
    const lowerQuery = query.toLowerCase();
    const results: { id: string; name: string; type: string }[] = [];
    for (const event of events) {
      if (event.type === "org.meshlink.registry") {
        const content = event.content || {};
        const roomId = content.room_id || event.state_key;
        const roomName = content.name || "";
        if (roomName.toLowerCase().includes(lowerQuery)) {
          results.push({ id: roomId, name: roomName, type: content.type || "group" });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

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
  online: boolean;
}

export interface MeshMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
  topicId?: string;
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
  typingUsers: Record<string, string[]>;
  getMessages: (roomId: string) => MeshMessage[];
  sendMessage: (roomId: string, text: string, topicId?: string | null) => Promise<void>;
  sendMedia: (roomId: string, file: File, topicId?: string | null) => Promise<void>;
  deleteMessage: (roomId: string, eventId: string) => Promise<void>;
  sendTyping: (roomId: string, isTyping: boolean) => void;
  createDm: (userId: string) => Promise<string>;
  createGroup: (name: string, userIds: string[]) => Promise<string>;
  createChannel: (name: string) => Promise<string>;
  joinRoom: (roomIdOrAlias: string) => Promise<string>;
  leaveRoom: (roomId: string) => Promise<void>;
  inviteUser: (roomId: string, userId: string) => Promise<void>;
  searchUsers: (term: string) => Promise<{ userId: string; displayName: string }[]>;
  getPublicRooms: () => Promise<MeshRoom[]>;
  searchRooms: (query: string) => Promise<MeshRoom[]>;
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

function roomToMesh(room: SdkRoom, myUserId: string, directRoomIds: Set<string>, homeserverUrl: string, client?: MeshClient): MeshRoom {
  const members = room.getJoinedMembers();

  // Determine room type using multiple signals:

  // 0. Check custom Meshlink room type (most reliable — set at creation)
  let meshlinkType: string | null = null;
  try {
    const typeEvent = room.currentState.getStateEvents("org.meshlink.room_type", "");
    if (typeEvent) {
      meshlinkType = typeEvent.getContent()?.type || null;
    }
  } catch { /* ignore */ }

  // 1. Check join_rule
  let joinRule = "invite";
  try {
    joinRule = room.getJoinRule();
  } catch { /* default to invite */ }

  const isPublic = joinRule === "public";

  // 2. Check if explicitly marked as DM in m.direct account data
  const isMarkedDirect = directRoomIds.has(room.roomId);

  // 3. Check room alias to distinguish groups from channels
  const alias = room.getCanonicalAlias() || "";
  const isChannelByAlias = alias.includes("channel-") || alias.includes("chan-");
  const isGroupByAlias = alias.includes("group-");

  // 4. Check power levels — if only admins can send, it's a channel
  let isChannelByPower = false;
  try {
    const plEvent = room.currentState.getStateEvents("m.room.power_levels", "");
    if (plEvent) {
      const pl = plEvent.getContent();
      const sendLevel = pl.events_default ?? pl.events?.["m.room.message"] ?? 0;
      if (sendLevel >= 50) isChannelByPower = true;
    }
  } catch { /* ignore */ }

  // 5. Determine final type
  let roomType: "dm" | "group" | "channel";
  if (isMarkedDirect) {
    // Explicitly marked as DM — highest priority
    roomType = "dm";
  } else if (members.length <= 2 && !room.isSpaceRoom() && !isPublic && !meshlinkType) {
    // Private room with 1-2 members, no meshlink type = DM
    roomType = "dm";
  } else if (meshlinkType === "group") {
    roomType = "group";
  } else if (meshlinkType === "channel") {
    roomType = "channel";
  } else if (isChannelByAlias || isChannelByPower) {
    roomType = "channel";
  } else if (isPublic && !isGroupByAlias && members.length > 20) {
    roomType = "channel";
  } else {
    roomType = "group";
  }

  console.debug(`Room "${room.name || room.roomId}": joinRule=${joinRule}, alias=${alias}, markedDirect=${isMarkedDirect}, members=${members.length}, channelByPower=${isChannelByPower} -> type=${roomType}`);

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

  // Get room avatar URL
  let avatarUrl: string | null = null;
  try {
    const mxcAvatar = room.getAvatarUrl(homeserverUrl, 128, 128, "crop", false);
    if (mxcAvatar) {
      // Convert mxc:// to http:// if needed
      if (mxcAvatar.startsWith("mxc://")) {
        const parts = mxcAvatar.replace("mxc://", "").split("/");
        avatarUrl = `${homeserverUrl}/_matrix/media/v3/thumbnail/${parts[0]}/${parts[1]}?width=128&height=128&method=crop`;
      } else {
        avatarUrl = mxcAvatar;
      }
    }
  } catch { /* no avatar */ }

  // Check online status for DMs
  let online = false;
  if (roomType === "dm" && client) {
    const other = members.find((m) => m.userId !== myUserId);
    if (other) {
      try {
        const user = client.getUser(other.userId);
        online = user?.presence === "online" || user?.currentlyActive === true;
      } catch { /* ignore */ }
    }
  }

  return {
    id: room.roomId,
    name,
    avatar: getInitials(name),
    avatarUrl,
    type: roomType,
    lastMessage,
    lastMessageTime,
    unread: room.getUnreadNotificationCount("total") || 0,
    members: members.length,
    online,
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

  // Read topic ID from custom field
  const topicId = (content as Record<string, unknown>)["org.meshlink.topic_id"] as string | undefined;

  return {
    id: evt.getId()!,
    senderId,
    senderName: getUserDisplayName(client, senderId),
    text,
    timestamp: formatTime(evt.getTs()),
    isOwn: senderId === client.getUserId(),
    topicId,
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
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
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
      .map((r) => roomToMesh(r, session.userId, directRoomIds, session.homeserverUrl, c))
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

          // Browser push notification when tab is not focused
          if (document.hidden && Notification.permission === "granted") {
            const rooms = client.getRooms();
            for (const room of rooms) {
              const timeline = room.getLiveTimeline().getEvents();
              const lastEvt = timeline[timeline.length - 1];
              if (lastEvt && lastEvt.getSender() !== session.userId && lastEvt.getType() === "m.room.message") {
                const body = lastEvt.getContent()?.body;
                if (typeof body === "string") {
                  const senderName = lastEvt.getSender()?.split(":")[0].replace("@", "") || "Someone";
                  new Notification(`${senderName} - Meshlink`, { body, icon: "/icons/icon-256.png", tag: room.roomId });
                  // Play notification sound + vibrate
                  try {
                    const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeYl5KLgXVpXVRQUFdhaHB4f4WJi4uJhYB5cWlhWlVTVFleZW1ze4GGiYuLiYWAeXFpYVpVU1RZXmVtc3uBhomLi4mFgHlxaWFaVVNUWV5lbXN7gYaJi4uJhYB5cWlhWlVTVFleZW1ze4GGiYuLiYWAeXFpYVpVU1RZXmVtc3uBhomLi4mFgHlxaQ==");
                    audio.volume = 0.3;
                    audio.play().catch(() => {});
                  } catch { /* ignore */ }
                  if (navigator.vibrate) navigator.vibrate(200);

                  // Auto-reply bot
                  try {
                    const arSettings = JSON.parse(localStorage.getItem("meshlink-autoreply") || "{}");
                    if (arSettings.enabled && arSettings.message) {
                      let shouldReply = true;
                      if (arSettings.schedule === "outside_hours") {
                        const hour = new Date().getHours();
                        if (hour >= (arSettings.startHour || 9) && hour < (arSettings.endHour || 18)) shouldReply = false;
                      }
                      const repliedTo: string[] = arSettings.repliedTo || [];
                      const sender = lastEvt.getSender() || "";
                      if (arSettings.replyOnce && repliedTo.includes(sender)) shouldReply = false;
                      if (shouldReply) {
                        client.sendEvent(room.roomId, "m.room.message" as any, {
                          msgtype: "m.text",
                          body: arSettings.message,
                        }).catch(() => {});
                        repliedTo.push(sender);
                        localStorage.setItem("meshlink-autoreply", JSON.stringify({ ...arSettings, repliedTo }));
                      }
                    }
                  } catch { /* ignore */ }

                  break;
                }
              }
            }
          }
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

      // Typing indicator: listen for typing events
      client.on(sdk.RoomMemberEvent.Typing, (_event: MeshEvent, member: { userId: string; typing: boolean; roomId?: string }) => {
        if (member.userId === session.userId) return;
        // Get the room from the member's events
        const rooms = client.getRooms();
        for (const room of rooms) {
          const typingMembers = room.getMembers().filter((m) => m.typing && m.userId !== session.userId);
          const names = typingMembers.map((m) => m.name || m.userId.split(":")[0].replace("@", ""));
          setTypingUsers((prev) => {
            const updated = { ...prev };
            if (names.length > 0) {
              updated[room.roomId] = names;
            } else {
              delete updated[room.roomId];
            }
            return updated;
          });
        }
      });

      await startClient(client);
      if (!cancelled) {
        setReady(true);
        refreshRooms();
      }

      // Reconnect on connection loss
      const handleOnline = () => {
        console.log("[Meshlink] Network restored, resyncing...");
        refreshRooms();
      };
      const handleVisibility = () => {
        if (!document.hidden && clientRef.current) {
          refreshRooms();
        }
      };
      window.addEventListener("online", handleOnline);
      document.addEventListener("visibilitychange", handleVisibility);

      // Cleanup listeners on unmount
      const cleanupListeners = () => {
        window.removeEventListener("online", handleOnline);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
      // Store cleanup for later
      (client as any).__meshCleanup = cleanupListeners;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (clientRef.current as any).__meshCleanup?.();
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

  const sendMessage = useCallback(async (roomId: string, text: string, topicId?: string | null) => {
    const c = clientRef.current;
    if (!c) return;
    const content: Record<string, unknown> = {
      msgtype: "m.text",
      body: text,
    };
    if (topicId) {
      content["org.meshlink.topic_id"] = topicId;
    }
    await c.sendEvent(roomId, "m.room.message" as Parameters<typeof c.sendEvent>[1], content);
  }, []);

  const sendMedia = useCallback(async (roomId: string, file: File, topicId?: string | null) => {
    const c = clientRef.current;
    if (!c) return;
    const mxcUri = await uploadMedia(session.accessToken, file);
    let msgtype = "m.file";
    if (file.type.startsWith("image/")) msgtype = "m.image";
    else if (file.type.startsWith("video/")) msgtype = "m.video";
    else if (file.type.startsWith("audio/")) msgtype = "m.audio";
    const content: Record<string, unknown> = {
      msgtype,
      body: file.name,
      url: mxcUri,
      info: { mimetype: file.type, size: file.size },
    };
    if (topicId) {
      content["org.meshlink.topic_id"] = topicId;
    }
    await c.sendEvent(roomId, "m.room.message" as Parameters<typeof c.sendEvent>[1], content);
  }, [session.accessToken]);

  const deleteMessage = useCallback(async (roomId: string, eventId: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.redactEvent(roomId, eventId);
  }, []);

  const sendTypingIndicator = useCallback((roomId: string, isTyping: boolean) => {
    const c = clientRef.current;
    if (!c) return;
    c.sendTyping(roomId, isTyping, 30000).catch(() => {});
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
        preset: "public_chat" as sdk.Preset,
        visibility: "public" as sdk.Visibility,
        room_alias_name: `group-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36).slice(-4)}`,
        invite: userIds,
        initial_state: [
          { type: "m.room.history_visibility", content: { history_visibility: "shared" }, state_key: "" },
          { type: "org.meshlink.room_type", content: { type: "group" }, state_key: "" },
        ],
      });
      // Explicitly publish to room directory
      try {
        await fetch(`${c.getHomeserverUrl()}/_matrix/client/v3/directory/list/room/${encodeURIComponent(resp.room_id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.getAccessToken()}` },
          body: JSON.stringify({ visibility: "public" }),
        });
      } catch { /* non-critical */ }
      // Register in Meshlink registry for discoverability
      const serverName = session.userId.split(":")[1];
      await registerInRegistry(c.getHomeserverUrl(), c.getAccessToken() || "", serverName, resp.room_id, name, "group");
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
        room_alias_name: `channel-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36).slice(-4)}`,
        power_level_content_override: {
          events_default: 50, // Only moderators+ can send messages
          invite: 50,
        },
        initial_state: [
          { type: "m.room.history_visibility", content: { history_visibility: "world_readable" }, state_key: "" },
          { type: "org.meshlink.room_type", content: { type: "channel" }, state_key: "" },
        ],
      });
      // Explicitly publish to room directory
      try {
        await fetch(`${c.getHomeserverUrl()}/_matrix/client/v3/directory/list/room/${encodeURIComponent(resp.room_id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.getAccessToken()}` },
          body: JSON.stringify({ visibility: "public" }),
        });
      } catch { /* non-critical */ }
      // Register in Meshlink registry
      const serverName = session.userId.split(":")[1];
      await registerInRegistry(c.getHomeserverUrl(), c.getAccessToken() || "", serverName, resp.room_id, name, "channel");
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
    // Cache for 10 seconds
    if (Date.now() - publicRoomsCache.current.ts < 10000) {
      return publicRoomsCache.current.data;
    }
    const c = clientRef.current;
    if (!c) return [];
    try {
      // Try SDK method first (handles URL/auth automatically)
      const resp = await c.publicRooms({ limit: 100 });
      const chunk = resp.chunk || [];
      const result = chunk.map((r) => {
        const alias = r.canonical_alias || "";
        const roomType = alias.includes("channel-") ? "channel" as const : "group" as const;
        return {
          id: r.room_id,
          name: r.name || r.canonical_alias || "Unnamed",
          avatar: getInitials(r.name || "??"),
          avatarUrl: null,
          type: roomType,
          lastMessage: r.topic || "",
          lastMessageTime: "",
          unread: 0,
          members: r.num_joined_members || 0,
          online: false,
        };
      });
      publicRoomsCache.current = { data: result, ts: Date.now() };
      return result;
    } catch (err) {
      console.warn("publicRooms SDK failed, trying HTTP fallback:", err);
      // Fallback: direct HTTP
      try {
        const baseUrl = c.getHomeserverUrl();
        const token = c.getAccessToken();
        const resp = await fetch(`${baseUrl}/_matrix/client/v3/publicRooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ limit: 100 }),
        });
        if (!resp.ok) {
          // Try r0 endpoint
          const resp2 = await fetch(`${baseUrl}/_matrix/client/r0/publicRooms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ limit: 100 }),
          });
          if (!resp2.ok) return [];
          const data2 = await resp2.json();
          return ((data2 as any).chunk || []).map((r: any) => ({
            id: r.room_id,
            name: r.name || "Unnamed",
            avatar: getInitials(r.name || "??"),
            avatarUrl: null,
            type: "group" as const,
            lastMessage: "", lastMessageTime: "", unread: 0,
            members: r.num_joined_members || 0, online: false,
          }));
        }
        const data = await resp.json();
        const result = ((data as any).chunk || []).map((r: any) => ({
          id: r.room_id,
          name: r.name || "Unnamed",
          avatar: getInitials(r.name || "??"),
          avatarUrl: null,
          type: "group" as const,
          lastMessage: "", lastMessageTime: "", unread: 0,
          members: r.num_joined_members || 0, online: false,
        }));
        publicRoomsCache.current = { data: result, ts: Date.now() };
        return result;
      } catch {
        return [];
      }
    }
  }, []);

  // Search public rooms by name (with filter + alias fallback)
  const searchRooms = useCallback(async (query: string): Promise<MeshRoom[]> => {
    const c = clientRef.current;
    if (!c || !query.trim()) return [];
    const results: MeshRoom[] = [];
    const baseUrl = c.getHomeserverUrl();
    const token = c.getAccessToken() || "";
    const serverName = session.userId.split(":")[1];

    // Method 1: Meshlink Registry (most reliable for our server)
    const registryResults = await searchRegistry(baseUrl, token, serverName, query);
    for (const r of registryResults) {
      results.push({
        id: r.id,
        name: r.name,
        avatar: getInitials(r.name),
        avatarUrl: null,
        type: r.type === "channel" ? "channel" : "group",
        lastMessage: "",
        lastMessageTime: "",
        unread: 0,
        members: 0,
        online: false,
      });
    }

    // Method 2: publicRooms API (works if server allows it)
    if (results.length === 0) {
      try {
        const resp = await fetch(`${baseUrl}/_matrix/client/v3/publicRooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ limit: 50, filter: { generic_search_term: query } }),
        });
        if (resp.ok) {
          const data = await resp.json() as any;
          for (const r of (data.chunk || [])) {
            if (!results.find((x) => x.id === r.room_id)) {
              const alias = r.canonical_alias || "";
              results.push({
                id: r.room_id,
                name: r.name || "Unnamed",
                avatar: getInitials(r.name || "??"),
                avatarUrl: null,
                type: alias.includes("channel-") ? "channel" : "group",
                lastMessage: r.topic || "",
                lastMessageTime: "",
                unread: 0,
                members: r.num_joined_members || 0,
                online: false,
              });
            }
          }
        }
      } catch { /* optional */ }
    }

    // Method 3: Alias lookup (exact match)
    if (results.length === 0) {
      const slug = query.toLowerCase().replace(/[^a-z0-9]/g, "-");
      for (const prefix of ["group-", "channel-", ""]) {
        try {
          const alias = `#${prefix}${slug}:${serverName}`;
          const resp = await fetch(`${baseUrl}/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (resp.ok) {
            const data = await resp.json() as any;
            if (data.room_id && !results.find((r) => r.id === data.room_id)) {
              results.push({
                id: data.room_id,
                name: query,
                avatar: getInitials(query),
                avatarUrl: null,
                type: prefix.includes("channel") ? "channel" : "group",
                lastMessage: "",
                lastMessageTime: "",
                unread: 0,
                members: 0,
                online: false,
              });
            }
          }
        } catch { /* continue */ }
      }
    }

    return results;
  }, [session.homeserverUrl, session.userId]);


  const value: MeshContextValue = {
    client: clientRef.current,
    ready,
    error,
    userId: session.userId,
    rooms,
    messageVersion,
    typingUsers,
    getMessages,
    sendMessage,
    sendMedia,
    deleteMessage,
    sendTyping: sendTypingIndicator,
    createDm,
    createGroup,
    createChannel,
    joinRoom,
    leaveRoom,
    inviteUser,
    searchUsers,
    getPublicRooms,
    searchRooms,
  };

  return (
    <MeshContext.Provider value={value}>{children}</MeshContext.Provider>
  );
}
