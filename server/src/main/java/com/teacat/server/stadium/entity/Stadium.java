package com.teacat.server.stadium.entity;

import com.teacat.server.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 공연장.
 *
 * 공연(performance_general)이 공연장을 참조해야 해서 최소 형태로만 만들어 둔다.
 * 공연장 도메인(API-3xx)이 붙으면 그쪽 정의로 합치면 된다.
 */
@Entity
@Table(name = "stadiums")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Stadium {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "layout_image_key", length = 500)
    private String layoutImageKey;

    @Column(name = "layout_width")
    private Integer layoutWidth;

    @Column(name = "layout_height")
    private Integer layoutHeight;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    private User manager;

    private Stadium(String name, String address, String phone, User manager) {
        this.name = name;
        this.address = address;
        this.phone = phone;
        this.manager = manager;
    }

    public static Stadium create(String name, String address, String phone, User manager) {
        return new Stadium(name, address, phone, manager);
    }

    public void update(String name, String address, String phone) {
        if (name != null) {
            this.name = name;
        }
        if (address != null) {
            this.address = address;
        }
        if (phone != null) {
            this.phone = phone;
        }
    }

    public boolean isManagedBy(Long userId) {
        return manager != null && manager.getId().equals(userId);
    }

    public boolean hasLayoutDimensions() {
        return layoutWidth != null && layoutHeight != null;
    }

    public void updateLayoutImage(String layoutImageKey, int layoutWidth, int layoutHeight) {
        this.layoutImageKey = layoutImageKey;
        this.layoutWidth = layoutWidth;
        this.layoutHeight = layoutHeight;
    }

    public void removeLayoutImage(boolean keepDimensions) {
        this.layoutImageKey = null;
        if (!keepDimensions) {
            this.layoutWidth = null;
            this.layoutHeight = null;
        }
    }
}
