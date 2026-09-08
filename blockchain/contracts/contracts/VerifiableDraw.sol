// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * 검증 가능한 추첨 — 커밋-리빌 + 블록해시. (PHOTOCARD_PLAN.md 4장)
 *
 * **이 컨트랙트는 토큰을 모릅니다.** 누구에게 무엇이 갔는지도 모릅니다.
 * 하는 일은 하나입니다 — **아무도 겨냥할 수 없는 난수 하나를 만들어 영구히 남기는 것.**
 * 그래서 포카 도안 배정에도, 나중의 취소표 추첨(DESIGN.md 6장 ③)에도 그대로 씁니다.
 *
 * ── 배정을 여기에 두지 않는 이유 ──────────────────────────────────
 *
 *   배정 = f(randomness, 참여자 목록, 도안별 수량)
 *
 * 난수가 고정되면 배정은 **순수 함수**가 됩니다. 누가 계산하든 같은 답이 나오므로
 * 누가 계산하는지가 중요하지 않고, 그래서 온체인에 둘 이유도 없습니다.
 * Spring 이 계산해 자기 DB 에 넣어도 검증은 그대로 성립합니다.
 *
 * 셔플을 온체인이나 이 서비스로 옮기는 것은 **아무것도 증명하지 않으면서**
 * 멱등(재시도하면 다시 섞임)과 원자성만 깨뜨립니다.
 *
 * ── 두 조각이 각각 다른 것을 막습니다 ────────────────────────────
 *
 *   시드 커밋      결과를 보고 **시드를 바꾸는 것**을 막습니다
 *   미래 블록해시  유리한 시드를 **미리 골라내는 것**(grinding)을 막습니다
 *
 * 서버는 시드를 알지만 커밋 시점에 블록해시를 모르고, 블록 생산자는 블록해시를
 * 흔들 수 있지만 시드를 모릅니다. 둘이 공모하지 않는 한 결과를 겨냥할 수 없습니다.
 *
 * ── 입력을 같이 고정하지 않으면 전부 무의미합니다 ────────────────
 *
 * 난수만 박아두면 서버가 결과를 본 뒤 **참여자 순서를 바꿔** 원하는 사람에게 원하는
 * 것을 줄 수 있습니다. 난수는 진짜인데 배정은 조작인 상태가 됩니다.
 * 그래서 `inputsHash` 를 커밋과 **같은 트랜잭션에서** 받습니다.
 *
 *   inputsHash = keccak256(abi.encode(performanceId, ticketIds, designIds, quantities))
 *
 * ── 이 체인에서 ──────────────────────────────────────────────────
 * `BLOCKHASH` 는 Frontier 옵코드라 Constantinople 에서 문제없습니다.
 * `block.chainid` 처럼 막히는 것이 아닙니다. (DESIGN.md 8장)
 */
contract VerifiableDraw is AccessControl {
    /**
     * 추첨을 열고 공개합니다.
     *
     * 발행 키(`MINTER_ROLE`)와 분리해 둡니다 — 발행 키가 털려도 추첨을 열거나
     * 접지는 못해야 합니다. 다만 **리빌에 42분 시한이 있어서**(아래) API 프로세스가
     * 자동으로 부를 수 있어야 합니다. 이 키를 API 에 어떻게 줄지는
     * `PHOTOCARD_PLAN.md` 10장에 미결로 적혀 있습니다.
     */
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
     * `blockhash` 가 돌려주는 과거 블록 수. EVM 상수입니다.
     *
     * 이 체인은 블록이 약 10초라 **약 42분**입니다. 그 안에 리빌하지 못하면
     * 그 추첨은 되살릴 수 없습니다.
     */
    uint256 public constant BLOCKHASH_WINDOW = 256;

    struct Draw {
        /// `keccak256(abi.encode(seed))`. 0 이 아니면 이 번호는 이미 쓰였습니다
        bytes32 seedCommit;
        /// 참여자·수량을 묶은 해시. 배정을 계산할 때 이 값과 대조합니다
        bytes32 inputsHash;
        /// 커밋이 실린 블록. 난수는 **그 다음 블록**의 해시를 씁니다
        uint64 commitBlock;
        bool revealed;
        bool canceled;
        /// 확정된 난수. `revealed` 가 true 일 때만 의미가 있습니다
        bytes32 randomness;
    }

    /**
     * `drawId` → 추첨. `drawId` 는 Spring 이 정한 문자열을 서버가 해싱한 값입니다.
     *
     * **`performanceId` 를 키 문자열에 넣으세요.** 같은 공연에 추첨이 몇 번 열렸는지가
     * 눈에 띄어야 합니다 — 아래 "막지 못하는 것" 이 그것 하나에 기대고 있습니다.
     */
    mapping(bytes32 => Draw) private _draws;

    /* 이벤트에 `seed` 와 `blockHash` 를 그대로 실습니다. 로그만 있으면 제3자가
       randomness 계산을 처음부터 다시 해 볼 수 있습니다 — 우리 말을 안 믿어도 됩니다. */
    event DrawOpened(
        bytes32 indexed drawId,
        bytes32 seedCommit,
        bytes32 inputsHash,
        uint64 commitBlock
    );
    event DrawRevealed(
        bytes32 indexed drawId,
        bytes32 seed,
        bytes32 blockHash,
        bytes32 randomness
    );
    event DrawCanceled(bytes32 indexed drawId);

    /* ── 에러 ──────────────────────────────────────────────────────
       재시도로 풀리는 것(`TooEarly`)과 안 풀리는 것(`BlockhashExpired`)의 이름을
       나눕니다. revert 된 tx 는 이벤트를 안 남겨서 `GET /internal/tx/…` 가 볼 수
       있는 건 에러 이름뿐입니다. */

    error DrawAlreadyExists(bytes32 drawId);
    error DrawNotFound(bytes32 drawId);
    error DrawAlreadyRevealed(bytes32 drawId);
    error DrawIsCanceled(bytes32 drawId);
    /// 커밋한 시드와 다릅니다.
    error SeedMismatch(bytes32 drawId);
    /// 대상 블록이 아직 없습니다. **조금 뒤에 다시 시도하면 됩니다.**
    error TooEarly(bytes32 drawId, uint256 targetBlock);
    /// 256블록이 지나 블록해시가 사라졌습니다. **이 추첨은 되살릴 수 없습니다.**
    error BlockhashExpired(bytes32 drawId, uint256 targetBlock);
    /// 아직 리빌할 수 있는 추첨은 접을 수 없습니다.
    error DrawStillRevealable(bytes32 drawId);
    error EmptyDrawId();
    error EmptyCommit();
    /// 입력 해시가 0 입니다. 입력을 고정하지 않으면 이 추첨은 증명이 되지 않습니다.
    error EmptyInputsHash();
    error ZeroAddress();

    constructor(address admin, address operator) {
        if (admin == address(0) || operator == address(0)) revert ZeroAddress();

        // 둘을 나눠 받는 이유는 다른 컨트랙트와 같습니다 — 한 키가 전부 쥐면
        // 그 키가 털렸을 때 추첨 조작과 권한 조작이 한꺼번에 가능합니다.
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
    }

    /**
     * 추첨을 엽니다 — **커밋**.
     *
     * 시드 자체는 올리지 않습니다. `keccak256(abi.encode(seed))` 만 올려서
     * 서버를 그 시드에 묶어둡니다. 시드는 리빌할 때 공개됩니다.
     *
     * `inputsHash` 는 참여자 목록과 도안별 수량을 묶은 해시입니다. **이게 없으면
     * 이 컨트랙트는 아무것도 증명하지 못합니다** — 위 주석을 보세요.
     *
     * ── 한 번 쓴 `drawId` 는 다시 못 씁니다 ────────────────────────
     *
     * 취소된 추첨의 번호도 막습니다. 재사용을 허용하면 **다시 뽑은 흔적이 덮여서**
     * 이 설계의 마지막 방어선이 사라집니다.
     */
    function openDraw(bytes32 drawId, bytes32 seedCommit, bytes32 inputsHash)
        external
        onlyRole(OPERATOR_ROLE)
    {
        if (drawId == bytes32(0)) revert EmptyDrawId();
        if (seedCommit == bytes32(0)) revert EmptyCommit();
        if (inputsHash == bytes32(0)) revert EmptyInputsHash();

        Draw storage draw = _draws[drawId];
        // seedCommit 이 0 이 아니면 이미 쓴 번호입니다 (취소됐어도 마찬가지).
        if (draw.seedCommit != bytes32(0)) revert DrawAlreadyExists(drawId);

        draw.seedCommit = seedCommit;
        draw.inputsHash = inputsHash;
        draw.commitBlock = uint64(block.number);

        emit DrawOpened(drawId, seedCommit, inputsHash, draw.commitBlock);
    }

    /**
     * 시드를 공개하고 난수를 확정합니다 — **리빌**.
     *
     *   randomness = keccak256(abi.encode(seed, blockhash(commitBlock + 1)))
     *
     * 대상 블록이 **커밋 다음 블록**인 이유는, 커밋하는 순간 그 블록이 아직 존재하지
     * 않아서입니다. 서버가 시드를 아무리 많이 시도해봐도 결과를 미리 알 수 없습니다.
     *
     * 커밋과 같은 블록에서는 부를 수 없습니다 — 대상 블록이 아직 안 생겼습니다.
     * 그 경우 `TooEarly` 입니다. **조금 뒤에 다시 부르면 됩니다.**
     *
     * 반대로 너무 늦으면 `BlockhashExpired` 입니다. 그건 재시도로 안 풀립니다.
     */
    function revealDraw(bytes32 drawId, bytes32 seed) external onlyRole(OPERATOR_ROLE) {
        Draw storage draw = _draws[drawId];
        if (draw.seedCommit == bytes32(0)) revert DrawNotFound(drawId);
        if (draw.canceled) revert DrawIsCanceled(drawId);
        if (draw.revealed) revert DrawAlreadyRevealed(drawId);
        if (keccak256(abi.encode(seed)) != draw.seedCommit) revert SeedMismatch(drawId);

        uint256 targetBlock = uint256(draw.commitBlock) + 1;
        if (block.number <= targetBlock) revert TooEarly(drawId, targetBlock);

        bytes32 blockHash = blockhash(targetBlock);
        // 창을 벗어나면 0 이 돌아옵니다. 0 을 섞으면 난수가 시드만으로 정해져
        // grinding 방어가 통째로 사라지므로, 그 자리에서 멈춥니다.
        if (blockHash == bytes32(0)) revert BlockhashExpired(drawId, targetBlock);

        bytes32 randomness = keccak256(abi.encode(seed, blockHash));
        draw.randomness = randomness;
        draw.revealed = true;

        emit DrawRevealed(drawId, seed, blockHash, randomness);
    }

    /**
     * 되살릴 수 없게 된 추첨을 접습니다.
     *
     * **리빌이 아직 가능한 동안에는 접을 수 없습니다.** 결과가 마음에 안 든다고
     * 즉시 접는 경로를 열어두지 않기 위해서입니다. (창이 지나기를 기다리는 것까지
     * 막지는 못합니다 — 아래를 보세요.)
     *
     * 접어도 `drawId` 는 풀리지 않습니다. 다시 뽑으려면 **새 번호**로 열어야 하고,
     * 그 기록이 체인에 남습니다.
     */
    function cancelDraw(bytes32 drawId) external onlyRole(OPERATOR_ROLE) {
        Draw storage draw = _draws[drawId];
        if (draw.seedCommit == bytes32(0)) revert DrawNotFound(drawId);
        if (draw.revealed) revert DrawAlreadyRevealed(drawId);
        if (draw.canceled) revert DrawIsCanceled(drawId);

        uint256 targetBlock = uint256(draw.commitBlock) + 1;
        // 아직 리빌할 수 있으면 접지 못합니다.
        if (block.number <= targetBlock || blockhash(targetBlock) != bytes32(0)) {
            revert DrawStillRevealable(drawId);
        }

        draw.canceled = true;
        emit DrawCanceled(drawId);
    }

    /**
     * 추첨 하나의 온체인 값 전부. 대사와 사전 확인에 씁니다.
     *
     * `exists` 가 false 면 나머지는 의미가 없습니다.
     * `targetBlock` 을 같이 내려주므로 서비스가 "지금 리빌해도 되는가" 를
     * 블록 번호만 보고 판단할 수 있습니다.
     */
    function getDraw(bytes32 drawId)
        external
        view
        returns (
            bool exists,
            bytes32 seedCommit,
            bytes32 inputsHash,
            uint64 commitBlock,
            uint256 targetBlock,
            bool revealed,
            bool canceled,
            bytes32 randomness
        )
    {
        Draw storage draw = _draws[drawId];
        return (
            draw.seedCommit != bytes32(0),
            draw.seedCommit,
            draw.inputsHash,
            draw.commitBlock,
            uint256(draw.commitBlock) + 1,
            draw.revealed,
            draw.canceled,
            draw.randomness
        );
    }

    /**
     * 확정된 난수만. 배정을 계산하기 직전에 부릅니다.
     *
     * 리빌 전에는 revert 합니다 — 0 을 돌려주면 부르는 쪽이 그걸 난수로 알고
     * **전원이 같은 도안을 받는 배정**을 계산합니다. 조용히 틀리는 것보다 던지는
     * 편이 낫습니다.
     */
    function randomnessOf(bytes32 drawId) external view returns (bytes32) {
        Draw storage draw = _draws[drawId];
        if (draw.seedCommit == bytes32(0)) revert DrawNotFound(drawId);
        if (draw.canceled) revert DrawIsCanceled(drawId);
        if (!draw.revealed) revert TooEarly(drawId, uint256(draw.commitBlock) + 1);
        return draw.randomness;
    }
}
