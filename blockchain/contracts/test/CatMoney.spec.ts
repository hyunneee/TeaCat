import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import type { CatMoney } from '../typechain-types';

/** Spring 이 문자열 operationKey 를 보내면 서버가 해싱합니다. (DESIGN.md 2026-09-02) */
function opKey(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

describe('CatMoney', () => {
  async function deploy() {
    const [admin, alice, bob, outsider] = await ethers.getSigners();
    const token = (await ethers.deployContract('CatMoney', [
      admin!.address,
    ])) as unknown as CatMoney;
    await token.waitForDeployment();
    return { token, admin: admin!, alice: alice!, bob: bob!, outsider: outsider! };
  }

  describe('기본', () => {
    it('decimals 는 0 이다 — 포인트는 정수로 센다', async () => {
      const { token } = await loadFixture(deploy);
      expect(await token.decimals()).to.equal(0);
      expect(await token.name()).to.equal('CatMoney');
      expect(await token.symbol()).to.equal('TCAT');
    });

    it('배포자가 admin · minter · operator 를 가진다', async () => {
      const { token, admin } = await loadFixture(deploy);
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await token.hasRole(await token.MINTER_ROLE(), admin.address)).to.equal(true);
      expect(await token.hasRole(await token.OPERATOR_ROLE(), admin.address)).to.equal(true);
    });

    it('트레저리가 없다 — 캣머니는 발행과 소각으로만 움직인다', async () => {
      const { token } = await loadFixture(deploy);
      const names = token.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => f.format('sighash'));

      expect(names.filter((s) => /treasury|^pay\(|^refund\(/i.test(s))).to.deep.equal([]);
      expect(names).to.include('burn(uint256,bytes32)');
      expect(names).to.include('mint(address,uint256,bytes32)');
    });

    it('남의 잔액을 태우는 함수는 없다', async () => {
      const { token } = await loadFixture(deploy);
      const names = token.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => f.format('sighash'));

      // burnFrom 이 있으면 키 하나로 전 유저의 포인트를 지울 수 있습니다.
      expect(names.filter((s) => s.startsWith('burnFrom'))).to.deep.equal([]);
      expect(names.filter((s) => s.startsWith('burn'))).to.deep.equal(['burn(uint256,bytes32)']);
    });
  });

  describe('mint — 원화 입금 · 보상 · 환급', () => {
    it('발행하면 잔액과 총량이 함께 늘어난다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await expect(token.mint(alice.address, 500, opKey('charge_1')))
        .to.emit(token, 'Minted')
        .withArgs(alice.address, 500, opKey('charge_1'));

      expect(await token.balanceOf(alice.address)).to.equal(500);
      expect(await token.totalSupply()).to.equal(500);
    });

    it('같은 operationKey 가 두 번 오면 두 번째는 거부한다 — 재시도해도 한 번만 발행', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_1'));

      await expect(token.mint(alice.address, 500, opKey('charge_1')))
        .to.be.revertedWithCustomError(token, 'OperationAlreadyExecuted')
        .withArgs(opKey('charge_1'));

      expect(await token.balanceOf(alice.address)).to.equal(500); // 1000 이 아니다
    });

    it('MINTER_ROLE 이 없으면 발행할 수 없다', async () => {
      const { token, outsider, alice } = await loadFixture(deploy);
      await expect(
        token.connect(outsider).mint(alice.address, 500, opKey('charge_2')),
      ).to.be.revertedWithCustomError(token, 'AccessControlUnauthorizedAccount');
    });

    it('수량 0 은 거부한다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await expect(token.mint(alice.address, 0, opKey('charge_3'))).to.be.revertedWithCustomError(
        token,
        'AmountMustBePositive',
      );
    });
  });

  describe('burn — 티켓 결제 · 원화 출금', () => {
    it('소각하면 잔액과 총량이 함께 줄어든다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_4'));

      await expect(token.connect(alice).burn(300, opKey('payment_4')))
        .to.emit(token, 'Burned')
        .withArgs(alice.address, 300, opKey('payment_4'));

      expect(await token.balanceOf(alice.address)).to.equal(200);
      // 트레저리로 옮긴 게 아니라 사라졌습니다. totalSupply 가 곧 미사용 캣머니입니다.
      expect(await token.totalSupply()).to.equal(200);
    });

    it('일부만 결제할 수 있다 — 캣머니는 포인트처럼 부분 결제', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 1000, opKey('charge_5'));
      await token.connect(alice).burn(300, opKey('payment_5'));
      expect(await token.balanceOf(alice.address)).to.equal(700);
    });

    it('같은 결제 키로 두 번 소각되지 않는다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_6'));
      await token.connect(alice).burn(300, opKey('payment_6'));

      await expect(
        token.connect(alice).burn(300, opKey('payment_6')),
      ).to.be.revertedWithCustomError(token, 'OperationAlreadyExecuted');

      expect(await token.balanceOf(alice.address)).to.equal(200);
    });

    it('잔액이 부족하면 거부한다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 100, opKey('charge_7'));
      await expect(
        token.connect(alice).burn(300, opKey('payment_7')),
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientBalance');
    });

    it('남의 잔액은 태울 수 없다 — 각자 자기 것만', async () => {
      const { token, alice, outsider } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_8'));

      // outsider 가 태워봐야 자기 잔액(0)에서 나갑니다. alice 는 멀쩡합니다.
      await expect(
        token.connect(outsider).burn(300, opKey('payment_8')),
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientBalance');
      expect(await token.balanceOf(alice.address)).to.equal(500);
    });
  });

  describe('환급 — 소각한 뒤 다시 발행', () => {
    it('결제 후 취소하면 원래대로 돌아온다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_9'));
      await token.connect(alice).burn(300, opKey('payment_9'));
      expect(await token.balanceOf(alice.address)).to.equal(200);

      // 환급은 별도 operationKey 로 다시 발행합니다.
      await token.mint(alice.address, 300, opKey('refund_9'));
      expect(await token.balanceOf(alice.address)).to.equal(500);
      expect(await token.totalSupply()).to.equal(500);
    });

    it('결제 키와 환급 키가 서로 막지 않는다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_10'));
      await token.connect(alice).burn(300, opKey('op_10'));

      // 같은 문자열이면 막힙니다 — Spring 이 결제와 환급에 다른 키를 써야 하는 이유입니다.
      await expect(token.mint(alice.address, 300, opKey('op_10'))).to.be.revertedWithCustomError(
        token,
        'OperationAlreadyExecuted',
      );
    });
  });

  describe('pause — 나가는 것만 막는다', () => {
    it('정지하면 소각이 막힌다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_11'));
      await token.pause();

      await expect(
        token.connect(alice).burn(100, opKey('payment_11')),
      ).to.be.revertedWithCustomError(token, 'EnforcedPause');
    });

    it('정지하면 유저 간 전송이 막힌다', async () => {
      const { token, alice, bob } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_12'));
      await token.pause();

      await expect(token.connect(alice).transfer(bob.address, 100)).to.be.revertedWithCustomError(
        token,
        'EnforcedPause',
      );
    });

    it('정지 중에도 발행은 된다 — 사고로 멈춰도 환급은 나가야 한다', async () => {
      const { token, alice } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_13'));
      await token.connect(alice).burn(300, opKey('payment_13'));

      await token.pause();
      expect(await token.paused()).to.equal(true);

      await expect(token.mint(alice.address, 300, opKey('refund_13'))).to.emit(token, 'Minted');
      expect(await token.balanceOf(alice.address)).to.equal(500);
    });

    it('발행 키가 털린 경우는 정지가 아니라 역할 회수로 막는다', async () => {
      const { token, admin, alice } = await loadFixture(deploy);
      await token.revokeRole(await token.MINTER_ROLE(), admin.address);

      await expect(
        token.mint(alice.address, 500, opKey('charge_14')),
      ).to.be.revertedWithCustomError(token, 'AccessControlUnauthorizedAccount');
    });

    it('해제하면 다시 돈다', async () => {
      const { token, alice, bob } = await loadFixture(deploy);
      await token.mint(alice.address, 500, opKey('charge_15'));
      await token.pause();
      await token.unpause();
      await token.connect(alice).transfer(bob.address, 100);
      expect(await token.balanceOf(bob.address)).to.equal(100);
    });
  });
});
