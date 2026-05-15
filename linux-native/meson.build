project('meshlink', 'c',
  version: '1.0.0',
  default_options: ['c_std=c17', 'warning_level=2']
)

gtk_dep = dependency('gtk4', version: '>= 4.0')
soup_dep = dependency('libsoup-3.0')
json_dep = dependency('json-glib-1.0')
sqlite_dep = dependency('sqlite3')
secret_dep = dependency('libsecret-1')
ssl_dep = dependency('openssl')

src = files(
  'src/main.c',
  'src/network/matrix_client.c',
  'src/network/sync_service.c',
  'src/network/media_cache.c',
  'src/network/e2ee.c',
  'src/data/database.c',
  'src/data/secure_storage.c',
  'src/ui/login_window.c',
  'src/ui/main_window.c',
  'src/ui/chat_view.c',
  'src/ui/profile_window.c',
  'src/ui/settings_window.c',
  'src/ui/contacts_window.c',
  'src/ui/create_chat_window.c',
  'src/ui/content_window.c',
  'src/util/helpers.c',
)

executable('meshlink', src,
  dependencies: [gtk_dep, soup_dep, json_dep, sqlite_dep, secret_dep, ssl_dep],
  install: true
)
