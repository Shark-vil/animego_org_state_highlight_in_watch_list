let scriptEnabled = true;
let hiddenCompleted = false;

// Загружаем значения из хранилища
chrome.storage.local.get(['animego_ext_scraper_settings'], function(result) {
    const settings = result.animego_ext_scraper_settings || {};

    scriptEnabled = settings.scriptEnabled !== undefined ? settings.scriptEnabled : scriptEnabled;
    hiddenCompleted = settings.hiddenCompleted !== undefined ? settings.hiddenCompleted : hiddenCompleted;

    document.getElementById('toggle-script').textContent = scriptEnabled ? 'Выключить расширение' : 'Включить расширение';
    document.getElementById('toggle-completed').textContent = hiddenCompleted ? 'Показывать просмотренное' : 'Скрыть просмотренное';
});

document.getElementById('toggle-script').onclick = function() {
    scriptEnabled = !scriptEnabled;
    chrome.storage.local.set({ 'animego_ext_scraper_settings': { scriptEnabled, hiddenCompleted } });

    document.getElementById('toggle-script').textContent = scriptEnabled ? 'Выключить расширение' : 'Включить расширение';
};

document.getElementById('toggle-completed').onclick = function() {
    hiddenCompleted = !hiddenCompleted;
    chrome.storage.local.set({ 'animego_ext_scraper_settings': { scriptEnabled, hiddenCompleted } });

    document.getElementById('toggle-completed').textContent = hiddenCompleted ? 'Показывать просмотренное' : 'Скрыть просмотренное';
};

document.getElementById('clear-storage').onclick = function() {
    if (confirm("Вы уверены, что хотите очистить хранилище?")) {
        chrome.storage.local.clear();
    }
};
