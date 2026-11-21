'use client';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {Check, Images, Loader2, LockKeyhole, X} from 'lucide-react';
import AccountAvatar from './AccountAvatar';
import {cityApi} from './CityPanels';
import {STARTER_AVATARS, STARTER_FRAMES} from './lib/appearance';

type Appearance = {avatar: number; avatarUrl: string; frame: string; usePhoto?: number; uploadedUrl?: string | null};

async function squarePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG, PNG, WEBP 사진을 선택해주세요.');
  if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하의 사진을 선택해주세요.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {throw new Error('사진을 열 수 없습니다. 다른 사진을 선택해주세요.');});
    const {naturalWidth: width, naturalHeight: height} = image;
    if (!width || !height || width * height > 80000000) throw new Error('사진 크기가 너무 큽니다. 더 작은 사진을 선택해주세요.');
    const side = Math.min(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진을 처리하지 못했습니다. 다시 시도해주세요.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 512, 512);
    context.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 512, 512);
    return canvas.toDataURL('image/jpeg', .87);
  } finally {URL.revokeObjectURL(url);}
}

export default function CityAppearance({user, scale, onClose, onSaved}: {
  user: Appearance; scale: number; onClose: () => void; onSaved: (appearance: Appearance) => void;
}) {
  const [tab, setTab] = useState<'image' | 'frame'>('image');
  const [appearance, setAppearance] = useState<Appearance>(user);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const mounted = useRef(true);
  const close = useRef(onClose);
  const saved = useRef(onSaved);
  close.current = onClose; saved.current = onSaved;

  useEffect(() => {
    mounted.current = true;
    const before = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    cityApi('profile/appearance').then(data => {if (mounted.current) setAppearance(data.appearance);})
      .catch(failure => {if (mounted.current) setError(failure.message);})
      .finally(() => {if (mounted.current) setLoading(false);});
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); close.current();}
      if (event.key === 'Tab') {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }
    }
    document.addEventListener('keydown', key, true);
    return () => {mounted.current = false; document.removeEventListener('keydown', key, true); document.body.style.overflow = previousOverflow; before?.focus();};
  }, []);

  async function apply(values: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await cityApi('profile/appearance', values);
      saved.current(result.appearance);
      if (mounted.current) {setAppearance(result.appearance); setNotice('프로필이 적용되었습니다.');}
    } catch (failure: any) {if (mounted.current) setError(failure.message || '프로필을 적용하지 못했습니다.');}
    finally {if (mounted.current) setBusy(false);}
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await squarePhoto(file);
      const result = await cityApi('profile/photo', {data});
      saved.current(result.appearance);
      if (mounted.current) {setAppearance(result.appearance); setNotice('사진이 정사각형으로 적용되었습니다.');}
    } catch (failure: any) {if (mounted.current) setError(failure.message || '사진을 업로드하지 못했습니다.');}
    finally {if (mounted.current) setBusy(false);}
  }
  function switchTab(value: 'image' | 'frame', focus = false) {
    setTab(value); if (grid.current) grid.current.scrollTop = 0;
    if (focus) tabButtons.current[value === 'image' ? 0 : 1]?.focus();
  }

  return <div className="appearance-overlay" onPointerDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <div className="appearance-canvas" style={{'--appearance-scale': scale} as CSSProperties}>
      <section className="appearance-dialog" role="dialog" aria-modal="true" aria-labelledby="appearance-heading" ref={dialog}>
        <button className="appearance-close" aria-label="내 프로필 설정 닫기" ref={closeButton} onClick={onClose}><X size={25}/></button>
        <h2 id="appearance-heading">내 프로필 설정</h2>
        <aside className="appearance-preview">
          <AccountAvatar profile={appearance} size={282}/>
          <p>프로필 이미지는 모두에게 공개됩니다.<br/><strong>과도한 신상 노출,<br/>혹은 타인에게 불쾌감을 제공하는</strong><br/>사진을 업로드하실 경우<br/>제재 대상에 포함될 수 있습니다.</p>
          {appearance.uploadedUrl && !appearance.usePhoto && <button className="appearance-use-photo" disabled={busy || loading} onClick={() => apply({avatar: 'upload'})}>저장된 내 사진 사용</button>}
          <div className={'appearance-feedback' + (error ? ' error' : '')} role={error ? 'alert' : 'status'} aria-live="polite">
            {busy ? <><Loader2 size={18} className="spin"/>적용 중…</> : error || notice}
          </div>
        </aside>
        <div className="appearance-catalog">
          <div className="appearance-tabs" role="tablist" aria-label="프로필 설정 종류" onKeyDown={event => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {event.preventDefault(); switchTab(event.key === 'Home' ? 'image' : event.key === 'End' ? 'frame' : tab === 'image' ? 'frame' : 'image', true);}
          }}>
            {(['image', 'frame'] as const).map((value, index) => <button key={value} ref={element => {tabButtons.current[index] = element;}} id={`appearance-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="appearance-grid" tabIndex={tab === value ? 0 : -1} onClick={() => switchTab(value)}>{value === 'image' ? '프로필 이미지' : '프로필 테두리'}</button>)}
          </div>
          <div className="appearance-scroll" ref={grid} role="tabpanel" id="appearance-grid" aria-labelledby={`appearance-tab-${tab}`} tabIndex={0} aria-busy={busy || loading}>
            <div className="appearance-grid">
              {tab === 'image' ? <>
                <button className={'appearance-tile upload' + (appearance.usePhoto ? ' selected' : '')} disabled={busy || loading} onClick={() => fileInput.current?.click()}>
                  <span className="appearance-thumb">{appearance.uploadedUrl ? <img src={appearance.uploadedUrl} alt=""/> : <Images size={54} strokeWidth={1.7}/>}</span>
                  <strong>내 사진 업로드</strong><small>1:1 자동 크롭</small>{!!appearance.usePhoto && <span className="appearance-selected"><Check size={14}/>적용 중</span>}
                </button>
                {STARTER_AVATARS.map(item => <button key={item.id} className={'appearance-tile' + (!appearance.usePhoto && appearance.avatar === item.id ? ' selected' : '')} disabled={busy || loading} aria-pressed={!appearance.usePhoto && appearance.avatar === item.id} onClick={() => apply({avatar: item.id})}>
                  <span className="appearance-thumb"><AccountAvatar profile={{avatarUrl: item.url}} size={140}/></span><strong>{item.name}</strong><small>기본 프로필</small>{!appearance.usePhoto && appearance.avatar === item.id && <span className="appearance-selected"><Check size={14}/>적용 중</span>}
                </button>)}
                {Array.from({length: 27}, (_, index) => <div className="appearance-tile locked" key={'locked-image-' + index} aria-label={`미획득 프로필 ${index + 1}`}><span className="appearance-thumb"><LockKeyhole size={35} strokeWidth={1.4}/></span><strong>미획득</strong><small>게임 · 이벤트 보상</small></div>)}
              </> : <>
                {STARTER_FRAMES.map(item => <button key={item.id} className={'appearance-tile' + (appearance.frame === item.id ? ' selected' : '')} disabled={busy || loading} aria-pressed={appearance.frame === item.id} onClick={() => apply({frame: item.id})}>
                  <span className="appearance-thumb"><AccountAvatar profile={appearance} frame={item.id} size={140}/></span><strong>{item.name}</strong><small>기본 테두리</small>{appearance.frame === item.id && <span className="appearance-selected"><Check size={14}/>적용 중</span>}
                </button>)}
                {Array.from({length: 28}, (_, index) => <div className="appearance-tile locked" key={'locked-frame-' + index} aria-label={`미획득 테두리 ${index + 1}`}><span className="appearance-thumb"><AccountAvatar profile={appearance} frame="classic" size={140}/><span className="appearance-lock"><LockKeyhole size={25}/></span></span><strong>미획득</strong><small>이벤트 보상</small></div>)}
              </>}
            </div>
          </div>
        </div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="프로필 사진 파일" hidden onChange={event => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; upload(file);}}/>
      </section>
    </div>
  </div>;
}
