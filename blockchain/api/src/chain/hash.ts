import { keccak256, toUtf8Bytes } from 'ethers';

/**
 * Spring 이 보낸 문자열 키를 온체인 키로 바꿉니다.
 *
 * Spring 에 keccak256 의존성을 만들지 않기 위해 **서버가 해싱합니다.**
 * (DESIGN.md 결정 이력 2026-09-02)
 *
 * ── 한 군데에만 둡니다 ────────────────────────────────────────────
 * 티켓·포카·추첨이 전부 같은 식을 씁니다. 모듈마다 따로 적어두면 한쪽이 바뀌는
 * 순간 **같은 키가 다른 자리를 가리키고**, 그 결과는 중복 발행입니다.
 * 컴파일로는 절대 안 잡히는 종류라 정의를 하나로 묶어둡니다.
 */
export function hashOf(value: string): string {
  return keccak256(toUtf8Bytes(value));
}
