using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;

namespace Meshlink.Views
{
    public partial class CreateChatWindow : Window
    {
        public string? CreatedRoomId { get; private set; }
        public string? CreatedRoomName { get; private set; }

        public CreateChatWindow()
        {
            InitializeComponent();
        }

        private async void TbSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            var query = tbSearch.Text?.Trim();
            if (string.IsNullOrEmpty(query) || query.Length < 2) { lbResults.ItemsSource = null; return; }

            await Task.Delay(300); // debounce
            if (tbSearch.Text?.Trim() != query) return;

            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            try
            {
                var results = await App.MatrixClient.SearchUsersAsync(query, token);
                var myId = App.SecureStorage.GetValue("user_id");
                results.RemoveAll(r => r.UserId == myId);
                lbResults.ItemsSource = results;
            }
            catch { /* ignore */ }
        }

        private async void LbResults_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (lbResults.SelectedItem is not Services.UserSearchResult user) return;
            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            try
            {
                var roomId = await App.MatrixClient.CreateRoomAsync(
                    user.DisplayName ?? user.UserId.Split(':')[0].TrimStart('@'),
                    "trusted_private_chat", token);
                if (roomId != null)
                {
                    CreatedRoomId = roomId;
                    CreatedRoomName = user.DisplayName ?? user.UserId;
                    DialogResult = true;
                    Close();
                }
            }
            catch (Exception ex) { MessageBox.Show($"Error: {ex.Message}"); }
        }

        private async void BtnCreateGroup_Click(object sender, RoutedEventArgs e)
        {
            var name = Microsoft.VisualBasic.Interaction.InputBox("Group name:", "Create Group");
            if (string.IsNullOrEmpty(name)) return;

            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            try
            {
                var roomId = await App.MatrixClient.CreateRoomAsync(name, "private_chat", token);
                if (roomId != null)
                {
                    CreatedRoomId = roomId;
                    CreatedRoomName = name;
                    DialogResult = true;
                    Close();
                }
            }
            catch (Exception ex) { MessageBox.Show($"Error: {ex.Message}"); }
        }

        private void BtnBack_Click(object sender, RoutedEventArgs e) => Close();
    }
}
