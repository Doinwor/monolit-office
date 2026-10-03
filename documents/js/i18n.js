/* ==========================================================
   МОНОЛИТ ОФИС — языки интерфейса (i18n). Общий модуль.
   Языки: русский (ru), English (en), бардакский (bd).
   Выбор хранится в localStorage('mono.lang'). При первом
   заходе показывается окно «Выбери язык»; поменять можно
   кнопкой-шестерёнкой в правом верхнем углу.
   ========================================================== */
(function () {
  'use strict';

  var LS = 'mono.lang';
  var LANGS = [
    { key: 'ru', name: 'Русский', short: 'RU', sub: 'русский язык' },
    { key: 'en', name: 'English', short: 'EN', sub: 'english language' },
    { key: 'bd', name: 'Бардакса кӧл', short: 'BD', sub: 'бардакский язык' }
  ];

  var DICT = {
    /* ---------- выбор языка ---------- */
    'lang.title': { ru: 'Выбери язык', en: 'Choose a language', bd: 'Кӧл сайла' },
    'lang.lead': {
      ru: 'На каком языке показывать программу? Потом можно поменять в настройках (шестерёнка).',
      en: 'Which language should the program use? You can change it later in the settings (gear).',
      bd: 'Программа қайсы кӧлтә кӧрсәтсин? Сон сайламаларда (шестерня) алмаштырып була.'
    },
    'lang.free': {
      ru: 'Бардакский — выдуманный язык проекта, не русский, не украинский и не польский.',
      en: 'Bardak is the fictional language of this project — not Russian, Ukrainian or Polish.',
      bd: 'Бардакса — проектнинг тоба кӧл. Ол рус, украин йа поляк кӧл тӱгӧл.'
    },
    'lang.settings.title': { ru: 'Настройки', en: 'Settings', bd: 'Сайламалар' },

    /* ---------- программы ---------- */
    'app.documents.name': { ru: 'Документы', en: 'Documents', bd: 'Документләр' },
    'app.documents.desc': { ru: 'тексты, письма, отчёты', en: 'texts, letters, reports', bd: 'текстләр, хатлар, отчётлар' },
    'app.tables.name': { ru: 'Таблицы', en: 'Tables', bd: 'Ҷадваллар' },
    'app.tables.desc': { ru: 'сетки, расчёты, сметы', en: 'grids, sums, estimates', bd: 'торлар, һисаплар, сметалар' },
    'app.presentation.name': { ru: 'Презентации', en: 'Presentations', bd: 'Слайдлар' },
    'app.presentation.desc': { ru: 'слайды и доклады', en: 'slides and talks', bd: 'слайдлар ва докладлар' },

    /* ---------- общий офис (office.js) ---------- */
    'office.name': { ru: 'Монолит Офис', en: 'Monolit Office', bd: 'Монолит Офис' },
    'office.switch': {
      ru: 'Монолит Офис — перейти в другую программу',
      en: 'Monolit Office — switch to another program',
      bd: 'Монолит Офис — башқа программаға кӧч'
    },
    'office.settings': { ru: 'Настройки и язык', en: 'Settings and language', bd: 'Сайламалар ва кӧл' },
    'office.about': { ru: 'О программе', en: 'About', bd: 'Программа ҳақында' },
    'office.about.desc': {
      ru: 'что умеет и что нет', en: 'what it can and cannot do', bd: 'не ҡыла ала, не ҡыла алмай'
    },

    /* ---------- телефон ---------- */
    'phone.title': { ru: 'На телефоне программа недоступна', en: 'Not available on a phone', bd: 'Телефонда программа йоқ' },
    'phone.body': {
      ru: 'Приложение «Монолит Офис» — {app} — работает только на компьютере или ноутбуке. Мы определили, что ты зашёл с телефона, поэтому редактор здесь не откроется.',
      en: 'The “Monolit Office” app — {app} — works only on a computer or laptop. You seem to be on a phone, so the editor will not open here.',
      bd: '«Монолит Офис» программасы — {app} — тек компьютер йа ноутбукта ишләй. Тан телефондан кирдең, шуңа редактор мында ачылмай.'
    },
    'phone.hint': {
      ru: 'Открой сайт на компьютере — или включи в браузере телефона «Версию для компьютера».',
      en: 'Open the site on a computer — or turn on “Desktop site” in your phone browser.',
      bd: 'Сайтны компьютерда ач — йа телефон браузерында «Компьютер кӧрӱшӱн» қош.'
    },
    'phone.open': { ru: 'Всё равно открыть', en: 'Open anyway', bd: 'Барыбер ач' },

    /* ---------- сайт: навигация ---------- */
    'site.title': {
      ru: 'Монолит Офис 2000 — Документы, Таблицы, Презентации',
      en: 'Monolit Office 2000 — Documents, Tables, Presentations',
      bd: 'Монолит Офис 2000 — Документләр, Ҷадваллар, Слайдлар'
    },
    'site.card.docs': {
      ru: 'Документы<span>тексты, письма, отчёты</span>',
      en: 'Documents<span>texts, letters, reports</span>',
      bd: 'Документләр<span>текстләр, хатлар, отчётлар</span>'
    },
    'site.card.tables': {
      ru: 'Таблицы<span>сетки, расчёты, сметы</span>',
      en: 'Tables<span>grids, sums, estimates</span>',
      bd: 'Ҷадваллар<span>торлар, һисаплар, сметалар</span>'
    },
    'site.card.presentation': {
      ru: 'Презентации<span>слайды и доклады</span>',
      en: 'Presentations<span>slides and talks</span>',
      bd: 'Слайдлар<span>слайдлар ва докладлар</span>'
    },
    'site.nav.apps': { ru: 'Программы', en: 'Programs', bd: 'Программалар' },
    'site.nav.features': { ru: 'Возможности', en: 'Features', bd: 'Мӧмкинлекләр' },
    'site.nav.formats': { ru: 'Форматы', en: 'Formats', bd: 'Форматлар' },
    'site.nav.run': { ru: 'Как открыть', en: 'How to open', bd: 'Кандай ачарға' },

    /* ---------- сайт: шапка ---------- */
    'site.hero.tag': { ru: 'набор из трёх программ', en: 'a set of three programs', bd: 'өс программадан йыйынтық' },
    'site.hero.title': {
      ru: 'Монолит Офис — <em>всё для работы в одном наборе</em>',
      en: 'Monolit Office — <em>everything for work in one set</em>',
      bd: 'Монолит Офис — <em>эш өсӧн бары да бер йыйынтықта</em>'
    },
    'site.hero.lead': {
      ru: 'Настоящие Word, Excel и PowerPoint мы не покупали. Здесь — урезанные версии: только то, что нужно каждый день. Открываются двойным щелчком, работают без интернета, ничего не устанавливают и никуда не отправляют твои данные.',
      en: 'We did not buy the real Word, Excel or PowerPoint. These are cut-down versions: only what is needed every day. They open with a double click, work without the internet, install nothing and never send your data anywhere.',
       bd: 'Ысын Word, Excel ва PowerPoint сатып алмадыҡ. Мында — ҡыҫҡа версиялар: һәр кӧн кәрәк нәрсә генә. Ике басыу менән асылалар, интернетһыҙ ишләйләр, һичнәрсә ҡурыштырмайлар ва синең биреләреңде һичҡайҙа йибәрмиләр.'
    },
    'site.open.documents': { ru: 'Открыть Документы', en: 'Open Documents', bd: 'Документләрне ач' },
    'site.open.tables': { ru: 'Открыть Таблицы', en: 'Open Tables', bd: 'Ҷадвалларны ач' },
    'site.open.presentation': { ru: 'Открыть Презентации', en: 'Open Presentations', bd: 'Слайдларны ач' },
    'site.hero.icos': {
      ru: 'Документы · Таблицы · Презентации — проект корпорации Монолит',
      en: 'Documents · Tables · Presentations — a project of the Monolit corporation',
      bd: 'Документләр · Ҷадваллар · Слайдлар — Монолит корпорациянең проекты'
    },

    /* ---------- сайт: три программы ---------- */
    'site.apps.title': { ru: 'Три программы', en: 'Three programs', bd: 'Ӱч программа' },
    'site.apps.lead': {
      ru: 'У каждой свой цвет и свой набор функций, но интерфейс устроен одинаково.',
      en: 'Each has its own colour and feature set, but the interface is built the same way.',
      bd: 'Һәрберсенең үҙендә тӱс ва үҙендә үзенчәлекләр, амма интерфейс бердәй тӧзӧлгән.'
    },
    'site.docs.desc': {
      ru: 'Программа для текстов: письма, отчёты, инструкции и статьи.',
      en: 'A program for texts: letters, reports, instructions and articles.',
      bd: 'Текстләр өсӧн программа: хатлар, отчётлар, кӧрсәтмәләр ва мәҡәләләр.'
    },
    'site.docs.l1': { ru: 'Шрифты, начертания, размер и цвет текста', en: 'Fonts, styles, text size and colour', bd: 'Йазулар, начертаниеләр, текст ӧлчӱсе ва тӱсе' },
    'site.docs.l2': { ru: 'Абзацы, отступы и выравнивание', en: 'Paragraphs, indents and alignment', bd: 'Абзацлар, чигенешләр ва тизиш' },
    'site.docs.l3': { ru: 'Маркированные и нумерованные списки', en: 'Bulleted and numbered lists', bd: 'Билгеләнгән ва санланған тизмәләр' },
    'site.docs.l4': { ru: 'Поиск и замена по всему тексту', en: 'Find and replace across the text', bd: 'Бӧтӧн текстта издәӱ ва алмаштыру' },
    'site.docs.l5': { ru: 'Счётчики символов, слов и строк', en: 'Counters of characters, words and lines', bd: 'Билгеләр, сӧзләр ва юллар һаналғычы' },
    'site.docs.l6': { ru: 'Сохранение в файл, печать, отмена', en: 'Saving to a file, printing, undo', bd: 'Файлға сакълау, басма, ҡайтару' },
    'site.tabs.desc': {
      ru: 'Программа для расчётов: сметы, калькуляции, учёт. Понимает формулы и считает сама.',
      en: 'A program for calculations: estimates, costing, accounting. It understands formulas and calculates on its own.',
      bd: 'Һәсап өсӧн программа: сметалар, калькуляцияләр, учёт. Формулаларны аңлай ва үҙе һисаплай.'
    },
    'site.tabs.l1': { ru: 'Формулы с русскими именами: <code>=СУММ(B2:B9)</code>', en: 'Formulas with native names: <code>=SUM(B2:B9)</code>', bd: 'Формулалар тӱп исемнәр менән: <code>=СУММ(B2:B9)</code>' },
    'site.tabs.l2': { ru: '38 функций, арифметика, условия, ссылки', en: '38 functions, arithmetic, conditions, references', bd: '38 функция, арифметика, шартлар, һылтанмалар' },
    'site.tabs.l3': { ru: 'Пять числовых форматов, включая деньги', en: 'Five number formats, including money', bd: 'Биш сан форматы, ақчаны ла қушып' },
    'site.tabs.l4': { ru: 'Заливка ячеек, цвета текста, границы', en: 'Cell fill, text colours, borders', bd: 'Күзәнәк тултыру, текст тӱсләре, сикләр' },
    'site.tabs.l5': { ru: 'Копирование, вставка, заполнение формул', en: 'Copying, pasting, filling formulas', bd: 'Кӧчӱрӱ, қыстыру, формулалар тултыру' },
    'site.tabs.l6': { ru: 'Готовые примеры: смета и таблица продаж', en: 'Ready examples: an estimate and a sales table', bd: 'Әзер мисаллар: смета ва сатыу ҷадвалы' },
    'site.pre.desc': {
      ru: 'Программа для слайдов: собираете доклад из экранов и запускаете показ.',
      en: 'A program for slides: build a talk from screens and start the show.',
      bd: 'Слайдлар өсӧн программа: докладны экраннардан йыяһың ва кӧрсәтӱне башлайһың.'
    },
    'site.pre.l1': { ru: 'Слайды: заголовок, текст, списки', en: 'Slides: title, text, lists', bd: 'Слайдлар: башлық, текст, тизмәләр' },
    'site.pre.l2': { ru: 'Картинки на слайдах', en: 'Pictures on slides', bd: 'Слайдларда рәсемнәр' },
    'site.pre.l3': { ru: 'Показ слайдов с клавиатуры', en: 'Keyboard-driven slide show', bd: 'Клавиатуранан слайд кӧрсәтӱ' },
    'site.pre.l4': { ru: 'Готовые шаблоны под типовой доклад', en: 'Ready templates for a typical talk', bd: 'Тип доклад өсӧн әзер шаблоннар' },
    'site.pre.l5': { ru: 'Настройка размера и оформления текста', en: 'Adjusting text size and styling', bd: 'Текст ӧлчӱсен ва бизәлешен кӧйләӱ' },
    'site.pre.l6': { ru: 'Сохранение в файл и печать раздатки', en: 'Saving to a file and printing a handout', bd: 'Файлға сакълау ва таратыу басмаһы' },

    /* ---------- сайт: возможности ---------- */
    'site.feat.title': { ru: 'Что общего у всех трёх программ', en: 'What all three programs share', bd: 'Ӱч программада ла уртақ нәрсә' },
    'site.feat.lead': {
      ru: 'Набор сделан так, чтобы переход между программами не мешал работе.',
      en: 'The set is made so that switching between programs does not get in the way.',
      bd: 'Йыйынтық шулай эшләнгән: программалар арасында кӧч эшкә ҡамасауламай.'
    },
    'site.f1.t': { ru: 'Переход между программами', en: 'Switching between programs', bd: 'Программалар арасында кӧч' },
    'site.f1.p': { ru: 'Кнопка «Монолит Офис» в правом верхнем углу открывает список программ.', en: 'The “Monolit Office” button in the top-right corner opens the list of programs.', bd: 'Ӧң юғары мӧйәштәге «Монолит Офис» кнопкаһы программалар тизмәһен аса.' },
    'site.f1.a': { ru: 'Из Таблиц можно прыгнуть в Документы и обратно', en: 'Jump from Tables to Documents and back', bd: 'Ҷадваллардан Документләргә һикереп була ва кире' },
    'site.f1.b': { ru: 'Показывается загрузчик с иконками', en: 'A loader with icons is shown', bd: 'Билгеләр менән йӧкләгеч кӧрсәтелә' },
    'site.f2.t': { ru: 'Без установки', en: 'No installation', bd: 'Қурыштыруһыз' },
    'site.f2.p': { ru: 'Программы — обычные страницы. Скопировали папку и открыли в браузере.', en: 'The programs are ordinary pages. Copy the folder and open it in a browser.', bd: 'Программалар — ғәдити битләр. Папканы кӧчӱрҙең һәм браузерҙа астың.' },
    'site.f2.a': { ru: 'Никаких установщиков и мастеров', en: 'No installers or wizards', bd: 'Қурыштырғыстар ва мастерҙар йоқ' },
    'site.f2.b': { ru: 'Работает с флешки и с диска', en: 'Works from a USB stick or a disk', bd: 'Флешканан ва дисктан ишләй' },
    'site.f3.t': { ru: 'Без интернета', en: 'No internet', bd: 'Интернетһыҙ' },
    'site.f3.p': { ru: 'Страницы не запрашивают данные из сети.', en: 'The pages never request data from the network.', bd: 'Битләр селтәрҙән биреләр һорамай.' },
    'site.f3.a': { ru: 'Можно работать там, где связи нет', en: 'You can work where there is no connection', bd: 'Бәйләнеш булмаған ерҙә эшләп була' },
    'site.f3.b': { ru: 'Данные не отправляются на сервер', en: 'Data is not sent to a server', bd: 'Биреләр серверға йибәрелмәй' },
    'site.f4.t': { ru: 'Одинаковые сочетания клавиш', en: 'The same keyboard shortcuts', bd: 'Бердәй клавиш ҡатнашмалары' },
    'site.f4.p': { ru: 'Привычные сочетания работают одинаково во всех трёх программах.', en: 'The familiar shortcuts work the same in all three programs.', bd: 'Күнеккән ҡатнашмалар өс программала ла бердәй ишләй.' },
    'site.f4.a': { ru: 'Ctrl+Z — отмена, Ctrl+Y — повтор', en: 'Ctrl+Z — undo, Ctrl+Y — redo', bd: 'Ctrl+Z — ҡайтару, Ctrl+Y — ҡабатлау' },
    'site.f4.b': { ru: 'Ctrl+C, Ctrl+V — копирование и вставка', en: 'Ctrl+C, Ctrl+V — copy and paste', bd: 'Ctrl+C, Ctrl+V — кӧчӱрӱ ва қыстыру' },
    'site.f4.c': { ru: 'Ctrl+S — сохранить, Ctrl+P — печать', en: 'Ctrl+S — save, Ctrl+P — print', bd: 'Ctrl+S — сакълау, Ctrl+P — басма' },
    'site.f5.t': { ru: 'Одинаковое оформление', en: 'A consistent look', bd: 'Бердәй бизәлеш' },
    'site.f5.p': { ru: 'Меню, шрифты и кнопки выглядят одинаково.', en: 'Menus, fonts and buttons look the same.', bd: 'Менюлар, йазулар ва кнопкалар бердәй кӧренә.' },
    'site.f5.a': { ru: 'Не нужно каждый раз привыкать заново', en: 'No need to re-learn it every time', bd: 'Һәр юлы ҡабат өйрәнергә кәрәк тӱгӧл' },
    'site.f5.b': { ru: 'Понятная панель инструментов в каждой', en: 'A clear toolbar in each of them', bd: 'Һәрберсендә аңлайышлы ҡорал панеле' },
    'site.f6.t': { ru: 'Данные остаются у вас', en: 'Your data stays with you', bd: 'Биреләр һиндә ҡала' },
    'site.f6.p': { ru: 'Всё, что вы набрали, лежит в файле на вашем компьютере.', en: 'Everything you type is kept in a file on your computer.', bd: 'Йыйғаның барыһы ла компьютерыңдағы файлда ята.' },
    'site.f6.a': { ru: 'Никаких аккаунтов и облаков', en: 'No accounts and no clouds', bd: 'Аккаунтлар ва болоттар йоқ' },
    'site.f6.b': { ru: 'Файл можно скопировать куда угодно', en: 'The file can be copied anywhere', bd: 'Файлды теләһә ҡайҙа кӧчӧрөп була' },

    /* ---------- сайт: форматы ---------- */
    'site.fmt.title': { ru: 'Какие файлы поддерживаются', en: 'Which files are supported', bd: 'Қайһы файлдар тотола' },
    'site.fmt.lead': { ru: 'У каждой программы свой формат, а Таблицы дополнительно понимают обычный CSV.', en: 'Each program has its own format, and Tables also understands plain CSV.', bd: 'Һәр программаның үҙ форматы бар, Ҷадваллар өҫтәп ғәдити CSV-ны ла аңлай.' },
    'site.fmt.prog': { ru: 'Программа', en: 'Program', bd: 'Программа' },
    'site.fmt.save': { ru: 'Сохраняет', en: 'Saves', bd: 'Сакълай' },
    'site.fmt.open': { ru: 'Открывает', en: 'Opens', bd: 'Аса' },
    'site.fmt.ownfile': { ru: 'свой файл набора', en: 'its own set file', bd: 'йыйынтыҡтың үҙ файлы' },
    'site.fmt.between': { ru: 'Между программами', en: 'Between programs', bd: 'Программалар араһында' },
    'site.fmt.clip': { ru: 'буфер обмена: текст и таблица с разделением табуляцией', en: 'clipboard: text and a tab-separated table', bd: 'алмаштырыу буферы: текст ва табуляция менән бүленгән ҷадвал' },
    'site.fmt.note': {
      ru: '<b>Честно:</b> совместимости с файлами настоящих Word, Excel и PowerPoint нет. Это урезанные версии со своим форматом. Всё, что нужно для работы, внутри есть, а сложных функций вроде макросов и диаграмм — нет и не будет.',
      en: '<b>Honestly:</b> there is no compatibility with real Word, Excel or PowerPoint files. These are cut-down versions with their own format. Everything you need for work is inside, while advanced features like macros and charts are not there and will not be.',
      bd: '<b>Ысын:</b> ысын Word, Excel ва PowerPoint файлдары менән татыулыҡ юҡ. Был — үҙ форматы менән ҡыҫҡа версиялар. Эш өсӧн кәрәк барыһы ла эстә, әммә макростар ва диаграммалар кеүек ҡатмарлы нәрсәләр юҡ ва булмаясаҡ.'
    },

    /* ---------- сайт: как открыть ---------- */
    'site.run.title': { ru: 'Как открыть', en: 'How to open', bd: 'Кандай асырға' },
    'site.run.lead': { ru: 'Четыре шага, и можно работать.', en: 'Four steps and you can work.', bd: 'Дӱрт аҙым — эшләп була.' },
    'site.run.s1': { ru: 'Откройте папку с набором: в ней <code>documents</code>, <code>tables</code>, <code>presentation</code> и <code>site</code>.', en: 'Open the folder with the set: it contains <code>documents</code>, <code>tables</code>, <code>presentation</code> and <code>site</code>.', bd: 'Йыйынтыҡ папкаһын ас: эсендә <code>documents</code>, <code>tables</code>, <code>presentation</code> ва <code>site</code>.' },
    'site.run.s2': { ru: 'Двойным щелчком откройте эту страницу — <code>site\\index.html</code>.', en: 'Double-click to open this page — <code>site\\index.html</code>.', bd: 'Ике басыу менән был битте ас — <code>site\\index.html</code>.' },
    'site.run.s3': { ru: 'Выберите программу и нажмите «Открыть».', en: 'Choose a program and click “Open”.', bd: 'Программа һайла ва «Ас» төймәһенә бас.' },
    'site.run.s4': { ru: 'Работайте. Готовый файл сохраняется кнопкой «Сохранить».', en: 'Work. The finished file is saved with the “Save” button.', bd: 'Эшлә. Әзер файл «Сакъла» төймәһе менән сакълана.' },
    'site.run.cta': { ru: 'Выбери программу — покажем загрузчик и откроем окно.', en: 'Pick a program — we will show a loader and open the window.', bd: 'Программа һайла — йӧкләгесте кӧрсәтербеҙ ва тәҙрәне асарбыҙ.' },

    /* ---------- сайт: подвал ---------- */
    'site.foot.about': {
      ru: 'Набор из трёх программ для работы с текстом, таблицами и презентациями. Работает в браузере, без установки и без интернета.',
      en: 'A set of three programs for working with text, tables and presentations. Runs in a browser, with no installation and no internet.',
      bd: 'Текст, ҷадвал ва слайдтар менән эшләү өсӧн өс программалы йыйынтыҡ. Браузерҙа ишләй, қурыштырыуһыҙ ва интернетһыҙ.'
    },
    'site.foot.programs': { ru: 'Программы', en: 'Programs', bd: 'Программалар' },
    'site.foot.sections': { ru: 'Разделы', en: 'Sections', bd: 'Бӱлектәр' },
    'site.foot.credit': {
      ru: 'Проект создан <b>корпорацией Монолит</b>. Локальный проект — данные никуда не отправляются.',
      en: 'The project was created by the <b>Monolit corporation</b>. A local project — data is never sent anywhere.',
      bd: 'Проект <b>Монолит корпорацияһы</b> тарафынан эшләнгән. Локаль проект — биреләр һичҡайҙа йибәрелмәй.'
    },
    'site.task.local': { ru: 'Монолит Офис 2000 — всё локально', en: 'Monolit Office 2000 — all local', bd: 'Монолит Офис 2000 — барыһы ла локаль' }
  };

  /* ==========================================================
     СЛОВАРЬ РЕДАКТОРОВ. Общие подписи интерфейса (ui.*) и
     отдельные для каждой программы. Добавляется к DICT.
     ========================================================== */
  var DICT2 = {

    /* ---------- общие подписи интерфейса ---------- */
    'ui.create': { ru: 'Создать', en: 'New', bd: 'Йаса' },
    'ui.open': { ru: 'Открыть', en: 'Open', bd: 'Ач' },
    'ui.save': { ru: 'Сохранить', en: 'Save', bd: 'Сакъла' },
    'ui.print': { ru: 'Печать', en: 'Print', bd: 'Бас' },
    'ui.cut': { ru: 'Вырезать', en: 'Cut', bd: 'Қырқ' },
    'ui.copy': { ru: 'Копировать', en: 'Copy', bd: 'Кӧчӱр' },
    'ui.paste': { ru: 'Вставить', en: 'Paste', bd: 'Қыстыр' },
    'ui.undo': { ru: 'Отменить', en: 'Undo', bd: 'Қайтар' },
    'ui.redo': { ru: 'Повторить', en: 'Redo', bd: 'Қабатла' },
    'ui.find': { ru: 'Найти', en: 'Find', bd: 'Издә' },
    'ui.replace': { ru: 'Заменить', en: 'Replace', bd: 'Алмаштыр' },
    'ui.next': { ru: 'Далее', en: 'Next', bd: 'Артабан' },
    'ui.prev': { ru: 'Назад', en: 'Back', bd: 'Артҡа' },
    'ui.close': { ru: 'Закрыть', en: 'Close', bd: 'Яп' },
    'ui.delete': { ru: 'Удалить', en: 'Delete', bd: 'Юй' },
    'ui.apply': { ru: 'Применить', en: 'Apply', bd: 'Ҡуллан' },
    'ui.reset': { ru: 'Сброс', en: 'Reset', bd: 'Таҙарт' },
    'ui.increase': { ru: 'Увеличить', en: 'Increase', bd: 'Арттыр' },
    'ui.decrease': { ru: 'Уменьшить', en: 'Decrease', bd: 'Кәмет' },
    'ui.fit': { ru: 'Вписать', en: 'Fit', bd: 'Һыйҙыр' },
    'ui.file': { ru: 'Файл', en: 'File', bd: 'Файл' },
    'ui.home': { ru: 'Главная', en: 'Home', bd: 'Тӧп' },
    'ui.insert': { ru: 'Вставка', en: 'Insert', bd: 'Ҡыстырыу' },
    'ui.view': { ru: 'Вид', en: 'View', bd: 'Кӧрӧш' },
    'ui.layout': { ru: 'Разметка', en: 'Layout', bd: 'Билдәләү' },
    'ui.about': { ru: 'О программе', en: 'About', bd: 'Программа ҳаҡында' },
    'ui.paragraph': { ru: 'Абзац', en: 'Paragraph', bd: 'Абзац' },
    'ui.paragraphs': { ru: 'Абзацы', en: 'Paragraphs', bd: 'Абзацтар' },
    'ui.font': { ru: 'Шрифт', en: 'Font', bd: 'Йазу' },
    'ui.clipboard': { ru: 'Буфер обмена', en: 'Clipboard', bd: 'Алмаштырыу буферы' },
    'ui.styles': { ru: 'Стили', en: 'Styles', bd: 'Стилдәр' },
    'ui.scale': { ru: 'Масштаб', en: 'Zoom', bd: 'Масштаб' },
    'ui.areas': { ru: 'Области', en: 'Panels', bd: 'Өлкәләр' },
    'ui.page': { ru: 'Страница', en: 'Page', bd: 'Бит' },
    'ui.margins': { ru: 'Поля', en: 'Margins', bd: 'Яландар' },
    'ui.ruler': { ru: 'Линейка', en: 'Ruler', bd: 'Һыҙғыс' },
    'ui.grid': { ru: 'Сетка', en: 'Grid', bd: 'Тор' },
    'ui.paraMarks': { ru: 'Знаки абзацев', en: 'Paragraph marks', bd: 'Абзац билдәләре' },
    'ui.bulletList': { ru: 'Маркированный список', en: 'Bulleted list', bd: 'Билгеләнгән тизмә' },
    'ui.numList': { ru: 'Нумерованный список', en: 'Numbered list', bd: 'Санланған тизмә' },
    'ui.alignLeft': { ru: 'по левому краю', en: 'align left', bd: 'һул ҡырыйға' },
    'ui.alignCenter': { ru: 'по центру', en: 'align centre', bd: 'уртаға' },
    'ui.alignRight': { ru: 'по правому краю', en: 'align right', bd: 'уң ҡырыйға' },
    'ui.alignJust': { ru: 'по ширине', en: 'justify', bd: 'киңлеккә' },
    'ui.alignLeftT': { ru: 'По левому краю', en: 'Align left', bd: 'Һул ҡырыйға' },
    'ui.alignCenterT': { ru: 'По центру', en: 'Align centre', bd: 'Уртаға' },
    'ui.alignRightT': { ru: 'По правому краю', en: 'Align right', bd: 'Уң ҡырыйға' },
    'ui.alignJustT': { ru: 'По ширине', en: 'Justify', bd: 'Киңлеккә' },
    'ui.indent': { ru: 'отступ', en: 'indent', bd: 'сигенеш' },
    'ui.spacing': { ru: 'интервал', en: 'spacing', bd: 'арауыҡ' },
    'ui.lineSpacing': { ru: 'межстрочный интервал', en: 'line spacing', bd: 'юл арауығы' },
    'ui.lhNormal': { ru: 'обычный', en: 'normal', bd: 'ғәдити' },
    'ui.textColor': { ru: 'цвет текста', en: 'text colour', bd: 'текст тӧҫӧ' },
    'ui.bold': { ru: 'Ж', en: 'B', bd: 'Ҡ' },
    'ui.italic': { ru: 'К', en: 'I', bd: 'К' },
    'ui.underline': { ru: 'Ч', en: 'U', bd: 'Аҫ' },
    'ui.sup': { ru: 'Надстрочный', en: 'Superscript', bd: 'Өҫкӧ яҙыу' },
    'ui.sub': { ru: 'Подстрочный', en: 'Subscript', bd: 'Аҫҡа яҙыу' },
    'ui.strike': { ru: 'Зачёркнутый', en: 'Strikethrough', bd: 'Һыҙылған' },
    'ui.highlight': { ru: 'Выделение цветом', en: 'Highlight', bd: 'Тӧҫ менән билдәләү' },
    'ui.clearFmt': { ru: 'Убрать начертание и выделение', en: 'Clear style and highlight', bd: 'Начертание һәм тӧҫтӧ алып ташла' },
    'ui.portrait': { ru: 'Книжная', en: 'Portrait', bd: 'Китап' },
    'ui.landscape': { ru: 'Альбомная', en: 'Landscape', bd: 'Альбом' },
    'ui.narrow': { ru: 'Узкие', en: 'Narrow', bd: 'Тар' },
    'ui.wide': { ru: 'Широкие', en: 'Wide', bd: 'Киң' },
    'ui.normal': { ru: 'Обычные', en: 'Normal', bd: 'Ғәдити' },
    'ui.on': { ru: 'вкл', en: 'on', bd: 'қабыҙ' },
    'ui.off': { ru: 'выкл', en: 'off', bd: 'һүндер' },
    'ui.word': { ru: 'Word', en: 'Word', bd: 'Word' },
    'ui.style.p': { ru: 'обычный текст', en: 'normal text', bd: 'ғәдити текст' },
    'ui.style.h1': { ru: 'заголовок 1', en: 'heading 1', bd: 'башлыҡ 1' },
    'ui.style.h2': { ru: 'заголовок 2', en: 'heading 2', bd: 'башлыҡ 2' },
    'ui.style.h3': { ru: 'заголовок 3', en: 'heading 3', bd: 'башлыҡ 3' },
    'ui.style.li': { ru: 'список (точками)', en: 'list (bullets)', bd: 'тизмә (нөктәләр)' },
    'ui.style.ol': { ru: 'список (номерами)', en: 'list (numbers)', bd: 'тизмә (һандар)' },
    'ui.style.quote': { ru: 'цитата', en: 'quote', bd: 'цитата' },
    'ui.style.pre': { ru: 'моноширинный', en: 'monospaced', bd: 'бер киңлекле' },
    'ui.style.h1s': { ru: 'заголовок 1', en: 'Heading 1', bd: 'Башлыҡ 1' },
    'ui.style.h2s': { ru: 'заголовок 2', en: 'Heading 2', bd: 'Башлыҡ 2' },
    'ui.style.h3s': { ru: 'заголовок 3', en: 'Heading 3', bd: 'Башлыҡ 3' },
    'ui.style.quoteS': { ru: 'цитата', en: 'Quote', bd: 'Цитата' },
    'ui.style.liS': { ru: 'список', en: 'List', bd: 'Тизмә' },

    /* ---------- Документы: заголовок окна ---------- */
    'doc.winTitle': { ru: 'ДОКУМЕНТЫ МОНОЛИТ 2000 [beta 0.4] - офис монолит', en: 'MONOLIT DOCUMENTS 2000 [beta 0.4] — Monolit office', bd: 'МОНОЛИТ ДОКУМЕНТЛӘР 2000 [beta 0.4] — Монолит офис' },
    'doc.tbApp': { ru: 'Документы&nbsp;Монолит', en: 'Monolit&nbsp;Documents', bd: 'Монолит&nbsp;Документләр' },
    'doc.nameLabel': { ru: 'имя документа', en: 'document name', bd: 'документ исеме' },
    'doc.defaultName': { ru: 'Мой документ', en: 'My document', bd: 'Минем документым' },
    'doc.hitsPre': { ru: 'Вы', en: 'Visitor #', bd: 'Тан' },
    'doc.hitsSuf': { ru: '-й посетитель!', en: '', bd: '-се килеүсе!' },
    'doc.zoom': { ru: 'масштаб', en: 'zoom', bd: 'масштаб' },

    /* ---------- Документы: лента «Файл» ---------- */
    'doc.gFile': { ru: 'Файл', en: 'File', bd: 'Файл' },
    'doc.saveMono': { ru: 'Сохранить .mono', en: 'Save .mono', bd: '.mono сакъла' },
    'doc.openMono': { ru: 'Открыть .mono', en: 'Open .mono', bd: '.mono ас' },
    'doc.saveDocx': { ru: 'Сохранить .docx', en: 'Save .docx', bd: '.docx сакъла' },
    'doc.saveHtm': { ru: 'Сохранить .htm', en: 'Save .htm', bd: '.htm сакъла' },
    'doc.saveTxt': { ru: 'Сохранить .txt', en: 'Save .txt', bd: '.txt сакъла' },
    'doc.tpl': { ru: 'Пример (химия)', en: 'Sample (chemistry)', bd: 'Өлгө (химия)' },
    'doc.auto': { ru: 'Автосохранение: ', en: 'Autosave: ', bd: 'Автосакълау: ' },
    'doc.clearAll': { ru: 'Очистить всё', en: 'Clear all', bd: 'Барыһын таҙарт' },
    'doc.sound': { ru: 'Звук: ', en: 'Sound: ', bd: 'Тауыш: ' },
    'doc.beep': { ru: 'пищать при клике', en: 'beep on click', bd: 'баҫҡанда сиртлә' },

    /* ---------- Документы: вставка ---------- */
    'doc.after': { ru: 'Абзац после', en: 'Paragraph after', bd: 'Абзац һуңынан' },
    'doc.line': { ru: 'Линия', en: 'Line', bd: 'Һыҙыҡ' },
    'doc.lineT': { ru: 'Горизонтальная линия', en: 'Horizontal line', bd: 'Күнделек һыҙыҡ' },
    'doc.image': { ru: 'Картинка', en: 'Picture', bd: 'Рәсем' },
    'doc.imageT': { ru: 'Вставить картинку (ещё можно перетащить файл на страницу)', en: 'Insert a picture (you can also drag a file onto the page)', bd: 'Рәсем ҡыстыр (файлды биткә һөйрәп була)' },
    'doc.link': { ru: 'Ссылка', en: 'Link', bd: 'Һылтанма' },
    'doc.linkT': { ru: 'Ссылка (Ctrl+K)', en: 'Link (Ctrl+K)', bd: 'Һылтанма (Ctrl+K)' },
    'doc.dup': { ru: 'Копия', en: 'Duplicate', bd: 'Күсермә' },
    'doc.up': { ru: 'Выше', en: 'Up', bd: 'Өҫкә' },
    'doc.down': { ru: 'Ниже', en: 'Down', bd: 'Аҫҡа' },
    'doc.impWord': { ru: 'Импорт из Word (.docx)', en: 'Import from Word (.docx)', bd: 'Word-тан импорт (.docx)' },
    'doc.impAny': { ru: 'Открыть .txt / .htm / .mono', en: 'Open .txt / .htm / .mono', bd: '.txt / .htm / .mono ас' },
    'doc.impNote': { ru: 'документ прямо в страницу. картинки вставляем, колонтитулы — нет.', en: 'the document goes right onto the page. pictures are inserted, headers and footers are not.', bd: 'документ тура биткә. рәсемдәр ҡыстырыла, колонтитулдар — юҡ.' },

    /* ---------- Документы: вид ---------- */
    'doc.findPh': { ru: 'что ищем', en: 'find what', bd: 'нимә эҙләйбеҙ' },

    /* ---------- Документы: разметка ---------- */
    'doc.revert': { ru: 'Сбросить оформление', en: 'Reset formatting', bd: 'Бизәлеште таҙарт' },

    /* ---------- Документы: быстрые кнопки ---------- */
    'doc.qNew': { ru: 'Создать (Ctrl+N)', en: 'New (Ctrl+N)', bd: 'Йаса (Ctrl+N)' },
    'doc.qOpen': { ru: 'Открыть (Ctrl+O)', en: 'Open (Ctrl+O)', bd: 'Ас (Ctrl+O)' },
    'doc.qSave': { ru: 'Сохранить .mono (Ctrl+S)', en: 'Save .mono (Ctrl+S)', bd: '.mono сакъла (Ctrl+S)' },
    'doc.qPrint': { ru: 'Печать (Ctrl+P)', en: 'Print (Ctrl+P)', bd: 'Бас (Ctrl+P)' },
    'doc.qUndo': { ru: 'Отменить (Ctrl+Z)', en: 'Undo (Ctrl+Z)', bd: 'Қайтар (Ctrl+Z)' },
    'doc.qRedo': { ru: 'Повторить (Ctrl+Y)', en: 'Redo (Ctrl+Y)', bd: 'Қабатла (Ctrl+Y)' },
    'doc.qFind': { ru: 'Найти (Ctrl+F)', en: 'Find (Ctrl+F)', bd: 'Издә (Ctrl+F)' },

    /* ---------- Документы: шрифты ---------- */
    'doc.font.tah': { ru: 'Tahoma (программная)', en: 'Tahoma (system)', bd: 'Tahoma (программа)' },
    'doc.font.times': { ru: 'Times New Roman (умный)', en: 'Times New Roman (clever)', bd: 'Times New Roman (аҡыллы)' },
    'doc.font.comic': { ru: 'Comic Sans MS (красивый)', en: 'Comic Sans MS (pretty)', bd: 'Comic Sans MS (матур)' },
    'doc.font.arial': { ru: 'Arial (скучный)', en: 'Arial (boring)', bd: 'Arial (ялҡау)' },
    'doc.font.impact': { ru: 'Impact (громкий)', en: 'Impact (loud)', bd: 'Impact (ҡысҡырыҡ)' },
    'doc.font.courier': { ru: 'Courier New (как в DOS)', en: 'Courier New (like DOS)', bd: 'Courier New (DOS кеүек)' },

    /* ---------- Документы: прочее ---------- */
    'doc.selPara': { ru: 'выделен абзац', en: 'selected paragraph', bd: 'билдәләнгән абзац' },
    'doc.indUpT': { ru: 'Уменьшить отступ', en: 'Decrease indent', bd: 'Сигенеште кәмет' },
    'doc.indDownT': { ru: 'Увеличить отступ', en: 'Increase indent', bd: 'Сигенеште арттыр' },
    'doc.spaceT': { ru: 'Интервал перед абзацем', en: 'Space before paragraph', bd: 'Абзац алдынан арауыҡ' },
    'doc.foot': { ru: 'живая страница. жми на абзац и печатай прямо в ней.', en: 'a live page. click a paragraph and type right in it.', bd: 'тере бит. абзацҡа баҫ һәм тура унда яҙ.' },
    'doc.credit': { ru: 'Документы Монолит 2000 — проект <b>корпорации Монолит</b> · © Корпорация Монолит, все права защищены', en: 'Monolit Documents 2000 — a project of the <b>Monolit corporation</b> · © Monolit Corporation, all rights reserved', bd: 'Монолит Документләр 2000 — <b>Монолит корпорацияһы</b> проекты · © Монолит Корпорацияһы, бөтә хоҡуҡтар һаҡланған' },
    'doc.tbLogoAlt': { ru: 'Документы Монолит', en: 'Monolit Documents', bd: 'Монолит Документләр' },
    'doc.marquee': { ru: '&nbsp;*~*&nbsp;ДОКУМЕНТЫ МОНОЛИТ: ТЕПЕРЬ КАК В ВОРДЕ&nbsp;*~-&nbsp;лента сверху, живая страница, кнопка «Монолит Офис» справа&nbsp;*~-&nbsp;Ctrl+Z работает, не бойся&nbsp;*~-&nbsp;проект корпорации Монолит&nbsp;*~-&nbsp;', en: '&nbsp;*~*&nbsp;MONOLIT DOCUMENTS: NOW LIKE IN WORD&nbsp;*~-&nbsp;a ribbon on top, a live page, the “Monolit Office” button on the right&nbsp;*~-&nbsp;Ctrl+Z works, do not fear&nbsp;*~-&nbsp;a project of the Monolit corporation&nbsp;*~-&nbsp;', bd: '&nbsp;*~*&nbsp;МОНОЛИТ ДОКУМЕНТЛӘР: ХӘҘЕР WORD КЕҮЕК&nbsp;*~-&nbsp;өҫтә лента, тере бит, уңда «Монолит Офис» кнопкаһы&nbsp;*~-&nbsp;Ctrl+Z эшләй, ҡурҡма&nbsp;*~-&nbsp;Монолит корпорацияһы проекты&nbsp;*~-&nbsp;' },
    'doc.dropOv': { ru: 'ОТПУСТИ ФАЙЛ — ЧИТАЕМ', en: 'DROP THE FILE — WE WILL READ IT', bd: 'ФАЙЛДЫ ЕБӘР — УҠЫЙБЫҘ' },

    /* ---------- Документы: мастер импорта ---------- */
    'doc.impTitle': { ru: 'МАСТЕР ИМПОРТА WORD — работает как умеет', en: 'WORD IMPORT WIZARD — it does what it can', bd: 'WORD ИМПОРТ МАСТЕРЫ — нисек белә, шулай эшләй' },
    'doc.impWarn': { ru: '<b>ВНИМАНИЕ!</b> Полный функционал Word сюда не вставляли: он большой и дорогой. При импорте <b>красота слетает</b>: шрифты заменяются на наши (6 штук), картинки и таблицы не переносятся, колонтитулы выбрасываются, интервалы становятся нашими. <b>Текст уцелеет. Остальное — как повезёт.</b>', en: '<b>ATTENTION!</b> The full power of Word was not put here: it is big and expensive. On import <b>the beauty is lost</b>: fonts are replaced with ours (6 of them), pictures and tables are not carried over, headers and footers are thrown away, spacing becomes ours. <b>The text survives. The rest is down to luck.</b>', bd: '<b>ИҒТИБАР!</b> Word-тың тулы кӧсө мында юҡ: ул ҙур ва ҡиммәт. Импортта <b>матурлыҡ оса</b>: йазулар беҙҙекеләргә алмашына (6 дана), рәсемдәр ва ҷадвалдар кӱсмәй, колонтитулдар ырғытыла, арауыҡтар беҙҙеке була. <b>Текст ҡотола. Ҡалғаны — нисек эләкһә.</b>' },
    'doc.dropBig': { ru: '&#128196; КИДАЙ СЮДА .docx &#128196;', en: '&#128196; DROP .docx HERE &#128196;', bd: '&#128196; .docx-ты БЫНДА ТАШЛА &#128196;' },
    'doc.dropSmall': { ru: 'или кнопкой ниже. можно и в любое другое место окна кинуть — мы поймём', en: 'or use the button below. you can drop it anywhere else in the window too — we will get it', bd: 'йа түбәндәге кнопка менән. тәҙрәнең башҡа еренә лә ташлай алаһың — аңларбыҙ' },
    'doc.dryRun': { ru: 'жалкий режим: только отчёт, ничего не менять', en: 'wimpy mode: report only, change nothing', bd: 'меҫкен режим: бары тик отчёт, бер нәмә лә үҙгәртмә' },
    'doc.repLegend': { ru: 'ОТЧЁТ О КОНВЕРТАЦИИ', en: 'CONVERSION REPORT', bd: 'КОНВЕРТАЦИЯ ОТЧЁТЫ' },
    'doc.repInit': { ru: 'отчёт появится тут.\nпока пусто — файл не выбран.', en: 'the report will appear here.\nempty for now — no file chosen.', bd: 'отчёт бында сыға.\nәлегә буш — файл һайланмаған.' },

    /* ---------- Документы: о программе ---------- */
    'doc.aboutFile': { ru: 'о программе.txt', en: 'about.txt', bd: 'программа ҳаҡында.txt' },
    'doc.aboutH': { ru: 'ДОКУМЕНТЫ МОНОЛИТ 2000 (beta 0.4)', en: 'MONOLIT DOCUMENTS 2000 (beta 0.4)', bd: 'МОНОЛИТ ДОКУМЕНТЛӘР 2000 (beta 0.4)' },
    'doc.aboutP': { ru: 'Часть <b>Офиса Монолит</b>. Тот же редактор, что и в настоящем Word, только легче и честнее.', en: 'Part of the <b>Monolit Office</b>. The same editor as in the real Word, only lighter and more honest.', bd: '<b>Монолит Офис</b>-тың бер өлөшө. Ысын Word-тағы уҡ редактор, тик еңелерәк ва намыҫлыраҡ.' },
    'doc.abTabs': { ru: 'Вкладок в ленте:', en: 'Tabs in the ribbon:', bd: 'Лентала вкладкалар:' },
    'doc.abStyles': { ru: 'Стилей абзаца:', en: 'Paragraph styles:', bd: 'Абзац стилдәре:' },
    'doc.abFonts': { ru: 'Шрифтов:', en: 'Fonts:', bd: 'Йазуҙар:' },
    'doc.abNative': { ru: 'Формат родной:', en: 'Native format:', bd: 'Тыуған формат:' },
    'doc.abOpens': { ru: 'Открывает:', en: 'Opens:', bd: 'Аса:' },
    'doc.abSaves': { ru: 'Сохраняет:', en: 'Saves:', bd: 'Сакълай:' },
    'doc.abUndo': { ru: 'Отмена Ctrl+Z:', en: 'Undo Ctrl+Z:', bd: 'Қайтарыу Ctrl+Z:' },
    'doc.abUndoV': { ru: 'есть, 40 шагов', en: 'yes, 40 steps', bd: 'бар, 40 аҙым' },
    'doc.abDev': { ru: 'Разработчик проекта:', en: 'Project developer:', bd: 'Проект эшләүсе:' },
    'doc.crNote': { ru: '<b>Проект создан корпорацией Монолит.</b> Документы Монолит 2000 — собственная разработка корпорации Монолит. Настоящий Word мы не покупали и не используем. <br>© Корпорация Монолит. Все права защищены.', en: '<b>The project was created by the Monolit corporation.</b> Monolit Documents 2000 is an original development of the Monolit corporation. We did not buy and do not use the real Word. <br>© Monolit Corporation. All rights reserved.', bd: '<b>Проект Монолит корпорацияһы тарафынан эшләнгән.</b> Монолит Документләр 2000 — Монолит корпорацияһының үҙ эшләнмәһе. Ысын Word-ты беҙ һатып алманыҡ ва ҡулланмайбыҙ. <br>© Монолит Корпорацияһы. Бөтә хоҡуҡтар һаҡланған.' },
    'doc.howPrint': { ru: 'КАК ПЕЧАТАТЬ', en: 'HOW TO PRINT', bd: 'НИСЕК БАҪАРҒА' },
    'doc.hp1': { ru: 'Жми на страницу и печатай — это живой документ, не поле для текста.', en: 'Click the page and type — it is a live document, not a text box.', bd: 'Биткә баҫ ва яҙ — был тере документ, текст яланы тӱгӧл.' },
    'doc.hp2': { ru: 'Enter — новый абзац, Shift+Enter — перенос строки, Tab — табуляция.', en: 'Enter — a new paragraph, Shift+Enter — a line break, Tab — a tab.', bd: 'Enter — яңы абзац, Shift+Enter — юл күсереү, Tab — табуляция.' },
    'doc.hp3': { ru: 'Лента сверху меняет оформление на ходу: шрифт, начертание, списки, отступы.', en: 'The ribbon on top changes formatting on the fly: font, style, lists, indents.', bd: 'Өҫтәге лента бизәлеште эш барышында алмаштыра: йазу, начертание, тизмәләр, сигенештәр.' },
    'doc.hp4': { ru: 'Ctrl+S — сохранить .mono, Ctrl+P — печать.', en: 'Ctrl+S — save .mono, Ctrl+P — print.', bd: 'Ctrl+S — .mono сакъла, Ctrl+P — бас.' },
    'doc.lostTitle': { ru: 'ЧТО СЛЕТАЕТ ПРИ ОТКРЫТИИ WORD', en: 'WHAT IS LOST WHEN OPENING WORD', bd: 'WORD АСҠАНДА НИМӘ ОСА' },
    'doc.lost1': { ru: '<b>шрифты</b> — заменяются на наши шесть.', en: '<b>fonts</b> — replaced with our six.', bd: '<b>йазуҙар</b> — беҙҙең алты менән алмашына.' },
    'doc.lost2': { ru: '<b>картинки, фото, рисунки</b> — не переносятся.', en: '<b>pictures, photos, drawings</b> — not carried over.', bd: '<b>рәсемдәр, фото, һүрәттәр</b> — кӱсмәй.' },
    'doc.lost3': { ru: '<b>таблицы</b> — становятся строчками текста.', en: '<b>tables</b> — become lines of text.', bd: '<b>ҷадвалдар</b> — текст юлдарына әйләнә.' },
    'doc.lost4': { ru: '<b>колонтитулы и нумерация страниц</b> — выбрасываются.', en: '<b>headers, footers and page numbers</b> — thrown away.', bd: '<b>колонтитулдар ва бит һандары</b> — ырғытыла.' },
    'doc.warnImport': { ru: 'Если после импорта стало уродливо — это <b>не баг</b>. Настоящий Word мы не покупали.', en: 'If it looks ugly after import — that is <b>not a bug</b>. We did not buy the real Word.', bd: 'Импорттан һуң йәмһеҙ булһа — был <b>баг тӱгӧл</b>. Ысын Word-ты беҙ һатып алманыҡ.' }
  };
  (function () { for (var k in DICT2) if (DICT2.hasOwnProperty(k)) DICT[k] = DICT2[k]; })();

  var DICT3 = {
    /* ---------- Таблицы ---------- */
    'tbl.winTitle': { ru: 'ТАБЛИЦЫ МОНОЛИТ 2000 [beta 0.4] - офис монолит', en: 'MONOLIT TABLES 2000 [beta 0.4] — Monolit office', bd: 'МОНОЛИТ ҶАДВАЛЛАР 2000 [beta 0.4] — Монолит офис' },
    'tbl.tbApp': { ru: 'Таблицы&nbsp;Монолит', en: 'Monolit&nbsp;Tables', bd: 'Монолит&nbsp;Ҷадваллар' },
    'tbl.tbLogoAlt': { ru: 'Таблицы Монолит', en: 'Monolit Tables', bd: 'Монолит Ҷадваллар' },
    'tbl.nameLabel': { ru: 'имя таблицы', en: 'table name', bd: 'ҷадвал исеме' },
    'tbl.defaultName': { ru: 'Моя таблица', en: 'My table', bd: 'Минем ҷадвалым' },
    'tbl.nameBoxT': { ru: 'имя ячейки или диапазона. напиши B5 или A1:C9 и нажми Enter', en: 'cell or range name. type B5 or A1:C9 and press Enter', bd: 'күҙәнәк йа диапазон исеме. B5 йа A1:C9 яҙ ва Enter баҫ' },
    'tbl.insFxT': { ru: 'Вставить функцию', en: 'Insert a function', bd: 'Функция ҡыстыр' },
    'tbl.cancelFxT': { ru: 'Отменить (Esc)', en: 'Cancel (Esc)', bd: 'Кире ҡайтар (Esc)' },
    'tbl.okFxT': { ru: 'Ввести (Enter)', en: 'Enter (Enter)', bd: 'Индереү (Enter)' },
    'tbl.fbTextT': { ru: 'содержимое ячейки. формулы начинаются со знака =', en: 'cell contents. formulas start with =', bd: 'күҙәнәк эстәлеге. формулалар = тамғаһынан башлана' },
    'tbl.nmNameT': { ru: 'имя для выделенного диапазона. напиши имя и нажми Enter — потом его можно будет вписать в формулу', en: 'a name for the selected range. type a name and press Enter — later you can use it in a formula', bd: 'билдәләнгән диапазонға исем. исем яҙ ва Enter баҫ — һуңынан формулаға индерә алаһың' },
    'tbl.nmSaveT': { ru: 'Запомнить имя диапазона', en: 'Remember the range name', bd: 'Диапазон исемен хәтерлә' },
    'tbl.nmGoT': { ru: 'Перейти к имени диапазона (Enter)', en: 'Go to the range name (Enter)', bd: 'Диапазон исеменә күс (Enter)' },
    'tbl.nmDelT': { ru: 'Забыть имя диапазона', en: 'Forget the range name', bd: 'Диапазон исемен онот' },
    'tbl.qCsv': { ru: 'CSV', en: 'CSV', bd: 'CSV' },
    'tbl.qCsvT': { ru: 'Сохранить .csv', en: 'Save .csv', bd: '.csv сакъла' },
    'tbl.qSum': { ru: 'Сумма', en: 'Sum', bd: 'Сумма' },
    'tbl.qSumT': { ru: 'Автосумма (=СУММ)', en: 'Autosum (=SUM)', bd: 'Автосумма (=СУММ)' },
    'tbl.used': { ru: 'ячеек:', en: 'cells:', bd: 'күҙәнәктәр:' },
    'tbl.fxTab': { ru: 'Формулы', en: 'Formulas', bd: 'Формулалар' },
    'tbl.openMono': { ru: 'Открыть .mono', en: 'Open .mono', bd: '.mono ас' },
    'tbl.openCsv': { ru: 'Открыть .csv', en: 'Open .csv', bd: '.csv ас' },
    'tbl.saveCsv': { ru: 'Сохранить .csv', en: 'Save .csv', bd: '.csv сакъла' },
    'tbl.tplSmeta': { ru: 'Пример: смета (химия)', en: 'Sample: estimate (chemistry)', bd: 'Өлгө: смета (химия)' },
    'tbl.tplSale': { ru: 'Пример: продажи', en: 'Sample: sales', bd: 'Өлгө: Һатыу' },
    'tbl.nativeNote': { ru: 'родной формат .mono — это обычный текст с JSON внутри.', en: 'the native .mono format is plain text with JSON inside.', bd: 'тыуған .mono форматы — эсендә JSON менән ғәдити текст.' },
    'tbl.color': { ru: 'цвет', en: 'colour', bd: 'тӧҫ' },
    'tbl.boldT': { ru: 'Полужирный (Ctrl+B)', en: 'Bold (Ctrl+B)', bd: 'Ярымйыуан (Ctrl+B)' },
    'tbl.italT': { ru: 'Курсив (Ctrl+I)', en: 'Italic (Ctrl+I)', bd: 'Курсив (Ctrl+I)' },
    'tbl.underT': { ru: 'Подчёркнутый (Ctrl+U)', en: 'Underlined (Ctrl+U)', bd: 'Аҫты һыҙылған (Ctrl+U)' },
    'tbl.noBoldT': { ru: 'Убрать начертание', en: 'Clear style', bd: 'Начертаниены алып ташла' },
    'tbl.selInfo': { ru: 'выделено', en: 'selected', bd: 'билдәләнгән' },
    'tbl.gAlign': { ru: 'Выравнивание', en: 'Alignment', bd: 'Тигеҙләү' },
    'tbl.alAutoT': { ru: 'По содержимому (числа вправо)', en: 'By content (numbers to the right)', bd: 'Эстәлек буйынса (һандар уңға)' },
    'tbl.alNote': { ru: 'числа и формулы сами встают вправо.', en: 'numbers and formulas align right on their own.', bd: 'һандар ва формулалар үҙе уңға баҫа.' },
    'tbl.gNumber': { ru: 'Число', en: 'Number', bd: 'Һан' },
    'tbl.fmt.gen': { ru: 'обычный', en: 'general', bd: 'ғәдити' },
    'tbl.fmt.int': { ru: 'целое', en: 'integer', bd: 'бөтөн' },
    'tbl.fmt.num': { ru: 'число: 1 234,56', en: 'number: 1 234,56', bd: 'һан: 1 234,56' },
    'tbl.fmt.cur': { ru: 'деньги: 1 234,56 ₽', en: 'money: 1 234,56 ₽', bd: 'аҡса: 1 234,56 ₽' },
    'tbl.fmt.pct': { ru: 'процент: 12,34 %', en: 'percent: 12,34 %', bd: 'процент: 12,34 %' },
    'tbl.fill': { ru: 'заливка', en: 'fill', bd: 'тултырыу' },
    'tbl.fillT': { ru: 'заливка ячейки', en: 'cell fill', bd: 'күҙәнәк тултырыу' },
    'tbl.noFillT': { ru: 'Убрать заливку', en: 'Remove fill', bd: 'Тултырыуҙы алып ташла' },
    'tbl.gCells': { ru: 'Ячейки', en: 'Cells', bd: 'Күҙәнәктәр' },
    'tbl.clear': { ru: 'Очистить', en: 'Clear', bd: 'Таҙарт' },
    'tbl.clearT': { ru: 'Очистить (Delete)', en: 'Clear (Delete)', bd: 'Таҙарт (Delete)' },
    'tbl.insRow': { ru: 'Строку', en: 'Row', bd: 'Юл' },
    'tbl.insRowT': { ru: 'Вставить строку сверху', en: 'Insert a row above', bd: 'Өҫкә юл ҡыстыр' },
    'tbl.delRow': { ru: 'Строки', en: 'Rows', bd: 'Юлдар' },
    'tbl.delRowT': { ru: 'Удалить выделенные строки', en: 'Delete the selected rows', bd: 'Билдәләнгән юлдарҙы юй' },
    'tbl.insCol': { ru: 'Столбец', en: 'Column', bd: 'Бағана' },
    'tbl.insColT': { ru: 'Вставить столбец слева', en: 'Insert a column to the left', bd: 'Һулға бағана ҡыстыр' },
    'tbl.delCol': { ru: 'Столбцы', en: 'Columns', bd: 'Бағаналар' },
    'tbl.delColT': { ru: 'Удалить выделенные столбцы', en: 'Delete the selected columns', bd: 'Билдәләнгән бағаналарҙы юй' },
    'tbl.copyT': { ru: 'Копировать (Ctrl+C)', en: 'Copy (Ctrl+C)', bd: 'Кӧчӱр (Ctrl+C)' },
    'tbl.cutT': { ru: 'Вырезать (Ctrl+X)', en: 'Cut (Ctrl+X)', bd: 'Қырҡ (Ctrl+X)' },
    'tbl.pasteT': { ru: 'Вставить (Ctrl+V)', en: 'Paste (Ctrl+V)', bd: 'Қыстыр (Ctrl+V)' },
    'tbl.gSort': { ru: 'Сортировка', en: 'Sorting', bd: 'Тәртипләү' },
    'tbl.sortAsc': { ru: 'По возрастанию', en: 'Ascending', bd: 'Артҡа' },
    'tbl.sortAscT': { ru: 'Сортировать строки по возрастанию', en: 'Sort rows ascending', bd: 'Юлдарҙы артҡа тәртиплә' },
    'tbl.sortDesc': { ru: 'По убыванию', en: 'Descending', bd: 'Кәмеүгә' },
    'tbl.sortDescT': { ru: 'Сортировать строки по убыванию', en: 'Sort rows descending', bd: 'Юлдарҙы кәмеүгә тәртиплә' },
    'tbl.sortNote': { ru: 'целиком по первому столбцу выделения', en: 'entirely by the first column of the selection', bd: 'тулыһынса билдәләүҙең беренсе бағанаһы буйынса' },
    'tbl.gMerge': { ru: 'Объединение', en: 'Merging', bd: 'Берләштереү' },
    'tbl.merge': { ru: 'Объединить', en: 'Merge', bd: 'Берләштер' },
    'tbl.mergeT': { ru: 'Объединить выделенные ячейки в одну (Ctrl+M)', en: 'Merge the selected cells into one (Ctrl+M)', bd: 'Билдәләнгән күҙәнәктәрҙе бергә берләштер (Ctrl+M)' },
    'tbl.unmerge': { ru: 'Разъединить', en: 'Unmerge', bd: 'Айыр' },
    'tbl.unmergeT': { ru: 'Разъединить объединённые ячейки (Shift+Ctrl+M)', en: 'Unmerge the merged cells (Shift+Ctrl+M)', bd: 'Берләшкән күҙәнәктәрҙе айыр (Shift+Ctrl+M)' },
    'tbl.mergeAll': { ru: 'По столбцу', en: 'By column', bd: 'Бағана буйынса' },
    'tbl.mergeAllT': { ru: 'Объединить все строки в один столбец', en: 'Merge all rows into one column', bd: 'Бөтә юлдарҙы бер бағанаға берләштер' },
    'tbl.mergeNone': { ru: 'Разъединить всё', en: 'Unmerge all', bd: 'Барыһын айыр' },
    'tbl.mergeNoneT': { ru: 'Разъединить всё на листе', en: 'Unmerge everything on the sheet', bd: 'Биттәге барыһын да айыр' },
    'tbl.gFormulas': { ru: 'Формулы', en: 'Formulas', bd: 'Формулалар' },
    'tbl.insFx': { ru: 'Вставить функцию', en: 'Insert a function', bd: 'Функция ҡыстыр' },
    'tbl.fxTextPh': { ru: '=СУММ(A1:A9)', en: '=SUM(A1:A9)', bd: '=СУММ(A1:A9)' },
    'tbl.fxNote': { ru: 'можно вписать формулу руками — хоть в строку формул, хоть в ячейку.', en: 'you can type a formula by hand — either in the formula bar or in the cell.', bd: 'формуланы ҡул менән яҙырға була — формула юлына ла, күҙәнәккә лә.' },
    'tbl.gValues': { ru: 'Значения', en: 'Values', bd: 'Ҡиммәттәр' },
    'tbl.dateT': { ru: 'Сегодняшняя дата', en: 'Today’s date', bd: 'Бөгөнгө дата' },
    'tbl.date': { ru: 'Дата', en: 'Date', bd: 'Дата' },
    'tbl.insOne': { ru: 'вставить 1', en: 'insert 1', bd: '1 ҡыстыр' },
    'tbl.series': { ru: 'Ряд 1,2,3…', en: 'Series 1,2,3…', bd: 'Рәт 1,2,3…' },
    'tbl.gImport': { ru: 'Импорт', en: 'Import', bd: 'Импорт' },
    'tbl.impNote': { ru: 'документы и презентации в таблицу не вставляются — это разные программы.', en: 'documents and presentations are not pasted into a table — they are different programs.', bd: 'документләр ва слайдтар ҷадвалға ҡыстырылмай — улар айырым программалар.' },
    'tbl.gAutoSum': { ru: 'Автосумма', en: 'Autosum', bd: 'Автосумма' },
    'tbl.sum': { ru: 'Сумма', en: 'Sum', bd: 'Сумма' },
    'tbl.sumT': { ru: '=СУММ(весь столбец сверху)', en: '=SUM(the whole column above)', bd: '=СУММ(өҫтәге бөтә бағана)' },
    'tbl.avg': { ru: 'Среднее', en: 'Average', bd: 'Уртаса' },
    'tbl.avgT': { ru: '=СРЗНАЧ', en: '=AVERAGE', bd: '=СРЗНАЧ' },
    'tbl.min': { ru: 'Мин', en: 'Min', bd: 'Мин' },
    'tbl.minT': { ru: '=МИН', en: '=MIN', bd: '=МИН' },
    'tbl.max': { ru: 'Макс', en: 'Max', bd: 'Макс' },
    'tbl.maxT': { ru: '=МАКС', en: '=MAX', bd: '=МАКС' },
    'tbl.cnt': { ru: 'Кол-во', en: 'Count', bd: 'Һаны' },
    'tbl.cntT': { ru: '=СЧЁТ', en: '=COUNT', bd: '=СЧЁТ' },
    'tbl.gMoreFx': { ru: 'Ещё функции', en: 'More functions', bd: 'Тағы функциялар' },
    'tbl.round': { ru: 'Округлить', en: 'Round', bd: 'Түңәрәклә' },
    'tbl.if': { ru: 'Если', en: 'If', bd: 'Әгәр' },
    'tbl.abs': { ru: 'Модуль', en: 'Absolute', bd: 'Модуль' },
    'tbl.sqrt': { ru: 'Корень', en: 'Root', bd: 'Тамыр' },
    'tbl.prod': { ru: 'Произведение', en: 'Product', bd: 'Ҡабатландыҡ' },
    'tbl.mod': { ru: 'Остаток', en: 'Remainder', bd: 'Ҡалдыҡ' },
    'tbl.counta': { ru: 'Заполнено', en: 'Filled', bd: 'Тултырылған' },
    'tbl.concat': { ru: 'Склеить', en: 'Concatenate', bd: 'Йәберлә' },
    'tbl.gCf': { ru: 'Условное форматирование', en: 'Conditional formatting', bd: 'Шартлы форматлау' },
    'tbl.cfOpT': { ru: 'условие для выделенных ячеек', en: 'condition for the selected cells', bd: 'билдәләнгән күҙәнәктәр өсөн шарт' },
    'tbl.gt': { ru: 'больше', en: 'greater', bd: 'ҙурыраҡ' },
    'tbl.lt': { ru: 'меньше', en: 'less', bd: 'бәләкәйерәк' },
    'tbl.eq': { ru: 'равно', en: 'equal', bd: 'тигеҙ' },
    'tbl.cfValT': { ru: 'значение', en: 'value', bd: 'ҡиммәт' },
    'tbl.cfColorT': { ru: 'цвет текста при выполнении условия', en: 'text colour when the condition holds', bd: 'шарт үтәлгәндә текст тӧҫӧ' },
    'tbl.cfFillT': { ru: 'фон при выполнении условия', en: 'background when the condition holds', bd: 'шарт үтәлгәндә фон' },
    'tbl.off': { ru: 'Убрать', en: 'Remove', bd: 'Алып ташла' },
    'tbl.cfOffT': { ru: 'Убрать правило с выделенных ячеек', en: 'Remove the rule from the selected cells', bd: 'Билдәләнгән күҙәнәктәрҙән ҡағиҙәне алып ташла' },
    'tbl.cfNote': { ru: 'правило лежит в ячейке: меняешь число — меняется цвет. Знак минус перед числом не ставим.', en: 'the rule lives in the cell: change the number and the colour changes. We do not put a minus sign before the number.', bd: 'ҡағиҙә күҙәнәктә ята: һанды үҙгәртәһең — тӧҫ үҙгәрә. Һан алдынан минус тамғаһы ҡуймайбыҙ.' },
    'tbl.gFxHelp': { ru: 'что умеем считать', en: 'what we can calculate', bd: 'нимәне һисаплай алабыҙ' },
    'tbl.fxHelp': {
      ru: '<p><b>Знаки:</b> <code>+ - * / ^ %</code>, скобки, сравнения <code>= &lt; &gt; &lt;= &gt;= &lt;&gt;</code>, склейка <code>&amp;</code></p><p><b>Ссылки:</b> <code>A1</code>, <code>$A$1</code> (не поедет при копировании), диапазон <code>A1:C9</code></p><p><b>Суммы:</b> СУММ, СРЗНАЧ, МИН, МАКС, СЧЁТ, СЧЁТЗ, ПРОИЗВЕД</p><p><b>Числа:</b> ОКРУГЛ, ОКРУГЛВНИЗ, ОКРУГЛВВЕРХ, ЦЕЛ, ОСТАТОК, МОД, КОРЕНЬ, СТЕПЕНЬ, ЗНАК, ПИ</p><p><b>Логика:</b> ЕСЛИ, И, ИЛИ, НЕ</p><p><b>Текст:</b> ДЛИНА, ЛЕВСИМВ, ПРАВСИМВ, СРЕДСИМВ, ВЕРХНИЙ, НИЖНИЙ, СЖАТЫЙ, СЦЕПИТЬ</p><p><b>Даты:</b> СЕГОДНЯ, ТЕОДАТА</p><p class="muted">Ошибки показываем честно: #ДЕЛ0! #ИМЯ? #ССЫЛКА! #ЗНАЧ! #ЧИСЛО! #ЦИРЛ!</p>',
      en: '<p><b>Operators:</b> <code>+ - * / ^ %</code>, brackets, comparisons <code>= &lt; &gt; &lt;= &gt;= &lt;&gt;</code>, concatenation <code>&amp;</code></p><p><b>References:</b> <code>A1</code>, <code>$A$1</code> (will not shift when copied), range <code>A1:C9</code></p><p><b>Sums:</b> SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, PRODUCT</p><p><b>Numbers:</b> ROUND, ROUNDDOWN, ROUNDUP, INT, MOD, ABS, SQRT, POWER, SIGN, PI</p><p><b>Logic:</b> IF, AND, OR, NOT</p><p><b>Text:</b> LEN, LEFT, RIGHT, MID, UPPER, LOWER, TRIM, CONCATENATE</p><p><b>Dates:</b> TODAY, DATEVALUE</p><p class="muted">Errors are shown honestly: #DIV/0! #NAME? #REF! #VALUE! #NUM! #CIRC!</p>',
      bd: '<p><b>Тамғалар:</b> <code>+ - * / ^ %</code>, йәйәләр, сағыштырыу <code>= &lt; &gt; &lt;= &gt;= &lt;&gt;</code>, йәберләү <code>&amp;</code></p><p><b>Һылтанмалар:</b> <code>A1</code>, <code>$A$1</code> (кӧчӧргәндә китмәй), диапазон <code>A1:C9</code></p><p><b>Суммалар:</b> СУММ, СРЗНАЧ, МИН, МАКС, СЧЁТ, СЧЁТЗ, ПРОИЗВЕД</p><p><b>Һандар:</b> ОКРУГЛ, ОКРУГЛВНИЗ, ОКРУГЛВВЕРХ, ЦЕЛ, ОСТАТОК, МОД, КОРЕНЬ, СТЕПЕНЬ, ЗНАК, ПИ</p><p><b>Логика:</b> ЕСЛИ, И, ИЛИ, НЕ</p><p><b>Текст:</b> ДЛИНА, ЛЕВСИМВ, ПРАВСИМВ, СРЕДСИМВ, ВЕРХНИЙ, НИЖНИЙ, СЖАТЫЙ, СЦЕПИТЬ</p><p><b>Даталар:</b> СЕГОДНЯ, ТЕОДАТА</p><p class="muted">Хаталарҙы намыҫлы кӧрһәтәбеҙ: #ДЕЛ0! #ИМЯ? #ССЫЛКА! #ЗНАЧ! #ЧИСЛО! #ЦИРЛ!</p>'
    },
    'tbl.ckHead': { ru: 'Заголовки A B C и 1 2 3', en: 'Headers A B C and 1 2 3', bd: 'Башлыҡтар A B C ва 1 2 3' },
    'tbl.ckFill': { ru: 'Квадратик заливки', en: 'Fill handle', bd: 'Тултырыу квадраты' },
    'tbl.gSizes': { ru: 'Размеры', en: 'Sizes', bd: 'Ӧлсәмдәр' },
    'tbl.rows': { ru: 'строки', en: 'rows', bd: 'юлдар' },
    'tbl.cols': { ru: 'столбцы', en: 'columns', bd: 'бағаналар' },
    'tbl.byContent': { ru: 'по содержимому', en: 'by content', bd: 'эстәлек буйынса' },
    'tbl.sizeNote': { ru: 'ширину столбца можно тянуть мышкой за границу в верхней шапке.', en: 'you can drag a column width by its edge in the top header.', bd: 'бағана киңлеген өҫтәге башлыҡта сиктен тартып үҙгәртеп була.' },
    'tbl.gFindRepl': { ru: 'Найти и заменить', en: 'Find and replace', bd: 'Тап һәм алмаштыр' },
    'tbl.fFindPh': { ru: 'найти', en: 'find', bd: 'тап' },
    'tbl.fReplPh': { ru: 'заменить на', en: 'replace with', bd: 'бының менән алмаштыр' },
    'tbl.ckCase': { ru: 'учёт регистра', en: 'match case', bd: 'регистрҙы иҫәпкә ал' },
    'tbl.ckCaseT': { ru: 'с учётом регистра букв', en: 'case-sensitive', bd: 'хәреф регистрын иҫәпкә алып' },
    'tbl.ckFx': { ru: 'в формулах', en: 'in formulas', bd: 'формулаларҙа' },
    'tbl.ckFxT': { ru: 'искать и в формулах', en: 'search in formulas too', bd: 'формулаларҙа ла эҙлә' },
    'tbl.replAll': { ru: 'Заменить всё', en: 'Replace all', bd: 'Барыһын алмаштыр' },
    'tbl.aboutH': { ru: 'ТАБЛИЦЫ МОНОЛИТ 2000 (beta 0.4)', en: 'MONOLIT TABLES 2000 (beta 0.4)', bd: 'МОНОЛИТ ҶАДВАЛЛАР 2000 (beta 0.4)' },
    'tbl.aboutP': { ru: 'Настоящий Excel мы не покупали. Здесь — <b>урезанная</b> версия: сетка, формулы и всё нужное для расчётов и смет.', en: 'We did not buy the real Excel. Here is a <b>cut-down</b> version: a grid, formulas and everything needed for calculations and estimates.', bd: 'Ысын Excel-де беҙ һатып алманыҡ. Бында — <b>ҡыҫҡартылған</b> версия: тор, формулалар ва һисаптар өсөн кәрәк барыһы.' },
    'tbl.abTabs': { ru: 'Вкладок в ленте:', en: 'Tabs in the ribbon:', bd: 'Лентала вкладкалар:' },
    'tbl.abSizeLabel': { ru: 'Размер листа:', en: 'Sheet size:', bd: 'Бит ҙурлығы:' },
    'tbl.abSizeV': { ru: '26 столбцов (A…Z), до 500 строк', en: '26 columns (A…Z), up to 500 rows', bd: '26 бағана (A…Z), 500 юлға тиклем' },
    'tbl.abFxLabel': { ru: 'Формул и функций:', en: 'Formulas and functions:', bd: 'Формулалар ва функциялар:' },
    'tbl.abFxV': { ru: '38 штук, русские имена', en: '38 of them, native names', bd: '38 дана, тӱп исемдәр' },
    'tbl.abFmtLabel': { ru: 'Форматы числа:', en: 'Number formats:', bd: 'Һан форматтары:' },
    'tbl.abFmtV': { ru: '5 (обычный, целое, число, деньги, процент)', en: '5 (general, integer, number, money, percent)', bd: '5 (ғәдити, бөтөн, һан, аҡса, процент)' },
    'tbl.abNative': { ru: 'Формат родной:', en: 'Native format:', bd: 'Тыуған формат:' },
    'tbl.abOpens': { ru: 'Открывает:', en: 'Opens:', bd: 'Аса:' },
    'tbl.abSaves': { ru: 'Сохраняет:', en: 'Saves:', bd: 'Сакълай:' },
    'tbl.abUndo': { ru: 'Отмена Ctrl+Z:', en: 'Undo Ctrl+Z:', bd: 'Қайтарыу Ctrl+Z:' },
    'tbl.abUndoV': { ru: 'есть, 60 шагов', en: 'yes, 60 steps', bd: 'бар, 60 аҙым' },
    'tbl.abDev': { ru: 'Разработчик проекта:', en: 'Project developer:', bd: 'Проект эшләүсе:' },
    'tbl.crNote': { ru: '<b>Проект создан корпорацией Монолит.</b> Таблицы Монолит 2000 — собственная разработка корпорации Монолит. Настоящий Excel мы не покупали и не используем. <br>© Корпорация Монолит. Все права защищены.', en: '<b>The project was created by the Monolit corporation.</b> Monolit Tables 2000 is an original development of the Monolit corporation. We did not buy and do not use the real Excel. <br>© Monolit Corporation. All rights reserved.', bd: '<b>Проект Монолит корпорацияһы тарафынан эшләнгән.</b> Монолит Ҷадваллар 2000 — Монолит корпорацияһының үҙ эшләнмәһе. Ысын Excel-де беҙ һатып алманыҡ ва ҡулланмайбыҙ. <br>© Монолит Корпорацияһы. Бөтә хоҡуҡтар һаҡланған.' },
    'tbl.howCount': { ru: 'КАК СЧИТАТЬ', en: 'HOW TO CALCULATE', bd: 'НИСЕК ҺӘСАПЛАРҒА' },
    'tbl.hc1': { ru: 'Жми на ячейку и печатай. Enter — вниз, Tab — вправо, <b>F2</b> — правка, <b>Esc</b> — отмена.', en: 'Click a cell and type. Enter — down, Tab — right, <b>F2</b> — edit, <b>Esc</b> — cancel.', bd: 'Күҙәнәккә баҫ ва яҙ. Enter — аҫҡа, Tab — уңға, <b>F2</b> — тӧҙәтеү, <b>Esc</b> — кире ҡайтарыу.' },
    'tbl.hc2': { ru: 'Формула начинается со знака <b>=</b>: <code>=B2*C2</code>, <code>=СУММ(B2:B9)</code>.', en: 'A formula starts with <b>=</b>: <code>=B2*C2</code>, <code>=SUM(B2:B9)</code>.', bd: 'Формула <b>=</b> тамғаһынан башлана: <code>=B2*C2</code>, <code>=СУММ(B2:B9)</code>.' },
    'tbl.hc3': { ru: 'Скопируй формулу вниз — ссылки поедут сами: <code>=B2*2</code> в строке 3 станет <code>=B3*2</code>.', en: 'Copy the formula down — references shift on their own: <code>=B2*2</code> in row 3 becomes <code>=B3*2</code>.', bd: 'Формуланы аҫҡа кӧчӧр — һылтанмалар үҙе китә: 3-се юлдағы <code>=B2*2</code> <code>=B3*2</code> була.' },
    'tbl.hc4': { ru: 'Тяни <b>квадратик</b> в правом нижнем углу выделения — заполнит диапазон.', en: 'Drag the <b>little square</b> in the bottom-right corner of the selection — it fills the range.', bd: 'Билдәләүҙең түбәнге уң мӧйәшендәге <b>квадратты</b> тарт — диапазон тула.' },
    'tbl.hc5': { ru: 'Выдели диапазон, впиши его имя рядом со строкой формул — потом пиши <code>=Имя*2</code>.', en: 'Select a range and type its name next to the formula bar — then write <code>=Name*2</code>.', bd: 'Диапазонды билдәлә, исемен формула юлы эргәһенә яҙ — һуңынан <code>=Исем*2</code> яҙ.' },
    'tbl.howMore': { ru: 'УМЕЕМ ЕЩЁ', en: 'WE CAN ALSO', bd: 'ТАҒЫ ЭШЛӘЙБЕҘ' },
    'tbl.hm1': { ru: '<b>сортировка</b> строк по первому столбцу выделения — <code>Главная</code> → Сортировка.', en: '<b>sorting</b> rows by the first column of the selection — <code>Home</code> → Sorting.', bd: 'юлдарҙы билдәләүҙең беренсе бағанаһы буйынса <b>тәртипләү</b> — <code>Тӧп</code> → Тәртипләү.' },
    'tbl.hm2': { ru: '<b>найти и заменить</b> — <code>Вид</code> → Найти и заменить, <b>Ctrl+F</b>.', en: '<b>find and replace</b> — <code>View</code> → Find and replace, <b>Ctrl+F</b>.', bd: '<b>табыу һәм алмаштырыу</b> — <code>Кӧрӧш</code> → Тап һәм алмаштыр, <b>Ctrl+F</b>.' },
    'tbl.hm3': { ru: '<b>объединение ячеек</b> в одну — <code>Главная</code> → Объединение, <b>Ctrl+M</b>.', en: '<b>merging cells</b> into one — <code>Home</code> → Merging, <b>Ctrl+M</b>.', bd: 'күҙәнәктәрҙе бергә <b>берләштереү</b> — <code>Тӧп</code> → Берләштереү, <b>Ctrl+M</b>.' },
    'tbl.hm4': { ru: '<b>условное форматирование</b> — <code>Формулы</code> → Условное форматирование.', en: '<b>conditional formatting</b> — <code>Formulas</code> → Conditional formatting.', bd: '<b>шартлы форматлау</b> — <code>Формулалар</code> → Шартлы форматлау.' },
    'tbl.howNot': { ru: 'ЧЕГО НЕТ И НЕ БУДЕТ', en: 'WHAT IS NOT THERE AND WILL NOT BE', bd: 'НИМӘ ЮҠ ВА БУЛМАЯСАҠ' },
    'tbl.hn1': { ru: '<b>графиков и диаграмм</b> — рисуй сам.', en: '<b>graphs and charts</b> — draw them yourself.', bd: '<b>графиктар ва диаграммалар</b> — үҙең һыҙ.' },
    'tbl.hn2': { ru: '<b>нескольких листов</b> — лист один.', en: '<b>multiple sheets</b> — there is one sheet.', bd: '<b>бер нисә бит</b> — бит бер.' },
    'tbl.hn3': { ru: '<b>макросов и VBA</b> — это уже не «урезанный Excel», а другой Excel.', en: '<b>macros and VBA</b> — that is no longer a “cut-down Excel” but another Excel.', bd: '<b>макростар ва VBA</b> — был инде «ҡыҫҡартылған Excel» тӱгӧл, башҡа Excel.' },
    'tbl.hn4': { ru: '<b>внешних ссылок</b> на другие файлы.', en: '<b>external references</b> to other files.', bd: 'башҡа файлдарға <b>тышҡы һылтанмалар</b>.' },
    'tbl.hn5': { ru: '<b>условных правил по тексту и формулам</b> — только сравнение с числом.', en: '<b>conditional rules on text and formulas</b> — only comparison with a number.', bd: '<b>текст һәм формулалар буйынса шартлы ҡағиҙәләр</b> — бары тик һан менән сағыштырыу.' },
    'tbl.warnRef': { ru: 'Если формула показывает #ССЫЛКА! — значит ты сослался на ячейку, которой нет. Это не баг, это арифметика.', en: 'If a formula shows #REF! it means you referenced a cell that does not exist. That is not a bug, that is arithmetic.', bd: 'Формула #ССЫЛКА! кӧрһәтһә — юҡ күҙәнәккә һылтанғанһың. Был баг тӱгөл, был арифметика.' },
    'tbl.cornerT': { ru: 'выделить всё', en: 'select all', bd: 'барыһын билдәлә' },
    'tbl.fillboxT': { ru: 'протяни и заполнится', en: 'drag and it fills', bd: 'һөйрә — тула' },
    'tbl.credit': { ru: 'Таблицы Монолит 2000 — проект <b>корпорации Монолит</b> · © Корпорация Монолит, все права защищены', en: 'Monolit Tables 2000 — a project of the <b>Monolit corporation</b> · © Monolit Corporation, all rights reserved', bd: 'Монолит Ҷадваллар 2000 — <b>Монолит корпорацияһы</b> проекты · © Монолит Корпорацияһы, бөтә хоҡуҡтар һаҡланған' },
    'tbl.marquee': { ru: '&nbsp;*~*&nbsp;ТАБЛИЦЫ МОНОЛИТ: ФОРМУЛЫ, СУММЫ, СМЕТЫ&nbsp;*~-&nbsp;=СУММ(B2:B9) и Enter&nbsp;*~-&nbsp;тяни квадратик — заполнится&nbsp;*~-&nbsp;Ctrl+Z работает, не бойся&nbsp;*~-&nbsp;проект корпорации Монолит&nbsp;*~-&nbsp;', en: '&nbsp;*~*&nbsp;MONOLIT TABLES: FORMULAS, SUMS, ESTIMATES&nbsp;*~-&nbsp;=SUM(B2:B9) and Enter&nbsp;*~-&nbsp;drag the little square — it fills&nbsp;*~-&nbsp;Ctrl+Z works, do not fear&nbsp;*~-&nbsp;a project of the Monolit corporation&nbsp;*~-&nbsp;', bd: '&nbsp;*~*&nbsp;МОНОЛИТ ҶАДВАЛЛАР: ФОРМУЛАЛАР, СУММАЛАР, СМЕТАЛАР&nbsp;*~-&nbsp;=СУММ(B2:B9) ва Enter&nbsp;*~-&nbsp;квадратты тарт — тула&nbsp;*~-&nbsp;Ctrl+Z эшләй, ҡурҡма&nbsp;*~-&nbsp;Монолит корпорацияһы проекты&nbsp;*~-&nbsp;' },
    'tbl.abDevV': { ru: 'корпорация Монолит', en: 'the Monolit corporation', bd: 'Монолит корпорацияһы' }
  };
  (function () { for (var k in DICT3) if (DICT3.hasOwnProperty(k)) DICT[k] = DICT3[k]; })();

  var DICT4 = {
    /* ---------- Презентации ---------- */
    'pres.winTitle': { ru: 'ПРЕЗЕНТАЦИИ МОНОЛИТ 2000 — редактор', en: 'MONOLIT PRESENTATIONS 2000 — editor', bd: 'МОНОЛИТ СЛАЙДЛАР 2000 — редактор' },
    'pres.logoAlt': { ru: 'Презентации Монолит', en: 'Monolit Presentations', bd: 'Монолит Слайдлар' },
    'pres.h1': { ru: 'ПРЕЗЕНТАЦИИ <b>МОНОЛИТ</b> 2000', en: 'PRESENTATIONS <b>MONOLIT</b> 2000', bd: 'СЛАЙДЛАР <b>МОНОЛИТ</b> 2000' },
    'pres.sub': { ru: 'пиши прямо на слайде — блоки можно двигать', en: 'type right on the slide — blocks can be moved', bd: 'тура слайдта яҙ — блоктарҙы күсереп була' },
    'pres.hitsPre': { ru: 'вы', en: 'you are visitor', bd: 'һеҙ' },
    'pres.hitsSuf': { ru: '-й посетитель', en: '', bd: '-се килеүсе' },
    'pres.designTab': { ru: 'Дизайн', en: 'Design', bd: 'Дизайн' },
    'pres.gPres': { ru: 'Презентация', en: 'Presentation', bd: 'Слайд' },
    'pres.newSlide': { ru: 'Создать слайд', en: 'New slide', bd: 'Слайд йаса' },
    'pres.tpl': { ru: 'Пример', en: 'Sample', bd: 'Өлгө' },
    'pres.eraseAll': { ru: 'Стереть всё', en: 'Erase all', bd: 'Барыһын юй' },
    'pres.gName': { ru: 'Имя', en: 'Name', bd: 'Исем' },
    'pres.nameAria': { ru: 'имя презентации', en: 'presentation name', bd: 'слайд исеме' },
    'pres.defaultName': { ru: 'Моя презентация', en: 'My presentation', bd: 'Минем слайдым' },
    'pres.gSave': { ru: 'Сохранить', en: 'Save', bd: 'Сакъла' },
    'pres.copyMono': { ru: 'Создать копию <b>.mono</b>', en: 'Make a copy <b>.mono</b>', bd: 'Күсермә йаса <b>.mono</b>' },
    'pres.makeHtm': { ru: 'Создать <b>.htm</b>', en: 'Make <b>.htm</b>', bd: 'Йаса <b>.htm</b>' },
    'pres.makeTxt': { ru: 'Создать <b>.txt</b>', en: 'Make <b>.txt</b>', bd: 'Йаса <b>.txt</b>' },
    'pres.gOpen': { ru: 'Открыть', en: 'Open', bd: 'Ас' },
    'pres.fileMono': { ru: 'Файл <b>.mono</b>', en: 'File <b>.mono</b>', bd: 'Файл <b>.mono</b>' },
    'pres.quick': { ru: 'PowerPoint и другое', en: 'PowerPoint and more', bd: 'PowerPoint ва башҡалар' },
    'pres.helpDrag': { ru: 'Файл можно просто перетащить в окно программы.', en: 'You can simply drag a file into the program window.', bd: 'Файлды программа тәҙрәһенә һөйрәп кенә ташларға була.' },
    'pres.gAuto': { ru: 'Автосохранение', en: 'Autosave', bd: 'Автосакълау' },
    'pres.gImpPpt': { ru: 'Мастер импорта PowerPoint', en: 'PowerPoint import wizard', bd: 'PowerPoint импорт мастеры' },
    'pres.dropBig': { ru: 'КИДАЙ СЮДА .pptx или .ppt', en: 'DROP .pptx or .ppt HERE', bd: '.pptx йа .ppt-ты БЫНДА ТАШЛА' },
    'pres.dropSmall': { ru: 'или кнопкой выше — можно и в любое место окна', en: 'or use the button above — or drop it anywhere in the window', bd: 'йа өҫтәге кнопка менән — тәҙрәнең теләһә ҡайһы еренә лә була' },
    'pres.keepOrder': { ru: 'угадывать порядок', en: 'guess the order', bd: 'тәртипте күҙалла' },
    'pres.dryRun': { ru: 'жалкий режим: только отчёт', en: 'wimpy mode: report only', bd: 'меҫкен режим: бары тик отчёт' },
    'pres.repInit': { ru: 'отчёт появится тут. пока пусто — файл не выбран.', en: 'the report will appear here. empty for now — no file chosen.', bd: 'отчёт бында сыға. әлегә буш — файл һайланмаған.' },
    'pres.gSlides': { ru: 'Слайды', en: 'Slides', bd: 'Слайдтар' },
    'pres.new': { ru: 'Создать', en: 'New', bd: 'Йаса' },
    'pres.dup': { ru: 'Копия', en: 'Duplicate', bd: 'Күсермә' },
    'pres.up': { ru: 'Вверх', en: 'Up', bd: 'Өҫкә' },
    'pres.down': { ru: 'Вниз', en: 'Down', bd: 'Аҫҡа' },
    'pres.gBlock': { ru: 'Блок текста', en: 'Text block', bd: 'Текст блогы' },
    'pres.newBlock': { ru: 'Новый блок', en: 'New block', bd: 'Яңы блок' },
    'pres.clear': { ru: 'Очистить', en: 'Clear', bd: 'Таҙарт' },
    'pres.delBlock': { ru: 'Убрать блок', en: 'Remove block', bd: 'Блокты алып ташла' },
    'pres.toCenter': { ru: 'В центр', en: 'To centre', bd: 'Уртаға' },
    'pres.autofit': { ru: 'Автоподгон', en: 'Autofit', bd: 'Автоподгон' },
    'pres.gBlockFont': { ru: 'Шрифт блока', en: 'Block font', bd: 'Блок йазуы' },
    'pres.asSlide': { ru: 'как у слайда', en: 'as on the slide', bd: 'слайд кеүек' },
    'pres.sizeAria': { ru: 'кегль блока', en: 'block size', bd: 'блок ҙурлығы' },
    'pres.gStyle': { ru: 'Начертание', en: 'Style', bd: 'Начертание' },
    'pres.boldT': { ru: 'жирный', en: 'bold', bd: 'йыуан' },
    'pres.italT': { ru: 'курсив', en: 'italic', bd: 'курсив' },
    'pres.underT': { ru: 'подчёркивание', en: 'underline', bd: 'аҫтын һыҙыу' },
    'pres.revertT': { ru: 'вернуть блок как было', en: 'revert the block', bd: 'блокты элеккесә ҡайтар' },
    'pres.gAlign': { ru: 'Выравнивание', en: 'Alignment', bd: 'Тигеҙләү' },
    'pres.gColor': { ru: 'Цвет текста блока', en: 'Block text colour', bd: 'Блок текст тӧҫӧ' },
    'pres.colorAria': { ru: 'цвет текста', en: 'text colour', bd: 'текст тӧҫӧ' },
    'pres.colorAuto': { ru: 'как у слайда', en: 'as on the slide', bd: 'слайд кеүек' },
    'pres.gSlide': { ru: 'Слайд', en: 'Slide', bd: 'Слайд' },
    'pres.addAfter': { ru: 'Вставить после', en: 'Insert after', bd: 'Һуңынан ҡыстыр' },
    'pres.dupSlide': { ru: 'Копия слайда', en: 'Duplicate slide', bd: 'Слайд күсермәһе' },
    'pres.gSlideText': { ru: 'Текст на слайде', en: 'Text on the slide', bd: 'Слайдтағы текст' },
    'pres.addBlock': { ru: 'Добавить блок текста', en: 'Add a text block', bd: 'Текст блогы өҫтә' },
    'pres.addBlockHelp': { ru: 'Двойной клик по пустому месту слайда тоже создаёт блок. За верхнюю полоску блока его можно таскать мышкой, за уголок — менять размер.', en: 'A double click on an empty spot of the slide also creates a block. Drag a block by its top strip, and resize it by its corner.', bd: 'Слайдтың буш урынына ике баҫыу ҙа блок яһай. Блокты өҫкө һыҙатынан һөйрәп күсереп була, мӧйәшенән — ҙурлығын үҙгәртергә.' },
    'pres.gShow': { ru: 'Показ', en: 'Show', bd: 'Кӧрһәт' },
    'pres.showSlides': { ru: 'Показать слайды', en: 'Show the slides', bd: 'Слайдтарҙы кӧрһәт' },
    'pres.showHelp': { ru: 'Во время показа: ← → или пробел — вперёд, ESC — выход.', en: 'During the show: ← → or space — forward, ESC — exit.', bd: 'Кӧрһәтеү ваҡытында: ← → йа пробел — алға, ESC — сығыу.' },
    'pres.gSlideBg': { ru: 'Фон слайда', en: 'Slide background', bd: 'Слайд фоны' },
    'pres.slideNum': { ru: 'номер слайда', en: 'slide number', bd: 'слайд һаны' },
    'pres.stamp': { ru: 'штамп «Монолит»', en: '“Monolit” stamp', bd: '«Монолит» штампы' },
    'pres.gSlideFont': { ru: 'Шрифт слайда', en: 'Slide font', bd: 'Слайд йазуы' },
    'pres.slideSizeAria': { ru: 'кегль слайда', en: 'slide size', bd: 'слайд ҙурлығы' },
    'pres.gTrans': { ru: 'Переход', en: 'Transition', bd: 'Күсеш' },
    'pres.tr.none': { ru: 'просто так', en: 'plain', bd: 'ябай ғына' },
    'pres.tr.fade': { ru: 'плавное появление', en: 'fade in', bd: 'йомшаҡ күренеү' },
    'pres.tr.blinds': { ru: 'жалюззи', en: 'blinds', bd: 'жалюз' },
    'pres.tr.slide': { ru: 'вылет слева', en: 'fly in from the left', bd: 'һулдан осоп сығыу' },
    'pres.tr.zoom': { ru: 'выпрыгнуть', en: 'zoom in', bd: 'һикереп сығыу' },
    'pres.tr.blinkit': { ru: 'мигание', en: 'blink', bd: 'ялтырау' },
    'pres.gNotes': { ru: 'Заметки докладчика', en: 'Speaker notes', bd: 'Доклад яҙмалары' },
    'pres.notesPh': { ru: 'что сказать на этом слайде — видно в показе по кнопке ЗАМЕТКИ (N)', en: 'what to say on this slide — shown in the show via the NOTES (N) button', bd: 'был слайдта нимә әйтергә — кӧрһәтеүҙә ЯҘМАЛАР (N) кнопкаһы аша күренә' },
    'pres.fitWin': { ru: 'По ширине окна', en: 'Fit to window width', bd: 'Тәҙрә киңлегенә' },
    'pres.fitHelp': { ru: 'Слайд всегда вписывается в окно: ', en: 'The slide always fits the window: ', bd: 'Слайд һәр ваҡыт тәҙрәгә һыя: ' },
    'pres.gHelpers': { ru: 'Помощники', en: 'Helpers', bd: 'Ярҙамсылар' },
    'pres.gridOn': { ru: 'сетка на слайде', en: 'grid on the slide', bd: 'слайдта тор' },
    'pres.beep': { ru: 'пищать при клике', en: 'beep on click', bd: 'баҫҡанда сиртлә' },
    'pres.gHint': { ru: 'Подсказка', en: 'Hint', bd: 'Кәңәш' },
    'pres.hint1': { ru: 'клик по тексту — печатать прямо в блоке;', en: 'click the text — type right in the block;', bd: 'текстҡа баҫ — тура блокта яҙ;' },
    'pres.hint2': { ru: 'верхняя полоска блока — его можно перетащить;', en: 'the block’s top strip — drag it to move;', bd: 'блоктың өҫкө һыҙаты — һөйрәп күсерергә;' },
    'pres.hint3': { ru: 'правый нижний уголок блока — размер;', en: 'the block’s bottom-right corner — size;', bd: 'блоктың түбәнге уң мӧйәше — ҙурлыҡ;' },
    'pres.hint4': { ru: 'двойной клик по пустому месту — новый блок;', en: 'double click on an empty spot — a new block;', bd: 'буш урынға ике баҫыу — яңы блок;' },
    'pres.hint5': { ru: 'Tab — новый блок, Delete — убрать блок или слайд;', en: 'Tab — a new block, Delete — remove a block or slide;', bd: 'Tab — яңы блок, Delete — блок йа слайдты алып ташла;' },
    'pres.hint6': { ru: 'стрелки — сдвинуть выбранный блок (Shift — мельче, Ctrl — крупнее);', en: 'arrows — move the selected block (Shift — smaller, Ctrl — larger);', bd: 'уҡтар — һайланған блокты күсер (Shift — вағыраҡ, Ctrl — ҙурыраҡ);' },
    'pres.hint7': { ru: 'Ctrl+Z — отменить, Ctrl+N — слайд, Ctrl+S — сохранить, Ctrl+P — показ.', en: 'Ctrl+Z — undo, Ctrl+N — slide, Ctrl+S — save, Ctrl+P — show.', bd: 'Ctrl+Z — кире ҡайтар, Ctrl+N — слайд, Ctrl+S — сакъла, Ctrl+P — кӧрһәт.' },
    'pres.gOffice': { ru: 'Монолит Офис', en: 'Monolit Office', bd: 'Монолит Офис' },
    'pres.aboutOffice': { ru: 'Презентации · Документы · Таблицы — три программы в одном стиле. Кнопка «Офис» вверху переключает между ними.', en: 'Presentations · Documents · Tables — three programs in one style. The “Office” button at the top switches between them.', bd: 'Слайдлар · Документләр · Ҷадваллар — бер стилдәге өс программа. Өҫтәге «Офис» кнопкаһы улар араһында күсерә.' },
    'pres.gProject': { ru: 'О проекте', en: 'About the project', bd: 'Проект ҳаҡында' },
    'pres.progLabel': { ru: 'Программа:', en: 'Program:', bd: 'Программа:' },
    'pres.progV': { ru: 'Презентации Монолит, beta 0.4', en: 'Monolit Presentations, beta 0.4', bd: 'Монолит Слайдлар, beta 0.4' },
    'pres.devLabel': { ru: 'Разработчик проекта:', en: 'Project developer:', bd: 'Проект эшләүсе:' },
    'pres.devV': { ru: 'корпорация Монолит', en: 'the Monolit corporation', bd: 'Монолит корпорацияһы' },
    'pres.formatsLabel': { ru: 'Форматы:', en: 'Formats:', bd: 'Форматтар:' },
    'pres.crNote': { ru: '<b>Проект создан корпорацией Монолит.</b> Презентации Монолит — собственная разработка корпорации Монолит. Настоящий PowerPoint мы не покупали и не используем. <br>© Корпорация Монолит. Все права защищены.', en: '<b>The project was created by the Monolit corporation.</b> Monolit Presentations is an original development of the Monolit corporation. We did not buy and do not use the real PowerPoint. <br>© Monolit Corporation. All rights reserved.', bd: '<b>Проект Монолит корпорацияһы тарафынан эшләнгән.</b> Монолит Слайдлар — Монолит корпорацияһының үҙ эшләнмәһе. Ысын PowerPoint-ты беҙ һатып алманыҡ ва ҡулланмайбыҙ. <br>© Монолит Корпорацияһы. Бөтә хоҡуҡтар һаҡланған.' },
    'pres.gGuest': { ru: 'Гостевая книга', en: 'Guest book', bd: 'Ҡунаҡ китабы' },
    'pres.gNamePh': { ru: 'ник', en: 'nickname', bd: 'ник' },
    'pres.gTextPh': { ru: 'что думаешь о программе', en: 'what you think of the program', bd: 'программа ҳаҡында нимә уйлайһың' },
    'pres.sign': { ru: 'Расписаться', en: 'Sign', bd: 'Ҡул ҡуй' },
    'pres.spTitle': { ru: 'СЛАЙДЫ', en: 'SLIDES', bd: 'СЛАЙДТАР' },
    'pres.empty': { ru: 'слайдов нет.<br>жми «Создать слайд».', en: 'no slides.<br>press “New slide”.', bd: 'слайдтар юҡ.<br>«Слайд йаса» төймәһенә бас.' },
    'pres.showBtn': { ru: 'Показ', en: 'Show', bd: 'Кӧрһәт' },
    'pres.ctorNone': { ru: 'слайд не выбран', en: 'no slide selected', bd: 'слайд һайланмаған' },
    'pres.editNote': { ru: '(создай слайд и пиши прямо на нём)', en: '(create a slide and type right on it)', bd: '(слайд йаса ва тура унда яҙ)' },
    'pres.credit': { ru: 'Презентации Монолит — проект <b>корпорации Монолит</b> · © Корпорация Монолит, все права защищены', en: 'Monolit Presentations — a project of the <b>Monolit corporation</b> · © Monolit Corporation, all rights reserved', bd: 'Монолит Слайдлар — <b>Монолит корпорацияһы</b> проекты · © Монолит Корпорацияһы, бөтә хоҡуҡтар һаҡланған' },
    'pres.slideWord': { ru: 'слайд', en: 'slide', bd: 'слайд' },
    'pres.of': { ru: 'из', en: 'of', bd: 'бына' },
    'pres.pPrev': { ru: '◀ назад', en: '◀ back', bd: '◀ артҡа' },
    'pres.pNext': { ru: 'вперёд ▶', en: 'forward ▶', bd: 'алға ▶' },
    'pres.pNotes': { ru: 'ЗАМЕТКИ', en: 'NOTES', bd: 'ЯҘМАЛАР' },
    'pres.pBlack': { ru: 'ЧЁРНЫЙ (B)', en: 'BLACK (B)', bd: 'ҠАРА (B)' },
    'pres.pExit': { ru: 'ВЫЙТИ (ESC)', en: 'EXIT (ESC)', bd: 'СЫҒЫУ (ESC)' },
    'pres.showKeys': { ru: 'стрелки ← →, пробел, Home/End, F1 — справка', en: 'arrows ← →, space, Home/End, F1 — help', bd: 'уҡтар ← →, пробел, Home/End, F1 — ярҙам' },
    'pres.helpTitle': { ru: 'Управление показом', en: 'Show controls', bd: 'Кӧрһәтеү идараһы' },
    'pres.helpBody': { ru: '<div>← / → / Пробел / Enter — вперёд/назад</div><div>Home / End — первый/последний слайд</div><div>B — чёрный экран (вкл/выкл)</div><div>F1 — показать/скрыть эту справку</div><div>ESC — выйти из показа</div>', en: '<div>← / → / Space / Enter — forward/back</div><div>Home / End — first/last slide</div><div>B — black screen (on/off)</div><div>F1 — show/hide this help</div><div>ESC — exit the show</div>', bd: '<div>← / → / Пробел / Enter — алға/артҡа</div><div>Home / End — беренсе/һуңғы слайд</div><div>B — ҡара экран (ҡабыҙ/һүндер)</div><div>F1 — был ярҙамды кӧрһәт/йәшер</div><div>ESC — кӧрһәтеүҙән сыҡ</div>' },
    'pres.helpClose': { ru: 'ЗАКРЫТЬ (ESC/F1)', en: 'CLOSE (ESC/F1)', bd: 'ЯП (ESC/F1)' },
    'pres.dropOv': { ru: 'ОТПУСТИ ФАЙЛ — ЧИТАЕМ', en: 'DROP THE FILE — WE WILL READ IT', bd: 'ФАЙЛДЫ ЕБӘР — УҠЫЙБЫҘ' }
  };
  (function () { for (var k in DICT4) if (DICT4.hasOwnProperty(k)) DICT[k] = DICT4[k]; })();

  var DICT5 = {
    'msg.saved': { ru: 'сохранено: ', en: 'saved: ', bd: 'сакъланды: ' },
    'msg.opened': { ru: 'открыто: ', en: 'opened: ', bd: 'асылды: ' },
    'msg.imported': { ru: 'импортировано абзацев: ', en: 'paragraphs imported: ', bd: 'абзацтар импортланды: ' },
    'msg.replaceDoc': { ru: 'Текущий документ будет заменён примером. Продолжить?', en: 'The current document will be replaced with the sample. Continue?', bd: 'Хәҙерге документ өлгө менән алмаштырыласаҡ. Дауам итәбеҙме?' },
    'msg.lowMode': { ru: 'жалкий режим: ничего не меняли', en: 'wimpy mode: nothing was changed', bd: 'меҫкен режим: бер нәмә лә үҙгәртелмәне' },
    'msg.tplLoaded': { ru: 'загружен пример. смотри и правь.', en: 'the sample is loaded. look and edit.', bd: 'өлгө йӧкләнде. ҡара ва тӧҙәт.' }
  };
  (function () { for (var k in DICT5) if (DICT5.hasOwnProperty(k)) DICT[k] = DICT5[k]; })();

  var DICT6 = {
    'ui.settings': { ru: 'Настройки', en: 'Settings', bd: 'Көйләүҙәр' },
    'ui.langTitle': { ru: 'Язык интерфейса', en: 'Interface language', bd: 'Интерфейс теле' },
    'ui.langLead': { ru: 'Выберите язык — интерфейс переключится сразу. Выбор сохранится.', en: 'Choose a language — the interface switches at once. Your choice is remembered.', bd: 'Телде һайла — интерфейс шунда уҡ күсә. Һайлау иҫтә ҡала.' }
  };
  (function () { for (var k in DICT6) if (DICT6.hasOwnProperty(k)) DICT[k] = DICT6[k]; })();

  var cur = 'ru';
  var listeners = [];
  var modal = null;

  function has(k) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].key === k) return true;
    return false;
  }
  function stored() { try { return localStorage.getItem(LS); } catch (e) { return null; } }
  function store(k) { try { localStorage.setItem(LS, k); } catch (e) { } }

  function t(key, vars) {
    var row = DICT[key], s;
    if (row) s = (row[cur] != null ? row[cur] : row.ru);
    if (s == null) s = key;
    if (vars) s = String(s).replace(/\{(\w+)\}/g, function (m, p) { return vars[p] != null ? vars[p] : m; });
    return s;
  }

  function apply(root) {
    root = root || document;
    var i, el, list;
    list = root.querySelectorAll('[data-i18n]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.textContent = t(el.getAttribute('data-i18n')); }
    list = root.querySelectorAll('[data-i18n-html]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.innerHTML = t(el.getAttribute('data-i18n-html')); }
    list = root.querySelectorAll('[data-i18n-ph]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); }
    list = root.querySelectorAll('[data-i18n-title]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); }
    list = root.querySelectorAll('[data-i18n-aria]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); }
  }

  function destroyPicker() { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); modal = null; }
  function closePicker() {
    if (!modal) return;
    modal.className = 'mo-lang';
    setTimeout(destroyPicker, 180);
  }

  function picker() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'mo-lang';
    var box = document.createElement('div');
    box.className = 'mo-lang-box';
    var h = document.createElement('h2');
    h.textContent = t('lang.title');
    box.appendChild(h);
    var p = document.createElement('p');
    p.className = 'mo-lang-lead';
    p.textContent = t('lang.lead');
    box.appendChild(p);
    var list = document.createElement('div');
    list.className = 'mo-lang-list';
    for (var i = 0; i < LANGS.length; i++) {
      (function (L) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mo-lang-btn' + (L.key === cur ? ' cur' : '');
        b.setAttribute('data-lang', L.key);
        var n = document.createElement('b');
        n.textContent = L.name;
        b.appendChild(n);
        var s = document.createElement('span');
        s.textContent = L.sub;
        b.appendChild(s);
        b.onclick = function () { set(L.key); };
        list.appendChild(b);
      })(LANGS[i]);
    }
    box.appendChild(list);
    var foot = document.createElement('div');
    foot.className = 'mo-lang-free';
    foot.textContent = t('lang.free');
    box.appendChild(foot);
    modal.appendChild(box);
    document.body.appendChild(modal);
    setTimeout(function () { if (modal) modal.className = 'mo-lang show'; }, 20);
  }

  function nameOf(k) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].key === k) return LANGS[i].name;
    return k;
  }
  function shortOf(k) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].key === k) return LANGS[i].short || String(k).toUpperCase();
    return String(k).toUpperCase();
  }

  /* Компактный переключатель языка: кнопка с текущим языком и меню из трёх.
     Используется на сайте; в самих программах есть вкладка «Настройки». */
  function langSwitch(host) {
    if (!host) return;
    var box = document.createElement('div');
    box.className = 'mo-switch';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mo-switch-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    var globe = document.createElement('span');
    globe.className = 'mo-switch-globe';
    globe.textContent = '\uD83C\uDF10';
    var now = document.createElement('span');
    now.className = 'mo-switch-now';
    var caret = document.createElement('i');
    caret.className = 'mo-switch-caret';
    btn.appendChild(globe); btn.appendChild(now); btn.appendChild(caret);

    var menu = document.createElement('div');
    menu.className = 'mo-switch-menu';
    var items = [], i;
    for (i = 0; i < LANGS.length; i++) {
      (function (L) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mo-switch-item';
        b.setAttribute('data-lang', L.key);
        var n = document.createElement('b'); n.textContent = L.name;
        var s = document.createElement('span'); s.textContent = L.sub;
        b.appendChild(n); b.appendChild(s);
        b.onclick = function (ev) { if (ev) ev.stopPropagation(); set(L.key); close(); };
        items.push(b);
        menu.appendChild(b);
      })(LANGS[i]);
    }
    box.appendChild(btn);
    box.appendChild(menu);
    host.appendChild(box);

    function refresh() {
      now.textContent = shortOf(cur);
      btn.title = nameOf(cur);
      btn.setAttribute('aria-label', nameOf(cur));
      for (var j = 0; j < items.length; j++) {
        items[j].className = 'mo-switch-item' + (items[j].getAttribute('data-lang') === cur ? ' cur' : '');
      }
    }
    function close() { box.className = 'mo-switch'; btn.setAttribute('aria-expanded', 'false'); }
    btn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (box.className.indexOf('open') >= 0) close();
      else { box.className = 'mo-switch open'; btn.setAttribute('aria-expanded', 'true'); }
    };
    menu.onclick = function (ev) { ev.stopPropagation(); };
    document.addEventListener('click', function (ev) { if (!box.contains(ev.target)) close(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
    refresh();
    listeners.push(function () { refresh(); });
  }

  function set(k, silent) {
    if (!has(k)) k = 'ru';
    cur = k;
    store(k);
    document.documentElement.setAttribute('lang', k);
    apply(document);
    refreshDynamic();
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](k); } catch (e) { } }
    var ev;
    try { ev = new CustomEvent('mono:i18n', { detail: { lang: k } }); }
    catch (e) { ev = document.createEvent('Event'); ev.initEvent('mono:i18n', true, true); ev.detail = { lang: k }; }
    try { document.dispatchEvent(ev); } catch (e2) { }
    closePicker();
  }

  /* ==========================================================
     ДИНАМИЧЕСКИЙ ПЕРЕВОД.
     Строки, которые код редакторов вставляет уже после загрузки,
     переводятся по точному совпадению с русским оригиналом из
     словаря (плюс несколько шаблонов для сообщений с числами).
     Пользовательский контент (страница, сетка, слайд) не трогаем:
     такие корни помечаются data-no-i18n или contenteditable.
     ========================================================== */
  var RU2KEY = {};
  (function () {
    var k, r;
    for (k in DICT) {
      if (!DICT.hasOwnProperty(k)) continue;
      r = DICT[k] && DICT[k].ru;
      if (r != null && !RU2KEY.hasOwnProperty(r)) RU2KEY[r] = k;
    }
  })();

  var RU2KEY_HTML = {};
  (function () {
    var k, r;
    for (k in DICT) {
      if (!DICT.hasOwnProperty(k)) continue;
      r = DICT[k] && DICT[k].ru;
      if (r != null && /[<&]/.test(r) && !RU2KEY_HTML.hasOwnProperty(r)) RU2KEY_HTML[r] = k;
    }
  })();

  var PATTERNS = [
    { re: /^сохранено:\s*/, key: 'msg.saved' },
    { re: /^открыто:\s*/, key: 'msg.opened' },
    { re: /^импортировано абзацев:\s*/, key: 'msg.imported' }
  ];

  var recs = [];
  var busy = 0;

  function withBusy(fn) { busy++; try { fn(); } finally { busy--; } }

  function trRaw(s) {
    if (s == null) return s;
    var str = String(s);
    if (RU2KEY.hasOwnProperty(str)) return t(RU2KEY[str]);
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i].re.test(str)) return t(PATTERNS[i].key) + str.replace(PATTERNS[i].re, '');
    }
    return str;
  }

  function isEditable(node) {
    var p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (p.hasAttribute && p.hasAttribute('data-no-i18n')) return true;
      var ce = p.getAttribute && p.getAttribute('contenteditable');
      if (ce != null && ce !== 'false') return true;
      var tag = p.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return true;
      p = p.parentNode;
    }
    return false;
  }

  function remember(rec) {
    if (rec.type === 'text') {
      if (rec.node.__i18nT) return;
      rec.node.__i18nT = 1;
    } else if (rec.type === 'html') {
      if (rec.el.__i18nH) return;
      rec.el.__i18nH = 1;
    } else {
      rec.el.__i18nA = rec.el.__i18nA || {};
      if (rec.el.__i18nA[rec.attr]) return;
      rec.el.__i18nA[rec.attr] = 1;
    }
    recs.push(rec);
  }

  function translateNode(node) {
    if (!node || node.nodeType !== 3) return;
    if (isEditable(node)) return;
    var v = node.nodeValue;
    if (!v) return;
    var m = v.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var core = m[2];
    if (!core) return;
    var out = RU2KEY.hasOwnProperty(core) ? t(RU2KEY[core]) : trRaw(core);
    if (out == null || out === core) return;
    withBusy(function () { node.nodeValue = m[1] + out + m[3]; });
    remember({ type: 'text', node: node, ru: core, lead: m[1], trail: m[3] });
  }

  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  function translateAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var v = el.getAttribute ? el.getAttribute(a) : null;
      if (!v) continue;
      if (!RU2KEY.hasOwnProperty(v)) continue;
      var out = t(RU2KEY[v]);
      if (out == null || out === v) continue;
      withBusy(function (el2, a2, out2) { return function () { el2.setAttribute(a2, out2); }; }(el, a, out));
      remember({ type: 'attr', el: el, attr: a, ru: v });
    }
  }

  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) { translateNode(node); return; }
    if (node.nodeType !== 1) return;
    if (node.hasAttribute && node.hasAttribute('data-no-i18n')) return;
    var tag = node.nodeName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
    var ce = node.getAttribute ? node.getAttribute('contenteditable') : null;
    if (ce != null && ce !== 'false') return;
    translateAttrs(node);
    var ih = node.innerHTML;
    if (ih != null) {
      var hcore = ih.replace(/^\s+|\s+$/g, '');
      if (RU2KEY_HTML.hasOwnProperty(hcore)) {
        var hout = t(RU2KEY_HTML[hcore]);
        if (hout && hout !== ih) {
          (function (el, val) { withBusy(function () { el.innerHTML = val; }); })(node, hout);
          remember({ type: 'html', el: node, ru: ih });
        }
        return;
      }
    }
    var c = node.firstChild;
    while (c) { var nx = c.nextSibling; walk(c); c = nx; }
  }

  function refreshDynamic() {
    if (!document.body) return;
    withBusy(function () {
      var i, r;
      for (i = 0; i < recs.length; i++) {
        r = recs[i];
        if (r.type === 'text') {
          if (r.node && r.node.nodeValue != null) r.node.nodeValue = r.lead + r.ru + r.trail;
          if (r.node) r.node.__i18nT = 0;
        } else if (r.type === 'html') {
          if (r.el) r.el.innerHTML = r.ru;
          if (r.el) r.el.__i18nH = 0;
        } else {
          if (r.el && r.el.setAttribute) r.el.setAttribute(r.attr, r.ru);
          if (r.el && r.el.__i18nA) r.el.__i18nA[r.attr] = 0;
        }
      }
      recs = [];
      walk(document.body);
    });
  }

  var mo = null;
  function observe() {
    if (mo || !document.body || !('MutationObserver' in window)) return;
    mo = new MutationObserver(function (muts) {
      if (busy > 0) return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        } else if (m.type === 'characterData') {
          translateNode(m.target);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  var dialogsWrapped = false;
  function wrapDialogs() {
    if (dialogsWrapped) return;
    dialogsWrapped = true;
    var a = window.alert, c = window.confirm, p = window.prompt;
    window.alert = function (m) { return a.call(window, trRaw(m == null ? m : String(m))); };
    window.confirm = function (m) { return c.call(window, trRaw(m == null ? m : String(m))); };
    window.prompt = function (m, d) { return p.call(window, trRaw(m == null ? m : String(m)), d); };
  }

  function initRuntime() {
    wrapDialogs();
    if (document.body) walk(document.body);
    observe();
  }

  window.MonolitI18n = {
    t: t,
    get: function () { return cur; },
    set: set,
    apply: apply,
    tr: trRaw,
    dynamic: refreshDynamic,
    langs: function () { return LANGS.slice(); },
    picker: picker,
    switchLang: langSwitch,
    on: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    hasStored: function () { return !!stored(); }
  };
  /* короткий псевдоним для кода редакторов */
  window.t = t;

  function boot() {
    var s = stored();
    if (has(s)) cur = s;
    document.documentElement.setAttribute('lang', cur);
    apply(document);
    initRuntime();
    /* окно «Выбери язык» при первом заходе показываем не всегда:
       на сайте по умолчанию русский, а язык меняется кнопкой
       (см. window.MONOLIT_LANG_AUTO = 0). */
    if (!has(s) && window.MONOLIT_LANG_AUTO !== 0) picker();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
