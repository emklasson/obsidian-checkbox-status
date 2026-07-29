import CheckboxCount from "checkbox_count";
import { App, Editor, Plugin, PluginManifest, PluginSettingTab, Setting } from "obsidian";

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

        this.addCommand({
            id: 'cycle-checkbox-state',
            name: 'Cycle checkbox state',
            editorCallback: (editor) => this.cycleCheckboxState(editor)
        });

        this.addSettingTab(new SettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as PluginSettings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private cycleCheckboxState(editor: Editor) {
        const CHECKBOX_CYCLE = ['', '[ ] ', '[x] ', '[-] '];

        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const match = line.match(/^(\s*)([-*+]) (\[.?\] )?/);
        if (!match) {
            return;
        }

        const [, indent, bullet, checkbox] = match;
        const startCh = indent.length + bullet.length + 1;
        const endCh = startCh + (checkbox?.length || 0);

        const index = CHECKBOX_CYCLE.indexOf(checkbox ?? '');
        if (index == -1) {
            return;
        }

        const replacement = CHECKBOX_CYCLE[(index + 1) % CHECKBOX_CYCLE.length];
        editor.replaceRange(replacement, { line: cursor.line, ch: startCh }, { line: cursor.line, ch: endCh });

        // Fix cursor position if we added a new checkbox at the cursor.
        if (!checkbox && cursor.ch === startCh) {
            editor.setCursor({ line: cursor.line, ch: cursor.ch + replacement.length });
        }
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
