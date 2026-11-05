import type { Band, Countdown } from './core';

export type Lang = 'en' | 'zh' | 'ja';

/** Follows Settings → General → Language: Chinese, Japanese, otherwise English. */
export function langFrom(code: string): Lang {
	const c = code.toLowerCase();
	return c.startsWith('zh') ? 'zh' : c.startsWith('ja') ? 'ja' : 'en';
}

type Text = Record<Lang, string>;
const T = {
	viewName: { en: 'Countdown', zh: '倒计时', ja: 'カウントダウン' },
	sidebarTitle: { en: 'Next deadlines', zh: '最近截止', ja: '次の締め切り' },
	nextUp: { en: 'Next up', zh: '下一件', ja: '次はこれ' },
	after: { en: 'After that', zh: '接下来', ja: 'その次' },
	today: { en: 'Today', zh: '今天', ja: '今日' },
	tomorrow: { en: 'Tomorrow', zh: '明天', ja: '明日' },
	overdue: { en: 'Overdue', zh: '已过期', ja: '期限切れ' },
	done: { en: 'Done', zh: '已完成', ja: '完了' },
	due: { en: 'Due', zh: '截止', ja: '締め切り' },
	emptyTitle: { en: 'Nothing due', zh: '没有待截止的任务', ja: '締め切りのあるタスクはありません' },
	emptyText: { en: 'Give a task a due date and it shows up here.', zh: '给任务填上截止日，就会出现在这里。', ja: 'タスクに締め切り日を入れると、ここに表示されます。' },
	emptyFiltered: { en: 'No open task with these tags has a due date. Change the tags in settings.', zh: '带这些标签的未完成任务都没有截止日。可以在设置里换标签。', ja: 'このタグの未完了タスクに締め切りがありません。設定でタグを変えられます。' },
	offTitle: { en: 'TaskNotes is off', zh: 'TaskNotes 未启用', ja: 'TaskNotes が無効です' },
	offText: { en: 'Turn on TaskNotes in community plugins to see your deadlines here.', zh: '在第三方插件里启用 TaskNotes，截止日就会出现在这里。', ja: 'コミュニティプラグインで TaskNotes を有効にすると、ここに締め切りが表示されます。' },
	oldTitle: { en: 'TaskNotes needs an update', zh: 'TaskNotes 需要更新', ja: 'TaskNotes の更新が必要です' },
	oldText: { en: 'This view reads tasks through the TaskNotes 4 API. Update TaskNotes, then reopen this panel.', zh: '这个面板通过 TaskNotes 4 的接口读取任务。请更新 TaskNotes 后重新打开。', ja: 'このパネルは TaskNotes 4 の API でタスクを読みます。TaskNotes を更新してから開き直してください。' },
	openBase: { en: 'Open countdown base', zh: '打开倒计时视图', ja: 'カウントダウンのベースを開く' },
	cmdOpen: { en: 'Open next deadlines', zh: '打开最近截止', ja: '次の締め切りを開く' },
	cmdBase: { en: 'Create or open countdown base', zh: '新建或打开倒计时视图', ja: 'カウントダウンのベースを作成または開く' },
	optDate: { en: 'Date property', zh: '日期属性', ja: '日付プロパティ' },
	optStatus: { en: 'Status property', zh: '状态属性', ja: 'ステータスプロパティ' },
	optUrgent: { en: 'Highlight within days', zh: '几天内标为紧急', ja: '何日前から強調' },
	optDone: { en: 'Show completed', zh: '显示已完成', ja: '完了済みを表示' },
	setTags: { en: 'Only these tags', zh: '只看这些标签', ja: 'このタグだけ' },
	setTagsDesc: { en: 'For the sidebar card. Separate with commas, for example exam, application. Leave empty for every task.', zh: '用于侧栏卡片。用逗号分隔，例如 exam, application。留空则显示全部任务。', ja: 'サイドバー用。カンマ区切り、例：exam, application。空欄ならすべてのタスク。' },
	setLimit: { en: 'Tasks in the sidebar', zh: '侧栏显示几件', ja: 'サイドバーの件数' },
	setUrgent: { en: 'Highlight within days', zh: '几天内标为紧急', ja: '何日前から強調' },
	setUrgentDesc: { en: 'Deadlines this close turn orange. Bases views have their own setting.', zh: '离截止这么近的显示为橙色。Bases 视图在视图选项里单独设置。', ja: 'この日数以内はオレンジで表示。Bases ビューはビューの設定で個別に変えられます。' },
	wholeNumber: { en: 'Enter a whole number from 0 to 60.', zh: '请输入 0 到 60 的整数。', ja: '0〜60 の整数を入力してください。' },
	groupNoDate: { en: 'No date', zh: '无日期', ja: '日付なし' },
} satisfies Record<string, Text>;

export type Key = keyof typeof T;

const BAND: Record<Band, Text> = {
	overdue: T.overdue,
	today: T.today,
	week: { en: 'Next 7 days', zh: '7 天内', ja: '7日以内' },
	month: { en: 'Next 30 days', zh: '30 天内', ja: '30日以内' },
	later: { en: 'Later', zh: '以后', ja: 'それ以降' },
};

export class Strings {
	constructor(readonly lang: Lang) {}

	t(key: Key): string {
		return T[key][this.lang];
	}

	band(band: Band): string {
		return BAND[band][this.lang];
	}

	/** Short label for a row: Today, Tomorrow, 5 days, 2 days late. */
	pill(c: Countdown): string {
		const { lang } = this;
		if (c.band === 'overdue') {
			const n = -c.days;
			if (n <= 0) return this.t('overdue');
			return lang === 'zh' ? `过期 ${n} 天` : lang === 'ja' ? `${n}日超過` : `${n} ${n === 1 ? 'day' : 'days'} late`;
		}
		if (c.days === 0) return c.hours !== null ? (lang === 'zh' ? `${c.hours} 小时` : lang === 'ja' ? `${c.hours}時間` : `${c.hours} h`) : this.t('today');
		if (c.days === 1) return this.t('tomorrow');
		return lang === 'zh' ? `${c.days} 天` : lang === 'ja' ? `${c.days}日` : `${c.days} days`;
	}

	/** The big number and its unit; text instead of a number for today. */
	hero(c: Countdown): { value: string; unit: string } {
		const { lang } = this;
		if (c.days === 0 && c.hours !== null) return { value: String(c.hours), unit: lang === 'zh' ? '小时' : lang === 'ja' ? '時間' : c.hours === 1 ? 'hour left' : 'hours left' };
		if (c.days === 0) return { value: this.t('today'), unit: '' };
		return { value: String(c.days), unit: lang === 'zh' ? '天' : lang === 'ja' ? '日' : c.days === 1 ? 'day left' : 'days left' };
	}

	/** "Fri, Nov 20" / "11月20日 周五" / "11月20日(金)", with the time when there is one. */
	date(at: Date, hasTime: boolean, now: Date): string {
		const locale = this.lang === 'zh' ? 'zh-CN' : this.lang === 'ja' ? 'ja-JP' : 'en-US';
		const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', weekday: 'short' };
		if (at.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
		if (hasTime) {
			opts.hour = 'numeric';
			opts.minute = '2-digit';
		}
		return new Intl.DateTimeFormat(locale, opts).format(at);
	}
}
