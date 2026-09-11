package com.teacat.server.stadium.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

import com.teacat.server.stadium.entity.StadiumLayoutSaveMode;

public record StadiumLayoutCreateRequest(
        String analysisId,
        @NotBlank @Size(max = 100) String name,
        boolean isDefault,
        @NotNull StadiumLayoutSaveMode saveMode,
        String sourceSheet,
        @Positive int layoutWidth,
        @Positive int layoutHeight,
        @NotEmpty List<@Valid LayoutImportAreaRequest> areas,
        List<Map<String, Object>> layoutElements
) {
    public boolean hasAnalysis() {
        return analysisId != null && !analysisId.isBlank();
    }

    public String sourceSheetOrEmpty() {
        return sourceSheet == null ? "" : sourceSheet;
    }

    public List<Map<String, Object>> layoutElementsOrEmpty() {
        return layoutElements == null ? List.of() : layoutElements;
    }
}
