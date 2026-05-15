using System;
using System.Windows;
using Newtonsoft.Json.Linq;

namespace Meshlink.Views
{
    public partial class ProfileWindow : Window
    {
        public ProfileWindow()
        {
            InitializeComponent();
            Loaded += async (_, _) => await LoadProfile();
        }

        private async System.Threading.Tasks.Task LoadProfile()
        {
            var userId = App.SecureStorage.GetValue("user_id") ?? "";
            var token = App.SecureStorage.GetValue("access_token");
            var name = userId.Split(':')[0].TrimStart('@');

            tbName.Text = name;
            tbUserId.Text = userId;
            tbAvatar.Text = name.Length >= 2 ? name[..2].ToUpper() : name.ToUpper();
            tbDisplayName.Text = name;

            // Load from server
            if (token != null)
            {
                try
                {
                    var encoded = Uri.EscapeDataString(userId);
                    var http = new System.Net.Http.HttpClient();
                    http.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                    var resp = await http.GetStringAsync($"{App.SecureStorage.GetValue("server_url")}/_matrix/client/v3/profile/{encoded}");
                    var json = JObject.Parse(resp);
                    var displayName = json["displayname"]?.ToString();
                    if (displayName != null)
                    {
                        tbName.Text = displayName;
                        tbDisplayName.Text = displayName;
                        tbAvatar.Text = displayName.Length >= 2 ? displayName[..2].ToUpper() : displayName.ToUpper();
                    }
                }
                catch { /* use local */ }
            }

            // Storage
            var cacheSize = App.MediaCache.GetCacheSize();
            tbStorage.Text = $"Media cache: {cacheSize / (1024 * 1024)}MB";
        }

        private async void BtnSave_Click(object sender, RoutedEventArgs e)
        {
            var newName = tbDisplayName.Text?.Trim();
            if (string.IsNullOrEmpty(newName)) return;

            var token = App.SecureStorage.GetValue("access_token");
            var userId = App.SecureStorage.GetValue("user_id");
            if (token == null || userId == null) return;

            try
            {
                var encoded = Uri.EscapeDataString(userId);
                var http = new System.Net.Http.HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                var body = new System.Net.Http.StringContent(
                    $"{{\"displayname\":\"{newName}\"}}",
                    System.Text.Encoding.UTF8, "application/json");
                await http.PutAsync($"{App.SecureStorage.GetValue("server_url")}/_matrix/client/v3/profile/{encoded}/displayname", body);
                tbName.Text = newName;
                tbAvatar.Text = newName.Length >= 2 ? newName[..2].ToUpper() : newName.ToUpper();
                MessageBox.Show("Profile updated", "Success");
            }
            catch (Exception ex) { MessageBox.Show($"Error: {ex.Message}"); }
        }

        private void BtnClearCache_Click(object sender, RoutedEventArgs e)
        {
            App.MediaCache.ClearCache();
            tbStorage.Text = "Media cache: 0MB";
            MessageBox.Show("Cache cleared");
        }

        private void BtnLogout_Click(object sender, RoutedEventArgs e)
        {
            if (MessageBox.Show("Log out?", "Confirm", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return;
            App.SecureStorage.ClearAll();
            App.Database.DeleteAllRooms();
            App.Database.DeleteAllMessages();
            App.SyncService?.Stop();
            new LoginWindow().Show();
            foreach (Window w in Application.Current.Windows)
                if (w != Application.Current.MainWindow) w.Close();
            Owner?.Close();
            Close();
        }

        private void BtnBack_Click(object sender, RoutedEventArgs e) => Close();
    }
}
