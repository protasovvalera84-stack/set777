using System;
using System.IO;

namespace Meshlink.Helpers
{
    /// <summary>
    /// Utility helpers for the Windows app.
    /// </summary>
    public static class Utils
    {
        /// <summary>Format bytes to human-readable string.</summary>
        public static string FormatSize(long bytes) => bytes switch
        {
            < 1024 => $"{bytes} B",
            < 1024 * 1024 => $"{bytes / 1024} KB",
            < 1024L * 1024 * 1024 => $"{bytes / (1024 * 1024)} MB",
            _ => $"{bytes / (1024.0 * 1024 * 1024):F1} GB"
        };

        /// <summary>Format timestamp to relative time.</summary>
        public static string RelativeTime(long timestampMs)
        {
            var diff = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - timestampMs;
            return diff switch
            {
                < 60_000 => "just now",
                < 3600_000 => $"{diff / 60_000}m ago",
                < 86400_000 => $"{diff / 3600_000}h ago",
                < 172800_000 => "yesterday",
                _ => DateTimeOffset.FromUnixTimeMilliseconds(timestampMs).LocalDateTime.ToString("dd.MM.yyyy")
            };
        }

        /// <summary>Extract username from Matrix user ID.</summary>
        public static string MatrixUsername(string userId)
            => userId.Split(':')[0].TrimStart('@');

        /// <summary>Extract server from Matrix user ID.</summary>
        public static string MatrixServer(string userId)
            => userId.Contains(':') ? userId[(userId.IndexOf(':') + 1)..] : "";

        /// <summary>Get initials from name.</summary>
        public static string Initials(string name)
        {
            var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return parts.Length >= 2
                ? $"{parts[0][0]}{parts[1][0]}".ToUpper()
                : name.Length >= 2 ? name[..2].ToUpper() : name.ToUpper();
        }

        /// <summary>Get app data directory.</summary>
        public static string AppDataDir => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Meshlink");

        /// <summary>Get total app data size.</summary>
        public static long GetAppDataSize()
        {
            var dir = new DirectoryInfo(AppDataDir);
            if (!dir.Exists) return 0;
            long size = 0;
            foreach (var file in dir.GetFiles("*", SearchOption.AllDirectories))
                size += file.Length;
            return size;
        }

        /// <summary>Clear all app data except credentials.</summary>
        public static void ClearAppData()
        {
            var dir = new DirectoryInfo(AppDataDir);
            if (!dir.Exists) return;
            foreach (var subDir in dir.GetDirectories())
            {
                if (subDir.Name == ".secure") continue; // Keep credentials
                subDir.Delete(true);
            }
        }

        /// <summary>Get MIME type from file extension.</summary>
        public static string GetMimeType(string fileName)
        {
            var ext = Path.GetExtension(fileName).ToLower();
            return ext switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".webp" => "image/webp",
                ".mp4" => "video/mp4",
                ".webm" => "video/webm",
                ".mp3" => "audio/mpeg",
                ".ogg" => "audio/ogg",
                ".pdf" => "application/pdf",
                _ => "application/octet-stream"
            };
        }
    }
}
