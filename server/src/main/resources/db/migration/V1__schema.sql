-- ================================
-- Faces / Users
-- ================================

CREATE
EXTENSION IF NOT EXISTS vector;

CREATE TABLE faces
(
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    embedding vector(512) NOT NULL -- 차원수는 사용하는 얼굴 임베딩 모델에 맞춰 조정 필요 (예: ArcFace 512)
);

CREATE TYPE user_role AS ENUM ('ADMIN', 'USER', 'STADIUM', 'PERFORMANCE');

CREATE TABLE users
(
    id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email    varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    name     varchar(50)  NOT NULL,
    phone    varchar(20)  NOT NULL,
    role     user_role    NOT NULL DEFAULT 'USER',
    face_id  bigint       NOT NULL,

    CONSTRAINT fk_users_face
        FOREIGN KEY (face_id) REFERENCES faces (id),
    CONSTRAINT uq_users_face_id
        UNIQUE (face_id)
);

-- ================================
-- Wallets
-- ================================

CREATE TYPE wallet_owner_status AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE wallet_type AS ENUM ('RELAYER_EOA', 'SMART_ACCOUNT');
CREATE TYPE wallet_status AS ENUM ('PENDING', 'ACTIVE', 'RETIRED');

CREATE TABLE wallet_owners
(
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          bigint              NOT NULL,
    derivation_index int                 NOT NULL,
    owner_address    char(42)            NOT NULL,
    key_version      smallint            NOT NULL,
    status           wallet_owner_status NOT NULL DEFAULT 'ACTIVE',
    created_at       timestamp           NOT NULL DEFAULT now(),
    updated_at       timestamp           NOT NULL DEFAULT now(),

    CONSTRAINT fk_wallet_owners_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uq_wallet_owners_user_derivation
        UNIQUE (user_id, derivation_index),
    CONSTRAINT uq_wallet_owners_owner_address
        UNIQUE (owner_address),
    CONSTRAINT chk_wallet_owners_address_lower
        CHECK (owner_address = lower(owner_address))
);

CREATE TABLE wallets
(
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id       bigint        NOT NULL,
    chain_id       int           NOT NULL,
    type           wallet_type   NOT NULL,
    address        char(42)      NOT NULL,
    status         wallet_status NOT NULL DEFAULT 'PENDING',
    entry_point    char(42),
    factory        char(42),
    salt           char(66),
    deployed       boolean       NOT NULL DEFAULT false,
    deploy_tx_hash char(66),
    deployed_at    timestamp,
    created_at     timestamp     NOT NULL DEFAULT now(),
    updated_at     timestamp     NOT NULL DEFAULT now(),

    CONSTRAINT fk_wallets_owner
        FOREIGN KEY (owner_id) REFERENCES wallet_owners (id),
    CONSTRAINT uq_wallets_address
        UNIQUE (address),
    CONSTRAINT uq_wallets_owner_chain
        UNIQUE (owner_id, chain_id),
    CONSTRAINT chk_wallets_address_lower
        CHECK (address = lower(address))
);

CREATE INDEX idx_wallets_owner_id ON wallets (owner_id);
CREATE INDEX idx_wallet_owners_user_id ON wallet_owners (user_id);

-- ================================
-- Stadiums / Areas / Seats
-- ================================

CREATE TABLE stadiums
(
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    varchar(100) NOT NULL,
    address varchar(255) NOT NULL,
    phone   varchar(20)
);

CREATE TYPE area_type AS ENUM ('SEATED', 'STANDING');

CREATE TABLE areas
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stadium_id bigint      NOT NULL,
    area_code  varchar(20) NOT NULL,
    type       area_type   NOT NULL,
    max_seat   int,
    area_x     numeric,
    area_y     numeric,
    height     numeric,
    width      numeric,

    CONSTRAINT fk_areas_stadium
        FOREIGN KEY (stadium_id) REFERENCES stadiums (id),
    CONSTRAINT uq_areas_stadium_zone_arrangement
        UNIQUE (stadium_id, area_code, type)
);

CREATE TABLE seats
(
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    area_id     bigint      NOT NULL,
    seat_x      numeric,
    seat_y      numeric,
    row_label   varchar(10) NOT NULL,
    seat_number int         NOT NULL,

    CONSTRAINT fk_seats_area
        FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT uq_seats_area_row_number
        UNIQUE (area_id, row_label, seat_number)
);

CREATE INDEX idx_seats_area_id ON seats (area_id);

-- ================================
-- Performances
-- ================================

CREATE TYPE performance_status AS ENUM ('UPCOMING', 'ONGOING', 'ENDED', 'CANCELLED');
CREATE TYPE ticketing_status AS ENUM ('SCHEDULED', 'OPEN', 'SOLD_OUT', 'CLOSED');

CREATE TABLE performance_general
(
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stadium_id             bigint             NOT NULL,
    visible_from           date               NOT NULL,
    title                  text               NOT NULL,
    ticketing_start_at     timestamp          NOT NULL,
    status                 performance_status NOT NULL DEFAULT 'UPCOMING',
    poster_img             text,
    performance_detail_img text,
    created_at             timestamp          NOT NULL DEFAULT now(),

    CONSTRAINT fk_performance_general_stadium
        FOREIGN KEY (stadium_id) REFERENCES stadiums (id)
);

CREATE TABLE performance_details
(
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    performance_general_id bigint           NOT NULL,
    performance_num        int              NOT NULL,
    performance_date       date             NOT NULL,
    status                 ticketing_status NOT NULL,

    CONSTRAINT fk_performance_details_general
        FOREIGN KEY (performance_general_id) REFERENCES performance_general (id),
    CONSTRAINT uq_performance_details_general_num
        UNIQUE (performance_general_id, performance_num)
);

CREATE INDEX idx_performance_general_stadium_id ON performance_general (stadium_id);
CREATE INDEX idx_performance_details_general_id ON performance_details (performance_general_id);

CREATE TABLE performance_areas
(
    performance_general_id bigint NOT NULL,
    area_id                bigint NOT NULL,
    grade                  varchar(20),
    price                  int,
    max_cnt                int,
    sold_cnt               int    NOT NULL DEFAULT 0,

    CONSTRAINT pk_performance_areas
        PRIMARY KEY (performance_general_id, area_id),
    CONSTRAINT fk_performance_areas_general
        FOREIGN KEY (performance_general_id) REFERENCES performance_general (id),
    CONSTRAINT fk_performance_areas_area
        FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT chk_performance_areas_sold_cnt
        CHECK (sold_cnt <= max_cnt)
);

CREATE INDEX idx_performance_areas_area_id ON performance_areas (area_id);

-- ================================
-- Performance Seats (Hold / Availability)
-- ================================

CREATE TYPE seat_booking_status AS ENUM ('AVAILABLE', 'HELD', 'SOLD');

CREATE TABLE performance_seats
(
    performance_detail_id bigint              NOT NULL,
    seat_id               bigint              NOT NULL,
    status                seat_booking_status NOT NULL DEFAULT 'AVAILABLE',
    held_by               bigint,    -- users.id, HELD 상태일 때만 값 존재
    held_until            timestamp, -- 결제 제한시간, 이 시각 지나면 자동 해제 대상
    updated_at            timestamp           NOT NULL DEFAULT now(),

    CONSTRAINT pk_performance_seats
        PRIMARY KEY (performance_detail_id, seat_id),
    CONSTRAINT fk_performance_seats_detail
        FOREIGN KEY (performance_detail_id) REFERENCES performance_details (id),
    CONSTRAINT fk_performance_seats_seat
        FOREIGN KEY (seat_id) REFERENCES seats (id),
    CONSTRAINT fk_performance_seats_held_by
        FOREIGN KEY (held_by) REFERENCES users (id)
);

CREATE INDEX idx_performance_seats_seat_id ON performance_seats (seat_id);
CREATE INDEX idx_performance_seats_status ON performance_seats (status);

-- ================================
-- Tickets / NFT Tickets
-- ================================

CREATE TYPE ticket_status AS ENUM ('CONFIRMED', 'CANCELLED');

CREATE TABLE tickets
(
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id               bigint        NOT NULL,
    performance_detail_id bigint        NOT NULL,
    area_id               bigint        NOT NULL,
    seat_id               bigint, -- 스탠딩이면 NULL
    status                ticket_status NOT NULL DEFAULT 'CONFIRMED',
    booked_at             timestamp     NOT NULL DEFAULT now(),

    CONSTRAINT fk_tickets_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_tickets_detail
        FOREIGN KEY (performance_detail_id) REFERENCES performance_details (id),
    CONSTRAINT fk_tickets_area
        FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT fk_tickets_seat
        FOREIGN KEY (seat_id) REFERENCES seats (id),
    CONSTRAINT uq_tickets_detail_seat
        UNIQUE (performance_detail_id, seat_id)
);

CREATE INDEX idx_tickets_user_id ON tickets (user_id);
CREATE INDEX idx_tickets_detail_id ON tickets (performance_detail_id);
CREATE INDEX idx_tickets_area_id ON tickets (area_id);

CREATE TYPE nft_mint_status AS ENUM ('PENDING', 'MINTING', 'MINTED', 'FAILED');

CREATE TABLE nft_tickets
(
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id        bigint          NOT NULL,
    wallet_id        bigint          NOT NULL,
    chain_id         int             NOT NULL,
    contract_address char(42),
    token_id         numeric,
    mint_tx_hash     char(66),
    status           nft_mint_status NOT NULL DEFAULT 'PENDING',
    minted_at        timestamp,
    created_at       timestamp       NOT NULL DEFAULT now(),
    updated_at       timestamp       NOT NULL DEFAULT now(),

    CONSTRAINT fk_nft_tickets_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets (id),
    CONSTRAINT fk_nft_tickets_wallet
        FOREIGN KEY (wallet_id) REFERENCES wallets (id),
    CONSTRAINT uq_nft_tickets_ticket
        UNIQUE (ticket_id),
    CONSTRAINT uq_nft_tickets_contract_token
        UNIQUE (contract_address, token_id),
    CONSTRAINT chk_nft_tickets_address_lower
        CHECK (contract_address IS NULL OR contract_address = lower(contract_address))
);

CREATE INDEX idx_nft_tickets_wallet_id ON nft_tickets (wallet_id);
CREATE INDEX idx_nft_tickets_status ON nft_tickets (status);