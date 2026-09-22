package com.teacat.server.nft.repository;

import com.teacat.server.nft.entity.NftPhotocardTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface NftPhotocardTemplateRepository extends JpaRepository<NftPhotocardTemplate, Long> {

    /** 어드민 목록. 감춘 것은 빠진다 */
    List<NftPhotocardTemplate> findAllByHiddenFalseOrderByIdDesc();

    List<NftPhotocardTemplate> findAllByHiddenOrderByIdDesc(boolean hidden);

    /**
     * 템플릿별로 만들어진 도안 수. 어드민 목록이 "이 카드가 몇 군데 쓰였나" 를 보여줄 때 쓴다.
     *
     * <p>{@code Object[]} 로 받는 이유: 두 칸짜리 집계라 DTO 나 인터페이스 프로젝션을 따로
     * 두는 값이 없다. 부르는 쪽이 곧바로 Map 으로 접는다.
     */
    @Query("""
            select d.templateId, count(d) from NftPhotocardDesign d
             where d.templateId is not null
             group by d.templateId
            """)
    List<Object[]> countDesignsGroupedByTemplate();
}
