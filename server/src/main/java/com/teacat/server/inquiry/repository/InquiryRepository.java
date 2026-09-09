package com.teacat.server.inquiry.repository;

import com.teacat.server.inquiry.entity.Inquiry;
import com.teacat.server.inquiry.entity.InquiryStatus;
import com.teacat.server.inquiry.entity.InquiryType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 목록 조회에는 {@link EntityGraph} 로 작성자를 함께 읽는다. 안 그러면 행마다 회원을 한 번씩 더 읽는다.
 *
 * 관리자 목록의 필터는 "값이 없으면 안 거른다" 인데, 이걸 한 쿼리 안에서
 * {@code :status IS NULL OR ...} 로 처리하면 Postgres 가 바인딩 타입을 추론하지 못해
 * <b>could not determine data type of parameter</b> 로 터진다(enum 파라미터라 더 그렇다).
 * 그래서 조합별 메서드를 두고 서비스가 고른다.
 */
public interface InquiryRepository extends JpaRepository<Inquiry, Long> {

    @EntityGraph(attributePaths = "user")
    Page<Inquiry> findByUserId(Long userId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = "user")
    Page<Inquiry> findAll(Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<Inquiry> findByStatus(InquiryStatus status, Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<Inquiry> findByType(InquiryType type, Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<Inquiry> findByStatusAndType(InquiryStatus status, InquiryType type, Pageable pageable);

    long countByStatus(InquiryStatus status);
}
