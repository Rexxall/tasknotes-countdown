import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlock } from '../src/core';
import { Strings } from '../src/i18n';
import { isWaiting, linkTarget, nestedPaths, planFor, subtasksOf, trackedMinutes, type PlanOptions, type TaskDetail } from '../src/plan';

const NOW = new Date(2026, 10, 6, 10, 0); // Fri 6 Nov 2026
const OPTS: PlanOptions = { now: NOW, minutesPerDay: 120, bufferDays: 1, completed: ['done'], defaultStatus: 'open', waitingMarker: 'waiting' };
const resolve = (link: string) => `Tasks/${link.replace(/^Tasks\//, '').replace(/\.md$/, '')}.md`;

const parent: TaskDetail = { path: 'Tasks/Application.md', title: 'Application', status: 'open', due: '2026-11-11' };
const kid = (title: string, extra: Partial<TaskDetail>): TaskDetail => ({ path: `Tasks/${title}.md`, title, status: 'open', projects: ['[[Application]]'], ...extra });

test('link targets: wikilinks with alias or heading, markdown links, bare names', () => {
	assert.equal(linkTarget('[[Application]]'), 'Application');
	assert.equal(linkTarget('[[Tasks/Application|My app]]'), 'Tasks/Application');
	assert.equal(linkTarget('[[Application#Notes]]'), 'Application');
	assert.equal(linkTarget('[App](Tasks/My%20App.md)'), 'Tasks/My App.md');
	assert.equal(linkTarget('Application'), 'Application');
});

test('subtasks are tasks that name the parent in projects', () => {
	const tasks = [parent, kid('Essay', {}), { path: 'Tasks/Other.md', projects: ['[[Elsewhere]]'] }];
	assert.deepEqual(subtasksOf(parent.path, tasks, resolve).map(t => t.title), ['Essay']);
});

test('tracked time from the total or from entries', () => {
	assert.equal(trackedMinutes({ path: 'a', totalTrackedTime: 30 }), 30);
	assert.equal(trackedMinutes({ path: 'a', timeEntries: [{ startTime: '2026-11-05T09:00:00Z', endTime: '2026-11-05T09:45:00Z' }, { duration: 15 }] }), 60);
});

test('waiting is a context, tag or status', () => {
	assert.equal(isWaiting({ path: 'a', contexts: ['@waiting'] }, 'waiting'), true);
	assert.equal(isWaiting({ path: 'a', tags: ['waiting'] }, '#waiting'), true);
	assert.equal(isWaiting({ path: 'a', status: 'Waiting' }, 'waiting'), true);
	assert.equal(isWaiting({ path: 'a', contexts: ['home'] }, 'waiting'), false);
	assert.equal(isWaiting({ path: 'a', contexts: ['waiting'] }, ''), false);
});

test('plan: work left, pace, and when each step must start', () => {
	const steps = [
		kid('Essay', { due: '2026-11-09', timeEstimate: 360, totalTrackedTime: 120 }), // started: 240 min left
		kid('Upload', { due: '2026-11-10', timeEstimate: 60 }), // start by Nov 9 (10 − 1 buffer)
		kid('Fee', { due: '2026-11-07', timeEstimate: 15 }), // start by Nov 6 → today
		kid('Translate', { due: '2026-11-06', timeEstimate: 240 }), // needs 2 days → start by Nov 4 → late
		kid('Letter', { contexts: ['waiting'], dateModified: '2026-11-01T08:00:00' }),
		kid('Photo', { status: 'done', timeEstimate: 30 }),
	];
	const plan = planFor(parent, steps, OPTS)!;
	assert.equal(plan.openSteps, 5);
	assert.equal(plan.doneSteps, 1);
	assert.equal(plan.remainingMinutes, 240 + 60 + 15 + 240);
	// Nov 6–11 inclusive is 6 days.
	assert.equal(plan.minutesPerDay, Math.ceil(555 / 6));
	assert.equal(plan.tight, false);
	assert.deepEqual(plan.steps.map(s => `${s.title}:${s.state}`), ['Translate:late', 'Fee:start-now', 'Letter:waiting', 'Essay:started', 'Upload:later', 'Photo:done']);
	assert.equal(plan.steps.find(s => s.title === 'Letter')?.waitingDays, 5);
	assert.equal(plan.steps.find(s => s.title === 'Upload')?.startBy?.getDate(), 9);
});

test('plan is tight when the pace beats the hours a day', () => {
	const plan = planFor({ ...parent, due: '2026-11-07' }, [kid('Essay', { timeEstimate: 600 })], OPTS)!;
	assert.equal(plan.tight, true);
});

test('no subtasks and no estimate: no plan; an estimate alone gives a pace', () => {
	assert.equal(planFor(parent, [], OPTS), null);
	const solo = planFor({ ...parent, timeEstimate: 300, totalTrackedTime: 60 }, [], OPTS)!;
	assert.equal(solo.remainingMinutes, 240);
	assert.equal(solo.openSteps, 0);
});

test('subtasks fold into a parent that is listed too', () => {
	const tasks = [parent, kid('Essay', {}), kid('Upload', {})];
	assert.deepEqual([...nestedPaths(new Set([parent.path, 'Tasks/Essay.md']), tasks, resolve)], ['Tasks/Essay.md']);
	assert.equal(nestedPaths(new Set(['Tasks/Essay.md']), tasks, resolve).size, 0);
});

test('pace text in three languages', () => {
	const plan = { steps: [], doneSteps: 1, openSteps: 3, remainingMinutes: 270, minutesPerDay: 45, tight: false };
	assert.deepEqual(new Strings('en').pace(plan), ['3 of 4 steps left', 'about 4.5 h', '45 min a day']);
	assert.deepEqual(new Strings('zh').pace(plan), ['还剩 3 步，共 4 步', '约 4.5 小时', '每天 45 分钟']);
	assert.deepEqual(new Strings('ja').pace(plan), ['残り3ステップ（全4）', '約4.5時間', '1日45分']);
});

test('note block options', () => {
	assert.deepEqual(parseBlock('limit: 2\ntags: #exam, application'), { limit: 2, tags: ['exam', 'application'] });
	assert.deepEqual(parseBlock(''), { limit: null, tags: null });
	assert.deepEqual(parseBlock('limit: -1'), { limit: null, tags: null });
});
