package com.teacat.server.nft.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PhotocardTransferResult(String status, String txHash) {

    public boolean isPending() {
        return "PENDING".equals(status) && txHash != null;
    }

    public boolean isAlreadyDone() {
        return "ALREADY_DONE".equals(status);
    }
}
