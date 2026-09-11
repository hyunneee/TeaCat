package com.teacat.server.stadium.repository;

import com.teacat.server.stadium.entity.StadiumLayout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StadiumLayoutRepository extends JpaRepository<StadiumLayout, Long> {

    @Query("SELECT sl FROM StadiumLayout sl JOIN FETCH sl.stadium WHERE sl.id = :layoutId")
    Optional<StadiumLayout> findByIdWithStadium(Long layoutId);

    @Query("SELECT sl FROM StadiumLayout sl WHERE sl.stadium.id = :stadiumId AND sl.defaultLayout = true")
    Optional<StadiumLayout> findDefaultByStadiumId(Long stadiumId);

    List<StadiumLayout> findAllByStadiumIdOrderByDefaultLayoutDescCreatedAtAsc(Long stadiumId);

    boolean existsByStadiumIdAndName(Long stadiumId, String name);

    @Query(value = "SELECT EXISTS (SELECT 1 FROM performance_general WHERE stadium_layout_id = :layoutId)",
            nativeQuery = true)
    boolean isInUse(Long layoutId);
}
