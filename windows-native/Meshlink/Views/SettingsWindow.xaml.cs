using System.Windows;

namespace Meshlink.Views
{
    public partial class SettingsWindow : Window
    {
        public SettingsWindow()
        {
            InitializeComponent();
            tbServerUrl.Text = App.SecureStorage.GetValue("server_url") ?? "Unknown";
            tbDeviceId.Text = $"Device: {App.SecureStorage.GetValue("device_id") ?? "Unknown"}";
            tbVersion.Text = "Meshlink v1.0.0";
            cbNotifications.IsChecked = true;
        }

        private void CbNotifications_Changed(object sender, RoutedEventArgs e) { }
        private void BtnBack_Click(object sender, RoutedEventArgs e) => Close();

        private void BtnClearData_Click(object sender, RoutedEventArgs e)
        {
            if (MessageBox.Show("Delete all local data?", "Confirm", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return;
            App.Database.DeleteAllRooms();
            App.Database.DeleteAllMessages();
            App.MediaCache.ClearCache();
            MessageBox.Show("Data cleared. Restart the app.");
        }
    }
}
