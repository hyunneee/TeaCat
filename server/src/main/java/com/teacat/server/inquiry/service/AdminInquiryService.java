package com.teacat.server.inquiry.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.inquiry.dto.request.InquiryAnswerRequest;
import com.teacat.server.inquiry.dto.response.InquiryPageResponse;
import com.teacat.server.inquiry.dto.response.InquiryResponse;
import com.teacat.server.inquiry.dto.response.InquiryStatsResponse;
import com.teacat.server.inquiry.dto.response.InquirySummaryResponse;
import com.teacat.server.inquiry.entity.Inquiry;
import com.teacat.server.inquiry.entity.InquiryStatus;
import com.teacat.server.inquiry.entity.InquiryType;
import com.teacat.server.inquiry.exception.InquiryErrorCode;
import com.teacat.server.inquiry.repository.InquiryRepository;
import org.springframework.data.domain.Page;
import com.teacat.server.user.entity.User;
import com.teacat.server.user.exception.UserErrorCode;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 관리자가 쓰는 문의 기능.
 *
 * 여기 있는 메서드는 전부 남의 글을 다룬다. 그래서 컨트롤러가 /admin/** 에 있어야 하고
 * (SecurityConfig 의 포괄 규칙이 ADMIN 으로 잠근다), 소유자 검사를 하지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminInquiryService {

    private final InquiryRepository inquiryRepository;
    private final UserRepository userRepository;

    /** 상태·유형은 넘기지 않으면 거르지 않는다 */
    public InquiryPageResponse search(InquiryStatus status, InquiryType type, Pageable pageable) {
        return InquiryPageResponse.from(findPage(status, type, pageable).map(InquirySummaryResponse::from));
    }

    /**
     * 필터 조합별로 메서드를 고른다.
     *
     * 한 쿼리에서 {@code :status IS NULL OR ...} 로 처리하면 Postgres 가 enum 파라미터의
     * 타입을 추론하지 못해 실행 자체가 실패한다. (InquiryRepository 주석 참고)
     */
    private Page<Inquiry> findPage(InquiryStatus status, InquiryType type, Pageable pageable) {
        if (status != null && type != null) {
            return inquiryRepository.findByStatusAndType(status, type, pageable);
        }
        if (status != null) {
            return inquiryRepository.findByStatus(status, pageable);
        }
        if (type != null) {
            return inquiryRepository.findByType(type, pageable);
        }
        return inquiryRepository.findAll(pageable);
    }

    public InquiryResponse get(Long inquiryId) {
        return InquiryResponse.from(getInquiry(inquiryId));
    }

    public InquiryStatsResponse getStats() {
        return new InquiryStatsResponse(
                inquiryRepository.countByStatus(InquiryStatus.OPEN),
                inquiryRepository.countByStatus(InquiryStatus.ANSWERED),
                inquiryRepository.countByStatus(InquiryStatus.RESOLVED));
    }

    /**
     * 답변 등록·수정.
     *
     * 처음 답하면 ANSWERED 로 넘어간다. 이미 해결된 문의의 답변을 고쳐도 상태는 그대로 둔다 —
     * 오탈자를 고쳤다고 해결이 취소되면 곤란하다.
     */
    @Transactional
    public InquiryResponse answer(Long adminId, Long inquiryId, InquiryAnswerRequest request) {
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

        Inquiry inquiry = getInquiry(inquiryId);
        inquiry.answerBy(admin, request.answer(), LocalDateTime.now());

        return InquiryResponse.from(inquiry);
    }

    /** 해결 처리. 답변이 있어야 넘어갈 수 있다 (DB CHECK 으로도 막혀 있다) */
    @Transactional
    public InquiryResponse resolve(Long inquiryId) {
        Inquiry inquiry = getInquiry(inquiryId);

        if (!inquiry.isAnswered()) {
            throw new BusinessException(InquiryErrorCode.ANSWER_REQUIRED_BEFORE_RESOLVE);
        }
        if (inquiry.getStatus() == InquiryStatus.RESOLVED) {
            throw new BusinessException(InquiryErrorCode.INQUIRY_ALREADY_RESOLVED);
        }

        inquiry.resolve(LocalDateTime.now());

        return InquiryResponse.from(inquiry);
    }

    /** 해결을 되돌린다 (잘못 눌렀거나 다시 문제가 된 경우) */
    @Transactional
    public InquiryResponse reopen(Long inquiryId) {
        Inquiry inquiry = getInquiry(inquiryId);

        if (inquiry.getStatus() != InquiryStatus.RESOLVED) {
            throw new BusinessException(InquiryErrorCode.INQUIRY_NOT_RESOLVED);
        }

        inquiry.reopen();

        return InquiryResponse.from(inquiry);
    }

    private Inquiry getInquiry(Long inquiryId) {
        return inquiryRepository.findById(inquiryId)
                .orElseThrow(() -> new BusinessException(InquiryErrorCode.INQUIRY_NOT_FOUND));
    }
}
