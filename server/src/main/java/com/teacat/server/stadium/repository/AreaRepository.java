package com.teacat.server.stadium.repository;

import com.teacat.server.stadium.entity.Area;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AreaRepository extends JpaRepository<Area, Long> {

    /** 공연장에 속한 구역. 공연 구역 설정(API-268)에서 남의 공연장 구역이 섞이는 것을 막는다 */
    List<Area> findByStadiumId(Long stadiumId);
}
