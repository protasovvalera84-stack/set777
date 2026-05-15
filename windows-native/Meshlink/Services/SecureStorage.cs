using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace Meshlink.Services
{
    /// <summary>
    /// Encrypted local storage — stores tokens and secrets securely.
    /// Uses DPAPI (Windows Data Protection API) for encryption.
    /// Data stored in AppData\Local\Meshlink (deleted on uninstall).
    /// </summary>
    public class SecureStorage
    {
        private readonly string _storagePath;

        public SecureStorage()
        {
            _storagePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Meshlink", ".secure"
            );
            Directory.CreateDirectory(_storagePath);
        }

        public void SetValue(string key, string value)
        {
            var encrypted = ProtectedData.Protect(
                Encoding.UTF8.GetBytes(value),
                Encoding.UTF8.GetBytes("meshlink_salt"),
                DataProtectionScope.CurrentUser
            );
            File.WriteAllBytes(GetPath(key), encrypted);
        }

        public string? GetValue(string key)
        {
            var path = GetPath(key);
            if (!File.Exists(path)) return null;
            try
            {
                var encrypted = File.ReadAllBytes(path);
                var decrypted = ProtectedData.Unprotect(
                    encrypted,
                    Encoding.UTF8.GetBytes("meshlink_salt"),
                    DataProtectionScope.CurrentUser
                );
                return Encoding.UTF8.GetString(decrypted);
            }
            catch { return null; }
        }

        public void Remove(string key)
        {
            var path = GetPath(key);
            if (File.Exists(path)) File.Delete(path);
        }

        public bool HasCredentials()
        {
            return GetValue("access_token") != null && GetValue("user_id") != null;
        }

        public void SaveCredentials(string userId, string accessToken, string deviceId, string serverUrl)
        {
            SetValue("user_id", userId);
            SetValue("access_token", accessToken);
            SetValue("device_id", deviceId);
            SetValue("server_url", serverUrl);
        }

        public void ClearAll()
        {
            if (Directory.Exists(_storagePath))
            {
                foreach (var file in Directory.GetFiles(_storagePath))
                    File.Delete(file);
            }
        }

        private string GetPath(string key) => Path.Combine(_storagePath, $"{key}.enc");
    }
}
