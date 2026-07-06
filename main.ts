import CheckboxCount from "checkbox_count";
import { App, Plugin, PluginManifest, PluginSettingTab, Setting } from "obsidian";

interface PluginSettings {
    showInStatusBar: boolean;
    countAnyCheckSymbol: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
    // Show a status bar item with the count of checked/total checkboxes?
    showInStatusBar: true,

    // Count any non-empty checkbox as checked or only "x"/"X"?
    countAnyCheckSymbol: false
}

export default class CheckboxStatusPlugin extends Plugin {
    settings: PluginSettings;
    private checkboxCount: CheckboxCount;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.checkboxCount = new CheckboxCount(this);
    }

    async onload() {
        await this.loadSettings();

        this.checkboxCount.onload();

        this.addSettingTab(new SettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as PluginSettings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SettingTab extends PluginSettingTab {
    plugin: CheckboxStatusPlugin;

    constructor(app: App, plugin: CheckboxStatusPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Show in status bar')
            .setDesc('Show checkbox count in the status bar.')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.showInStatusBar)
                    .onChange(async (value) => {
                        this.plugin.settings.showInStatusBar = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Count any non-empty checkbox as checked')
            .setDesc('Only counts [x], [X], and [ ] checkboxes if disabled.')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.countAnyCheckSymbol)
                    .onChange(async (value) => {
                        this.plugin.settings.countAnyCheckSymbol = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}
