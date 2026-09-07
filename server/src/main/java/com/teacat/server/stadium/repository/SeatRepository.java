package com.teacat.server.stadium.repository;

import com.teacat.server.stadium.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeatRepository extends JpaRepository<Seat, Long> {

    /** 회차 좌석 생성(API-269)에서 판매할 구역의 좌석을 모두 가져온다 */
    List<Seat> findByAreaIdIn(List<Long> areaIds);
}
