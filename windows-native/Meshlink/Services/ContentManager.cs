using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Meshlink.Services
{
    /// <summary>
    /// Content manager — handles Shorts, Music, Video, Marketplace rooms.
    /// Loads content from Matrix rooms, caches locally.
    /// </summary>
    public class ContentManager
    {
        private readonly MatrixClient _client;
        private readonly string _serverName;

        public ContentManager(MatrixClient client, string userId)
        {
            _client = client;
            _serverName = userId.Contains(':') ? userId.Split(':')[1] : "";
        }

        public class ContentItem
        {
            public string Id { get; set; } = "";
            public string Title { get; set; } = "";
            public string Author { get; set; } = "";
            public string Url { get; set; } = "";
            public string Type { get; set; } = "";
            public long Timestamp { get; set; }
            public string? ImageUrl { get; set; }
            public string? Price { get; set; }
            public string? Category { get; set; }
        }

        /// <summary>Load shorts from #meshlink-shorts-v3 room.</summary>
        public async Task<List<ContentItem>> LoadShortsAsync(string token)
            => await LoadFromRoom("meshlink-shorts-v3", "org.meshlink.short_post", token);

        /// <summary>Load videos from #meshlink-videos room.</summary>
        public async Task<List<ContentItem>> LoadVideosAsync(string token)
            => await LoadFromRoom("meshlink-videos", null, token);

        /// <summary>Load music from #meshlink-music room.</summary>
        public async Task<List<ContentItem>> LoadMusicAsync(string token)
            => await LoadFromRoom("meshlink-music", null, token);

        /// <summary>Load marketplace listings.</summary>
        public async Task<List<ContentItem>> LoadMarketAsync(string token)
            => await LoadFromRoom("meshlink-market", "org.meshlink.listing", token);

        private async Task<List<ContentItem>> LoadFromRoom(string alias, string? eventType, string token)
        {
            var items = new List<ContentItem>();
            try
            {
                var serverUrl = App.SecureStorage.GetValue("server_url") ?? "";
                var fullAlias = Uri.EscapeDataString($"#{alias}:{_serverName}");
                var http = new HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

                var aliasResp = await http.GetStringAsync($"{serverUrl}/_matrix/client/v3/directory/room/{fullAlias}");
                var roomId = JObject.Parse(aliasResp)["room_id"]?.ToString();
                if (roomId == null) return items;

                // Join room
                var joinBody = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");
                await http.PostAsync($"{serverUrl}/_matrix/client/v3/join/{Uri.EscapeDataString(roomId)}", joinBody);

                var encoded = Uri.EscapeDataString(roomId);
                var msgResp = await http.GetStringAsync($"{serverUrl}/_matrix/client/v3/rooms/{encoded}/messages?dir=b&limit=50");
                var json = JObject.Parse(msgResp);

                foreach (var evt in json["chunk"] ?? new JArray())
                {
                    var type = evt["type"]?.ToString();
                    if (eventType != null && type != eventType) continue;
                    if (eventType == null && type != "m.room.message") continue;

                    var c = evt["content"];
                    var item = new ContentItem
                    {
                        Id = evt["event_id"]?.ToString() ?? "",
                        Title = c?["title"]?.ToString() ?? c?["body"]?.ToString() ?? "Untitled",
                        Author = evt["sender"]?.ToString()?.Split(':')[0].TrimStart('@') ?? "",
                        Url = c?["url"]?.ToString() ?? "",
                        Type = c?["mediaType"]?.ToString() ?? c?["msgtype"]?.ToString() ?? "",
                        Timestamp = evt["origin_server_ts"]?.ToObject<long>() ?? 0,
                        ImageUrl = c?["imageUrl"]?.ToString(),
                        Price = c?["price"]?.ToString(),
                        Category = c?["category"]?.ToString()
                    };
                    items.Add(item);
                }
            }
            catch { /* room may not exist */ }
            return items;
        }
    }
}
