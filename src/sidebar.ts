import { ItemView, Keymap, setIcon, type WorkspaceLeaf } from 'obsidian';
import { parseTagList, pickHero, upcoming } from './core';
import { renderEmpty, renderHero, renderSections, type RenderOptions } from './render';
import { access, completedStatuses } from './tasknotes';
import type TaskNotesCountdown from './main';

export const SIDEBAR_TYPE = 'tasknotes-countdown-sidebar';

/** "Next deadlines": the soonest open TaskNotes tasks with a due date. Read-only. */
export class CountdownSidebar extends ItemView {
	private body!: HTMLElement;
	private seq = 0;

	constructor(leaf: WorkspaceLeaf, private plugin: TaskNotesCountdown) {
		super(leaf);
	}

	getViewType(): string {
		return SIDEBAR_TYPE;
	}

	getDisplayText(): string {
		return this.plugin.strings().t('sidebarTitle');
	}

	getIcon(): string {
		return 'hourglass';
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass('ap', 'ap-view', 'tcd', 'tcd-sidebar');
		const head = root.createDiv({ cls: 'ap-head tcd-head' });
		head.createDiv({ cls: 'ap-head-main' }).createEl('h2', { cls: 'ap-title', text: this.getDisplayText() });
		const open = head.createDiv({ cls: 'ap-head-actions' }).createEl('button', { cls: 'clickable-icon tcd-open-base', attr: { 'aria-label': this.plugin.strings().t('openBase') } });
		setIcon(open, 'table-2');
		open.addEventListener('click', () => void this.plugin.openCountdownBase());
		this.body = root.createDiv({ cls: 'tcd-body' });
		await this.refresh();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	async refresh(): Promise<void> {
		if (!this.body) return;
		const seq = ++this.seq;
		const strings = this.plugin.strings();
		const found = access(this.app);
		if (found.state !== 'ready') {
			this.body.empty();
			renderEmpty(this.body, 'plug-zap', strings.t(found.state === 'off' ? 'offTitle' : 'oldTitle'), strings.t(found.state === 'off' ? 'offText' : 'oldText'));
			return;
		}
		this.plugin.connect(found.api);
		const tasks = await found.api.tasks.list();
		if (seq !== this.seq) return; // a newer refresh started while this one waited
		const s = this.plugin.settings;
		const tags = parseTagList(s.tags);
		const now = new Date();
		const items = upcoming(tasks, { now, urgentDays: s.urgentDays, completed: completedStatuses(found.api), tags, limit: s.limit });

		this.body.empty();
		if (items.length === 0) {
			renderEmpty(this.body, 'hourglass', strings.t('emptyTitle'), strings.t(tags.length ? 'emptyFiltered' : 'emptyText'));
			return;
		}
		const o: RenderOptions = { strings, now, open: (path, evt) => void this.app.workspace.openLinkText(path, '', Keymap.isModEvent(evt)) };
		const hero = pickHero(items);
		if (hero) renderHero(this.body, hero, o);
		const rest = items.filter(i => i !== hero);
		// Overdue rows keep their own heading; the rest is one list, soonest first.
		const late = rest.filter(i => i.countdown.band === 'overdue');
		const next = rest.filter(i => i.countdown.band !== 'overdue');
		renderSections(this.body, [
			{ label: strings.band('overdue'), items: late },
			{ label: strings.t(hero ? 'after' : 'sidebarTitle'), items: next },
		].filter(x => x.items.length > 0), o);
	}
}
