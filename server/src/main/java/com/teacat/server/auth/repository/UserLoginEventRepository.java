package com.teacat.server.auth.repository;

import com.teacat.server.auth.entity.UserLoginEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface UserLoginEventRepository extends JpaRepository<UserLoginEvent, Long> {

    @Modifying
    @Query("delete from UserLoginEvent e where e.createdAt < :before")
    int deleteCreatedBefore(@Param("before") LocalDateTime before);
}
