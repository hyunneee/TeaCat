package com.teacat.server.nft.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record NftPhotocardIssueRequest(

        @Schema(description = "도안별 배정 수량")
        @NotEmpty(message = "도안별 배정 수량을 입력해 주세요.")
        List<@Valid NftDesignAllocationRequest> designAllocations
) {
}

