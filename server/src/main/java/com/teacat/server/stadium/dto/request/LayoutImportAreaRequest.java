package com.teacat.server.stadium.dto.request;

import com.teacat.server.stadium.entity.AreaType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record LayoutImportAreaRequest(
        @NotBlank @Size(max = 20) String areaCode,
        @Size(max = 20) String levelCode,
        @Size(max = 100) String sourceSheet,
        @NotNull AreaType type,
        @Positive Integer maxSeat,
        @NotNull @Valid LayoutBoundsRequest bounds,
        List<String> acceptedCandidateIds,
        List<@Valid SeatCreateRequest> manualSeats,
        @Valid SeatLabelingRuleRequest labelingRule
) {
    public String levelCodeOrDefault() {
        return levelCode == null || levelCode.isBlank() ? "1F" : levelCode.strip();
    }

    public String sourceSheetOrDefault(String fallback) {
        return sourceSheet == null || sourceSheet.isBlank() ? fallback : sourceSheet;
    }

    public List<String> candidateIdsOrEmpty() {
        return acceptedCandidateIds == null ? List.of() : acceptedCandidateIds;
    }

    public List<SeatCreateRequest> manualSeatsOrEmpty() {
        return manualSeats == null ? List.of() : manualSeats;
    }
}
