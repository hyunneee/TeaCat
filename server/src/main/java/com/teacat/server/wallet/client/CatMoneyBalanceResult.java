package com.teacat.server.wallet.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * GET /internal/tokens/catmoney/balance 응답.
 *
 * @param balance 정수 문자열로 온다 — 캣머니는 decimals = 0 이고,
 *                JSON number 로 받으면 큰 값에서 정밀도가 깨진다
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CatMoneyBalanceResult(String address, String balance, int decimals, String symbol) {
}
