package com.teacat.server.common.storage;

import com.teacat.server.common.exception.BusinessException;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * "우리가 받는 이미지" 의 정의. 저장 위치와 무관하다.
 *
 * <p>MinIO 로 가는 이미지({@link FileStorageService})와 IPFS 로 가는 도안 이미지가 같은 목록을
 * 봐야 해서 여기로 뺐다. 두 벌로 두면 한쪽만 늘어났을 때 "어떤 화면에서는 되고 어떤 화면에서는
 * 안 되는" 형식이 생긴다.
 */
public final class ImageFiles {

    /** 허용 이미지 타입과 저장할 때 붙일 확장자 */
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif"
    );

    private ImageFiles() {
    }

    /** 허용 타입이면 확장자, 아니면 null */
    public static String extensionOf(String contentType) {
        return ALLOWED_TYPES.get(contentType);
    }

    public static boolean isAllowed(String contentType) {
        return ALLOWED_TYPES.containsKey(contentType);
    }

    /** 비었거나 형식이 아니거나 한도를 넘으면 던진다. 외부(MinIO·Pinata)에 닿기 전에 부른다 */
    public static void validate(MultipartFile file, DataSize maxSize) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(StorageErrorCode.EMPTY_FILE);
        }

        if (!isAllowed(file.getContentType())) {
            throw new BusinessException(StorageErrorCode.UNSUPPORTED_IMAGE_TYPE);
        }

        if (file.getSize() > maxSize.toBytes()) {
            throw new BusinessException(StorageErrorCode.FILE_TOO_LARGE);
        }
    }
}
