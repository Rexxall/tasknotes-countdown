import type { Band, Countdown } from './core';
import type { Plan, Step } from './plan';

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
	hoursRange: { en: 'Enter a number of hours from 0.5 to 16.', zh: '请输入 0.5 到 16 之间的小时数。', ja: '0.5〜16 の時間数を入力してください。' },
	wholeNumber: { en: 'Enter a whole number from 0 to 60.', zh: '请输入 0 到 60 的整数。', ja: '0〜60 の整数を入力してください。' },
	waitingSection: { en: 'Waiting on others', zh: '等别人', ja: '他の人待ち' },
	tight: { en: 'Tight', zh: '很紧', ja: 'きつい' },
	statusBarLabel: { en: 'Next deadline. Click to open the list.', zh: '最近的截止日。点击打开列表。', ja: '直近の締め切り。クリックで一覧を開く。' },
	setHours: { en: 'Hours a day for deadlines', zh: '每天能投入几小时', ja: '1日に使える時間' },
	setHoursDesc: { en: 'Used to say whether the work left fits in the days left, and when each step should start.', zh: '用来判断剩下的活能不能在剩下的天数里干完，以及每一步最晚哪天开始。', ja: '残りの作業が残りの日数に収まるか、各ステップをいつまでに始めるかの計算に使います。' },
	setBuffer: { en: 'Buffer days', zh: '留出缓冲天数', ja: '余裕を持たせる日数' },
	setBufferDesc: { en: 'Each step is planned to finish this many days before its due date.', zh: '每一步都按提前这么多天完成来排。', ja: '各ステップを締め切りのこの日数前に終える前提で計算します。' },
	setWaiting: { en: 'Waiting marker', zh: '“等别人”标记', ja: '「待ち」の目印' },
	setWaitingDesc: { en: 'A context, tag or status that means you are waiting on someone, such as a recommender.', zh: '表示在等别人（比如推荐人）的上下文、标签或状态。', ja: '推薦者など、他の人を待っていることを表すコンテキスト、タグ、ステータス。' },
	setStatusBar: { en: 'Show the next deadline in the status bar', zh: '在状态栏显示最近的截止日', ja: 'ステータスバーに直近の締め切りを表示' },
	settingsCard: { en: 'Sidebar and status bar', zh: '侧栏和状态栏', ja: 'サイドバーとステータスバー' },
	settingsPlan: { en: 'Planning', zh: '排期', ja: '計画' },
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

	/** "50 min", "4.5 h" / "50 分钟", "4.5 小时" / "50分", "4.5時間". */
	duration(minutes: number): string {
		const { lang } = this;
		if (minutes < 60) return lang === 'zh' ? `${minutes} 分钟` : lang === 'ja' ? `${minutes}分` : `${minutes} min`;
		const h = Math.round((minutes / 60) * 2) / 2;
		return lang === 'zh' ? `${h} 小时` : lang === 'ja' ? `${h}時間` : `${h} h`;
	}

	/** "3 of 5 steps left · about 4 h · 50 min a day" — only the parts the data supports. */
	pace(p: Plan): string[] {
		const { lang } = this;
		const parts: string[] = [];
		if (p.openSteps + p.doneSteps > 0) {
			const total = p.openSteps + p.doneSteps;
			parts.push(lang === 'zh' ? `还剩 ${p.openSteps} 步，共 ${total} 步` : lang === 'ja' ? `残り${p.openSteps}ステップ（全${total}）` : `${p.openSteps} of ${total} ${total === 1 ? 'step' : 'steps'} left`);
		}
		if (p.remainingMinutes > 0) {
			const d = this.duration(p.remainingMinutes);
			parts.push(lang === 'zh' ? `约 ${d}` : lang === 'ja' ? `約${d}` : `about ${d}`);
			const day = this.duration(p.minutesPerDay);
			parts.push(lang === 'zh' ? `每天 ${day}` : lang === 'ja' ? `1日${day}` : `${day} a day`);
		}
		return parts;
	}

	/** Short form for a row: "3 steps left" / "还剩 3 步" / "残り3ステップ". */
	stepsShort(p: Plan): string {
		const { lang } = this;
		if (p.openSteps === 0) return '';
		return lang === 'zh' ? `还剩 ${p.openSteps} 步` : lang === 'ja' ? `残り${p.openSteps}ステップ` : `${p.openSteps} ${p.openSteps === 1 ? 'step' : 'steps'} left`;
	}

	more(n: number): string {
		return this.lang === 'zh' ? `还有 ${n} 步` : this.lang === 'ja' ? `ほか${n}ステップ` : `${n} more ${n === 1 ? 'step' : 'steps'}`;
	}

	waiting(days: number | null | undefined): string {
		const { lang } = this;
		if (days === null || days === undefined) return this.t('waitingSection');
		return lang === 'zh' ? `已等 ${days} 天` : lang === 'ja' ? `${days}日待ち` : `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
	}

	step(step: Step, now: Date): string {
		const { lang } = this;
		switch (step.state) {
			case 'done': return this.t('done');
			case 'waiting': return this.waiting(step.waitingDays);
			case 'started': return lang === 'zh' ? '进行中' : lang === 'ja' ? '進行中' : 'In progress';
			case 'late': return lang === 'zh' ? '该开始了' : lang === 'ja' ? '開始が遅れています' : 'Start overdue';
			case 'start-now': return lang === 'zh' ? '今天开始' : lang === 'ja' ? '今日開始' : 'Start today';
			case 'later': {
				if (!step.startBy) return '';
				const raw = this.shortDate(step.startBy, now);
				const d = lang === 'en' && raw === this.t('tomorrow') ? 'tomorrow' : raw;
				return lang === 'zh' ? `最晚${d}开始` : lang === 'ja' ? `${d}までに開始` : `Start by ${d}`;
			}
		}
	}

	/** "Mon" within a week, otherwise "Nov 20" / "周一" / "11月20日" / "月曜" / "11月20日". */
	shortDate(at: Date, now: Date): string {
		const locale = this.lang === 'zh' ? 'zh-CN' : this.lang === 'ja' ? 'ja-JP' : 'en-US';
		const days = Math.round((Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
		if (days === 1) return this.t('tomorrow');
		const opts: Intl.DateTimeFormatOptions = days > 1 && days < 7 ? { weekday: this.lang === 'zh' ? 'short' : 'long' } : { month: 'short', day: 'numeric' };
		return new Intl.DateTimeFormat(locale, opts).format(at);
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
