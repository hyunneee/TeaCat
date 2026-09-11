import { useCallback, useEffect, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import type { StadiumEditorDraftData } from '../model/stadium.types';
import { clearStadiumEditorDraft, saveStadiumEditorDraft } from '../model/stadiumDraftStorage';
import type { StadiumEditorController } from './useStadiumEditor';

function toDraftData(controller: StadiumEditorController): StadiumEditorDraftData {
  return {
    step: controller.step,
    info: controller.info,
    stadiumId: controller.stadiumId,
    analysis: controller.analysis,
    analysisExpiresAt: controller.analysisExpiresAt,
    selectedSheet: controller.selectedSheet,
    layoutName: controller.layoutName,
    isDefault: controller.isDefault,
    layoutWidth: controller.layoutWidth,
    layoutHeight: controller.layoutHeight,
    tool: controller.tool,
    areas: controller.areas,
    unassignedSeats: controller.unassignedSeats,
    selectedAreaId: controller.selectedAreaId,
    layoutElements: controller.layoutElements,
    selectedElementId: controller.selectedElementId,
  };
}

export function useStadiumDraftNavigationGuard(controller: StadiumEditorController) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const completed = controller.confirmLayout.isSuccess || controller.copyLayout.isSuccess;
  const hasProgress =
    !completed &&
    (controller.step > 0 ||
      controller.stadiumId !== null ||
      controller.analysis !== null ||
      controller.areas.length > 0 ||
      controller.unassignedSeats.length > 0 ||
      controller.layoutElements.length > 0 ||
      Object.values(controller.info).some((value) => value.trim().length > 0));

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return (
      hasProgress &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
    );
  });

  const draftData = toDraftData(controller);

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!hasProgress) return;
        saveStadiumEditorDraft(draftData);
        event.preventDefault();
      },
      [draftData, hasProgress],
    ),
  );

  useEffect(() => {
    if (!completed) return;
    clearStadiumEditorDraft();
  }, [completed]);

  useEffect(() => {
    if (blocker.state !== 'blocked') setSaveError(null);
  }, [blocker.state]);

  const stay = () => {
    setSaveError(null);
    if (blocker.state === 'blocked') blocker.reset();
  };

  const discardAndLeave = () => {
    if (blocker.state !== 'blocked') return;
    clearStadiumEditorDraft();
    controller.reset();
    blocker.proceed();
  };

  const saveAndLeave = async () => {
    if (blocker.state !== 'blocked') return;
    if (controller.step === 4) {
      setSaving(true);
      setSaveError(null);
      try {
        await controller.confirmLayout.mutateAsync('DRAFT');
        controller.reset();
        blocker.proceed();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : '임시저장에 실패했습니다.');
      } finally {
        setSaving(false);
      }
      return;
    }
    const result = saveStadiumEditorDraft(draftData);
    if (!result.ok) {
      setSaveError(result.message ?? '임시저장에 실패했습니다.');
      return;
    }
    controller.reset();
    blocker.proceed();
  };

  return {
    blocked: blocker.state === 'blocked',
    saveError,
    saving,
    stay,
    discardAndLeave,
    saveAndLeave,
  };
}
