const STORAGE_SETTINGS = "animego_ext_scraper_settings";
const PROFILE_CATEGORIES = [
    { categoryName: 'watching', text: "смотрю", color: '#d4edda' },
    { categoryName: 'completed', text: "просмотрено", color: '#d1ecf1' },
    { categoryName: 'onhold', text: "отложено", color: '#ebeef1' },
    { categoryName: 'dropped', text: "брошено", color: '#f8d7da' },
    { categoryName: 'planned', text: "запланировано", color: '#fff3cd' },
    { categoryName: 'rewatching', text: "пересматриваю", color: '#d1ecf1' }
];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let OBSERVER_MONITOR_ANIME_LIST_VIEW, LOADED_DATA
let SETTINGS = { scriptEnabled: true, hiddenCompleted: false };

const setStorage = (name, value) => chrome.storage.local.set({ [name]: value });
const getStorage = (name) => new Promise(resolve => chrome.storage.local.get([name], data => resolve(data[name])));

const addAnimeDataToStorage = (animeCategory, animeData) => setStorage(animeCategory, animeData);
const addLinkToAnimeDataInStorage = (animeCategory, link) => getStorage(animeCategory).then(animeData => {
    if (!animeData) return;
    animeData.links = [...new Set([...animeData.links, link])];
    setStorage(animeCategory, animeData);
});

const removeLinkFromStorage = (animeCategory, linkToRemove) => getStorage(animeCategory).then(animeData => {
    if (!animeData) return;
    animeData.links = animeData.links.filter(link => link !== linkToRemove);
    setStorage(animeCategory, animeData);
});

const generateUnifiedLinkData = (...categories) => {
    const unifiedData = { colors: {}, categories: {}, links: [] };
    const uniqueColors = new Set(), uniqueCategories = new Set();

    categories.forEach((categoryName, index) => {
        getStorage(categoryName).then(animeData => {
            if (animeData) {
                if (animeData.color && !uniqueColors.has(animeData.color)) {
                    uniqueColors.add(animeData.color);
                    unifiedData.colors[index] = animeData.color;
                }
                if (!uniqueCategories.has(categoryName)) {
                    uniqueCategories.add(categoryName);
                    unifiedData.categories[index] = categoryName;
                }
                animeData.links.forEach(link => unifiedData.links.push({
                    link, color: [...uniqueColors].indexOf(animeData.color), category: [...uniqueCategories].indexOf(categoryName)
                }));
            }
        });
    });
    return unifiedData;
};

const highlightWatchedAnime = () => {
    $(".animes-list-item.media").each((_, element) => {
        const animeLink = $(element).find("a").attr("href").replace("https://animego.org", "");
        const matchedLink = LOADED_DATA.links.find(linkObj => linkObj.link === animeLink);

        if (matchedLink) {
            const categoryName = LOADED_DATA.categories[matchedLink.category];
            if (SETTINGS.hiddenCompleted && (categoryName == 'completed' || categoryName == 'dropped')) {
                $(element).closest('[class^="col-"]').attr("hidden", true);
            } else {
                const colorIndex = matchedLink.color;
                $(element).css("background-color", LOADED_DATA.colors[colorIndex]);
            }
        }
    });
};

const monitorAnimeListChanges = () => {
    const observeTargetNode = () => {
        const targetNode = document.querySelector("#anime-list-container");
        if (!targetNode) return;
        if (OBSERVER_MONITOR_ANIME_LIST_VIEW) OBSERVER_MONITOR_ANIME_LIST_VIEW.disconnect();
        OBSERVER_MONITOR_ANIME_LIST_VIEW = new MutationObserver(() => highlightWatchedAnime());
        OBSERVER_MONITOR_ANIME_LIST_VIEW.observe(targetNode, { childList: true, subtree: true });
    };

    setInterval(() => {
        const targetNode = document.querySelector("#anime-list-container");
        if (targetNode && targetNode !== OBSERVER_MONITOR_ANIME_LIST_VIEW?.target) observeTargetNode();
    }, 1000);
};

const scanAnimeLinks = async (animeCategory, color) => {
    const username = $('a.nav-link.text-truncate[href="/profile/"]').text().trim();
    if (!username) return console.error("Имя пользователя не найдено.");
    
    const url = `https://animego.org/user/${username}/mylist/anime/${animeCategory}`;
    const $iframe = $('<iframe>', { src: url, css: { visibility: "hidden", position: "fixed", top: "-1000px", left: "-1000px" } }).appendTo("body");

    return new Promise((resolve, reject) => {
        $iframe.on("load", async () => {
            const iframeDocument = $iframe[0].contentDocument;
            const $tableBody = $(iframeDocument).find('tbody');
    
            const animeData = { categoryName: animeCategory, color: color, links: [] };
            if (!$tableBody.length) {
                addAnimeDataToStorage(animeCategory, animeData);
                $iframe.remove();
                reject(new Error("Таблица с аниме не найдена"));
                return;
            }

            let lastCount = 0;
            while (true) {
                $iframe[0].contentWindow.scrollTo(0, iframeDocument.body.scrollHeight);
                await delay(1500);
                const currentCount = $tableBody.find("tr").length;
                if (currentCount === lastCount) break;
                lastCount = currentCount;
            }

            $tableBody.find('a[href^="/anime/"]').each((_, link) => animeData.links.push($(link).attr("href")));
            animeData.links = [...new Set(animeData.links)];
            addAnimeDataToStorage(animeCategory, animeData);
            $iframe.remove();
            resolve(animeData);
        });
    });
};

const monitorAddToListButton = () => {
    const targetNode = document.querySelector('.my-list-anime');
    if (!targetNode) return;

    const observer = new MutationObserver(() => {
        const buttonText = $('.my-list .text-underline-hover').text().trim();
        const animeLink = window.location.pathname;

        console.log(`Change status: ${buttonText} > ${animeLink}`);

        PROFILE_CATEGORIES.forEach(item => removeLinkFromStorage(item.categoryName, animeLink));

        PROFILE_CATEGORIES.forEach((item) => {
            if (item.text === buttonText.toLowerCase()) {
                addLinkToAnimeDataInStorage(item.categoryName, animeLink);
                return;
            }
        });
    });

    observer.observe(targetNode, { childList: true, subtree: true });
};

const processCategories = async () => {
    for (const item of PROFILE_CATEGORIES) {
        const getData = await getStorage(item.categoryName);
        if (!getData) {
            console.log(`Список "${item.categoryName}" аниме отсутствует. Запуск сканера.`);
            try {
                await scanAnimeLinks(item.categoryName, item.color);
            } catch (error) {
                console.error(`Ошибка при обработке категории "${item.categoryName}":`, error);
            }
            await delay(500);
        } else {
            console.log(`Список аниме для категории "${item.categoryName}" уже сохранен.`);
        }
    }
};

getStorage(STORAGE_SETTINGS).then(getSettings => {
    if (getSettings) SETTINGS = getSettings;
}).finally(async () => {
    if (SETTINGS.scriptEnabled) {
        if (!window.location.pathname.startsWith('/user')) await processCategories();
        const categories = PROFILE_CATEGORIES.map(item => item.categoryName);
        LOADED_DATA = generateUnifiedLinkData(...categories);
        setTimeout(() => {
            if (window.location.pathname === '/anime' || window.location.pathname.startsWith('/anime/filter')) {
                highlightWatchedAnime();
                monitorAnimeListChanges();
            }
            monitorAddToListButton();
        }, 1000);
    } 
});