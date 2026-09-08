package com.teacat.server.stadium.service;

import com.teacat.server.stadium.dto.response.StadiumSummaryResponse;
import com.teacat.server.stadium.repository.StadiumRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 공연장 조회 (API-251).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StadiumService {

    private final StadiumRepository stadiumRepository;

    /** 공연장 목록 조회 (API-251). 공연 등록 화면의 공연장 선택에 쓴다 */
    public List<StadiumSummaryResponse> getStadiums() {
        return stadiumRepository.findAll(Sort.by("name")).stream()
                .map(StadiumSummaryResponse::from)
                .toList();
    }
}
