using System;
using Meshlink.Helpers;
using Meshlink.Services;

namespace Meshlink.Tests
{
    /// <summary>
    /// Unit tests for Windows native app.
    /// Run with: dotnet test
    /// </summary>
    public class MeshlinkTests
    {
        // ===== Utils =====

        public static void TestFormatSize()
        {
            Assert(Utils.FormatSize(0) == "0 B");
            Assert(Utils.FormatSize(512) == "512 B");
            Assert(Utils.FormatSize(1024) == "1 KB");
            Assert(Utils.FormatSize(1048576) == "1 MB");
            Console.WriteLine("✅ FormatSize");
        }

        public static void TestMatrixUsername()
        {
            Assert(Utils.MatrixUsername("@admin:server.com") == "admin");
            Assert(Utils.MatrixUsername("@user123:matrix.org") == "user123");
            Console.WriteLine("✅ MatrixUsername");
        }

        public static void TestMatrixServer()
        {
            Assert(Utils.MatrixServer("@admin:server.com") == "server.com");
            Assert(Utils.MatrixServer("@admin:server.com:8448") == "server.com:8448");
            Console.WriteLine("✅ MatrixServer");
        }

        public static void TestInitials()
        {
            Assert(Utils.Initials("John Doe") == "JD");
            Assert(Utils.Initials("Admin") == "AD");
            Assert(Utils.Initials("A") == "A");
            Console.WriteLine("✅ Initials");
        }

        public static void TestGetMimeType()
        {
            Assert(Utils.GetMimeType("photo.jpg") == "image/jpeg");
            Assert(Utils.GetMimeType("video.mp4") == "video/mp4");
            Assert(Utils.GetMimeType("song.mp3") == "audio/mpeg");
            Assert(Utils.GetMimeType("doc.pdf") == "application/pdf");
            Assert(Utils.GetMimeType("file.xyz") == "application/octet-stream");
            Console.WriteLine("✅ GetMimeType");
        }

        // ===== MatrixClient =====

        public static void TestMxcToHttp()
        {
            var client = new MatrixClient("https://example.com");
            Assert(client.MxcToHttp("mxc://example.com/abc123") == "https://example.com/_matrix/media/v3/download/example.com/abc123");
            Assert(client.MxcToHttp(null) == null);
            Assert(client.MxcToHttp("https://not-mxc") == null);
            Assert(client.MxcToHttp("mxc://noslash") == null);
            Console.WriteLine("✅ MxcToHttp");
        }

        // ===== Models =====

        public static void TestRoomModel()
        {
            var room = new Models.RoomModel { RoomId = "!abc", Name = "Test Room", LastMessageTime = 1700000000000 };
            Assert(room.Initials == "TE");
            Assert(room.TimeDisplay != "");
            Console.WriteLine("✅ RoomModel");
        }

        public static void TestMessageModel()
        {
            var msg = new Models.MessageModel { EventId = "e1", Sender = "@admin:server", Body = "Hello", MsgType = "m.text", Timestamp = 1700000000000 };
            Assert(msg.SenderName == "admin");
            Assert(msg.TypeIcon == "");
            var imgMsg = new Models.MessageModel { MsgType = "m.image" };
            Assert(imgMsg.TypeIcon == "📷");
            var audioMsg = new Models.MessageModel { MsgType = "m.audio" };
            Assert(audioMsg.TypeIcon == "🎤");
            Console.WriteLine("✅ MessageModel");
        }

        // ===== LoginResponse =====

        public static void TestLoginResponse()
        {
            var success = new LoginResponse { UserId = "@user:s", AccessToken = "token", DeviceId = "DEV" };
            Assert(success.AccessToken != null);
            Assert(success.ErrorCode == null);
            var error = new LoginResponse { ErrorCode = "M_FORBIDDEN", Error = "Bad password" };
            Assert(error.AccessToken == null);
            Assert(error.ErrorCode == "M_FORBIDDEN");
            Console.WriteLine("✅ LoginResponse");
        }

        // ===== Encryption =====

        public static void TestEncryptedPayload()
        {
            var payload = new EncryptedPayload { Ciphertext = "ct", EncryptedKey = "ek", IV = "iv" };
            Assert(payload.Ciphertext == "ct");
            Assert(payload.EncryptedKey == "ek");
            Assert(payload.IV == "iv");
            Console.WriteLine("✅ EncryptedPayload");
        }

        // ===== OfflineQueue =====

        public static void TestQueuedMessage()
        {
            var msg = new OfflineQueue.QueuedMessage { RoomId = "!room", Body = "Hello", Retries = 3 };
            Assert(msg.Retries == 3);
            Assert(msg.Body == "Hello");
            Console.WriteLine("✅ QueuedMessage");
        }

        // ===== RelativeTime =====

        public static void TestRelativeTime()
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            Assert(Utils.RelativeTime(now) == "just now");
            Assert(Utils.RelativeTime(now - 300000).Contains("m ago"));
            Console.WriteLine("✅ RelativeTime");
        }

        // ===== Run all =====

        public static void RunAll()
        {
            Console.WriteLine("=== Meshlink Windows Tests ===");
            TestFormatSize();
            TestMatrixUsername();
            TestMatrixServer();
            TestInitials();
            TestGetMimeType();
            TestMxcToHttp();
            TestRoomModel();
            TestMessageModel();
            TestLoginResponse();
            TestEncryptedPayload();
            TestQueuedMessage();
            TestRelativeTime();
            Console.WriteLine("=== All tests passed! ===");
        }

        private static void Assert(bool condition)
        {
            if (!condition) throw new Exception("Assertion failed");
        }
    }
}
