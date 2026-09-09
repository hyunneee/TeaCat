import { useQuery } from '@tanstack/react-query';
import { stadiumApi, stadiumKeys } from '../api/stadiumApi';
import { computeLayoutExtent, defaultLabelingRule, deriveAreaBounds } from '../model/stadium.model';
import type { DraftArea, DraftLayoutElement } from '../model/stadium.types';

export function useStadiumLayoutPreview(layoutId: number | null) {
  return useQuery({
    queryKey: stadiumKeys.layoutPreview(layoutId ?? 0),
    enabled: layoutId !== null,
    queryFn: async () => {
      const id = layoutId as number;
      const [detail, areaList] = await Promise.all([
        stadiumApi.layoutDetail(id),
        stadiumApi.layoutAreas(id),
      ]);
      const areas: DraftArea[] = await Promise.all(
        areaList.areas.map(async (area, index) => {
          const seatList = area.type === 'SEATED' ? await stadiumApi.areaSeats(area.areaId) : null;
          const manualSeats = (seatList?.seats ?? []).map((seat) => ({
            clientId: String(seat.seatId),
            sourceSheet: area.levelCode,
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber,
            seatX: seat.seatX ?? area.areaX ?? 0,
            seatY: seat.seatY ?? area.areaY ?? 0,
          }));
          const hasBounds =
            area.areaX !== null &&
            area.areaY !== null &&
            (area.width ?? 0) > 1 &&
            (area.height ?? 0) > 1;

          return {
            clientId: String(area.areaId),
            sourceSheet: area.levelCode,
            levelCode: area.levelCode,
            areaCode: area.areaCode,
            type: area.type,
            maxSeat: area.maxSeat,
            bounds: hasBounds
              ? {
                  x: area.areaX as number,
                  y: area.areaY as number,
                  width: area.width as number,
                  height: area.height as number,
                }
              : deriveAreaBounds(manualSeats, { x: 20 + index * 16, y: 20 + index * 16 }),
            acceptedCandidateIds: [],
            manualSeats,
            labelingRule: defaultLabelingRule(),
          };
        }),
      );

      const fallbackLevel = areas[0]?.levelCode ?? '1F';
      const layoutElements: DraftLayoutElement[] = detail.layoutElements
        .filter((element) => element.kind !== 'EXCEL_REFERENCE')
        .map((element, index) => {
          const levelCode =
            typeof element.levelCode === 'string' ? element.levelCode : fallbackLevel;
          return {
            clientId: `element-${index}`,
            sourceSheet: levelCode,
            levelCode,
            type: typeof element.type === 'string' ? element.type : 'ELEMENT',
            label: typeof element.label === 'string' ? element.label : '',
            x: Number(element.x) || 0,
            y: Number(element.y) || 0,
            width: Number(element.width) || 10,
            height: Number(element.height) || 10,
          };
        });
      const extent = computeLayoutExtent(areas, layoutElements);

      return {
        detail,
        areas,
        layoutElements,
        width: Math.max(detail.layoutWidth, extent.width),
        height: Math.max(detail.layoutHeight, extent.height),
      };
    },
  });
}
