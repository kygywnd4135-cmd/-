'use client';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {Check, Loader2, X} from 'lucide-react';
import AccountAvatar from './AccountAvatar';
import {cityApi} from './CityPanels';
import type {Achievement} from './lib/achievements';
import CityFriendFeedback, {type FriendFeedback} from './CityFriendFeedback';

type ExpandedProfile = {
  id: string; nickname: string; avatar: number; avatarUrl: string; frame: string;
  title: string; bio: string; points: number; clears: number; completed: number;
  level: number; lastGameHonor: number; achievementId: string | null;
};

export default function CityExpandedProfile({scale, onClose, userId, notify}: {
  scale: number; onClose: () => void; userId?: string; notify?: (message: string) => void;
}) {
  const viewingOther = !!userId;
  const [profile, setProfile] = useState<ExpandedProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [friendFeedback,setFriendFeedback] = useState<FriendFeedback|null>(null);
  const [friendSending,setFriendSending] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const openRef = useRef(open);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const friendButton = useRef<HTMLButtonElement>(null);
  const friendDialog = useRef<HTMLElement>(null);
  const friendFeedbackRef = useRef(friendFeedback);
  const previousFriendFeedback = useRef<FriendFeedback|null>(null);
  const friendSendingRef = useRef(false);
  const friendEpoch = useRef(0);
  close.current = onClose; openRef.current = open;
  friendFeedbackRef.current=friendFeedback;

  function dismissFriendFeedback(){setFriendFeedback(null);}

  useEffect(() => {
    mounted.current = true;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if(friendFeedbackRef.current&&friendFeedbackRef.current.kind!=='sent')dismissFriendFeedback();
        else if (openRef.current) {setOpen(false); trigger.current?.focus();}
        else close.current();
      }
      if (event.key === 'Tab') {
        const scope=friendFeedbackRef.current&&friendFeedbackRef.current.kind!=='sent'?friendDialog.current:dialog.current;
        const controls = Array.from(scope?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }
    }
    document.addEventListener('keydown', key, true);
    return () => {mounted.current = false; document.body.style.overflow = overflow; document.removeEventListener('keydown', key, true); before?.focus();};
  }, []);

  useEffect(() => {
    let active = true;
    friendEpoch.current++;friendSendingRef.current=false;setFriendSending(false);setFriendFeedback(null);
    setLoadError(''); setProfile(null);
    cityApi(userId ? 'profiles/' + encodeURIComponent(userId) : 'profile/expanded').then(data => {
      if (active) {
        setProfile(userId ? {...data.profile, achievementId: data.profile.achievement?.id || null} : data.profile);
        setAchievements(userId ? (data.profile.achievement ? [data.profile.achievement] : []) : data.achievements);
      }
    }).catch(failure => {if (active) setLoadError(failure.message || '프로필을 불러오지 못했습니다.');});
    return () => {active = false;};
  }, [attempt, userId]);

  useEffect(()=>{
    const previous=previousFriendFeedback.current;previousFriendFeedback.current=friendFeedback;
    if(!friendFeedback){if(previous&&previous.kind!=='sent')friendButton.current?.focus();return;}
    if(friendFeedback.kind==='sent'){const timeout=setTimeout(()=>setFriendFeedback(null),5000);return()=>clearTimeout(timeout);}
    friendDialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  },[friendFeedback]);

  async function requestFriend(){
    if(!viewingOther||!profile||profile.id!==userId||friendSendingRef.current)return;
    const epoch=friendEpoch.current,targetId=profile.id;
    friendSendingRef.current=true;setFriendSending(true);setFriendFeedback(null);
    try{
      const result=await cityApi('friends/requests',{userId:targetId});
      if(result.status!=='sent'&&result.status!=='already_requested_or_friends')throw new Error('친구 요청 결과를 확인하지 못했습니다. 다시 시도해주세요.');
      if(mounted.current&&epoch===friendEpoch.current)setFriendFeedback({kind:result.status==='sent'?'sent':'duplicate'});
    }catch(error:any){if(mounted.current&&epoch===friendEpoch.current)setFriendFeedback({kind:'error',message:error.message||'친구 요청을 보내지 못했습니다. 다시 시도해주세요.'});}
    finally{if(mounted.current&&epoch===friendEpoch.current){friendSendingRef.current=false;setFriendSending(false);}}
  }

  useEffect(() => {
    if (!open) return;
    const options = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
    (options.find(option => option.getAttribute('aria-selected') === 'true') || options[0])?.focus();
    function outside(event: PointerEvent) {if (!picker.current?.contains(event.target as Node)) setOpen(false);}
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  async function apply(achievementId: string | null) {
    if (viewingOther || savingRef.current || !profile) return;
    if (profile.achievementId === achievementId) {setOpen(false); trigger.current?.focus(); return;}
    savingRef.current = true; setSaving(true); setSaveError('');
    try {
      const data = await cityApi('profile/achievement', {achievementId});
      if (mounted.current) {
        setProfile(current => current ? {...current, achievementId: data.achievementId} : current);
        setOpen(false); trigger.current?.focus();
      }
    } catch (failure: any) {if (mounted.current) setSaveError(failure.message || '대표 업적을 저장하지 못했습니다.');}
    finally {savingRef.current = false; if (mounted.current) setSaving(false);}
  }

  const featured = achievements.find(item => item.id === profile?.achievementId);
  return <div className={'expanded-profile-overlay' + (viewingOther ? '' : ' expanded-profile-own')} onPointerDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <div className="expanded-profile-canvas" style={{'--expanded-profile-scale': scale} as CSSProperties}>
      <section className={'expanded-profile-frame' + (viewingOther ? ' expanded-profile-public' : '')} role="dialog" aria-modal="true" aria-labelledby="expanded-profile-heading" aria-describedby={viewingOther && profile ? 'expanded-player-nickname' : undefined} ref={dialog} inert={!!friendFeedback&&friendFeedback.kind!=='sent'}>
        <button className="expanded-profile-close" aria-label={viewingOther ? '상대방 프로필 닫기' : '내 프로필 닫기'} ref={closeButton} onClick={onClose}><X size={24}/></button>
        <div className="expanded-profile-inner">
          <div className="expanded-profile-heading"><h2 id="expanded-profile-heading">플레이어 프로필</h2><span aria-hidden="true"/></div>
          {profile ? <>
            <div className="expanded-skin-column">
              <div className="expanded-character-blank" aria-hidden="true"/>
              <div className="expanded-honor" role="img" aria-label={`지난 게임에서 받은 명예 ${profile.lastGameHonor}개, 총 6칸`} title={`지난 게임 명예 ${profile.lastGameHonor}개`}>
                {Array.from({length: 6}, (_, index) => <span key={index} className={'expanded-honor-star' + (index < profile.lastGameHonor ? ' filled' : '')} aria-hidden="true"><svg width="18" height="22" viewBox="0 0 24 24"><path d="M12 0 15 9 24 12 15 15 12 24 9 15 0 12 9 9Z"/></svg></span>)}
              </div>
              <div className="expanded-level-band" aria-hidden="true"/>
              <div className="expanded-level" aria-label={`레벨 ${profile.level}`}><small>Lv.</small><strong>{String(profile.level).padStart(2, '0')}</strong></div>
              <div className="expanded-skin-name">Main : 미지정</div>
              {viewingOther ? <button className="expanded-skin-change expanded-friend-request" ref={friendButton} disabled={friendSending} aria-busy={friendSending} onClick={requestFriend}>{friendSending?'친구 요청 중…':'친구 요청하기'}</button> : <button className="expanded-skin-change" disabled title="비공개" aria-label="지정 스킨 변경하기 · 비공개">지정 스킨 변경하기</button>}
            </div>
            <div className="expanded-player-panel">
              <div className="expanded-player-avatar"><AccountAvatar profile={profile} size={144}/></div>
              <div className="expanded-player-title">{profile.title}</div>
              <h3 className="expanded-player-name" id="expanded-player-nickname">{profile.nickname}</h3>
              <div className="expanded-player-stats"><span>시나리오 클리어 : <b>{profile.clears.toLocaleString()}</b>개</span><span>도합 승리 포인트 : <b>{profile.points.toLocaleString()}</b>점</span></div>
              <div className={'expanded-player-bio' + (!profile.bio ? ' empty' : '')}><p>{profile.bio || '아직 자기소개가 없어요.'}</p></div>
              {viewingOther ? <div className="expanded-achievement-picker">
                <div className="expanded-achievement-trigger expanded-achievement-readonly"><strong>대표 업적 : {featured?.name || '없음'}</strong></div>
                <div className="expanded-achievement-description">{featured?.description || '아직 지정한 대표 업적이 없습니다.'}</div>
              </div> : <div className={'expanded-achievement-picker' + (open ? ' open' : '')} ref={picker}>
                <button className="expanded-achievement-trigger" ref={trigger} aria-label="대표 업적 선택" aria-haspopup="listbox" aria-controls="expanded-achievement-list" aria-expanded={open} onClick={() => {setSaveError(''); setOpen(value => !value);}} onKeyDown={event => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault(); setOpen(true);}
                }}><strong>대표 업적 : {featured?.name || '없음'}</strong><svg width="20" height="11" viewBox="0 0 20 11" aria-hidden="true"><path d="M0 0H20L10 11Z" fill="currentColor"/></svg></button>
                <div className="expanded-achievement-description">{featured?.description || '대표 업적을 선택해주세요.'}</div>
                {open && <div className="expanded-achievement-dropdown">
                  <div className="expanded-achievement-options" id="expanded-achievement-list" role="listbox" aria-label="보유한 업적" aria-busy={saving} ref={list} onKeyDown={event => {
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const options = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
                    const index = options.indexOf(document.activeElement as HTMLButtonElement);
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
                    options[next]?.focus(); options[next]?.scrollIntoView({block: 'nearest'});
                  }}>
                    <button role="option" aria-selected={!profile.achievementId} disabled={saving} onClick={() => apply(null)}><span>대표 업적 없음</span>{!profile.achievementId && <Check size={17}/>}</button>
                    {achievements.map(item => <button key={item.id} role="option" aria-selected={profile.achievementId === item.id} disabled={saving} onClick={() => apply(item.id)}><span><strong>{item.name}</strong><small>{item.description}</small></span>{profile.achievementId === item.id && <Check size={17}/>}</button>)}
                    {!achievements.length && <p className="expanded-achievement-empty">아직 획득한 업적이 없습니다.</p>}
                  </div>
                  {saving && <p className="expanded-achievement-saving" role="status"><Loader2 size={15} className="spin"/>대표 업적 저장 중…</p>}
                  {saveError && <p className="expanded-achievement-error" role="alert">{saveError}</p>}
                </div>}
              </div>}
            </div>
          </> : <div className="expanded-profile-status" role="status">{loadError ? <><p>{loadError}</p><button onClick={() => setAttempt(value => value + 1)}>다시 불러오기</button></> : <><Loader2 className="spin" size={28}/><p>프로필을 불러오는 중…</p></>}</div>}
        </div>
      </section>
    </div>
    {friendFeedback&&<CityFriendFeedback feedback={friendFeedback} scale={scale} dialogRef={friendDialog} onDismiss={dismissFriendFeedback}/>}
  </div>;
}
