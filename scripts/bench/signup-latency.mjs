#!/usr/bin/env node
/**
 * 회원가입 응답 시간 측정.
 *
 * 왜 있나
 *   가입은 트랜잭션 안에서 블록체인 서비스(지갑 파생 + 1,500 CAT 민팅 제출)를 동기로 부른다.
 *   이 호출을 비동기(RabbitMQ)로 빼기 전/후의 응답 시간을 **같은 조건**으로 비교하기 위한
 *   스크립트다. 결과는 results/ 에 JSON 으로 남고, 나중에 `--label after` 로 다시 돌려 붙인다.
 *
 * 무엇을 재나 (모두 클라이언트에서 본 왕복 시간, TLS·네트워크 포함)
 *   1. signup(sequential)  — 가입을 한 건씩 순서대로. 체인 호출이 포함된 기준값.
 *   2. signup(concurrent)  — 가입을 C 건 동시에 W 번. 블록체인 서비스의 논스 직렬화 큐가
 *                            만드는 꼬리(p95/p99)를 드러낸다.
 *   3. signup-dup(409)     — 이미 있는 이메일로 가입. 중복 검사에서 끝나 **체인을 안 부른다**.
 *                            같은 엔드포인트의 "체인 없는 비용" 대조군.
 *   4. login               — DB 조회 + bcrypt. 체인 없는 일반 쓰기 경로 대조군.
 *
 * 🔴 실제 회원이 생기고, 회원마다 파생 인덱스 하나와 1,500 CAT 민팅 트랜잭션이 소모된다.
 *    개발 서버에만 쓸 것. 만든 회원은 이메일이 `bench-<runId>-…@teacat-bench.local` 이라
 *    나중에 골라서 지울 수 있다.
 *
 * 사용
 *   node scripts/bench/signup-latency.mjs --label before
 *   node scripts/bench/signup-latency.mjs --label after --base https://dev.teacat.site/api
 *   옵션: --seq 30 (순차 건수)  --conc 10 (동시 건수)  --waves 3 (동시 반복)
 *         --controls 20 (대조군 건수)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const args = parseArgs(process.argv.slice(2));
const BASE = (args.base ?? 'https://dev.teacat.site/api').replace(/\/$/, '');
const LABEL = args.label ?? 'run';
const SEQ = Number(args.seq ?? 30);
const CONC = Number(args.conc ?? 10);
const WAVES = Number(args.waves ?? 3);
const CONTROLS = Number(args.controls ?? 20);
const PASSWORD = 'Bench1234!';
const RUN_ID = Math.random().toString(36).slice(2, 8);

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'results');
mkdirSync(outDir, { recursive: true });

let seq = 0;
function newUser() {
  const n = String(seq++).padStart(3, '0');
  return {
    email: `bench-${RUN_ID}-${n}@teacat-bench.local`,
    password: PASSWORD,
    name: '벤치',
    // 닉네임 규칙: 한글·영문·숫자 2~20자
    nickname: `bench${RUN_ID}${n}`,
    phone: `010-${String(1000 + Math.floor(Math.random() * 9000))}-${n.padStart(4, '0')}`,
  };
}

async function timed(path, body) {
  const t0 = performance.now();
  let status = 0;
  let code = null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    status = res.status;
    const text = await res.text();
    try { code = JSON.parse(text)?.code ?? null; } catch { /* 본문이 JSON 이 아니어도 시간은 유효하다 */ }
  } catch (e) {
    status = -1;
    code = e?.cause?.code ?? e?.message ?? 'FETCH_ERROR';
  }
  return { ms: performance.now() - t0, status, code };
}

const signup = (u) => timed('/auth/signup', u);
const login = (u) => timed('/auth/login', { email: u.email, password: u.password });

function stats(samples, okStatus) {
  const ok = samples.filter((s) => s.status === okStatus);
  const ms = ok.map((s) => s.ms).sort((a, b) => a - b);
  const pct = (p) => (ms.length ? ms[Math.min(ms.length - 1, Math.ceil((p / 100) * ms.length) - 1)] : null);
  const failures = {};
  for (const s of samples) if (s.status !== okStatus) failures[`${s.status}${s.code ? ':' + s.code : ''}`] = (failures[`${s.status}${s.code ? ':' + s.code : ''}`] ?? 0) + 1;
  return {
    n: samples.length,
    ok: ok.length,
    failures,
    min: ms[0] ?? null,
    p50: pct(50),
    p90: pct(90),
    p95: pct(95),
    p99: pct(99),
    max: ms.at(-1) ?? null,
    mean: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null,
  };
}

const fmt = (v) => (v == null ? '-' : `${v.toFixed(0)}`);
function row(name, s) {
  return `| ${name} | ${s.ok}/${s.n} | ${fmt(s.min)} | ${fmt(s.p50)} | ${fmt(s.p90)} | ${fmt(s.p95)} | ${fmt(s.p99)} | ${fmt(s.max)} | ${fmt(s.mean)} |`;
}

async function main() {
  console.log(`# signup latency  label=${LABEL}  base=${BASE}  runId=${RUN_ID}`);
  console.log(`# seq=${SEQ} conc=${CONC}x${WAVES} controls=${CONTROLS}\n`);

  // 워밍업: TLS 핸드셰이크·커넥션 풀을 통계 밖에서 미리 만든다
  await login({ email: 'warmup@teacat-bench.local', password: PASSWORD });

  // 1. 순차 가입
  const created = [];
  const seqSamples = [];
  for (let i = 0; i < SEQ; i++) {
    const u = newUser();
    const s = await signup(u);
    if (s.status === 201) created.push(u);
    seqSamples.push(s);
    process.stdout.write(`\r  sequential ${i + 1}/${SEQ}  last=${s.ms.toFixed(0)}ms status=${s.status}   `);
  }
  console.log();

  // 2. 동시 가입
  const concSamples = [];
  for (let w = 0; w < WAVES; w++) {
    const users = Array.from({ length: CONC }, newUser);
    const wave = await Promise.all(users.map(signup));
    wave.forEach((s, i) => { if (s.status === 201) created.push(users[i]); });
    concSamples.push(...wave);
    console.log(`  concurrent wave ${w + 1}/${WAVES}  max=${Math.max(...wave.map((s) => s.ms)).toFixed(0)}ms  ok=${wave.filter((s) => s.status === 201).length}/${CONC}`);
    // 파도 사이에 잠깐 쉬어 직렬화 큐가 비도록 한다. 파도 안의 경합만 보려는 것이다
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 3. 대조군: 중복 이메일 (체인 없음, 409)
  const dupSamples = [];
  if (created.length) {
    for (let i = 0; i < CONTROLS; i++) {
      const u = created[i % created.length];
      dupSamples.push(await signup({ ...u, nickname: `dup${RUN_ID}${i}` }));
    }
  }

  // 4. 대조군: 로그인 (체인 없음, 200)
  const loginSamples = [];
  if (created.length) {
    for (let i = 0; i < CONTROLS; i++) loginSamples.push(await login(created[i % created.length]));
  }

  const result = {
    label: LABEL,
    base: BASE,
    runId: RUN_ID,
    at: new Date().toISOString(),
    config: { seq: SEQ, conc: CONC, waves: WAVES, controls: CONTROLS },
    createdUsers: created.length,
    emailPattern: `bench-${RUN_ID}-%@teacat-bench.local`,
    metrics: {
      signup_sequential: stats(seqSamples, 201),
      signup_concurrent: stats(concSamples, 201),
      signup_duplicate_409: stats(dupSamples, 409),
      login: stats(loginSamples, 200),
    },
    raw: { seqSamples, concSamples, dupSamples, loginSamples },
  };

  const file = join(outDir, `${LABEL}-${result.at.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));

  console.log('\n단위 ms · 클라이언트 왕복 (TLS·네트워크 포함)\n');
  console.log('| 구간 | 성공 | min | p50 | p90 | p95 | p99 | max | 평균 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  console.log(row(`가입 순차 (체인 동기 포함)`, result.metrics.signup_sequential));
  console.log(row(`가입 동시 ${CONC}건×${WAVES}`, result.metrics.signup_concurrent));
  console.log(row(`가입 중복 409 (체인 없음)`, result.metrics.signup_duplicate_409));
  console.log(row(`로그인 (체인 없음)`, result.metrics.login));
  const m = result.metrics;
  for (const [k, v] of Object.entries(m)) if (Object.keys(v.failures).length) console.log(`  실패 ${k}: ${JSON.stringify(v.failures)}`);
  console.log(`\n생성된 회원 ${created.length}명 (email LIKE '${result.emailPattern}')`);
  console.log(`결과 파일: ${file}`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  }
  return out;
}

main().catch((e) => { console.error(e); process.exit(1); });
