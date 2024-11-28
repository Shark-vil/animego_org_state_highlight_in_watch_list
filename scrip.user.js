// ==UserScript==
// @name         AnimeGo Scraper - Color Indication of Viewed
// @namespace    https://github.com/Shark-vil/animego_scraper_color_indication
// @version      1.0
// @description  Скрипл для сайта AnimeGo.org, который помечает или скрывает в общем списке уже просмотренные аниме.
// @author       Shark_vil
// @match        https://animego.org/*
// @grant        none
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// ==/UserScript==

/* global $ */

(function () {
    'use strict';

    const COOKIE_NAME = "animego_ext_scraper_anime_list";
    const COOKIE_SETTINGS = "animego_ext_scraper_settings";
    const HIGHLIGHT_COLOR = "#d1ecf1";
    let LOADDED_LINKS = [];
    let SETTINGS = {
        scriptEnabled: true,
        hiddenCompleted: false
    };

    // Сохраняет данные в локальное хранилище
    const setCookie = (name, value) => {
        localStorage.setItem(name, JSON.stringify(value));
    };

    // Извлекает данные из локального хранилища
    const getCookie = (name) => {
        const cookieValue = localStorage.getItem(name);
        return cookieValue ? JSON.parse(cookieValue) : [];
    };

    // Добавляет новые ссылки в список
    const addLinksToCookie = (links) => {
        const existingLinks = getCookie(COOKIE_NAME);
        const updatedLinks = [...new Set([...existingLinks, ...links])];
        setCookie(COOKIE_NAME, updatedLinks);
        console.log("Ссылки сохранены:", updatedLinks);
    };

    // Удаляет ссылку из списка
    const removeLinkFromCookie = (linkToRemove) => {
        const updatedLinks = getCookie(COOKIE_NAME).filter(link => link !== linkToRemove);
        setCookie(COOKIE_NAME, updatedLinks);
        console.log("Ссылки после удаления:", updatedLinks);
    };

    // Выделяет просмотренные аниме
    const highlightWatchedAnime = () => {
        if (!LOADDED_LINKS || !LOADDED_LINKS.length) {
            LOADDED_LINKS = getCookie(COOKIE_NAME);
        }
        $(".animes-list-item.media").each((_, element) => {
            const animeLink = $(element).find("a").attr("href").replace('https://animego.org', '');
            if (LOADDED_LINKS.includes(animeLink)) {
                if (SETTINGS.hiddenCompleted) {
                    $(element).closest('[class^="col-"]').attr("hidden", true);
                } else {
                    $(element).css("background-color", HIGHLIGHT_COLOR);
                }
            }
        });
    };

    // Следит за изменениями в списке аниме
    const monitorAnimeListChanges = () => {
        const targetNode = document.querySelector("#anime-list-container");
        if (!targetNode) return console.error("Контейнер аниме не найден.");

        const observer = new MutationObserver(() => highlightWatchedAnime());
        observer.observe(targetNode, { childList: true, subtree: true });
        console.log("Наблюдатель за изменениями запущен.");
    };

    // Загружает список просмотренных аниме из профиля
    const scanAnimeLinks = async () => {
        const username = $('a.nav-link.text-truncate[href="/profile/"]').text().trim();
        if (!username) return console.error("Имя пользователя не найдено.");

        const url = `https://animego.org/user/${username}/mylist/anime/completed`;
        console.log(`Загрузка списка аниме с ${url}`);

        const $iframe = $('<iframe>', { src: url, css: { visibility: "hidden", position: "fixed", top: "-1000px", left: "-1000px" } }).appendTo("body");

        $iframe.on("load", async () => {
            const iframeDocument = $iframe[0].contentDocument;
            const $tableBody = $(iframeDocument).find('tbody[data-loaded="true"]');

            if (!$tableBody.length) return console.error("Таблица с аниме не найдена.");

            const animeLinks = [];
            let lastCount = 0;

            while (true) {
                $iframe[0].contentWindow.scrollTo(0, iframeDocument.body.scrollHeight);
                await new Promise(r => setTimeout(r, 1000));
                const currentCount = $tableBody.find("tr").length;
                if (currentCount === lastCount) break;
                lastCount = currentCount;
            }

            $tableBody.find('a[href^="/anime/"]').each((_, link) => animeLinks.push($(link).attr("href")));
            addLinksToCookie([...new Set(animeLinks)]);
            $iframe.remove();
        });
    };

    // Следит за кнопкой добавления в список
    const monitorAddToListButton = () => {
        const targetNode = document.querySelector('.my-list-anime');
        if (!targetNode) return;

        const observer = new MutationObserver(() => {
            const buttonText = $('.my-list .text-underline-hover').text().trim();
            const animeLink = window.location.pathname;

            if (buttonText.includes("Просмотрено")) addLinksToCookie([animeLink]);
            else removeLinkFromCookie(animeLink);
        });

        observer.observe(targetNode, { childList: true, subtree: true });
    };

    // Очищает локальное хранилище
    const clearStorage = () => {
        if (confirm("Вы уверены, что хотите очистить хранилище?")) {
            localStorage.removeItem(COOKIE_NAME);
            alert("Хранилище очищено.");
        }
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
            setCookie(COOKIE_SETTINGS, SETTINGS);
            toggleScriptEl.text(SETTINGS.scriptEnabled ? 'Выключить скрипт' : 'Включить скрипт');
            alert(`Скрипт ${SETTINGS.scriptEnabled ? 'включен' : 'выключен'}. Перезагрузите страницу.`);
        });

        const toggleHiddenEl = $('#agext-toggle-hidden');
        toggleHiddenEl.on('click', (e) => {
            e.preventDefault();
            SETTINGS.hiddenCompleted = !SETTINGS.hiddenCompleted;
            setCookie(COOKIE_SETTINGS, SETTINGS);
            toggleHiddenEl.text(SETTINGS.hiddenCompleted ? 'Не скрывать просмотренное' : 'Скрывать просмотренное');
            alert(`Просмотренные аниме ${SETTINGS.hiddenCompleted ? 'будут скрыты' : 'не будут скрыты'}.`);
        });

        // Очищение хранилища
        $('#clear-storage').on('click', (e) => {
            e.preventDefault();
            clearStorage();
        });
    };

    const getSettings = getCookie(COOKIE_SETTINGS);
    if (getSettings) {
        SETTINGS = getSettings;
    }

    if (SETTINGS.scriptEnabled) {
        // Инициализация
        if (!getCookie(COOKIE_NAME).length) {
            console.log("Список аниме отсутствует. Запуск сканера.");
            scanAnimeLinks();
        } else {
            console.log("Список аниме уже сохранен.");
        }

        if (window.location.pathname === '/anime') {
            highlightWatchedAnime();
            monitorAnimeListChanges();
        }

        monitorAddToListButton();
    }

    initMenu();
})();
