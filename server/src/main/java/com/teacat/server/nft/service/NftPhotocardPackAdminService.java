package com.teacat.server.nft.service;

import com.teacat.server.common.config.BookingPolicyProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.response.NftPhotocardPackAdminResponse;
import com.teacat.server.nft.entity.NftPhotocardPack;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardPackRepository;
import com.teacat.server.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NftPhotocardPackAdminService {

    private final NftPhotocardPackRepository packRepository;
    private final UserRepository userRepository;
    private final BookingPolicyProperties bookingPolicy;

    @Transactional(readOnly = true)
    public List<NftPhotocardPackAdminResponse> findAll(Long userId) {
        requireUser(userId);
        long leadSeconds = bookingPolicy.cancelDeadlineLead().toSeconds();
        return packRepository.findAdminPacks(userId, leadSeconds).stream()
                .map(row -> new NftPhotocardPackAdminResponse(
                        row.getPackId(), row.getSource(), row.getTitle(), row.getOpenAt(),
                        NftPhotocardPackAdminResponse.Status.valueOf(row.getStatus()),
                        row.getConsumedAt(), row.getInvalidatedAt(), row.getInvalidatedReason(),
                        row.getInvalidatedBy()))
                .toList();
    }

    @Transactional
    public void invalidate(Long userId, Long packId, Long adminId, String reason) {
        NftPhotocardPack pack = packRepository.lockByIdAndUserId(packId, userId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.PACK_NOT_FOUND));
        pack.invalidate(adminId, reason.trim(), LocalDateTime.now());
    }

    private void requireUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new BusinessException(NftErrorCode.PHOTOCARD_OWNER_NOT_FOUND);
        }
    }
}
