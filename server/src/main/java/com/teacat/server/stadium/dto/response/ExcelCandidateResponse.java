package com.teacat.server.stadium.dto.response;

import java.math.BigDecimal;

public record ExcelCandidateResponse(
        String candidateId,
        String sheet,
        String sourceType,
        String shapeType,
        String rawText,
        BigDecimal x,
        BigDecimal y,
        BigDecimal width,
        BigDecimal height,
        String styleFingerprint
) {
}
