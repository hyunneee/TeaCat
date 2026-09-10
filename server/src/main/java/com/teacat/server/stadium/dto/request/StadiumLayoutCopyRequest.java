package com.teacat.server.stadium.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StadiumLayoutCopyRequest(
        @NotBlank @Size(max = 100) String name,
        boolean isDefault
) {
}
