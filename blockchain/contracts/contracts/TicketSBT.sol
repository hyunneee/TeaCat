// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * 티켓 SBT — 양도할 수 없는 티켓. (DESIGN.md 6장 ①)
 *
 * **"암표를 막는다" 가 코드로 증명되는 자리입니다.** 발행과 소각만 통과시키고
 * 유저 간 이동을 컨트랙트가 거부합니다. 약관이 아니라 EVM 이 막습니다.
 *
 * ── tokenId 가 곧 ticketKey 입니다 ────────────────────────────────
 *
 *   tokenId = uint256(keccak256(ticketKey))
 *
 * 순번을 매기지 않습니다. 번호가 `ticketKey` 에서 계산되므로 **트랜잭션을 보내기
 * 전에 이미 정해져 있고**, 서비스가 블록 확정을 기다리지 않고 Spring 에게
 * 돌려줄 수 있습니다. SSAFY 체인은 블록이 약 10초라, 순번이면 그만큼 기다려야
 * 번호를 알 수 있습니다. (DESIGN.md 4-2)
 *
 * 덤으로 저장할 것이 줄었습니다. 번호가 키라서 `키 → 번호` 매핑도,
 * `번호 → 키` 매핑도 필요 없습니다.
 *
 * ── 온체인에 두는 것 ──────────────────────────────────────────────
 *
 *   tokenId      발행될 때 부여되는 번호. 곧 ticketKey 의 해시입니다
 *   owner        "지금 이 티켓을 누가 갖고 있는가" 의 유일한 근거
 *   everIssued   발행된 적 있는가 (소각 후에도 남습니다 — 아래)
 *
 * 좌석·공연·상태(입장 여부)는 **Spring DB 가 소유합니다.** 이 컨트랙트는 모릅니다.
 * 티켓 DB 가 따로 있고 거기가 진짜 원본이라, 같은 값을 체인에 또 두면 두 벌이 되고
 * 둘이 어긋나는 순간 어느 쪽이 맞는지 판단할 근거가 사라집니다.
 * **얼굴 벡터는 이 서비스로 오지도 않습니다.**
 *
 * ── 취소는 소각입니다 ─────────────────────────────────────────────
 *
 *   발행 (결제 완료 후)  →  mint
 *   취소                 →  burn   ← tokenId 는 영구 소멸
 *   취소표 당첨자         →  mint   ← **새 ticketKey 로 새 tokenId**
 *
 * 소각하면 `ownerOf` 가 revert 하므로 **존재 자체가 유효성**입니다.
 * 소각 이력은 상태에서 사라지지만 `Transfer(owner → 0x0)` 이벤트 로그에는
 * 영구히 남습니다 — 다만 로그는 조회 가능한 상태가 아니라, 꺼내려면 인덱서가
 * 필요합니다. 그 정도로 충분하다는 판단 위에 선 구조입니다.
 *
 * ── 이 체인의 제약 ────────────────────────────────────────────────
 * SSAFY 체인의 EVM 은 Constantinople 입니다. `block.chainid` 가 없어서
 * **EIP-712 서명(permit 류)을 붙일 수 없습니다.** (DESIGN.md 8장)
 */
contract TicketSBT is ERC721, AccessControl {
    /// 티켓을 발행합니다. API 프로세스가 이 역할을 씁니다.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /// 소각(예매 취소)과 정지 스위치. 사고 대응용이라 발행 키와 분리해 둡니다.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
     * 이 번호로 발행된 적이 있는가. **중복 발행을 막는 유일한 장치입니다.** (DESIGN.md 4-3)
     *
     * 이 서비스는 DB 가 없어서 "이 요청을 이미 처리했다" 를 기억하지 못합니다.
     * tx 를 보낸 직후 응답 전에 죽으면 Spring 은 실패로 보고 재시도하는데,
     * 그때 한 결제에 티켓이 두 장 나가는 걸 막을 수 있는 건 체인뿐입니다.
     * "tx 가 나갔는지" 는 보낸 쪽만 아는데 그 쪽이 죽었기 때문입니다.
     *
     * **소각해도 지우지 않습니다.** 두 가지를 동시에 합니다.
     *   1. 취소된 예매가 같은 키로 되살아나는 것을 막습니다
     *   2. "소각된 번호" 와 "애초에 없는 번호" 를 구분해 줍니다 —
     *      `ownerOf` 는 둘 다 똑같이 revert 하기 때문입니다
     *
     * 취소표 재판매는 Spring 이 만든 **새 `ticketKey`** 로 들어오고, 당첨자는
     * 새 tokenId 를 받습니다.
     *
     * 좌석 중복은 여기서 막지 않습니다 — 그건 결제 전 **좌석 선점**이 끝내는
     * 문제입니다. 발행 시점에는 그 좌석이 이미 그 사람 것으로 확정돼 있습니다.
     */
    mapping(uint256 => bool) public everIssued;

    /// 발행된 총 장수(소각분 포함). 대사(reconciliation)에 씁니다.
    uint256 public totalIssued;

    /**
     * 발행 정지 스위치.
     *
     * 잘못된 발행이 쏟아질 때 당깁니다. 늦게 나간 티켓은 나중에 발행하면
     * 그만이지만, **잘못 나간 티켓은 공용 체인에 영구히 남습니다** — 한 장씩
     * 소각해도 발행 이력 자체는 지워지지 않습니다. 그 비대칭이 근거입니다.
     *
     * **소각에는 걸지 않습니다.** 사고로 발행을 멈춰도 환불 경로는 살아 있어야
     * 합니다. (DESIGN.md 결정 이력 2026-09-02)
     *
     * 발행 키가 털린 경우는 이게 아니라 `MINTER_ROLE` 회수로 대응합니다.
     */
    bool public issuePaused;

    event TicketIssued(uint256 indexed tokenId, address indexed to);
    event TicketBurned(uint256 indexed tokenId, address indexed from);
    event IssuePausedSet(bool paused);

    /* ── 에러 ──────────────────────────────────────────────────────
       **이름 하나가 판정 하나에 대응해야 합니다.**

       revert 된 트랜잭션은 이벤트를 남기지 않습니다. 그래서 `GET /internal/tx/…`
       는 영수증만 보고는 무슨 함수였는지 알 수 없고 **에러 이름만** 읽습니다.
       취소 재시도(성공으로 변환)와 엉뚱한 번호(진짜 실패)를 같은 이름으로 던지면
       서비스가 구분하지 못합니다. */

    /// 양도 시도. 이 티켓은 발행된 주소에서 움직이지 않습니다.
    error TicketNotTransferable();
    /// 같은 `ticketKey` 가 두 번 왔습니다. 서비스가 성공으로 변환합니다. (4-3)
    error AlreadyIssued(uint256 tokenId);
    /// 이미 소각됐습니다. 취소 재시도라면 성공으로 변환합니다.
    error TicketAlreadyBurned(uint256 tokenId);
    /// 발행된 적 없는 번호입니다. 재시도로 풀리지 않습니다.
    error TicketNotFound(uint256 tokenId);
    error IssueIsPaused();
    error ZeroAddress();
    /// `ticketKey` 해시가 0 입니다. 0 번 토큰은 두지 않습니다.
    error EmptyTicketKey();

    constructor(address admin, address minter, address operator)
        ERC721("TeaCat Ticket", "TCKT")
    {
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
     * `ticketKey` 해시 → tokenId. 그냥 형변환입니다.
     *
     * 함수로 두는 이유는 이 관계가 **계약이라는 것을 코드에 못박기** 위해서입니다.
     * 서버도 같은 계산을 하고, 그게 어긋나면 엉뚱한 토큰을 가리키게 됩니다.
     */
    function tokenIdOf(bytes32 ticketKeyHash) public pure returns (uint256) {
        return uint256(ticketKeyHash);
    }

    // ── 서비스 경로 ────────────────────────────────────────────────

    /**
     * 발행. **결제가 완료된 뒤** Spring 이 부릅니다.
     *
     * `ticketKeyHash` 는 Spring 이 정한 유일 키(주문번호·티켓 PK)를 서버가
     * keccak256 한 값입니다. 같은 키가 다시 오면 `AlreadyIssued(tokenId)` 로
     * 거부하고, 서비스가 그것을 **성공으로 변환**합니다. (DESIGN.md 4-3)
     *
     * `_safeMint` 를 씁니다. 티켓을 받을 수 없는 컨트랙트 주소로 발행되면
     * 그 티켓은 양도도 안 되므로 **영원히 갇힙니다** — 그 자리에서 revert 시키는
     * 편이 낫습니다.
     */
    function issue(address to, bytes32 ticketKeyHash)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (issuePaused) revert IssueIsPaused();
        if (to == address(0)) revert ZeroAddress();
        if (ticketKeyHash == bytes32(0)) revert EmptyTicketKey();

        tokenId = tokenIdOf(ticketKeyHash);
        if (everIssued[tokenId]) revert AlreadyIssued(tokenId);

        // 장부를 먼저 쓰고 발행합니다. `_safeMint` 는 받는 쪽으로 외부 호출을
        // 하므로, 그 전에 이 컨트랙트의 상태를 끝내둡니다.
        everIssued[tokenId] = true;
        totalIssued += 1;

        _safeMint(to, tokenId);
        emit TicketIssued(tokenId, to);
    }

    /**
     * 소각 — 예매 취소.
     *
     * tokenId 는 영구 소멸합니다. 재발행하지 않습니다. 취소표가 다른 사람에게
     * 가면 **새 `ticketKey` 로 새 tokenId** 가 나갑니다.
     *
     * 정지 스위치를 걸지 않습니다. 사고로 발행을 멈춰도 환불 경로는 살아
     * 있어야 합니다. (DESIGN.md 결정 이력 2026-09-02)
     */
    function burnTicket(uint256 tokenId) external onlyRole(OPERATOR_ROLE) {
        if (!everIssued[tokenId]) revert TicketNotFound(tokenId);

        address owner = _ownerOf(tokenId);
        if (owner == address(0)) revert TicketAlreadyBurned(tokenId);

        _burn(tokenId);
        emit TicketBurned(tokenId, owner);
    }

    // ── 조회 ──────────────────────────────────────────────────────
    // 화면용이 아닙니다. 대사(reconciliation)와 복구에 씁니다. (DESIGN.md 4-5)

    /**
     * 티켓 한 장의 온체인 값 전부.
     *
     * `ownerOf` 는 없는 토큰에서 revert 하고, **소각된 토큰과 애초에 없는
     * 번호를 구분하지 못합니다.** 그래서 둘을 갈라 내려줍니다.
     *
     *   issued=false                 발행된 적 없는 번호
     *   issued=true,  owner=0        발행됐다가 소각됨 (예매 취소)
     *   issued=true,  owner!=0       살아 있는 티켓
     */
    function getTicket(uint256 tokenId) external view returns (bool issued, address owner) {
        return (everIssued[tokenId], _ownerOf(tokenId));
    }

    /**
     * `ticketKey` 로 발행 결과를 찾습니다. 응답을 못 받았을 때 **복구용**입니다. (4-3)
     *
     * `tokenId` 는 발행 전이어도 계산됩니다 — 그 키가 갖게 될 번호입니다.
     * 소각된 티켓도 `issued=true` 입니다. 그 키는 이미 소비됐습니다.
     */
    function issuedTicket(bytes32 ticketKeyHash)
        external
        view
        returns (bool issued, uint256 tokenId, address owner)
    {
        tokenId = tokenIdOf(ticketKeyHash);
        return (everIssued[tokenId], tokenId, _ownerOf(tokenId));
    }

    // ── 운영 ──────────────────────────────────────────────────────

    function setIssuePaused(bool paused) external onlyRole(OPERATOR_ROLE) {
        issuePaused = paused;
        emit IssuePausedSet(paused);
    }

    // ── 양도 불가 (SBT) ───────────────────────────────────────────

    /**
     * **이 컨트랙트의 존재 이유입니다.**
     *
     * ERC-721 의 모든 이동은 `_update` 를 지납니다 — `transferFrom`,
     * `safeTransferFrom`, 내부 `_transfer` 까지 전부. 여기 한 군데를 막으면
     * 우회로가 없습니다. 함수마다 막으면 하나 빠뜨리는 순간 뚫립니다.
     *
     * 발행(`from == 0`)과 소각(`to == 0`)만 통과시킵니다.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert TicketNotTransferable();
        return super._update(to, tokenId, auth);
    }

    /**
     * 승인도 막습니다.
     *
     * 승인만으로는 아무것도 옮겨지지 않지만, 열어두면 마켓플레이스가 티켓을
     * **팔 수 있는 물건으로 표시합니다.** 사는 사람이 결제까지 하고 나서야
     * 전송이 revert 됩니다. 여기서 막으면 목록에 오르지도 않습니다.
     */
    function approve(address, uint256) public pure override {
        revert TicketNotTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert TicketNotTransferable();
    }

    // ── 표준 ──────────────────────────────────────────────────────

    /// ERC721 과 AccessControl 이 둘 다 구현합니다. 합쳐주지 않으면 컴파일이 안 됩니다.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
