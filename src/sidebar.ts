import { ItemView, Keymap, setIcon, type WorkspaceLeaf } from 'obsidian';
import { parseTagList, pickHero } from './core';
import { renderEmpty, renderHero, renderSections, type RenderOptions, type Section } from './render';
import { access } from './tasknotes';
import type TaskNotesCountdown from './main';

export const SIDEBAR_TYPE = 'tasknotes-countdown-sidebar';

/** "Next deadlines": the soonest open TaskNotes deadlines, how much is left, who you are waiting on. Read-only. */
export class CountdownSidebar extends ItemView {
	private body: HTMLElement | null = null;

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
		if (this.plugin.index.loaded) this.render();
		else await this.plugin.reload();
	}

	async onClose(): Promise<void> {
		this.body = null;
		this.contentEl.empty();
	}

	render(): void {
		const body = this.body;
		if (!body) return;
		const strings = this.plugin.strings();
		body.empty();
		const found = access(this.app);
		if (found.state !== 'ready') {
			renderEmpty(body, 'plug-zap', strings.t(found.state === 'off' ? 'offTitle' : 'oldTitle'), strings.t(found.state === 'off' ? 'offText' : 'oldText'));
			return;
		}
		if (!this.plugin.index.loaded) return;
		const now = new Date();
		const tags = parseTagList(this.plugin.settings.tags);
		const { main, waiting } = this.plugin.upcoming(now, tags);
		const items = main.slice(0, this.plugin.settings.limit);
		if (items.length === 0 && waiting.length === 0) {
			renderEmpty(body, 'hourglass', strings.t('emptyTitle'), strings.t(tags.length ? 'emptyFiltered' : 'emptyText'));
			return;
		}
		const o: RenderOptions = { strings, now, open: (path, evt) => void this.app.workspace.openLinkText(path, '', Keymap.isModEvent(evt)) };
		const hero = pickHero(items);
		if (hero) renderHero(body, hero, o);
		const rest = items.filter(i => i !== hero);
		const sections: Section[] = [
			{ label: strings.band('overdue'), items: rest.filter(i => i.countdown.band === 'overdue') },
			{ label: strings.t('waitingSection'), items: waiting },
			{ label: strings.t(hero ? 'after' : 'sidebarTitle'), items: rest.filter(i => i.countdown.band !== 'overdue') },
		];
		renderSections(body, sections.filter(x => x.items.length > 0), o);
	}
}
