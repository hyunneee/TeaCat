import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import type { PhotocardNFT } from '../typechain-types';

/** Spring 이 문자열 키를 보내면 서버가 해싱합니다. (DESIGN.md 2026-09-02) */
function key(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

/**
 * `ERC1155Supply` 는 `totalSupply()` 와 `totalSupply(uint256)` 을 둘 다 갖고 있어서
 * ethers 가 이름만으로는 고르지 못합니다. 시그니처를 적어 줍니다.
 * api 쪽에서도 같은 함정이 있습니다.
 */
function issuedOf(poca: PhotocardNFT, tokenId: bigint): Promise<bigint> {
  return poca['totalSupply(uint256)'](tokenId);
}

/** 도안 번호. tokenId 는 `nft_photocard_designs.id` 그대로입니다. */
const DESIGN_A = 11n;
const DESIGN_B = 12n;
/** 배치 상한(200)보다 큰 수량이 필요한 테스트용 */
const DESIGN_BIG = 13n;

const URI_A = 'ipfs://bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const URI_B = 'ipfs://bafkreibbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('PhotocardNFT', () => {
  async function deploy() {
    const [admin, minter, operator, alice, bob, attacker] = await ethers.getSigners();
    const poca = (await ethers.deployContract('PhotocardNFT', [
      admin!.address,
      minter!.address,
      operator!.address,
    ])) as unknown as PhotocardNFT;
    await poca.waitForDeployment();
    return {
      poca,
      admin: admin!,
      minter: minter!,
      operator: operator!,
      alice: alice!,
      bob: bob!,
      attacker: attacker!,
    };
  }

  /** 도안을 등록해 둔 상태. 대부분의 테스트가 여기서 시작합니다. */
  async function deployWithDesigns() {
    const ctx = await deploy();
    await ctx.poca.connect(ctx.operator).registerDesign(DESIGN_A, 100, URI_A);
    await ctx.poca.connect(ctx.operator).registerDesign(DESIGN_B, 3, URI_B);
    await ctx.poca.connect(ctx.operator).registerDesign(DESIGN_BIG, 1000, URI_A);
    return ctx;
  }

  describe('기본', () => {
    it('역할이 셋으로 나뉜다 — 한 키가 전부 쥐지 않는다', async () => {
      const { poca, admin, minter, operator } = await loadFixture(deploy);
      const [ADMIN, MINT, OP] = [
        await poca.DEFAULT_ADMIN_ROLE(),
        await poca.MINTER_ROLE(),
        await poca.OPERATOR_ROLE(),
      ];

      expect(await poca.hasRole(ADMIN, admin.address)).to.equal(true);
      expect(await poca.hasRole(MINT, minter.address)).to.equal(true);
      expect(await poca.hasRole(OP, operator.address)).to.equal(true);

      // 발행 키가 털려도 권한 조작·도안 등록·정지 해제는 못 합니다.
      expect(await poca.hasRole(ADMIN, minter.address)).to.equal(false);
      expect(await poca.hasRole(OP, minter.address)).to.equal(false);
    });

    it('생성자가 0 주소를 거부한다', async () => {
      const [admin, minter] = await ethers.getSigners();
      const factory = await ethers.getContractFactory('PhotocardNFT');
      await expect(
        factory.deploy(admin!.address, minter!.address, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(factory, 'ZeroAddress');
    });

    it('표준 인터페이스를 전부 선언한다', async () => {
      const { poca } = await loadFixture(deploy);
      expect(await poca.supportsInterface('0xd9b67a26')).to.equal(true); // IERC1155
      expect(await poca.supportsInterface('0x0e89341c')).to.equal(true); // IERC1155MetadataURI
      expect(await poca.supportsInterface('0x7965db0b')).to.equal(true); // IAccessControl
    });

    it('좌석·공연·소유자 정보를 체인에 두지 않는다 — Spring DB 가 소유한다', async () => {
      const { poca } = await loadFixture(deploy);
      const names = poca.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => f.format('sighash'));

      expect(names.filter((s) => /seat|show|venue|owner\(|nickname/i.test(s))).to.deep.equal([]);
    });
  });

  describe('도안 등록', () => {
    it('등록해야 발행할 수 있다', async () => {
      const { poca, operator, minter, alice } = await loadFixture(deploy);

      await expect(
        poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('card_1')]),
      )
        .to.be.revertedWithCustomError(poca, 'DesignNotRegistered')
        .withArgs(DESIGN_A);

      await expect(poca.connect(operator).registerDesign(DESIGN_A, 100, URI_A))
        .to.emit(poca, 'DesignRegistered')
        .withArgs(DESIGN_A, 100n, URI_A);

      await expect(poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('card_1')]))
        .to.emit(poca, 'PhotocardIssued')
        .withArgs(DESIGN_A, alice.address, key('card_1'));
    });

    it('표준 URI 이벤트를 함께 낸다 — 탐색기가 이걸 보고 메타데이터를 읽는다', async () => {
      const { poca, operator } = await loadFixture(deploy);
      await expect(poca.connect(operator).registerDesign(DESIGN_A, 100, URI_A))
        .to.emit(poca, 'URI')
        .withArgs(URI_A, DESIGN_A);
    });

    it('uri() 가 도안마다 다른 값을 돌려준다 — 템플릿이 아니다', async () => {
      const { poca } = await loadFixture(deployWithDesigns);
      expect(await poca.uri(DESIGN_A)).to.equal(URI_A);
      expect(await poca.uri(DESIGN_B)).to.equal(URI_B);
    });

    it('전역 URI 레버(setURI)를 두지 않는다 — 있으면 모든 도안을 한 번에 갈아끼울 수 있다', async () => {
      const { poca } = await loadFixture(deploy);
      const names = poca.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => f.format('sighash'));

      expect(names.filter((s) => /^setURI|^setBaseURI|^setTokenURI/i.test(s))).to.deep.equal([]);
    });

    it('등록되지 않은 도안의 uri 는 빈 문자열이다 — revert 하지 않는다', async () => {
      const { poca } = await loadFixture(deploy);
      // 탐색기가 아무 번호로나 부르는 함수라, 여기서 던지면 화면이 깨집니다.
      expect(await poca.uri(999n)).to.equal('');
    });

    it('0 번 도안·0 수량·빈 URI 를 거부한다', async () => {
      const { poca, operator } = await loadFixture(deploy);
      await expect(
        poca.connect(operator).registerDesign(0, 100, URI_A),
      ).to.be.revertedWithCustomError(poca, 'InvalidDesignId');
      await expect(
        poca.connect(operator).registerDesign(DESIGN_A, 0, URI_A),
      ).to.be.revertedWithCustomError(poca, 'InvalidMaxSupply');
      await expect(
        poca.connect(operator).registerDesign(DESIGN_A, 100, ''),
      ).to.be.revertedWithCustomError(poca, 'EmptyMetadataUri');
    });

    it('외부인은 등록할 수 없다', async () => {
      const { poca, attacker, minter } = await loadFixture(deploy);
      await expect(
        poca.connect(attacker).registerDesign(DESIGN_A, 100, URI_A),
      ).to.be.revertedWithCustomError(poca, 'AccessControlUnauthorizedAccount');

      // 발행 키로도 안 됩니다. 역할이 갈려 있는 이유입니다.
      await expect(
        poca.connect(minter).registerDesign(DESIGN_A, 100, URI_A),
      ).to.be.revertedWithCustomError(poca, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('첫 발행 전까지만 고칠 수 있다', () => {
    it('한 장도 안 나갔으면 수량과 URI 를 다시 등록할 수 있다', async () => {
      const { poca, operator } = await loadFixture(deploy);
      await poca.connect(operator).registerDesign(DESIGN_A, 100, URI_A);

      // 개발 중에 이미지가 바뀌는 것은 정상입니다. 보유자가 없으니 다치는 사람도 없습니다.
      await poca.connect(operator).registerDesign(DESIGN_A, 50, URI_B);

      const design = await poca.getDesign(DESIGN_A);
      expect(design.max).to.equal(50n);
      expect(design.metadataUri).to.equal(URI_B);
      expect(design.frozen).to.equal(false);
    });

    it('첫 장이 나가면 영구히 잠긴다', async () => {
      const { poca, operator, minter, alice } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('card_1')]);

      await expect(poca.connect(operator).registerDesign(DESIGN_A, 200, URI_B))
        .to.be.revertedWithCustomError(poca, 'DesignFrozen')
        .withArgs(DESIGN_A);

      expect((await poca.getDesign(DESIGN_A)).frozen).to.equal(true);
      // 값은 처음 것 그대로입니다.
      expect(await poca.uri(DESIGN_A)).to.equal(URI_A);
    });

    it('한 도안이 잠겨도 다른 도안은 자유롭다', async () => {
      const { poca, operator, minter, alice } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('card_1')]);

      await poca.connect(operator).registerDesign(DESIGN_B, 7, URI_A);
      expect((await poca.getDesign(DESIGN_B)).max).to.equal(7n);
    });
  });

  describe('한정 수량', () => {
    it('상한까지는 발행되고 그 다음이 막힌다', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      const three = [alice.address, alice.address, alice.address];
      await poca
        .connect(minter)
        .issueBatch(three, [DESIGN_B, DESIGN_B, DESIGN_B], [key('b1'), key('b2'), key('b3')]);

      expect(await issuedOf(poca, DESIGN_B)).to.equal(3n);
      expect(await poca.balanceOf(alice.address, DESIGN_B)).to.equal(3n);

      await expect(poca.connect(minter).issueBatch([alice.address], [DESIGN_B], [key('b4')]))
        .to.be.revertedWithCustomError(poca, 'DesignSoldOut')
        .withArgs(DESIGN_B);
    });

    it('상한은 재고가 아니다 — 배정된 만큼만 존재한다', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('card_1')]);

      // 100장 한정이지만 실제로 나간 것은 1장뿐입니다.
      expect(await poca.maxSupply(DESIGN_A)).to.equal(100n);
      expect(await issuedOf(poca, DESIGN_A)).to.equal(1n);
    });

    it('배치 안에서 상한을 넘으면 배치 전체가 실패한다', async () => {
      const { poca, minter, alice, bob } = await loadFixture(deployWithDesigns);
      const four = [alice.address, bob.address, alice.address, bob.address];

      // 그 자리만 건너뛰면 Spring 은 성공으로 알고 넘어가는데 그 카드는 영원히 안 나갑니다.
      await expect(
        poca
          .connect(minter)
          .issueBatch(
            four,
            [DESIGN_B, DESIGN_B, DESIGN_B, DESIGN_B],
            [key('b1'), key('b2'), key('b3'), key('b4')],
          ),
      ).to.be.revertedWithCustomError(poca, 'DesignSoldOut');

      expect(await issuedOf(poca, DESIGN_B)).to.equal(0n);
    });
  });

  describe('배치 발행', () => {
    it('한 트랜잭션에서 여러 사람에게 서로 다른 도안이 나간다', async () => {
      const { poca, minter, alice, bob } = await loadFixture(deployWithDesigns);
      await poca
        .connect(minter)
        .issueBatch(
          [alice.address, bob.address, alice.address],
          [DESIGN_A, DESIGN_B, DESIGN_B],
          [key('c1'), key('c2'), key('c3')],
        );

      expect(await poca.balanceOf(alice.address, DESIGN_A)).to.equal(1n);
      expect(await poca.balanceOf(alice.address, DESIGN_B)).to.equal(1n);
      expect(await poca.balanceOf(bob.address, DESIGN_B)).to.equal(1n);
      expect(await issuedOf(poca, DESIGN_B)).to.equal(2n);
    });

    it('같은 배치를 그대로 재전송해도 안전하다 — 전부 건너뛴다', async () => {
      const { poca, minter, alice, bob } = await loadFixture(deployWithDesigns);
      const to = [alice.address, bob.address];
      const ids = [DESIGN_A, DESIGN_A];
      const keys = [key('c1'), key('c2')];

      await poca.connect(minter).issueBatch(to, ids, keys);

      // 응답을 못 받았을 때 Spring 이 할 수 있는 가장 단순한 행동입니다.
      await expect(poca.connect(minter).issueBatch(to, ids, keys))
        .to.emit(poca, 'IssueSkipped')
        .withArgs(key('c1'));

      expect(await issuedOf(poca, DESIGN_A)).to.equal(2n);
      expect(await poca.balanceOf(alice.address, DESIGN_A)).to.equal(1n);
    });

    it('중복 하나가 나머지를 죽이지 않는다', async () => {
      const { poca, minter, alice, bob } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('c1')]);

      // 첫 건은 이미 나갔고 둘째는 처음입니다. revert 하면 둘째가 영영 안 나갑니다.
      await expect(
        poca
          .connect(minter)
          .issueBatch([alice.address, bob.address], [DESIGN_A, DESIGN_A], [key('c1'), key('c2')]),
      )
        .to.emit(poca, 'PhotocardIssued')
        .withArgs(DESIGN_A, bob.address, key('c2'));

      expect(await issuedOf(poca, DESIGN_A)).to.equal(2n);
    });

    it('배열 길이가 다르면 거부한다', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      await expect(
        poca.connect(minter).issueBatch([alice.address], [DESIGN_A, DESIGN_B], [key('c1')]),
      ).to.be.revertedWithCustomError(poca, 'LengthMismatch');
    });

    it('빈 배치와 상한 초과 배치를 거부한다', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      await expect(poca.connect(minter).issueBatch([], [], []))
        .to.be.revertedWithCustomError(poca, 'BatchTooLarge')
        .withArgs(0n);

      const max = Number(await poca.MAX_BATCH());
      const over = max + 1;
      await expect(
        poca
          .connect(minter)
          .issueBatch(
            Array(over).fill(alice.address),
            Array(over).fill(DESIGN_A),
            Array.from({ length: over }, (_, i) => key(`over_${i}`)),
          ),
      )
        .to.be.revertedWithCustomError(poca, 'BatchTooLarge')
        .withArgs(BigInt(over));
    });

    it('상한 크기의 배치는 통과한다', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      const max = Number(await poca.MAX_BATCH());
      await poca
        .connect(minter)
        .issueBatch(
          Array(max).fill(alice.address),
          Array(max).fill(DESIGN_BIG),
          Array.from({ length: max }, (_, i) => key(`full_${i}`)),
        );

      expect(await poca.balanceOf(alice.address, DESIGN_BIG)).to.equal(BigInt(max));
    });

    it('빈 키를 거부한다', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      await expect(
        poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [ethers.ZeroHash]),
      ).to.be.revertedWithCustomError(poca, 'EmptyKey');
    });

    it('외부인은 발행할 수 없다', async () => {
      const { poca, attacker, operator, alice } = await loadFixture(deployWithDesigns);
      await expect(
        poca.connect(attacker).issueBatch([alice.address], [DESIGN_A], [key('c1')]),
      ).to.be.revertedWithCustomError(poca, 'AccessControlUnauthorizedAccount');

      // 오퍼레이터도 발행은 못 합니다.
      await expect(
        poca.connect(operator).issueBatch([alice.address], [DESIGN_A], [key('c1')]),
      ).to.be.revertedWithCustomError(poca, 'AccessControlUnauthorizedAccount');
    });

    it('isIssued 로 발행 여부를 되짚을 수 있다 — 응답을 잃었을 때의 복구 경로', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      expect(await poca.isIssued(key('c1'))).to.equal(false);

      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('c1')]);
      expect(await poca.isIssued(key('c1'))).to.equal(true);
    });
  });

  describe('정지', () => {
    it('발행은 막히고 이동은 막히지 않는다', async () => {
      const { poca, operator, minter, alice, bob } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('c1')]);

      await expect(poca.connect(operator).setIssuePaused(true))
        .to.emit(poca, 'IssuePausedSet')
        .withArgs(true);

      await expect(
        poca.connect(minter).issueBatch([bob.address], [DESIGN_A], [key('c2')]),
      ).to.be.revertedWithCustomError(poca, 'IssueIsPaused');

      // 유저가 자기 카드를 옮기는 것은 사고와 무관합니다.
      await poca.connect(alice).transferWithKey(bob.address, DESIGN_A, 1, key('trade_1'));
      expect(await poca.balanceOf(bob.address, DESIGN_A)).to.equal(1n);
    });

    it('해제하면 다시 발행된다', async () => {
      const { poca, operator, minter, alice } = await loadFixture(deployWithDesigns);
      await poca.connect(operator).setIssuePaused(true);
      await poca.connect(operator).setIssuePaused(false);

      await expect(
        poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('c1')]),
      ).to.emit(poca, 'PhotocardIssued');
    });

    it('외부인은 정지 스위치를 못 만진다', async () => {
      const { poca, attacker, minter } = await loadFixture(deploy);
      await expect(
        poca.connect(attacker).setIssuePaused(true),
      ).to.be.revertedWithCustomError(poca, 'AccessControlUnauthorizedAccount');
      await expect(
        poca.connect(minter).setIssuePaused(true),
      ).to.be.revertedWithCustomError(poca, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('이동', () => {
    it('표준 전송은 그대로 동작한다 — 포카는 팔라고 만든 물건이다', async () => {
      const { poca, minter, alice, bob } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('c1')]);

      await poca.connect(alice).safeTransferFrom(alice.address, bob.address, DESIGN_A, 1, '0x');
      expect(await poca.balanceOf(bob.address, DESIGN_A)).to.equal(1n);
    });

    it('승인도 표준대로 열려 있다 — 나중에 에스크로 마켓이 쓴다', async () => {
      const { poca, alice, bob } = await loadFixture(deployWithDesigns);
      await poca.connect(alice).setApprovalForAll(bob.address, true);
      expect(await poca.isApprovedForAll(alice.address, bob.address)).to.equal(true);
    });

    it('transferWithKey 는 같은 키로 두 번 옮기지 않는다', async () => {
      const { poca, minter, alice, bob } = await loadFixture(deployWithDesigns);
      await poca
        .connect(minter)
        .issueBatch([alice.address, alice.address], [DESIGN_A, DESIGN_A], [key('c1'), key('c2')]);

      await expect(poca.connect(alice).transferWithKey(bob.address, DESIGN_A, 1, key('trade_1')))
        .to.emit(poca, 'PhotocardTransferred')
        .withArgs(DESIGN_A, alice.address, bob.address, key('trade_1'));

      // 재시도해도 두 장이 넘어가지 않습니다.
      await expect(poca.connect(alice).transferWithKey(bob.address, DESIGN_A, 1, key('trade_1')))
        .to.be.revertedWithCustomError(poca, 'OperationAlreadyExecuted')
        .withArgs(key('trade_1'));

      expect(await poca.balanceOf(alice.address, DESIGN_A)).to.equal(1n);
      expect(await poca.balanceOf(bob.address, DESIGN_A)).to.equal(1n);
    });

    it('오퍼레이터가 남의 카드를 옮기는 함수가 없다', async () => {
      const { poca } = await loadFixture(deploy);
      const names = poca.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => f.format('sighash'));

      // 캣머니에 burnFrom 을 두지 않은 것과 같은 이유입니다.
      expect(names.filter((s) => /transferFromWithKey|adminTransfer|forceTransfer/i.test(s))).to.deep.equal(
        [],
      );
    });

    it('잔액이 없으면 옮기지 못한다', async () => {
      const { poca, alice, bob } = await loadFixture(deployWithDesigns);
      await expect(
        poca.connect(alice).transferWithKey(bob.address, DESIGN_A, 1, key('trade_1')),
      ).to.be.revertedWithCustomError(poca, 'ERC1155InsufficientBalance');
    });

    it('0 주소와 빈 키를 거부한다', async () => {
      const { poca, minter, alice, bob } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('c1')]);

      await expect(
        poca.connect(alice).transferWithKey(ethers.ZeroAddress, DESIGN_A, 1, key('t')),
      ).to.be.revertedWithCustomError(poca, 'ZeroAddress');
      await expect(
        poca.connect(alice).transferWithKey(bob.address, DESIGN_A, 1, ethers.ZeroHash),
      ).to.be.revertedWithCustomError(poca, 'EmptyKey');
    });
  });

  describe('멱등 이름공간 — 선점 공격 방어 (회귀)', () => {
    it('카드 한 장 가진 아무나 예정된 발행 키를 선점할 수 없다', async () => {
      const { poca, minter, operator, alice, bob, attacker } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([attacker.address], [DESIGN_A], [key('seed_atk')]);

      /* Spring 키는 `nft_photocards.id` 순번이라 예측 가능하고, 이 체인은 공용이라
         실제로 노출됩니다. 캣머니에서 실제로 터졌던 사고의 회귀 테스트입니다. */
      const plannedIssueKey = key('90124');
      await poca.connect(attacker).transferWithKey(bob.address, DESIGN_A, 1, plannedIssueKey);

      // 그래도 발행은 나가야 합니다.
      await expect(
        poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [plannedIssueKey]),
      )
        .to.emit(poca, 'PhotocardIssued')
        .withArgs(DESIGN_A, alice.address, plannedIssueKey);

      expect(await poca.balanceOf(alice.address, DESIGN_A)).to.equal(1n);
    });

    it('남이 내 거래 키를 미리 태워 막을 수 없다 — 이동은 호출자별로 격리', async () => {
      const { poca, minter, alice, bob, attacker } = await loadFixture(deployWithDesigns);
      await poca
        .connect(minter)
        .issueBatch([alice.address, attacker.address], [DESIGN_A, DESIGN_A], [key('c1'), key('c2')]);

      const tradeKey = key('trade_00001');
      await poca.connect(attacker).transferWithKey(bob.address, DESIGN_A, 1, tradeKey); // 선점 시도

      await expect(poca.connect(alice).transferWithKey(bob.address, DESIGN_A, 1, tradeKey)).to.emit(
        poca,
        'PhotocardTransferred',
      );
      expect(await poca.balanceOf(bob.address, DESIGN_A)).to.equal(2n);
    });

    it('발행 기록은 전역이라 Spring 이 키를 재사용해도 막힌다', async () => {
      const { poca, minter, alice, bob } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('c1')]);

      // 받는 사람이 달라도 같은 키면 새 카드가 나가지 않습니다.
      await expect(poca.connect(minter).issueBatch([bob.address], [DESIGN_A], [key('c1')]))
        .to.emit(poca, 'IssueSkipped')
        .withArgs(key('c1'));

      expect(await poca.balanceOf(bob.address, DESIGN_A)).to.equal(0n);
      expect(await issuedOf(poca, DESIGN_A)).to.equal(1n);
    });

    it('isTransferExecuted 는 주소별로 답한다', async () => {
      const { poca, minter, alice, bob, attacker } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_A], [key('c1')]);
      await poca.connect(alice).transferWithKey(bob.address, DESIGN_A, 1, key('trade_1'));

      expect(await poca.isTransferExecuted(alice.address, key('trade_1'))).to.equal(true);
      expect(await poca.isTransferExecuted(attacker.address, key('trade_1'))).to.equal(false);
      // 발행 쪽 자리는 비어 있습니다.
      expect(await poca.isIssued(key('trade_1'))).to.equal(false);
    });
  });

  describe('대사 (reconciliation)', () => {
    it('개수로 맞춘다 — 카드 한 장을 지목해 묻는 조회는 없다', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      await poca
        .connect(minter)
        .issueBatch(
          [alice.address, alice.address, alice.address],
          [DESIGN_A, DESIGN_A, DESIGN_B],
          [key('c1'), key('c2'), key('c3')],
        );

      /* Spring 쪽 SELECT count(*) ... WHERE owner_id = ? AND design_id = ?
         AND status = 'MINTED' 와 같아야 하는 값입니다. */
      expect(await poca.balanceOf(alice.address, DESIGN_A)).to.equal(2n);
      expect(await poca.balanceOf(alice.address, DESIGN_B)).to.equal(1n);
      expect(await issuedOf(poca, DESIGN_A)).to.equal(2n);
    });

    it('getDesign 이 한 번에 대사에 필요한 값을 준다', async () => {
      const { poca, minter, alice } = await loadFixture(deployWithDesigns);
      await poca.connect(minter).issueBatch([alice.address], [DESIGN_B], [key('c1')]);

      const design = await poca.getDesign(DESIGN_B);
      expect(design.max).to.equal(3n);
      expect(design.issued).to.equal(1n);
      expect(design.metadataUri).to.equal(URI_B);
      expect(design.frozen).to.equal(true);
    });

    it('등록되지 않은 도안은 max 가 0 이다', async () => {
      const { poca } = await loadFixture(deploy);
      const design = await poca.getDesign(999n);
      expect(design.max).to.equal(0n);
      expect(design.issued).to.equal(0n);
      expect(design.frozen).to.equal(false);
    });
  });
});
