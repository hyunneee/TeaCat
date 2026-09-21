import { useEffect, useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { Button, Input, Modal, Segmented, Select, Textarea } from '@/shared/components/ui';
import { useConcerts } from '@/features/concert';
import { DEFAULT_BANNER_FOCUS, focusOf, type BannerImageFocus } from '@/features/banner';
import { BannerFocusPicker } from './BannerFocusPicker';
import type {
  AdminBanner,
  AdminBannerType,
  AdminBannerWriteRequest,
} from '../model/adminBanner.types';

/**
 * 배너 등록·수정.
 *
 * 서버를 모릅니다 — 저장·업로드는 콜백으로 위로 올립니다 (CLAUDE.md 4-3).
 * 다만 "어떤 공연이 있는가" 는 선택지를 그리기 위한 조회라 여기서 직접 읽습니다.
 */
export interface AdminBannerFormModalProps {
  /** 수정이면 대상, 등록이면 null */
  banner: AdminBanner | null;
  saving: boolean;
  uploading: boolean;
  onClose: () => void;
  onSubmit: (body: AdminBannerWriteRequest) => void;
  /** 파일을 스토리지에 올리고 저장 key 를 돌려줍니다 */
  onUpload: (file: File) => Promise<string>;
}

const TYPE_OPTIONS: { value: AdminBannerType; label: string }[] = [
  { value: 'IMAGE', label: '이미지 직접 등록' },
  { value: 'PERFORMANCE', label: '공연 지정' },
];

export function AdminBannerFormModal({
  banner,
  saving,
  uploading,
  onClose,
  onSubmit,
  onUpload,
}: AdminBannerFormModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: concerts } = useConcerts();

  const [type, setType] = useState<AdminBannerType>(banner?.type ?? 'IMAGE');
  const [title, setTitle] = useState(banner?.title ?? '');
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? '');
  const [label, setLabel] = useState(banner?.label ?? '');
  const [linkPath, setLinkPath] = useState(banner?.linkPath ?? '');
  const [performanceId, setPerformanceId] = useState<string>(
    banner?.performanceId ? String(banner.performanceId) : '',
  );
  const [imageKey, setImageKey] = useState(banner?.imageKey ?? '');
  const [preview, setPreview] = useState(banner?.imageUrl ?? '');
  const [imageFocus, setImageFocus] = useState<BannerImageFocus>(
    banner ? focusOf(banner.imageFocusX, banner.imageFocusY) : DEFAULT_BANNER_FOCUS,
  );
  const [submitted, setSubmitted] = useState(false);

  /* 공연을 고르면 제목을 비워 둔 경우에만 공연명으로 채워 줍니다.
     이미 적어 둔 문구를 덮어쓰면 관리자가 쓴 글이 사라집니다. */
  useEffect(() => {
    if (type !== 'PERFORMANCE' || !performanceId || title.trim()) return;

    const picked = concerts?.find((c) => String(c.concertId) === performanceId);
    if (picked) setTitle(picked.title);
  }, [type, performanceId, concerts, title]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;

    const key = await onUpload(file);
    setImageKey(key);
    setPreview(URL.createObjectURL(file));
    /* 그림이 바뀌면 맞춰 둔 자리는 의미가 없습니다 — 다른 그림의 "위쪽 얼굴" 자리를
       그대로 물려받으면 엉뚱한 데가 남습니다. 가운데에서 다시 맞추게 합니다 */
    setImageFocus(DEFAULT_BANNER_FOCUS);
  };

  /* 크롭 위치를 고르려면 **무엇이 잘리는지** 보여야 합니다. 이미지 배너는 방금 올린
     그림, 공연 배너는 고른 공연의 포스터입니다 (수정 중이고 목록이 아직 안 왔으면
     서버가 준 지금 그림으로 버팁니다 — 그 사이에 격자가 사라졌다 나타나면 놀랍니다). */
  const focusPreview =
    type === 'IMAGE'
      ? preview
      : (concerts?.find((c) => String(c.concertId) === performanceId)?.posterUrl ??
        (banner?.type === 'PERFORMANCE' ? banner.imageUrl : null));

  const linkPathInvalid = linkPath.length > 0 && !/^\/(?!\/)/.test(linkPath);
  const valid =
    title.trim().length > 0 &&
    !linkPathInvalid &&
    (type === 'IMAGE' ? imageKey.length > 0 : performanceId.length > 0);

  const handleSubmit = () => {
    setSubmitted(true);
    if (!valid) return;

    onSubmit({
      type,
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      label: label.trim() || null,
      imageKey: type === 'IMAGE' ? imageKey : null,
      /* 타입과 무관합니다 — 공연 포스터도 같은 틀에 담겨 잘립니다 */
      imageFocusX: imageFocus.x,
      imageFocusY: imageFocus.y,
      performanceId: type === 'PERFORMANCE' ? Number(performanceId) : null,
      linkPath: type === 'IMAGE' ? linkPath.trim() || null : null,
      active: banner?.active ?? true,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      variant="center"
      width="wide"
      title={banner ? '배너 수정' : '배너 등록'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="dark" loading={saving} onClick={handleSubmit}>
            {banner ? '수정' : '등록'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented options={TYPE_OPTIONS} value={type} onChange={setType} />

        {type === 'IMAGE' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                leftIcon={<ImageUp size={16} />}
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                이미지 선택
              </Button>
              <span className="text-ink-muted text-xs">
                {imageKey ? '업로드 완료' : '가로로 넓은 이미지를 권장합니다'}
              </span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />

            {submitted && !imageKey && (
              <p className="text-danger text-xs">배너 이미지를 올려 주세요.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-ink text-sm font-medium">연결할 공연</p>
            <Select
              label="연결할 공연"
              value={performanceId}
              onChange={setPerformanceId}
              options={[
                { value: '', label: '공연을 선택하세요' },
                ...(concerts ?? []).map((c) => ({ value: String(c.concertId), label: c.title })),
              ]}
            />
            {submitted && !performanceId && (
              <p className="text-danger text-xs">연결할 공연을 선택해 주세요.</p>
            )}
            <p className="text-ink-muted text-xs">
              이미지는 그 공연의 포스터를 쓰고, 누르면 공연 상세로 갑니다.
            </p>
          </div>
        )}

        {/* 미리보기 겸 크롭 위치 고르기. 그림이 정해지기 전에는 보여줄 것이 없습니다 */}
        {focusPreview && (
          <BannerFocusPicker
            imageUrl={focusPreview}
            value={imageFocus}
            onChange={setImageFocus}
          />
        )}

        <Input
          label="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          error={submitted && !title.trim() ? '제목을 입력해 주세요.' : null}
        />

        <Textarea
          label="부제목"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          rows={2}
          maxLength={100}
          hint="비워도 됩니다."
        />

        <Input
          label="라벨"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={20}
          hint="좌상단에 작게 붙는 말머리 (EVENT, NEW 등). 비워도 됩니다."
        />

        {type === 'IMAGE' && (
          <Input
            label="누르면 갈 경로"
            value={linkPath}
            onChange={(e) => setLinkPath(e.target.value)}
            placeholder="/nft"
            hint="'/' 로 시작하는 서비스 내 경로만 됩니다. 비우면 눌러도 이동하지 않습니다."
            error={linkPathInvalid ? "'/' 로 시작하는 서비스 내 경로만 넣을 수 있습니다." : null}
          />
        )}
      </div>
    </Modal>
  );
}
