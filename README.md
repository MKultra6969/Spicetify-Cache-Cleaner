# MK Spicetify Cache Cleaner

### The main differences from the original:

1.  **Added localization (i18n):** The extension now supports two languages - 🇷🇺Russian (RU) and 🇺🇸English (EN). The interface (menu item, settings, notifications) is automatically displayed in the Spicetify client language.
2.  **Fixed initialization and rendering:** Fixed bugs related to premature access to Spicetify API (`Locale`, `Menu`). Reworked the rendering mechanism of the modal settings window for React to work correctly and dynamically update the interface (e.g., when enabling/disabling options).
3.  **Reworked the localization system:** Improved the mechanism for getting translated strings for settings, fixed the problem of displaying keys instead of text (`enabledLabel`). Explicit keys are now used for localization, which improves reliability.
4.  **UI/UX and reliability improvements:**
 * "Clear Cache" button now shows status ("Clearing...") and is locked during the process.
    * Improved notification logic after clearing.
    * Added validation for the size threshold input field (numbers only).
    * Improved error handling when interacting with the cache API.
    * Adjusted the order of component definitions to fix `ReferenceError` errors.

[Spicetify](https://github.com/spicetify/spicetify-cli) extension to automatically clear Spotify cache.
Executes on startup.

**Only works on Spotify `v1.1.92`, Spicetify `v2.40.4` and above.**

- [![Github Stars badge](https://img.shields.io/github/stars/kyrie25/Spicetify-Cache-Cleaner?logo=github&style=social)](https://github.com/kyrie25/Spicetify-Cache-Cleaner) - Original repo
- [![Github Stars badge](https://img.shields.io/github/stars/MKultra6969/Spicetify-Cache-Cleaner?logo=github&style=social)](https://github.com/MKultra6969/Spicetify-Cache-Cleaner) - Fork

## Install

Copy `cacheCleaner.js` into your [Spicetify](https://github.com/spicetify/spicetify-cli) extensions directory:
| **Platform** | **Path** |
|------------|------------------------------------------------------------------------------------------|
| **Linux** | `~/.config/spicetify/Extensions` or `$XDG_CONFIG_HOME/.config/spicetify/Extensions/` |
| **MacOS** | `~/.config/spicetify/Extensions` or `$SPICETIFY_CONFIG/Extensions` |
| **Windows** | `%appdata%/spicetify/Extensions/` |

After putting the extension file into the correct folder, run the following command to install the extension:

```
spicetify config extensions cacheCleaner.js
spicetify apply
```

Note: Using the `config` command to add the extension will always append the file name to the existing extensions list. It does not replace the whole key's value.

Or you can manually edit your `config-xpui.ini` file. Add your desired extension filenames in the extensions key, separated them by the | character.
Example:

```ini
[AdditionalOptions]
...
extensions = autoSkipExplicit.js|shuffle+.js|trashbin.js|cacheCleaner.js
```

Then run:

```
spicetify apply
```

## Usage

The extension will automatically clear the Spotify cache after a period of time or if a threshold has been surpassed.
Configuration format
| **Key** | **Values** |
|------------|------------------------------------------------------------------------------------------|
| `enabled` | Boolean value. Define whether the extension is allowed to run or not. |
| `notify` | Boolean value. Define whether notification is shown when cache is cleared automatically. |
| `frequency` | Option value. Can be either `never`, `daily`, `weekly`, or `monthly`. |
| `threshold` | Input value. Defined in `MB`. Cache is automatically cleared when this value is met. `0` to disable this function. |
| `time` | Snowflake value. Is automatically assigned based on frequency and execution time. |

By default, it will have these values:

```js
{
    enabled: true,
    notify: true,
    frequency: "weekly",
    threshold: "0",
    time: 0 // Precisely a week after the extension is first installed.
}
```
-------
### **🇺🇸ENG Menu:**
[![Screenshot](screenshot.png)](https://raw.githubusercontent.com/kyrie25/Spicetify-Cache-Cleaner/main/screenshot.png)
### **🇷🇺RUS Menu:**
![RU_Screenshot](https://github.com/user-attachments/assets/05378cb7-7715-48fc-8266-8b51e0d18267)

