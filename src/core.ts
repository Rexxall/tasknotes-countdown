// Pure date logic. No Obsidian imports, so the tests can run in Node.
import type { Plan } from './plan';

export const MS_HOUR = 60 * 60 * 1000;
export const MS_DAY = 24 * MS_HOUR;

export type Tone = 'normal' | 'warn' | 'danger' | 'done';
export type Band = 'overdue' | 'today' | 'week' | 'month' | 'later';
export const BANDS: Band[] = ['overdue', 'today', 'week', 'month', 'later'];

export interface DueDate {
	/** Local midnight for a plain date, the exact moment for a date with a time. */
	at: Date;
	hasTime: boolean;
}

export interface Countdown {
	/** Calendar days from today to the due day; negative when overdue. */
	days: number;
	/** Whole hours left, only for a date with a time that falls today. */
	hours: number | null;
	band: Band;
	tone: Tone;
}

export interface CountdownItem {
	path: string;
	title: string;
	due: DueDate;
	done: boolean;
	countdown: Countdown;
	/** Steps, work left and pace, when TaskNotes has subtasks or an estimate for this task. */
	plan?: Plan | null;
	/** Days spent waiting on someone else, for tasks marked as waiting. */
	waitingDays?: number | null;
	/** Title of the deadline this task belongs to, shown in the waiting list. */
	parentTitle?: string;
	/** Share of the time from start to deadline already gone, 0–1. */
	elapsed?: number | null;
	/** For finished tasks: days before the due date (negative when late). */
	finishedEarly?: number | null;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Reads TaskNotes dates: 2026-11-20, 2026-11-20T09:30, 2026-11-20 09:30, with an optional offset. */
export function parseDue(raw: unknown): DueDate | null {
	if (raw instanceof Date) return isNaN(raw.getTime()) ? null : { at: raw, hasTime: true };
	if (typeof raw !== 'string') return null;
	const m = DATE_RE.exec(raw.trim());
	if (!m) return null;
	const [, y, mo, d, h, mi, s, zone] = m;
	const year = Number(y), month = Number(mo) - 1, day = Number(d);
	const check = new Date(year, month, day);
	if (check.getFullYear() !== year || check.getMonth() !== month || check.getDate() !== day) return null;
	if (h === undefined) return { at: check, hasTime: false };
	if (zone) {
		const iso = `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}${zone === 'Z' ? 'Z' : zone.length === 5 ? `${zone.slice(0, 3)}:${zone.slice(3)}` : zone}`;
		const at = new Date(iso);
		return isNaN(at.getTime()) ? null : { at, hasTime: true };
	}
	return { at: new Date(year, month, day, Number(h), Number(mi), Number(s ?? 0)), hasTime: true };
}

/** Calendar days between two local dates, safe across daylight-saving changes. */
export function dayDiff(from: Date, to: Date): number {
	const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
	const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
	return Math.round((b - a) / MS_DAY);
}

export function countdown(due: DueDate, now: Date, urgentDays: number, done = false): Countdown {
	const days = dayDiff(now, due.at);
	const late = due.hasTime ? due.at.getTime() < now.getTime() : days < 0;
	let hours: number | null = null;
	if (due.hasTime && days === 0 && !late) hours = Math.max(0, Math.floor((due.at.getTime() - now.getTime()) / MS_HOUR));
	const band: Band = late ? 'overdue' : days === 0 ? 'today' : days <= 7 ? 'week' : days <= 30 ? 'month' : 'later';
	const tone: Tone = done ? 'done' : late ? 'danger' : days <= urgentDays ? 'warn' : 'normal';
	return { days, hours, band, tone };
}

/** Completed statuses from TaskNotes when it is there; "done" otherwise. */
export function isDone(status: unknown, completed: readonly string[]): boolean {
	if (typeof status !== 'string') return false;
	const s = status.trim().toLowerCase();
	return completed.some(c => c.toLowerCase() === s);
}

/** Overdue first (oldest first), then soonest first; ties by title. */
export function compareItems(a: CountdownItem, b: CountdownItem): number {
	return a.due.at.getTime() - b.due.at.getTime() || a.title.localeCompare(b.title);
}

export function groupByBand(items: CountdownItem[]): Array<{ band: Band; items: CountdownItem[] }> {
	return BANDS.map(band => ({ band, items: items.filter(i => i.countdown.band === band) })).filter(g => g.items.length > 0);
}

/** The one item worth a big number: the soonest that is not overdue and not done. */
export function pickHero(items: CountdownItem[]): CountdownItem | null {
	return items.find(i => !i.done && i.countdown.band !== 'overdue') ?? null;
}

/** Splits "exam, application #deadline" into tag names without '#'. */
export function parseTagList(value: string): string[] {
	return value.split(/[,\s]+/).map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);
}

/** True when no filter is set, or one of the task's tags (or a parent tag) matches. */
export function matchesTags(tags: readonly string[] | undefined, wanted: readonly string[]): boolean {
	if (wanted.length === 0) return true;
	const own = (tags ?? []).map(t => t.replace(/^#/, '').toLowerCase());
	return own.some(t => wanted.some(w => t === w || t.startsWith(`${w}/`)));
}

export interface TaskLike {
	path: string;
	title?: string;
	status?: string;
	due?: string;
	archived?: boolean;
	tags?: string[];
}

/** What the sidebar card shows: open, unarchived tasks with a due date, soonest first. */
export function upcoming(tasks: readonly TaskLike[], opts: { now: Date; urgentDays: number; completed: readonly string[]; tags: readonly string[]; limit: number }): CountdownItem[] {
	const out: CountdownItem[] = [];
	for (const t of tasks) {
		if (t.archived || isDone(t.status, opts.completed) || !matchesTags(t.tags, opts.tags)) continue;
		const due = parseDue(t.due);
		if (!due) continue;
		out.push({ path: t.path, title: t.title?.trim() || basename(t.path), due, done: false, countdown: countdown(due, opts.now, opts.urgentDays) });
	}
	return out.sort(compareItems).slice(0, Math.max(1, opts.limit));
}

export function basename(path: string): string {
	const name = path.split('/').pop() ?? path;
	return name.replace(/\.md$/i, '');
}

/** Folder of a vault path ("" for the root). */
export function dirname(path: string): string {
	const i = path.lastIndexOf('/');
	return i < 0 ? '' : path.slice(0, i);
}

/** YAML for a starter .base that shows TaskNotes tasks in the countdown view, using TaskNotes' field names. */
export function countdownBase(filter: string, viewName: string, dueKey = 'due', statusKey = 'status'): string {
	const due = safeKey(dueKey) || 'due';
	const status = safeKey(statusKey) || 'status';
	return [
		'filters:',
		'  and:',
		`    - ${JSON.stringify(filter)}`,
		`    - ${JSON.stringify(`!note["${due}"].isEmpty()`)}`,
		'views:',
		'  - type: tasknotes-countdown',
		`    name: ${JSON.stringify(viewName)}`,
		'    order:',
		'      - file.name',
		`      - note.${due}`,
		'    sort:',
		`      - property: note.${due}`,
		'        direction: ASC',
		`    dateProperty: note.${due}`,
		`    statusProperty: note.${status}`,
		'',
	].join('\n');
}

function safeKey(key: string): string {
	return key.replace(/[^\p{L}\p{N}_-]/gu, '');
}

/** The Bases filter that selects TaskNotes tasks, following its identification setting. */
export function taskFilter(snapshot: { taskIdentificationMethod?: string; taskTag?: string; taskPropertyName?: string; taskPropertyValue?: string } | null | undefined): string {
	// Mirrors TaskNotes' own generateTaskFilterCondition (src/templates/defaultBasesFiles.ts).
	if (snapshot?.taskIdentificationMethod === 'property') {
		const name = snapshot.taskPropertyName?.trim();
		if (!name) return 'false';
		const value = snapshot.taskPropertyValue?.trim();
		if (!value) return `file.hasProperty(${JSON.stringify(name)})`;
		if (name.toLowerCase() === 'tags') return `file.hasTag(${JSON.stringify(value)})`;
		const lower = value.toLowerCase();
		const ref = `note[${JSON.stringify(name)}]`;
		return lower === 'true' || lower === 'false' ? `list(${ref}).contains(${lower})` : `list(${ref}).contains(${JSON.stringify(value)})`;
	}
	return `file.hasTag(${JSON.stringify(snapshot?.taskTag || 'task')})`;
}

/**
 * ```tasknotes-countdown
 * limit: 3
 * tags: exam, application
 * ```
 * A few lines in a daily note: the nearest deadlines with their pace. Every line is optional.
 */
export function parseBlock(source: string): { limit: number | null; tags: string[] | null } {
	let limit: number | null = null;
	let tags: string[] | null = null;
	for (const line of source.split('\n')) {
		const m = /^\s*(\w+)\s*:\s*(.*)$/.exec(line);
		if (!m) continue;
		const key = m[1].toLowerCase();
		if (key === 'limit') {
			const n = Number(m[2]);
			if (Number.isInteger(n) && n > 0) limit = Math.min(n, 20);
		} else if (key === 'tags') {
			tags = parseTagList(m[2]);
		}
	}
	return { limit, tags };
}
