using System;
using System.Collections.Generic;
using System.Windows;
using Newtonsoft.Json.Linq;

namespace Meshlink.Views
{
    public partial class GroupSettingsWindow : Window
    {
        public class MemberItem
        {
            public string UserId { get; set; } = "";
            public string Name { get; set; } = "";
            public string Initials => Name.Length >= 2 ? Name[..2].ToUpper() : "?";
        }

        private readonly string _roomId;
        private List<MemberItem> _members = new();

        public GroupSettingsWindow(string roomId, string roomName)
        {
            InitializeComponent();
            _roomId = roomId;
            tbGroupName.Text = roomName;
            tbEditName.Text = roomName;
            Loaded += async (_, _) => await LoadMembers();
        }

        private async System.Threading.Tasks.Task LoadMembers()
        {
            var token = App.SecureStorage.GetValue("access_token");
            var serverUrl = App.SecureStorage.GetValue("server_url");
            if (token == null || serverUrl == null) return;

            try
            {
                var encoded = Uri.EscapeDataString(_roomId);
                var http = new System.Net.Http.HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                var resp = await http.GetStringAsync($"{serverUrl}/_matrix/client/v3/rooms/{encoded}/joined_members");
                var json = JObject.Parse(resp);
                _members.Clear();
                foreach (var (userId, data) in json["joined"]?.ToObject<Dictionary<string, JObject>>() ?? new())
                {
                    var name = data["display_name"]?.ToString() ?? userId.Split(':')[0].TrimStart('@');
                    _members.Add(new MemberItem { UserId = userId, Name = name });
                }
                lbMembers.ItemsSource = _members;
                tbMemberCount.Text = $"{_members.Count} members";
            }
            catch { tbMemberCount.Text = "Error loading members"; }
        }

        private async void BtnSaveName_Click(object sender, RoutedEventArgs e)
        {
            var name = tbEditName.Text?.Trim();
            if (string.IsNullOrEmpty(name)) return;
            var token = App.SecureStorage.GetValue("access_token");
            var serverUrl = App.SecureStorage.GetValue("server_url");
            if (token == null || serverUrl == null) return;

            try
            {
                var encoded = Uri.EscapeDataString(_roomId);
                var http = new System.Net.Http.HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                var body = new System.Net.Http.StringContent($"{{\"name\":\"{name}\"}}", System.Text.Encoding.UTF8, "application/json");
                await http.PutAsync($"{serverUrl}/_matrix/client/v3/rooms/{encoded}/state/m.room.name/", body);
                tbGroupName.Text = name;
                MessageBox.Show("Name updated");
            }
            catch (Exception ex) { MessageBox.Show($"Error: {ex.Message}"); }
        }

        private void BtnInvite_Click(object sender, RoutedEventArgs e)
        {
            var userId = Microsoft.VisualBasic.Interaction.InputBox("User ID (@user:server):", "Invite");
            if (string.IsNullOrEmpty(userId) || !userId.StartsWith("@")) return;
            _ = InviteUser(userId);
        }

        private async System.Threading.Tasks.Task InviteUser(string userId)
        {
            var token = App.SecureStorage.GetValue("access_token");
            var serverUrl = App.SecureStorage.GetValue("server_url");
            if (token == null || serverUrl == null) return;

            try
            {
                var encoded = Uri.EscapeDataString(_roomId);
                var http = new System.Net.Http.HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                var body = new System.Net.Http.StringContent($"{{\"user_id\":\"{userId}\"}}", System.Text.Encoding.UTF8, "application/json");
                await http.PostAsync($"{serverUrl}/_matrix/client/v3/rooms/{encoded}/invite", body);
                MessageBox.Show($"Invited {userId}");
                await LoadMembers();
            }
            catch (Exception ex) { MessageBox.Show($"Error: {ex.Message}"); }
        }

        private async void BtnLeave_Click(object sender, RoutedEventArgs e)
        {
            if (MessageBox.Show("Leave this group?", "Confirm", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return;
            var token = App.SecureStorage.GetValue("access_token");
            var serverUrl = App.SecureStorage.GetValue("server_url");
            if (token == null || serverUrl == null) return;

            try
            {
                var encoded = Uri.EscapeDataString(_roomId);
                var http = new System.Net.Http.HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                var body = new System.Net.Http.StringContent("{}", System.Text.Encoding.UTF8, "application/json");
                await http.PostAsync($"{serverUrl}/_matrix/client/v3/rooms/{encoded}/leave", body);
                Close();
            }
            catch (Exception ex) { MessageBox.Show($"Error: {ex.Message}"); }
        }

        private void BtnBack_Click(object sender, RoutedEventArgs e) => Close();
    }
}
