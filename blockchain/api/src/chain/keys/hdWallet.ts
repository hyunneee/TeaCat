import { HDNodeWallet, Mnemonic } from 'ethers';
import { env } from '../../config';
import { provider } from '../provider';

/**
 * 커스터디 HD 지갑.
 *
 * 유저 개인키는 **어디에도 저장하지 않습니다.** 니모닉 + 인덱스로 매번 파생하고
 * 서명이 끝나면 버립니다. Spring DB 가 통째로 유출돼도 니모닉이 없으면
 * 그냥 주소 목록일 뿐입니다. (DESIGN.md 4-6, 5-1)
 *
 * 주의: 이 모듈 밖으로는 주소만 나갑니다. `HDNodeWallet` 객체를 반환하지 마세요 —
 *       로그에 찍히는 순간 개인키가 함께 나갑니다.
 */
const mnemonic = Mnemonic.fromPhrase(env.MASTER_MNEMONIC);

function derive(index: number): HDNodeWallet {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`derivationIndex 는 0 이상의 정수여야 합니다: ${index}`);
  }
  // 캐시하지 않습니다. BIP32 파생은 충분히 빨라서 메모리에 키를 남길 이유가 없습니다.
  return HDNodeWallet.fromMnemonic(mnemonic, `${env.USER_ACCOUNT_PATH}/${index}`);
}

/**
 * 파생 인덱스로 유저의 owner EOA 주소를 계산합니다.
 *
 * 순수 함수입니다 — 같은 인덱스면 언제나 같은 주소가 나옵니다.
 * 주의: 인덱스 할당과 재사용 금지는 Spring 책임입니다. (DESIGN.md 5-1)
 */
export function deriveUserAddress(index: number): string {
  return derive(index).address.toLowerCase();
}

/** 서명이 필요한 `chain/` 내부 코드만 씁니다. */
export function userSigner(index: number): HDNodeWallet {
  return derive(index).connect(provider);
}

/** 파생 경로 표기 — 로그·응답에서 어느 경로로 만든 주소인지 확인용 */
export function derivationPath(index: number): string {
  return `${env.USER_ACCOUNT_PATH}/${index}`;
}
