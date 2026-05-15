using System;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Meshlink.Services
{
    /// <summary>
    /// Background sync service — polls Matrix server for new events.
    /// Stores messages in local SQLite. Shows Windows notifications.
    /// </summary>
    public class SyncService
    {
        private CancellationTokenSource? _cts;
        private string? _nextBatch;
        public event Action<string, string, string>? OnNewMessage; // roomId, sender, body

        public void Start()
        {
            if (_cts != null) return;
            _cts = new CancellationTokenSource();
            _ = SyncLoopAsync(_cts.Token);
        }

        public void Stop()
        {
            _cts?.Cancel();
            _cts = null;
        }

        private async Task SyncLoopAsync(CancellationToken ct)
        {
            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            while (!ct.IsCancellationRequested)
            {
                try
                {
                    var resp = await App.MatrixClient.SyncAsync(token, _nextBatch, 30000);
                    if (resp.NextBatch != null) _nextBatch = resp.NextBatch;

                    if (resp.Rooms?.Join != null)
                    {
                        foreach (var (roomId, room) in resp.Rooms.Join)
                        {
                            if (room.Timeline?.Events == null) continue;
                            foreach (var evt in room.Timeline.Events)
                            {
                                ProcessEvent(roomId, evt);
                            }
                        }
                    }
                }
                catch (TaskCanceledException) { break; }
                catch
                {
                    await Task.Delay(5000, ct);
                }
            }
        }

        private void ProcessEvent(string roomId, JObject evt)
        {
            var type = evt["type"]?.ToString();
            if (type != "m.room.message") return;

            var content = evt["content"];
            var sender = evt["sender"]?.ToString() ?? "";
            var body = content?["body"]?.ToString() ?? "";
            var eventId = evt["event_id"]?.ToString() ?? "";
            var timestamp = evt["origin_server_ts"]?.ToObject<long>() ?? 0;
            var msgtype = content?["msgtype"]?.ToString() ?? "m.text";

            // Save to local DB
            App.Database.UpsertMessage(new Models.MessageModel
            {
                EventId = eventId,
                RoomId = roomId,
                Sender = sender,
                Body = body,
                MsgType = msgtype,
                Timestamp = timestamp,
                MediaUrl = content?["url"]?.ToString()
            });

            // Notify if from others
            var myUserId = App.SecureStorage.GetValue("user_id");
            if (sender != myUserId)
            {
                OnNewMessage?.Invoke(roomId, sender, body);
                App.NotificationService.ShowNotification(
                    sender.Split(':')[0].TrimStart('@'),
                    body
                );
            }
        }
    }
}
