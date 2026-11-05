import { setIcon } from 'obsidian';
import type { CountdownItem, Tone } from './core';
import type { Strings } from './i18n';

export interface Section {
	label: string;
	items: CountdownItem[];
}

export interface RenderOptions {
	strings: Strings;
	now: Date;
	open: (path: string, evt: MouseEvent | KeyboardEvent) => void;
}

const TONE_CLASS: Record<Tone, string> = { normal: '', warn: 'is-warn', danger: 'is-danger', done: 'is-done' };

/** The soonest deadline, large. */
export function renderHero(parent: HTMLElement, item: CountdownItem, o: RenderOptions): HTMLElement {
	const s = o.strings;
	const card = parent.createDiv({ cls: ['ap-card', 'tcd-hero', TONE_CLASS[item.countdown.tone]].filter(Boolean) });
	link(card, item, o, s.t('nextUp'));
	card.createDiv({ cls: 'tcd-hero-title', text: item.title });
	const count = card.createDiv({ cls: 'tcd-hero-count' });
	const { value, unit } = s.hero(item.countdown);
	count.createSpan({ cls: ['tcd-hero-value', 'ap-num', /^\d+$/.test(value) ? '' : 'is-word'].filter(Boolean), text: value });
	if (unit) count.createSpan({ cls: 'tcd-hero-unit', text: unit });
	card.createDiv({ cls: 'tcd-hero-date', text: `${s.t('due')} ${s.date(item.due.at, item.due.hasTime, o.now)}` });
	return card;
}

export function renderSections(parent: HTMLElement, sections: Section[], o: RenderOptions): void {
	for (const section of sections) {
		const wrap = parent.createDiv({ cls: 'ap-section tcd-section' });
		const head = wrap.createDiv({ cls: 'ap-section-title tcd-section-title' });
		head.createSpan({ text: section.label });
		head.createSpan({ cls: 'tcd-count ap-num', text: String(section.items.length) });
		const group = wrap.createDiv({ cls: 'ap-group' });
		for (const item of section.items) renderRow(group, item, o);
	}
}

function renderRow(group: HTMLElement, item: CountdownItem, o: RenderOptions): void {
	const s = o.strings;
	const tone = item.countdown.tone;
	const row = group.createDiv({ cls: ['ap-row', 'is-link', 'tcd-row', TONE_CLASS[tone]].filter(Boolean) });
	link(row, item, o);
	const main = row.createDiv({ cls: 'ap-row-main' });
	main.createDiv({ cls: 'ap-row-title tcd-row-title', text: item.title });
	main.createDiv({ cls: 'ap-row-desc', text: s.date(item.due.at, item.due.hasTime, o.now) });
	const pill = row.createSpan({ cls: ['ap-pill', 'tcd-pill', 'ap-num', TONE_CLASS[tone]].filter(Boolean) });
	if (tone === 'done') {
		setIcon(pill.createSpan({ cls: 'tcd-pill-icon' }), 'check');
		pill.createSpan({ text: s.t('done') });
	} else {
		pill.setText(s.pill(item.countdown));
	}
}

/** Click, Enter or Space opens the task note; Cmd/Ctrl-click opens it in a new tab. */
function link(el: HTMLElement, item: CountdownItem, o: RenderOptions, prefix = ''): void {
	el.setAttrs({ role: 'link', tabindex: '0', 'aria-label': `${prefix ? `${prefix}: ` : ''}${item.title}, ${item.countdown.tone === 'done' ? o.strings.t('done') : o.strings.pill(item.countdown)}`, 'data-path': item.path });
	el.addEventListener('click', evt => o.open(item.path, evt));
	el.addEventListener('keydown', evt => {
		if (evt.key === 'Enter' || evt.key === ' ') {
			evt.preventDefault();
			o.open(item.path, evt);
		}
	});
}

export function renderEmpty(parent: HTMLElement, icon: string, title: string, text: string): HTMLElement {
	const empty = parent.createDiv({ cls: 'ap-empty tcd-empty' });
	setIcon(empty.createDiv({ cls: 'tcd-empty-icon' }), icon);
	empty.createDiv({ cls: 'ap-empty-title', text: title });
	empty.createDiv({ cls: 'ap-empty-text', text });
	return empty;
}
