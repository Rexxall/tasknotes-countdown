import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countdown, countdownBase, dayDiff, groupByBand, isDone, matchesTags, parseDue, parseTagList, pickHero, taskFilter, upcoming, type CountdownItem } from '../src/core';
import { Strings, langFrom } from '../src/i18n';

const NOW = new Date(2026, 10, 6, 10, 0); // Fri 6 Nov 2026, 10:00 local

function item(title: string, due: string, done = false): CountdownItem {
	const d = parseDue(due)!;
	return { path: `Tasks/${title}.md`, title, due: d, done, countdown: countdown(d, NOW, 7, done) };
}

test('parses TaskNotes date forms and rejects impossible dates', () => {
	assert.deepEqual(parseDue('2026-11-20')?.hasTime, false);
	assert.equal(parseDue('2026-11-20')?.at.getDate(), 20);
	assert.equal(parseDue('2026-11-20T09:30')?.at.getHours(), 9);
	assert.equal(parseDue('2026-11-20 09:30')?.at.getMinutes(), 30);
	assert.equal(parseDue('2026-11-20T00:00:00Z')?.at.getTime(), Date.UTC(2026, 10, 20));
	assert.equal(parseDue('2026-11-20T09:00+0900')?.at.getTime(), Date.UTC(2026, 10, 20, 0));
	assert.equal(parseDue('2026-02-30'), null);
	assert.equal(parseDue('next friday'), null);
	assert.equal(parseDue(undefined), null);
	assert.equal(parseDue(''), null);
});

test('counts calendar days, not 24-hour blocks', () => {
	assert.equal(dayDiff(new Date(2026, 10, 6, 23, 59), new Date(2026, 10, 7, 0, 1)), 1);
	// Across a daylight-saving change the count stays whole.
	assert.equal(dayDiff(new Date(2026, 2, 1), new Date(2026, 3, 1)), 31);
	assert.equal(dayDiff(new Date(2026, 9, 20), new Date(2026, 10, 10)), 21);
});

test('bands and tones', () => {
	assert.deepEqual(pick(item('a', '2026-11-05')), ['overdue', 'danger', -1]);
	assert.deepEqual(pick(item('b', '2026-11-06')), ['today', 'warn', 0]);
	assert.deepEqual(pick(item('c', '2026-11-13')), ['week', 'warn', 7]);
	assert.deepEqual(pick(item('d', '2026-11-14')), ['month', 'normal', 8]);
	assert.deepEqual(pick(item('e', '2026-12-07')), ['later', 'normal', 31]);
	assert.deepEqual(pick(item('f', '2026-11-01', true)), ['overdue', 'done', -5]);
});

test('a time earlier today is overdue; a time later today counts hours', () => {
	assert.equal(item('past', '2026-11-06T09:00').countdown.band, 'overdue');
	const later = item('later', '2026-11-06T15:30').countdown;
	assert.equal(later.band, 'today');
	assert.equal(later.hours, 5);
	// A plain date due today is not overdue yet.
	assert.equal(item('plain', '2026-11-06').countdown.band, 'today');
});

test('done follows the completed statuses TaskNotes reports', () => {
	assert.equal(isDone('done', ['done']), true);
	assert.equal(isDone('Submitted', ['done', 'submitted']), true);
	assert.equal(isDone('open', ['done']), false);
	assert.equal(isDone(undefined, ['done']), false);
});

test('hero is the soonest open item that is not overdue; groups keep band order', () => {
	const items = [item('late', '2026-11-01'), item('soon', '2026-11-08'), item('far', '2027-01-10'), item('today', '2026-11-06')];
	items.sort((a, b) => a.due.at.getTime() - b.due.at.getTime());
	assert.equal(pickHero(items)?.title, 'today');
	assert.deepEqual(groupByBand(items).map(g => g.band), ['overdue', 'today', 'week', 'later']);
	assert.equal(pickHero([item('late', '2026-11-01')]), null);
});

test('tag filter accepts commas, spaces, # and nested tags', () => {
	const wanted = parseTagList('#exam, application  deadline');
	assert.deepEqual(wanted, ['exam', 'application', 'deadline']);
	assert.equal(matchesTags(['task', 'exam/toefl'], wanted), true);
	assert.equal(matchesTags(['task', 'examples'], wanted), false);
	assert.equal(matchesTags(['task'], []), true);
});

test('sidebar list skips done, archived, undated and filtered tasks, soonest first', () => {
	const tasks = [
		{ path: 'T/a.md', title: 'TOEFL', due: '2026-11-21', status: 'open', tags: ['task', 'exam'] },
		{ path: 'T/b.md', title: 'Essay', due: '2026-11-10', status: 'done', tags: ['task', 'exam'] },
		{ path: 'T/c.md', title: 'Old', due: '2026-11-09', status: 'open', archived: true, tags: ['task', 'exam'] },
		{ path: 'T/d.md', title: 'No date', status: 'open', tags: ['task', 'exam'] },
		{ path: 'T/e.md', title: 'Groceries', due: '2026-11-07', status: 'open', tags: ['task'] },
		{ path: 'T/Portfolio.md', due: '2026-11-12', status: 'open', tags: ['task', 'application'] },
	];
	const out = upcoming(tasks, { now: NOW, urgentDays: 7, completed: ['done'], tags: ['exam', 'application'], limit: 5 });
	assert.deepEqual(out.map(i => i.title), ['Portfolio', 'TOEFL']);
	assert.equal(upcoming(tasks, { now: NOW, urgentDays: 7, completed: ['done'], tags: [], limit: 1 }).length, 1);
});

test('labels in three languages', () => {
	const en = new Strings('en'), zh = new Strings('zh'), ja = new Strings('ja');
	const c = (due: string) => item('x', due).countdown;
	assert.equal(en.pill(c('2026-11-07')), 'Tomorrow');
	assert.equal(en.pill(c('2026-11-16')), '10 days');
	assert.equal(en.pill(c('2026-11-05')), '1 day late');
	assert.equal(zh.pill(c('2026-11-03')), '过期 3 天');
	assert.equal(ja.pill(c('2026-11-16')), '10日');
	assert.deepEqual(en.hero(c('2026-11-07')), { value: '1', unit: 'day left' });
	assert.deepEqual(zh.hero(c('2026-11-06T13:00')), { value: '3', unit: '小时' });
	assert.deepEqual(ja.hero(c('2026-11-06')), { value: '今日', unit: '' });
	assert.equal(langFrom('zh-TW'), 'zh');
	assert.equal(langFrom('ja'), 'ja');
	assert.equal(langFrom('de'), 'en');
});

test('starter base follows TaskNotes identification and field names', () => {
	assert.equal(taskFilter(null), 'file.hasTag("task")');
	assert.equal(taskFilter({ taskIdentificationMethod: 'tag', taskTag: 'todo' }), 'file.hasTag("todo")');
	assert.equal(taskFilter({ taskIdentificationMethod: 'property', taskPropertyName: 'type', taskPropertyValue: 'task' }), 'list(note["type"]).contains("task")');
	assert.equal(taskFilter({ taskIdentificationMethod: 'property', taskPropertyName: 'isTask', taskPropertyValue: 'true' }), 'list(note["isTask"]).contains(true)');
	assert.equal(taskFilter({ taskIdentificationMethod: 'property', taskPropertyName: '' }), 'false');
	const yaml = countdownBase('file.hasTag("task")', 'Countdown', 'deadline', 'state');
	assert.match(yaml, /type: tasknotes-countdown/);
	assert.match(yaml, /dateProperty: note\.deadline/);
	assert.match(yaml, /statusProperty: note\.state/);
	assert.match(yaml, /"!note\[\\"deadline\\"\]\.isEmpty\(\)"/);
});

function pick(i: CountdownItem): [string, string, number] {
	return [i.countdown.band, i.countdown.tone, i.countdown.days];
}
