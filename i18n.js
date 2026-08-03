/* Runtime RU → EN translation for the whole site.

   Russian stays the master copy: every page, every script and every data file is authored
   in Russian, and this layer rewrites the live DOM when English is on. That way new markup
   never has to be duplicated — it only needs an entry in DICT below.

   How a string is translated:
     1. exact match on the trimmed text node (the reliable path, used for whole sentences)
     2. otherwise a single-pass, longest-key-first substring replacement
     3. then generic rules: guillemets, units (см/м/га) and thousands separators
   Anything with no match is left in Russian — visible, so it is easy to spot and add here.

   Loaded last on every page so the cart drawer, the product modal and the generated catalog
   cards already exist; anything injected later is picked up by a MutationObserver.  */
(function () {
  const KEY = 'alleya.lang';

  /* ---------- Dictionary ---------- */
  const DICT = {
    /* — page titles — */
    'Аллея — питомник аллейно-парковых деревьев, Ростов-на-Дону': 'Alleya — avenue and park tree nursery, Rostov-on-Don',
    'Каталог — Аллея, питомник деревьев и кустарников, Ростов-на-Дону': 'Catalogue — Alleya, tree and shrub nursery, Rostov-on-Don',
    'Оформление заказа — Аллея, питомник деревьев и кустарников': 'Checkout — Alleya, tree and shrub nursery',

    /* — chrome — */
    'Аллея': 'Alleya',
    'Каталог': 'Catalogue',
    'О нас': 'About',
    'Партнёры': 'Partners',
    'Контакты': 'Contacts',
    'Навигация': 'Navigation',
    'Питомник': 'Nursery',
    'Ростов-на-Дону': 'Rostov-on-Don',
    'По договорённости, Пн–Сб': 'By appointment, Mon–Sat',
    '© 2026 Аллея. Все права защищены.': '© 2026 Alleya. All rights reserved.',
    '2026 Аллея. Все права защищены.': '2026 Alleya. All rights reserved.',
    'Язык сайта': 'Site language',
    'Закрыть': 'Close',
    'Скролл': 'Scroll',

    /* — hero / about — */
    'Питомник Аллея — Ростов-на-Дону': 'Alleya Nursery — Rostov-on-Don',
    'Выращено': 'Grown',
    'на века': 'for centuries',
    'Питомник аллейно-парковых деревьев и кустарников. Растения собственного выращивания и из Европы — для парков, аллей и частных садов.': 'A nursery of avenue and park trees and shrubs. Plants of our own production and from Europe — for parks, avenues and private gardens.',
    'Каталог растений': 'Plant catalogue',
    'О питомнике': 'About the nursery',
    'Мы специализируемся на выращивании аллейно-парковых деревьев и кустарников.': 'We specialise in growing avenue and park trees and shrubs.',
    'В ассортименте питомника представлен посадочный материал не только нашего собственного производства, но также и растения европейского происхождения, например, из Голландии и Италии. Опираясь на компетенции высококвалифицированных специалистов зелёной отрасли и внедряя европейские технологии выращивания, мы рады предлагать вам растения, которые соответствуют высшим стандартам качества.': 'Our range includes planting stock not only of our own production, but also plants of European origin, for example from the Netherlands and Italy. Drawing on the expertise of highly qualified specialists in the green industry and applying European growing technologies, we are glad to offer you plants that meet the highest standards of quality.',
    'Смотреть каталог →': 'View catalogue →',

    /* — stats — */
    'Питомник в цифрах': 'The nursery in numbers',
    'Площадь питомника': 'Nursery area',
    'Растений в ассортименте': 'Plants in the range',
    'Компаний-партнёров': 'Partner companies',
    'га': 'ha',

    /* — catalog (landing + full page) — */
    'Деревья и кустарники для вашего проекта': 'Trees and shrubs for your project',
    'Открыть полный каталог': 'Open the full catalogue',
    'Тип корневой системы': 'Root system type',
    'Корневая система': 'Root system',
    'Грунтовые': 'Field-grown',
    'Контейнерные': 'Container-grown',
    'Полный каталог': 'Full catalogue',
    'деревьев и кустарников': 'of trees and shrubs',
    'Аллейно-парковые деревья и кустарники собственного выращивания и из Европы, для парков, аллей и частных садов.': 'Avenue and park trees and shrubs of our own growing and from Europe, for parks, avenues and private gardens.',
    'Фильтры': 'Filters',
    'Тип': 'Type',
    'Цена': 'Price',
    'Аллейное': 'Avenue',
    'Парковое': 'Park',
    'Плодовое': 'Fruit',
    'Декоративное': 'Ornamental',
    'Аллейные': 'Avenue',
    'Парковые': 'Park',
    'Плодовые': 'Fruit',
    'Декоративные': 'Ornamental',
    'Лиственное дерево': 'Deciduous tree',
    'Лиственные деревья': 'Deciduous trees',
    'Живая изгородь': 'Hedge',
    'Минимальная цена': 'Minimum price',
    'Максимальная цена': 'Maximum price',
    'До 10 000 ₽': 'Under 10,000 ₽',
    'От 25 000 ₽': 'From 25,000 ₽',
    'Высота саженца': 'Sapling height',
    'До 2 м': 'Up to 2 m',
    'Выше 4 м': 'Over 4 m',
    'Обхват ствола': 'Trunk girth',
    'До 8 см': 'Up to 8 cm',
    'От 12 см': 'From 12 cm',
    'Сбросить фильтры': 'Reset filters',
    'Гибкие скидки: 5% от 100 000 ₽ · 10% от 300 000 ₽ · 15% от 500 000 ₽': 'Volume discounts: 5% from 100,000 ₽ · 10% from 300,000 ₽ · 15% from 500,000 ₽',
    'Сортировка': 'Sort by',
    'Сначала популярные': 'Most popular first',
    'Сначала дешевле': 'Price: low to high',
    'Сначала дороже': 'Price: high to low',
    'По названию (А–Я)': 'Name (A–Z)',
    'из': 'of',
    'видов': 'species',
    'По выбранным фильтрам ничего не найдено. Попробуйте сбросить фильтры.': 'Nothing matches these filters. Try resetting them.',
    'На главную': 'Back to the home page',
    'Хит продаж': 'Bestseller',
    'Фото скоро': 'Photo coming soon',
    'от': 'from',

    /* — product configurator — */
    'Сорт': 'Variety',
    'Размер · высота и обхват ствола': 'Size · height and trunk girth',
    'размер уточняется': 'size on request',
    'В корзину': 'Add to cart',
    'Добавлено ✓': 'Added ✓',
    'В наличии': 'In stock',
    'Доставка, обмен и возврат': 'Delivery, exchange and returns',
    'Убрать один': 'Remove one',
    'Добавить один': 'Add one',
    'Крупномерное лиственное дерево в контейнере (ЗКС). Закрытая корневая система даёт высокую приживаемость и позволяет высаживать растение практически в любой сезон.': 'A large deciduous tree grown in a container. The closed root system gives a high survival rate and allows planting in almost any season.',
    'Растение для быстрорастущей живой изгороди, поставляется в контейнере (ЗКС). Готовый модуль для плотной зелёной стены, хорошо переносит стрижку.': 'A plant for a fast-growing hedge, supplied in a container. A ready module for a dense green wall that takes trimming well.',

    /* — species descriptions (products.js) — */
    'Клён широко распространён в Европе, Азии и Северной Америке. Большинство видов это деревья высотой от 10 до 40 метров, реже кустарники с множеством веток у основания ствола. В озеленении клён ценят за плотную крону и яркую осеннюю листву, которая долго держится и хорошо смотрится в аллеях и на открытых площадках.': 'The maple is widespread across Europe, Asia and North America. Most species are trees 10 to 40 metres tall, less often shrubs with many branches at the base of the trunk. In landscaping the maple is valued for its dense crown and vivid autumn foliage, which holds for a long time and looks its best along avenues and in open spaces.',
    'Берёза это листопадное дерево семейства Берёзовые. Она широко распространена в Северном полушарии, а в России остаётся одной из самых узнаваемых древесных пород. Светлый ствол и лёгкая ажурная крона делают берёзу удачным выбором для парков и просторных участков.': 'The birch is a deciduous tree of the birch family. It is widespread across the Northern Hemisphere and remains one of the most recognisable trees in Russia. Its pale trunk and light, airy crown make the birch a fine choice for parks and spacious grounds.',
    'Яблоня это листопадное дерево семейства Розовые. Декоративные формы ценят за обильное весеннее цветение и мелкие яркие плоды, которые держатся до зимы, а плодовые дают полноценный урожай. Родом из зон умеренного климата Северного полушария.': 'The apple tree is a deciduous tree of the rose family. Ornamental forms are prized for their abundant spring blossom and small bright fruit that hangs on into winter, while fruiting forms give a full harvest. Native to the temperate zones of the Northern Hemisphere.',
    'Боярышник это высокий листопадный кустарник или небольшое дерево семейства Розовые. Его часто высаживают как декоративное и лекарственное растение, а плоды пригодны в пищу. Хорошо переносит стрижку, поэтому подходит для плотных живых изгородей.': 'The hawthorn is a tall deciduous shrub or small tree of the rose family. It is often planted as an ornamental and medicinal plant, and its fruit is edible. It takes trimming well, which makes it a good choice for dense hedges.',
    'Вишня (сакура) это декоративное дерево семейства Розовые. Весной покрывается облаком розовых или белых цветов, ради которого её и сажают. Штамбовые формы аккуратно смотрятся в аллеях и парадных зонах, а осенью листва становится оранжево-красной.': 'The cherry (sakura) is an ornamental tree of the rose family. In spring it is covered by a cloud of pink or white blossom, which is why it is planted at all. Standard forms look neat along avenues and in formal areas, and in autumn the foliage turns orange-red.',
    'Вяз относится к семейству Ильмовые. Это крупное дерево с раскидистой густой кроной, которое растёт в умеренном поясе Европы, Северной Америки и Азии. Латинское название Ulmus идёт от кельтского имени этого дерева, elm. Благодаря плотной тени вяз хорошо подходит для аллей.': 'The elm belongs to the Ulmaceae family. It is a large tree with a spreading, dense crown that grows in the temperate belt of Europe, North America and Asia. Its Latin name, Ulmus, comes from the Celtic name for the tree, elm. Its deep shade makes the elm well suited to avenues.',
    'Груша иволистная это декоративное дерево с узкими серебристо-зелёными листьями и плотной округлой кроной. Весной покрывается белыми цветами. Хорошо переносит городские условия и красиво смотрится в аллеях и парадных зонах.': 'The willow-leaved pear is an ornamental tree with narrow silver-green leaves and a dense rounded crown. In spring it is covered in white blossom. It copes well with urban conditions and looks beautiful along avenues and in formal areas.',
    'Дуб черешчатый это мощное долговечное дерево с раскидистой кроной и плотной древесиной. Растёт неспешно, но живёт столетиями. Классический выбор для больших участков, парков и представительных аллей.': 'The English oak is a powerful, long-lived tree with a spreading crown and dense timber. It grows slowly but lives for centuries. A classic choice for large grounds, parks and stately avenues.',
    'Ива это древесное растение семейства Ивовые. В русском языке у неё много названий: ветла, ракита, лоза, верба, тальник. Очень распространена в средней полосе России, любит влагу и быстро растёт, поэтому её часто сажают возле воды.': 'The willow is a woody plant of the willow family. Russian has many names for it: vetla, rakita, loza, verba, talnik. Very common in central Russia, it loves moisture and grows fast, so it is often planted near water.',
    'Катальпа бигнониевидная выделяется крупными сердцевидными листьями и белыми соцветиями-свечами в начале лета. Даёт густую тень и выглядит выразительно даже в одиночной посадке. Любит солнце и защищённые от ветра места.': 'The Indian bean tree stands out for its large heart-shaped leaves and white candle-like flower clusters in early summer. It casts deep shade and looks striking even as a single specimen. It likes sun and spots sheltered from the wind.',
    'Каштан это крупное дерево с широкой кроной и характерными резными листьями. Весной украшен вертикальными соцветиями-свечами. Даёт плотную тень, поэтому его часто высаживают вдоль аллей и в парках.': 'The chestnut is a large tree with a broad crown and distinctive palmate leaves. In spring it is decorated with upright candle-like flower clusters. It casts deep shade, so it is often planted along avenues and in parks.',
    'Лавровишня это вечнозелёный кустарник с плотными глянцевыми листьями. Хорошо переносит стрижку и держит форму, поэтому её используют для живых изгородей и вечнозелёных акцентов в саду. Поставляется в контейнере.': 'The cherry laurel is an evergreen shrub with dense glossy leaves. It takes trimming well and holds its shape, so it is used for hedges and evergreen accents in the garden. Supplied in a container.',
    'Липа мелколистная это классическое аллейное дерево с густой кроной и медовым ароматом во время цветения. Хорошо переносит стрижку и городские условия, долго живёт и даёт плотную тень, поэтому её часто выбирают для аллей и бульваров.': 'The small-leaved linden is a classic avenue tree with a dense crown and a honey scent when in flower. It takes trimming and urban conditions well, lives long and casts deep shade, which is why it is so often chosen for avenues and boulevards.',
    'Рябина это красивое кудрявое деревце, которое зимой ярко выделяется среди снега алыми ягодами. Свежие ягоды горчат, но после первых заморозков горечь уходит, и они становятся любимым лакомством для птиц. За это рябину в народе прозвали птицеловом.': 'The rowan is a beautiful, feathery little tree that stands out against winter snow with its scarlet berries. Fresh berries are bitter, but after the first frosts the bitterness goes and they become a favourite treat for birds. That is why the rowan is nicknamed the birdcatcher.',
    'Слива это плодовое дерево семейства Розовые. Декоративные формы ценят за тёмную пурпурную листву, которая держит цвет весь сезон. Весной обильно цветёт, а летом даёт плоды.': 'The plum is a fruit tree of the rose family. Ornamental forms are prized for dark purple foliage that keeps its colour all season. It flowers abundantly in spring and bears fruit in summer.',
    'Тополь дрожащий, он же осина, быстро растёт и хорошо держит форму. Его часто используют для озеленения улиц и создания зелёных массивов. Листья подвижны даже при слабом ветре, за что дерево и получило своё название.': 'The trembling poplar, better known as the aspen, grows fast and holds its shape well. It is often used for street planting and for creating green masses. Its leaves move in the slightest breeze, which is how the tree got its name.',
    'Церцис, известный как багряник, ранней весной покрывается яркими розово-пурпурными цветами прямо на ветвях и стволе, ещё до появления листьев. Многоствольная форма выглядит особенно эффектно. Любит тепло и солнечные места.': 'The cercis, known as the redbud, is covered in early spring with vivid pink-purple flowers that appear straight on the branches and trunk, before the leaves. The multi-stem form is especially striking. It likes warmth and sunny spots.',

    /* — cart — */
    'Корзина': 'Cart',
    'Открыть корзину': 'Open cart',
    'Корзина пуста': 'Your cart is empty',
    'Выберите растения в каталоге — сорт и размер можно подобрать прямо в карточке.': 'Pick your plants in the catalogue — variety and size are chosen right on the card.',
    'В каталог': 'Go to catalogue',
    'Растения': 'Plants',
    'Итого': 'Total',
    'Скидка': 'Discount',
    'Скидка до 15%': 'Up to 15% off',
    'Ещё': 'Another',
    'до скидки': 'to a discount of',
    'Доставка и погрузка рассчитываются менеджером после оформления.': 'Delivery and loading are quoted by a manager after checkout.',
    'Оформить заказ': 'Place order',
    'Продолжить покупки': 'Continue shopping',
    'Удалить из корзины': 'Remove from cart',

    /* — checkout — */
    'Оформление заказа': 'Checkout',
    'Ваш заказ': 'Your order',
    'Доставка': 'Delivery',
    'Оплата': 'Payment',
    'Контактные данные': 'Contact details',
    'Имя и фамилия': 'Full name',
    'Иван Петров': 'Ivan Petrov',
    'Телефон': 'Phone',
    'Компания': 'Company',
    'необязательно': 'optional',
    'Ландшафтная студия': 'Landscape studio',
    'Укажите имя': 'Enter your name',
    'Укажите телефон': 'Enter your phone number',
    'Укажите корректный e-mail': 'Enter a valid e-mail',
    'Укажите город': 'Enter the city',
    'Укажите адрес': 'Enter the address',
    'Вернуться в каталог': 'Back to the catalogue',
    'Далее — доставка': 'Next — delivery',
    'Далее — оплата': 'Next — payment',
    'Назад': 'Back',
    'Способ получения': 'Collection method',
    'Самовывоз из питомника': 'Pick-up at the nursery',
    'Ростов-на-Дону, по договорённости, Пн–Сб': 'Rostov-on-Don, by appointment, Mon–Sat',
    'Доставка по адресу': 'Delivery to your address',
    'По европейской части России, с погрузкой': 'Across European Russia, loading included',
    'по расчёту': 'quoted separately',
    'По расчёту': 'Quoted separately',
    'Самовывоз': 'Pick-up',
    'Город': 'City',
    'Адрес доставки': 'Delivery address',
    'Улица, дом, ориентир': 'Street, building, landmark',
    'Желаемая дата': 'Preferred date',
    'Комментарий к заказу': 'Order comment',
    'Посадка, подбор аналогов, время приёмки': 'Planting, alternatives, delivery window',
    'Способ оплаты': 'Payment method',
    'Банковская карта': 'Bank card',
    'Оплата в один тап': 'Pay in one tap',
    'Счёт для юридического лица': 'Invoice for a company',
    'Оплата по реквизитам, с документами': 'Bank transfer with full documents',
    'Оплатить': 'Pay',
    'Приём онлайн-платежей ещё не подключён — это демонстрация оформления заказа.': 'Online payments are not connected yet — this is a checkout demonstration.',
    'Нажимая «Оплатить», вы соглашаетесь с условиями продажи и обработкой персональных данных.': 'By tapping “Pay” you agree to the terms of sale and to the processing of personal data.',
    'Изменить состав заказа': 'Edit the order',
    'Добавьте растения из каталога, и заказ можно будет оформить.': 'Add plants from the catalogue and you will be able to place an order.',

    /* — sales geography — */
    'Где растут наши деревья': 'Where our trees grow',
    'География продаж': 'Sales geography',
    'Поставляем посадочный материал заказчикам по всей европейской части России — от Москвы до Крыма.': 'We supply planting stock to customers across the European part of Russia — from Moscow to Crimea.',
    'Карта географии продаж — европейская часть России': 'Sales geography map — European Russia',
    'Рельефная основа: Wikimedia Commons · CC BY-SA 4.0': 'Relief base map: Wikimedia Commons · CC BY-SA 4.0',
    'Белгород': 'Belgorod',
    'Волгоград': 'Volgograd',
    'Воронеж': 'Voronezh',
    'Краснодар': 'Krasnodar',
    'Курск': 'Kursk',
    'Липецк': 'Lipetsk',
    'Москва': 'Moscow',
    'Нижний Новгород': 'Nizhny Novgorod',
    'Ростов-на-Дону': 'Rostov-on-Don',
    'Рязань': 'Ryazan',
    'Симферополь': 'Simferopol',
    'Ставрополь': 'Stavropol',
    'Тамбов': 'Tambov',
    'Тула': 'Tula',

    /* — partners — */
    'Мы работаем с лучшими в отрасли': 'We work with the best in the industry',
    'Проверенные специалисты': 'Trusted specialists',
    'Рекомендуем партнёров для проектирования, благоустройства и ухода за вашим садом.': 'We recommend partners for design, landscaping and care of your garden.',
    'Ландшафтная компания полного цикла': 'Full-cycle landscaping company',
    'Школа топиарной стрижки и уходу за растениями': 'School of topiary and plant care',
    'Теория и практика от ведущих мастеров зелёной отрасли: топиарная стрижка, дендрология, садоводство, проектирование и уходные работы.': 'Theory and practice from leading masters of the green industry: topiary, dendrology, horticulture, design and maintenance work.',
    'Современные сады с индивидуальным подходом к каждому заказчику. 8 лет в ландшафтном дизайне, образование — Академия архитектуры и искусств ЮФУ.': 'Contemporary gardens with an individual approach to every client. 8 years in landscape design, educated at the SFedU Academy of Architecture and Arts.',
    'Строительство и развитие садов и парков, частные ландшафтные и интерьерные проекты озеленения. 7 лет опыта.': 'Construction and development of gardens and parks, private landscape and interior planting projects. 7 years of experience.',
    'Частные сады и благоустройство придомовых территорий — от дизайн-проекта и визуализации до строительства и комплексного ухода. Основатели: Вера Стрелкова и Ольга Чеботарёва.': 'Private gardens and landscaping of residential grounds — from design concept and visualisation to construction and full maintenance. Founders: Vera Strelkova and Olga Chebotaryova.',
    'Руководитель «Ландшафтной мастерской Александра Толоконникова»': 'Head of the Alexander Tolokonnikov Landscape Studio',
    'Консультация — 3 000–5 000 ₽ · Предоплата 50%': 'Consultation — 3,000–5,000 ₽ · 50% prepayment',
    'Консультация — 5 000 ₽ · Проектирование — 10 000 ₽/сотка · Уход — 5 000 ₽/выход': 'Consultation — 5,000 ₽ · Design — 10,000 ₽ per 100 m² · Maintenance — 5,000 ₽ per visit',
    'Озеленение до 3 соток — от 10 000 ₽ · Проект сада — от 6 000 ₽/сотка': 'Planting up to 300 m² — from 10,000 ₽ · Garden design — from 6,000 ₽ per 100 m²',
    'Greenаura': 'Greenaura',
    'Ольга Еремеева': 'Olga Eremeeva',
    'Решетова Яна': 'Yana Reshetova',
    'Алексей Шляхов': 'Alexey Shlyakhov',
    'Ландшафтный архитектор': 'Landscape architect',
    'фото': 'photo',

    /* — testimonials & gallery — */
    'Питомник «Аллея» вживую': 'Alleya nursery in person',
    'Живые впечатления клиентов — прямо с YouTube.': 'Real impressions from our clients — straight from YouTube.',
    'Видео-отзыв о питомнике «Аллея»': 'Video review of the Alleya nursery',
    'Смотреть видео-отзыв о питомнике «Аллея»': 'Watch the video review of the Alleya nursery',
    'Что говорят о питомнике «Аллея»?': 'What people say about Alleya',
    'Что говорят о питомнике «Аллея»': 'What people say about Alleya',
    'Видео-отзывы': 'Video reviews',
    'Отзывы': 'Reviews',
    'Отзыв': 'Review',
    'Галерея': 'Gallery',
    'Оценка 5 из 5': 'Rated 5 out of 5',
    'Покупатель': 'Customer',
    'Предыдущие отзывы': 'Previous reviews',
    'Следующие отзывы': 'Next reviews',
    'Перетащите, чтобы вращать. Нажмите на снимок, чтобы рассмотреть.': 'Drag to rotate. Click a photo to take a closer look.',
    'Открыть изображение': 'Open image',
    'МИР': 'MIR',
    // testimonial avatar initials — kept in step with the transliterated names above
    'Ю': 'Y',
    'М': 'M',
    'А': 'A',
    'В': 'V',
    'П': 'P',
    'С': 'S',
    'Яндекс Карты': 'Yandex Maps',
    'Остролистный клён от «Аллеи» — почти 3,5 метра в высоту! Глаза разбегались, хотела вывезти оттуда всё. Проще участок перевезти к ним в питомник.': 'A Norway maple from Alleya — almost 3.5 metres tall! My eyes were everywhere, I wanted to take the whole place home. It would be easier to move my plot to their nursery.',
    'Всё отлично, общение и подбор грамотный. Брал клён остролистный «Royal Red».': 'Everything was great, the communication and the selection were spot on. I bought a Norway maple “Royal Red”.',
    'Огромное спасибо управляющей Насте и агроному Евгению за прогулку по «Аллее». Штамбы высокие, деревья полны здоровья и сил. Отличный настрой и потенциал!': 'Huge thanks to Nastya the manager and Evgeny the agronomist for the walk around Alleya. Tall standards, trees full of health and strength. Great spirit and potential!',
    'Есть выбор сакур, порадовали. Ребята молодцы!': 'A good choice of sakura, that made my day. Great team!',
    'Посадочный материал «Аллеи» поражает исключительными декоративными свойствами. Удобно, что есть доставка и советы по уходу. Покупка приятная и быстрая.': 'Alleya’s planting stock is striking in its decorative quality. Delivery and care advice are a real convenience. Buying was pleasant and quick.',
    'Спасибо, отличный материал. Был с детьми, поэтому не отбирал. Обязательно будем у вас!': 'Thank you, excellent stock. I came with the kids, so I did not pick anything out. We will definitely be back!',
    'Супер, ребята — мастера своего дела, хороший выбор! Удобное расположение.': 'Superb, these guys are masters of their craft, great selection! Convenient location.',
    'Хороший питомник — только там нашёл иву 4 метра. Упаковали, погрузили, всё отлично. Советую!': 'A good nursery — the only place where I found a 4-metre willow. They packed it, loaded it, all perfect. Recommended!',
    'Юлия': 'Yulia',
    'Мария Л.': 'Maria L.',
    'Александр': 'Alexander',
    'Варвара Березина': 'Varvara Berezina',
    'Артём': 'Artyom',
    'Сергей К.': 'Sergey K.',

    /* — CTA & lead popup — */
    'Ваша аллея': 'Your avenue',
    'начинается здесь.': 'starts here.',
    'Начать заказ': 'Start an order',
    'Приехать в питомник': 'Visit the nursery',
    'Только для профессионалов': 'For professionals only',
    'Особые условия для озеленителей и садоводов': 'Special terms for landscapers and gardeners',
    'для профессионалов зелёной отрасли. Оставьте почту — менеджер свяжется с вами, уточнит детали и подтвердит': 'for professionals in the green industry. Leave your email — a manager will get in touch, confirm the details and set up',
    'ваши особые условия': 'your special terms',
    'Ваш e-mail': 'Your e-mail',
    'Получить условия': 'Get the terms',
    'Нет, спасибо': 'No, thanks',
    'Мы не передаём вашу почту третьим лицам.': 'We never share your email with third parties.',
    'Спасибо! Мы свяжемся с вами.': 'Thank you! We will be in touch.',
    'Менеджер напишет на указанную почту, чтобы подтвердить условия для профессионалов зелёной отрасли.': 'A manager will write to the email you provided to confirm the terms for green-industry professionals.',
    'озеленители / садоводы': 'landscapers / gardeners',
    'Ландшафтный парк, озеленение от питомника Аллея': 'Landscape park planted by the Alleya nursery',
    'Ландшафтный парк, озеленение от питомника': 'Landscape park, planting by the nursery',

    /* — species — */
    'Берёза': 'Birch',
    'Боярышник': 'Hawthorn',
    'Вишня (сакура)': 'Cherry (sakura)',
    'Вишня': 'Cherry',
    'Вяз': 'Elm',
    'Груша': 'Pear',
    'Дуб красный': 'Red oak',
    'Дуб': 'Oak',
    'Дёрен белый': 'White dogwood',
    'Дёрен обыкновенный': 'Common dogwood',
    'Ива': 'Willow',
    'Катальпа': 'Catalpa',
    'Каштан': 'Chestnut',
    'Клён остролистный': 'Norway maple',
    'Клён серебристый': 'Silver maple',
    'Клён': 'Maple',
    'Лавровишня лекарственная': 'Cherry laurel',
    'Лавровишня': 'Cherry laurel',
    'Липа крупнолистная': 'Large-leaved linden',
    'Липа': 'Linden',
    'Рябина': 'Rowan',
    'Сакура мелкопильчатая': 'Japanese cherry',
    'Слива': 'Plum',
    'Спирея': 'Spiraea',
    'Тополь': 'Poplar',
    'Туя': 'Thuja',
    'Церцис': 'Cercis',
    'Яблоня': 'Apple tree',
    'Дёрен белый «Aurea»': 'White dogwood “Aurea”',
    'Туя «Brabant»': 'Thuja “Brabant”',
    'Канзан': 'Kanzan',

    /* — varieties (the Russian half of a cultivar name) — */
    'Базовый': 'Standard',
    'базовый': 'standard',
    'Белокитайская': 'Chinese white',
    'Бигнониевидная': 'Bignonioides',
    'Вавилонская': 'Babylon',
    'Декоративная': 'Ornamental',
    'Дрожащий': 'Aspen',
    'Золотистоволосистая': 'Golden-haired',
    'Иволистная': 'Willow-leaved',
    'Колхидский': 'Colchis',
    'Красный': 'Red',
    'Ломкая зонтик /шар': 'Brittle, umbrella / ball',
    'Махроцветковая': 'Double-flowered',
    'Мелколистная': 'Small-leaved',
    'Мелкопильчатая': 'Serrulata',
    'Остролистный': 'Norway',
    'Плодовая': 'Fruiting',
    'на шпалерах': 'espalier-trained',
    'Повислая': 'Weeping',
    'Серебристый': 'Silver',
    'Средний': 'Midland',
    'Татарский': 'Tatar',
    'Черешчатый': 'English',
    'Эрмана': 'Erman',
    'Арнольда': 'Arnold',
    'штамб': 'standard',
    'контейнер': 'container'
  };

  // Short words that would be dangerous inside longer sentences: matched only when they
  // are the entire text node (chips, table cells, the "N из M видов" counter).
  const EXACT_ONLY = new Set(['из', 'видов', 'Тип', 'Цена', 'га', 'Ю', 'М', 'А', 'В', 'П', 'С']);

  /* ---------- Matcher ---------- */
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const WORD = '0-9A-Za-zА-Яа-яЁё';
  const subKeys = Object.keys(DICT)
    .filter((k) => !EXACT_ONLY.has(k))
    .sort((a, b) => b.length - a.length);
  // No lookbehind: the leading boundary char is captured and put back.
  const RE = new RegExp('(^|[^' + WORD + '])(' + subKeys.map(esc).join('|') + ')(?![' + WORD + '])', 'g');

  // Generic rules, applied after the dictionary.
  function polish(s) {
    return s
      .replace(/«([^»]*)»/g, '“$1”')
      .replace(/до\s*(?=\d)/g, 'up to ') // size labels from the price list, e.g. "до150см"
      .replace(/(\d[\d.,–\-]*)\s*см(?![а-яё])/gi, (m, n) => n.replace(',', '.') + (/\s/.test(m) ? ' cm' : 'cm'))
      .replace(/(\d[\d.,–\-]*)\s*м(?![а-яё])/gi, (m, n) => n.replace(',', '.') + (/\s/.test(m) ? ' m' : 'm'))
      .replace(/(\d[\d.,–\-]*)\s*га(?![а-яё])/gi, '$1 ha')
      .replace(/\d{1,3}(?:[\s\u00A0\u202F]\d{3})+/g, (m) => m.replace(/[\s\u00A0\u202F]/g, ','));
  }

  function translate(text) {
    const trimmed = text.trim();
    if (!trimmed) return text;
    if (DICT[trimmed]) return text.replace(trimmed, polish(DICT[trimmed]));
    return polish(text.replace(RE, (m, before, key) => before + DICT[key]));
  }

  /* ---------- DOM application ---------- */
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE']);
  const ATTRS = ['alt', 'title', 'placeholder', 'aria-label'];

  const textRecords = new Map(); // Text node -> { ru, en }
  const attrRecords = new Map(); // Element -> { attr: { ru, en } }

  function eachText(root, fn) {
    if (root.nodeType === 3) return fn(root);
    if (root.nodeType !== 1) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement && SKIP_TAGS.has(n.parentElement.tagName.toUpperCase())
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
    });
    let n;
    while ((n = walker.nextNode())) fn(n);
  }

  function eachElement(root, fn) {
    if (root.nodeType !== 1) return;
    fn(root);
    root.querySelectorAll('*').forEach(fn);
  }

  function toEnglish(root) {
    eachText(root, (node) => {
      if (textRecords.has(node)) return;
      const ru = node.data;
      if (!/\S/.test(ru)) return;
      const en = translate(ru);
      if (en === ru) return;
      textRecords.set(node, { ru, en });
      node.data = en;
    });

    eachElement(root, (el) => {
      ATTRS.forEach((attr) => {
        const ru = el.getAttribute(attr);
        if (!ru || !/\S/.test(ru)) return;
        const rec = attrRecords.get(el);
        if (rec && rec[attr]) return;
        const en = translate(ru);
        if (en === ru) return;
        attrRecords.set(el, Object.assign(rec || {}, { [attr]: { ru, en } }));
        el.setAttribute(attr, en);
      });
    });
  }

  function toRussian() {
    textRecords.forEach((rec, node) => {
      if (node.isConnected && node.data === rec.en) node.data = rec.ru;
    });
    textRecords.clear();
    attrRecords.forEach((rec, el) => {
      Object.keys(rec).forEach((attr) => {
        if (el.getAttribute(attr) === rec[attr].en) el.setAttribute(attr, rec[attr].ru);
      });
    });
    attrRecords.clear();
  }

  /* ---------- Language state ---------- */
  let lang = 'ru';
  const titleRU = document.title;

  function setLang(next, persist) {
    if (next === lang) return;
    lang = next;
    if (lang === 'en') toEnglish(document.body);
    else toRussian();
    document.documentElement.lang = lang;
    document.title = lang === 'en' ? translate(titleRU) : titleRU;
    document.querySelectorAll('.lang-opt').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === lang));
    if (persist !== false) {
      try {
        localStorage.setItem(KEY, lang);
      } catch (e) {
        /* private mode — the choice just won't survive a reload */
      }
    }
    document.dispatchEvent(new CustomEvent('alleya:lang', { detail: { lang } }));
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-opt');
    if (btn) setLang(btn.dataset.lang);
  });

  // Content injected after load (catalog cards, the configurator, the cart drawer) is
  // translated as it appears; our own writes are ignored by comparing against what we wrote.
  new MutationObserver((records) => {
    if (lang !== 'en') return;
    records.forEach((r) => {
      if (r.type === 'childList') r.addedNodes.forEach((n) => toEnglish(n));
      else if (r.type === 'characterData') {
        const rec = textRecords.get(r.target);
        if (rec && r.target.data === rec.en) return; // our own write
        textRecords.delete(r.target);
        toEnglish(r.target);
      }
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (e) {
    /* ignore */
  }
  document.querySelectorAll('.lang-opt').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === 'ru'));
  if (saved === 'en') setLang('en', false);

  window.ALLEYA_I18N = { get lang() { return lang; }, setLang, translate };
})();
