using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;

namespace Meshlink.Services
{
    /// <summary>
    /// Media cache — downloads and caches media files locally.
    /// All files in AppData\Local\Meshlink\.media (hidden, auto-deleted).
    /// </summary>
    public class MediaCache
    {
        private readonly string _cacheDir;
        private readonly HttpClient _http;

        public MediaCache()
        {
            _cacheDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Meshlink", ".media"
            );
            Directory.CreateDirectory(_cacheDir);
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
        }

        /// <summary>Download media and cache locally. Returns local file path.</summary>
        public async Task<string?> GetMediaAsync(string httpUrl, string? token = null)
        {
            var fileName = httpUrl.GetHashCode().ToString("x") + GetExtension(httpUrl);
            var localPath = Path.Combine(_cacheDir, fileName);

            if (File.Exists(localPath)) return localPath;

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, httpUrl);
                if (token != null) request.Headers.Add("Authorization", $"Bearer {token}");
                var resp = await _http.SendAsync(request);
                if (!resp.IsSuccessStatusCode) return null;

                var bytes = await resp.Content.ReadAsByteArrayAsync();
                await File.WriteAllBytesAsync(localPath, bytes);
                return localPath;
            }
            catch { return null; }
        }

        /// <summary>Upload file to Matrix media server.</summary>
        public async Task<string?> UploadAsync(string filePath, string token, string baseUrl)
        {
            try
            {
                var fileName = Path.GetFileName(filePath);
                var bytes = await File.ReadAllBytesAsync(filePath);
                var content = new ByteArrayContent(bytes);
                content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(GetMimeType(fileName));

                var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/_matrix/media/v3/upload?filename={fileName}")
                {
                    Content = content
                };
                request.Headers.Add("Authorization", $"Bearer {token}");

                var resp = await _http.SendAsync(request);
                var json = await resp.Content.ReadAsStringAsync();
                var obj = Newtonsoft.Json.Linq.JObject.Parse(json);
                return obj["content_uri"]?.ToString();
            }
            catch { return null; }
        }

        public long GetCacheSize()
        {
            long size = 0;
            if (Directory.Exists(_cacheDir))
                foreach (var file in Directory.GetFiles(_cacheDir))
                    size += new FileInfo(file).Length;
            return size;
        }

        public void ClearCache()
        {
            if (Directory.Exists(_cacheDir))
                foreach (var file in Directory.GetFiles(_cacheDir))
                    File.Delete(file);
        }

        private string GetExtension(string url)
        {
            if (url.Contains(".jpg") || url.Contains(".jpeg")) return ".jpg";
            if (url.Contains(".png")) return ".png";
            if (url.Contains(".mp4")) return ".mp4";
            if (url.Contains(".webm")) return ".webm";
            return ".bin";
        }

        private string GetMimeType(string fileName)
        {
            var ext = Path.GetExtension(fileName).ToLower();
            return ext switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
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
