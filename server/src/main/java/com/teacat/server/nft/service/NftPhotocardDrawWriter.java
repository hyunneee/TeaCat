package com.teacat.server.nft.service;

/* 2026-09-11: 이벤트 판정이 표(nft_photocard_pack_events)로 옮겨가 더는 쓰지 않는다.
import com.teacat.server.common.config.NftPhotocardDrawProperties;
*/
import com.teacat.server.common.config.BookingPolicyProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.entity.NftPhotocard;
import com.teacat.server.nft.entity.NftPhotocardDesign;
import com.teacat.server.nft.entity.NftPhotocardGrade;
import com.teacat.server.nft.entity.NftPhotocardPack;
import com.teacat.server.nft.entity.NftPhotocardPackEvent;
import com.teacat.server.nft.entity.NftPhotocardPackSource;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftMarketQueryRepository;
import com.teacat.server.nft.repository.NftMarketQueryRepository.UserWalletRow;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import com.teacat.server.nft.repository.NftPhotocardPackEventRepository;
import com.teacat.server.nft.repository.NftPhotocardPackRepository;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.repository.UserRepository;
import com.teacat.server.wallet.client.BlockchainProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 뽑기의 <b>트랜잭션 단위</b>. 팩 잠금 → 도안 무작위 잠금 → 카드 행 → 팩 소비를 한 트랜잭션에서 끝낸다.
 *
 * <p><b>여기에는 외부 호출이 없다.</b> 체인은 {@link NftPhotocardDrawService} 가 커밋 뒤에 부른다.
 * 체인이 실패해도 이 트랜잭션은 되돌리지 않는다 — 카드 행은 이미 사용자 것이고
 * {@code photocardKey = nft_photocards.id} 라 재전송이 안전하다. 되돌리면 팩만 돌아오고 카드 행은 고아가 된다.
 *
 * <p>같은 {@code (user, key)} 가 <b>동시에</b> 두 번 오면 둘 다 조회에서 못 찾고 각자 팩을 잠근 뒤 커밋에서
 * {@code uq_nft_photocard_packs_idempotency} 에 걸린다. 그 예외는 밖으로 나가고 서비스가 잡아
 * {@link #findReplay} 로 먼저 커밋된 카드를 돌려준다 — {@code NftService.purchase} 와 같은 패턴이다.
 */
@Component
@RequiredArgsConstructor
public class NftPhotocardDrawWriter {

    private final NftPhotocardPackRepository packRepository;
    private final NftPhotocardDesignRepository designRepository;
    private final NftPhotocardRepository photocardRepository;
    private final UserRepository userRepository;
    private final NftMarketQueryRepository queryRepository;
    private final BlockchainProperties blockchainProperties;
    private final NftPhotocardPackEventRepository packEventRepository;
    private final BookingPolicyProperties bookingPolicy;
    /* 2026-09-11: 이벤트 판정이 표(nft_photocard_pack_events)로 옮겨가 더는 쓰지 않는다.
    private final NftPhotocardDrawProperties properties;
    */

    /**
     * 뽑기 결과. 체인 전송에 필요한 값({@code designId}, {@code walletAddress})까지 들고 나간다.
     *
     * @param replayed 같은 키의 이전 결과를 그대로 돌려준 것인가. true 면 체인에 다시 보내지 않는다
     */
    public record DrawOutcome(Long photocardId, Long designId, String designName, String imageUrl,
                              String group, NftPhotocardGrade grade, LocalDateTime issuedAt,
                              String walletAddress, boolean replayed) {
    }

    @Transactional
    public DrawOutcome draw(Long userId, UUID key) {
        Optional<NftPhotocardPack> done = packRepository.findByUserIdAndIdempotencyKey(userId, key);
        if (done.isPresent()) {
            return replay(done.get());
        }

        NftPhotocardPack pack = packRepository
                .lockOneAvailable(userId, bookingPolicy.cancelDeadlineLead().toSeconds())
                .orElseThrow(() -> new BusinessException(NftErrorCode.PACK_NOT_AVAILABLE));

        // 지갑은 도안을 잠그기 전에 본다 — 없으면 도안 잠금을 잡을 이유가 없다
        UserWalletRow wallet = queryRepository
                .findActiveWallets(List.of(userId), blockchainProperties.chainId()).stream()
                .findFirst()
                .orElseThrow(() -> new BusinessException(NftErrorCode.RECIPIENT_WALLET_NOT_FOUND));

        NftPhotocardDesign design = designRepository.lockRandomDrawCandidate()
                .orElseThrow(() -> new BusinessException(NftErrorCode.DRAW_POOL_EMPTY));
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_OWNER_NOT_FOUND));

        design.reserve(1);
        // IDENTITY 라 save 가 곧바로 INSERT 한다 — id 와 created_at 이 여기서 채워진다
        NftPhotocard photocard = photocardRepository.save(NftPhotocard.draw(design, owner, wallet.walletId()));
        pack.consume(photocard.getId(), key, LocalDateTime.now());

        return new DrawOutcome(photocard.getId(), design.getId(), design.getName(), design.getImageUrl(),
                design.getGroupName(), design.getGrade(), photocard.getCreatedAt(),
                wallet.address(), false);
    }

    /** 같은 키로 이미 끝난 뽑기가 있으면 그 결과. 동시 요청이 UNIQUE 에 걸린 뒤 서비스가 부른다 */
    @Transactional(readOnly = true)
    public Optional<DrawOutcome> findReplay(Long userId, UUID key) {
        return packRepository.findByUserIdAndIdempotencyKey(userId, key).map(this::replay);
    }

    /**
     * 이벤트 팩 한 개를 준다.
     *
     * @return 줬으면 true. 이미 받았으면 false. 존재 확인과 INSERT 사이에 끼어든 동시 요청은
     *         {@code uq_nft_photocard_packs_source} 위반으로 예외가 나가고 서비스가 false 로 바꾼다
     */
    @Transactional
    public boolean claimEventPack(Long userId) {
        /* 2026-09-11: 설정값(nft.photocard.draw.event-code) 판정을 표 조회로 바꿨다.
           설정은 바꿀 때마다 서버 재시작이 필요해 어드민 화면에서 다룰 수 없었다.
        if (!properties.hasEvent()) {
            return false;
        }
        String code = properties.eventCode();
        */
        Optional<NftPhotocardPackEvent> event = packEventRepository.findOngoing();
        if (event.isEmpty()) {
            return false;   // 진행 중인 이벤트가 없다. 에러가 아니다
        }
        String code = event.get().getCode();

        if (packRepository.existsByUserIdAndSourceAndSourceRef(userId, NftPhotocardPackSource.EVENT, code)) {
            return false;
        }
        packRepository.save(NftPhotocardPack.grantEvent(userId, code));
        return true;
    }

    /** 팩 개수 한 묶음. 상태 응답이 이걸 그대로 편다 */
    public record PackCounts(long openable, long scheduled, LocalDateTime nextOpenAt) {
    }

    /* 2026-09-11: counts() 로 대체했다. 개봉 시각이 생겨 "안 쓴 팩" 만으로는 화면을 못 그린다.
    @Transactional(readOnly = true)
    public long countAvailable(Long userId) {
        return packRepository.countByUserIdAndConsumedAtIsNull(userId);
    }
    */

    @Transactional(readOnly = true)
    public PackCounts counts(Long userId) {
        // 시각 판정은 전부 DB now() 로 한다 — 개봉 판정과 같은 시계를 써야 한다
        long leadSeconds = bookingPolicy.cancelDeadlineLead().toSeconds();
        return new PackCounts(
                packRepository.countOpenable(userId, leadSeconds),
                packRepository.countScheduled(userId, leadSeconds),
                packRepository.findNextOpenAt(userId, leadSeconds));
    }

    private DrawOutcome replay(NftPhotocardPack pack) {
        NftPhotocard photocard = photocardRepository.findById(pack.getPhotocardId())
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
        NftPhotocardDesign design = photocard.getDesign();
        return new DrawOutcome(photocard.getId(), design.getId(), design.getName(), design.getImageUrl(),
                design.getGroupName(), design.getGrade(), photocard.getCreatedAt(),
                null, true);
    }
}
