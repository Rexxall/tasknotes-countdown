import { MarkdownRenderChild, Plugin, PluginSettingTab, Setting, TFile, debounce, getLanguage, normalizePath, type App, type EventRef, type SettingDefinitionItem } from 'obsidian';
import type { CountdownBasesView } from './bases-view';
import { VIEW_TYPE, createBasesView, viewOptions } from './bases-view';
import { countdownBase, parseBlock, parseTagList, taskFilter } from './core';
import { Strings, langFrom } from './i18n';
import { TaskIndex, arrange, sidebarItems, type Arranged } from './model';
import type { PlanOptions } from './plan';
import { renderEmpty, renderSections } from './render';
import { CountdownSidebar, SIDEBAR_TYPE } from './sidebar';
import { TASK_EVENTS, access, completedStatuses, settingsSnapshot, viewsFolder, type TaskNotesApi } from './tasknotes';

export interface Settings {
	tags: string;
	limit: number;
	urgentDays: number;
	hoursPerDay: number;
	bufferDays: number;
	waitingMarker: string;
	statusBar: boolean;
}

type SettingKey = keyof Settings;

/** Tag names, so not sentence-cased. */
const EXAMPLE_TAGS = ['exam', 'application'].join(', ');
const DEFAULT_WAITING = ['waiting'].join('');

export const DEFAULT_SETTINGS: Settings = { tags: '', limit: 6, urgentDays: 3, hoursPerDay: 3, bufferDays: 1, waitingMarker: DEFAULT_WAITING, statusBar: true };

export const BLOCK = 'tasknotes-countdown';

export default class TaskNotesCountdown extends Plugin {
	settings: Settings = { ...DEFAULT_SETTINGS };
	readonly index = new TaskIndex(this.app);
	readonly basesViews = new Set<CountdownBasesView>();
	private blocks = new Set<CountdownBlock>();
	private statusEl: HTMLElement | null = null;
	private connectedTo: TaskNotesApi | null = null;
	private refs: Array<{ ref: EventRef; off: (ref: EventRef) => void }> = [];
	private refreshSoon = debounce(() => void this.reload(), 250, true);

	// Startup stays light: settings and registrations. Tasks are read once TaskNotes is ready.
	async onload(): Promise<void> {
		await this.loadSettings();

		if (typeof this.registerBasesView === 'function') {
			this.registerBasesView(VIEW_TYPE, {
				name: this.strings().t('viewName'),
				icon: 'hourglass',
				factory: (controller, containerEl) => createBasesView(controller, containerEl, this),
				options: viewOptions(this),
			});
		}

		this.registerView(SIDEBAR_TYPE, leaf => new CountdownSidebar(leaf, this));
		this.registerMarkdownCodeBlockProcessor(BLOCK, (source, el, ctx) => ctx.addChild(new CountdownBlock(el, this, source)));
		this.addRibbonIcon('hourglass', this.strings().t('sidebarTitle'), () => void this.openSidebar());
		this.addCommand({ id: 'open-next-deadlines', name: this.strings().t('cmdOpen'), callback: () => void this.openSidebar() });
		this.addCommand({ id: 'open-countdown-base', name: this.strings().t('cmdBase'), callback: () => void this.openCountdownBase() });
		this.addSettingTab(new CountdownSettingTab(this.app, this));
		this.applyStatusBar();

		this.app.workspace.onLayoutReady(() => {
			const found = access(this.app);
			if (found.state === 'ready') this.connect(found.api);
			else this.redraw();
		});
		// Once a minute: reconnect if TaskNotes was turned off and on, and redraw when the day changes.
		let day = new Date().toDateString();
		this.registerInterval(window.setInterval(() => {
			const found = access(this.app);
			if (found.state === 'ready' && found.api !== this.connectedTo) this.connect(found.api);
			const today = new Date().toDateString();
			if (today !== day) {
				day = today;
				this.redraw();
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

	/** Reads TaskNotes' tasks once, then redraws every view from that one read. */
	async reload(): Promise<void> {
		const found = access(this.app);
		if (found.state === 'ready') {
			this.connect(found.api);
			this.index.set((await found.api.tasks.list()));
		} else {
			this.index.set([]);
			this.index.loaded = false;
		}
		this.redraw();
	}

	redraw(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(SIDEBAR_TYPE)) {
			if (leaf.view instanceof CountdownSidebar) leaf.view.render();
		}
		for (const view of this.basesViews) view.onDataUpdated();
		for (const block of this.blocks) block.render();
		this.updateStatusBar();
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

	planOptions(now: Date): PlanOptions {
		const found = access(this.app);
		const snapshot = settingsSnapshot(found.state === 'ready' ? found.api : null);
		const def = snapshot?.defaultTaskStatus;
		return {
			now,
			minutesPerDay: Math.max(15, Math.round(this.settings.hoursPerDay * 60)),
			bufferDays: Math.max(0, this.settings.bufferDays),
			completed: this.completed(),
			defaultStatus: typeof def === 'string' && def ? def : 'open',
			waitingMarker: this.settings.waitingMarker,
		};
	}

	/** What the sidebar, the status bar and note blocks show. */
	upcoming(now: Date, tags = parseTagList(this.settings.tags)): Arranged {
		const items = sidebarItems(this.index, { now, urgentDays: this.settings.urgentDays, completed: this.completed(), tags });
		return arrange(items, this.index, this.planOptions(now));
	}

	private applyStatusBar(): void {
		if (this.settings.statusBar && !this.statusEl) {
			this.statusEl = this.addStatusBarItem();
			this.statusEl.addClass('tcd-status', 'mod-clickable');
			this.statusEl.setAttr('aria-label', this.strings().t('statusBarLabel'));
			this.statusEl.addEventListener('click', () => void this.openSidebar());
		} else if (!this.settings.statusBar && this.statusEl) {
			this.statusEl.remove();
			this.statusEl = null;
		}
		this.updateStatusBar();
	}

	/** "TOEFL · 12 days": the nearest open deadline, visible without opening anything. */
	private updateStatusBar(): void {
		const el = this.statusEl;
		if (!el) return;
		const next = this.index.loaded ? this.upcoming(new Date()).main.find(i => i.countdown.band !== 'overdue') : undefined;
		if (!next) {
			el.empty();
			el.toggleClass('is-hidden', true);
			return;
		}
		el.toggleClass('is-hidden', false);
		el.empty();
		el.createSpan({ cls: 'tcd-status-title', text: next.title });
		el.createSpan({ cls: ['tcd-status-left', next.countdown.tone === 'warn' ? 'is-warn' : ''].filter(Boolean), text: this.strings().pill(next.countdown) });
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

	registerBlock(block: CountdownBlock, on: boolean): void {
		if (on) this.blocks.add(block);
		else this.blocks.delete(block);
	}

	async loadSettings(): Promise<void> {
		const raw = (await this.loadData()) as Partial<Settings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.applyStatusBar();
		this.redraw();
	}
}

class CountdownBlock extends MarkdownRenderChild {
	private opts: { limit: number | null; tags: string[] | null };

	constructor(el: HTMLElement, private plugin: TaskNotesCountdown, source: string) {
		super(el);
		this.opts = parseBlock(source);
	}

	onload(): void {
		this.plugin.registerBlock(this, true);
		this.render();
	}

	onunload(): void {
		this.plugin.registerBlock(this, false);
	}

	render(): void {
		const el = this.containerEl;
		el.empty();
		el.addClass('ap', 'tcd', 'tcd-block');
		const strings = this.plugin.strings();
		if (!this.plugin.index.loaded) {
			const found = access(this.plugin.app);
			if (found.state !== 'ready') renderEmpty(el, 'plug-zap', strings.t(found.state === 'off' ? 'offTitle' : 'oldTitle'), strings.t(found.state === 'off' ? 'offText' : 'oldText'));
			return;
		}
		const now = new Date();
		const { main } = this.plugin.upcoming(now, this.opts.tags ?? parseTagList(this.plugin.settings.tags));
		const items = main.slice(0, this.opts.limit ?? 3);
		if (items.length === 0) {
			el.createDiv({ cls: 'tcd-block-empty', text: strings.t('emptyTitle') });
			return;
		}
		renderSections(el, [{ label: '', items }], { strings, now, open: (path, evt) => void this.plugin.app.workspace.openLinkText(path, '', evt.metaKey || evt.ctrlKey) });
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
			{
				type: 'group',
				heading: s.t('settingsCard'),
				items: [
					{ name: s.t('setTags'), desc: s.t('setTagsDesc'), aliases: ['exam', 'application', 'filter'], control: { type: 'text', key: 'tags', placeholder: EXAMPLE_TAGS } },
					{ name: s.t('setLimit'), control: { type: 'number', key: 'limit', min: 1, max: 20, step: 1, validate: v => (validWhole(v, 1, 20) ? undefined : s.t('wholeNumber')) } },
					{ name: s.t('setUrgent'), desc: s.t('setUrgentDesc'), control: { type: 'number', key: 'urgentDays', min: 0, max: 60, step: 1, validate: v => (validWhole(v, 0, 60) ? undefined : s.t('wholeNumber')) } },
					{ name: s.t('setStatusBar'), control: { type: 'toggle', key: 'statusBar' } },
				],
			},
			{
				type: 'group',
				heading: s.t('settingsPlan'),
				items: [
					{ name: s.t('setHours'), desc: s.t('setHoursDesc'), control: { type: 'number', key: 'hoursPerDay', min: 0.5, max: 16, step: 0.5, validate: v => (v >= 0.5 && v <= 16 ? undefined : s.t('hoursRange')) } },
					{ name: s.t('setBuffer'), desc: s.t('setBufferDesc'), control: { type: 'number', key: 'bufferDays', min: 0, max: 30, step: 1, validate: v => (validWhole(v, 0, 30) ? undefined : s.t('wholeNumber')) } },
					{ name: s.t('setWaiting'), desc: s.t('setWaitingDesc'), aliases: ['recommender', 'blocked'], control: { type: 'text', key: 'waitingMarker', placeholder: DEFAULT_WAITING } },
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as SettingKey];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const st = this.plugin.settings;
		const k = key as SettingKey;
		if (k === 'tags' || k === 'waitingMarker') st[k] = typeof value === 'string' ? value : '';
		else if (k === 'statusBar') st.statusBar = value === true;
		else if (typeof value === 'number' && Number.isFinite(value)) st[k] = value;
		await this.plugin.saveSettings();
	}

	/** Fallback for Obsidian versions before 1.13. */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.strings();
		const st = this.plugin.settings;
		const save = () => void this.plugin.saveSettings();
		new Setting(containerEl).setName(s.t('settingsCard')).setHeading();
		new Setting(containerEl).setName(s.t('setTags')).setDesc(s.t('setTagsDesc')).addText(t => t.setPlaceholder(EXAMPLE_TAGS).setValue(st.tags).onChange(v => {
			st.tags = v;
			save();
		}));
		new Setting(containerEl).setName(s.t('setLimit')).addSlider(sl => sl.setLimits(1, 20, 1).setValue(st.limit).onChange(v => {
			st.limit = v;
			save();
		}));
		new Setting(containerEl).setName(s.t('setUrgent')).setDesc(s.t('setUrgentDesc')).addSlider(sl => sl.setLimits(0, 60, 1).setValue(st.urgentDays).onChange(v => {
			st.urgentDays = v;
			save();
		}));
		new Setting(containerEl).setName(s.t('setStatusBar')).addToggle(t => t.setValue(st.statusBar).onChange(v => {
			st.statusBar = v;
			save();
		}));
		new Setting(containerEl).setName(s.t('settingsPlan')).setHeading();
		new Setting(containerEl).setName(s.t('setHours')).setDesc(s.t('setHoursDesc')).addSlider(sl => sl.setLimits(0.5, 16, 0.5).setValue(st.hoursPerDay).onChange(v => {
			st.hoursPerDay = v;
			save();
		}));
		new Setting(containerEl).setName(s.t('setBuffer')).setDesc(s.t('setBufferDesc')).addSlider(sl => sl.setLimits(0, 30, 1).setValue(st.bufferDays).onChange(v => {
			st.bufferDays = v;
			save();
		}));
		new Setting(containerEl).setName(s.t('setWaiting')).setDesc(s.t('setWaitingDesc')).addText(t => t.setPlaceholder(DEFAULT_WAITING).setValue(st.waitingMarker).onChange(v => {
			st.waitingMarker = v;
			save();
		}));
	}
}
