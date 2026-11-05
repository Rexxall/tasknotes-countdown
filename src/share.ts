import type { CountdownItem } from './core';
import type { Strings } from './i18n';

// A 3:4 card (1080 × 1440, the shape Xiaohongshu and Instagram feeds show whole) drawn from the
// current theme's own colours and font, so it looks like the sidebar, not like a template.

const W = 1080;
const H = 1440;
const PAD = 96;

interface Palette {
	bg: string;
	text: string;
	muted: string;
	faint: string;
	warn: string;
	bad: string;
	font: string;
}

function palette(): Palette {
	const cs = getComputedStyle(document.body);
	const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
	return {
		bg: v('--background-primary', '#ffffff'),
		text: v('--text-normal', '#1d1d1f'),
		muted: v('--text-muted', '#6e6e73'),
		faint: v('--background-modifier-border', '#d2d2d7'),
		warn: v('--color-orange', '#d97706'),
		bad: v('--color-red', '#dc2626'),
		font: cs.fontFamily || 'system-ui, sans-serif',
	};
}

/** Splits text into at most `max` lines that fit `width`, ending with "…" when cut. Works for CJK (no spaces). */
export function wrapLines(measure: (s: string) => number, text: string, width: number, max: number): string[] {
	const tokens = text.trim().match(/[\u3000-\u9fff\uff00-\uffef]|[^\s\u3000-\u9fff\uff00-\uffef]+|\s+/g) ?? [];
	const lines: string[] = [];
	let line = '';
	let cut = false;
	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		if (line === '' || measure((line + tok).trimEnd()) <= width) {
			line += line === '' ? tok.trimStart() : tok;
			continue;
		}
		lines.push(line.trimEnd());
		if (lines.length === max) {
			cut = true;
			break;
		}
		line = tok.trimStart();
	}
	if (!cut && line) lines.push(line.trimEnd());
	if (cut) {
		let last = lines[max - 1];
		while (last && measure(`${last}…`) > width) last = last.slice(0, -1);
		lines[max - 1] = `${last}…`;
	}
	return lines;
}

export async function drawCard(item: CountdownItem, s: Strings, now: Date): Promise<Blob> {
	const canvas = createEl('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas is not available');
	const p = palette();
	const font = (weight: number, size: number) => `${weight} ${size}px ${p.font}`;
	const tone = item.countdown.tone === 'danger' ? p.bad : item.countdown.tone === 'warn' ? p.warn : p.text;

	ctx.fillStyle = p.bg;
	ctx.fillRect(0, 0, W, H);
	ctx.textBaseline = 'alphabetic';

	// Title, up to three lines
	ctx.fillStyle = p.text;
	ctx.font = font(600, 64);
	let y = PAD + 64;
	for (const line of wrapLines(t => ctx.measureText(t).width, item.title, W - PAD * 2, 3)) {
		ctx.fillText(line, PAD, y);
		y += 80;
	}

	// The number
	const { value, unit } = s.hero(item.countdown);
	const numeric = /^\d+$/.test(value);
	ctx.fillStyle = tone;
	ctx.font = font(700, numeric ? 360 : 200);
	// The number sits at the optical middle of the card, whatever the title's length.
	const numY = Math.max(y + (numeric ? 340 : 220), numeric ? 720 : 640);
	ctx.fillText(value, PAD - (numeric ? 12 : 0), numY);
	if (unit) {
		const nw = ctx.measureText(value).width;
		ctx.fillStyle = p.muted;
		ctx.font = font(500, 56);
		ctx.fillText(unit, PAD + nw + 16, numY);
	}
	y = numY + 90;

	ctx.fillStyle = p.muted;
	ctx.font = font(500, 44);
	ctx.fillText(`${s.t('due')} ${s.date(item.due.at, item.due.hasTime, now)}`, PAD, y);
	y += 80;

	if (typeof item.elapsed === 'number') {
		roundRect(ctx, PAD, y, W - PAD * 2, 12, 6, p.faint);
		roundRect(ctx, PAD, y, Math.max(12, (W - PAD * 2) * item.elapsed), 12, 6, tone === p.text ? p.muted : tone);
		y += 64;
		ctx.fillStyle = p.muted;
		ctx.font = font(500, 36);
		ctx.fillText(s.elapsed(item.elapsed), PAD, y);
		y += 70;
	}

	if (item.plan) {
		const pace = s.pace(item.plan);
		if (pace.length) {
			ctx.fillStyle = item.plan.tight ? p.warn : p.text;
			ctx.font = font(500, 40);
			const text = item.plan.tight ? `${s.t('tight')} · ${pace.join(' · ')}` : pace.join(' · ');
			for (const line of wrapLines(t => ctx.measureText(t).width, text, W - PAD * 2, 2)) {
				ctx.fillText(line, PAD, y);
				y += 56;
			}
		}
	}

	// Footer: today's date and the plugin's name, quiet
	ctx.fillStyle = p.muted;
	ctx.font = font(500, 32);
	ctx.fillText(s.date(now, false, new Date(0)), PAD, H - PAD);
	ctx.textAlign = 'right';
	ctx.fillText('TaskNotes Countdown', W - PAD, H - PAD);
	ctx.textAlign = 'left';

	return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not draw the image'))), 'image/png'));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
	ctx.fill();
}
