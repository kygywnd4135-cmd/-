'use client';

import {useEffect, useRef, type CSSProperties} from 'react';
import type {LevelAdvance} from './lib/level-up';

export default function CityLevelUp({advance, scale, onClose, onChime}: {
  advance: LevelAdvance; scale: number; onClose: () => void; onChime: () => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const dismiss = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  const chime = useRef(onChime);
  close.current = onClose; chime.current = onChime;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const siblings = Array.from(overlay.current?.parentElement?.children || [])
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el !== overlay.current)
      .map(el => ({el, inert: el.inert}));
    siblings.forEach(({el}) => {el.inert = true;});
    document.body.style.overflow = 'hidden';
    dismiss.current?.focus({preventScroll: true});
    const timer = setTimeout(() => chime.current(), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1050);
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') {event.preventDefault(); event.stopImmediatePropagation(); close.current();}
      if (event.key === 'Tab') {event.preventDefault(); event.stopImmediatePropagation(); dismiss.current?.focus();}
    }
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(timer); document.removeEventListener('keydown', key, true);
      document.body.style.overflow = overflow;
      siblings.forEach(({el, inert}) => {el.inert = inert;});
      if (before?.isConnected) before.focus({preventScroll: true});
    };
  }, []);

  return <div className="city-levelup-overlay" ref={overlay} role="dialog" aria-modal="true" aria-labelledby="levelup-title" aria-describedby="levelup-announcement" onClick={onClose}>
    <p className="sr-only" id="levelup-announcement">레벨 {advance.from}에서 {advance.to}(으)로 올랐습니다. 표시된 해금 항목은 연출용 예시입니다. 실제 콘텐츠는 추후 공개됩니다.</p>
    <div className="city-levelup-canvas" style={{'--levelup-scale': scale} as CSSProperties}>
      <div className="levelup-ambient" aria-hidden="true"/>
      <div className="levelup-clock" aria-hidden="true">
        <img className="levelup-rings" src="/assets/level-up/clock-rings.svg" alt="" draggable={false}/>
        <img className="levelup-hands" src="/assets/level-up/clock-hands.svg" alt="" draggable={false}/>
        <div className="levelup-clock-glow"/>
      </div>
      <img className="levelup-ornaments" src="/assets/level-up/ornaments.svg" alt="" aria-hidden="true" draggable={false}/>
      <div className="levelup-particles" aria-hidden="true">{Array.from({length: 16}, (_, i) => <i key={i} style={{'--particle-angle': `${i * 22.5}deg`, '--particle-delay': `${0.8 + (i % 4) * .08}s`, '--particle-distance': `${210 + (i % 3) * 55}px`} as CSSProperties}/>)}</div>
      <h2 className="levelup-title" id="levelup-title">LEVEL UP</h2>
      <div className="levelup-number" aria-label={`레벨 ${advance.to}`}>
        <span className="levelup-old-number" aria-hidden="true">{advance.from}</span>
        <strong>{advance.to}</strong>
      </div>
      <div className="levelup-reward-band" aria-hidden="true">
        <div className="levelup-band-fill"/>
        <img src="/assets/level-up/reward-facets.svg" alt="" draggable={false}/>
        <div className="levelup-band-edge top"/><div className="levelup-band-edge bottom"/>
      </div>
      <div className="levelup-rewards" aria-label="해금 연출 예시">
        <div className="levelup-reward first"><span>컨텐츠 해금</span><i aria-hidden="true"/><strong>미니게임 천국</strong></div>
        <div className="levelup-reward second"><span>시나리오 해금</span><i aria-hidden="true"/><strong>[ 아침이 오지 않는 설국 ]</strong></div>
      </div>
      <button className="levelup-dismiss" ref={dismiss} aria-label="레벨업 연출 닫기" onClick={event => {event.stopPropagation(); onClose();}}><span aria-hidden="true"/>클릭하여 종료</button>
    </div>
  </div>;
}
