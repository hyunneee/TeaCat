#!/usr/bin/env bash
#
# 내 브랜치를 dev 에 합치면 마이그레이션 버전이 겹치는지 **머지하기 전에** 본다.
#
#   ./scripts/check-migration-clash.sh            # dev 와 비교
#   ./scripts/check-migration-clash.sh origin/main
#
# 🔴 왜 따로 필요한가 —
#    build.gradle(checkMigrationVersions)과 Jenkinsfile('사전 점검')에도 같은 검사가
#    있지만, 둘 다 **합쳐진 뒤**를 본다. 각자 브랜치에서는 버전이 하나씩뿐이라 멀쩡하고
#    dev 로 합쳐지는 순간에만 둘이 된다. 그래서 만든 사람은 끝까지 모르고,
#    알게 되는 시점에는 이미 dev 가 멈춰 있다 (2026-09-22 하루 두 번).
#
#    이 스크립트는 "내가 새로 넣은 버전이 이미 dev 에 있나" 를 본다. MR 올리기 전에
#    한 번 돌리면 그 사고가 없다.
set -euo pipefail

BASE="${1:-origin/dev}"
DIR="server/src/main/resources/db/migration"

cd "$(dirname "$0")/.."

# 원격 상태가 낡아 있으면 "겹치지 않는다" 고 잘못 말한다. 비교 전에 받아 둔다
if [ "${BASE#origin/}" != "$BASE" ]; then
    git fetch -q origin "${BASE#origin/}" 2>/dev/null || true
fi

git rev-parse --verify --quiet "$BASE" >/dev/null || {
    echo "기준 브랜치 $BASE 를 찾지 못했습니다."
    exit 2
}

# 버전만 뽑는다 — V20260922_1600__add_game.sql → V20260922_1600
versions() { sed 's|.*/||; s|__.*||' | sort -u; }

base_versions=$(git ls-tree -r --name-only "$BASE" -- "$DIR" | versions)
# 이 브랜치가 **새로 더한** 파일만 본다. 기존 파일은 양쪽에 같은 이름으로 있으므로
# 그대로 비교하면 전부 겹치는 것으로 나온다.
#
# 🔴 --no-renames 가 필요하다. git 은 파일 이름만 바뀌면 "이름 변경(R)" 으로 묶어서
#    추가(A)에 잡히지 않는데, 마이그레이션에서는 **이름이 곧 버전**이라 이름을 바꾼 것이
#    곧 새 버전을 넣은 것이다. 묶여 버리면 정작 버전을 옮긴 커밋을 검사에서 놓친다
added=$(git diff --name-only --no-renames --diff-filter=A "$BASE...HEAD" -- "$DIR" | versions)

if [ -z "$added" ]; then
    echo "이 브랜치가 새로 넣은 마이그레이션이 없습니다. (기준: $BASE)"
    exit 0
fi

clash=$(comm -12 <(echo "$base_versions") <(echo "$added") || true)

if [ -z "$clash" ]; then
    echo "겹치는 버전 없음 — 합쳐도 됩니다. (기준: $BASE)"
    echo "새로 넣은 버전:"
    echo "$added" | sed 's|^|  |'
    exit 0
fi

echo "합치면 버전이 겹칩니다. 이대로 머지하면 서버가 기동하지 못합니다. (기준: $BASE)"
echo
for v in $clash; do
    echo "  버전 $v"
    echo "    $BASE : $(git ls-tree -r --name-only "$BASE" -- "$DIR" | sed 's|.*/||' | grep "^${v}__" | tr '\n' ' ')"
    echo "    내 브랜치 : $(ls "$DIR" | grep "^${v}__" | tr '\n' ' ')"
done
echo
echo "  → 내 파일의 버전을 뒤로 미세요 (내용은 그대로 두고 파일 이름만 바꿉니다)."
echo "     아직 어디에도 적용되지 않은 쪽을 옮기는 것이 안전합니다 —"
echo "     이미 적용된 마이그레이션의 이름을 바꾸면 Flyway 가"
echo "     '적용됐는데 파일이 없다' 로 또 거부합니다."
exit 1
