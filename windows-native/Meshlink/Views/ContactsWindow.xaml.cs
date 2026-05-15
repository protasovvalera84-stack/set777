using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Meshlink.Views
{
    public partial class ContactsWindow : Window
    {
        public class FriendItem
        {
            public string UserId { get; set; } = "";
            public string Name { get; set; } = "";
            public string Status { get; set; } = "friend";
            public string Initials => Name.Length >= 2 ? Name[..2].ToUpper() : "?";
            public string StatusText => Status switch
            {
                "pending_received" => "Wants to be friends",
                "pending_sent" => "Request sent",
                _ => "Friend"
            };
            public string StatusEmoji => Status switch
            {
                "pending_received" => "📩",
                "pending_sent" => "⏳",
                _ => "✅"
            };
        }

        private List<FriendItem> _friends = new();

        public ContactsWindow()
        {
            InitializeComponent();
            Loaded += async (_, _) => await LoadFriends();
        }

        private async System.Threading.Tasks.Task LoadFriends()
        {
            var token = App.SecureStorage.GetValue("access_token");
            var userId = App.SecureStorage.GetValue("user_id");
            var serverUrl = App.SecureStorage.GetValue("server_url");
            if (token == null || userId == null || serverUrl == null) return;

            try
            {
                var encoded = Uri.EscapeDataString(userId);
                var http = new System.Net.Http.HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                var resp = await http.GetStringAsync($"{serverUrl}/_matrix/client/v3/user/{encoded}/account_data/org.meshlink.friends");
                var json = JObject.Parse(resp);
                _friends.Clear();
                foreach (var f in json["friends"] ?? new JArray())
                {
                    _friends.Add(new FriendItem
                    {
                        UserId = f["userId"]?.ToString() ?? "",
                        Name = f["name"]?.ToString() ?? f["userId"]?.ToString()?.Split(':')[0].TrimStart('@') ?? "",
                        Status = f["status"]?.ToString() ?? "friend"
                    });
                }
            }
            catch { /* no friends data */ }

            lbFriends.ItemsSource = _friends;
            tbEmpty.Visibility = _friends.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
        }

        private void BtnBack_Click(object sender, RoutedEventArgs e) => Close();
    }
}
