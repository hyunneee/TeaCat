import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import type { TicketSBT } from '../typechain-types';

/** Spring 이 문자열 ticketKey 를 보내면 서버가 해싱합니다. (DESIGN.md 2026-09-02) */
function key(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

/** 서버가 tokenId 를 미리 계산할 때 쓰는 것과 같은 식입니다. */
function tokenIdOf(ticketKey: string): bigint {
  return BigInt(key(ticketKey));
}

describe('TicketSBT', () => {
  async function deploy() {
    const [admin, minter, operator, alice, bob, outsider] = await ethers.getSigners();
    const ticket = (await ethers.deployContract('TicketSBT', [
      admin!.address,
      minter!.address,
      operator!.address,
    ])) as unknown as TicketSBT;
    await ticket.waitForDeployment();
    return {
      ticket,
      admin: admin!,
      minter: minter!,
      operator: operator!,
      alice: alice!,
      bob: bob!,
      outsider: outsider!,
    };
  }

  describe('기본', () => {
    it('역할이 셋으로 나뉜다 — 한 키가 전부 쥐지 않는다', async () => {
      const { ticket, admin, minter, operator } = await loadFixture(deploy);
      const [ADMIN, MINT, OP] = [
        await ticket.DEFAULT_ADMIN_ROLE(),
        await ticket.MINTER_ROLE(),
        await ticket.OPERATOR_ROLE(),
      ];

      expect(await ticket.hasRole(ADMIN, admin.address)).to.equal(true);
      expect(await ticket.hasRole(MINT, minter.address)).to.equal(true);
      expect(await ticket.hasRole(OP, operator.address)).to.equal(true);

      // 발행 키가 털려도 권한 조작·소각은 못 합니다.
      expect(await ticket.hasRole(ADMIN, minter.address)).to.equal(false);
      expect(await ticket.hasRole(OP, minter.address)).to.equal(false);
    });

    it('온체인에 좌석·공연·상태를 두지 않는다 — Spring DB 가 소유한다', async () => {
      const { ticket } = await loadFixture(deploy);
      const names = ticket.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => f.format('sighash'));

      // 티켓 DB 가 따로 있는데 같은 값을 체인에 또 두면 두 벌이 되고,
      // 어긋나는 순간 어느 쪽이 맞는지 판단할 근거가 없어집니다.
      expect(names.filter((s) => /seat|show|status|venue/i.test(s))).to.deep.equal([]);
    });
  });

  describe('tokenId 는 ticketKey 에서 나온다', () => {
    it('발행 전에 이미 정해져 있다 — 서버가 계산해서 즉시 돌려줄 수 있다', async () => {
      const { ticket, minter, alice } = await loadFixture(deploy);
      const expected = tokenIdOf('booking_001');

      // 트랜잭션을 보내기도 전에 컨트랙트와 같은 값을 얻습니다.
      expect(await ticket.tokenIdOf(key('booking_001'))).to.equal(expected);

      await expect(ticket.connect(minter).issue(alice.address, key('booking_001')))
        .to.emit(ticket, 'TicketIssued')
        .withArgs(expected, alice.address);

      expect(await ticket.ownerOf(expected)).to.equal(alice.address);
    });

    it('키가 다르면 번호도 다르다', async () => {
      const { ticket, minter, alice, bob } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('booking_001'));
      await ticket.connect(minter).issue(bob.address, key('booking_002'));

      expect(tokenIdOf('booking_001')).to.not.equal(tokenIdOf('booking_002'));
      expect(await ticket.ownerOf(tokenIdOf('booking_001'))).to.equal(alice.address);
      expect(await ticket.ownerOf(tokenIdOf('booking_002'))).to.equal(bob.address);
      expect(await ticket.totalIssued()).to.equal(2n);
    });

    it('순번 카운터가 없다 — 발행 순서가 번호에 영향을 주지 않는다', async () => {
      const { ticket, minter, alice, bob } = await loadFixture(deploy);

      // 순서를 바꿔 발행해도 각 키의 번호는 그대로입니다.
      await ticket.connect(minter).issue(bob.address, key('booking_002'));
      await ticket.connect(minter).issue(alice.address, key('booking_001'));

      expect(await ticket.ownerOf(tokenIdOf('booking_001'))).to.equal(alice.address);
      expect(await ticket.ownerOf(tokenIdOf('booking_002'))).to.equal(bob.address);
    });
  });

  describe('양도 불가 — 이 컨트랙트의 존재 이유', () => {
    it('transferFrom 이 막힌다', async () => {
      const { ticket, minter, alice, bob } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('t1'));
      const tokenId = tokenIdOf('t1');

      await expect(
        ticket.connect(alice).transferFrom(alice.address, bob.address, tokenId),
      ).to.be.revertedWithCustomError(ticket, 'TicketNotTransferable');

      expect(await ticket.ownerOf(tokenId)).to.equal(alice.address);
    });

    it('safeTransferFrom 도 막힌다 — 함수마다 막으면 하나가 새어나간다', async () => {
      const { ticket, minter, alice, bob } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('t2'));
      const tokenId = tokenIdOf('t2');

      await expect(
        ticket
          .connect(alice)
          ['safeTransferFrom(address,address,uint256)'](alice.address, bob.address, tokenId),
      ).to.be.revertedWithCustomError(ticket, 'TicketNotTransferable');

      await expect(
        ticket
          .connect(alice)
          ['safeTransferFrom(address,address,uint256,bytes)'](
            alice.address,
            bob.address,
            tokenId,
            '0x',
          ),
      ).to.be.revertedWithCustomError(ticket, 'TicketNotTransferable');

      expect(await ticket.ownerOf(tokenId)).to.equal(alice.address);
    });

    it('OPERATOR 도, admin 도 남의 티켓을 옮길 수 없다', async () => {
      const { ticket, minter, operator, admin, alice, bob } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('t3'));
      const tokenId = tokenIdOf('t3');

      /* "승인이 없어서" 가 아니라 "양도가 안 되는 토큰이라서" 막힙니다 —
         우리 `_update` 가 super 를 부르기 전에 거부하므로 OZ 의 승인 검사에
         닿지도 않습니다. 운영자가 암표에 가담할 길도 없습니다. */
      for (const signer of [operator, admin]) {
        await expect(
          ticket.connect(signer).transferFrom(alice.address, bob.address, tokenId),
        ).to.be.revertedWithCustomError(ticket, 'TicketNotTransferable');
      }
      expect(await ticket.ownerOf(tokenId)).to.equal(alice.address);
    });

    it('승인도 막힌다 — 마켓 목록에 오르지도 않는다', async () => {
      const { ticket, minter, alice, bob } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('t4'));

      await expect(
        ticket.connect(alice).approve(bob.address, tokenIdOf('t4')),
      ).to.be.revertedWithCustomError(ticket, 'TicketNotTransferable');

      await expect(
        ticket.connect(alice).setApprovalForAll(bob.address, true),
      ).to.be.revertedWithCustomError(ticket, 'TicketNotTransferable');
    });

    it('발행과 소각은 통과한다 — 양도 금지가 그것까지 막으면 안 된다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);

      await expect(ticket.connect(minter).issue(alice.address, key('t5'))).to.emit(
        ticket,
        'TicketIssued',
      );
      expect(await ticket.balanceOf(alice.address)).to.equal(1);

      await expect(ticket.connect(operator).burnTicket(tokenIdOf('t5'))).to.emit(
        ticket,
        'TicketBurned',
      );
      expect(await ticket.balanceOf(alice.address)).to.equal(0);
    });
  });

  describe('issue — 발행', () => {
    it('같은 ticketKey 가 두 번 오면 거부한다', async () => {
      const { ticket, minter, alice } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('dup'));

      // 서비스는 이걸 200 ALREADY_ISSUED 로 바꿉니다. (DESIGN.md 4-3)
      await expect(ticket.connect(minter).issue(alice.address, key('dup')))
        .to.be.revertedWithCustomError(ticket, 'AlreadyIssued')
        .withArgs(tokenIdOf('dup'));

      expect(await ticket.totalIssued()).to.equal(1n); // 2 장이 아니다
      expect(await ticket.balanceOf(alice.address)).to.equal(1);
    });

    it('받는 사람이 달라도 같은 ticketKey 로는 두 번 발행되지 않는다', async () => {
      const { ticket, minter, alice, bob } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('dup2'));

      await expect(
        ticket.connect(minter).issue(bob.address, key('dup2')),
      ).to.be.revertedWithCustomError(ticket, 'AlreadyIssued');
      expect(await ticket.balanceOf(bob.address)).to.equal(0);
    });

    it('MINTER_ROLE 이 없으면 발행할 수 없다', async () => {
      const { ticket, outsider, operator, admin, alice } = await loadFixture(deploy);

      for (const signer of [outsider, operator, admin]) {
        await expect(
          ticket.connect(signer).issue(alice.address, key('t7')),
        ).to.be.revertedWithCustomError(ticket, 'AccessControlUnauthorizedAccount');
      }
    });

    it('빈 ticketKey 는 거부한다 — 0 번 토큰은 두지 않는다', async () => {
      const { ticket, minter, alice } = await loadFixture(deploy);
      await expect(
        ticket.connect(minter).issue(alice.address, ethers.ZeroHash),
      ).to.be.revertedWithCustomError(ticket, 'EmptyTicketKey');
    });

    it('0 주소로는 발행하지 않는다', async () => {
      const { ticket, minter } = await loadFixture(deploy);
      await expect(
        ticket.connect(minter).issue(ethers.ZeroAddress, key('t8')),
      ).to.be.revertedWithCustomError(ticket, 'ZeroAddress');
    });

    it('티켓을 못 받는 컨트랙트로는 발행되지 않는다 — 갇히면 못 꺼낸다', async () => {
      const { ticket, minter } = await loadFixture(deploy);

      // 양도가 안 되므로, 잘못 받은 주소에서 꺼낼 방법이 아예 없습니다.
      await expect(
        ticket.connect(minter).issue(await ticket.getAddress(), key('t9')),
      ).to.be.revertedWithCustomError(ticket, 'ERC721InvalidReceiver');
    });
  });

  describe('burn — 예매 취소', () => {
    it('소각하면 소유권이 사라진다 — 존재 자체가 유효성이다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('b1'));
      const tokenId = tokenIdOf('b1');

      await expect(ticket.connect(operator).burnTicket(tokenId))
        .to.emit(ticket, 'TicketBurned')
        .withArgs(tokenId, alice.address);

      await expect(ticket.ownerOf(tokenId)).to.be.revertedWithCustomError(
        ticket,
        'ERC721NonexistentToken',
      );
      expect(await ticket.balanceOf(alice.address)).to.equal(0);
    });

    it('소각 이력은 Transfer 이벤트로 남는다 — 상태에서만 사라진다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('b2'));
      await ticket.connect(operator).burnTicket(tokenIdOf('b2'));

      /* 조회 가능한 상태에는 안 남지만 로그에는 영구히 남습니다.
         꺼내려면 인덱서가 필요합니다 — 그 위에 선 구조라는 걸 여기 못박아둡니다. */
      const logs = await ticket.queryFilter(
        ticket.filters.Transfer(alice.address, ethers.ZeroAddress),
      );
      expect(logs).to.have.lengthOf(1);
      expect(logs[0]!.args.tokenId).to.equal(tokenIdOf('b2'));
    });

    it('소각한 번호는 "발행된 적 있음" 으로 남는다 — 없는 번호와 구분된다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('b3'));
      await ticket.connect(operator).burnTicket(tokenIdOf('b3'));

      const burned = await ticket.getTicket(tokenIdOf('b3'));
      expect(burned.issued).to.equal(true);
      expect(burned.owner).to.equal(ethers.ZeroAddress); // 소각됨

      const never = await ticket.getTicket(tokenIdOf('한 번도 없는 키'));
      expect(never.issued).to.equal(false);
      expect(never.owner).to.equal(ethers.ZeroAddress);
    });

    it('취소 재시도와 없는 번호는 에러 이름이 다르다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('b4'));
      const tokenId = tokenIdOf('b4');
      await ticket.connect(operator).burnTicket(tokenId);

      /* revert 된 tx 는 이벤트를 안 남겨서, tx 조회는 에러 이름만 보고
         ALREADY_DONE 인지 FAILED 인지 정합니다. 이름이 겹치면 구분이 안 됩니다. */
      await expect(ticket.connect(operator).burnTicket(tokenId))
        .to.be.revertedWithCustomError(ticket, 'TicketAlreadyBurned')
        .withArgs(tokenId);

      await expect(ticket.connect(operator).burnTicket(999n))
        .to.be.revertedWithCustomError(ticket, 'TicketNotFound')
        .withArgs(999n);
    });

    it('OPERATOR_ROLE 만 소각할 수 있다 — 주인도 못 태운다', async () => {
      const { ticket, minter, admin, outsider, alice } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('b5'));
      const tokenId = tokenIdOf('b5');

      // 주인이 스스로 태울 수 있으면 환불 없이 티켓만 사라지는 길이 열립니다.
      for (const signer of [outsider, alice, minter, admin]) {
        await expect(
          ticket.connect(signer).burnTicket(tokenId),
        ).to.be.revertedWithCustomError(ticket, 'AccessControlUnauthorizedAccount');
      }
      expect(await ticket.ownerOf(tokenId)).to.equal(alice.address);
    });
  });

  describe('취소표 재판매 — burn & re-mint', () => {
    it('소각해도 그 ticketKey 는 풀리지 않는다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('r1'));
      await ticket.connect(operator).burnTicket(tokenIdOf('r1'));

      // 취소된 예매가 같은 키로 되살아나면 안 됩니다.
      await expect(ticket.connect(minter).issue(alice.address, key('r1')))
        .to.be.revertedWithCustomError(ticket, 'AlreadyIssued')
        .withArgs(tokenIdOf('r1'));
    });

    it('당첨자에게는 새 ticketKey 로 새 tokenId 가 나간다', async () => {
      const { ticket, minter, operator, alice, bob } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('r2'));
      await ticket.connect(operator).burnTicket(tokenIdOf('r2'));

      // Spring 이 새 ticket 행을 만들고, 그 PK 로 발행합니다.
      await ticket.connect(minter).issue(bob.address, key('r2_resale'));

      expect(await ticket.ownerOf(tokenIdOf('r2_resale'))).to.equal(bob.address);
      expect(tokenIdOf('r2_resale')).to.not.equal(tokenIdOf('r2'));
      expect(await ticket.totalIssued()).to.equal(2n); // 소각분도 셉니다
    });

    it('발행 여부를 키로 조회할 수 있다 — 응답을 못 받았을 때 복구용', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);
      const expected = tokenIdOf('r3');

      // 발행 전에도 번호는 계산됩니다 — 그 키가 갖게 될 번호입니다.
      let probe = await ticket.issuedTicket(key('r3'));
      expect(probe.issued).to.equal(false);
      expect(probe.tokenId).to.equal(expected);

      await ticket.connect(minter).issue(alice.address, key('r3'));

      probe = await ticket.issuedTicket(key('r3'));
      expect(probe.issued).to.equal(true);
      expect(probe.owner).to.equal(alice.address);

      // 소각한 뒤에도 "발행됐었다" 는 남고, owner 만 비워집니다.
      await ticket.connect(operator).burnTicket(expected);
      probe = await ticket.issuedTicket(key('r3'));
      expect(probe.issued).to.equal(true);
      expect(probe.tokenId).to.equal(expected);
      expect(probe.owner).to.equal(ethers.ZeroAddress);
    });
  });

  describe('정지 — 발행만 막는다', () => {
    it('정지하면 발행이 막힌다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);

      await expect(ticket.connect(operator).setIssuePaused(true))
        .to.emit(ticket, 'IssuePausedSet')
        .withArgs(true);

      await expect(
        ticket.connect(minter).issue(alice.address, key('p1')),
      ).to.be.revertedWithCustomError(ticket, 'IssueIsPaused');
    });

    it('정지 중에도 취소는 나간다 — 환불 경로는 살아 있어야 한다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);
      await ticket.connect(minter).issue(alice.address, key('p2'));
      await ticket.connect(operator).setIssuePaused(true);

      await expect(ticket.connect(operator).burnTicket(tokenIdOf('p2'))).to.emit(
        ticket,
        'TicketBurned',
      );
    });

    it('정지 스위치는 OPERATOR_ROLE 만', async () => {
      const { ticket, minter, outsider } = await loadFixture(deploy);

      for (const signer of [outsider, minter]) {
        await expect(
          ticket.connect(signer).setIssuePaused(true),
        ).to.be.revertedWithCustomError(ticket, 'AccessControlUnauthorizedAccount');
      }
    });

    it('발행 키가 털린 경우는 정지가 아니라 역할 회수로 막는다', async () => {
      const { ticket, admin, minter, alice } = await loadFixture(deploy);
      // admin 은 API 에 올라가지 않는 별도 키입니다. 그래서 minter 가 털려도 회수됩니다.
      await ticket.connect(admin).revokeRole(await ticket.MINTER_ROLE(), minter.address);

      await expect(
        ticket.connect(minter).issue(alice.address, key('p3')),
      ).to.be.revertedWithCustomError(ticket, 'AccessControlUnauthorizedAccount');
    });

    it('해제하면 다시 돈다', async () => {
      const { ticket, minter, operator, alice } = await loadFixture(deploy);
      await ticket.connect(operator).setIssuePaused(true);
      await ticket.connect(operator).setIssuePaused(false);

      expect(await ticket.issuePaused()).to.equal(false);
      await expect(ticket.connect(minter).issue(alice.address, key('p4'))).to.emit(
        ticket,
        'TicketIssued',
      );
    });
  });

  describe('표준', () => {
    it('ERC-721 인터페이스와 AccessControl 을 둘 다 보고한다', async () => {
      const { ticket } = await loadFixture(deploy);
      expect(await ticket.supportsInterface('0x80ac58cd')).to.equal(true); // ERC721
      expect(await ticket.supportsInterface('0x7965db0b')).to.equal(true); // AccessControl
    });
  });
});
