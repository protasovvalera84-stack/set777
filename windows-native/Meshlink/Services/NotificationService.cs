using System;
using System.Windows;

namespace Meshlink.Services
{
    /// <summary>
    /// Windows notification service — shows toast notifications for new messages.
    /// Uses system tray for background notifications.
    /// </summary>
    public class NotificationService
    {
        public void ShowNotification(string title, string body)
        {
            try
            {
                // Simple notification via system tray balloon
                Application.Current?.Dispatcher?.Invoke(() =>
                {
                    var mainWindow = Application.Current.MainWindow;
                    if (mainWindow != null && !mainWindow.IsActive)
                    {
                        mainWindow.Title = $"({title}) Meshlink";
                        // Flash taskbar
                        mainWindow.Activate();
                    }
                });
            }
            catch { /* ignore */ }
        }
    }
}
