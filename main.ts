import CheckboxCount from "checkbox_count";
import { App, Plugin, PluginManifest, PluginSettingTab, Setting } from "obsidian";

interface PluginSettings {
    showInStatusBar: boolean;
    showProgressBar: boolean;
    countAnyCheckSymbol: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
    // Show a status bar item with the count of checked/total checkboxes?
    showInStatusBar: true,

    // Show a progress bar filled to <checked / total>.
    showProgressBar: true,

    // Count any non-empty checkbox as checked or only "x"/"X"?
    countAnyCheckSymbol: false
}

export default class CheckboxStatusPlugin extends Plugin {
    public settings!: PluginSettings;
    public checkboxCount: CheckboxCount;

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

    display() {
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
                        this.plugin.checkboxCount.update();
                    });
            });

        new Setting(containerEl)
            .setName('Show progress bar in view')
            .setDesc('Show a progress bar filled to <checked / total>.')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.showProgressBar)
                    .onChange(async (value) => {
                        this.plugin.settings.showProgressBar = value;
                        await this.plugin.saveSettings();
                        this.plugin.checkboxCount.update();
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
                        this.plugin.checkboxCount.update();
                    });
            });
    }
}
