package com.teacat.server.nft.service;

import com.teacat.server.nft.dto.response.NftTemplateDexResponse;
import com.teacat.server.nft.dto.response.NftPocaDexResponse.Acquisition;
import com.teacat.server.nft.dto.response.MyNftPhotocardSummaryResponse.MarketState;
import com.teacat.server.nft.repository.NftTemplateDexQueryRepository;
import com.teacat.server.nft.repository.NftPhotocardTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NftTemplateDexService {
    private final NftTemplateDexQueryRepository queryRepository;
    private final NftPhotocardTemplateRepository templateRepository;

    @Transactional(readOnly = true)
    public NftTemplateDexResponse getDex(Long userId) {
        Map<Long, Tally> owned = new HashMap<>();
        long pending = 0;
        for (var row : queryRepository.findOwned(userId)) {
            Tally tally = owned.computeIfAbsent(row.templateId(), ignored -> new Tally());
            tally.count++;
            if (row.pending() || row.marketState() == MarketState.SETTLING) pending++;
            if (row.marketState() != null) {
                tally.marketCount++;
                if (tally.marketState == null) tally.marketState = row.marketState();
            }
            if (tally.photocardId == null || (tally.representativeOnMarket && row.marketState() == null)) {
                tally.photocardId = row.photocardId();
                tally.representativeOnMarket = row.marketState() != null;
            }
        }
        Map<Long, List<Acquisition>> sources = new HashMap<>();
        for (var row : queryRepository.findSources()) {
            sources.computeIfAbsent(row.templateId(), ignored -> new ArrayList<>()).add(row.acquisition());
        }
        var cards = templateRepository.findAllByHiddenFalseOrderByIdDesc().stream()
                .sorted(Comparator.comparing(com.teacat.server.nft.entity.NftPhotocardTemplate::getId))
                .map(template -> {
                    Tally tally = owned.getOrDefault(template.getId(), new Tally());
                    boolean hasCard = tally.count > 0;
                    return new NftTemplateDexResponse.Card(template.getId(), hasCard,
                            hasCard ? template.getName() : null, hasCard ? template.getImageUrl() : null,
                            hasCard ? template.getGroupName() : null, hasCard ? template.getGrade() : null,
                            sources.getOrDefault(template.getId(), List.of()), tally.count, tally.marketCount,
                            tally.marketState, tally.photocardId);
                }).toList();
        return new NftTemplateDexResponse(cards, pending);
    }

    private static class Tally {
        int count;
        int marketCount;
        MarketState marketState;
        Long photocardId;
        boolean representativeOnMarket;
    }
}
