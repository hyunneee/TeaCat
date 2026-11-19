import { motion, useReducedMotion } from 'motion/react';
import { YUT_BACKDO } from '../model/yutBoard';

interface Props {
  /** 던지기 결과. 1~5 는 도·개·걸·윷·모, -1 은 백도입니다 */
  result: number;
  /** 떨어지는 연출을 다시 트는 값. 던질 때마다 달라야 합니다 */
  seq: number;
}

/**
 * 윷가락 네 개.
 *
 * <p>🔴 <b>결과에서 배(평평한 면)의 개수를 되짚습니다.</b> 서버는 몇 개가 엎어졌는지가
 * 아니라 <b>결과 값만</b> 내려줍니다 — 규칙에 필요한 것은 칸 수뿐이라 그게 맞습니다.
 * 다행히 되짚는 규칙이 하나입니다 (서버 {@code YutEngine.roll}):
 *
 * <pre>
 *   배 1개 → 도(1)   배 2개 → 개(2)   배 3개 → 걸(3)
 *   배 4개 → 윷(4)   배 0개 → 모(5)
 * </pre>
 *
 * <p>그래서 <b>모일 때만 0</b>이고 나머지는 결과가 곧 배의 개수입니다. 이걸 그대로
 * 그리면 화면의 윷가락과 나온 값이 언제나 맞습니다.
 *
 * <p>가락은 반쪽 원기둥이라 <b>배는 평평한 면(밝은 속살), 등은 둥근 면(나무 껍질)</b>
 * 입니다. 색만 바꾸면 무엇이 무엇인지 알 수 없어서 배에는 가운데 금을 하나 긋습니다 —
 * 실제 윷의 배에 새기는 금이고, 그림자 없이도 앞뒤가 구분됩니다.
 */
export function YutSticks({ result, seq }: Props) {
  const reduce = useReducedMotion();
  /* 백도는 "도" 와 같은 모양으로 떨어집니다 — 배가 하나. 다른 점은 그 하나가
     **표시된 가락**이라는 것뿐이라, 그 가락에만 표시를 그립니다 (서버 BACKDO_STICK 과 같은 0번) */
  const backdo = result === YUT_BACKDO;
  const flats = result === 5 ? 0 : backdo ? 1 : result;

  return (
    <div className="flex items-end justify-center gap-1.5" aria-hidden>
      {[0, 1, 2, 3].map((index) => (
        <motion.div
          // seq 를 key 에 넣어야 던질 때마다 연출이 처음부터 다시 돕니다
          key={`${seq}-${index}`}
          initial={reduce ? false : { y: -70, rotate: index % 2 ? -140 : 160, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{
            type: 'spring',
            stiffness: 260,
            damping: 15,
            // 하나씩 떨어져야 "던졌다" 로 보입니다. 동시에 나타나면 그냥 켜진 것입니다
            delay: reduce ? 0 : index * 0.07,
          }}
        >
          <Stick flat={index < flats} marked={backdo && index === 0} />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * 가락 하나 — 배(평평)면 밝은 속살에 금 하나, 등(둥근 면)이면 나무 껍질.
 *
 * `marked` 는 백도 가락입니다. 실제 윷처럼 **하나에만** 표시가 있고, 그 하나만 배로
 * 떨어졌을 때가 백도입니다. 표시가 없으면 화면에서는 그냥 '도' 와 똑같이 보여서
 * 왜 뒤로 가는지 알 수 없습니다.
 */
function Stick({ flat, marked = false }: { flat: boolean; marked?: boolean }) {
  return (
    <svg width="18" height="56" viewBox="0 0 18 56" className="drop-shadow-sm">
      <rect
        x="1"
        y="1"
        width="16"
        height="54"
        rx="8"
        className={flat ? 'fill-amber-100 stroke-amber-700' : 'fill-amber-700 stroke-amber-900'}
        strokeWidth="1.5"
      />
      {flat ? (
        <line x1="9" y1="14" x2="9" y2="42" className="stroke-amber-700" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        /* 등 쪽의 나뭇결. 둥근 면이라는 걸 알려주는 하이라이트입니다 */
        <line x1="6" y1="10" x2="6" y2="46" className="stroke-amber-500" strokeWidth="1.5" strokeLinecap="round" />
      )}
      {/* 백도 가락의 표시 — 실제 윷에 새기는 X 자국입니다. 이게 없으면 화면에서는
          그냥 '도' 와 똑같이 보여서 왜 말이 뒤로 가는지 알 수 없습니다 */}
      {marked && (
        <g className="stroke-amber-900" strokeWidth="2" strokeLinecap="round">
          <line x1="5" y1="24" x2="13" y2="32" />
          <line x1="13" y1="24" x2="5" y2="32" />
        </g>
      )}
    </svg>
  );
}
