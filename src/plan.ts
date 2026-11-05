// "Can I make it?" — the part a plain countdown cannot do, because it needs TaskNotes'
// subtasks, time estimates, tracked time and statuses. Pure logic, no Obsidian imports.
import { dayDiff, isDone, parseDue, type TaskLike } from './core';

export interface PlanOptions {
	now: Date;
	/** Minutes a day the user can give to deadlines. */
	minutesPerDay: number;
	/** Days kept free before each step's due date. */
	bufferDays: number;
	completed: readonly string[];
	/** Status TaskNotes gives new tasks; anything else counts as started. */
	defaultStatus: string;
	/** Context, tag or status that marks "waiting on someone else". */
	waitingMarker: string;
}

export type StepState = 'done' | 'waiting' | 'started' | 'start-now' | 'late' | 'later';

export interface Step {
	path: string;
	title: string;
	state: StepState;
	/** Latest day to start and still finish before the step's (or parent's) due date. */
	startBy: Date | null;
	/** Whole days this step has been waiting, for waiting steps. */
	waitingDays: number | null;
	remainingMinutes: number;
}

export interface Plan {
	steps: Step[];
	doneSteps: number;
	openSteps: number;
	/** Work left: open steps' estimates minus time already tracked. 0 when nothing is estimated. */
	remainingMinutes: number;
	/** remainingMinutes spread over the days left (today counts as one day). */
	minutesPerDay: number;
	/** More work a day than the user said they can give. */
	tight: boolean;
}

export interface TaskDetail extends TaskLike {
	projects?: string[];
	contexts?: string[];
	timeEstimate?: number;
	totalTrackedTime?: number;
	timeEntries?: Array<{ startTime?: string; endTime?: string; duration?: number }>;
	dateCreated?: string;
	dateModified?: string;
	scheduled?: string;
	completedDate?: string;
}

/** "[[Folder/Note|alias]]", "[alias](Folder/Note.md)" or a bare name → the link target without alias or heading. */
export function linkTarget(raw: string): string {
	const s = raw.trim();
	const wiki = /^!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/.exec(s);
	if (wiki) return wiki[1].trim();
	const md = /^\[[^\]]*\]\(([^)#]+)(?:#[^)]*)?\)$/.exec(s);
	if (md) return decodeURIComponent(md[1].trim()).replace(/^<|>$/g, '');
	return s;
}

export type Resolver = (link: string, fromPath: string) => string | null;

/** Tasks that name `parentPath` in their projects — how TaskNotes links a subtask to its parent. */
export function subtasksOf(parentPath: string, tasks: readonly TaskDetail[], resolve: Resolver): TaskDetail[] {
	return tasks.filter(t => t.path !== parentPath && (t.projects ?? []).some(p => resolve(linkTarget(p), t.path) === parentPath));
}

export function trackedMinutes(t: TaskDetail): number {
	if (typeof t.totalTrackedTime === 'number' && t.totalTrackedTime > 0) return t.totalTrackedTime;
	let sum = 0;
	for (const e of t.timeEntries ?? []) {
		if (typeof e.duration === 'number') sum += e.duration;
		else if (e.startTime && e.endTime) sum += Math.max(0, (Date.parse(e.endTime) - Date.parse(e.startTime)) / 60000);
	}
	return Math.round(sum);
}

export function remainingOf(t: TaskDetail): number {
	const est = typeof t.timeEstimate === 'number' && t.timeEstimate > 0 ? t.timeEstimate : 0;
	return Math.max(0, est - trackedMinutes(t));
}

export function isWaiting(t: TaskDetail, marker: string): boolean {
	const m = marker.trim().replace(/^[@#]/, '').toLowerCase();
	if (!m) return false;
	const norm = (v: string) => v.replace(/^[@#]/, '').toLowerCase();
	return (t.contexts ?? []).some(c => norm(c) === m) || (t.tags ?? []).some(c => norm(c) === m) || (t.status ?? '').toLowerCase() === m;
}

/** Whole days since the task last changed (or was created), never negative. */
export function waitingDaysOf(t: TaskDetail, now: Date): number | null {
	const since = parseDue(t.dateModified ?? '') ?? parseDue(t.dateCreated ?? '');
	return since ? Math.max(0, dayDiff(since.at, now)) : null;
}

/**
 * The plan under one deadline. Each open step gets a latest start day: its own due date
 * (or the parent's) minus the buffer, minus the days its remaining work needs at minutesPerDay.
 */
export function planFor(parent: TaskDetail, subtasks: readonly TaskDetail[], o: PlanOptions): Plan | null {
	const parentDue = parseDue(parent.due);
	const kids = subtasks.filter(t => !t.archived);
	const today = startOfDay(o.now);
	const daysLeft = parentDue ? Math.max(1, dayDiff(o.now, parentDue.at) + (parentDue.hasTime ? 0 : 1)) : 1;

	if (kids.length === 0) {
		const remaining = remainingOf(parent);
		if (remaining === 0) return null;
		const perDay = Math.ceil(remaining / daysLeft);
		return { steps: [], doneSteps: 0, openSteps: 0, remainingMinutes: remaining, minutesPerDay: perDay, tight: perDay > o.minutesPerDay };
	}

	const steps: Step[] = kids.map(t => {
		const done = isDone(t.status, o.completed);
		const remaining = done ? 0 : remainingOf(t);
		const due = parseDue(t.due) ?? parentDue;
		let startBy: Date | null = null;
		if (!done && due) {
			const workDays = remaining > 0 ? Math.ceil(remaining / Math.max(1, o.minutesPerDay)) : 1;
			startBy = new Date(due.at.getFullYear(), due.at.getMonth(), due.at.getDate() - o.bufferDays - (workDays - 1));
		}
		const waiting = !done && isWaiting(t, o.waitingMarker);
		const started = trackedMinutes(t) > 0 || (!!t.status && t.status.toLowerCase() !== o.defaultStatus.toLowerCase());
		let state: StepState;
		if (done) state = 'done';
		else if (waiting) state = 'waiting';
		else if (started) state = 'started';
		else if (startBy && startBy.getTime() < today.getTime()) state = 'late';
		else if (startBy && startBy.getTime() === today.getTime()) state = 'start-now';
		else state = 'later';
		return { path: t.path, title: t.title?.trim() || t.path.replace(/^.*\//, '').replace(/\.md$/i, ''), state, startBy, waitingDays: waiting ? waitingDaysOf(t, o.now) : null, remainingMinutes: remaining };
	});

	const order: Record<StepState, number> = { late: 0, 'start-now': 1, waiting: 2, started: 3, later: 4, done: 5 };
	steps.sort((a, b) => order[a.state] - order[b.state] || (a.startBy?.getTime() ?? Infinity) - (b.startBy?.getTime() ?? Infinity) || a.title.localeCompare(b.title));
	const remaining = steps.reduce((n, s) => n + s.remainingMinutes, 0);
	const perDay = Math.ceil(remaining / daysLeft);
	return {
		steps,
		doneSteps: steps.filter(s => s.state === 'done').length,
		openSteps: steps.filter(s => s.state !== 'done').length,
		remainingMinutes: remaining,
		minutesPerDay: perDay,
		tight: remaining > 0 && perDay > o.minutesPerDay,
	};
}

/** Paths of tasks whose parent is also in the list: they show inside the parent's card, not as rows of their own. */
export function nestedPaths(paths: ReadonlySet<string>, tasks: readonly TaskDetail[], resolve: Resolver): Set<string> {
	const out = new Set<string>();
	for (const t of tasks) {
		if (!paths.has(t.path)) continue;
		if ((t.projects ?? []).some(p => {
			const parent = resolve(linkTarget(p), t.path);
			return !!parent && parent !== t.path && paths.has(parent);
		})) out.add(t.path);
	}
	return out;
}

function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}


/**
 * How much of the time from start to deadline has gone, 0–1. Start is the scheduled date when it
 * falls before the deadline, otherwise the creation date. Null when either end is missing.
 */
export function elapsedFraction(t: TaskDetail, now: Date): number | null {
	const due = parseDue(t.due);
	if (!due) return null;
	const scheduled = parseDue(t.scheduled);
	const created = parseDue(t.dateCreated);
	const start = scheduled && scheduled.at.getTime() < due.at.getTime() ? scheduled : created;
	if (!start) return null;
	const end = due.hasTime ? due.at.getTime() : new Date(due.at.getFullYear(), due.at.getMonth(), due.at.getDate() + 1).getTime();
	const span = end - start.at.getTime();
	if (span <= 0) return null;
	return Math.min(1, Math.max(0, (now.getTime() - start.at.getTime()) / span));
}

/** Days finished before the due date: positive is early, 0 on the day, negative late. Null without both dates. */
export function finishOffset(t: TaskDetail): number | null {
	const due = parseDue(t.due);
	const done = parseDue(t.completedDate);
	return due && done ? dayDiff(done.at, due.at) : null;
}
