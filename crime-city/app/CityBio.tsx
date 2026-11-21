'use client';

import {useEffect, useRef, useState} from 'react';
import {Loader2, Pencil} from 'lucide-react';
import {cityApi} from './CityPanels';

export default function CityBio({bio, onSaved, onError}: {
  bio: string;
  onSaved: (bio: string) => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.setSelectionRange(input.current.value.length, input.current.value.length);
    }
  }, [editing]);

  function cancel() {
    if (pending.current) return;
    setDraft(bio);
    setEditing(false);
    requestAnimationFrame(() => edit.current?.focus());
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      const data = await cityApi('profile/bio', {bio: draft});
      if (!mounted.current) return;
      onSaved(data.bio);
      setEditing(false);
      requestAnimationFrame(() => edit.current?.focus());
    } catch (failure: any) {
      if (mounted.current) onError(failure.message || '자기소개를 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <div className={'city-profile-bio' + (!bio ? ' empty' : '') + (editing ? ' editing' : '')}>
    {editing ? <form className="city-bio-form" onSubmit={save} onKeyDown={event => {
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); cancel();}
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {event.preventDefault(); save(event);}
    }}>
      <textarea ref={input} aria-label="자기소개 내용" value={draft} maxLength={180} disabled={saving} onChange={event => setDraft(event.target.value)} placeholder="당신은 어떤 추리를 좋아하나요?"/>
      <div className="city-bio-toolbar"><span aria-live="polite">{draft.length}/180</span><div><button type="button" className="city-bio-cancel" onClick={cancel} disabled={saving} title="ESC">취소</button><button type="submit" className="city-bio-save" disabled={saving} title="Ctrl+Enter">{saving ? <Loader2 size={12} className="spin"/> : '저장'}</button></div></div>
    </form> : <>
      <p>{bio || '아직 소개가 없어요. 당신은 어떤 추리를 좋아하나요?'}</p>
      <button ref={edit} className="city-bio-edit" aria-label="자기소개 수정" title="자기소개 수정" onClick={() => {setDraft(bio); setEditing(true);}}><Pencil size={15} strokeWidth={1.6}/></button>
    </>}
  </div>;
}
