import type { App, EventRef } from 'obsidian';
import type { TaskLike } from './core';

// The slice of the TaskNotes runtime API (src/api/runtime-api.ts, apiVersion 1) this plugin reads.
// Read-only on purpose: nothing here writes to a task.
export interface TaskNotesApi {
	apiVersion: number;
	hasCapability(capability: string): boolean;
	tasks: { list(): Promise<TaskLike[]> };
	catalog: { statuses(): Array<{ value: string; isCompleted?: boolean }> };
	settings?: { snapshot(): Readonly<Record<string, unknown>> };
	events: { on(event: string, handler: (payload: unknown) => void): EventRef; off(ref: EventRef): void };
	lifecycle?: { ready(): Promise<void>; on(event: string, handler: (payload: unknown) => void): EventRef; off(ref: EventRef): void };
}

export const REQUIRED = ['tasks.read', 'catalog.read', 'tasks.events'] as const;

/** Task changes that can move a deadline in or out of the list. */
export const TASK_EVENTS = [
	'task.created', 'task.deleted', 'task.moved', 'task.status.changed', 'task.due.changed',
	'task.archived', 'task.unarchived', 'task.tags.changed', 'task.updated',
] as const;

export type Access = { state: 'ready'; api: TaskNotesApi } | { state: 'off' } | { state: 'old' };

interface PluginRegistry {
	getPlugin(id: string): { api?: unknown } | null;
}

/** Finds the TaskNotes runtime API and checks it is version 1 with what we need. */
export function access(app: App): Access {
	const registry = (app as unknown as { plugins?: PluginRegistry }).plugins;
	const api = registry?.getPlugin('tasknotes')?.api as TaskNotesApi | undefined;
	if (!api) return { state: 'off' };
	if (api.apiVersion !== 1 || typeof api.hasCapability !== 'function') return { state: 'old' };
	return REQUIRED.every(c => api.hasCapability(c)) ? { state: 'ready', api } : { state: 'old' };
}

export function completedStatuses(api: TaskNotesApi | null): string[] {
	const fromCatalog = api?.catalog.statuses().filter(s => s.isCompleted).map(s => s.value) ?? [];
	return fromCatalog.length ? fromCatalog : ['done'];
}

export function settingsSnapshot(api: TaskNotesApi | null): Record<string, unknown> | null {
	return api?.hasCapability('settings.snapshot') && api.settings ? api.settings.snapshot() : null;
}

/** Folder TaskNotes keeps its .base files in, from its "Open tasks view" mapping. */
export function viewsFolder(snapshot: Record<string, unknown> | null): string {
	const mapping = snapshot?.commandFileMapping as Record<string, unknown> | undefined;
	const tasksView = mapping?.['open-tasks-view'];
	if (typeof tasksView === 'string' && tasksView.includes('/')) return tasksView.slice(0, tasksView.lastIndexOf('/'));
	return 'TaskNotes/Views';
}
