import type { App } from 'obsidian';
import { basename, countdown, isDone, matchesTags, parseDue, type CountdownItem } from './core';
import { isWaiting, linkTarget, nestedPaths, planFor, waitingDaysOf, type PlanOptions, type Resolver, type TaskDetail } from './plan';

/**
 * One read of TaskNotes' tasks, shared by every view. Rebuilt after TaskNotes reports a change,
 * never on a timer, so opening more views costs nothing extra.
 */
export class TaskIndex {
	tasks: TaskDetail[] = [];
	loaded = false;
	private byPath = new Map<string, TaskDetail>();
	private children = new Map<string, TaskDetail[]>();
	private parentOf = new Map<string, string>();

	constructor(private app: App) {}

	readonly resolve: Resolver = (link, from) => this.app.metadataCache.getFirstLinkpathDest(link, from)?.path ?? (this.byPath.has(link) ? link : null);

	set(tasks: TaskDetail[]): void {
		this.tasks = tasks;
		this.byPath = new Map(tasks.map(t => [t.path, t]));
		this.children.clear();
		this.parentOf.clear();
		for (const t of tasks) {
			for (const p of t.projects ?? []) {
				const parent = this.resolve(linkTarget(p), t.path);
				if (!parent || parent === t.path || !this.byPath.has(parent)) continue;
				if (!this.children.has(parent)) this.children.set(parent, []);
				this.children.get(parent)!.push(t);
				if (!this.parentOf.has(t.path)) this.parentOf.set(t.path, parent);
			}
		}
		this.loaded = true;
	}

	get(path: string): TaskDetail | undefined {
		return this.byPath.get(path);
	}

	subtasks(path: string): TaskDetail[] {
		return this.children.get(path) ?? [];
	}

	parent(path: string): TaskDetail | undefined {
		const p = this.parentOf.get(path);
		return p ? this.byPath.get(p) : undefined;
	}
}

export interface Arranged {
	/** Deadlines to count down, soonest first; subtasks of a listed deadline are folded into it. */
	main: CountdownItem[];
	/** Open tasks marked as waiting on someone else, longest wait first. */
	waiting: CountdownItem[];
}

/** Adds plans and waiting days from the index, folds subtasks into their parent, and pulls out waiting tasks. */
export function arrange(items: CountdownItem[], index: TaskIndex, plan: PlanOptions): Arranged {
	if (!index.loaded) return { main: items, waiting: [] };
	for (const item of items) {
		const task = index.get(item.path);
		if (!task) continue;
		if (!item.done) item.plan = planFor(task, index.subtasks(item.path), plan);
		if (!item.done && isWaiting(task, plan.waitingMarker)) {
			item.waitingDays = waitingDaysOf(task, plan.now);
			const parent = index.parent(item.path);
			if (parent) item.parentTitle = parent.title?.trim() || basename(parent.path);
		}
	}
	const nested = nestedPaths(new Set(items.map(i => i.path)), index.tasks, index.resolve);
	const waiting = items.filter(i => i.waitingDays !== undefined).sort((a, b) => (b.waitingDays ?? 0) - (a.waitingDays ?? 0));
	const main = items.filter(i => i.waitingDays === undefined && !nested.has(i.path));
	return { main, waiting };
}

/** Sidebar, status bar and note blocks: open tasks with a due date, filtered by tag (a subtask passes through its parent). */
export function sidebarItems(index: TaskIndex, o: { now: Date; urgentDays: number; completed: readonly string[]; tags: readonly string[] }): CountdownItem[] {
	const out: CountdownItem[] = [];
	for (const t of index.tasks) {
		if (t.archived || isDone(t.status, o.completed)) continue;
		const parent = index.parent(t.path);
		if (!matchesTags(t.tags, o.tags) && !(parent && matchesTags(parent.tags, o.tags))) continue;
		const due = parseDue(t.due) ?? (parent ? parseDue(parent.due) : null);
		if (!due) continue;
		out.push({ path: t.path, title: t.title?.trim() || basename(t.path), due, done: false, countdown: countdown(due, o.now, o.urgentDays) });
	}
	return out.sort((a, b) => a.due.at.getTime() - b.due.at.getTime() || a.title.localeCompare(b.title));
}
