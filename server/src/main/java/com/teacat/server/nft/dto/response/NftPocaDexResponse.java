package com.teacat.server.nft.dto.response;

import com.teacat.server.nft.entity.NftPhotocardGrade;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * 사용자별 포토카드 도감.
 *
 * <p>미보유 도안은 슬롯과 획득처만 알리고 앞면 정보는 보내지 않는다. 화면에서 가리는 것만으로는
 * 응답의 이미지 URL과 이름을 개발자 도구에서 볼 수 있기 때문이다.
 */
@Schema(description = "사용자별 포토카드 도감")
public record NftPocaDexResponse(

        @Schema(description = "수집 가능한 도안과 보유 상태")
        List<Card> cards,

        @Schema(description = "발행 또는 거래 정산이 아직 끝나지 않은 보유 카드 수", example = "1")
        long pendingCount
) {

    @Schema(description = "도감 한 칸. 미보유이면 앞면 정보는 null입니다")
    public record Card(
            @Schema(description = "도안 ID", example = "11") Long designId,
            @Schema(description = "보유 여부", example = "false") boolean owned,
            @Schema(description = "보유한 경우에만 내려가는 카드 이름", nullable = true) String name,
            @Schema(description = "보유한 경우에만 내려가는 이미지 주소", nullable = true) String imageUrl,
            @Schema(description = "보유한 경우에만 내려가는 소속", nullable = true) String group,
            @Schema(description = "보유한 경우에만 내려가는 연출 등급", nullable = true)
            NftPhotocardGrade grade,
            @Schema(description = "이 카드를 얻을 수 있는 공연 또는 이벤트 팩")
            Acquisition acquisition,
            @Schema(description = "가진 장수", example = "3") int count,
            @Schema(description = "그중 마켓에 나간 장수", example = "1") int marketCount,
            @Schema(description = "대표 카드의 마켓 상태", nullable = true)
            MyNftPhotocardSummaryResponse.MarketState marketState,
            @Schema(description = "보유한 경우 눌렀을 때 열 대표 카드", nullable = true)
            Long photocardId
    ) {
    }

    public record Acquisition(
            @Schema(description = "획득처 종류", example = "PERFORMANCE") AcquisitionType type,
            @Schema(description = "공연명 또는 이벤트 팩 이름", example = "2026 단독 콘서트") String name
    ) {
    }

    public enum AcquisitionType {
        PERFORMANCE,
        EVENT
    }
}
