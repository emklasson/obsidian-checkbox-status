import CheckboxCount from "checkbox_count";
import { App, Editor, Plugin, PluginManifest, PluginSettingTab, Setting } from "obsidian";

interface PluginSettings {
    showInStatusBar: boolean;
    showProgressBar: boolean;
    countAnyCheckSymbol: boolean;
    cycles: string[];
}

const DEFAULT_SETTINGS: PluginSettings = {
    // Show a status bar item with the count of checked/total checkboxes?
    showInStatusBar: true,

    // Show a progress bar filled to <checked / total>.
    showProgressBar: true,

    // Count any non-empty checkbox as checked or only "x"/"X"?
    countAnyCheckSymbol: false,

    // Checkbox cycles.
    cycles: [', ,x,-'],
}

export default class CheckboxStatusPlugin extends Plugin {
    public settings!: PluginSettings;
    public checkboxCount: CheckboxCount;
    private maxCycleIndex = 0;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.checkboxCount = new CheckboxCount(this);
    }

    async onload() {
        await this.loadSettings();

        this.checkboxCount.onload();

        this.registerCycleCommands();

        this.addSettingTab(new SettingTab(this.app, this));
    }

    private getCycle(index: number, showBullets: boolean = false): string[] {
        return this.settings.cycles[index].split(',')
            .map(x => x ? `[${x}] ` : (showBullets ? '• ' : ''));
    }

    public registerCycleCommands() {
        // Remove all existing cycle commands (including orphaned ones).
        for (let i = 1; i <= this.maxCycleIndex; i++) {
            this.removeCommand(`cycle-checkbox-state-${i}`);
        }
        // Re-register commands for current cycles.
        for (let i = 0; i < this.settings.cycles.length; i++) {
            const idx = i + 1;
            const cycle = this.getCycle(i, true);
            this.addCommand({
                id: `cycle-checkbox-state-${idx}`,
                name: `Cycle checkbox state ${idx}: ${cycle.join(' ')}`,
                editorCallback: (editor) => this.cycleCheckboxState(editor, i),
            });
        }
        this.maxCycleIndex = this.settings.cycles.length;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as PluginSettings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private cycleCheckboxState(editor: Editor, cycleIndex: number) {
        const cycle = this.getCycle(cycleIndex);

        const selections = editor.listSelections();
        const sharedState = selections.length === 1;

        // Preprocess: collect all lines to process and their cursor positions.
        interface LineInfo {
            line: number;
            startCh: number;
            endCh: number;
            checkbox: string;
            cursorCh: number;
        }
        const lines: LineInfo[] = [];
        const seenLines = new Set<number>();

        for (const sel of selections) {
            const fromLine = Math.min(sel.anchor.line, sel.head.line);
            const toLine = Math.max(sel.anchor.line, sel.head.line);
            for (let i = fromLine; i <= toLine; i++) {
                if (seenLines.has(i)) continue;
                seenLines.add(i);

                const line = editor.getLine(i);
                const match = line.match(/^(\s*)([-*+]) (\[.?\] )?/);
                if (!match) continue;

                const [, indent, bullet, checkbox] = match;
                lines.push({
                    line: i,
                    startCh: indent.length + bullet.length + 1,
                    endCh: indent.length + bullet.length + 1 + (checkbox?.length || 0),
                    checkbox: checkbox ?? '',
                    cursorCh: sel.head.line === i ? sel.head.ch : -1,
                });
            }
        }

        if (lines.length === 0) return;

        // Determine shared replacement from the first line.
        let sharedReplacement = cycle[0];
        if (sharedState && lines.length > 0) {
            const index = cycle.indexOf(lines[0].checkbox);
            if (index != -1) {
                sharedReplacement = cycle[(index + 1) % cycle.length];
            }
        }

        // Apply replacements and collect new cursor positions.
        const newSelections: Array<{ anchor: { line: number; ch: number }; head: { line: number; ch: number } }> = [];

        for (const info of lines) {
            const replacement = sharedState
                ? sharedReplacement
                : cycle[(cycle.indexOf(info.checkbox) + 1) % cycle.length] ?? cycle[0];

            editor.replaceRange(replacement, { line: info.line, ch: info.startCh }, { line: info.line, ch: info.endCh });

            if (info.cursorCh >= 0) {
                const newCh = info.cursorCh + (replacement.length - (info.endCh - info.startCh));
                newSelections.push({ anchor: { line: info.line, ch: newCh }, head: { line: info.line, ch: newCh } });
            }
        }

        if (newSelections.length > 0) {
            editor.setSelections(newSelections);
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

        new Setting(containerEl)
            .setName('Cycle checkbox state')
            .setDesc("The cycle-checkbox-state commands let you cycle through custom checkbox states.")
            .setHeading();

        const cyclesContainer = containerEl.createDiv();
        const self = this;

        function renderCycles() {
            cyclesContainer.empty();
            for (let i = 0; i < self.plugin.settings.cycles.length; i++) {
                renderCycle(i);
            }
        }

        renderCycles();

        new Setting(containerEl)
            .setName('Add cycle')
            .setDesc('Add a new checkbox cycle.')
            .addButton(btn => btn
                .setButtonText('Add')
                .setCta()
                .onClick(() => {
                    self.plugin.settings.cycles.push(', ,x,-');
                    self.plugin.saveSettings();
                    self.plugin.registerCycleCommands();
                    renderCycles();
                })
            );

        function renderCycle(index: number) {
            const cycleDiv = cyclesContainer.createDiv();

            const desc = document.createDocumentFragment();
            desc.createDiv({ text: 'Comma-separated checkbox states to cycle between.' });
            desc.createDiv({ text: 'An empty item means a simple bullet.' });
            desc.createDiv({ text: 'E.g. ", ,x,-" means bullet, unchecked, checked, canceled.' });

            const statesSetting = new Setting(cycleDiv)
                .setName('States in cycle')
                .setDesc(desc)
                .addText(text => {
                    text.setPlaceholder(', ,x,-')
                        .setValue(self.plugin.settings.cycles[index])
                        .onChange(async (value) => {
                            const items = value.split(',');

                            if (items.some(item => item.length > 1)) {
                                text.inputEl.addClass('mklasson-setting-error');
                                return;
                            }

                            text.inputEl.removeClass('mklasson-setting-error');
                            self.plugin.settings.cycles[index] = value;
                            await self.plugin.saveSettings();
                            self.plugin.registerCycleCommands();
                            updateCycleView(index);
                        });
                })
                .addButton(btn => btn
                    .setIcon('trash-2')
                    .setTooltip('Delete cycle')
                    .setWarning()
                    .onClick(async () => {
                        self.plugin.settings.cycles.splice(index, 1);
                        await self.plugin.saveSettings();
                        self.plugin.registerCycleCommands();
                        renderCycles();
                    })
                );

            const label = statesSetting.infoEl.createDiv({ cls: "checkbox-cycle-setting-label" });
            updateCycleView(index);

            function updateCycleView(cycleIndex: number) {
                label.empty();
                label.createSpan({
                    cls: "checkbox-cycle-setting-label-prefix",
                    text: "Cycle:",
                });

                const cycleItems = self.plugin.settings.cycles[cycleIndex].split(',');
                for (const item of cycleItems) {
                    if (item.length === 0) {
                        label.createSpan({
                            cls: ["list-bullet", "checkbox-cycle-setting-bullet"],
                            text: "-",
                        });
                    } else {
                        const attrs: Record<string, string> = {
                            "aria-hidden": "true",
                            "data-task": item,
                            "disabled": "",
                        };
                        if (item !== " ") {
                            attrs["checked"] = "";
                        }
                        label.createEl("input", {
                            type: "checkbox",
                            cls: ["task-list-item-checkbox", "checkbox-no-hover"],
                            attr: attrs,
                        });
                    }
                }
            }
        }
    }
}
