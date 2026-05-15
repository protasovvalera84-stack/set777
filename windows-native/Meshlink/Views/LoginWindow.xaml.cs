using System;
using System.Windows;

namespace Meshlink.Views
{
    public partial class LoginWindow : Window
    {
        public LoginWindow() => InitializeComponent();

        private async void BtnLogin_Click(object sender, RoutedEventArgs e) => await DoAuth(false);
        private async void BtnRegister_Click(object sender, RoutedEventArgs e) => await DoAuth(true);

        private async System.Threading.Tasks.Task DoAuth(bool isRegister)
        {
            var server = tbServer.Text.Trim().TrimEnd('/');
            var user = tbUsername.Text.Trim();
            var pass = pbPassword.Password;

            if (string.IsNullOrEmpty(server) || string.IsNullOrEmpty(user) || pass.Length < 6)
            {
                ShowError("Fill all fields (password min 6 chars)");
                return;
            }

            SetLoading(true);
            try
            {
                App.MatrixClient = new Services.MatrixClient(server);
                var resp = isRegister
                    ? await App.MatrixClient.RegisterAsync(user, pass)
                    : await App.MatrixClient.LoginAsync(user, pass);

                if (resp.AccessToken != null && resp.UserId != null)
                {
                    App.SecureStorage.SaveCredentials(resp.UserId, resp.AccessToken, resp.DeviceId ?? "", server);
                    App.SyncService = new Services.SyncService();
                    App.SyncService.Start();

                    var main = new MainWindow();
                    main.Show();
                    Close();
                }
                else
                {
                    ShowError(resp.Error ?? "Authentication failed");
                }
            }
            catch (Exception ex)
            {
                ShowError($"Connection error: {ex.Message}");
            }
            SetLoading(false);
        }

        private void ShowError(string msg)
        {
            tbError.Text = msg;
            tbError.Visibility = Visibility.Visible;
        }

        private void SetLoading(bool loading)
        {
            progress.Visibility = loading ? Visibility.Visible : Visibility.Collapsed;
            btnLogin.IsEnabled = !loading;
            btnRegister.IsEnabled = !loading;
        }
    }
}
