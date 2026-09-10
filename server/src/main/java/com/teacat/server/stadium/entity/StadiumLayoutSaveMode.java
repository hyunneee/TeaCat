package com.teacat.server.stadium.entity;

public enum StadiumLayoutSaveMode {
    DRAFT,
    PUBLISH;

    public StadiumLayoutStatus toStatus() {
        return this == DRAFT ? StadiumLayoutStatus.DRAFT : StadiumLayoutStatus.ACTIVE;
    }
}
