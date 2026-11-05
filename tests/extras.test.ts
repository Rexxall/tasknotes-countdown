import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { App } from 'obsidian';
import { Strings } from '../src/i18n';
import { TaskIndex, recentlyFinished } from '../src/model';
import { elapsedFraction, finishOffset } from '../src/plan';
import { wrapLines } from '../src/share';

const NOW = new Date(2026, 10, 6, 12, 0); // Fri 6 Nov 2026, noon

test('time gone runs from scheduled (or created) to the end of the due day', () => {
	// Created Nov 1, due Nov 10 (ends Nov 11 00:00): 10 days, 5.5 gone.
	assert.equal(elapsedFraction({ path: 'a', dateCreated: '2026-11-01T00:00:00', due: '2026-11-10' }, NOW), 0.55);
	// A scheduled date before the due date wins over the creation date.
	assert.equal(elapsedFraction({ path: 'a', dateCreated: '2026-10-01T00:00:00', scheduled: '2026-11-05', due: '2026-11-06' }, NOW), 0.75);
	// Clamped, and nothing without a start.
	assert.equal(elapsedFraction({ path: 'a', dateCreated: '2026-10-01T00:00:00', due: '2026-11-01' }, NOW), 1);
	assert.equal(elapsedFraction({ path: 'a', due: '2026-11-10' }, NOW), null);
});

test('finished early, on the day, late', () => {
	assert.equal(finishOffset({ path: 'a', due: '2026-11-10', completedDate: '2026-11-07' }), 3);
	assert.equal(finishOffset({ path: 'a', due: '2026-11-10', completedDate: '2026-11-10' }), 0);
	assert.equal(finishOffset({ path: 'a', due: '2026-11-10', completedDate: '2026-11-12' }), -2);
	assert.equal(finishOffset({ path: 'a', due: '2026-11-10' }), null);
	const en = new Strings('en'), zh = new Strings('zh'), ja = new Strings('ja');
	assert.equal(en.finished(3), '3 days early');
	assert.equal(en.finished(0), 'On the day');
	assert.equal(zh.finished(-2), '晚 2 天');
	assert.equal(ja.finished(1), '1日前に完了');
	assert.equal(zh.elapsed(0.62), '时间已过 62%');
});

test('just finished: recent, tagged, and not a step of an open deadline', () => {
	const app = { metadataCache: { getFirstLinkpathDest: (link: string) => ({ path: `T/${link}.md` }) } } as unknown as App;
	const index = new TaskIndex(app);
	index.set([
		{ path: 'T/IELTS.md', title: 'IELTS', status: 'done', due: '2026-11-08', completedDate: '2026-11-05', tags: ['exam'] },
		{ path: 'T/Old.md', title: 'Old', status: 'done', due: '2026-10-01', completedDate: '2026-10-01', tags: ['exam'] },
		{ path: 'T/App.md', title: 'App', status: 'open', due: '2026-11-20', tags: ['application'] },
		{ path: 'T/Fee.md', title: 'Fee', status: 'done', due: '2026-11-06', completedDate: '2026-11-06', projects: ['[[App]]'], tags: ['application'] },
		{ path: 'T/Ink.md', title: 'Ink', status: 'done', due: '2026-11-06', completedDate: '2026-11-06', tags: [] },
	]);
	const out = recentlyFinished(index, { now: NOW, completed: ['done'], tags: ['exam', 'application'], days: 3 });
	assert.deepEqual(out.map(i => `${i.title}:${i.finishedEarly}`), ['IELTS:3']);
});

test('card text wraps by words and by CJK characters, with an ellipsis when cut', () => {
	const measure = (s: string) => s.length * 10;
	assert.deepEqual(wrapLines(measure, 'Graduate application Tokyo', 120, 3), ['Graduate', 'application', 'Tokyo']);
	assert.deepEqual(wrapLines(measure, '提交研究计划书和推荐信', 50, 2), ['提交研究计', '划书和推…']);
	assert.deepEqual(wrapLines(measure, 'Short', 200, 2), ['Short']);
});
