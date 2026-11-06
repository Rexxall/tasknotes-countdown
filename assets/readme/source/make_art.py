"""README hero and the three cards, light and dark, English and Chinese.  python3 make_art.py"""
from pathlib import Path

THEMES = {
    "light": dict(bg="#F7F6FB", fg="#1D1B26", muted="#6B6780", line="#E4E1EE", card="#FFFFFF", fill="#E9E7F0",
                  accent="#7A5AF0", accent_soft="#EEE9FF", orange="#B8640F", orange_soft="#FCEFDF", red="#C93A40", red_soft="#FCEBEC"),
    "dark": dict(bg="#15141B", fg="#EEECF5", muted="#9C98AF", line="#2C2A36", card="#1E1D26", fill="#34323F",
                 accent="#A48BFF", accent_soft="#2C2643", orange="#F0A046", orange_soft="#3A2A16", red="#F07C80", red_soft="#3A1E24"),
}
SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

TEXT = {
    "en": dict(
        eyebrow="OBSIDIAN PLUGIN · FOR TASKNOTES", line1="Days left is the easy part.", line2="Can you still make it?",
        trust="free · read-only · no network",
        desc="A deadline five days away: 75% of the time gone, tight at 1.5 hours a day, one step that should already have started and one waiting on an advisor.",
        task="Graduate application", unit="days left", gone="75% of the time gone", tight="Tight", pace="5 steps left · 1.5 h a day",
        s1="Translate transcript", w1="Start overdue", s2="Recommendation letter", w2="Waiting 6 days",
        cards=[("The pace it needs", "Hours left, and how much a day."), ("When to start", "A latest start day for each step."),
               ("Who to chase", "Waiting steps, and for how long.")],
        cards_title="What TaskNotes Countdown shows",
        cards_desc="The pace it needs: hours left and hours a day. When to start: a latest start day for every step. Who to chase: steps waiting on someone else, with days waited.",
        title_size=60),
    "zh": dict(
        eyebrow="OBSIDIAN 插件 · 配合 TASKNOTES", line1="剩几天谁都会算，", line2="难的是：还来得及吗？",
        trust="免费 · 只读 · 不联网",
        desc="五天后截止的申请：时间已过 75%，每天要 1.5 小时，有一步该开始了，还有一步在等导师。",
        task="研究生申请", unit="天", gone="时间已过 75%", tight="很紧", pace="还剩 5 步 · 每天 1.5 小时",
        s1="翻译成绩单", w1="该开始了", s2="导师推荐信", w2="已等 6 天",
        cards=[("每天要多少", "还剩几小时，每天要做多久。"), ("哪天开始", "每一步都有最晚开始日。"), ("该催谁", "在等别人的步骤，等了几天。")],
        cards_title="TaskNotes Countdown 能看到什么",
        cards_desc="每天要多少：剩余工时和每天要做多久。哪天开始：每一步的最晚开始日。该催谁：在等别人的步骤和已等天数。",
        title_size=60),
}

HERO = """<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400" role="img" aria-labelledby="t d">
  <title id="t">TaskNotes Countdown</title>
  <desc id="d">{desc}</desc>
  <rect width="1200" height="400" rx="28" fill="{bg}"/>
  <g font-family="{sans}">
    <text x="64" y="112" font-family="{mono}" font-size="17" letter-spacing="2" fill="{accent}">{eyebrow}</text>
    <text x="62" y="190" font-size="{title_size}" font-weight="700" letter-spacing="-1.5" fill="{fg}">TaskNotes Countdown</text>
    <text x="64" y="248" font-size="29" fill="{muted}">{line1}</text>
    <text x="64" y="288" font-size="29" fill="{fg}">{line2}</text>
    <text x="64" y="344" font-family="{mono}" font-size="17" fill="{muted}">{trust}</text>
  </g>
  <g font-family="{sans}">
    <rect x="740" y="44" width="400" height="312" rx="22" fill="{card}" stroke="{line}"/>
    <text x="768" y="88" font-size="21" font-weight="600" fill="{fg}">{task}</text>
    <path d="M1100 74 V90 M1093 81 L1100 74 L1107 81 M1092 86 V96 H1108 V86" fill="none" stroke="{muted}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="764" y="160" font-size="76" font-weight="700" letter-spacing="-2" fill="{fg}">5</text>
    <text x="816" y="158" font-size="20" fill="{muted}">{unit}</text>
    <rect x="768" y="182" width="344" height="6" rx="3" fill="{fill}"/>
    <rect x="768" y="182" width="258" height="6" rx="3" fill="{muted}"/>
    <text x="768" y="210" font-size="15" fill="{muted}">{gone}</text>
    <path d="M768 228 H1112" stroke="{line}"/>
    <rect x="768" y="242" width="{tight_w}" height="26" rx="13" fill="{orange_soft}"/>
    <text x="{tight_x}" y="260" font-size="15" font-weight="600" text-anchor="middle" fill="{orange}">{tight}</text>
    <text x="{pace_x}" y="260" font-size="16" fill="{muted}">{pace}</text>
    <circle cx="774" cy="296" r="5" fill="{red}"/>
    <text x="788" y="302" font-size="17" fill="{fg}">{s1}</text>
    <text x="1112" y="302" font-size="15" font-weight="600" text-anchor="end" fill="{red}">{w1}</text>
    <circle cx="774" cy="330" r="4.5" fill="none" stroke="{accent}" stroke-width="2"/>
    <text x="788" y="336" font-size="17" fill="{fg}">{s2}</text>
    <text x="1112" y="336" font-size="15" text-anchor="end" fill="{muted}">{w2}</text>
  </g>
</svg>
"""


def glyph(i, x, y, c):
    if i == 0:  # gauge
        return (f'<path d="M{x+10} {y+32} A14 14 0 0 1 {x+38} {y+32}" fill="none" stroke="{c["fill"]}" stroke-width="4" stroke-linecap="round"/>'
                f'<path d="M{x+10} {y+32} A14 14 0 0 1 {x+34} {y+22}" fill="none" stroke="{c["orange"]}" stroke-width="4" stroke-linecap="round"/>'
                f'<path d="M{x+24} {y+32} L{x+31} {y+21}" stroke="{c["fg"]}" stroke-width="2.5" stroke-linecap="round"/>')
    if i == 1:  # calendar with a mark
        return (f'<rect x="{x+11}" y="{y+13}" width="26" height="24" rx="5" fill="none" stroke="{c["accent"]}" stroke-width="2.5"/>'
                f'<path d="M{x+11} {y+20} H{x+37} M{x+18} {y+9} V{y+15} M{x+30} {y+9} V{y+15}" stroke="{c["accent"]}" stroke-width="2.5" stroke-linecap="round"/>'
                f'<circle cx="{x+24}" cy="{y+28}" r="3.5" fill="{c["red"]}"/>')
    return (f'<circle cx="{x+24}" cy="{y+24}" r="12" fill="none" stroke="{c["accent"]}" stroke-width="2.5"/>'
            f'<path d="M{x+24} {y+17} V{y+24} L{x+29} {y+27}" fill="none" stroke="{c["accent"]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>')


def cards(t, c):
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="190" viewBox="0 0 1200 190" role="img" aria-labelledby="t d">',
             f'<title id="t">{t["cards_title"]}</title>', f'<desc id="d">{t["cards_desc"]}</desc>', f'<g font-family="{SANS}">']
    for i, (title, body) in enumerate(t["cards"]):
        x = 24 + i * 392
        parts += [f'<rect x="{x}" y="16" width="368" height="158" rx="22" fill="{c["bg"]}" stroke="{c["line"]}"/>',
                  f'<rect x="{x+28}" y="44" width="48" height="48" rx="14" fill="{c["accent_soft"]}"/>', glyph(i, x + 28, 44, c),
                  f'<text x="{x+96}" y="78" font-size="27" font-weight="700" fill="{c["fg"]}">{title}</text>',
                  f'<text x="{x+28}" y="138" font-size="20" fill="{c["muted"]}">{body}</text>']
    return "\n".join(parts + ["</g></svg>\n"])


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent
    for lang, t in TEXT.items():
        sfx = "" if lang == "en" else "-zh"
        tight_w = 62 if lang == "en" else 52
        geo = dict(tight_w=tight_w, tight_x=768 + tight_w / 2, pace_x=768 + tight_w + 12)
        for name, c in THEMES.items():
            (out / f"hero{sfx}-{name}.svg").write_text(HERO.format(sans=SANS, mono=MONO, **geo, **t, **c), encoding="utf-8")
            (out / f"cards{sfx}-{name}.svg").write_text(cards(t, c), encoding="utf-8")
    print("wrote", sorted(p.name for p in out.glob("*.svg")))
