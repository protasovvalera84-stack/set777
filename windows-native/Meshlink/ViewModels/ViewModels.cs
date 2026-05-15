using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace Meshlink.ViewModels
{
    /// <summary>
    /// Base ViewModel with INotifyPropertyChanged.
    /// </summary>
    public class ViewModelBase : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler? PropertyChanged;
        protected void OnPropertyChanged([CallerMemberName] string? name = null)
            => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

        protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? name = null)
        {
            if (EqualityComparer<T>.Default.Equals(field, value)) return false;
            field = value;
            OnPropertyChanged(name);
            return true;
        }
    }

    /// <summary>
    /// Relay command for MVVM binding.
    /// </summary>
    public class RelayCommand : System.Windows.Input.ICommand
    {
        private readonly Action<object?> _execute;
        private readonly Func<object?, bool>? _canExecute;

        public RelayCommand(Action<object?> execute, Func<object?, bool>? canExecute = null)
        {
            _execute = execute;
            _canExecute = canExecute;
        }

        public event EventHandler? CanExecuteChanged
        {
            add => System.Windows.Input.CommandManager.RequerySuggested += value;
            remove => System.Windows.Input.CommandManager.RequerySuggested -= value;
        }

        public bool CanExecute(object? parameter) => _canExecute?.Invoke(parameter) ?? true;
        public void Execute(object? parameter) => _execute(parameter);
    }

    /// <summary>
    /// Chat ViewModel — manages messages for a room.
    /// </summary>
    public class ChatViewModel : ViewModelBase
    {
        private string _roomId = "";
        private string _roomName = "";
        private string _messageText = "";
        private ObservableCollection<Models.MessageModel> _messages = new();

        public string RoomId { get => _roomId; set => SetProperty(ref _roomId, value); }
        public string RoomName { get => _roomName; set => SetProperty(ref _roomName, value); }
        public string MessageText { get => _messageText; set => SetProperty(ref _messageText, value); }
        public ObservableCollection<Models.MessageModel> Messages { get => _messages; set => SetProperty(ref _messages, value); }

        public RelayCommand SendCommand { get; }

        public ChatViewModel()
        {
            SendCommand = new RelayCommand(async _ => await SendMessage());
        }

        public async System.Threading.Tasks.Task LoadMessages()
        {
            if (string.IsNullOrEmpty(RoomId)) return;
            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            var cached = App.Database.GetMessages(RoomId);
            Messages = new ObservableCollection<Models.MessageModel>(cached);

            try
            {
                var msgs = await App.MatrixClient.GetMessagesAsync(RoomId, token);
                foreach (var m in msgs)
                {
                    App.Database.UpsertMessage(new Models.MessageModel
                    {
                        EventId = m.EventId, RoomId = m.RoomId, Sender = m.Sender,
                        Body = m.Body, MsgType = m.MsgType, Timestamp = m.Timestamp, MediaUrl = m.MediaUrl
                    });
                }
                var all = App.Database.GetMessages(RoomId);
                all.Sort((a, b) => a.Timestamp.CompareTo(b.Timestamp));
                Messages = new ObservableCollection<Models.MessageModel>(all);
            }
            catch { /* use cached */ }
        }

        private async System.Threading.Tasks.Task SendMessage()
        {
            if (string.IsNullOrWhiteSpace(MessageText) || string.IsNullOrEmpty(RoomId)) return;
            var text = MessageText;
            MessageText = "";

            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            try
            {
                await App.MatrixClient.SendMessageAsync(RoomId, text, token);
                await LoadMessages();
            }
            catch { /* offline queue */ }
        }
    }

    /// <summary>
    /// Room list ViewModel.
    /// </summary>
    public class RoomListViewModel : ViewModelBase
    {
        private ObservableCollection<Models.RoomModel> _rooms = new();
        private string _searchQuery = "";

        public ObservableCollection<Models.RoomModel> Rooms { get => _rooms; set => SetProperty(ref _rooms, value); }
        public string SearchQuery
        {
            get => _searchQuery;
            set { SetProperty(ref _searchQuery, value); FilterRooms(); }
        }

        private List<Models.RoomModel> _allRooms = new();

        public async System.Threading.Tasks.Task LoadRooms()
        {
            var token = App.SecureStorage.GetValue("access_token");
            if (token == null) return;

            _allRooms = App.Database.GetRooms();
            FilterRooms();

            try
            {
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
                        var room = new Models.RoomModel { RoomId = id, Name = info.Name, AvatarUrl = info.AvatarUrl, Topic = info.Topic };
                        rooms.Add(room);
                        App.Database.UpsertRoom(room);
                    }
                    catch { rooms.Add(new Models.RoomModel { RoomId = id, Name = id[..Math.Min(20, id.Length)] }); }
                }
                _allRooms = rooms;
                FilterRooms();
            }
            catch { /* use cached */ }
        }

        private void FilterRooms()
        {
            var q = SearchQuery?.ToLower() ?? "";
            var filtered = string.IsNullOrEmpty(q) ? _allRooms : _allRooms.FindAll(r => r.Name.ToLower().Contains(q));
            Rooms = new ObservableCollection<Models.RoomModel>(filtered);
        }
    }
}
