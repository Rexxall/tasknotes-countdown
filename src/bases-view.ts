import { BasesView, Keymap, type BasesAllOptions, type BasesEntry, type BasesPropertyId, type BasesViewConfig, type QueryController } from 'obsidian';
import { compareItems, countdown, groupByBand, isDone, parseDue, pickHero, type CountdownItem } from './core';
import { arrange } from './model';
import { renderEmpty, renderHero, renderSections, type Section } from './render';
import type TaskNotesCountdown from './main';

export const VIEW_TYPE = 'tasknotes-countdown';
const DEFAULT_DATE = 'note.due';
const DEFAULT_STATUS = 'note.status';
const DEFAULT_URGENT = 3;

export function viewOptions(plugin: TaskNotesCountdown): (config: BasesViewConfig) => BasesAllOptions[] {
	return () => {
		const s = plugin.strings();
		return [
			{ type: 'property', key: 'dateProperty', displayName: s.t('optDate'), default: DEFAULT_DATE },
			{ type: 'property', key: 'statusProperty', displayName: s.t('optStatus'), default: DEFAULT_STATUS },
			{ type: 'slider', key: 'urgentDays', displayName: s.t('optUrgent'), default: DEFAULT_URGENT, min: 0, max: 30, step: 1 },
			{ type: 'toggle', key: 'showDone', displayName: s.t('optDone'), default: false },
		];
	};
}

export function createBasesView(controller: QueryController, containerEl: HTMLElement, plugin: TaskNotesCountdown): CountdownBasesView {
	const view = new CountdownBasesView(controller, containerEl, plugin);
	plugin.basesViews.add(view);
	view.register(() => plugin.basesViews.delete(view));
	return view;
}

/** A Bases view that turns each row's date into a countdown. Reads only; never writes to the notes. */
export class CountdownBasesView extends BasesView {
	readonly type = VIEW_TYPE;
	private root: HTMLElement;
	private stamp = '';

	constructor(controller: QueryController, containerEl: HTMLElement, private plugin: TaskNotesCountdown) {
		super(controller);
		this.root = containerEl.createDiv({ cls: 'ap tcd tcd-bases' });
	}

	onload(): void {
		// Day and hour change without the data changing; check once a minute and redraw only then.
		this.registerInterval(window.setInterval(() => {
			if (stampOf(new Date()) !== this.stamp) this.onDataUpdated();
		}, 60_000));
	}

	onunload(): void {
		this.root.remove();
	}

	onDataUpdated(): void {
		if (!this.data) return;
		const now = new Date();
		this.stamp = stampOf(now);
		const strings = this.plugin.strings();
		const dateProp = this.prop('dateProperty', DEFAULT_DATE);
		const statusProp = this.prop('statusProperty', DEFAULT_STATUS);
		const urgent = numberOr(this.config.get('urgentDays'), DEFAULT_URGENT);
		const showDone = this.config.get('showDone') === true;
		const completed = this.plugin.completed();
		const archiveTag = this.plugin.archiveTag();

		const toItem = (entry: BasesEntry): CountdownItem | null => {
			const due = parseDue(text(entry.getValue(dateProp)));
			if (!due) return null;
			if (archiveTag && this.hasTag(entry, archiveTag)) return null;
			const done = isDone(text(entry.getValue(statusProp)), completed);
			if (done && !showDone) return null;
			const title = text(entry.getValue('note.title'))?.trim() || entry.file.basename;
			return { path: entry.file.path, title, due, done, countdown: countdown(due, now, urgent, done) };
		};

		const groups = this.data.groupedData;
		const userGrouped = groups.some(g => g.hasKey());
		const all = groups.flatMap(g => g.entries.map(toItem).filter(isItem));
		// Plans, waiting days and subtasks come from TaskNotes; without it the view is a plain countdown.
		const { main, waiting } = arrange(all, this.plugin.index, this.plugin.planOptions(now));
		const inMain = new Set(main);
		const hero = pickHero([...main].sort(compareItems));
		const notHero = (i: CountdownItem) => i !== hero;

		let sections: Section[];
		if (userGrouped) {
			// Respect the base's own "Group by"; keep its order, sort each group by date.
			sections = groups.map(g => ({
				label: g.hasKey() ? (g.key?.toString() ?? '') : strings.t('groupNoDate'),
				items: g.entries.map(e => main.find(i => i.path === e.file.path)).filter(isItem).filter(i => inMain.has(i)).filter(notHero).sort(compareItems),
			})).filter(s => s.items.length > 0);
			if (waiting.length) sections.unshift({ label: strings.t('waitingSection'), items: waiting });
		} else {
			sections = groupByBand(main.filter(notHero).sort(compareItems)).map(g => ({ label: strings.band(g.band), items: g.items }));
			// Waiting sits right after Overdue: both need you to act today.
			if (waiting.length) sections.splice(sections[0]?.label === strings.band('overdue') ? 1 : 0, 0, { label: strings.t('waitingSection'), items: waiting });
		}

		const root = this.root;
		root.empty();
		const o = { strings, now, open: (path: string, evt: MouseEvent | KeyboardEvent) => void this.app.workspace.openLinkText(path, '', Keymap.isModEvent(evt)) };
		if (!hero && sections.length === 0) {
			renderEmpty(root, 'hourglass', strings.t('emptyTitle'), strings.t('emptyText'));
			return;
		}
		if (hero) renderHero(root, hero, o);
		renderSections(root, sections, o);
	}

	private prop(key: string, fallback: string): BasesPropertyId {
		return this.config.getAsPropertyId(key) ?? (fallback as BasesPropertyId);
	}

	private hasTag(entry: BasesEntry, tag: string): boolean {
		const fm = this.app.metadataCache.getFileCache(entry.file)?.frontmatter;
		const tags: unknown = fm?.tags;
		const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,\s]+/) : [];
		return list.some(t => typeof t === 'string' && t.replace(/^#/, '').toLowerCase() === tag.toLowerCase());
	}
}

function stampOf(d: Date): string {
	return `${d.toDateString()} ${d.getHours()}`;
}

function text(value: { toString(): string } | null): string | undefined {
	if (!value) return undefined;
	const s = value.toString();
	return s === 'null' || s === '' ? undefined : s;
}

function numberOr(v: unknown, fallback: number): number {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : fallback;
}

function isItem(i: CountdownItem | null | undefined): i is CountdownItem {
	return !!i;
}
