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
 *   지갑 생성 시드 · 원화 입금 확인  →  mint
 *   티켓 결제 (일부 결제)            →  burn
 *   예매 취소 환급                   →  mint
 *   원화 출금 확인                   →  burn
 *
 * 트레저리로 모으지 않습니다. 그래서 `totalSupply` 가 곧
 * **유저들이 아직 안 쓴 캣머니 총량(= 서비스가 갚아야 할 포인트 부채)** 입니다.
 *
 * 금액과 지급 정책은 **전부 Spring 이 정합니다.** 이 컨트랙트는 판단하지 않습니다.
 * (신규가입 시드 금액도 Spring 이 보냅니다 — DESIGN.md 1장)
 *
 * ── 이 체인의 제약 ────────────────────────────────────────────────
 * SSAFY 체인의 EVM 은 Constantinople 입니다. `block.chainid` 가 없어서
 * **ERC20Permit(EIP-2612)을 붙일 수 없습니다.** (DESIGN.md 8장)
 */
contract CatMoney is ERC20, AccessControl, Pausable {
    /// 캣머니를 발행합니다. API 프로세스가 이 역할을 씁니다.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /// 정지·해제. 사고 대응용이라 API 키와 분리해 두는 것이 좋습니다.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint8 private constant OP_MINT = 1;
    uint8 private constant OP_BURN = 2;
    uint8 private constant OP_TRANSFER = 3;

    /**
     * 실행된 작업. 키는 `_slot()` 이 만듭니다 — **operationKey 를 그대로 쓰지 않습니다.**
     *
     * 그대로 쓰면 mint 와 burn 이 같은 이름공간을 나눠 쓰게 되어,
     * 토큰 1개를 가진 아무나 `burn(1, 예정된_민트키)` 로 남의 발행을 **영구히 막을 수** 있습니다.
     * Spring 의 키는 순번이라 예측 가능하고, 이 체인은 공용이라 실제로 노출됩니다.
     */
    mapping(bytes32 => bool) private _executed;

    event Minted(address indexed to, uint256 amount, bytes32 indexed operationKey);
    event Burned(address indexed from, uint256 amount, bytes32 indexed operationKey);
    event TransferredWithKey(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 indexed operationKey
    );

    /// 같은 operationKey 가 두 번 왔습니다. 서비스는 이걸 성공으로 변환합니다. (4-3)
    error OperationAlreadyExecuted(bytes32 operationKey);
    error AmountMustBePositive();
    error ZeroAddress();

    constructor(address admin, address minter, address operator) ERC20("CatMoney", "TCAT") {
        if (admin == address(0) || minter == address(0) || operator == address(0)) {
            revert ZeroAddress();
        }

        // 셋을 나눠 받는 이유: 한 키가 전부 쥐고 있으면 그 키가 털렸을 때
        // 무제한 발행 + 권한 조작 + 정지 해제가 한꺼번에 가능합니다. (DESIGN.md 6장)
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(OPERATOR_ROLE, operator);
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
     * 발행. 지갑 생성 시드·원화 입금·보상·예매 취소 환급이 전부 여기로 옵니다.
     *
     * `MINTER_ROLE` 만 부를 수 있으므로 외부인이 키를 선점할 수 없습니다.
     * 그래서 실행 기록을 **전역**으로 둡니다 — 같은 operationKey 는 받는 사람이
     * 달라도 딱 한 번만 발행됩니다. Spring 이 키를 실수로 재사용해도 막힙니다.
     */
    function mint(address to, uint256 amount, bytes32 operationKey)
        external
        onlyRole(MINTER_ROLE)
    {
        _consume(_slot(OP_MINT, address(0), operationKey), operationKey, amount);
        _mint(to, amount);
        emit Minted(to, amount, operationKey);
    }

    /**
     * 소각. 티켓 결제(일부 결제)와 원화 출금 확인이 여기로 옵니다.
     *
     * 호출한 계정의 잔액에서 지웁니다. 서버가 유저의 파생 키로 서명하므로
     * `msg.sender` 는 유저입니다 — 온체인에 "누가 썼는지" 가 그대로 남습니다.
     *
     * 실행 기록을 **호출자별로** 둡니다. 이건 누구나 부를 수 있는 함수라,
     * 전역으로 두면 아무나 남의 결제 키를 미리 태워 막을 수 있습니다.
     *
     * 다른 사람의 잔액을 태우는 함수(`burnFrom`)는 두지 않습니다.
     * 그런 게 있으면 키 하나로 전 유저의 포인트를 지울 수 있습니다.
     */
    function burn(uint256 amount, bytes32 operationKey) external whenNotPaused {
        _consume(_slot(OP_BURN, _msgSender(), operationKey), operationKey, amount);
        _burn(_msgSender(), amount);
        emit Burned(_msgSender(), amount, operationKey);
    }

    /**
     * 멱등 전송. 포카 마켓의 유저 간 정산이 여기로 옵니다.
     *
     * 표준 `transfer` 로는 재시도를 막을 수 없습니다 — 키를 걸 자리가 없어서
     * 응답을 못 받고 다시 보내면 두 번 송금됩니다. 마켓 정산에서 그 일이 나면
     * 구매자가 두 번 냅니다.
     *
     * 보내는 쪽이 직접 부릅니다(서버가 파생 키로 서명). 실행 기록도 호출자별입니다 —
     * 누구나 부를 수 있는 함수라 전역으로 두면 남의 정산 키를 미리 소비할 수 있습니다.
     *
     * `transfer` 도 그대로 남겨둡니다. 지갑·탐색기가 표준을 기대하기 때문입니다.
     */
    function transferWithKey(address to, uint256 amount, bytes32 operationKey)
        external
        whenNotPaused
        returns (bool)
    {
        _consume(_slot(OP_TRANSFER, _msgSender(), operationKey), operationKey, amount);
        _transfer(_msgSender(), to, amount);
        emit TransferredWithKey(_msgSender(), to, amount, operationKey);
        return true;
    }

    // ── 조회 ──────────────────────────────────────────────────────
    // 응답을 못 받았을 때 서비스가 "이미 했는지" 확인하는 용도입니다. (DESIGN.md 4-3)

    function isMintExecuted(bytes32 operationKey) external view returns (bool) {
        return _executed[_slot(OP_MINT, address(0), operationKey)];
    }

    function isBurnExecuted(address account, bytes32 operationKey) external view returns (bool) {
        return _executed[_slot(OP_BURN, account, operationKey)];
    }

    function isTransferExecuted(address account, bytes32 operationKey)
        external
        view
        returns (bool)
    {
        return _executed[_slot(OP_TRANSFER, account, operationKey)];
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
       막습니다   : burn · transfer · transferFrom · transferWithKey
                    (유저 잔액에서 **나가는** 것)
       안 막습니다: mint                            (유저 잔액으로 **들어오는** 것)

       사고로 컨트랙트를 멈춰도 환불 경로는 살아 있어야 합니다.
       이 모델에서 환급은 `mint` 이므로, mint 를 막으면 환불이 함께 멈춥니다.

       발행 키가 털린 경우는 정지가 아니라 `MINTER_ROLE` 을 회수합니다.
       정지는 "뭔가 잘못됐으니 유저 자산이 빠져나가는 걸 멈춘다" 용도입니다. */

    // ── 내부 ──────────────────────────────────────────────────────

    /**
     * 실행 기록의 자리를 만듭니다.
     *
     * `account` 는 mint 면 `address(0)`(전역), burn 이면 호출자입니다.
     * `abi.encode` 를 씁니다 — `encodePacked` 는 붙여 쓰는 값에 따라
     * 서로 다른 입력이 같은 해시가 될 수 있습니다.
     */
    function _slot(uint8 op, address account, bytes32 operationKey) private pure returns (bytes32) {
        return keccak256(abi.encode(op, account, operationKey));
    }

    function _consume(bytes32 slot, bytes32 operationKey, uint256 amount) private {
        if (amount == 0) revert AmountMustBePositive();
        if (_executed[slot]) revert OperationAlreadyExecuted(operationKey);
        _executed[slot] = true;
    }
}
