import CheckboxStatusPlugin from "main";
import { debounce, ItemView, setIcon, WorkspaceLeaf } from "obsidian";

export const CHECKBOX_COUNT_VIEW_TYPE = "checkbox-status-view";

export default class CheckboxCount {
	public plugin: CheckboxStatusPlugin;
	public checked: number = 0;
	public total: number = 0;
	private statusBarItem: HTMLElement;
	private statusBarCountItem: HTMLElement;
	private debouncedUpdate = debounce(() => this.update(), 150);

	constructor(plugin: CheckboxStatusPlugin) {
		this.plugin = plugin;
		this.statusBarItem = this.plugin.addStatusBarItem();
		this.statusBarItem.addClass("checkbox-statusbar-item");
		this.statusBarCountItem = this.statusBarItem.createEl('span');
		setIcon(this.statusBarItem.createEl('span', { cls: "checkbox-statusbar-icon" }), "list-checks");
	}

	onload() {
		this.plugin.registerView(
			CHECKBOX_COUNT_VIEW_TYPE,
			(leaf) => new CheckboxCountView(leaf, this)
		);

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("file-open", () => {
				this.debouncedUpdate.cancel();
				this.update();
			})
		);

		this.plugin.registerEvent(
			this.plugin.app.metadataCache.on("changed", (file) => {
				if (file === this.plugin.app.workspace.getActiveFile()) {
					this.debouncedUpdate();
				}
			})
		);

		this.plugin.addCommand({
            id: "toggle-checkbox-status-view",
            name: "Toggle checkbox status view",
            callback: () => this.toggleView()
        });

		this.update();
	}

	async toggleView() {
		const leaves = this.plugin.app.workspace.getLeavesOfType(CHECKBOX_COUNT_VIEW_TYPE);
		if (leaves.length > 0) {
			leaves.forEach(leaf => leaf.detach());
			return;
		}

		// Create a new right sidebar leaf.
		const leaf = this.plugin.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: CHECKBOX_COUNT_VIEW_TYPE,
				active: true,
			});
			await this.plugin.app.workspace.revealLeaf(leaf);
		}
	}

	// Returns true on success; otherwise, false.
	private updateCount(): boolean {
		this.total = 0;
		this.checked = 0;

		const file = this.plugin.app.workspace.getActiveFile();
		if (!file || !["md", "markdown"].includes(file.extension.toLowerCase())) {
			return false;
		}

		const cache = this.plugin.app.metadataCache.getFileCache(file);
		for (const cb of cache?.listItems ?? []) {
			if (cb.task === undefined) {
				continue;
			}

			if (cb.task === " ") {
				this.total++;
			} else if (this.plugin.settings.countAnyCheckSymbol
					|| cb.task === "x" || cb.task === "X") {
				this.checked++;
				this.total++;
			}
		}

		return true;
	}

	private updateView() {
		const leaves = this.plugin.app.workspace.getLeavesOfType(CHECKBOX_COUNT_VIEW_TYPE);
		for (const leaf of leaves) {
			if (leaf.view instanceof CheckboxCountView && leaf.view.containerEl?.isConnected) {
				leaf.view.update();
			}
		}
	}

	private updateStatusBar() {
		this.statusBarCountItem.setText(`${this.checked} / ${this.total}`);
		if (this.plugin.settings.showInStatusBar) {
			this.statusBarCountItem.parentElement?.show();
		} else {
			this.statusBarCountItem.parentElement?.hide();
		}
	}

	update() {
		if (!this.updateCount()) {
			this.statusBarCountItem.parentElement?.hide();
		} else {
			this.updateView();
			this.updateStatusBar();
		}
	}
}

class CheckboxCountView extends ItemView {
	private checkboxCount: CheckboxCount;

	constructor(leaf: WorkspaceLeaf, checkboxCount: CheckboxCount) {
		super(leaf);
		this.checkboxCount = checkboxCount;
	}

	getViewType(): string {
		return CHECKBOX_COUNT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Checkbox status";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen() {
		this.update();

		// Fix linting error for async function without await.
		await Promise.resolve();
	}

	update() {
		const container = this.containerEl;
		container.empty();

		const total = this.checkboxCount.total;
		const checked = this.checkboxCount.checked;

		if (total > 0) {
			const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
			const progress = container.createEl("div", {
				cls: "checkbox-progress",
			});

			const label = progress.createEl("div", {
				cls: "checkbox-progress-label",
				text: `${checked} / ${total}`,
			});
			label.createEl("input", {
				type: "checkbox",
				cls: ["task-list-item-checkbox", "checkbox-no-hover"],
				attr: { checked: "", disabled: "", "aria-hidden": "true" },
			});

			if (this.checkboxCount.plugin.settings.showProgressBar) {
				const bar = progress.createEl("div", {
					cls: "checkbox-progress-bar",
				});
				bar.createEl("div", {
					cls: "checkbox-progress-fill",
					attr: { style: `width: ${pct}%` },
				});
			}
		} else {
			container.createEl("p", {
				text: "No checkboxes found.",
				cls: "checkbox-empty",
			});
		}
	}
}
