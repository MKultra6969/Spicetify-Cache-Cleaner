// @ts-check
/// <reference types="react" />
/// <reference path="./globals.d.ts" />
(async function cacheCleaner() {
    // --- 1. Ожидание готовности API Spicetify ---
    if (!Spicetify.Platform?.OfflineAPI?._storage?.getStats ||
        !Spicetify.Platform?.OfflineAPI?._storage?.deleteUnlockedItems ||
        !Spicetify.Menu ||
        !Spicetify.Menu.Item ||
        !Spicetify.Locale   // Проверяем и Locale
       ) {
        console.log("Cache Cleaner: Waiting for Spicetify APIs (OfflineStorage, Menu, or Locale)...");
        setTimeout(cacheCleaner, 500);
        return;
    }
    console.log("Cache Cleaner: Spicetify APIs ready.");

    // --- 2. Настройка Локализации ---
    const translations = {
        menuTitle:              { en: "Cache config", ru: "Настройки кэша" },
        modalTitle:             { en: "Cache config", ru: "Настройки кэша" },
        enableLabel:            { en: "Enable", ru: "Включить" },
        enableInfo:             { en: "Enable automatic cache cleaning", ru: "Включить автоматическую очистку кэша" },
        notifyLabel:            { en: "Show notification", ru: "Показывать уведомление" },
        notifyInfo:             { en: "Notify when cache is cleared automatically", ru: "Уведомлять об автоматической очистке кэша" },
        frequencyLabel:         { en: "Frequency", ru: "Частота" },
        frequencyInfo:          { en: "Automatically clear cache after a certain amount of time", ru: "Автоматически очищать кэш через определенный промежуток времени" },
        freqNever:              { en: "Never", ru: "Никогда" },
        freqLaunch:             { en: "On launch", ru: "При запуске" },
        freqDaily:              { en: "After a day", ru: "Раз в день" },
        freqWeekly:             { en: "After a week", ru: "Раз в неделю" },
        freqMonthly:            { en: "After a month", ru: "Раз в месяц" },
        thresholdLabel:         { en: "Size threshold (MB)", ru: "Порог размера (МБ)" },
        thresholdInfo:          { en: "Clear cache when it reaches this size (0 to disable)", ru: "Очищать кэш, когда он достигает этого размера (0 для отключения)" },
        cacheSizeLabel:         { en: "Cache size:", ru: "Размер кэша:" },
        fetching:               { en: "Fetching...", ru: "Получение..." },
        clearCacheButton:       { en: "Clear cache", ru: "Очистить кэш" },
        clearedNotification:    { en: "Cleared % MB of cache", ru: "Очищено % МБ кэша" },
        invalidThresholdNotification: { en: "Invalid threshold value, please enter a number", ru: "Неверное значение порога, введите число" }
    };

    const currentLocale = Spicetify.Locale.getLocale();
    const lang = currentLocale.startsWith("ru") ? "ru" : "en";

    function _T(key, ...args) {
        const entry = translations[key];
        if (!entry) {
            console.warn(`Cache Cleaner: Missing translation key: ${key}`);
            return key;
        }
        let text = entry[lang] || entry.en;
        if (!text) {
             console.warn(`Cache Cleaner: Missing English translation for key: ${key}`);
             return key;
        }
        if (args.length > 0) {
            args.forEach(arg => {
                text = text.replace("%", String(arg)); // Добавлено String() для надежности
            });
        }
        return text;
    }

    // --- 3. Загрузка и Управление Конфигурацией ---
    let config;
    try {
        config = JSON.parse(localStorage.getItem("spicetify-cache-cleaner:config") || "{}");
    } catch {
        config = {};
    }

    /** @type {React} */
    const react = Spicetify.React;
    const { useState, useEffect, useCallback } = react;
    const time = { launch: 0, daily: 24 * 60 * 60 * 1000, weekly: 24 * 60 * 60 * 1000 * 7, monthly: 30 * 24 * 60 * 60 * 1000 };

    // Установка значений по умолчанию
    config.enabled = config.enabled ?? true;
    config.notify = config.notify ?? true;
    config.frequency = config.frequency ?? "weekly";
    // Исправляем установку времени по умолчанию, если частота 'never'
    if (config.frequency === "never") {
        config.time = config.time ?? 0;
    } else {
        config.time = config.time ?? (Date.now() + (time[config.frequency] || time.weekly)); // Используем weekly если частота некорректна
    }
    config.threshold = config.threshold ?? 0;
    localStorage.setItem("spicetify-cache-cleaner:config", JSON.stringify(config)); // Сохраняем начальную конфигурацию

    // --- 4. Основная Логика Очистки Кэша ---
    async function clearCache(purge = false) {
        let initialStats;
        try {
            initialStats = await Spicetify.Platform.OfflineAPI._storage.getStats();
        } catch(e) {
            console.error("Cache Cleaner: Error getting initial cache stats", e);
            Spicetify.showNotification("Error getting cache stats", true);
            return;
        }
        let cacheCleanedInitial = Number(initialStats.currentSize);

        async function checkAndNotify() {
            let finalStats;
            try {
                 finalStats = await Spicetify.Platform.OfflineAPI._storage.getStats();
            } catch(e) {
                 console.error("Cache Cleaner: Error getting final cache stats", e);
                 Spicetify.showNotification("Error checking cache size after clear", true);
                 return;
            }
            const finalSize = Number(finalStats.currentSize);
            const cleanedAmount = cacheCleanedInitial - finalSize;

             // Добавим небольшую задержку перед повторной проверкой, если размер не уменьшился
            if (cleanedAmount <= 0 && purge) {
                console.log("Cache Cleaner: Cache size didn't decrease immediately, checking again...");
                setTimeout(() => checkAndNotify(), 1000); // Увеличил таймаут для надежности
                return;
            }

            // Показываем уведомление только если что-то было очищено
            if (cleanedAmount > 0 && (config.notify || !purge)) {
                 Spicetify.showNotification(_T("clearedNotification", cleanedAmount.toFixed(2))); // Округляем до 2 знаков
            } else if (!purge) {
                 // Если очистка была ручной и ничего не удалилось
                 Spicetify.showNotification("Cache is already empty or could not be cleared further.");
            }
        }

        try {
            await Spicetify.Platform.OfflineAPI._storage.deleteUnlockedItems();
            // Ждем немного перед проверкой размера, т.к. удаление может быть не мгновенным
            setTimeout(checkAndNotify, 500);
        } catch (e) {
            console.error("Cache Cleaner: Error deleting unlocked items", e);
            Spicetify.showNotification("Error clearing cache", true);
        }
    }

    // --- 5. Стили и Компоненты React ---
    const styling = `.setting-row::after { content: ""; display: table; clear: both; } .setting-row + span { font-size: 0.825rem; } .setting-row .col { padding: 16px 0 4px; align-items: center; } .setting-row .col.description { float: left; padding-right: 15px; cursor: default; max-width: 70%; } .setting-row .col.action { float: right; display: flex; justify-content: flex-end; align-items: center; } .setting-row .col.action .clear-cache { -webkit-tap-highlight-color: transparent; font-weight: 700; font-family: var(--font-family,CircularSp,CircularSp-Arab,CircularSp-Hebr,CircularSp-Cyrl,CircularSp-Grek,CircularSp-Deva,var(--fallback-fonts,sans-serif)); background-color: transparent; border-radius: 500px; transition-duration: 33ms; transition-property: background-color, border-color, color, box-shadow, filter, transform; padding-inline: 15px; border: 1px solid #727272; color: var(--spice-text); min-block-size: 32px; } .setting-row .col.action .clear-cache:hover { transform: scale(1.04); border-color: var(--spice-text); } .setting-row .col.action input { width: 100%; margin-top: 10px; padding: 0 5px; height: 32px; border: 0; color: var(--spice-text); background-color: initial; border-bottom: 1px solid var(--spice-text); max-width: 80px; text-align: right; } button.switch { align-items: center; border: 0px; border-radius: 50%; background-color: rgba(var(--spice-rgb-shadow), 0.7); color: var(--spice-text); cursor: pointer; margin-inline-start: 12px; padding: 8px; width: 32px; height: 32px; } button.switch.disabled, button.switch[disabled] { color: rgba(var(--spice-rgb-text), 0.3); } button.switch.small { width: 22px; height: 22px; padding: 3px; } select.main-dropDown-dropDown { padding-right: 28px; }`; // Добавил стили для input и select

    const ButtonSVG = ({ icon, active = true, onClick }) => {
        return react.createElement(
            "button", { className: "switch" + (active ? "" : " disabled"), onClick, disabled: !active },
            react.createElement("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "currentColor", dangerouslySetInnerHTML: { __html: icon } })
        );
    };

    const ConfigInput = ({ name, defaultValue, onChange = (value) => {} }) => {
        const [value, setValue] = useState(defaultValue);
        const setValueCallback = useCallback((event) => {
            const rawValue = event.target.value;
            // Разрешаем только цифры
            if (/^\d*$/.test(rawValue)) {
                 const numericValue = rawValue === "" ? 0 : parseInt(rawValue, 10);
                 setValue(numericValue);
                 onChange(numericValue);
            } else if (rawValue === "") {
                 // Позволяем стереть поле, устанавливая значение 0
                 setValue(0);
                 onChange(0);
            }
        }, [onChange]);

        return react.createElement("div", { className: "setting-row" },
            react.createElement("label", { className: "col description" }, name),
            react.createElement("div", { className: "col action" },
                react.createElement("input", { type: "number", min: "0", value: value, onChange: setValueCallback })
            )
        );
    };

    const ConfigSlider = ({ name, defaultValue, onChange = (value) => {} }) => {
        const [active, setActive] = useState(defaultValue);
        const toggleState = useCallback(() => {
            const state = !active;
            setActive(state);
            onChange(state);
        }, [active, onChange]);

        return react.createElement("div", { className: "setting-row" },
            react.createElement("label", { className: "col description" }, name),
            react.createElement("div", { className: "col action" },
                react.createElement(ButtonSVG, { icon: Spicetify.SVGIcons.check, active, onClick: toggleState })
            )
        );
    };

    const ConfigSelection = ({ name, defaultValue, options, onChange = (value) => {} }) => {
        const [value, setValue] = useState(defaultValue);
        const setValueCallback = useCallback((event) => {
            let selectedValue = event.target.value;
            setValue(selectedValue);
            onChange(selectedValue);
        }, [onChange]);

        const localizedOptions = Object.keys(options).reduce((acc, key) => {
            const translationKey = `freq${key.charAt(0).toUpperCase() + key.slice(1)}`;
            acc[key] = translations[translationKey] ? _T(translationKey) : options[key];
            return acc;
        }, {});

        return react.createElement("div", { className: "setting-row" },
            react.createElement("label", { className: "col description" }, name),
            react.createElement("div", { className: "col action" },
                react.createElement("select", { className: "main-dropDown-dropDown", value, onChange: setValueCallback },
                    Object.keys(localizedOptions).map((itemKey) =>
                        react.createElement("option", { key: itemKey, value: itemKey }, localizedOptions[itemKey])
                    )
                )
            )
        );
    };

    const OptionList = ({ items, onChange }) => {
        // Используем состояние только для триггера перерисовки, если это нужно (здесь не обязательно)
        // const [_, forceUpdate] = useState(0);
        return items.map((item) => {
            if (!item || (item.when && !item.when())) {
                return null;
            }
            const onChangeItem = onChange; // Убрали item.onChange, т.к. он не используется
            const localizedDesc = _T(item.labelKey);
            const localizedInfo = item.infoKey ? _T(item.infoKey) : undefined;

            const childProps = Object.keys(item)
                .filter(k => !['labelKey', 'infoKey', 'when', 'onChange'].includes(k)) // Убираем ненужные пропсы
                .reduce((acc, k) => { acc[k] = item[k]; return acc; }, {});

            return react.createElement("div", { key: item.key },
                react.createElement(item.type, {
                    ...childProps,
                    name: localizedDesc,
                    defaultValue: config[item.key],
                    onChange: (value) => {
                        onChangeItem(item.key, value);
                        // forceUpdate(c => c + 1); // Перерисовка при изменении для when()
                    },
                }),
                localizedInfo && react.createElement("span", { dangerouslySetInnerHTML: { __html: localizedInfo } })
            );
        });
    };

    // === ОПРЕДЕЛЕНИЕ clearCacheButton ПЕРЕМЕЩЕНО СЮДА (ПЕРЕД openModal) ===
    const clearCacheButton = () => {
        const [cacheSize, setCacheSize] = useState(_T("fetching"));
        const [isClearing, setIsClearing] = useState(false); // Состояние для блокировки кнопки

        const updateCacheSize = useCallback(() => {
            Spicetify.Platform.OfflineAPI._storage.getStats()
                .then((stats) => {
                    setCacheSize(`${Number(stats.currentSize).toFixed(2)} MB`); // Округляем до 2 знаков
                })
                .catch((e) => {
                    console.error("Cache Cleaner: Error getting cache stats for button", e);
                    setCacheSize("Error");
                });
        }, []);

        useEffect(() => {
            updateCacheSize(); // Загружаем размер при монтировании
        }, [updateCacheSize]);

        const handleClearClick = useCallback(async () => {
            setIsClearing(true); // Блокируем кнопку
            setCacheSize("Clearing..."); // Показываем статус
            await clearCache(false); // Вызываем ручную очистку (false - покажет уведомление)
            // Обновляем размер после очистки (с небольшой задержкой для надежности)
            setTimeout(() => {
                 updateCacheSize();
                 setIsClearing(false); // Разблокируем кнопку
            }, 1500); // Задержка после очистки перед обновлением размера
        }, [updateCacheSize]);


        return react.createElement("div", { className: "setting-row" },
            react.createElement("label", { className: "col description" }, `${_T("cacheSizeLabel")} ${cacheSize}`),
            react.createElement("div", { className: "col action" },
                react.createElement("button", {
                        className: "clear-cache",
                        onClick: handleClearClick,
                        disabled: isClearing // Блокируем кнопку во время очистки
                    },
                    isClearing ? "Clearing..." : _T("clearCacheButton")
                )
            )
        );
    };
    // === КОНЕЦ ОПРЕДЕЛЕНИЯ clearCacheButton ===

    // --- 6. Функция Открытия Модального Окна ---
    async function openModal() {
        const settingItems = [
            { key: "enabled", labelKey: "enableLabel", infoKey: "enableInfo", type: ConfigSlider },
            { key: "notify", labelKey: "notifyLabel", infoKey: "notifyInfo", type: ConfigSlider, when: () => config.enabled },
            { key: "frequency", labelKey: "frequencyLabel", infoKey: "frequencyInfo", type: ConfigSelection,
                options: { never: "Never", launch: "On launch", daily: "After a day", weekly: "After a week", monthly: "After a month" },
                when: () => config.enabled
            },
            { key: "threshold", labelKey: "thresholdLabel", infoKey: "thresholdInfo", type: ConfigInput, when: () => config.enabled }
        ];

        // Используем временный контейнер для рендеринга React-компонента
        const tempDiv = document.createElement('div');

        // Функция для ререндера содержимого модального окна
        function renderModalContent(currentConfig) {
            const content = react.createElement("div", { id: `cache-cleaner-config-container` },
                react.createElement("style", { dangerouslySetInnerHTML: { __html: styling } }),
                react.createElement(OptionList, {
                    items: settingItems,
                    onChange: (name, value) => {
                        config[name] = value; // Обновляем глобальный config
                        if (name === "frequency") {
                            if (value === "never") {
                                config.time = 0;
                            } else if (time[value]) {
                                config.time = Date.now() + time[value];
                            } else {
                                config.time = 0; // Безопасное значение
                            }
                        }
                        localStorage.setItem("spicetify-cache-cleaner:config", JSON.stringify(config));
                        // Вызываем ререндер, чтобы обновить зависимые элементы (when)
                        renderModalContent(config);
                    },
                }),
                react.createElement(clearCacheButton, null) // Используем компонент кнопки
            );
            // @ts-ignore - Spicetify.ReactDOM не типизирован глобально
            Spicetify.ReactDOM.render(content, tempDiv);
        }

        // Первичный рендер
        renderModalContent(config);

        // Отображаем модальное окно с отрендеренным содержимым
        Spicetify.PopupModal.display({
            title: _T("modalTitle"),
            content: tempDiv, // Передаем div с отрендеренным React-содержимым
            isLarge: true,
        });
    }

    // --- 7. Регистрация Пункта Меню ---
    try {
        console.log("Cache Cleaner: Attempting to register menu item with title:", _T("menuTitle"));
        if (typeof openModal !== 'function') {
             throw new Error("openModal function is not defined or not a function");
        }
        new Spicetify.Menu.Item(_T("menuTitle"), false, openModal).register();
        console.log("Cache Cleaner: Menu item registered successfully.");
    } catch (e) {
        console.error("Cache Cleaner: Failed to register menu item!", e);
        Spicetify.showNotification(`Error loading Cache Cleaner extension: ${e.message}. Check Console (Ctrl+Shift+I).`, true, 10000);
    }

    // --- 8. Логика Автоматической Очистки при Запуске ---
    if (config.enabled) {
        let currentStats;
        try {
             currentStats = await Spicetify.Platform.OfflineAPI._storage.getStats();
        } catch(e) {
             console.error("Cache Cleaner: Failed to get stats for auto-cleaning check", e);
             return; // Не продолжаем авто-очистку если не можем получить статы
        }
        const currentSize = Number(currentStats.currentSize);
        const threshold = Number(config.threshold);

        if (isNaN(threshold)) {
            Spicetify.showNotification(_T("invalidThresholdNotification"));
            config.threshold = 0;
            localStorage.setItem("spicetify-cache-cleaner:config", JSON.stringify(config));
        }

        // 1. Проверка по порогу размера
        if (threshold > 0 && currentSize > threshold) {
            console.log(`Cache Cleaner: Cache size (${currentSize}MB) exceeds threshold (${threshold}MB). Clearing...`);
            await clearCache(true); // true - не показывать уведомление, если оно отключено в config.notify
        // 2. Проверка по времени (только если порог не сработал)
        } else if (config.frequency !== "never" && config.time > 0 && Date.now() >= config.time) {
             console.log(`Cache Cleaner: Scheduled time reached. Clearing cache...`);
             await clearCache(true);
             if (time[config.frequency]) {
                 config.time = Date.now() + time[config.frequency];
                 localStorage.setItem("spicetify-cache-cleaner:config", JSON.stringify(config));
             } else {
                 config.time = 0; // Сброс времени при неверной частоте
                 localStorage.setItem("spicetify-cache-cleaner:config", JSON.stringify(config));
             }
        // 3. Особый случай: очистка при запуске
        } else if (config.frequency === "launch") {
             console.log("Cache Cleaner: Frequency set to 'On launch'. Clearing cache...");
             await clearCache(true);
             // Не обновляем config.time для 'launch', т.к. оно всегда должно срабатывать при старте
        }
    }
})();