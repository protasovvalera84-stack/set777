/**
 * Meshlink i18n (internationalization) system.
 * Provides translations for the entire UI.
 */

export type LangCode = "en" | "ru" | "es" | "fr" | "de" | "zh" | "ar" | "pt" | "ja" | "ko";

export interface Translations {
  // Navigation
  allChats: string;
  direct: string;
  groups: string;
  channels: string;
  favorites: string;
  settings: string;
  // Search
  search: string;
  searchPlaceholder: string;
  myChats: string;
  groupsAndChannels: string;
  people: string;
  tapToJoin: string;
  tapToMessage: string;
  noResults: string;
  // Chat
  message: string;
  sendMessage: string;
  typing: string;
  online: string;
  lastSeen: string;
  lastSeenRecently: string;
  // Actions
  reply: string;
  forward: string;
  edit: string;
  delete: string;
  pin: string;
  save: string;
  translate: string;
  copy: string;
  thread: string;
  // Media
  photo: string;
  video: string;
  voice: string;
  videoNote: string;
  file: string;
  location: string;
  poll: string;
  // Groups
  createGroup: string;
  createChannel: string;
  members: string;
  addMembers: string;
  leaveGroup: string;
  groupSettings: string;
  // Privacy
  privacy: string;
  publicGroup: string;
  privateGroup: string;
  hiddenGroup: string;
  openAccess: string;
  approvalRequired: string;
  inviteOnly: string;
  // Settings
  editProfile: string;
  notifications: string;
  security: string;
  appearance: string;
  language: string;
  helpCenter: string;
  adminPanel: string;
  logOut: string;
  // Misc
  cancel: string;
  confirm: string;
  done: string;
  loading: string;
  error: string;
  retry: string;
  votes: string;
  voted: string;
}

const en: Translations = {
  allChats: "All",
  direct: "Direct",
  groups: "Groups",
  channels: "Channels",
  favorites: "Favorites",
  settings: "Settings",
  search: "Search",
  searchPlaceholder: "Search the mesh...",
  myChats: "My Chats",
  groupsAndChannels: "Groups & Channels",
  people: "People",
  tapToJoin: "Tap to join",
  tapToMessage: "Tap to message",
  noResults: "No results found",
  message: "Message",
  sendMessage: "Message...",
  typing: "typing...",
  online: "online",
  lastSeen: "last seen",
  lastSeenRecently: "last seen recently",
  reply: "Reply",
  forward: "Forward",
  edit: "Edit",
  delete: "Delete",
  pin: "Pin",
  save: "Save",
  translate: "Translate",
  copy: "Copy",
  thread: "Thread",
  photo: "Photo",
  video: "Video",
  voice: "Voice",
  videoNote: "Video note",
  file: "File",
  location: "Location",
  poll: "Poll",
  createGroup: "Create Group",
  createChannel: "Create Channel",
  members: "members",
  addMembers: "Add Members",
  leaveGroup: "Leave",
  groupSettings: "Group Settings",
  privacy: "Privacy",
  publicGroup: "Public",
  privateGroup: "Private",
  hiddenGroup: "Hidden",
  openAccess: "Open",
  approvalRequired: "Approval required",
  inviteOnly: "Invite only",
  editProfile: "Edit Profile",
  notifications: "Notifications",
  security: "Security",
  appearance: "Appearance",
  language: "Language",
  helpCenter: "Help Center",
  adminPanel: "Admin Panel",
  logOut: "Log Out",
  cancel: "Cancel",
  confirm: "Confirm",
  done: "Done",
  loading: "Loading...",
  error: "Error",
  retry: "Retry",
  votes: "votes",
  voted: "voted",
};

const ru: Translations = {
  allChats: "Все",
  direct: "Личные",
  groups: "Группы",
  channels: "Каналы",
  favorites: "Избранное",
  settings: "Настройки",
  search: "Поиск",
  searchPlaceholder: "Поиск...",
  myChats: "Мои чаты",
  groupsAndChannels: "Группы и каналы",
  people: "Люди",
  tapToJoin: "Нажмите чтобы вступить",
  tapToMessage: "Нажмите чтобы написать",
  noResults: "Ничего не найдено",
  message: "Сообщение",
  sendMessage: "Сообщение...",
  typing: "печатает...",
  online: "в сети",
  lastSeen: "был(а)",
  lastSeenRecently: "был(а) недавно",
  reply: "Ответить",
  forward: "Переслать",
  edit: "Редактировать",
  delete: "Удалить",
  pin: "Закрепить",
  save: "Сохранить",
  translate: "Перевести",
  copy: "Копировать",
  thread: "Ветка",
  photo: "Фото",
  video: "Видео",
  voice: "Голосовое",
  videoNote: "Видеосообщение",
  file: "Файл",
  location: "Геолокация",
  poll: "Опрос",
  createGroup: "Создать группу",
  createChannel: "Создать канал",
  members: "участников",
  addMembers: "Добавить участников",
  leaveGroup: "Выйти",
  groupSettings: "Настройки группы",
  privacy: "Приватность",
  publicGroup: "Публичная",
  privateGroup: "Приватная",
  hiddenGroup: "Скрытая",
  openAccess: "Открытый доступ",
  approvalRequired: "Требуется одобрение",
  inviteOnly: "Только по приглашению",
  editProfile: "Редактировать профиль",
  notifications: "Уведомления",
  security: "Безопасность",
  appearance: "Оформление",
  language: "Язык",
  helpCenter: "Помощь",
  adminPanel: "Админ панель",
  logOut: "Выйти",
  cancel: "Отмена",
  confirm: "Подтвердить",
  done: "Готово",
  loading: "Загрузка...",
  error: "Ошибка",
  retry: "Повторить",
  votes: "голосов",
  voted: "проголосовал",
};

const es: Translations = {
  allChats: "Todos", direct: "Directo", groups: "Grupos", channels: "Canales", favorites: "Favoritos", settings: "Ajustes",
  search: "Buscar", searchPlaceholder: "Buscar...", myChats: "Mis chats", groupsAndChannels: "Grupos y canales", people: "Personas",
  tapToJoin: "Toca para unirte", tapToMessage: "Toca para escribir", noResults: "Sin resultados",
  message: "Mensaje", sendMessage: "Mensaje...", typing: "escribiendo...", online: "en línea", lastSeen: "visto", lastSeenRecently: "visto recientemente",
  reply: "Responder", forward: "Reenviar", edit: "Editar", delete: "Eliminar", pin: "Fijar", save: "Guardar", translate: "Traducir", copy: "Copiar", thread: "Hilo",
  photo: "Foto", video: "Video", voice: "Voz", videoNote: "Nota de video", file: "Archivo", location: "Ubicación", poll: "Encuesta",
  createGroup: "Crear grupo", createChannel: "Crear canal", members: "miembros", addMembers: "Añadir miembros", leaveGroup: "Salir", groupSettings: "Ajustes del grupo",
  privacy: "Privacidad", publicGroup: "Público", privateGroup: "Privado", hiddenGroup: "Oculto", openAccess: "Abierto", approvalRequired: "Requiere aprobación", inviteOnly: "Solo invitación",
  editProfile: "Editar perfil", notifications: "Notificaciones", security: "Seguridad", appearance: "Apariencia", language: "Idioma", helpCenter: "Ayuda", adminPanel: "Panel admin", logOut: "Cerrar sesión",
  cancel: "Cancelar", confirm: "Confirmar", done: "Listo", loading: "Cargando...", error: "Error", retry: "Reintentar", votes: "votos", voted: "votado",
};

const fr: Translations = {
  allChats: "Tous", direct: "Direct", groups: "Groupes", channels: "Canaux", favorites: "Favoris", settings: "Paramètres",
  search: "Rechercher", searchPlaceholder: "Rechercher...", myChats: "Mes chats", groupsAndChannels: "Groupes et canaux", people: "Personnes",
  tapToJoin: "Appuyez pour rejoindre", tapToMessage: "Appuyez pour écrire", noResults: "Aucun résultat",
  message: "Message", sendMessage: "Message...", typing: "écrit...", online: "en ligne", lastSeen: "vu", lastSeenRecently: "vu récemment",
  reply: "Répondre", forward: "Transférer", edit: "Modifier", delete: "Supprimer", pin: "Épingler", save: "Enregistrer", translate: "Traduire", copy: "Copier", thread: "Fil",
  photo: "Photo", video: "Vidéo", voice: "Vocal", videoNote: "Note vidéo", file: "Fichier", location: "Position", poll: "Sondage",
  createGroup: "Créer un groupe", createChannel: "Créer un canal", members: "membres", addMembers: "Ajouter des membres", leaveGroup: "Quitter", groupSettings: "Paramètres du groupe",
  privacy: "Confidentialité", publicGroup: "Public", privateGroup: "Privé", hiddenGroup: "Caché", openAccess: "Ouvert", approvalRequired: "Approbation requise", inviteOnly: "Sur invitation",
  editProfile: "Modifier le profil", notifications: "Notifications", security: "Sécurité", appearance: "Apparence", language: "Langue", helpCenter: "Aide", adminPanel: "Panneau admin", logOut: "Déconnexion",
  cancel: "Annuler", confirm: "Confirmer", done: "Terminé", loading: "Chargement...", error: "Erreur", retry: "Réessayer", votes: "votes", voted: "voté",
};

const de: Translations = {
  allChats: "Alle", direct: "Direkt", groups: "Gruppen", channels: "Kanäle", favorites: "Favoriten", settings: "Einstellungen",
  search: "Suchen", searchPlaceholder: "Suchen...", myChats: "Meine Chats", groupsAndChannels: "Gruppen & Kanäle", people: "Personen",
  tapToJoin: "Tippen zum Beitreten", tapToMessage: "Tippen zum Schreiben", noResults: "Keine Ergebnisse",
  message: "Nachricht", sendMessage: "Nachricht...", typing: "tippt...", online: "online", lastSeen: "zuletzt gesehen", lastSeenRecently: "kürzlich gesehen",
  reply: "Antworten", forward: "Weiterleiten", edit: "Bearbeiten", delete: "Löschen", pin: "Anheften", save: "Speichern", translate: "Übersetzen", copy: "Kopieren", thread: "Thread",
  photo: "Foto", video: "Video", voice: "Sprache", videoNote: "Videonachricht", file: "Datei", location: "Standort", poll: "Umfrage",
  createGroup: "Gruppe erstellen", createChannel: "Kanal erstellen", members: "Mitglieder", addMembers: "Mitglieder hinzufügen", leaveGroup: "Verlassen", groupSettings: "Gruppeneinstellungen",
  privacy: "Datenschutz", publicGroup: "Öffentlich", privateGroup: "Privat", hiddenGroup: "Versteckt", openAccess: "Offen", approvalRequired: "Genehmigung erforderlich", inviteOnly: "Nur Einladung",
  editProfile: "Profil bearbeiten", notifications: "Benachrichtigungen", security: "Sicherheit", appearance: "Aussehen", language: "Sprache", helpCenter: "Hilfe", adminPanel: "Admin-Panel", logOut: "Abmelden",
  cancel: "Abbrechen", confirm: "Bestätigen", done: "Fertig", loading: "Laden...", error: "Fehler", retry: "Wiederholen", votes: "Stimmen", voted: "abgestimmt",
};

const zh: Translations = {
  allChats: "全部", direct: "私信", groups: "群组", channels: "频道", favorites: "收藏", settings: "设置",
  search: "搜索", searchPlaceholder: "搜索...", myChats: "我的聊天", groupsAndChannels: "群组和频道", people: "用户",
  tapToJoin: "点击加入", tapToMessage: "点击发消息", noResults: "未找到结果",
  message: "消息", sendMessage: "消息...", typing: "正在输入...", online: "在线", lastSeen: "最后上线", lastSeenRecently: "最近在线",
  reply: "回复", forward: "转发", edit: "编辑", delete: "删除", pin: "置顶", save: "保存", translate: "翻译", copy: "复制", thread: "话题",
  photo: "照片", video: "视频", voice: "语音", videoNote: "视频消息", file: "文件", location: "位置", poll: "投票",
  createGroup: "创建群组", createChannel: "创建频道", members: "成员", addMembers: "添加成员", leaveGroup: "退出", groupSettings: "群组设置",
  privacy: "隐私", publicGroup: "公开", privateGroup: "私密", hiddenGroup: "隐藏", openAccess: "开放", approvalRequired: "需要审批", inviteOnly: "仅邀请",
  editProfile: "编辑资料", notifications: "通知", security: "安全", appearance: "外观", language: "语言", helpCenter: "帮助", adminPanel: "管理面板", logOut: "退出登录",
  cancel: "取消", confirm: "确认", done: "完成", loading: "加载中...", error: "错误", retry: "重试", votes: "票", voted: "已投票",
};

// Simplified entries for remaining languages
const ar: Translations = { ...en, allChats: "الكل", direct: "مباشر", groups: "مجموعات", channels: "قنوات", search: "بحث", message: "رسالة", online: "متصل", settings: "إعدادات", logOut: "تسجيل خروج", cancel: "إلغاء", confirm: "تأكيد" };
const pt: Translations = { ...en, allChats: "Todos", direct: "Direto", groups: "Grupos", channels: "Canais", search: "Buscar", message: "Mensagem", online: "online", settings: "Configurações", logOut: "Sair", cancel: "Cancelar", confirm: "Confirmar" };
const ja: Translations = { ...en, allChats: "すべて", direct: "ダイレクト", groups: "グループ", channels: "チャンネル", search: "検索", message: "メッセージ", online: "オンライン", settings: "設定", logOut: "ログアウト", cancel: "キャンセル", confirm: "確認" };
const ko: Translations = { ...en, allChats: "전체", direct: "다이렉트", groups: "그룹", channels: "채널", search: "검색", message: "메시지", online: "온라인", settings: "설정", logOut: "로그아웃", cancel: "취소", confirm: "확인" };

const translations: Record<LangCode, Translations> = { en, ru, es, fr, de, zh, ar, pt, ja, ko };

/** Get current language */
export function getCurrentLang(): LangCode {
  const saved = localStorage.getItem("meshlink-lang");
  if (saved && saved in translations) return saved as LangCode;
  const browser = navigator.language.split("-")[0];
  if (browser in translations) return browser as LangCode;
  return "en";
}

/** Set language */
export function setLang(lang: LangCode): void {
  localStorage.setItem("meshlink-lang", lang);
}

/** Get translations for current language */
export function t(): Translations {
  return translations[getCurrentLang()];
}

/** Get specific translation */
export function tr(key: keyof Translations): string {
  return translations[getCurrentLang()][key];
}

/** Available languages */
export const LANGUAGES: { code: LangCode; name: string; native: string }[] = [
  { code: "en", name: "English", native: "English" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "zh", name: "Chinese", native: "中文" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
];
