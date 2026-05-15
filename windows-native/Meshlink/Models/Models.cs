namespace Meshlink.Models
{
    /// <summary>Room model — cached in local SQLite.</summary>
    public class RoomModel
    {
        public string RoomId { get; set; } = "";
        public string Name { get; set; } = "";
        public string? AvatarUrl { get; set; }
        public string? Topic { get; set; }
        public string? LastMessage { get; set; }
        public long LastMessageTime { get; set; }
        public int UnreadCount { get; set; }
        public bool IsDirect { get; set; }

        public string Initials => Name.Length >= 2 ? Name[..2].ToUpper() : Name.ToUpper();
        public string TimeDisplay => LastMessageTime > 0
            ? DateTimeOffset.FromUnixTimeMilliseconds(LastMessageTime).LocalDateTime.ToString("HH:mm")
            : "";
    }

    /// <summary>Message model — cached in local SQLite.</summary>
    public class MessageModel
    {
        public string EventId { get; set; } = "";
        public string RoomId { get; set; } = "";
        public string Sender { get; set; } = "";
        public string Body { get; set; } = "";
        public string MsgType { get; set; } = "m.text";
        public long Timestamp { get; set; }
        public string? MediaUrl { get; set; }

        public string SenderName => Sender.Split(':')[0].TrimStart('@');
        public string TimeDisplay => DateTimeOffset.FromUnixTimeMilliseconds(Timestamp).LocalDateTime.ToString("HH:mm");
        public string TypeIcon => MsgType switch
        {
            "m.image" => "📷",
            "m.video" => "🎬",
            "m.audio" => "🎤",
            "m.file" => "📎",
            _ => ""
        };
    }
}
