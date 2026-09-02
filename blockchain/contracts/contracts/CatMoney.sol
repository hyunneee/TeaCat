// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * 캣머니 — 티캣 서비스 안에서 쓰는 포인트 토큰. (DESIGN.md 6장 ②)
 *
 * 프론트의 `PayMethod = 'POINT'` 가 이 토큰입니다.
 *
 * ── 캣머니는 발행과 소각으로만 움직입니다 ─────────────────────────
 *
 *   원화 입금 확인 (Spring)  →  mint
 *   티켓 결제 (일부 결제)     →  burn
 *   예매 취소 환급           →  mint
 *   원화 출금 확인 (Spring)  →  burn
 *
 * 트레저리로 모으지 않습니다. 그래서 `totalSupply` 가 곧
 * **유저들이 아직 안 쓴 캣머니 총량(= 서비스가 갚아야 할 포인트 부채)** 입니다.
 * 트레저리에 쌓아두면 "서비스 것"과 "유저 것"이 한 숫자에 섞여 이 값이 의미를 잃습니다.
 *
 * 포카 마켓의 유저 간 정산은 표준 `transfer` 입니다. 여기에도 트레저리가 끼지 않습니다.
 *
 * ── 왜 표준 ERC-20 위에 함수를 더 얹었나 ──────────────────────────
 * `transfer`·`burn` 만으로는 재시도를 막을 수 없습니다. Spring 이 tx 를 보낸 직후
 * 응답 전에 죽으면 다시 보내고, 그러면 두 번 나갑니다. 그래서 상태를 바꾸는 경로마다
 * `operationKey` 를 둡니다. (DESIGN.md 4-3 — 멱등은 컨트랙트가 보장합니다)
 *
 * `transfer`·`approve` 는 표준 그대로 둡니다. 지갑·탐색기가 그대로 읽습니다.
 *
 * ── 이 체인의 제약 ────────────────────────────────────────────────
 * SSAFY 체인의 EVM 은 Constantinople 입니다. `block.chainid` 가 없어서
 * **ERC20Permit(EIP-2612)을 붙일 수 없습니다.** 서명 기반 승인이 필요해지면
 * 그때는 체인을 옮겨야 합니다. (DESIGN.md 8장)
 */
contract CatMoney is ERC20, AccessControl, Pausable {
    /// 캣머니를 발행합니다. 원화 입금·보상 지급·예매 취소 환급.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /// 정지·해제 등 운영 동작.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// operationKey → 실행 여부. Spring 이 만든 키를 해싱해서 넣습니다.
    mapping(bytes32 => bool) public executed;

    event Minted(address indexed to, uint256 amount, bytes32 indexed operationKey);
    event Burned(address indexed from, uint256 amount, bytes32 indexed operationKey);

    /// 같은 operationKey 가 두 번 왔습니다. 서비스는 이걸 성공으로 변환합니다. (4-3)
    error OperationAlreadyExecuted(bytes32 operationKey);
    error AmountMustBePositive();
    error ZeroAddress();

    constructor(address admin) ERC20("CatMoney", "TCAT") {
        if (admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /**
     * 캣머니는 정수로 세는 포인트입니다. 18 로 두면 서버·프론트 양쪽에
     * 환산 로직이 생겨 반드시 어긋납니다. (DESIGN.md 6장 ②)
     */
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    // ── 서비스 경로 ────────────────────────────────────────────────

    /**
     * 발행. 원화 입금 확인·보상 지급·예매 취소 환급이 전부 여기로 옵니다.
     * 무엇 때문에 발행하는지는 Spring 이 `operationKey` 로 구분합니다.
     *
     * 주의: `whenNotPaused` 를 걸지 않습니다. 아래 "정지" 설명 참고.
     */
    function mint(address to, uint256 amount, bytes32 operationKey)
        external
        onlyRole(MINTER_ROLE)
    {
        _consume(operationKey, amount);
        _mint(to, amount);
        emit Minted(to, amount, operationKey);
    }

    /**
     * 소각. 티켓 결제(일부 결제)와 원화 출금 확인이 여기로 옵니다.
     *
     * 호출한 계정의 잔액에서 지웁니다. 서버가 유저의 파생 키로 서명하므로
     * `msg.sender` 는 유저입니다 — 온체인에 "누가 썼는지" 가 그대로 남습니다.
     *
     * 다른 사람의 잔액을 태우는 함수(`burnFrom`)는 두지 않습니다.
     * 그런 게 있으면 키 하나로 전 유저의 포인트를 지울 수 있습니다.
     */
    function burn(uint256 amount, bytes32 operationKey) external whenNotPaused {
        _consume(operationKey, amount);
        _burn(_msgSender(), amount);
        emit Burned(_msgSender(), amount, operationKey);
    }

    // ── 운영 ──────────────────────────────────────────────────────

    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // ── 표준 ERC-20 ───────────────────────────────────────────────

    function transfer(address to, uint256 value) public override whenNotPaused returns (bool) {
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value)
        public
        override
        whenNotPaused
        returns (bool)
    {
        return super.transferFrom(from, to, value);
    }

    /* ── 정지가 막는 것과 막지 않는 것 ─────────────────────────────
       막습니다   : burn · transfer · transferFrom  (유저 잔액에서 **나가는** 것)
       안 막습니다: mint                            (유저 잔액으로 **들어오는** 것)

       사고로 컨트랙트를 멈춰도 환불 경로는 살아 있어야 합니다.
       이 모델에서 환급은 `mint` 이므로, mint 를 막으면 환불이 함께 멈춥니다.
       (DESIGN.md 결정 이력 2026-09-02, TicketSBT 의 취소와 같은 이유)

       발행 키가 털린 경우는 정지로 막는 게 아니라 `MINTER_ROLE` 을 회수합니다.
       정지는 "뭔가 잘못됐으니 유저 자산이 빠져나가는 걸 멈춘다" 용도입니다.
       두 사고에 같은 도구를 쓰면 둘 다 어설프게 막습니다. */

    // ── 내부 ──────────────────────────────────────────────────────

    function _consume(bytes32 operationKey, uint256 amount) private {
        if (amount == 0) revert AmountMustBePositive();
        if (executed[operationKey]) revert OperationAlreadyExecuted(operationKey);
        executed[operationKey] = true;
    }
}
