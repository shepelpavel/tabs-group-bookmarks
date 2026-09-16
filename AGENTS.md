# AGENTS.md — tabs-group-bookmarks

Chrome-расширение (Manifest V3), адаптированное также под Firefox, для
управления группами вкладок: сохраняет группы вкладок в закладки и открывает
их обратно группами. Работает в хром-подобных браузерах (Chrome, Edge, Yandex,
Vivaldi, Opera) и Firefox 139+.

## Структура

```
manifest.json       — MV3-манифест, кросс-браузерный:
                      background.scripts (Firefox event page) +
                      background.service_worker (Chrome); gecko.id,
                      strict_min_version 139.0. permissions: tabs,
                      tabGroups, bookmarks, storage, alarms
background.js       — service worker: автосохранение всех групп по chrome.alarms (раз в минуту)
popup/
  index.html        — разметка popup (вкладки: Save / Open / Settings)
  script.js         — вся логика popup: рендер списков, сохранение/открытие/закрытие групп
  style.less        — ИСХОДНИК стилей
  style.css         — скомпилированный из style.less (в репозитории, коммитить вместе с .less)
  style.css.map     — sourcemap
icons/              — PNG 16/48/128/256/512 + icon.svg
```

Нет сборщика, package.json, тестов и линтеров — чистый JS. Проверка — только
загрузкой расширения в браузере.

## Запуск / проверка

1. `chrome://extensions` → Режим разработчика → «Загрузить распакованное» →
   корень репо.
2. После правок — кнопка «обновить» на карточке расширения; popup открывается
   кликом по иконке, service worker смотрится в `chrome://extensions` →
   «service worker» (консоль воркера отдельная от popup).
3. Проверять в консоли popup: ошибки API видны там; фоновый воркер — в своей
   консоли.

## Архитектура и данные

**Хранилище** (`chrome.storage.local`):
- `path` — имя корневой папки закладок (по умолчанию `Groups` в popup,
  `TabsGroups` в background.js — рассинхрон дефолтов, учитывать).
- `autosave` — строка `'on'` / `'off'`.

**Закладки**: корневая папка ищется по `chrome.bookmarks.search({ title })`,
если нет — создаётся. Внутри неё по папке на группу вкладок; папка с тем же
именем каждый раз пересоздаётся (`removeTree` + `create`) — сохранение группы
всегда затирает прошлую версию.

**Поток данных** — каскад колбэков в `getData()`:
storage → tabGroups.query → tabs.query → bookmarks.search → getSubTree.
Данные (`groupsArr`, `tabsArr`, `bookmarksFoldersArr`, `targetFolderId`) живут
в одном объекте и передаются в обработчики через `body.myData`.

**Действия**:
- `saveGroup(groupId)` — папку группы пересоздать, в неё bookmark на каждый
  таб группы. Безымянной группе — title `NONAME`.
- `openGroup(folderId)` — `chrome.tabs.create` (inactive) для каждого
  закладка → `chrome.tabs.group` → `chrome.tabGroups.update` (title).
- `closeGroup(groupId)` — удалить все табы группы.
- Автосохранение: `chrome.alarms` `periodInMinutes: 1`; воркер эфемерный
  (MV3), alarm пересоздаётся при каждом старте воркера — это нормально.

## Конвенции кода

- Chrome API — колбэк-стиль (`(res) => {}`), кроме `chrome.storage.local`
  (promise, `.then`). Смешивать стили — так исторически сложилось, следовать
  существующему виду.
- Popup: делегирование кликов/инпута на `body` (`eventsList`), цели
  определяются классами `js-save` / `js-close` / `js-load` / `js-tab` /
  `js-save-path` / `js-autosave` / `js-search`; id группы/папки — в
  `data-groupId` / `data-folderId`. Новый элемент списка обязан нести `js-*`
  класс и data-атрибут.
- CSS: BEM-подобные имена (`.list__item_save`), LESS-вложенности. Править
  `style.less`, потом перекомпилировать в `style.css` (напр.
  `npx lessc popup/style.less popup/style.css`), коммитить оба файла.
- Никаких фреймворков, бандлеров и зависимостей — не добавлять без запроса.

## Известные грабли

- Firefox: popup-панель умирает при потере фокуса — первый же
  `tabs.create` в `openGroup` закрывает её, цикл обрывается. Поэтому открытие
  группы делается в background через `runtime.sendMessage` (action
  `openGroup`); в Chrome такой проблемы нет, но messaging работает в обоих.
- Firefox: `tab.groupId` — число, в Chrome — строка; все сравнения в коде
  через `==` (не `===`), это осознанно — не «чинить» на `===`.
- Firefox: `background.scripts` обязателен в манифесте (service worker не
  поддерживается); Chrome 121+ молча игнорирует `scripts` — dual-запись
  сохранять при правках манифеста.
- Firefox: API групп (`tabs.group`, `tabGroups.query/update`) идентичны
  Chrome с 139; min version поднимать только вместе с проверкой новых API.
- `bookmarks.search({ title })` возвращает первый результат по совпадению
  имени — пользовательские папки с тем же именем в других местах закладок
  могут перехватить поиск.
- `openGroup` итерирует детей папки через `for` + счётчик и группирует табы
  по факту создания последнего — при правках не нарушать порядок
  `tabs.create → tabs.group → tabGroups.update`.
- Popup перерисовывается целиком после каждого действия (`showDone()` →
  `initExt()`), подписчики пересоздаются; старый listener снимается перед
  новым — при добавлении событий следовать этому паттерну.
- `<title>kaomoji</title>` в popup/index.html — наследие другого проекта,
  на работу не влияет.
- Отладочный `console.log(data)` в `initExt` — оставить/убирать осознанно.

## Git

- Ветка `main`, Conventional Commits (`feat:`, `fix:`, `release: x.y`).
- Не коммитить без явного запроса пользователя.