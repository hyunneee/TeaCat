package com.teacat.server.nft.service;

import com.teacat.server.nft.entity.NftDesignChainStatus;
import com.teacat.server.nft.entity.NftMintStatus;
import com.teacat.server.nft.repository.NftPhotocardDesignRepository;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.nft.repository.NftTicketRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 온체인 발행 파이프라인의 적체를 지표로 내보낸다.
 *
 * <p><b>왜 필요한가.</b> 발행은 비동기다 — Spring 은 블록체인 서비스에 요청을 보내고 202 를 받은 뒤
 * 바로 끝난다. 실제 확정은 저쪽 확정 감시가 나중에 DB 에 적는다. 그래서 발행이 통째로 멈춰도
 * <b>HTTP 로는 아무 일도 일어나지 않는다.</b> 5xx 도, 지연도, 예외도 없다. 인프라 지표(CPU·메모리)도
 * 정상이다. 이 적체를 볼 수 있는 곳은 DB 상태 분포뿐이라, 그걸 여기서 긁어 게이지로 만든다.
 *
 * <p><b>왜 개수와 체류 시간을 같이 보는가.</b> MINTING 이 100건이어도 계속 흘러가는 중이면 정상이고,
 * 1건이어도 20분째 그대로면 사고다. 알림은 체류 시간으로 건다
 * (docker/monitoring/prometheus/rules/alerts.yml).
 *
 * <p>주기는 넉넉히 잡는다. 사용자가 기다리는 값이 아니고, 스크레이프 주기(15초)보다 촘촘할 이유도 없다.
 * 쿼리는 상태 컬럼 group by 세 번이라 오픈 시간대에 끼어들어도 부담이 없다.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "nft.metrics.enabled", havingValue = "true", matchIfMissing = true)
public class NftChainPipelineMetrics {

    /** 이 상태에 오래 머무는 것이 곧 사고다. 확정 감시가 옮겨줘야 하는 값이기 때문이다 */
    private static final NftMintStatus STUCK_STATUS = NftMintStatus.MINTING;

    private final NftPhotocardRepository photocardRepository;
    private final NftTicketRepository ticketRepository;
    private final NftPhotocardDesignRepository designRepository;

    /**
     * 게이지가 읽어가는 값들. <b>enum 값 전부를 미리 등록한다</b> — 관측된 상태만 등록하면
     * FAILED 가 0 건이 되는 순간 시계열이 사라져서, 그래프가 "0" 이 아니라 "끊김" 으로 보인다.
     */
    private final Map<NftMintStatus, AtomicLong> photocardCounts = new EnumMap<>(NftMintStatus.class);
    private final Map<NftMintStatus, AtomicLong> ticketCounts = new EnumMap<>(NftMintStatus.class);
    private final Map<NftDesignChainStatus, AtomicLong> designCounts = new EnumMap<>(NftDesignChainStatus.class);

    private final AtomicLong photocardStuckSeconds = new AtomicLong(0);
    private final AtomicLong ticketStuckSeconds = new AtomicLong(0);

    public NftChainPipelineMetrics(NftPhotocardRepository photocardRepository,
            NftTicketRepository ticketRepository,
            NftPhotocardDesignRepository designRepository,
            MeterRegistry registry) {
        this.photocardRepository = photocardRepository;
        this.ticketRepository = ticketRepository;
        this.designRepository = designRepository;

        for (NftMintStatus status : NftMintStatus.values()) {
            photocardCounts.put(status, registerCount(registry, "teacat.nft.photocard.count",
                    "상태별 포토카드 수", status.name()));
            ticketCounts.put(status, registerCount(registry, "teacat.nft.ticket.count",
                    "상태별 티켓 SBT 수", status.name()));
        }
        for (NftDesignChainStatus status : NftDesignChainStatus.values()) {
            designCounts.put(status, registerCount(registry, "teacat.nft.design.count",
                    "온체인 등록 상태별 도안 수", status.name()));
        }

        registerStuckAge(registry, "teacat.nft.photocard.stuck.age",
                "가장 오래된 MINTING 포토카드의 체류 시간", photocardStuckSeconds);
        registerStuckAge(registry, "teacat.nft.ticket.stuck.age",
                "가장 오래된 MINTING 티켓의 체류 시간", ticketStuckSeconds);
    }

    private AtomicLong registerCount(MeterRegistry registry, String name, String description, String status) {
        AtomicLong holder = new AtomicLong(0);
        Gauge.builder(name, holder, AtomicLong::get)
                .description(description)
                .tag("status", status)
                .register(registry);
        return holder;
    }

    private void registerStuckAge(MeterRegistry registry, String name, String description, AtomicLong holder) {
        Gauge.builder(name, holder, AtomicLong::get)
                .description(description)
                .baseUnit("seconds")
                .register(registry);
    }

    @Scheduled(fixedDelayString = "${nft.metrics.refresh-interval:PT30S}")
    @Transactional(readOnly = true)
    public void refresh() {
        try {
            refreshCounts();
            refreshStuckAges();
        } catch (Exception e) {
            // 🔴 여기서 예외가 새어 나가면 스케줄러가 이 작업을 <b>영구히</b> 중단한다.
            //    지표 수집 실패가 지표 수집 자체를 죽이는 건 최악이라 삼키고 다음 주기를 기다린다.
            log.warn("체인 파이프라인 지표 갱신 실패. 다음 주기에 다시 시도합니다: {}", e.getMessage());
        }
    }

    private void refreshCounts() {
        photocardCounts.values().forEach(holder -> holder.set(0));
        ticketCounts.values().forEach(holder -> holder.set(0));
        designCounts.values().forEach(holder -> holder.set(0));

        photocardRepository.countGroupByStatus()
                .forEach(row -> photocardCounts.get(row.getStatus()).set(row.getCount()));
        ticketRepository.countGroupByStatus()
                .forEach(row -> ticketCounts.get(row.getStatus()).set(row.getCount()));
        designRepository.countGroupByChainStatus()
                .forEach(row -> designCounts.get(row.getStatus()).set(row.getCount()));
    }

    private void refreshStuckAges() {
        photocardStuckSeconds.set(ageSeconds(photocardRepository.findOldestUpdatedAt(STUCK_STATUS)));
        ticketStuckSeconds.set(ageSeconds(ticketRepository.findOldestUpdatedAt(STUCK_STATUS)));
    }

    /**
     * 적체가 없으면 0 이다.
     *
     * <p>DB 와 앱이 모두 Asia/Seoul 이라는 전제로 {@code LocalDateTime.now()} 와 뺀다
     * (docker-compose 의 TZ 설정). 시간대가 어긋나면 이 값이 9시간씩 튄다.
     */
    private long ageSeconds(LocalDateTime oldest) {
        if (oldest == null) {
            return 0;
        }
        return Math.max(0, Duration.between(oldest, LocalDateTime.now()).getSeconds());
    }
}
