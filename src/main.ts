import { Plugin, PluginSettingTab, Setting, TFile, debounce, getLanguage, normalizePath, type App, type EventRef, type SettingDefinitionItem } from 'obsidian';
import { CountdownBasesView, VIEW_TYPE, viewOptions } from './bases-view';
import { countdownBase, taskFilter } from './core';
import { Strings, langFrom } from './i18n';
import { CountdownSidebar, SIDEBAR_TYPE } from './sidebar';
import { TASK_EVENTS, access, completedStatuses, settingsSnapshot, viewsFolder, type TaskNotesApi } from './tasknotes';

export interface Settings {
	tags: string;
	limit: number;
	urgentDays: number;
}

type SettingKey = keyof Settings;

/** Tag names, so not sentence-cased. */
const EXAMPLE_TAGS = ['exam', 'application'].join(', ');

export const DEFAULT_SETTINGS: Settings = { tags: '', limit: 6, urgentDays: 3 };

export default class TaskNotesCountdown extends Plugin {
	settings: Settings = { ...DEFAULT_SETTINGS };
	private connectedTo: TaskNotesApi | null = null;
	private refs: Array<{ ref: EventRef; off: (ref: EventRef) => void }> = [];
	private refreshSoon = debounce(() => this.refreshSidebars(), 250, true);

	// Startup stays light: settings, registrations, and nothing that reads tasks.
	async onload(): Promise<void> {
		await this.loadSettings();

		if (typeof this.registerBasesView === 'function') {
			this.registerBasesView(VIEW_TYPE, {
				name: this.strings().t('viewName'),
				icon: 'hourglass',
				factory: (controller, containerEl) => new CountdownBasesView(controller, containerEl, this),
				options: viewOptions(this),
			});
		}

		this.registerView(SIDEBAR_TYPE, leaf => new CountdownSidebar(leaf, this));
		this.addRibbonIcon('hourglass', this.strings().t('sidebarTitle'), () => void this.openSidebar());
		this.addCommand({ id: 'open-next-deadlines', name: this.strings().t('cmdOpen'), callback: () => void this.openSidebar() });
		this.addCommand({ id: 'open-countdown-base', name: this.strings().t('cmdBase'), callback: () => void this.openCountdownBase() });
		this.addSettingTab(new CountdownSettingTab(this.app, this));

		// Tasks are read only once the workspace is ready and TaskNotes says its cache is ready.
		this.app.workspace.onLayoutReady(() => {
			const found = access(this.app);
			if (found.state === 'ready') this.connect(found.api);
		});
		// Once a minute: reconnect if needed, and redraw when the day changes.
		let day = new Date().toDateString();
		this.registerInterval(window.setInterval(() => {
			// TaskNotes may have been turned off and on again: pick up its new API.
			const found = access(this.app);
			if (found.state === 'ready' && found.api !== this.connectedTo) this.connect(found.api);
			const today = new Date().toDateString();
			if (today !== day) {
				day = today;
				this.refreshSoon();
			}
		}, 60_000));
	}

	onunload(): void {
		this.disconnect();
	}

	strings(): Strings {
		return new Strings(langFrom(getLanguage()));
	}

	/** Subscribes once to the TaskNotes events that can change a deadline. */
	connect(api: TaskNotesApi): void {
		if (this.connectedTo === api) return;
		this.disconnect();
		this.connectedTo = api;
		for (const name of TASK_EVENTS) this.refs.push({ ref: api.events.on(name, () => this.refreshSoon()), off: r => api.events.off(r) });
		const life = api.hasCapability('lifecycle.events') ? api.lifecycle : undefined;
		if (life) {
			for (const name of ['settings.changed', 'cache.rebuilt', 'unloading']) {
				this.refs.push({ ref: life.on(name, () => {
					if (name === 'unloading') this.disconnect();
					this.refreshSoon();
				}), off: r => life.off(r) });
			}
			void life.ready().then(() => this.refreshSoon());
		} else {
			this.refreshSoon();
		}
	}

	private disconnect(): void {
		for (const { ref, off } of this.refs) off(ref);
		this.refs = [];
		this.connectedTo = null;
	}

	completed(): string[] {
		const found = access(this.app);
		return completedStatuses(found.state === 'ready' ? found.api : null);
	}

	archiveTag(): string {
		const found = access(this.app);
		const mapping = settingsSnapshot(found.state === 'ready' ? found.api : null)?.fieldMapping as Record<string, unknown> | undefined;
		return typeof mapping?.archiveTag === 'string' ? mapping.archiveTag : 'archived';
	}

	refreshSidebars(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(SIDEBAR_TYPE)) {
			if (leaf.view instanceof CountdownSidebar) void leaf.view.refresh();
		}
	}

	async openSidebar(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(SIDEBAR_TYPE)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: SIDEBAR_TYPE, active: true });
			leaf = right;
		}
		await workspace.revealLeaf(leaf);
	}

	/** Opens Countdown.base next to TaskNotes' own views, creating it the first time. Never touches task notes. */
	async openCountdownBase(): Promise<void> {
		const found = access(this.app);
		const snapshot = settingsSnapshot(found.state === 'ready' ? found.api : null);
		const folder = normalizePath(viewsFolder(snapshot));
		const path = normalizePath(`${folder}/Countdown.base`);
		let file = this.app.vault.getFileByPath(path);
		if (!file) {
			if (!this.app.vault.getFolderByPath(folder)) await this.app.vault.createFolder(folder);
			const mapping = snapshot?.fieldMapping as Record<string, unknown> | undefined;
			const due = typeof mapping?.due === 'string' ? mapping.due : 'due';
			const status = typeof mapping?.status === 'string' ? mapping.status : 'status';
			file = await this.app.vault.create(path, countdownBase(taskFilter(snapshot), this.strings().t('viewName'), due, status));
		}
		if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
	}

	async loadSettings(): Promise<void> {
		const raw = (await this.loadData()) as Partial<Settings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshSoon();
	}
}

function validWhole(v: number, min: number, max: number): boolean {
	return Number.isInteger(v) && v >= min && v <= max;
}

class CountdownSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: TaskNotesCountdown) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		const s = this.plugin.strings();
		return [
			{ name: s.t('setTags'), desc: s.t('setTagsDesc'), aliases: ['exam', 'application', 'filter'], control: { type: 'text', key: 'tags', placeholder: EXAMPLE_TAGS } },
			{ name: s.t('setLimit'), control: { type: 'number', key: 'limit', min: 1, max: 20, step: 1, validate: v => (validWhole(v, 1, 20) ? undefined : s.t('wholeNumber')) } },
			{ name: s.t('setUrgent'), desc: s.t('setUrgentDesc'), control: { type: 'number', key: 'urgentDays', min: 0, max: 60, step: 1, validate: v => (validWhole(v, 0, 60) ? undefined : s.t('wholeNumber')) } },
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as SettingKey];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const k = key as SettingKey;
		if (k === 'tags') this.plugin.settings.tags = typeof value === 'string' ? value : '';
		else if (typeof value === 'number' && Number.isFinite(value)) this.plugin.settings[k] = value;
		await this.plugin.saveSettings();
	}

	/** Fallback for Obsidian versions before 1.13. */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.strings();
		const st = this.plugin.settings;
		new Setting(containerEl).setName(s.t('setTags')).setDesc(s.t('setTagsDesc')).addText(t => t.setPlaceholder(EXAMPLE_TAGS).setValue(st.tags).onChange(async v => {
			st.tags = v;
			await this.plugin.saveSettings();
		}));
		new Setting(containerEl).setName(s.t('setLimit')).addSlider(sl => sl.setLimits(1, 20, 1).setValue(st.limit).onChange(async v => {
			st.limit = v;
			await this.plugin.saveSettings();
		}));
		new Setting(containerEl).setName(s.t('setUrgent')).setDesc(s.t('setUrgentDesc')).addSlider(sl => sl.setLimits(0, 60, 1).setValue(st.urgentDays).onChange(async v => {
			st.urgentDays = v;
			await this.plugin.saveSettings();
		}));
	}
}
