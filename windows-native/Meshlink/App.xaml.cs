using System.Windows;

namespace Meshlink
{
    /// <summary>
    /// Meshlink Desktop — Windows native WPF application.
    /// Entry point. Initializes services and shows main window.
    /// </summary>
    public partial class App : Application
    {
        public static Services.MatrixClient MatrixClient { get; private set; } = null!;
        public static Services.LocalDatabase Database { get; private set; } = null!;
        public static Services.SecureStorage SecureStorage { get; private set; } = null!;
        public static Services.MediaCache MediaCache { get; private set; } = null!;
        public static Services.SyncService SyncService { get; private set; } = null!;
        public static Services.NotificationService NotificationService { get; private set; } = null!;

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // Initialize core services
            SecureStorage = new Services.SecureStorage();
            Database = new Services.LocalDatabase();
            
            var serverUrl = SecureStorage.GetValue("server_url") ?? "https://72-56-244-207.nip.io";
            MatrixClient = new Services.MatrixClient(serverUrl);
            MediaCache = new Services.MediaCache();
            NotificationService = new Services.NotificationService();

            // Auto-login if credentials exist
            if (SecureStorage.HasCredentials())
            {
                SyncService = new Services.SyncService();
                var mainWindow = new Views.MainWindow();
                mainWindow.Show();
            }
            else
            {
                var loginWindow = new Views.LoginWindow();
                loginWindow.Show();
            }
        }
    }
}
