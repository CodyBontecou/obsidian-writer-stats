import {
	App,
	ItemView,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	debounce,
} from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";

// ─── Constants ───────────────────────────────────────────────────────────────

const VIEW_TYPE = "writer-stats-dashboard";
const ICON_NAME = "bar-chart-2";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayStats {
	typed: number;
	pasted: number;
}

interface WriterStatsData {
	days: { [date: string]: DayStats };
}

interface WriterStatsSettings {
	includeFolders: string;
	excludeFolders: string;
	countPastes: boolean;
	dailyGoal: number;
}

const DEFAULT_SETTINGS: WriterStatsSettings = {
	includeFolders: "",
	excludeFolders: "",
	countPastes: true,
	dailyGoal: 500,
};

const DEFAULT_DATA: WriterStatsData = {
	days: {},
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayKey(): string {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function countWords(text: string): number {
	const trimmed = text.trim();
	if (trimmed.length === 0) return 0;
	return trimmed.split(/\s+/).length;
}

function dateKeyOffset(daysAgo: number): string {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function shortLabel(dateKey: string): string {
	const parts = dateKey.split("-");
	return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

// ─── Dashboard View ──────────────────────────────────────────────────────────

class WriterStatsDashboardView extends ItemView {
	private plugin: WriterStatsPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: WriterStatsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Writer Statistics";
	}

	getIcon(): string {
		return ICON_NAME;
	}

	async onOpen(): Promise<void> {
		this.renderDashboard();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	renderDashboard(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("writer-stats-dashboard");

		const data = this.plugin.statsData;
		const settings = this.plugin.settings;
		const today = todayKey();
		const todayStats = data.days[today] || { typed: 0, pasted: 0 };
		const totalToday = todayStats.typed + (settings.countPastes ? todayStats.pasted : 0);
		const streak = this.plugin.calculateStreak();

		// ── Today's Stats ──────────────────────────────────────────────────
		const todaySection = container.createDiv({ cls: "writer-stats-section" });
		todaySection.createEl("h3", { text: "📝 Today", cls: "writer-stats-section-title" });

		const statsRow = todaySection.createDiv({ cls: "writer-stats-today-row" });
		statsRow.createDiv({ cls: "writer-stats-stat" }).innerHTML =
			`<span class="writer-stats-stat-value">${todayStats.typed}</span><span class="writer-stats-stat-label">typed</span>`;
		if (settings.countPastes) {
			statsRow.createDiv({ cls: "writer-stats-stat" }).innerHTML =
				`<span class="writer-stats-stat-value">${todayStats.pasted}</span><span class="writer-stats-stat-label">pasted</span>`;
		}
		statsRow.createDiv({ cls: "writer-stats-stat" }).innerHTML =
			`<span class="writer-stats-stat-value">${totalToday}</span><span class="writer-stats-stat-label">total</span>`;

		// Goal progress bar
		const goalSection = todaySection.createDiv({ cls: "writer-stats-goal" });
		const pct = Math.min(100, Math.round((totalToday / settings.dailyGoal) * 100));
		goalSection.createEl("div", { cls: "writer-stats-goal-label" }).innerHTML =
			`<span>${pct}% of ${settings.dailyGoal} word goal</span>`;
		const barOuter = goalSection.createDiv({ cls: "writer-stats-progress-bar" });
		const barInner = barOuter.createDiv({ cls: "writer-stats-progress-fill" });
		barInner.style.width = `${pct}%`;
		if (pct >= 100) barInner.addClass("writer-stats-progress-complete");

		// ── Streak ─────────────────────────────────────────────────────────
		const streakSection = container.createDiv({ cls: "writer-stats-section" });
		streakSection.createEl("h3", { text: "🔥 Streak", cls: "writer-stats-section-title" });
		streakSection.createDiv({ cls: "writer-stats-streak" }).innerHTML =
			`<span class="writer-stats-streak-number">${streak}</span><span class="writer-stats-streak-label">day${streak !== 1 ? "s" : ""} in a row</span>`;

		// ── 7-Day Bar Chart ────────────────────────────────────────────────
		const weekSection = container.createDiv({ cls: "writer-stats-section" });
		weekSection.createEl("h3", { text: "📊 Last 7 Days", cls: "writer-stats-section-title" });

		const weekData: { label: string; value: number }[] = [];
		for (let i = 6; i >= 0; i--) {
			const key = dateKeyOffset(i);
			const ds = data.days[key] || { typed: 0, pasted: 0 };
			const val = ds.typed + (settings.countPastes ? ds.pasted : 0);
			weekData.push({ label: shortLabel(key), value: val });
		}
		const maxWeek = Math.max(...weekData.map((d) => d.value), 1);

		const svgWidth = 280;
		const svgHeight = 140;
		const barWidth = 28;
		const barGap = (svgWidth - 7 * barWidth) / 8;
		const chartHeight = 100;

		let barSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" class="writer-stats-bar-chart">`;
		for (let i = 0; i < 7; i++) {
			const x = barGap + i * (barWidth + barGap);
			const h = (weekData[i].value / maxWeek) * chartHeight;
			const y = chartHeight - h;
			barSvg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(h, 2)}" rx="3" class="writer-stats-bar"/>`;
			barSvg += `<text x="${x + barWidth / 2}" y="${chartHeight + 14}" text-anchor="middle" class="writer-stats-bar-label">${weekData[i].label}</text>`;
			if (weekData[i].value > 0) {
				barSvg += `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" class="writer-stats-bar-value">${weekData[i].value}</text>`;
			}
		}
		barSvg += `</svg>`;
		weekSection.createDiv({ cls: "writer-stats-chart-container" }).innerHTML = barSvg;

		// ── 30-Day Sparkline ───────────────────────────────────────────────
		const monthSection = container.createDiv({ cls: "writer-stats-section" });
		monthSection.createEl("h3", { text: "📈 Last 30 Days", cls: "writer-stats-section-title" });

		const monthData: number[] = [];
		for (let i = 29; i >= 0; i--) {
			const key = dateKeyOffset(i);
			const ds = data.days[key] || { typed: 0, pasted: 0 };
			monthData.push(ds.typed + (settings.countPastes ? ds.pasted : 0));
		}
		const maxMonth = Math.max(...monthData, 1);

		const sparkWidth = 280;
		const sparkHeight = 60;
		const points = monthData
			.map((v, i) => {
				const x = (i / 29) * (sparkWidth - 8) + 4;
				const y = sparkHeight - 4 - ((v / maxMonth) * (sparkHeight - 8));
				return `${x},${y}`;
			})
			.join(" ");

		// Fill area
		const firstX = 4;
		const lastX = sparkWidth - 4;
		const fillPoints = `${firstX},${sparkHeight - 4} ${points} ${lastX},${sparkHeight - 4}`;

		let sparkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${sparkWidth} ${sparkHeight}" class="writer-stats-sparkline">`;
		sparkSvg += `<polygon points="${fillPoints}" class="writer-stats-spark-fill"/>`;
		sparkSvg += `<polyline points="${points}" fill="none" class="writer-stats-spark-line"/>`;
		sparkSvg += `</svg>`;
		monthSection.createDiv({ cls: "writer-stats-chart-container" }).innerHTML = sparkSvg;
	}
}

// ─── Settings Tab ────────────────────────────────────────────────────────────

class WriterStatsSettingTab extends PluginSettingTab {
	plugin: WriterStatsPlugin;

	constructor(app: App, plugin: WriterStatsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Writer Statistics Settings" });

		new Setting(containerEl)
			.setName("Daily goal")
			.setDesc("Number of words to aim for each day")
			.addText((text) =>
				text
					.setPlaceholder("500")
					.setValue(String(this.plugin.settings.dailyGoal))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.dailyGoal = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Count pasted words")
			.setDesc("Include pasted text in totals and goal progress")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.countPastes)
					.onChange(async (value) => {
						this.plugin.settings.countPastes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Include folders")
			.setDesc("Only count words in these folders (comma-separated, empty = all)")
			.addText((text) =>
				text
					.setPlaceholder("e.g. Notes, Journal")
					.setValue(this.plugin.settings.includeFolders)
					.onChange(async (value) => {
						this.plugin.settings.includeFolders = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Exclude folders")
			.setDesc("Never count words in these folders (comma-separated)")
			.addText((text) =>
				text
					.setPlaceholder("e.g. Templates, Archive")
					.setValue(this.plugin.settings.excludeFolders)
					.onChange(async (value) => {
						this.plugin.settings.excludeFolders = value;
						await this.plugin.saveSettings();
					})
			);
	}
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default class WriterStatsPlugin extends Plugin {
	settings: WriterStatsSettings = DEFAULT_SETTINGS;
	statsData: WriterStatsData = DEFAULT_DATA;
	private statusBarEl: HTMLElement | null = null;

	private debouncedSave = debounce(() => this.persistData(), 2000, true);
	private debouncedStatusBar = debounce(() => this.updateStatusBar(), 300, true);
	private debouncedDashboard = debounce(() => this.refreshDashboard(), 1000, true);

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.loadStatsData();

		// Register dashboard view
		this.registerView(VIEW_TYPE, (leaf) => {
			return new WriterStatsDashboardView(leaf, this);
		});

		// Ribbon icon
		this.addRibbonIcon(ICON_NAME, "Open Writer Statistics", () => {
			this.activateView();
		});

		// Command
		this.addCommand({
			id: "open-writer-statistics",
			name: "Open Writer Statistics",
			callback: () => this.activateView(),
		});

		// Status bar
		this.statusBarEl = this.addStatusBarItem();
		this.updateStatusBar();

		// Settings tab
		this.addSettingTab(new WriterStatsSettingTab(this.app, this));

		// CM6 extension: listen for text changes and detect paste vs typed
		const plugin = this;
		const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
			if (!update.docChanged) return;

			const activeFile = plugin.app.workspace.getActiveFile();
			if (!activeFile) return;
			if (!plugin.isFileAllowed(activeFile.path)) return;

			let typedWords = 0;
			let pastedWords = 0;

			update.transactions.forEach((tr) => {
				if (!tr.docChanged) return;

				let insertedText = "";
				tr.changes.iterChanges(
					(_fromA: number, _toA: number, _fromB: number, _toB: number, inserted) => {
						insertedText += inserted.toString();
					}
				);

				const words = countWords(insertedText);
				if (words === 0) return;

				if (tr.isUserEvent("input.paste")) {
					pastedWords += words;
				} else {
					typedWords += words;
				}
			});

			if (typedWords > 0 || pastedWords > 0) {
				const key = todayKey();
				if (!plugin.statsData.days[key]) {
					plugin.statsData.days[key] = { typed: 0, pasted: 0 };
				}
				plugin.statsData.days[key].typed += typedWords;
				plugin.statsData.days[key].pasted += pastedWords;

				plugin.debouncedSave();
				plugin.debouncedStatusBar();
				plugin.debouncedDashboard();
			}
		});

		this.registerEditorExtension([updateListener]);
	}

	async onunload(): Promise<void> {
		// Final save
		await this.persistData();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);
	}

	// ── Folder filtering ───────────────────────────────────────────────────

	isFileAllowed(filePath: string): boolean {
		const include = this.settings.includeFolders
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const exclude = this.settings.excludeFolders
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		if (include.length > 0) {
			const matched = include.some((folder) => filePath.startsWith(folder + "/") || filePath.startsWith(folder));
			if (!matched) return false;
		}

		if (exclude.length > 0) {
			const matched = exclude.some((folder) => filePath.startsWith(folder + "/") || filePath.startsWith(folder));
			if (matched) return false;
		}

		return true;
	}

	// ── Streak calculation ─────────────────────────────────────────────────

	calculateStreak(): number {
		let streak = 0;
		// Start from today and count backwards
		for (let i = 0; i < 365; i++) {
			const key = dateKeyOffset(i);
			const ds = this.statsData.days[key];
			if (ds && (ds.typed > 0 || (this.settings.countPastes && ds.pasted > 0))) {
				streak++;
			} else {
				// If today has no words yet, don't break streak — check from yesterday
				if (i === 0) continue;
				break;
			}
		}
		return streak;
	}

	// ── Status bar ─────────────────────────────────────────────────────────

	updateStatusBar(): void {
		if (!this.statusBarEl) return;
		const today = todayKey();
		const ds = this.statsData.days[today] || { typed: 0, pasted: 0 };
		const total = ds.typed + (this.settings.countPastes ? ds.pasted : 0);
		const streak = this.calculateStreak();
		this.statusBarEl.textContent = `${total} words | ${streak} day streak`;
	}

	// ── Dashboard refresh ──────────────────────────────────────────────────

	private refreshDashboard(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof WriterStatsDashboardView) {
				view.renderDashboard();
			}
		}
	}

	// ── View activation ────────────────────────────────────────────────────

	async activateView(): Promise<void> {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];

		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({ type: VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	// ── Data persistence ───────────────────────────────────────────────────

	async loadStatsData(): Promise<void> {
		const saved = await this.loadData();
		if (saved) {
			this.statsData = Object.assign({}, DEFAULT_DATA, {
				days: saved.days || {},
			});
			// Restore settings from saved data if present
			if (saved.settings) {
				this.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings);
			}
		}
	}

	async persistData(): Promise<void> {
		await this.saveData({
			days: this.statsData.days,
			settings: this.settings,
		});
	}

	async loadSettings(): Promise<void> {
		const saved = await this.loadData();
		if (saved && saved.settings) {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings);
		}
	}

	async saveSettings(): Promise<void> {
		await this.persistData();
		this.updateStatusBar();
		this.refreshDashboard();
	}
}
