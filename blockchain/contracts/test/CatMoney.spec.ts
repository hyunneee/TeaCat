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
    const [admin, minter, operator, alice, bob, outsider, victim, attacker] =
      await ethers.getSigners();
    const token = (await ethers.deployContract('CatMoney', [
      admin!.address,
      minter!.address,
      operator!.address,
    ])) as unknown as CatMoney;
    await token.waitForDeployment();
    return {
      token,
      admin: admin!,
      minter: minter!,
      operator: operator!,
      alice: alice!,
      bob: bob!,
      outsider: outsider!,
      victim: victim!,
      attacker: attacker!,
    };
  }

  describe('기본', () => {
    it('decimals 는 0 이다 — 포인트는 정수로 센다', async () => {
      const { token, operator, minter } = await loadFixture(deploy);
      expect(await token.decimals()).to.equal(0);
      expect(await token.name()).to.equal('CatMoney');
      expect(await token.symbol()).to.equal('TCAT');
    });

    it('역할이 셋으로 나뉜다 — 한 키가 전부 쥐지 않는다', async () => {
      const { token, admin, minter, operator } = await loadFixture(deploy);
      const [ADMIN, MINT, OP] = [
        await token.DEFAULT_ADMIN_ROLE(),
        await token.MINTER_ROLE(),
        await token.OPERATOR_ROLE(),
      ];

      expect(await token.hasRole(ADMIN, admin.address)).to.equal(true);
      expect(await token.hasRole(MINT, minter.address)).to.equal(true);
      expect(await token.hasRole(OP, operator.address)).to.equal(true);

      // 발행 키가 털려도 권한 조작·정지 해제는 못 합니다.
      expect(await token.hasRole(ADMIN, minter.address)).to.equal(false);
      expect(await token.hasRole(OP, minter.address)).to.equal(false);
    });

    it('트레저리가 없다 — 캣머니는 발행과 소각으로만 움직인다', async () => {
      const { token, operator, minter } = await loadFixture(deploy);
      const names = token.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => f.format('sighash'));

      expect(names.filter((s) => /treasury|^pay\(|^refund\(/i.test(s))).to.deep.equal([]);
      expect(names).to.include('burn(uint256,bytes32)');
      expect(names).to.include('mint(address,uint256,bytes32)');
    });

    it('남의 잔액을 태우는 함수는 없다', async () => {
      const { token, operator, minter } = await loadFixture(deploy);
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
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await expect(token.connect(minter).mint(alice.address, 500, opKey('charge_1')))
        .to.emit(token, 'Minted')
        .withArgs(alice.address, 500, opKey('charge_1'));

      expect(await token.balanceOf(alice.address)).to.equal(500);
      expect(await token.totalSupply()).to.equal(500);
    });

    it('같은 operationKey 가 두 번 오면 두 번째는 거부한다 — 재시도해도 한 번만 발행', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_1'));

      await expect(token.connect(minter).mint(alice.address, 500, opKey('charge_1')))
        .to.be.revertedWithCustomError(token, 'OperationAlreadyExecuted')
        .withArgs(opKey('charge_1'));

      expect(await token.balanceOf(alice.address)).to.equal(500); // 1000 이 아니다
    });

    it('MINTER_ROLE 이 없으면 발행할 수 없다', async () => {
      const { token, operator, minter, outsider, alice } = await loadFixture(deploy);
      await expect(
        token.connect(outsider).mint(alice.address, 500, opKey('charge_2')),
      ).to.be.revertedWithCustomError(token, 'AccessControlUnauthorizedAccount');
    });

    it('수량 0 은 거부한다', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await expect(token.connect(minter).mint(alice.address, 0, opKey('charge_3'))).to.be.revertedWithCustomError(
        token,
        'AmountMustBePositive',
      );
    });
  });

  describe('burn — 티켓 결제 · 원화 출금', () => {
    it('소각하면 잔액과 총량이 함께 줄어든다', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_4'));

      await expect(token.connect(alice).burn(300, opKey('payment_4')))
        .to.emit(token, 'Burned')
        .withArgs(alice.address, 300, opKey('payment_4'));

      expect(await token.balanceOf(alice.address)).to.equal(200);
      // 트레저리로 옮긴 게 아니라 사라졌습니다. totalSupply 가 곧 미사용 캣머니입니다.
      expect(await token.totalSupply()).to.equal(200);
    });

    it('일부만 결제할 수 있다 — 캣머니는 포인트처럼 부분 결제', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 1000, opKey('charge_5'));
      await token.connect(alice).burn(300, opKey('payment_5'));
      expect(await token.balanceOf(alice.address)).to.equal(700);
    });

    it('같은 결제 키로 두 번 소각되지 않는다', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_6'));
      await token.connect(alice).burn(300, opKey('payment_6'));

      await expect(
        token.connect(alice).burn(300, opKey('payment_6')),
      ).to.be.revertedWithCustomError(token, 'OperationAlreadyExecuted');

      expect(await token.balanceOf(alice.address)).to.equal(200);
    });

    it('잔액이 부족하면 거부한다', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 100, opKey('charge_7'));
      await expect(
        token.connect(alice).burn(300, opKey('payment_7')),
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientBalance');
    });

    it('남의 잔액은 태울 수 없다 — 각자 자기 것만', async () => {
      const { token, operator, minter, alice, outsider } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_8'));

      // outsider 가 태워봐야 자기 잔액(0)에서 나갑니다. alice 는 멀쩡합니다.
      await expect(
        token.connect(outsider).burn(300, opKey('payment_8')),
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientBalance');
      expect(await token.balanceOf(alice.address)).to.equal(500);
    });
  });

  describe('환급 — 소각한 뒤 다시 발행', () => {
    it('결제 후 취소하면 원래대로 돌아온다', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_9'));
      await token.connect(alice).burn(300, opKey('payment_9'));
      expect(await token.balanceOf(alice.address)).to.equal(200);

      // 환급은 별도 operationKey 로 다시 발행합니다.
      await token.connect(minter).mint(alice.address, 300, opKey('refund_9'));
      expect(await token.balanceOf(alice.address)).to.equal(500);
      expect(await token.totalSupply()).to.equal(500);
    });

    it('결제와 환급은 이름공간이 달라 서로를 막지 않는다', async () => {
      const { token, minter, operator, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_10'));
      await token.connect(alice).burn(300, opKey('op_10'));

      // 같은 문자열이어도 mint 쪽 자리는 비어 있습니다.
      // 예전에는 여기서 막혔고, 그게 선점 공격의 원인이었습니다.
      await expect(token.connect(minter).mint(alice.address, 300, opKey('op_10'))).to.emit(
        token,
        'Minted',
      );
      expect(await token.balanceOf(alice.address)).to.equal(500);
    });
  });

  describe('operationKey 이름공간 — 선점 공격 방어 (회귀)', () => {
    it('무관한 보유자가 예정된 mint 키를 burn 으로 선점할 수 없다', async () => {
      const { token, operator, minter, victim, attacker } = await loadFixture(deploy);
      await token.connect(minter).mint(attacker.address, 1, opKey('seed_attacker'));

      // Spring 키는 순번이라 예측 가능합니다.
      const plannedMintKey = opKey('catmoney_deposit_20260902_00001');
      await token.connect(attacker).burn(1, plannedMintKey);

      // 그래도 민트는 나가야 합니다.
      await expect(token.connect(minter).mint(victim.address, 1500, plannedMintKey)).to.emit(
        token,
        'Minted',
      );
      expect(await token.balanceOf(victim.address)).to.equal(1500);
    });

    it('남이 내 결제 키를 미리 태워 막을 수 없다 — burn 은 호출자별로 격리', async () => {
      const { token, operator, minter, victim, attacker } = await loadFixture(deploy);
      await token.connect(minter).mint(attacker.address, 10, opKey('seed_a'));
      await token.connect(minter).mint(victim.address, 500, opKey('seed_v'));

      const victimPaymentKey = opKey('booking_payment_20260902_00001');
      await token.connect(attacker).burn(1, victimPaymentKey);

      await expect(token.connect(victim).burn(300, victimPaymentKey)).to.emit(token, 'Burned');
      expect(await token.balanceOf(victim.address)).to.equal(200);
    });

    it('mint 는 전역 유일 — 받는 사람이 달라도 같은 키로 두 번 발행되지 않는다', async () => {
      const { token, operator, minter, alice, bob } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 100, opKey('dup_key'));

      await expect(
        token.connect(minter).mint(bob.address, 100, opKey('dup_key')),
      ).to.be.revertedWithCustomError(token, 'OperationAlreadyExecuted');
      expect(await token.balanceOf(bob.address)).to.equal(0);
    });

    it('같은 유저는 같은 burn 키를 두 번 못 쓴다', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('seed_b'));
      await token.connect(alice).burn(100, opKey('pay_dup'));

      await expect(
        token.connect(alice).burn(100, opKey('pay_dup')),
      ).to.be.revertedWithCustomError(token, 'OperationAlreadyExecuted');
    });

    it('실행 여부를 조회할 수 있다 — 응답을 못 받았을 때 복구용', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      const k = opKey('probe_1');

      expect(await token.isMintExecuted(k)).to.equal(false);
      await token.connect(minter).mint(alice.address, 100, k);
      expect(await token.isMintExecuted(k)).to.equal(true);
      // 같은 문자열이어도 burn 쪽은 별개입니다.
      expect(await token.isBurnExecuted(alice.address, k)).to.equal(false);
    });
  });

  describe('pause — 나가는 것만 막는다', () => {
    it('정지하면 소각이 막힌다', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_11'));
      await token.connect(operator).pause();

      await expect(
        token.connect(alice).burn(100, opKey('payment_11')),
      ).to.be.revertedWithCustomError(token, 'EnforcedPause');
    });

    it('정지하면 유저 간 전송이 막힌다', async () => {
      const { token, operator, minter, alice, bob } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_12'));
      await token.connect(operator).pause();

      await expect(token.connect(alice).transfer(bob.address, 100)).to.be.revertedWithCustomError(
        token,
        'EnforcedPause',
      );
    });

    it('정지 중에도 발행은 된다 — 사고로 멈춰도 환급은 나가야 한다', async () => {
      const { token, operator, minter, alice } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_13'));
      await token.connect(alice).burn(300, opKey('payment_13'));

      await token.connect(operator).pause();
      expect(await token.paused()).to.equal(true);

      await expect(token.connect(minter).mint(alice.address, 300, opKey('refund_13'))).to.emit(token, 'Minted');
      expect(await token.balanceOf(alice.address)).to.equal(500);
    });

    it('발행 키가 털린 경우는 정지가 아니라 역할 회수로 막는다', async () => {
      const { token, operator, admin, minter, alice } = await loadFixture(deploy);
      // admin 은 API 에 올라가지 않는 별도 키입니다. 그래서 minter 가 털려도 회수할 수 있습니다.
      await token.connect(admin).revokeRole(await token.MINTER_ROLE(), minter.address);

      await expect(
        token.connect(minter).mint(alice.address, 500, opKey('charge_14')),
      ).to.be.revertedWithCustomError(token, 'AccessControlUnauthorizedAccount');
    });

    it('해제하면 다시 돈다', async () => {
      const { token, operator, minter, alice, bob } = await loadFixture(deploy);
      await token.connect(minter).mint(alice.address, 500, opKey('charge_15'));
      await token.connect(operator).pause();
      await token.connect(operator).unpause();
      await token.connect(alice).transfer(bob.address, 100);
      expect(await token.balanceOf(bob.address)).to.equal(100);
    });
  });
});
