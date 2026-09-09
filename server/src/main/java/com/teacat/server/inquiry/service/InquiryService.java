package com.teacat.server.inquiry.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.inquiry.dto.request.InquiryCreateRequest;
import com.teacat.server.inquiry.dto.request.InquiryUpdateRequest;
import com.teacat.server.inquiry.dto.response.InquiryPageResponse;
import com.teacat.server.inquiry.dto.response.InquiryResponse;
import com.teacat.server.inquiry.dto.response.InquirySummaryResponse;
import com.teacat.server.inquiry.entity.Inquiry;
import com.teacat.server.inquiry.exception.InquiryErrorCode;
import com.teacat.server.inquiry.repository.InquiryRepository;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원이 쓰는 문의 기능.
 *
 * 관리자용은 {@link AdminInquiryService} 에 따로 있다. 같은 테이블을 보지만
 * "내 것만 볼 수 있다" 와 "전부 볼 수 있다" 는 규칙이 정반대라 한 클래스에 섞으면
 * 권한 검사를 빠뜨리기 쉽다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InquiryService {

    private final InquiryRepository inquiryRepository;
    private final UserRepository userRepository;

    @Transactional
    public InquiryResponse create(Long userId, InquiryCreateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        Inquiry inquiry = inquiryRepository.save(
                Inquiry.create(user, request.type(), request.title(), request.content()));

        return InquiryResponse.from(inquiry);
    }

    /** 내 문의 목록 (최신순) */
    public InquiryPageResponse getMyInquiries(Long userId, Pageable pageable) {
        return InquiryPageResponse.from(
                inquiryRepository.findByUserId(userId, pageable).map(InquirySummaryResponse::from));
    }

    public InquiryResponse getMyInquiry(Long userId, Long inquiryId) {
        return InquiryResponse.from(getOwnInquiry(userId, inquiryId));
    }

    /** 답변이 달리기 전에만 고칠 수 있다 */
    @Transactional
    public InquiryResponse update(Long userId, Long inquiryId, InquiryUpdateRequest request) {
        Inquiry inquiry = getEditableInquiry(userId, inquiryId);
        inquiry.edit(request.type(), request.title(), request.content());

        return InquiryResponse.from(inquiry);
    }

    /** 답변이 달리기 전에만 지울 수 있다 */
    @Transactional
    public void delete(Long userId, Long inquiryId) {
        inquiryRepository.delete(getEditableInquiry(userId, inquiryId));
    }

    private Inquiry getEditableInquiry(Long userId, Long inquiryId) {
        Inquiry inquiry = getOwnInquiry(userId, inquiryId);

        if (inquiry.isAnswered()) {
            throw new BusinessException(InquiryErrorCode.INQUIRY_ALREADY_ANSWERED);
        }

        return inquiry;
    }

    /**
     * 남의 문의는 "없는 것"과 같게 다룬다.
     *
     * 존재는 하는데 권한만 없다고 알려주면 ID 를 하나씩 넣어보며 남의 문의가 있는지 알아낼 수 있다.
     * 다만 자기 글을 잘못 지운 경우와 구분이 안 되면 곤란하므로 소유자 위반은 403 으로 남긴다.
     */
    private Inquiry getOwnInquiry(Long userId, Long inquiryId) {
        Inquiry inquiry = inquiryRepository.findById(inquiryId)
                .orElseThrow(() -> new BusinessException(InquiryErrorCode.INQUIRY_NOT_FOUND));

        if (!inquiry.isOwnedBy(userId)) {
            throw new BusinessException(InquiryErrorCode.INQUIRY_FORBIDDEN);
        }

        return inquiry;
    }
}
