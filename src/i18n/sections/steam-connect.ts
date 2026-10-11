// Copy for connecting a Steam account and importing the library.
// ru is the source of truth; en must provide exactly the same keys.

export const steamConnectRu = {
  title: 'Steam',
  connectHint:
    'Подключите аккаунт, и игры из Steam переедут в библиотеку за один клик, вместе с наигранными часами.',
  signIn: 'Войти через Steam',
  signInNote:
    'Откроется сайт Steam. Пароль мы не видим: Steam только подтверждает, чей это аккаунт.',
  connectedAs: 'Подключён аккаунт Steam',
  openProfile: 'Профиль в Steam',
  disconnect: 'Отключить',
  importTitle: 'Импорт библиотеки',
  importText:
    'Игры с наигранными часами попадут в «Играю», остальные в «В планах». Всё, что уже есть в библиотеке, останется как было.',
  importButton: 'Импортировать игры',
  importAgain: 'Импортировать ещё раз',
  resultTitle: 'Импорт завершён',
  resultAdded: 'Добавлено',
  resultExisting: 'Уже были',
  resultFailed: 'Не удалось',
  resultClose: 'Готово',
  partialTitle: 'Steam отдал только недавние игры',
  partialText:
    'Полный список скрыт настройками приватности. Есть два способа получить всю библиотеку, достаточно одного.',
  wayOneTitle: 'Открыть список игр в Steam',
  wayOneText:
    'Профиль → Редактировать профиль → Настройки приватности → «Данные об играх» → «Открытый». Потом импортируйте ещё раз.',
  wayTwoTitle: 'Или добавить свой ключ Steam',
  wayTwoText: 'С ключом Steam отдаёт полный список, даже если профиль закрыт.',
  keyToggleOpen: 'Как получить ключ Steam',
  keyToggleClose: 'Свернуть инструкцию',
  keyWhy:
    'Ключ нужен только затем, чтобы Steam отдал полный список игр. Он хранится на вашем сервере и больше нигде не показывается.',
  keyStep1: 'Откройте страницу ключей Steam и войдите в аккаунт.',
  keyStep2: 'В поле «Domain Name» напишите localhost (подойдёт любое слово) и нажмите «Register».',
  keyStep3: 'Скопируйте длинный ключ из 32 символов и вставьте его сюда.',
  keyOpenPage: 'Открыть страницу ключей',
  keyLabel: 'Ключ Steam Web API',
  keyPlaceholder: '32 символа: цифры и буквы a–f',
  keySave: 'Сохранить ключ',
  keyInvalid: 'Ключ состоит из 32 символов: цифры и буквы a–f.',
  keySaved: 'Ключ сохранён, он заканчивается на {hint}.',
  keyRemove: 'Удалить ключ',
  toastConnected: 'Steam подключён',
  toastCancelled: 'Вход через Steam отменён',
  toastRejected: 'Steam не подтвердил вход. Попробуйте ещё раз.',
  toastUnreachable: 'Не удалось связаться со Steam. Проверьте интернет и повторите.',
  toastDisconnected: 'Steam отключён',
  toastKeySaved: 'Ключ сохранён',
  toastKeyRemoved: 'Ключ удалён',
}

export const steamConnectEn: typeof steamConnectRu = {
  title: 'Steam',
  connectHint:
    'Connect your account and your Steam games move into the library in one click, playtime included.',
  signIn: 'Sign in with Steam',
  signInNote:
    'The Steam site opens. We never see your password: Steam only confirms whose account it is.',
  connectedAs: 'Steam account connected',
  openProfile: 'Steam profile',
  disconnect: 'Disconnect',
  importTitle: 'Library import',
  importText:
    'Games with playtime land in "Playing", the rest in "Planned". Anything already in the library stays as it was.',
  importButton: 'Import games',
  importAgain: 'Import again',
  resultTitle: 'Import finished',
  resultAdded: 'Added',
  resultExisting: 'Already there',
  resultFailed: 'Failed',
  resultClose: 'Done',
  partialTitle: 'Steam returned recent games only',
  partialText:
    'The full list is hidden by privacy settings. There are two ways to get the whole library; one is enough.',
  wayOneTitle: 'Make the game list public in Steam',
  wayOneText:
    'Profile → Edit profile → Privacy settings → "Game details" → "Public". Then import again.',
  wayTwoTitle: 'Or add your own Steam key',
  wayTwoText: 'With a key Steam returns the full list even when the profile is private.',
  keyToggleOpen: 'How to get a Steam key',
  keyToggleClose: 'Hide the guide',
  keyWhy:
    'The key only lets Steam return the full game list. It is stored on your server and shown nowhere else.',
  keyStep1: 'Open the Steam key page and sign in.',
  keyStep2: 'Type localhost (any word works) into "Domain Name" and press "Register".',
  keyStep3: 'Copy the long 32-character key and paste it here.',
  keyOpenPage: 'Open the key page',
  keyLabel: 'Steam Web API key',
  keyPlaceholder: '32 characters: digits and letters a–f',
  keySave: 'Save key',
  keyInvalid: 'A key is 32 characters: digits and letters a–f.',
  keySaved: 'Key saved, it ends in {hint}.',
  keyRemove: 'Remove key',
  toastConnected: 'Steam connected',
  toastCancelled: 'Steam sign-in cancelled',
  toastRejected: 'Steam did not confirm the sign-in. Try again.',
  toastUnreachable: 'Could not reach Steam. Check your connection and retry.',
  toastDisconnected: 'Steam disconnected',
  toastKeySaved: 'Key saved',
  toastKeyRemoved: 'Key removed',
}
