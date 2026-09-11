import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture, mine } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import type { VerifiableDraw } from '../typechain-types';

const abi = ethers.AbiCoder.defaultAbiCoder();

/** Spring 이 보낸 문자열을 서버가 해싱합니다. `performanceId` 를 넣어 재추첨이 눈에 띄게 합니다. */
function drawId(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

/** 시드는 저장하지 않고 비밀에서 파생합니다. (PHOTOCARD_PLAN.md 4-6) */
function seedFrom(secret: string, key: string): string {
  return ethers.keccak256(abi.encode(['bytes32', 'bytes32'], [ethers.id(secret), key]));
}

/** 컨트랙트의 `keccak256(abi.encode(seed))` 와 같아야 합니다. */
function commitOf(seed: string): string {
  return ethers.keccak256(abi.encode(['bytes32'], [seed]));
}

/** 컨트랙트가 리빌에서 계산하는 것과 같은 식입니다. */
function randomnessOf(seed: string, blockHash: string): string {
  return ethers.keccak256(abi.encode(['bytes32', 'bytes32'], [seed, blockHash]));
}

/**
 * 참여자·수량을 묶은 해시. **이게 없으면 이 추첨은 아무것도 증명하지 못합니다.**
 * (PHOTOCARD_PLAN.md 4-3)
 */
function inputsHashOf(
  performanceId: bigint,
  ticketIds: bigint[],
  designIds: bigint[],
  quantities: bigint[],
): string {
  return ethers.keccak256(
    abi.encode(
      ['uint256', 'uint256[]', 'uint256[]', 'uint256[]'],
      [performanceId, ticketIds, designIds, quantities],
    ),
  );
}

/**
 * 배정 알고리즘. **Spring·이 서비스·제3자가 같은 값을 내야 합니다.**
 * (PHOTOCARD_PLAN.md 4-4)
 */
function assign(
  randomness: string,
  ticketIds: bigint[],
  designIds: bigint[],
  quantities: bigint[],
): { ticketId: bigint; designId: bigint }[] {
  const pool: bigint[] = [];
  for (let d = 0; d < designIds.length; d++) {
    for (let q = 0n; q < quantities[d]!; q++) pool.push(designIds[d]!);
  }
  if (pool.length !== ticketIds.length) throw new Error('수량 합계가 참여자 수와 다릅니다');

  for (let i = pool.length - 1; i >= 1; i--) {
    const draw = BigInt(ethers.keccak256(abi.encode(['bytes32', 'uint256'], [randomness, i])));
    const j = Number(draw % BigInt(i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return ticketIds.map((ticketId, k) => ({ ticketId, designId: pool[k]! }));
}

describe('VerifiableDraw', () => {
  const KEY = 'photocard_draw_perf_42';
  const SECRET = 'draw-seed-secret-for-test';

  const PERFORMANCE = 42n;
  const TICKETS = [5501n, 5502n, 5503n, 5504n, 5505n, 5506n];
  const DESIGNS = [11n, 12n];
  const QUANTITIES = [4n, 2n];

  async function deploy() {
    const [admin, operator, outsider] = await ethers.getSigners();
    const draw = (await ethers.deployContract('VerifiableDraw', [
      admin!.address,
      operator!.address,
    ])) as unknown as VerifiableDraw;
    await draw.waitForDeployment();

    const id = drawId(KEY);
    const seed = seedFrom(SECRET, id);
    const inputs = inputsHashOf(PERFORMANCE, TICKETS, DESIGNS, QUANTITIES);

    return { draw, admin: admin!, operator: operator!, outsider: outsider!, id, seed, inputs };
  }

  /** 커밋하고 대상 블록이 생길 때까지 진행시킨 상태. */
  async function opened() {
    const ctx = await deploy();
    await ctx.draw.connect(ctx.operator).openDraw(ctx.id, commitOf(ctx.seed), ctx.inputs);
    await mine(1);
    return ctx;
  }

  describe('기본', () => {
    it('역할이 둘로 나뉜다 — 발행 키는 여기 없다', async () => {
      const { draw, admin, operator } = await loadFixture(deploy);
      expect(await draw.hasRole(await draw.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
      expect(await draw.hasRole(await draw.OPERATOR_ROLE(), operator.address)).to.equal(true);
      expect(await draw.hasRole(await draw.DEFAULT_ADMIN_ROLE(), operator.address)).to.equal(false);
    });

    it('생성자가 0 주소를 거부한다', async () => {
      const [admin] = await ethers.getSigners();
      const factory = await ethers.getContractFactory('VerifiableDraw');
      await expect(
        factory.deploy(admin!.address, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(factory, 'ZeroAddress');
    });

    it('토큰도 참여자도 모른다 — 난수만 만든다', async () => {
      const { draw } = await loadFixture(deploy);
      const names = draw.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => f.format('sighash'));

      expect(names.filter((s) => /token|mint|transfer|balance|participant/i.test(s))).to.deep.equal(
        [],
      );
    });
  });

  describe('커밋', () => {
    it('시드가 아니라 시드 해시만 올라간다', async () => {
      const { draw, operator, id, seed, inputs } = await loadFixture(deploy);

      await expect(draw.connect(operator).openDraw(id, commitOf(seed), inputs)).to.emit(
        draw,
        'DrawOpened',
      );

      const state = await draw.getDraw(id);
      expect(state.exists).to.equal(true);
      expect(state.seedCommit).to.equal(commitOf(seed));
      expect(state.seedCommit).to.not.equal(seed); // 시드 자체는 체인에 없습니다
      expect(state.revealed).to.equal(false);
      expect(state.targetBlock).to.equal(state.commitBlock + 1n);
    });

    it('입력 해시를 그대로 보관한다 — 나중에 배정을 대조할 근거', async () => {
      const { draw, operator, id, seed, inputs } = await loadFixture(deploy);
      await draw.connect(operator).openDraw(id, commitOf(seed), inputs);
      expect((await draw.getDraw(id)).inputsHash).to.equal(inputs);
    });

    it('입력 해시 없이는 열 수 없다 — 그러면 증명이 성립하지 않는다', async () => {
      const { draw, operator, id, seed } = await loadFixture(deploy);
      await expect(
        draw.connect(operator).openDraw(id, commitOf(seed), ethers.ZeroHash),
      ).to.be.revertedWithCustomError(draw, 'EmptyInputsHash');
    });

    it('빈 drawId·빈 커밋을 거부한다', async () => {
      const { draw, operator, id, seed, inputs } = await loadFixture(deploy);
      await expect(
        draw.connect(operator).openDraw(ethers.ZeroHash, commitOf(seed), inputs),
      ).to.be.revertedWithCustomError(draw, 'EmptyDrawId');
      await expect(
        draw.connect(operator).openDraw(id, ethers.ZeroHash, inputs),
      ).to.be.revertedWithCustomError(draw, 'EmptyCommit');
    });

    it('같은 drawId 를 두 번 열 수 없다', async () => {
      const { draw, operator, id, seed, inputs } = await loadFixture(deploy);
      await draw.connect(operator).openDraw(id, commitOf(seed), inputs);

      await expect(draw.connect(operator).openDraw(id, commitOf(seed), inputs))
        .to.be.revertedWithCustomError(draw, 'DrawAlreadyExists')
        .withArgs(id);
    });

    it('외부인은 열 수 없다', async () => {
      const { draw, outsider, id, seed, inputs } = await loadFixture(deploy);
      await expect(
        draw.connect(outsider).openDraw(id, commitOf(seed), inputs),
      ).to.be.revertedWithCustomError(draw, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('리빌', () => {
    it('커밋 직후에는 리빌할 수 없다 — 대상 블록이 아직 없다', async () => {
      const { draw, operator, id, seed, inputs } = await loadFixture(deploy);
      await draw.connect(operator).openDraw(id, commitOf(seed), inputs);

      // 이 트랜잭션이 실릴 블록이 곧 대상 블록입니다. 자기 블록의 해시는 못 읽습니다.
      await expect(draw.connect(operator).revealDraw(id, seed)).to.be.revertedWithCustomError(
        draw,
        'TooEarly',
      );
    });

    it('한 블록 지나면 리빌된다', async () => {
      const { draw, operator, id, seed } = await loadFixture(opened);
      await expect(draw.connect(operator).revealDraw(id, seed)).to.emit(draw, 'DrawRevealed');
      expect((await draw.getDraw(id)).revealed).to.equal(true);
    });

    it('난수가 시드와 대상 블록해시로 계산된다 — 오프체인에서 재현된다', async () => {
      const { draw, operator, id, seed } = await loadFixture(opened);
      const target = (await draw.getDraw(id)).targetBlock;

      await draw.connect(operator).revealDraw(id, seed);

      const block = await ethers.provider.getBlock(Number(target));
      const expected = randomnessOf(seed, block!.hash!);

      // 로그만 있으면 제3자가 처음부터 다시 계산해 볼 수 있습니다.
      expect(await draw.randomnessOf(id)).to.equal(expected);
    });

    it('틀린 시드는 거부한다 — 결과를 보고 시드를 바꿀 수 없다', async () => {
      const { draw, operator, id } = await loadFixture(opened);
      const other = seedFrom(SECRET, drawId('다른_추첨'));

      await expect(draw.connect(operator).revealDraw(id, other))
        .to.be.revertedWithCustomError(draw, 'SeedMismatch')
        .withArgs(id);
    });

    it('두 번 리빌할 수 없다 — 난수는 한 번 정해지면 끝이다', async () => {
      const { draw, operator, id, seed } = await loadFixture(opened);
      await draw.connect(operator).revealDraw(id, seed);

      await expect(draw.connect(operator).revealDraw(id, seed))
        .to.be.revertedWithCustomError(draw, 'DrawAlreadyRevealed')
        .withArgs(id);
    });

    it('없는 추첨은 리빌할 수 없다', async () => {
      const { draw, operator, seed } = await loadFixture(deploy);
      await expect(
        draw.connect(operator).revealDraw(drawId('없는_추첨'), seed),
      ).to.be.revertedWithCustomError(draw, 'DrawNotFound');
    });

    it('외부인은 리빌할 수 없다', async () => {
      const { draw, outsider, id, seed } = await loadFixture(opened);
      await expect(draw.connect(outsider).revealDraw(id, seed)).to.be.revertedWithCustomError(
        draw,
        'AccessControlUnauthorizedAccount',
      );
    });
  });

  describe('256블록 창', () => {
    it('창을 넘기면 되살릴 수 없다', async () => {
      const { draw, operator, id, seed } = await loadFixture(opened);
      const window = Number(await draw.BLOCKHASH_WINDOW());

      // 이 체인은 블록이 약 10초라 대략 42분입니다.
      await mine(window + 2);

      await expect(draw.connect(operator).revealDraw(id, seed)).to.be.revertedWithCustomError(
        draw,
        'BlockhashExpired',
      );
    });

    it('창 안이면 늦게라도 리빌된다', async () => {
      const { draw, operator, id, seed } = await loadFixture(opened);
      await mine(Number(await draw.BLOCKHASH_WINDOW()) - 4);

      await expect(draw.connect(operator).revealDraw(id, seed)).to.emit(draw, 'DrawRevealed');
    });
  });

  describe('취소', () => {
    it('아직 리빌할 수 있으면 접을 수 없다 — 결과가 싫다고 즉시 못 접는다', async () => {
      const { draw, operator, id } = await loadFixture(opened);
      await expect(draw.connect(operator).cancelDraw(id))
        .to.be.revertedWithCustomError(draw, 'DrawStillRevealable')
        .withArgs(id);
    });

    it('창이 지난 뒤에만 접힌다', async () => {
      const { draw, operator, id } = await loadFixture(opened);
      await mine(Number(await draw.BLOCKHASH_WINDOW()) + 2);

      await expect(draw.connect(operator).cancelDraw(id)).to.emit(draw, 'DrawCanceled');
      expect((await draw.getDraw(id)).canceled).to.equal(true);
    });

    it('접어도 그 번호는 풀리지 않는다 — 다시 뽑은 흔적이 남는다', async () => {
      const { draw, operator, id, seed, inputs } = await loadFixture(opened);
      await mine(Number(await draw.BLOCKHASH_WINDOW()) + 2);
      await draw.connect(operator).cancelDraw(id);

      // 재사용을 허용하면 재추첨이 덮여서 마지막 방어선이 사라집니다.
      await expect(draw.connect(operator).openDraw(id, commitOf(seed), inputs))
        .to.be.revertedWithCustomError(draw, 'DrawAlreadyExists')
        .withArgs(id);
    });

    it('접힌 추첨의 난수는 읽히지 않는다', async () => {
      const { draw, operator, id } = await loadFixture(opened);
      await mine(Number(await draw.BLOCKHASH_WINDOW()) + 2);
      await draw.connect(operator).cancelDraw(id);

      await expect(draw.randomnessOf(id)).to.be.revertedWithCustomError(draw, 'DrawIsCanceled');
    });

    it('이미 리빌된 추첨은 접을 수 없다', async () => {
      const { draw, operator, id, seed } = await loadFixture(opened);
      await draw.connect(operator).revealDraw(id, seed);
      await mine(Number(await draw.BLOCKHASH_WINDOW()) + 2);

      await expect(draw.connect(operator).cancelDraw(id)).to.be.revertedWithCustomError(
        draw,
        'DrawAlreadyRevealed',
      );
    });
  });

  describe('난수 읽기', () => {
    it('리빌 전에는 0 이 아니라 revert 한다', async () => {
      const { draw, id } = await loadFixture(opened);

      /* 0 을 돌려주면 부르는 쪽이 그걸 난수로 알고 **전원이 같은 도안을 받는**
         배정을 계산합니다. 조용히 틀리는 것보다 던지는 편이 낫습니다. */
      await expect(draw.randomnessOf(id)).to.be.revertedWithCustomError(draw, 'TooEarly');
    });

    it('없는 추첨도 revert 한다', async () => {
      const { draw } = await loadFixture(deploy);
      await expect(draw.randomnessOf(drawId('없음'))).to.be.revertedWithCustomError(
        draw,
        'DrawNotFound',
      );
    });
  });

  describe('배정 (4-4 명세)', () => {
    it('같은 난수로 계산하면 언제나 같은 배정이 나온다', async () => {
      const { draw, operator, id, seed } = await loadFixture(opened);
      await draw.connect(operator).revealDraw(id, seed);
      const randomness = await draw.randomnessOf(id);

      const first = assign(randomness, TICKETS, DESIGNS, QUANTITIES);
      const second = assign(randomness, TICKETS, DESIGNS, QUANTITIES);

      // 순수 함수라 누가 계산하든 같습니다. Spring 이 계산해도 검증이 성립합니다.
      expect(first).to.deep.equal(second);
    });

    it('도안별 수량이 정확히 지켜진다', async () => {
      const { draw, operator, id, seed } = await loadFixture(opened);
      await draw.connect(operator).revealDraw(id, seed);

      const result = assign(await draw.randomnessOf(id), TICKETS, DESIGNS, QUANTITIES);
      const counts = new Map<bigint, number>();
      for (const row of result) counts.set(row.designId, (counts.get(row.designId) ?? 0) + 1);

      expect(counts.get(11n)).to.equal(4);
      expect(counts.get(12n)).to.equal(2);
      expect(result.map((r) => r.ticketId)).to.deep.equal(TICKETS);
    });

    it('난수가 다르면 배정도 달라진다', async () => {
      const a = assign(ethers.id('난수 A'), TICKETS, DESIGNS, QUANTITIES);
      const b = assign(ethers.id('난수 B'), TICKETS, DESIGNS, QUANTITIES);
      expect(a).to.not.deep.equal(b);
    });

    it('입력이 한 글자만 달라도 inputsHash 가 달라진다', async () => {
      const base = inputsHashOf(PERFORMANCE, TICKETS, DESIGNS, QUANTITIES);

      // 참여자 순서를 바꾸면 배정이 통째로 달라집니다. 그래서 순서까지 묶습니다.
      const swapped = [...TICKETS];
      [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];

      expect(inputsHashOf(PERFORMANCE, swapped, DESIGNS, QUANTITIES)).to.not.equal(base);
      expect(inputsHashOf(PERFORMANCE, TICKETS, DESIGNS, [3n, 3n])).to.not.equal(base);
      expect(inputsHashOf(43n, TICKETS, DESIGNS, QUANTITIES)).to.not.equal(base);
    });
  });
});
