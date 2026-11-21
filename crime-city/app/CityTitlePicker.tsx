'use client';

import {useEffect, useRef, useState} from 'react';
import {ChevronDown, Loader2} from 'lucide-react';
import {cityApi} from './CityPanels';

export default function CityTitlePicker({title, onApplied, onError}: {
  title: string;
  onApplied: (title: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [titles, setTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    cityApi('profile/titles').then(data => {
      if (active) setTitles(data.titles);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => {active = false; document.removeEventListener('pointerdown', outside);};
  }, [open]);

  function focusOption(index: number) {
    const options = list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    if (!options?.length) return;
    const target = options[(index + options.length) % options.length];
    target.focus();
    target.scrollIntoView({block: 'nearest'});
  }

  async function apply(next: string) {
    if (savingRef.current || next === title) return;
    savingRef.current = true;
    setSaving(next);
    try {
      const data = await cityApi('profile/title', {title: next});
      if (mounted.current) onApplied(data.title);
    } catch (failure: any) {
      if (mounted.current) onError(failure.message || '칭호를 적용하지 못했습니다. 다시 선택해주세요.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(null);
    }
  }

  return <div className={'city-title-picker' + (open ? ' open' : '')} ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <button className="city-profile-title" ref={trigger} aria-label="칭호 선택" aria-haspopup="listbox" aria-expanded={open} aria-controls="owned-title-list" onClick={() => setOpen(current => !current)} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) setOpen(true);
        else focusOption(Math.max(0, titles.indexOf(title)));
      }
    }}><span>{title}</span><ChevronDown size={14}/></button>
    {open && <div className="city-title-dropdown">
      <div className="city-owned-titles" ref={list} id="owned-title-list" role="listbox" aria-label="보유한 칭호" aria-busy={loading || !!saving} onKeyDown={event => {
        const options = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
        const index = options.indexOf(document.activeElement as HTMLButtonElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          focusOption(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1));
        }
      }}>
        {loading ? <p className="city-title-status"><Loader2 size={14} className="spin"/>칭호를 불러오는 중…</p> : failed ? <p className="city-title-status">목록을 불러오지 못했습니다.<br/>칭호 메뉴를 다시 열어주세요.</p> : titles.map(item => <button type="button" role="option" aria-selected={item === title} aria-disabled={!!saving} key={item} className={item === title ? 'equipped' : ''} onClick={() => apply(item)}><span>{item}</span>{saving === item ? <Loader2 size={13} className="spin"/> : item === title ? <span className="city-title-equipped">(적용중)</span> : null}</button>)}
      </div>
    </div>}
  </div>;
}
