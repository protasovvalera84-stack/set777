using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Meshlink.Services
{
    /// <summary>
    /// Matrix Client-Server API — all HTTP calls to Matrix server.
    /// </summary>
    public class MatrixClient
    {
        private readonly HttpClient _http;
        private readonly string _baseUrl;

        public MatrixClient(string baseUrl)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (_, _, _, _) => true // Accept self-signed
            };
            _http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(60) };
        }

        // ===== Auth =====

        public async Task<LoginResponse> LoginAsync(string user, string password)
        {
            var body = JsonConvert.SerializeObject(new
            {
                type = "m.login.password",
                user,
                password,
                initial_device_display_name = "Meshlink Windows"
            });
            var resp = await PostAsync("/_matrix/client/v3/login", body);
            return JsonConvert.DeserializeObject<LoginResponse>(resp)!;
        }

        public async Task<LoginResponse> RegisterAsync(string user, string password)
        {
            var body = JsonConvert.SerializeObject(new
            {
                username = user,
                password,
                auth = new { type = "m.login.dummy" },
                initial_device_display_name = "Meshlink Windows"
            });
            var resp = await PostAsync("/_matrix/client/v3/register", body);
            return JsonConvert.DeserializeObject<LoginResponse>(resp)!;
        }

        public async Task LogoutAsync(string token)
        {
            await PostAsync("/_matrix/client/v3/logout", "{}", token);
        }

        // ===== Rooms =====

        public async Task<List<string>> GetJoinedRoomsAsync(string token)
        {
            var resp = await GetAsync("/_matrix/client/v3/joined_rooms", token);
            var json = JObject.Parse(resp);
            return json["joined_rooms"]?.ToObject<List<string>>() ?? new List<string>();
        }

        public async Task<RoomInfo> GetRoomStateAsync(string roomId, string token)
        {
            var encoded = Uri.EscapeDataString(roomId);
            var resp = await GetAsync($"/_matrix/client/v3/rooms/{encoded}/state", token);
            var events = JArray.Parse(resp);
            string name = roomId, avatar = null, topic = null;
            foreach (var evt in events)
            {
                var type = evt["type"]?.ToString();
                if (type == "m.room.name") name = evt["content"]?["name"]?.ToString() ?? name;
                if (type == "m.room.avatar") avatar = evt["content"]?["url"]?.ToString();
                if (type == "m.room.topic") topic = evt["content"]?["topic"]?.ToString();
            }
            return new RoomInfo { RoomId = roomId, Name = name, AvatarUrl = avatar, Topic = topic };
        }

        public async Task<List<Message>> GetMessagesAsync(string roomId, string token, int limit = 50)
        {
            var encoded = Uri.EscapeDataString(roomId);
            var resp = await GetAsync($"/_matrix/client/v3/rooms/{encoded}/messages?dir=b&limit={limit}", token);
            var json = JObject.Parse(resp);
            var messages = new List<Message>();
            foreach (var evt in json["chunk"] ?? new JArray())
            {
                if (evt["type"]?.ToString() != "m.room.message") continue;
                var content = evt["content"];
                messages.Add(new Message
                {
                    EventId = evt["event_id"]?.ToString() ?? "",
                    RoomId = roomId,
                    Sender = evt["sender"]?.ToString() ?? "",
                    Body = content?["body"]?.ToString() ?? "",
                    MsgType = content?["msgtype"]?.ToString() ?? "m.text",
                    Timestamp = evt["origin_server_ts"]?.ToObject<long>() ?? 0,
                    MediaUrl = content?["url"]?.ToString()
                });
            }
            return messages;
        }

        public async Task<string> SendMessageAsync(string roomId, string text, string token)
        {
            var encoded = Uri.EscapeDataString(roomId);
            var txn = $"m{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var body = JsonConvert.SerializeObject(new { msgtype = "m.text", body = text });
            var resp = await PutAsync($"/_matrix/client/v3/rooms/{encoded}/send/m.room.message/{txn}", body, token);
            return JObject.Parse(resp)["event_id"]?.ToString() ?? "";
        }

        public async Task<string?> CreateRoomAsync(string name, string preset, string token)
        {
            var body = JsonConvert.SerializeObject(new { name, preset });
            var resp = await PostAsync("/_matrix/client/v3/createRoom", body, token);
            return JObject.Parse(resp)["room_id"]?.ToString();
        }

        public async Task<SyncResponse> SyncAsync(string token, string? since = null, int timeout = 30000)
        {
            var url = $"/_matrix/client/v3/sync?timeout={timeout}";
            if (since != null) url += $"&since={since}";
            var resp = await GetAsync(url, token);
            return JsonConvert.DeserializeObject<SyncResponse>(resp)!;
        }

        public async Task SendReactionAsync(string roomId, string eventId, string emoji, string token)
        {
            var encoded = Uri.EscapeDataString(roomId);
            var txn = $"react{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var body = JsonConvert.SerializeObject(new
            {
                m_relates_to = new { rel_type = "m.annotation", event_id = eventId, key = emoji }
            });
            await PutAsync($"/_matrix/client/v3/rooms/{encoded}/send/m.reaction/{txn}", body, token);
        }

        public async Task<List<UserSearchResult>> SearchUsersAsync(string query, string token, int limit = 20)
        {
            var body = JsonConvert.SerializeObject(new { search_term = query, limit });
            var resp = await PostAsync("/_matrix/client/v3/user_directory/search", body, token);
            var json = JObject.Parse(resp);
            var results = new List<UserSearchResult>();
            foreach (var r in json["results"] ?? new JArray())
            {
                results.Add(new UserSearchResult
                {
                    UserId = r["user_id"]?.ToString() ?? "",
                    DisplayName = r["display_name"]?.ToString(),
                    AvatarUrl = r["avatar_url"]?.ToString()
                });
            }
            return results;
        }

        public string? MxcToHttp(string? mxcUrl)
        {
            if (mxcUrl == null || !mxcUrl.StartsWith("mxc://")) return null;
            var parts = mxcUrl.Replace("mxc://", "").Split('/', 2);
            return parts.Length == 2 ? $"{_baseUrl}/_matrix/media/v3/download/{parts[0]}/{parts[1]}" : null;
        }

        // ===== HTTP helpers =====

        private async Task<string> GetAsync(string path, string? token = null)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}{path}");
            if (token != null) request.Headers.Add("Authorization", $"Bearer {token}");
            var resp = await _http.SendAsync(request);
            return await resp.Content.ReadAsStringAsync();
        }

        private async Task<string> PostAsync(string path, string json, string? token = null)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}{path}")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            if (token != null) request.Headers.Add("Authorization", $"Bearer {token}");
            var resp = await _http.SendAsync(request);
            return await resp.Content.ReadAsStringAsync();
        }

        private async Task<string> PutAsync(string path, string json, string? token = null)
        {
            var request = new HttpRequestMessage(HttpMethod.Put, $"{_baseUrl}{path}")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            if (token != null) request.Headers.Add("Authorization", $"Bearer {token}");
            var resp = await _http.SendAsync(request);
            return await resp.Content.ReadAsStringAsync();
        }
    }

    // ===== Data classes =====

    public class LoginResponse
    {
        [JsonProperty("user_id")] public string? UserId { get; set; }
        [JsonProperty("access_token")] public string? AccessToken { get; set; }
        [JsonProperty("device_id")] public string? DeviceId { get; set; }
        [JsonProperty("errcode")] public string? ErrorCode { get; set; }
        [JsonProperty("error")] public string? Error { get; set; }
    }

    public class RoomInfo
    {
        public string RoomId { get; set; } = "";
        public string Name { get; set; } = "";
        public string? AvatarUrl { get; set; }
        public string? Topic { get; set; }
    }

    public class Message
    {
        public string EventId { get; set; } = "";
        public string RoomId { get; set; } = "";
        public string Sender { get; set; } = "";
        public string Body { get; set; } = "";
        public string MsgType { get; set; } = "m.text";
        public long Timestamp { get; set; }
        public string? MediaUrl { get; set; }
    }

    public class SyncResponse
    {
        [JsonProperty("next_batch")] public string? NextBatch { get; set; }
        [JsonProperty("rooms")] public SyncRooms? Rooms { get; set; }
    }

    public class SyncRooms
    {
        [JsonProperty("join")] public Dictionary<string, SyncJoinedRoom>? Join { get; set; }
    }

    public class SyncJoinedRoom
    {
        [JsonProperty("timeline")] public SyncTimeline? Timeline { get; set; }
    }

    public class SyncTimeline
    {
        [JsonProperty("events")] public List<JObject>? Events { get; set; }
    }

    public class UserSearchResult
    {
        public string UserId { get; set; } = "";
        public string? DisplayName { get; set; }
        public string? AvatarUrl { get; set; }
    }
}
