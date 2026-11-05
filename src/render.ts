import { setIcon } from 'obsidian';
import type { CountdownItem, Tone } from './core';
import type { Plan } from './plan';
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
export function renderHero(parent: HTMLElement, item: CountdownItem, o: RenderOptions, share?: () => void): HTMLElement {
	const s = o.strings;
	const card = parent.createDiv({ cls: ['ap-card', 'tcd-hero', TONE_CLASS[item.countdown.tone]].filter(Boolean) });
	if (share) {
		const btn = card.createEl('button', { cls: 'clickable-icon tcd-share', attr: { 'aria-label': s.t('share') } });
		setIcon(btn, 'share');
		btn.addEventListener('click', share);
	}
	// The top half opens the deadline; the steps below open their own notes.
	const main = card.createDiv({ cls: 'tcd-hero-main' });
	link(main, item, o, s.t('nextUp'));
	main.createDiv({ cls: 'tcd-hero-title', text: item.title });
	const count = main.createDiv({ cls: 'tcd-hero-count' });
	const { value, unit } = s.hero(item.countdown);
	count.createSpan({ cls: ['tcd-hero-value', 'ap-num', /^\d+$/.test(value) ? '' : 'is-word'].filter(Boolean), text: value });
	if (unit) count.createSpan({ cls: 'tcd-hero-unit', text: unit });
	main.createDiv({ cls: 'tcd-hero-date', text: `${s.t('due')} ${s.date(item.due.at, item.due.hasTime, o.now)}` });
	if (typeof item.elapsed === 'number') {
		const time = main.createDiv({ cls: 'tcd-time' });
		const bar = time.createDiv({ cls: 'tcd-time-bar', attr: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(item.elapsed * 100)) } });
		bar.createDiv({ cls: 'tcd-time-fill' }).setCssProps({ '--tcd-elapsed': `${(item.elapsed * 100).toFixed(1)}%` });
		time.createDiv({ cls: 'tcd-time-label ap-num', text: s.elapsed(item.elapsed) });
	}
	if (item.plan) renderPlan(card, item.plan, o);
	return card;
}

/** "Can I make it?": work left and pace, then the open steps with when each must start. */
function renderPlan(card: HTMLElement, plan: Plan, o: RenderOptions): void {
	const s = o.strings;
	const pace = s.pace(plan);
	if (pace.length) {
		const line = card.createDiv({ cls: ['tcd-pace', plan.tight ? 'is-tight' : ''].filter(Boolean) });
		if (plan.tight) line.createSpan({ cls: 'tcd-tight', text: s.t('tight') });
		line.createSpan({ text: pace.join(' · ') });
	}
	const allOpen = plan.steps.filter(st => st.state !== 'done');
	const open = allOpen.slice(0, 5);
	if (open.length === 0) return;
	const list = card.createDiv({ cls: 'tcd-steps' });
	for (const st of open) {
		const row = list.createDiv({ cls: ['tcd-step', `is-${st.state}`] });
		row.createSpan({ cls: 'tcd-step-dot' });
		row.createSpan({ cls: 'tcd-step-title', text: st.title });
		row.createSpan({ cls: 'tcd-step-when ap-num', text: s.step(st, o.now) });
		row.setAttrs({ role: 'link', tabindex: '0', 'aria-label': `${st.title}, ${s.step(st, o.now)}` });
		const go = (evt: MouseEvent | KeyboardEvent) => o.open(st.path, evt);
		row.addEventListener('click', go);
		row.addEventListener('keydown', evt => {
			if (evt.key === 'Enter' || evt.key === ' ') {
				evt.preventDefault();
				go(evt);
			}
		});
	}
	if (allOpen.length > open.length) list.createDiv({ cls: 'tcd-steps-more', text: s.more(allOpen.length - open.length) });
}

export function renderSections(parent: HTMLElement, sections: Section[], o: RenderOptions): void {
	for (const section of sections) {
		const wrap = parent.createDiv({ cls: 'ap-section tcd-section' });
		if (section.label) {
			const head = wrap.createDiv({ cls: 'ap-section-title tcd-section-title' });
			head.createSpan({ text: section.label });
			head.createSpan({ cls: 'tcd-count ap-num', text: String(section.items.length) });
		}
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
	const desc = [s.date(item.due.at, item.due.hasTime, o.now)];
	if (item.waitingDays !== undefined) desc.push(s.waiting(item.waitingDays));
	if (item.parentTitle) desc.push(item.parentTitle);
	if (item.plan) {
		const steps = s.stepsShort(item.plan);
		if (steps) desc.push(steps);
	}
	main.createDiv({ cls: 'ap-row-desc', text: desc.join(' · ') });
	const pill = row.createSpan({ cls: ['ap-pill', 'tcd-pill', 'ap-num', TONE_CLASS[tone]].filter(Boolean) });
	if (tone === 'done') {
		setIcon(pill.createSpan({ cls: 'tcd-pill-icon' }), 'check');
		pill.createSpan({ text: typeof item.finishedEarly === 'number' ? s.finished(item.finishedEarly) : s.t('done') });
	} else {
		pill.setText(s.pill(item.countdown));
	}
}

/** Click, Enter or Space opens the task note; Cmd/Ctrl-click opens it in a new tab. */
function link(el: HTMLElement, item: CountdownItem, o: RenderOptions, prefix = ''): void {
	el.setAttrs({ role: 'link', tabindex: '0', 'aria-label': `${prefix ? `${prefix}: ` : ''}${item.title}, ${item.countdown.tone === 'done' ? (typeof item.finishedEarly === 'number' ? o.strings.finished(item.finishedEarly) : o.strings.t('done')) : o.strings.pill(item.countdown)}`, 'data-path': item.path });
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
