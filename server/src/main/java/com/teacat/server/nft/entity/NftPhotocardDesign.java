package com.teacat.server.nft.entity;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.exception.NftErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "nft_photocard_designs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardDesign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "performance_general_id", nullable = false)
    private Long performanceId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "image_url", nullable = false)
    private String imageUrl;

    @Column(name = "total_supply", nullable = false)
    private int totalSupply;

    @Column(name = "issued_supply", nullable = false)
    private int issuedSupply;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public void reserve(int quantity) {
        if (quantity <= 0 || issuedSupply + quantity > totalSupply) {
            throw new BusinessException(NftErrorCode.DESIGN_QUANTITY_EXCEEDED);
        }
        issuedSupply += quantity;
    }
}

