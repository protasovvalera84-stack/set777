using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace Meshlink.Views
{
    public partial class SearchWindow : Window
    {
        public class SearchResult
        {
            public string Icon { get; set; } = "";
            public string Title { get; set; } = "";
            public string Subtitle { get; set; } = "";
            public string Type { get; set; } = "";
            public string Id { get; set; } = "";
        }

        private string _filter = "all";
        private List<SearchResult> _allResults = new();

        public SearchWindow() { InitializeComponent(); tbSearch.Focus(); }

        private async void TbSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            var query = tbSearch.Text?.Trim();
            if (string.IsNullOrEmpty(query) || query.Length < 2) { lbResults.ItemsSource = null; return; }

            await System.Threading.Tasks.Task.Delay(300);
            if (tbSearch.Text?.Trim() != query) return;

            _allResults.Clear();
            var q = query.ToLower();

            // Search rooms
            var rooms = App.Database.GetRooms();
            foreach (var r in rooms.Where(r => r.Name.ToLower().Contains(q)))
                _allResults.Add(new SearchResult { Icon = "💬", Title = r.Name, Subtitle = r.RoomId[..20], Type = "room", Id = r.RoomId });

            // Search messages
            foreach (var room in rooms.Take(10))
            {
                var msgs = App.Database.GetMessages(room.RoomId, 50);
                foreach (var m in msgs.Where(m => m.Body.ToLower().Contains(q)).Take(3))
                    _allResults.Add(new SearchResult { Icon = "📝", Title = m.Body[..System.Math.Min(60, m.Body.Length)], Subtitle = $"{m.SenderName} in {room.Name}", Type = "message", Id = room.RoomId });
            }

            // Search users
            var token = App.SecureStorage.GetValue("access_token");
            if (token != null)
            {
                try
                {
                    var users = await App.MatrixClient.SearchUsersAsync(query, token, 5);
                    foreach (var u in users)
                        _allResults.Add(new SearchResult { Icon = "👤", Title = u.DisplayName ?? u.UserId, Subtitle = u.UserId, Type = "user", Id = u.UserId });
                }
                catch { }
            }

            ApplyFilter();
        }

        private void BtnFilter_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn) _filter = btn.Tag?.ToString() ?? "all";
            btnAll.Background = _filter == "all" ? (System.Windows.Media.Brush)FindResource("PrimaryBrush") : System.Windows.Media.Brushes.Transparent;
            btnRooms.Background = _filter == "rooms" ? (System.Windows.Media.Brush)FindResource("PrimaryBrush") : System.Windows.Media.Brushes.Transparent;
            btnMessages.Background = _filter == "messages" ? (System.Windows.Media.Brush)FindResource("PrimaryBrush") : System.Windows.Media.Brushes.Transparent;
            btnUsers.Background = _filter == "users" ? (System.Windows.Media.Brush)FindResource("PrimaryBrush") : System.Windows.Media.Brushes.Transparent;
            ApplyFilter();
        }

        private void ApplyFilter()
        {
            var filtered = _filter == "all" ? _allResults : _allResults.Where(r => r.Type == _filter.TrimEnd('s')).ToList();
            lbResults.ItemsSource = filtered;
        }

        private void BtnBack_Click(object sender, RoutedEventArgs e) => Close();
    }
}
