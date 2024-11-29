// ==UserScript==
// @name         AnimeGo Scraper - Color Indication of Viewed
// @namespace    https://github.com/Shark-vil/animego_scraper_color_indication
// @version      1.2.11
// @description  Скрипт для сайта AnimeGo.org, который помечает или скрывает в общем списке уже просмотренные аниме.
// @author       Shark_vil
// @icon         https://raw.githubusercontent.com/Shark-vil/animego_scraper_color_indication_of_viewed/refs/heads/master/icon.png
// @match        https://animego.org/*
// @grant        none
// @updateURL    https://github.com/Shark-vil/animego_scraper_color_indication_of_viewed/raw/refs/heads/master/script.user.js
// @downloadURL  https://github.com/Shark-vil/animego_scraper_color_indication_of_viewed/raw/refs/heads/master/script.user.js
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// ==/UserScript==

/* global $ */

(function () {
    'use strict';

    const STORAGE_SETTINGS = "animego_ext_scraper_settings";
    const PROFILE_CATEGORIES = [
        { category: 'watching', text: "смотрю", color: '#d4edda' },
        { category: 'completed', text: "просмотрено", color: '#d1ecf1' },
        { category: 'onhold', text: "отложено", color: '#ebeef1' },
        { category: 'dropped', text: "брошено", color: '#f8d7da' },
        { category: 'planned', text: "запланировано", color: '#fff3cd' },
        { category: 'rewatching', text: "пересматриваю", color: '#d1ecf1' }
    ];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let OBSERVER_MONITOR_ANIME_LIST_VIEW;
    let LOADED_DATA;
    let SETTINGS = {
        scriptEnabled: true,
        hiddenCompleted: false
    };

    // Сохраняет данные в локальное хранилище
    const setStorage = (name, value) => {
        localStorage.setItem(name, JSON.stringify(value));
    };

    // Извлекает данные из локального хранилища
    const getStorage = (name) => {
        const getValue = localStorage.getItem(name);
        return getValue ? JSON.parse(getValue) : undefined;
    };

    // Очищает локальное хранилище
    const clearStorage = () => {
        if (confirm("Вы уверены, что хотите очистить хранилище?")) {
            PROFILE_CATEGORIES.forEach(item => {
                localStorage.removeItem(item.category);
            });
            localStorage.removeItem('animego_ext_scraper_anime_list');
            alert("Хранилище очищено.");
        }
    };

    // Добавляет новые ссылки в список
    const addAnimeDataToStorage = (animeCategory, animeData) => {
        setStorage(animeCategory, animeData);
        console.log("Ссылки сохранены:", animeCategory);
    };

    const addLinkToAnimeDataInStorage = (animeCategory, link) => {
        const animeData = getStorage(animeCategory);
        if (!animeData) {
            console.error(`Данные для категории "${animeCategory}" отсутствуют или ссылки не найдены.`);
            return;
        }
        animeData.links = [...new Set([...animeData.links, link])];
        setStorage(animeCategory, animeData);
        console.log(`Ссылка ${link} добавлена в категорию:`, animeCategory);
    };
    
    // Удаляет ссылку из списка
    const removeLinkFromStorage = (animeCategory, linkToRemove) => {
        const animeData = getStorage(animeCategory);
        if (!animeData) {
            console.error(`Данные для категории "${animeCategory}" отсутствуют или ссылки не найдены.`);
            return;
        }
        animeData.links = animeData.links.filter(link => link !== linkToRemove);
        setStorage(animeCategory, animeData);
        console.log("Ссылки после удаления:", animeData);
    };

    // Генерирует общий объект ссылок, цветов и категорий на основе всех категорий
    const generateUnifiedLinkData = (...categories) => {
        const unifiedData = {
            colors: {},
            categories: {},
            links: []
        };
        const uniqueColors = new Set();
        const uniqueCategories = new Set();

        categories.forEach((category, index) => {
            const animeData = getStorage(category);

            // Добавляем уникальный цвет
            if (animeData.color && !uniqueColors.has(animeData.color)) {
                uniqueColors.add(animeData.color);
                unifiedData.colors[index] = animeData.color;
            }

            // Добавляем уникальную категорию
            if (!uniqueCategories.has(category)) {
                uniqueCategories.add(category);
                unifiedData.categories[index] = category;
            }

            // Добавляем ссылки
            animeData.links.forEach(link => {
                unifiedData.links.push({
                    link: link,
                    color: [...uniqueColors].indexOf(animeData.color),
                    category: [...uniqueCategories].indexOf(category)
                });
            });
        });

        console.log("Объединенный объект:", unifiedData);
        return unifiedData;
    };

    // Выделяет просмотренные аниме
    const highlightWatchedAnime = () => {
        if (!LOADED_DATA) {
            const categories = PROFILE_CATEGORIES.map(item => item.category);
            LOADED_DATA = generateUnifiedLinkData(...categories);
            console.log(LOADED_DATA);
        }
    
        $(".animes-list-item.media").each((_, element) => {
            const animeLink = $(element).find("a").attr("href").replace("https://animego.org", "");
            const matchedLink = LOADED_DATA.links.find(linkObj => linkObj.link === animeLink);
    
            if (matchedLink) {
                if (SETTINGS.hiddenCompleted) {
                    $(element).closest('[class^="col-"]').attr("hidden", true);
                } else {
                    const colorIndex = matchedLink.color;
                    const highlightColor = LOADED_DATA.colors[colorIndex];
                    $(element).css("background-color", highlightColor);
                }
            }
        });
    };
    

    // Следит за изменениями в списке аниме
    const monitorAnimeListChanges = () => {
        const observeTargetNode = () => {
            const targetNode = document.querySelector("#anime-list-container");
            if (!targetNode) {
                console.error("Контейнер аниме не найден.");
                return;
            }

            // Если уже есть активный наблюдатель, отключаем его
            if (OBSERVER_MONITOR_ANIME_LIST_VIEW) {
                OBSERVER_MONITOR_ANIME_LIST_VIEW.disconnect();
                console.log("Предыдущий наблюдатель отключен.");
            }

            // Создаем нового наблюдателя
            OBSERVER_MONITOR_ANIME_LIST_VIEW = new MutationObserver(() => highlightWatchedAnime());
            OBSERVER_MONITOR_ANIME_LIST_VIEW.observe(targetNode, { childList: true, subtree: true });
            console.log("Наблюдатель за изменениями запущен.");
        };

        // Проверяем узел с интервалом
        setInterval(() => {
            const targetNode = document.querySelector("#anime-list-container");
            if (!targetNode || targetNode !== OBSERVER_MONITOR_ANIME_LIST_VIEW?.target) {
                console.log("Перезапуск наблюдателя...");
                observeTargetNode();
            }
        }, 1000);
    };

    // Загружает список просмотренных аниме из профиля
    const scanAnimeLinks = async (animeCategory, color) => {
        const username = $('a.nav-link.text-truncate[href="/profile/"]').text().trim();
        if (!username) return console.error("Имя пользователя не найдено.");
        
        const url = `https://animego.org/user/${username}/mylist/anime/${animeCategory}`;
        console.log(`Загрузка списка аниме с ${url}`);
        
        const $iframe = $('<iframe>', { 
            src: url, 
            css: { visibility: "hidden", position: "fixed", top: "-1000px", left: "-1000px" } 
        }).appendTo("body");
        
        return new Promise((resolve, reject) => {
            $iframe.on("load", async () => {
                const iframeDocument = $iframe[0].contentDocument;
                const $tableBody = $(iframeDocument).find('tbody[data-loaded="true"]');
        
                const animeData = {
                    category: animeCategory,
                    color: color,
                    links: []
                };

                if (!$tableBody.length) {
                    addAnimeDataToStorage(animeCategory, animeData);
                    console.error("Таблица с аниме не найдена.");
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
        
                $tableBody.find('a[href^="/anime/"]').each((_, link) => {
                    animeData.links.push($(link).attr("href"));
                });
        
                animeData.links = [...new Set(animeData.links)];
                console.log("Собранные данные:", animeData);
                addAnimeDataToStorage(animeCategory, animeData);
        
                $iframe.remove();
                resolve(animeData);
            });
        });
    };
    

    // Следит за кнопкой добавления в список
    const monitorAddToListButton = () => {
        const targetNode = document.querySelector('.my-list-anime');
        if (!targetNode) return;

        const observer = new MutationObserver(() => {
            const buttonText = $('.my-list .text-underline-hover').text().trim();
            const animeLink = window.location.pathname;

            PROFILE_CATEGORIES.forEach(item => {
                removeLinkFromStorage(item.category, animeLink);
            });

            PROFILE_CATEGORIES.forEach((item) => {
                if (item.text === buttonText.toLowerCase()) {
                    addLinkToAnimeDataInStorage(item.category, animeLink);
                    return;
                }
            });            
        });

        observer.observe(targetNode, { childList: true, subtree: true });
    };

    // Инициализация меню
    const initMenu = () => {
        const menuHtml = `
            <div id="script-menu" class="dropdown-menu dropdown-menu-right" style="display: none; position: absolute;">
                <a href="#" id="agext-toggle-script" class="dropdown-item">${SETTINGS.scriptEnabled ? 'Выключить' : 'Включить'} скрипт</a>
                <a href="#" id="agext-toggle-hidden" class="dropdown-item">${SETTINGS.hiddenCompleted ? 'Не скрывать' : 'Скрывать'} просмотренное</a>
                <a href="#" id="clear-storage" class="dropdown-item">Очистить хранилище</a>
            </div>
        `;

        const iconHtml = `
            <span class="nav-link d-flex align-items-center" id="script-icon" style="cursor: pointer;">
                <svg class="icon icon-cogs"><use xlink:href="#icon-cogs"></use></svg>
            </span>
        `;

        // Добавляем иконку и меню
        $('a[href="/profile/"]').closest('li').after(iconHtml);
        $('body').append(menuHtml);

        // Показываем/скрываем меню по клику на иконку
        $('#script-icon').on('click', (e) => {
            e.preventDefault();
            const menu = $('#script-menu');
            menu.toggle();
            menu.css({ top: e.pageY + 10, left: e.pageX - 50 });
        });

        // Переключение скрипта
        const toggleScriptEl = $('#agext-toggle-script');
        toggleScriptEl.on('click', (e) => {
            e.preventDefault();
            SETTINGS.scriptEnabled = !SETTINGS.scriptEnabled;
            setStorage(STORAGE_SETTINGS, SETTINGS);
            toggleScriptEl.text(SETTINGS.scriptEnabled ? 'Выключить скрипт' : 'Включить скрипт');
            alert(`Скрипт ${SETTINGS.scriptEnabled ? 'включен' : 'выключен'}. Перезагрузите страницу.`);
        });

        const toggleHiddenEl = $('#agext-toggle-hidden');
        toggleHiddenEl.on('click', (e) => {
            e.preventDefault();
            SETTINGS.hiddenCompleted = !SETTINGS.hiddenCompleted;
            setStorage(STORAGE_SETTINGS, SETTINGS);
            toggleHiddenEl.text(SETTINGS.hiddenCompleted ? 'Не скрывать просмотренное' : 'Скрывать просмотренное');
            alert(`Просмотренные аниме ${SETTINGS.hiddenCompleted ? 'будут скрыты' : 'не будут скрыты'}.`);
        });

        // Очищение хранилища
        $('#clear-storage').on('click', (e) => {
            e.preventDefault();
            clearStorage();
        });
    };

    const processCategories = async () => {
        for (const item of PROFILE_CATEGORIES) {
            if (!getStorage(item.category)) {
                console.log(`Список "${item.category}" аниме отсутствует. Запуск сканера.`);
                try {
                    await scanAnimeLinks(item.category, item.color);
                } catch (error) {
                    console.error(`Ошибка при обработке категории "${item.category}":`, error);
                }
                await delay(2000);
            } else {
                console.log(`Список аниме для категории "${item.category}" уже сохранен.`);
            }
        }
    };

    const getSettings = getStorage(STORAGE_SETTINGS);
    if (getSettings) {
        SETTINGS = getSettings;
    }

    initMenu();

    if (SETTINGS.scriptEnabled) {
        // Инициализация
        if (!window.location.pathname.startsWith('/user')) {
            processCategories();
        }

        if (window.location.pathname === '/anime' || window.location.pathname.startsWith('/anime/filter')) {
            highlightWatchedAnime();
            monitorAnimeListChanges();
        }

        monitorAddToListButton();
    }
})();
