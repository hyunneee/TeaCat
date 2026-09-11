package com.teacat.server.nft.dto.request;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NftRequestValidationTests {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void 판매가는_필수이며_양수여야_한다() {
        assertThat(validator.validate(new NftListingCreateRequest(null, "설명")))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("price");
        assertThat(validator.validate(new NftListingCreateRequest(0L, "설명")))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("price");
        assertThat(validator.validate(new NftListingCreateRequest(-1L, "설명")))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("price");
    }

    @Test
    void 판매자_설명은_생략하거나_비워둘_수_있다() {
        assertThat(validator.validate(new NftListingCreateRequest(1L, null)))
                .isEmpty();
        assertThat(validator.validate(new NftListingCreateRequest(1L, "")))
                .isEmpty();
        assertThat(validator.validate(new NftListingCreateRequest(1L, "   ")))
                .isEmpty();
    }

    @Test
    void 판매자_설명은_500자를_넘을_수_없다() {
        assertThat(validator.validate(new NftListingCreateRequest(1L, "가".repeat(501))))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("description");
        assertThat(validator.validate(new NftListingCreateRequest(1L, "가".repeat(500))))
                .isEmpty();
    }

    @Test
    void 발급_배정목록은_비어있을_수_없다() {
        assertThat(validator.validate(new NftPhotocardIssueRequest(null)))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("designAllocations");
        assertThat(validator.validate(new NftPhotocardIssueRequest(List.of())))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("designAllocations");
    }

    @Test
    void 발급_도안ID와_수량은_양수여야_한다() {
        NftPhotocardIssueRequest request = new NftPhotocardIssueRequest(List.of(
                new NftDesignAllocationRequest(null, 0),
                new NftDesignAllocationRequest(-1L, -1)
        ));

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains(
                        "designAllocations[0].designId",
                        "designAllocations[0].quantity",
                        "designAllocations[1].designId",
                        "designAllocations[1].quantity"
                );
    }
}
