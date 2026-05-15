using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace Meshlink.Views
{
    public partial class MainWindow : Window
    {
        private string? _selectedRoomId;
        private string? _selectedRoomName;
        private List<Models.RoomModel> _allRooms = new();

        public MainWindow()
        {
            InitializeComponent();
            Loaded += async (_, _) => await LoadRooms();

            // Listen for new messages
            if (App.SyncService != null)
            {
                App.SyncService.OnNewMessage += (roomId, sender, body) =>
                {
                    Dispatcher.Invoke(() =>
                    {
                        if (roomId == _selectedRoomId)
                            _ = LoadMessages(roomId);
                        _ = LoadRooms();
                    });
                };
                App.SyncService.Start();
            }
        }

        private async System.Threading.Tasks.Task LoadRooms()
        {
            try
            {
                var token = App.SecureStorage.GetValue("access_token");
                if (token == null) return;

                // Show cached first
                _allRooms = App.Database.GetRooms();
                FilterAndShowRooms();

                // Fetch from server
                var roomIds = await App.MatrixClient.GetJoinedRoomsAsync(token);
                var rooms = new List<Models.RoomModel>();

                foreach (var id in roomIds)
                {
                    try
                    {
                        var info = await App.MatrixClient.GetRoomStateAsync(id, token);
                        if (info.Name.Contains("Meshlink") && (info.Name.Contains("Shorts") ||
                            info.Name.Contains("Videos") || info.Name.Contains("Music") ||
                            info.Name.Contains("Registry") || info.Name.Contains("Marketplace"))) continue;

                        var room = new Models.RoomModel
                        {
                            RoomId = id, Name = info.Name,
                            AvatarUrl = info.AvatarUrl, Topic = info.Topic
                        };
                        rooms.Add(room);
                        App.Database.UpsertRoom(room);
                    }
                    catch { rooms.Add(new Models.RoomModel { RoomId = id, Name = id[..20] }); }
                }

                _allRooms = rooms;
                FilterAndShowRooms();
            }
            catch { /* use cached */ }
        }

        private void FilterAndShowRooms()
        {
            var query = tbSearch.Text?.Trim().ToLower() ?? "";
            var filtered = string.IsNullOrEmpty(query)
                ? _allRooms
                : _allRooms.Where(r => r.Name.ToLower().Contains(query)).ToList();
            lbRooms.ItemsSource = filtered;
        }

        private async System.Threading.Tasks.Task LoadMessages(string roomId)
        {
            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            // Cached first
            var cached = App.Database.GetMessages(roomId);
            if (cached.Any())
                lbMessages.ItemsSource = cached.OrderBy(m => m.Timestamp).ToList();

            // Server
            try
            {
                var messages = await App.MatrixClient.GetMessagesAsync(roomId, token);
                foreach (var msg in messages)
                {
                    App.Database.UpsertMessage(new Models.MessageModel
                    {
                        EventId = msg.EventId, RoomId = msg.RoomId,
                        Sender = msg.Sender, Body = msg.Body,
                        MsgType = msg.MsgType, Timestamp = msg.Timestamp,
                        MediaUrl = msg.MediaUrl
                    });
                }
                var all = App.Database.GetMessages(roomId);
                lbMessages.ItemsSource = all.OrderBy(m => m.Timestamp).ToList();
                lbMessages.ScrollIntoView(lbMessages.Items[^1]);
            }
            catch { /* use cached */ }
        }

        private void LbRooms_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (lbRooms.SelectedItem is Models.RoomModel room)
            {
                _selectedRoomId = room.RoomId;
                _selectedRoomName = room.Name;
                tbChatTitle.Text = room.Name;
                _ = LoadMessages(room.RoomId);
            }
        }

        private async void BtnSend_Click(object sender, RoutedEventArgs e) => await SendMessage();
        private async void TbMessage_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter) await SendMessage();
        }

        private async System.Threading.Tasks.Task SendMessage()
        {
            var text = tbMessage.Text?.Trim();
            if (string.IsNullOrEmpty(text) || _selectedRoomId == null) return;

            tbMessage.Text = "";
            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            try
            {
                await App.MatrixClient.SendMessageAsync(_selectedRoomId, text, token);
                await LoadMessages(_selectedRoomId);
            }
            catch { /* offline queue */ }
        }

        private void TbSearch_TextChanged(object sender, TextChangedEventArgs e) => FilterAndShowRooms();
        private void BtnSearch_Click(object sender, RoutedEventArgs e) => tbSearch.Focus();
        private void BtnNewChat_Click(object sender, RoutedEventArgs e)
        {
            var win = new CreateChatWindow { Owner = this };
            if (win.ShowDialog() == true && win.CreatedRoomId != null)
            {
                _selectedRoomId = win.CreatedRoomId;
                _selectedRoomName = win.CreatedRoomName;
                tbChatTitle.Text = win.CreatedRoomName ?? "Chat";
                _ = LoadMessages(win.CreatedRoomId);
                _ = LoadRooms();
            }
        }
        private void BtnProfile_Click(object sender, RoutedEventArgs e)
        {
            new ProfileWindow { Owner = this }.ShowDialog();
        }
        private void BtnShorts_Click(object sender, RoutedEventArgs e) => MessageBox.Show("Shorts — coming in next update");
        private void BtnMusic_Click(object sender, RoutedEventArgs e) => MessageBox.Show("Music — coming in next update");
        private void BtnMarket_Click(object sender, RoutedEventArgs e) => MessageBox.Show("Marketplace — coming in next update");
    }
}
