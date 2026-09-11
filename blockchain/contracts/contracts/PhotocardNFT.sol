// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * 포토카드 NFT — 공연 관람의 증표. (PHOTOCARD_PLAN.md)
 *
 * 티켓과 반대로 **팔라고 만든 물건입니다.** 양도를 막지 않고, 마켓에서 캣머니로
 * 거래됩니다. 대신 두 가지를 체인이 약속합니다 — **한정 수량**과 **그림**.
 *
 * ── tokenId 는 카드 한 장이 아니라 도안입니다 ────────────────────
 *
 *   tokenId 11  =  도안 11번        balanceOf(alice, 11) = 3
 *
 * `nft_photocard_designs.id` 를 그대로 씁니다. 해싱하지 않습니다 — 도안 번호는
 * 이미 유일하고 발행보다 한참 먼저 정해져 있어서, 티켓처럼 키에서 번호를 만들어
 * 낼 이유가 없습니다.
 *
 * **같은 도안의 두 장은 구별되지 않습니다.** 이름도 그림도 같고, 다른 것은
 * "몇 번 좌석에서 나왔는가" 뿐인데 그건 `nft_photocards` 행이 갖고 있습니다.
 * 그래서 체인이 답하는 질문은 하나입니다 — **"이 사람이 이 도안을 몇 장 갖고 있나."**
 *
 * ERC-1155 를 고른 이유가 여기입니다. 카드마다 번호를 매기면 1155 에는 `ownerOf`
 * 가 없어서 정작 "이 카드 누구 것" 을 못 묻고, ERC-721 을 손으로 다시 만들게 됩니다.
 *
 * ── 온체인에 두는 것 ──────────────────────────────────────────────
 *
 *   maxSupply[id]   한정 수량. 초과 발행을 컨트랙트가 거부합니다
 *   totalSupply(id) 발행된 장수 (ERC1155Supply)
 *   balanceOf       누가 몇 장 갖고 있는가
 *   _tokenUri[id]   그 도안의 IPFS 메타데이터 CID
 *
 * 좌석·공연·소유자 닉네임·거래 이력은 **Spring DB 가 소유합니다.** 카드 한 장의
 * 정체성(`nft_photocards.id`)도 체인에 없습니다 — 발행 때 중복을 막으려고 한 번
 * 쓰고 버리는 멱등 키로만 지나갑니다.
 *
 * ── 그림을 못 바꾸게 하는 세 가지 ────────────────────────────────
 *
 *   1. 도안마다 CID     템플릿 하나면 전역 교체가 가능합니다
 *   2. setURI 없음      전역 레버가 남아 있으면 1이 무의미해집니다
 *   3. 첫 발행 후 동결  아래
 *
 * CID 는 내용 주소라, 그림을 바꾸면 이미지 CID 가 바뀌고 → JSON 이 바뀌고 →
 * `metadataCid` 가 바뀝니다. 온체인 값과 어긋나므로 **대조하면 걸립니다.**
 *
 * ── 이 체인의 제약 ────────────────────────────────────────────────
 * SSAFY 체인의 EVM 은 Constantinople 입니다. `block.chainid` 가 없어서 EIP-712
 * 서명을 붙일 수 없고, 그래서 **서명 기반 주문서(마켓플레이스 표준)를 못 만듭니다.**
 * 마켓 정산은 서버가 판매자 키로 서명하는 `transferWithKey` 로 갑니다.
 * OpenZeppelin 은 `5.1.0` 고정입니다 — 5.2+ 는 `mcopy` 를 써서 컴파일이 안 됩니다.
 * (DESIGN.md 8장)
 */
contract PhotocardNFT is ERC1155Supply, AccessControl {
    /// 카드를 발행합니다. API 프로세스가 이 역할을 씁니다.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /// 도안 등록과 정지 스위치. 사고 대응용이라 발행 키와 분리해 둡니다.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
     * 한 배치의 상한.
     *
     * 이 체인은 블록 가스 리밋이 사실상 무제한이라(2^53-1) 가스가 이유는 아닙니다.
     * calldata 크기와 **실패의 폭발 반경** 때문입니다 — 배치 하나가 revert 하면
     * 그 안의 전부가 실패하므로, 500건짜리를 통째로 날리는 것보다 잘라 두는 편이
     * 낫습니다. 서비스도 같은 값으로 막아 상한을 두 군데에서 겁니다.
     */
    uint256 public constant MAX_BATCH = 200;

    /* ── 멱등 이름공간 ──────────────────────────────────────────────
       **작업 종류마다 실행 기록을 나눕니다.** 캣머니에서 실제로 터진 사고입니다 —
       `mint` 와 `burn` 이 기록을 공유해서, 토큰 1개 가진 아무나 예정된 키를
       선점해 남의 발행을 영구히 막을 수 있었습니다. Spring 키는 순번이라 예측
       가능하고 이 체인은 공용이라 실제로 노출됩니다. */
    uint8 private constant OP_ISSUE = 1;
    uint8 private constant OP_TRANSFER = 2;

    /**
     * 실행된 작업. 키는 `_slot()` 이 만듭니다 — **원본 키를 그대로 쓰지 않습니다.**
     *
     * 이 서비스는 "이 요청을 이미 처리했다" 를 기억하지 못합니다. tx 를 보낸 직후
     * 응답 전에 죽으면 Spring 은 실패로 보고 재시도하는데, 그때 한 티켓에 카드가
     * 두 장 나가는 걸 막을 수 있는 건 체인뿐입니다. (DESIGN.md 4-3)
     */
    mapping(bytes32 => bool) private _executed;

    /// 도안별 한정 수량. **0 이면 등록되지 않은 도안**입니다.
    mapping(uint256 => uint256) public maxSupply;

    /// 도안별 메타데이터 URI (`ipfs://<metadataCid>`). `uri()` 가 이걸 돌려줍니다.
    mapping(uint256 => string) private _tokenUri;

    /**
     * 발행 정지 스위치.
     *
     * 잘못된 발행이 쏟아질 때 당깁니다. 늦게 나간 카드는 나중에 발행하면 그만이지만
     * **잘못 나간 카드는 공용 체인에 영구히 남습니다.**
     *
     * **이동에는 걸지 않습니다.** 유저가 자기 카드를 옮기는 것은 사고와 무관합니다.
     * 발행 키가 털린 경우는 정지가 아니라 `MINTER_ROLE` 회수로 대응합니다.
     */
    bool public issuePaused;

    /* ── 이벤트 ────────────────────────────────────────────────────
       `tokenId` 라는 이름을 씁니다. `api/src/chain/tx.ts` 가 이벤트 인자에서
       그 이름을 찾아 `TxReport.result.tokenId` 를 채웁니다. `designId` 로 두면
       그 경로가 조용히 null 을 내려보냅니다. */

    event DesignRegistered(uint256 indexed tokenId, uint256 maxSupply, string metadataUri);
    event PhotocardIssued(uint256 indexed tokenId, address indexed to, bytes32 indexed photocardKey);
    /// 이미 발행된 키라 건너뛰었습니다. **실패가 아닙니다** — 재전송의 정상 결과입니다.
    event IssueSkipped(bytes32 indexed photocardKey);
    event PhotocardTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        bytes32 operationKey
    );
    event IssuePausedSet(bool paused);

    /* ── 에러 ──────────────────────────────────────────────────────
       **이름 하나가 판정 하나에 대응해야 합니다.** revert 된 트랜잭션은 이벤트를
       남기지 않아서, `GET /internal/tx/…` 가 영수증에서 읽을 수 있는 건 에러
       이름뿐입니다. 재시도로 풀리는 것과 안 풀리는 것을 같은 이름으로 던지면
       서비스가 구분하지 못합니다. */

    /// 같은 `operationKey` 가 두 번 왔습니다. 서비스가 성공으로 변환합니다. (4-3)
    error OperationAlreadyExecuted(bytes32 operationKey);
    /// 등록된 적 없는 도안입니다. 재시도로 풀리지 않습니다.
    error DesignNotRegistered(uint256 tokenId);
    /// 한정 수량을 넘깁니다.
    error DesignSoldOut(uint256 tokenId);
    /// 이미 카드가 나간 도안이라 수량·URI 를 바꿀 수 없습니다.
    error DesignFrozen(uint256 tokenId);
    error InvalidDesignId();
    error InvalidMaxSupply();
    error EmptyMetadataUri();
    /// 카드 키가 0 입니다. 0 은 "키 없음" 과 구분되지 않습니다.
    error EmptyKey();
    error LengthMismatch();
    error BatchTooLarge(uint256 length);
    error IssueIsPaused();
    error ZeroAddress();

    /**
     * `uri` 를 빈 문자열로 넘깁니다. `uri()` 를 오버라이드해서 도안별 값을
     * 돌려주므로 ERC1155 가 들고 있는 전역 문자열은 쓰이지 않습니다.
     */
    constructor(address admin, address minter, address operator) ERC1155("") {
        if (admin == address(0) || minter == address(0) || operator == address(0)) {
            revert ZeroAddress();
        }

        // 셋을 나눠 받는 이유: 한 키가 전부 쥐고 있으면 그 키가 털렸을 때
        // 무제한 발행 + 권한 조작 + 정지 해제가 한꺼번에 가능합니다. (DESIGN.md 6장)
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(OPERATOR_ROLE, operator);
    }

    // ── 도안 ──────────────────────────────────────────────────────

    /**
     * 도안을 등록합니다. **발행보다 먼저 불러야 합니다.**
     *
     * `metadataUri` 는 Pinata 에 핀한 **메타데이터 JSON** 의 주소입니다
     * (`ipfs://<metadataCid>`). 이미지 CID 가 아닙니다 — 이미지는 그 JSON 의
     * `image` 필드 안에 들어 있습니다.
     *
     * ── 첫 장이 나가면 잠깁니다 ────────────────────────────────────
     *
     *   totalSupply(id) == 0  →  다시 불러서 수량·URI 를 고칠 수 있습니다
     *   totalSupply(id) >  0  →  DesignFrozen. 영구히 잠깁니다
     *
     * 등록 즉시 얼리지 않는 이유는, **개발 중에 도안이 반드시 바뀌기 때문**입니다.
     * 잘못된 파일·해상도·오타. 그때 못 고치면 잘못된 그림으로 서비스하거나, 고치고
     * 온체인 값을 방치해 **체인이 거짓을 주장하게** 됩니다. 후자가 더 나쁩니다.
     *
     * 한 장도 안 나갔으면 바꿔도 다치는 사람이 없습니다 — 약속을 받은 보유자가
     * 아직 없습니다. 첫 장이 나가는 순간 그 사람에게 "이 그림, 이 수량" 을 약속한
     * 것이고 거기서부터 잠급니다. 포카에는 소각이 없어 `totalSupply` 가 줄지
     * 않으므로 **한 번 잠기면 풀리지 않습니다.**
     *
     * 같은 값으로 다시 부르는 것은 막지 않습니다. 서비스가 미리 비교해
     * `ALREADY_DONE` 으로 바꾸므로 여기까지 오지 않지만, 와도 결과가 같습니다.
     */
    function registerDesign(uint256 tokenId, uint256 max, string calldata metadataUri)
        external
        onlyRole(OPERATOR_ROLE)
    {
        // 0 번 토큰은 두지 않습니다. `maxSupply[0] == 0` 이 "미등록" 과 겹칩니다.
        if (tokenId == 0) revert InvalidDesignId();
        if (max == 0) revert InvalidMaxSupply();
        if (bytes(metadataUri).length == 0) revert EmptyMetadataUri();
        if (totalSupply(tokenId) != 0) revert DesignFrozen(tokenId);

        maxSupply[tokenId] = max;
        _tokenUri[tokenId] = metadataUri;

        emit DesignRegistered(tokenId, max, metadataUri);
        // ERC-1155 표준 이벤트입니다. 탐색기·지갑이 이걸 보고 메타데이터를 다시 읽습니다.
        emit URI(metadataUri, tokenId);
    }

    /**
     * 도안 하나의 온체인 값 전부. **대사(reconciliation)와 사전 확인용**입니다.
     *
     * `max == 0` 이면 등록되지 않은 도안이고 나머지 값은 의미가 없습니다.
     * `frozen` 은 첫 장이 나갔는지 — 다시 등록할 수 있는지를 서비스가 미리 봅니다.
     */
    function getDesign(uint256 tokenId)
        external
        view
        returns (uint256 max, uint256 issued, string memory metadataUri, bool frozen)
    {
        issued = totalSupply(tokenId);
        return (maxSupply[tokenId], issued, _tokenUri[tokenId], issued != 0);
    }

    // ── 발행 ──────────────────────────────────────────────────────

    /**
     * 배치 발행. **결제가 아니라 공연 확정 뒤** Spring 이 부릅니다.
     *
     * 세 배열은 같은 길이여야 하고 같은 인덱스끼리 한 장을 이룹니다 —
     * `to[i]` 에게 `tokenIds[i]` 도안을 `keys[i]` 키로 한 장.
     *
     * ── 중복은 revert 가 아니라 skip 입니다 ────────────────────────
     *
     * **중복 하나가 200건을 통째로 죽이면 안 됩니다.** 건너뛰면 응답을 못 받았을 때
     * **같은 본문을 그대로 재전송하는 것**이 정답이 됩니다 — Spring 이 할 수 있는
     * 가장 단순한 행동이고, 전부 이미 나갔으면 전부 건너뛰고 성공으로 끝납니다.
     *
     * 티켓은 한 건짜리라 `AlreadyIssued` revert 로 갈 수 있었습니다. 배치는 다릅니다.
     *
     * ── 실패하는 경우 ─────────────────────────────────────────────
     *
     * 미등록 도안·수량 초과는 **배치 전체를 revert 시킵니다.** 그 자리만 건너뛰면
     * Spring 은 성공으로 알고 넘어가는데 그 카드는 영원히 안 나갑니다 —
     * 조용히 빠지는 것보다 통째로 실패하는 편이 낫습니다. 서비스가 보내기 전에
     * 미리 확인해서 대부분 여기까지 오지 않습니다.
     */
    function issueBatch(
        address[] calldata to,
        uint256[] calldata tokenIds,
        bytes32[] calldata keys
    ) external onlyRole(MINTER_ROLE) {
        if (issuePaused) revert IssueIsPaused();

        uint256 length = to.length;
        if (length != tokenIds.length || length != keys.length) revert LengthMismatch();
        if (length == 0 || length > MAX_BATCH) revert BatchTooLarge(length);

        for (uint256 i = 0; i < length; i++) {
            bytes32 key = keys[i];
            if (key == bytes32(0)) revert EmptyKey();

            bytes32 slot = _slot(OP_ISSUE, address(0), key);
            if (_executed[slot]) {
                emit IssueSkipped(key);
                continue;
            }

            uint256 tokenId = tokenIds[i];
            uint256 max = maxSupply[tokenId];
            if (max == 0) revert DesignNotRegistered(tokenId);
            if (totalSupply(tokenId) + 1 > max) revert DesignSoldOut(tokenId);

            // 장부를 먼저 씁니다. `_mint` 는 받는 쪽으로 외부 호출을 할 수 있으므로
            // 그 전에 이 컨트랙트의 상태를 끝내둡니다.
            _executed[slot] = true;

            _mint(to[i], tokenId, 1, "");
            emit PhotocardIssued(tokenId, to[i], key);
        }
    }

    /**
     * 이 카드 키로 발행된 적이 있는가. **응답을 못 받았을 때 복구용**입니다. (4-3)
     *
     * 도안도 소유자도 돌려주지 않습니다 — 컨트랙트가 갖고 있지 않습니다.
     * 그건 `nft_photocards` 행이 이미 아는 값이라 체인에 두면 두 벌이 됩니다.
     */
    function isIssued(bytes32 photocardKey) external view returns (bool) {
        return _executed[_slot(OP_ISSUE, address(0), photocardKey)];
    }

    // ── 이동 ──────────────────────────────────────────────────────

    /**
     * 멱등 이동 — 마켓 정산에 씁니다. **보유자 본인이 서명합니다.**
     *
     * 표준 `safeTransferFrom` 을 쓰지 않는 이유는 거기엔 `operationKey` 를 걸 자리가
     * 없어서입니다. 응답을 못 받고 재시도하면 **카드가 두 장 넘어갑니다.**
     * 표준 함수는 그대로 남겨둡니다 — 지갑·탐색기가 그걸 기대합니다.
     *
     * 오퍼레이터가 남의 카드를 옮기는 함수는 두지 않습니다. 캣머니에 `burnFrom` 을
     * 안 둔 것과 같은 이유입니다 — 키 하나가 털리면 전 유저의 카드가 쓸려 나갑니다.
     * 서버는 니모닉에서 판매자의 키를 파생해 서명합니다.
     *
     * ── 실행 기록은 호출자별입니다 ────────────────────────────────
     *
     * 이 함수는 **누구나** 부를 수 있습니다. 기록을 전역으로 두면 카드 한 장 가진
     * 아무나 남의 거래 키를 미리 태워 그 거래를 영구히 막을 수 있습니다.
     * 발행 키와도 이름공간이 갈려 있어 서로를 막지 못합니다.
     */
    function transferWithKey(address to, uint256 tokenId, uint256 amount, bytes32 operationKey)
        external
    {
        if (to == address(0)) revert ZeroAddress();
        if (operationKey == bytes32(0)) revert EmptyKey();

        bytes32 slot = _slot(OP_TRANSFER, _msgSender(), operationKey);
        if (_executed[slot]) revert OperationAlreadyExecuted(operationKey);
        _executed[slot] = true;

        // 잔액이 모자라면 여기서 ERC1155InsufficientBalance 로 revert 됩니다.
        _safeTransferFrom(_msgSender(), to, tokenId, amount, "");
        emit PhotocardTransferred(tokenId, _msgSender(), to, operationKey);
    }

    /// 그 주소가 이 키로 이미 옮겼는가. 재시도를 성공으로 바꿀 때 씁니다.
    function isTransferExecuted(address account, bytes32 operationKey)
        external
        view
        returns (bool)
    {
        return _executed[_slot(OP_TRANSFER, account, operationKey)];
    }

    // ── 운영 ──────────────────────────────────────────────────────

    function setIssuePaused(bool paused) external onlyRole(OPERATOR_ROLE) {
        issuePaused = paused;
        emit IssuePausedSet(paused);
    }

    // ── 메타데이터 ────────────────────────────────────────────────

    /**
     * 도안의 IPFS 메타데이터 주소.
     *
     * ERC-1155 는 보통 `{id}` 가 들어간 템플릿 하나를 두고 클라이언트가 치환하게
     * 합니다. 그렇게 하지 않습니다 — **도안마다 CID 를 저장합니다.**
     *
     * 템플릿이면 URI 를 바꾸는 레버가 하나 있고, 그걸 당기면 모든 도안의 그림이
     * 한꺼번에 바뀝니다. 그러면 CID 를 쓰는 의미가 없어집니다. 그래서 `setURI` 도
     * 두지 않았습니다. 이 체인은 가스가 무료라 도안마다 문자열을 저장하는 비용도
     * 문제가 되지 않습니다.
     *
     * 등록되지 않은 도안은 빈 문자열입니다. revert 하지 않습니다 — `uri()` 는
     * 탐색기가 아무 번호로나 부르는 함수라 거기서 던지면 화면이 깨집니다.
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenUri[tokenId];
    }

    // ── 내부 ──────────────────────────────────────────────────────

    /**
     * 실행 기록의 자리를 만듭니다.
     *
     * `account` 는 발행이면 `address(0)`(전역), 이동이면 호출자입니다.
     * `abi.encode` 를 씁니다 — `encodePacked` 는 붙여 쓰는 값에 따라 서로 다른
     * 입력이 같은 해시가 될 수 있습니다.
     */
    function _slot(uint8 op, address account, bytes32 key) private pure returns (bytes32) {
        return keccak256(abi.encode(op, account, key));
    }

    // ── 표준 ──────────────────────────────────────────────────────

    /// ERC1155 와 AccessControl 이 둘 다 구현합니다. 합쳐주지 않으면 컴파일이 안 됩니다.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
