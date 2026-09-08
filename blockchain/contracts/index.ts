/**
 * `@teacat/contracts` 의 공개 API.
 *
 * api 워크스페이스는 이 파일을 통해서만 컨트랙트에 접근합니다.
 *
 *   import { requireAddress } from '@teacat/contracts';   // 이렇게
 *   import abi from '../../contracts/artifacts/….json';   // 이러면 안 됩니다
 *
 * 아래쪽처럼 상대경로로 들어가면 tsconfig 의 rootDir 밖을 참조하게 되어
 * tsc 가 빌드를 거부합니다. 컨트랙트 폴더 구조가 바뀔 때마다 경로도 전부 깨집니다.
 *
 * 컨트랙트를 추가하면 여기에 typechain 타입을 함께 export 합니다.
 * typechain-types 는 `npm run compile` 이 만듭니다.
 */
export {
  readDeployment,
  requireAddress,
  saveDeployment,
  type Deployment,
} from './lib/deployments';

/* ── 컨트랙트 ────────────────────────────────────────────────
   typechain-types 는 `npm run compile` 이 만듭니다. 커밋되지 않습니다. */

export { CatMoney__factory } from './typechain-types/factories/contracts/CatMoney__factory';
export type { CatMoney } from './typechain-types/contracts/CatMoney';

export { TicketSBT__factory } from './typechain-types/factories/contracts/TicketSBT__factory';
export type { TicketSBT } from './typechain-types/contracts/TicketSBT';

export { PhotocardNFT__factory } from './typechain-types/factories/contracts/PhotocardNFT__factory';
export type { PhotocardNFT } from './typechain-types/contracts/PhotocardNFT';

export { VerifiableDraw__factory } from './typechain-types/factories/contracts/VerifiableDraw__factory';
export type { VerifiableDraw } from './typechain-types/contracts/VerifiableDraw';
