package com.teacat.server.common.ipfs;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.ImageFiles;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;

/**
 * 파일을 IPFS 에 핀하고 CID 를 돌려준다 (Pinata).
 *
 * <p><b>여기는 무엇을 핀하는지 모른다.</b> 도안 메타데이터의 모양이나 어느 컬럼에 넣을지는
 * 부르는 쪽이 정한다.
 *
 * <h3>왜 CID 인가</h3>
 * CID 는 <b>내용 주소</b>다. 그림을 바꾸면 CID 가 바뀌므로, 체인에 박아둔 값과 자동으로
 * 어긋난다. "한정 100장" 은 온체인이 지키는데 "무슨 그림인가" 는 DB 가 언제든 바꿀 수
 * 있으면 비대칭인데, 그 자리를 CID 가 메운다. (blockchain/PHOTOCARD_PLAN.md 3장)
 *
 * <h3>대가 — 핀이 끊기면 그림이 사라진다</h3>
 * CID 는 영원히 남지만 <b>데이터는 누군가 핀하고 있어야 남는다.</b> Pinata 계정이 만료되고
 * 아무도 안 핀하면 지갑에서 카드가 깨져 보인다. 무료 계정으로 시작해도 되지만
 * <b>영구성이 그 계정에 달려 있다는 것</b>은 팀이 알고 있어야 한다.
 *
 * <h3>이미지도 JSON 도 같은 호출로 올린다</h3>
 * v3 Files API 에는 JSON 전용 엔드포인트가 없다(레거시의 {@code pinJSONToIPFS} 자리).
 * JSON 을 바이트로 만들어 파일로 올리면 두 API 어느 쪽에서도 같은 코드가 동작한다.
 */
@Slf4j
@Service
public class IpfsPinService {

    private static final String FILE_PART = "file";
    private static final String NETWORK_PART = "network";
    private static final String IPFS_PATH = "/ipfs/";

    private final PinataProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public IpfsPinService(PinataProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .requestFactory(requestFactory(properties))
                .build();
    }

    private static ClientHttpRequestFactory requestFactory(PinataProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) properties.connectTimeout().toMillis());
        // 이미지 바이트를 통째로 올리므로 일반 API 보다 넉넉히 잡는다
        factory.setReadTimeout((int) properties.readTimeout().toMillis());
        return factory;
    }

    /**
     * 이미지를 핀하고 CID 를 돌려준다. 형식·용량은 외부에 닿기 전에 여기서 거른다.
     *
     * @return 이미지 CID. {@code ipfs://} 스킴은 붙이지 않는다
     */
    public String pinImage(MultipartFile file) {
        ImageFiles.validate(file, properties.imageMaxSize());

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            log.error("업로드 이미지를 읽지 못했습니다. name={}", file.getOriginalFilename(), e);
            throw new BusinessException(IpfsErrorCode.PIN_FAILED);
        }

        String filename = "image" + ImageFiles.extensionOf(file.getContentType());
        return pin(bytes, filename, MediaType.parseMediaType(file.getContentType()));
    }

    /**
     * 객체를 JSON 으로 직렬화해 핀하고 CID 를 돌려준다.
     *
     * <p>이 CID 가 <b>체인에 올라가는 값</b>이다. 이미지 CID 를 체인에 보내면 지갑이 JSON 대신
     * 이미지 바이트를 파싱하려 들어 카드가 이름도 없이 깨져 보인다.
     */
    public String pinJson(String filename, Object payload) {
        return pin(objectMapper.writeValueAsBytes(payload), filename, MediaType.APPLICATION_JSON);
    }

    /** {@code ipfs://} 는 브라우저가 못 연다. 화면에 쓸 https 주소로 바꾼다 */
    public String gatewayUrl(String cid) {
        if (!StringUtils.hasText(cid)) {
            return null;
        }

        String base = properties.gatewayUrl();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }

        return base + IPFS_PATH + cid;
    }

    public boolean isConfigured() {
        return properties.isConfigured();
    }

    private String pin(byte[] bytes, String filename, MediaType contentType) {
        requireConfigured();

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add(FILE_PART, filePart(bytes, filename, contentType));
        if (properties.hasNetwork()) {
            // v3 Files API 의 필수 필드. 레거시 주소를 쓰면 설정에서 비운다
            form.add(NETWORK_PART, properties.network());
        }

        JsonNode response;
        try {
            response = restClient.post()
                    .uri(properties.uploadUrl())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.jwt())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            log.error("IPFS 핀 실패 status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new BusinessException(IpfsErrorCode.PIN_FAILED);
        } catch (RuntimeException e) {
            log.error("IPFS 핀 호출이 실패했습니다. url={}", properties.uploadUrl(), e);
            throw new BusinessException(IpfsErrorCode.PIN_FAILED);
        }

        String cid = extractCid(response);
        if (cid == null) {
            log.error("IPFS 응답에서 CID 를 찾지 못했습니다. body={}", response);
            throw new BusinessException(IpfsErrorCode.PIN_RESPONSE_INVALID);
        }

        log.info("IPFS 핀 완료 file={} cid={}", filename, cid);
        return cid;
    }

    private static HttpEntity<ByteArrayResource> filePart(byte[] bytes, String filename, MediaType contentType) {
        ByteArrayResource resource = new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                // 이게 없으면 파트에 filename 이 안 붙어 Pinata 가 400 을 준다
                return filename;
            }
        };

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(contentType);
        return new HttpEntity<>(resource, headers);
    }

    /**
     * 두 API 의 응답 모양을 모두 읽는다.
     *
     * <pre>
     * v3   { "data": { "cid": "bafy…", … } }
     * 레거시 { "IpfsHash": "bafy…", … }
     * </pre>
     *
     * 주소를 바꾸는 것만으로 갈아탈 수 있게 하려는 것이다. 새 모양이 나오면 여기만 는다.
     */
    static String extractCid(JsonNode body) {
        if (body == null) {
            return null;
        }

        for (JsonNode candidate : new JsonNode[]{
                body.path("data").path("cid"),
                body.path("IpfsHash"),
                body.path("cid")}) {
            if (candidate.isTextual() && !candidate.asText().isBlank()) {
                return candidate.asText();
            }
        }

        return null;
    }

    private void requireConfigured() {
        if (!properties.isConfigured()) {
            log.error("IPFS 설정이 비어 있습니다 (ipfs.pinata.jwt / ipfs.pinata.upload-url)");
            throw new BusinessException(IpfsErrorCode.IPFS_NOT_CONFIGURED);
        }
    }
}
