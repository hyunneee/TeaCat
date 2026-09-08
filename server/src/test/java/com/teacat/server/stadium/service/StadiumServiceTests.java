package com.teacat.server.stadium.service;

import com.teacat.server.auth.security.AuthUser;
import com.teacat.server.auth.exception.AuthErrorCode;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.common.storage.FileStorageService;
import com.teacat.server.stadium.dto.request.AreaBatchCreateRequest;
import com.teacat.server.stadium.dto.request.AreaCreateRequest;
import com.teacat.server.stadium.dto.request.SeatCreateRequest;
import com.teacat.server.stadium.dto.request.StadiumCreateRequest;
import com.teacat.server.stadium.entity.AreaType;
import com.teacat.server.stadium.entity.Stadium;
import com.teacat.server.stadium.entity.StadiumLayout;
import com.teacat.server.stadium.exception.StadiumErrorCode;
import com.teacat.server.stadium.repository.AreaRepository;
import com.teacat.server.stadium.repository.SeatBatchRepository;
import com.teacat.server.stadium.repository.SeatRepository;
import com.teacat.server.stadium.repository.StadiumLayoutRepository;
import com.teacat.server.stadium.repository.StadiumRepository;
import com.teacat.server.user.entity.UserRole;
import com.teacat.server.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StadiumServiceTests {

    private static final AuthUser ADMIN = new AuthUser(1L, UserRole.ADMIN);
    private static final AuthUser STADIUM_MANAGER = new AuthUser(2L, UserRole.STADIUM);

    @Mock
    private StadiumRepository stadiumRepository;
    @Mock
    private AreaRepository areaRepository;
    @Mock
    private SeatRepository seatRepository;
    @Mock
    private SeatBatchRepository seatBatchRepository;
    @Mock
    private StadiumLayoutRepository stadiumLayoutRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FileStorageService fileStorageService;

    @InjectMocks
    private StadiumService stadiumService;

    @Test
    void USER는_공연장을_등록할_수_없다() {
        AuthUser user = new AuthUser(3L, UserRole.USER);

        assertThatThrownBy(() -> stadiumService.createStadium(
                user, new StadiumCreateRequest("테스트 공연장", "서울", null)))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                        .isEqualTo(AuthErrorCode.ACCESS_DENIED));
        verify(stadiumRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void STADIUM은_본인_소속이_아닌_공연장을_관리할_수_없다() throws Exception {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, null);
        MockMultipartFile image = png(320, 180);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));

        assertThatThrownBy(() -> stadiumService.updateLayoutImage(1L, STADIUM_MANAGER, image))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                        .isEqualTo(AuthErrorCode.ACCESS_DENIED));
        verify(fileStorageService, never()).uploadImage(image, "stadium/layout", DataSize.ofMegabytes(10));
    }

    @Test
    void 정상_PNG를_업로드하면_실제_크기와_URL을_반환한다() throws Exception {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, null);
        MockMultipartFile image = png(320, 180);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));
        when(fileStorageService.uploadImage(image, "stadium/layout", DataSize.ofMegabytes(10)))
                .thenReturn("stadium/layout/new.png");
        when(fileStorageService.presignedUrl("stadium/layout/new.png")).thenReturn("http://minio/layout");
        when(stadiumLayoutRepository.findDefaultByStadiumId(1L))
                .thenReturn(Optional.of(mock(StadiumLayout.class)));

        var response = stadiumService.updateLayoutImage(1L, ADMIN, image);

        assertThat(response.layoutWidth()).isEqualTo(320);
        assertThat(response.layoutHeight()).isEqualTo(180);
        assertThat(response.layoutImageUrl()).isEqualTo("http://minio/layout");
        assertThat(stadium.getLayoutImageKey()).isEqualTo("stadium/layout/new.png");
    }

    @Test
    void 이미지라고_속인_파일은_업로드하지_않는다() {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, null);
        MockMultipartFile image = new MockMultipartFile(
                "image", "fake.png", "image/png", "not-an-image".getBytes());
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));

        assertStadiumError(StadiumErrorCode.INVALID_LAYOUT_IMAGE,
                () -> stadiumService.updateLayoutImage(1L, ADMIN, image));
        verify(fileStorageService, never()).uploadImage(image, "stadium/layout", DataSize.ofMegabytes(10));
    }

    @Test
    void 배치_좌표가_있으면_다른_크기의_이미지로_교체하지_않는다() throws Exception {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, null);
        stadium.updateLayoutImage("stadium/layout/old.png", 100, 100);
        MockMultipartFile image = png(200, 100);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));
        when(stadiumRepository.hasLayoutPositions(1L)).thenReturn(true);

        assertStadiumError(StadiumErrorCode.LAYOUT_IMAGE_SIZE_CONFLICT,
                () -> stadiumService.updateLayoutImage(1L, ADMIN, image));
        verify(fileStorageService, never()).uploadImage(image, "stadium/layout", DataSize.ofMegabytes(10));
    }

    @Test
    void 이미지_경계를_벗어난_구역과_좌석은_일괄_생성하지_않는다() {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, null);
        stadium.updateLayoutImage("stadium/layout/layout.png", 100, 100);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));
        when(stadiumLayoutRepository.findDefaultByStadiumId(1L))
                .thenReturn(Optional.of(mock(StadiumLayout.class)));
        AreaCreateRequest area = new AreaCreateRequest(
                "A", AreaType.SEATED, 1,
                decimal(80), decimal(80), decimal(30), decimal(20),
                List.of(new SeatCreateRequest("A", 1, decimal(90), decimal(90))));

        assertStadiumError(StadiumErrorCode.INVALID_LAYOUT_POSITION,
                () -> stadiumService.createAreas(1L, ADMIN, new AreaBatchCreateRequest(List.of(area))));
        verify(areaRepository, never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void 좌석_좌표는_구역_안에_있어야_한다() {
        Stadium stadium = Stadium.create("테스트 공연장", "서울", null, null);
        stadium.updateLayoutImage("stadium/layout/layout.png", 500, 500);
        when(stadiumRepository.findById(1L)).thenReturn(Optional.of(stadium));
        when(stadiumLayoutRepository.findDefaultByStadiumId(1L))
                .thenReturn(Optional.of(mock(StadiumLayout.class)));
        AreaCreateRequest area = new AreaCreateRequest(
                "A", AreaType.SEATED, 1,
                decimal(10), decimal(10), decimal(100), decimal(100),
                List.of(new SeatCreateRequest("A", 1, decimal(200), decimal(20))));

        assertStadiumError(StadiumErrorCode.INVALID_LAYOUT_POSITION,
                () -> stadiumService.createAreas(1L, ADMIN, new AreaBatchCreateRequest(List.of(area))));
    }

    private MockMultipartFile png(int width, int height) throws Exception {
        BufferedImage bufferedImage = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(bufferedImage, "png", output);
        return new MockMultipartFile("image", "layout.png", "image/png", output.toByteArray());
    }

    private BigDecimal decimal(int value) {
        return BigDecimal.valueOf(value);
    }

    private void assertStadiumError(
            StadiumErrorCode expected, org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action)
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getErrorCode()).isEqualTo(expected));
    }
}
