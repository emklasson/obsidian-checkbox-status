import CheckboxCount from "checkbox_count";
import { App, Plugin, PluginManifest, PluginSettingTab, Setting } from "obsidian";

interface PluginSettings {
    saveConfirmationAll: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
    saveConfirmationAll: true,
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
            .setName('All files')
            .setDesc('Ask for confirmation when saving all files\' times.')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.saveConfirmationAll)
                    .onChange(async (value) => {
                        this.plugin.settings.saveConfirmationAll = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}
