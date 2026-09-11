package com.teacat.server.stadium.dto.request;

import com.teacat.server.stadium.entity.StadiumLayoutSaveMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StadiumLayoutCopyRequest(
        @NotBlank @Size(max = 100) String name,
        boolean isDefault,
        @NotNull StadiumLayoutSaveMode saveMode
) {
}
