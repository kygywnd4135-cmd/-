'use client';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {Loader2, X} from 'lucide-react';
import {cityApi} from './CityPanels';
import {getNicknameIssue, nicknameMessages, normalizeNickname} from './lib/nickname';

type Props = {
  currentNickname?: string;
  initial?: boolean;
  scale: number;
  onClose: () => void;
  onSaved: (nickname: string) => Promise<void>;
};

export default function CityNickname({currentNickname = '', initial = false, scale, onClose, onSaved}: Props) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => before?.focus();
  }, []);

  useEffect(() => {
    if (error) confirmation.current?.focus();
    else input.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (error) setError('');
        else close.current();
      }
      if (event.key === 'Tab') {
        const scope = error ? dialog.current?.querySelector('.nickname-alert') : dialog.current;
        const controls = Array.from(scope?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }
    }
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [error]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const value = normalizeNickname(nickname);
    if (!initial && value === normalizeNickname(currentNickname)) {setError(nicknameMessages.taken); return;}
    const issue = getNicknameIssue(value);
    if (issue) {setError(nicknameMessages[issue]); return;}
    setBusy(true);
    try {
      const result = await cityApi('profile/nickname', {nickname: value});
      await onSaved(result.nickname);
    } catch (failure: any) {
      setError(failure.message || '닉네임을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {setBusy(false);}
  }

  return <div className="nickname-overlay">
    <div className="nickname-canvas" style={{'--nickname-scale': scale} as CSSProperties} ref={dialog}>
      <section className={'nickname-dialog' + (initial ? ' initial' : '')} role="dialog" aria-modal={!error} aria-labelledby="nickname-heading" aria-describedby="nickname-description" inert={!!error}>
        <div className="nickname-panel">
          <header className="nickname-heading">
            <h2 id="nickname-heading">닉네임 {initial ? '설정' : '변경'}</h2>
            <button className="nickname-close" aria-label="닉네임 창 닫기" onClick={onClose}><X size={23}/></button>
          </header>
          <form onSubmit={submit} noValidate>
            <div className="nickname-input-shell">
              <input ref={input} aria-label={initial ? '사용할 닉네임' : '변경할 닉네임'} aria-describedby="nickname-description" value={nickname} minLength={2} maxLength={12} autoComplete="off" spellCheck={false} disabled={busy} onChange={event => setNickname(event.target.value)} placeholder={`${initial ? '사용할' : '변경할'} 닉네임을 입력하세요.`}/>
            </div>
            <p id="nickname-description">닉네임은 한글,영문,숫자 2~12글자로 입력 가능합니다.</p>
            <footer className="nickname-actions">
              <button className="nickname-cancel" type="button" onClick={onClose}>취소</button>
              <button className="nickname-submit" type="submit" disabled={busy}>{busy ? <><Loader2 size={23} className="spin"/>처리 중</> : initial ? '설정' : '변경'}</button>
            </footer>
          </form>
        </div>
      </section>
      {error && <>
        <div className="nickname-alert-shade"/>
        <section className="nickname-alert" role="alertdialog" aria-modal="true" aria-labelledby="nickname-error">
          <p id="nickname-error">{error}</p>
          <button ref={confirmation} onClick={() => setError('')}>확인</button>
        </section>
      </>}
    </div>
  </div>;
}
