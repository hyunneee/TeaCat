package com.teacat.server.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** {@code @Scheduled} 를 켠다. 첫 사용처는 경매 마감 스위퍼({@code nft.service.NftAuctionSweeper}) */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
