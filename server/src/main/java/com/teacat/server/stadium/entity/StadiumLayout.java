package com.teacat.server.stadium.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

@Entity
@Table(name = "stadium_layouts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StadiumLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stadium_id", nullable = false)
    private Stadium stadium;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "image_key", length = 500)
    private String imageKey;

    @Column(name = "width", nullable = false)
    private int width;

    @Column(name = "height", nullable = false)
    private int height;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "layout_elements", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> layoutElements = new ArrayList<>();

    @Column(name = "is_default", nullable = false)
    private boolean defaultLayout;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false, columnDefinition = "stadium_layout_status")
    private StadiumLayoutStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private StadiumLayout(Stadium stadium, String name, int width, int height,
                          List<Map<String, Object>> layoutElements,
                          boolean defaultLayout, StadiumLayoutStatus status) {
        this.stadium = stadium;
        this.name = name;
        this.width = width;
        this.height = height;
        this.layoutElements = layoutElements == null ? new ArrayList<>() : new ArrayList<>(layoutElements);
        this.defaultLayout = defaultLayout;
        this.status = status;
    }

    public static StadiumLayout create(Stadium stadium, String name, int width, int height,
                                       List<Map<String, Object>> layoutElements,
                                       boolean defaultLayout, StadiumLayoutStatus status) {
        return new StadiumLayout(stadium, name, width, height, layoutElements, defaultLayout, status);
    }

    public void update(String name, List<Map<String, Object>> layoutElements, StadiumLayoutStatus status) {
        if (name != null) this.name = name;
        if (layoutElements != null) this.layoutElements = new ArrayList<>(layoutElements);
        if (status != null) this.status = status;
    }

    public void updateImage(String imageKey, int width, int height) {
        this.imageKey = imageKey;
        this.width = width;
        this.height = height;
    }

    public void removeImage() {
        this.imageKey = null;
    }

    public void markDefault(boolean value) {
        this.defaultLayout = value;
    }
}
