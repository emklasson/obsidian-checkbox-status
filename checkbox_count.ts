import { ItemView, Plugin, setIcon, WorkspaceLeaf } from "obsidian";

export const CHECKBOX_COUNT_VIEW_TYPE = "checkbox-status-view";

// Count any non-empty checkbox as checked or only "x"/"X"?
const countAnyCheckSymbol = false;

// Show a status bar item with the count of checked/total checkboxes?
const showStatusBarCount = true;

export default class CheckboxCount {
	private plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	onload() {
		const statusBarItem = this.plugin.addStatusBarItem();
		const countItem = statusBarItem.createEl('span');
		setIcon(statusBarItem.createEl('span', { cls: "checkbox-statusbar-icon" }), "list-checks");

		this.plugin.registerView(
			CHECKBOX_COUNT_VIEW_TYPE,
			(leaf) => new CheckboxCountView(leaf, countItem)
		);

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("file-open", () => {
				this.updateView();
			})
		);

		this.plugin.app.metadataCache.on("changed", (file) => {
			if (file === this.plugin.app.workspace.getActiveFile()) {
				this.updateView();
			}
		});

		this.plugin.addCommand({
            id: "toggle-checkbox-status-view",
            name: "Toggle checkbox status view",
            callback: () => this.toggleView()
        });
	}

	async toggleView() {
		const leaves = this.plugin.app.workspace.getLeavesOfType(CHECKBOX_COUNT_VIEW_TYPE);
		if (leaves.length > 0) {
			leaves[0].detach();
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

	updateView() {
		const leaves = this.plugin.app.workspace.getLeavesOfType(CHECKBOX_COUNT_VIEW_TYPE);
		const view = leaves.length > 0 ? leaves[0].view as CheckboxCountView : null;
		view?.update();
	}
}

class CheckboxCountView extends ItemView {
	private statusBarCountItem: HTMLElement;

	constructor(leaf: WorkspaceLeaf, statusBarCountItem: HTMLElement) {
		super(leaf);
		this.statusBarCountItem = statusBarCountItem;
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

		const file = this.app.workspace.getActiveFile();

		if (!file || file.extension !== "md") {
			this.showNoCheckboxes(container);
			this.statusBarCountItem.parentElement?.hide();
			return;
		}

		const cache = this.app.metadataCache.getFileCache(file);
		let total = 0;
		let checked = 0;

		const checkboxes = cache?.listItems?.filter((item) => item.task !== undefined);
		if (checkboxes) {
			for (const cb of checkboxes) {
				if (cb.task === " ") {
					total++;
				} else if (countAnyCheckSymbol || cb.task === "x" || cb.task === "X") {
					checked++;
					total++;
				}
			}
		}

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

			const bar = progress.createEl("div", {
				cls: "checkbox-progress-bar",
			});
			bar.createEl("div", {
				cls: "checkbox-progress-fill",
				attr: { style: `width: ${pct}%` },
			});
		} else {
			this.showNoCheckboxes(container);
		}

		this.statusBarCountItem.setText(`${checked} / ${total}`);
		if (showStatusBarCount) {
			this.statusBarCountItem.parentElement?.show();
		} else {
			this.statusBarCountItem.parentElement?.hide();
		}
	}

	private showNoCheckboxes(container: HTMLElement) {
		container.createEl("p", {
			text: "No checkboxes found.",
			cls: "checkbox-empty",
		});
	}
}
