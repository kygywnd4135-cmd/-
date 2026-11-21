'use client';

import type {CSSProperties,RefObject} from 'react';

export type FriendFeedback = {kind:'sent'|'duplicate'|'error';message?:string};

export default function CityFriendFeedback({feedback,scale,dialogRef,onDismiss}:{feedback:FriendFeedback;scale:number;dialogRef:RefObject<HTMLElement|null>;onDismiss:()=>void}) {
  const style={'--friend-feedback-scale':scale} as CSSProperties;
  if(feedback.kind==='sent')return <div className="friend-feedback-canvas friend-feedback-toast-canvas" style={style}><p className="friend-feedback-toast" role="status">친구추가 보내기 성공! 회신을 기다려보자.</p></div>;
  return <div className="friend-feedback-overlay" onPointerDown={event=>{if(event.target===event.currentTarget)onDismiss();}}>
    <div className="friend-feedback-canvas" style={style}>
      <section className="friend-feedback-dialog" role="alertdialog" aria-modal="true" aria-labelledby="friend-feedback-message" ref={dialogRef}>
        <img className="friend-feedback-facets" src="/assets/friends/feedback-facets.svg" alt="" aria-hidden="true"/>
        <h2 id="friend-feedback-message">{feedback.kind==='duplicate'?<>이미 친구가 되어있거나,<br/>친구추가를 보낸 플레이어입니다.</>:feedback.message||'친구 요청을 보내지 못했습니다. 다시 시도해주세요.'}</h2>
        <button type="button" onClick={onDismiss}>확인</button>
      </section>
    </div>
  </div>;
}
