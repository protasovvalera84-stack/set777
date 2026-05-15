using System.Collections.Generic;
using System.Linq;
using System.Windows;

namespace Meshlink.Views
{
    /// <summary>
    /// Reusable content window — shows Shorts, Music, Video, or Marketplace.
    /// </summary>
    public partial class ContentWindow : Window
    {
        public enum ContentType { Shorts, Video, Music, Marketplace }

        public class DisplayItem
        {
            public string Title { get; set; } = "";
            public string Subtitle { get; set; } = "";
            public string TypeIcon { get; set; } = "";
            public string PriceDisplay { get; set; } = "";
        }

        private readonly ContentType _type;

        public ContentWindow(ContentType type)
        {
            InitializeComponent();
            _type = type;
            tbTitle.Text = type switch
            {
                ContentType.Shorts => "Shorts",
                ContentType.Video => "Video",
                ContentType.Music => "Music",
                ContentType.Marketplace => "Marketplace",
                _ => "Content"
            };
            Loaded += async (_, _) => await LoadContent();
        }

        private async System.Threading.Tasks.Task LoadContent()
        {
            var token = App.SecureStorage.GetValue("access_token");
            var userId = App.SecureStorage.GetValue("user_id");
            if (token == null || userId == null) return;

            progress.Visibility = Visibility.Visible;
            var manager = new Services.ContentManager(App.MatrixClient, userId);

            try
            {
                var items = _type switch
                {
                    ContentType.Shorts => await manager.LoadShortsAsync(token),
                    ContentType.Video => await manager.LoadVideosAsync(token),
                    ContentType.Music => await manager.LoadMusicAsync(token),
                    ContentType.Marketplace => await manager.LoadMarketAsync(token),
                    _ => new List<Services.ContentManager.ContentItem>()
                };

                var displayItems = items.Select(i => new DisplayItem
                {
                    Title = i.Title,
                    Subtitle = $"{i.Author} · {Helpers.Utils.RelativeTime(i.Timestamp)}",
                    TypeIcon = _type switch
                    {
                        ContentType.Shorts => "🎬",
                        ContentType.Video => "📹",
                        ContentType.Music => "🎵",
                        ContentType.Marketplace => "🛒",
                        _ => "📄"
                    },
                    PriceDisplay = i.Price != null ? $"${i.Price}" : ""
                }).ToList();

                lbItems.ItemsSource = displayItems;
                tbEmpty.Visibility = displayItems.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
                tbEmpty.Text = _type switch
                {
                    ContentType.Shorts => "No shorts yet. Upload from mobile!",
                    ContentType.Video => "No videos yet",
                    ContentType.Music => "No music yet",
                    ContentType.Marketplace => "No listings yet",
                    _ => "No content"
                };
            }
            catch { tbEmpty.Visibility = Visibility.Visible; tbEmpty.Text = "Error loading content"; }

            progress.Visibility = Visibility.Collapsed;
        }

        private void BtnBack_Click(object sender, RoutedEventArgs e) => Close();
    }
}
