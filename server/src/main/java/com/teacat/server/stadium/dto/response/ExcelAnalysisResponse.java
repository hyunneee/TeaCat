package com.teacat.server.stadium.dto.response;

import java.util.List;

public record ExcelAnalysisResponse(
        String analysisId,
        Long stadiumId,
        int expiresIn,
        List<ExcelSheetResponse> sheets,
        List<ExcelCandidateResponse> seatCandidates,
        List<ExcelCandidateResponse> elementCandidates,
        List<String> warnings
) {
}
