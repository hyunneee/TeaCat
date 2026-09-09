package com.teacat.server.stadium.dto.response;

public record CreatedSeatResponse(Long seatId, String rowLabel, int seatNumber, String candidateId) {
}
