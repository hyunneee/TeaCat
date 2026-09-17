"""좌석 페이지 체류 부하테스트 결과 그래프 (2026-09-16, dev-server cpus=1.5).

    python loadtest/k6/plot_seatmap.py            # loadtest/k6/seatmap-2026-09-16.png 생성

값은 README.md 의 측정표와 같다. k6 요약 + Prometheus(actuator) 에서 뽑았다.
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

users        = [300, 600, 900, 1200, 1800, 2400]
busy_threads = [1, 2, 94, 200, 200, 200]          # 처리 중 요청 = busy 톰캣 스레드
TOMCAT_MAX   = 200
hikari_active  = [1, 3, 10, 10, 10, 10]
hikari_pending = [0, 0, 83, 188, 191, 190]
HIKARI_MAX     = 10
p95_client_ms = [43, 99, 494, 1730, 3890, 7080]
p95_server_ms = [14, 47, 442, 1340, 1760, 2050]
acquire_max_ms = [30, 147, 1855, 4151, 4809, 4642] # Hikari 커넥션 대기 최대
req_per_s = [99, 197, 287, 325, 316, 274]
fail_pct  = [0, 0, 0, 0, 0, 4.0]
jvm_cpu   = [46, 73, 98, 100, 100, 100]

C_THREAD, C_CONN, C_PEND, C_CLIENT, C_SERVER, C_TPUT, C_FAIL, C_LIMIT = (
    "#534AB7", "#1D9E75", "#D85A30", "#185FA5", "#639922", "#0F6E56", "#A32D2D", "#888780")

fig, axes = plt.subplots(2, 2, figsize=(14, 9.5))
fig.suptitle("좌석 페이지 체류 부하테스트 — 사용자 수별 스레드풀 · 커넥션풀 · 응답시간\n"
             "(dev.teacat.site · dev-server CPU 1.5코어 · /schedules/{id}/seats 3초 폴링 · 2026-09-16)",
             fontsize=13)

def mark_bottleneck(ax, x, text, y_frac=0.92):
    ax.axvline(x, color=C_LIMIT, ls=":", lw=1)
    ax.text(x, ax.get_ylim()[1] * y_frac, text, ha="left", va="top", fontsize=9, color="#444441",
            bbox=dict(boxstyle="round,pad=0.25", fc="white", ec="none", alpha=0.85))

# 1. 톰캣 스레드풀 ─────────────────────────────────────────────
ax = axes[0, 0]
ax.plot(users, busy_threads, "o-", color=C_THREAD, lw=2.2, label="busy 스레드 (처리 중 요청)")
ax.axhline(TOMCAT_MAX, color=C_LIMIT, ls="--", lw=1.2, label=f"톰캣 max-threads = {TOMCAT_MAX}")
ax.fill_between(users, busy_threads, TOMCAT_MAX, where=[b >= TOMCAT_MAX for b in busy_threads],
                color=C_THREAD, alpha=0.08)
for x, y in zip(users, busy_threads):
    ax.annotate(str(y), (x, y), textcoords="offset points", xytext=(0, 7), ha="center", fontsize=9)
ax.set_title("톰캣 스레드풀")
ax.set_ylabel("스레드 수")
ax.set_ylim(0, 230)
ax.legend(loc="center right", fontsize=9)
mark_bottleneck(ax, 1200, "1200명: 200개 소진\n→ accept 큐 대기 시작", y_frac=0.72)

# 2. Hikari 커넥션풀 ───────────────────────────────────────────
ax = axes[0, 1]
ax.plot(users, hikari_active, "o-", color=C_CONN, lw=2.2, label="사용 중 커넥션 (active)")
ax.plot(users, hikari_pending, "s-", color=C_PEND, lw=2.2, label="커넥션 대기 요청 (pending)")
ax.axhline(HIKARI_MAX, color=C_LIMIT, ls="--", lw=1.2, label=f"maximum-pool-size = {HIKARI_MAX}")
for x, y in zip(users, hikari_pending):
    if y:
        ax.annotate(str(y), (x, y), textcoords="offset points", xytext=(-6, 8), ha="right", fontsize=9, color=C_PEND)
ax.set_title("HikariCP 커넥션풀")
ax.set_ylabel("커넥션 / 대기 요청 수")
ax.set_ylim(0, 230)
ax.legend(loc="center right", fontsize=9)
mark_bottleneck(ax, 900, "900명: 10개 고갈\n→ 대기 83 → 190")
ax2 = ax.twinx()
ax2.plot(users, [v / 1000 for v in acquire_max_ms], "^--", color="#BA7517", lw=1.4, alpha=0.9,
         label="커넥션 대기 최대 (초)")
ax2.set_ylabel("커넥션 대기 최대 (초)", color="#854F0B")
ax2.set_ylim(0, 6)
ax2.tick_params(axis="y", colors="#854F0B")
ax2.legend(loc="lower right", fontsize=9)

# 3. 응답시간 p95 ──────────────────────────────────────────────
ax = axes[1, 0]
ax.plot(users, [v / 1000 for v in p95_client_ms], "o-", color=C_CLIENT, lw=2.2, label="p95 클라이언트 체감 (k6)")
ax.plot(users, [v / 1000 for v in p95_server_ms], "s-", color=C_SERVER, lw=2.2, label="p95 서버 내부 처리 (actuator)")
ax.fill_between(users, [v / 1000 for v in p95_server_ms], [v / 1000 for v in p95_client_ms],
                color=C_CLIENT, alpha=0.08, label="큐 대기 (톰캣 accept · nginx)")
ax.axhline(3, color=C_LIMIT, ls="--", lw=1.2)
ax.text(320, 3.15, "3초 = 폴링 주기 (이 위면 화면 갱신이 밀림)", fontsize=9, color="#444441")
ax.axhline(10, color=C_FAIL, ls="--", lw=1.2)
ax.text(2560, 10.3, "10초 = k6 타임아웃 (실패로 집계)", fontsize=9, color=C_FAIL, ha="right")
for x, y in zip(users, p95_client_ms):
    ax.annotate(f"{y/1000:.2f}s" if y >= 1000 else f"{y}ms", (x, y / 1000), textcoords="offset points",
                xytext=(0, 7), ha="center", fontsize=9, color=C_CLIENT)
ax.set_title("응답시간 p95")
ax.set_xlabel("좌석 페이지 체류 사용자 수")
ax.set_ylabel("초")
ax.set_ylim(0, 11.5)
ax.legend(loc="upper left", fontsize=9)

# 4. 처리량 · 실패율 · CPU ─────────────────────────────────────
ax = axes[1, 1]
bars = ax.bar(users, req_per_s, width=140, color=C_TPUT, alpha=0.85, label="서버 처리량 (req/s)")
for b, v in zip(bars, req_per_s):
    ax.text(b.get_x() + b.get_width() / 2, v + 5, str(v), ha="center", fontsize=9)
ax.axhline(320, color=C_LIMIT, ls="--", lw=1.2)
ax.text(2560, 327, "처리량 상한 약 320 req/s", fontsize=9, color="#444441", ha="right")
ax.set_title("처리량 · JVM CPU · 실패율")
ax.set_xlabel("좌석 페이지 체류 사용자 수")
ax.set_ylabel("req/s")
ax.set_ylim(0, 420)
ax3 = ax.twinx()
ax3.plot(users, jvm_cpu, "d-", color="#7F77DD", lw=1.8, label="JVM CPU (%)")
ax3.plot(users, fail_pct, "x-", color=C_FAIL, lw=1.8, ms=8, label="실패율 (%)")
ax3.annotate("4.0% 실패\n(10초 타임아웃)", (2400, 4), textcoords="offset points", xytext=(-70, 12),
             fontsize=9, color=C_FAIL, arrowprops=dict(arrowstyle="->", color=C_FAIL, lw=0.8))
ax3.set_ylim(0, 110)
ax3.set_ylabel("%")
ax3.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.0f}%"))
h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax3.get_legend_handles_labels()
ax.legend(h1 + h2, l1 + l2, loc="upper left", fontsize=9)

for a in axes.flat:
    a.set_xticks(users)
    a.set_xlim(150, 2600)
    a.grid(True, alpha=0.25)

fig.text(0.5, 0.005,
         "병목 순서: Hikari 10개 고갈(900명) → 커넥션 대기 요청이 톰캣 스레드 200개 점유(1200명) → accept 큐 대기 → 10초 타임아웃(2400명). "
         "서버 5xx 0건. 진짜 한계는 CPU 1.5코어, 약 320 req/s.",
         ha="center", fontsize=9.5, color="#2C2C2A")
fig.tight_layout(rect=(0, 0.03, 1, 0.94))

out = Path(__file__).with_name("seatmap-2026-09-16.png")
fig.savefig(out, dpi=150)
print(f"saved {out}")
