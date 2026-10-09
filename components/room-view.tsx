'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronDown, Coffee, Copy, ExternalLink, Link2, LogOut, MessageSquare, Pin, Plus, QrCode, Send, Smile, Trash2, Users, WifiOff } from 'lucide-react';
import { Brand } from './brand';
import { PollCard, NewPoll } from './poll-card';
import { ShareDialog } from './share-dialog';
import { api, dateLabel, timeLabel } from '../lib/client';
import type { Message, Snapshot } from '../lib/types';
function MessageText({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s<>]+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}</>;
}
function FeedItem({ message, host, active, busy, onAction, onNotice }: { message: Message; host: boolean; active: boolean; busy: boolean; onAction: (input: Record<string, unknown>, success: string) => Promise<void>; onNotice: (message: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(message.url ?? message.text); onNotice(message.url ? '링크를 복사했어요.' : '내용을 복사했어요.'); }
    catch { onNotice('복사하지 못했어요. 내용을 선택해서 복사해주세요.'); }
  }
  return <article className={`feed-item ${message.url ? 'link-item' : ''}`}>
    <div className={`message-avatar ${message.url ? 'link-avatar' : ''}`}>{message.url ? <Link2 size={21} /> : <span>강</span>}</div><div className="message-body"><div className="message-meta"><b>강사</b><span className="teacher-tag">선생님</span><time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time></div>
      {message.url ? <a className="link-card" href={message.url} target="_blank" rel="noopener noreferrer"><span className="link-domain"><span className="domain-letter">{new URL(message.url).hostname.replace('www.', '').charAt(0).toUpperCase()}</span>{new URL(message.url).hostname.replace('www.', '')}<ExternalLink size={13} /></span><h3>{message.text}</h3><span className="open-link">링크 열기 <ArrowUpRight size={17} /></span></a> : <p className="message-content"><MessageText text={message.text} /></p>}
      <div className="message-actions"><button className="quiet-button" onClick={copy}><Copy size={14} />{message.url ? '링크 복사' : '내용 복사'}</button>{host && active && <><button className="quiet-button" disabled={busy} onClick={() => onAction({ type: 'pin', id: message.id }, message.pinned ? '상단 고정을 해제했어요.' : `${message.text.slice(0, 30)} 게시물을 고정했어요.`)}><Pin size={14} />{message.pinned ? '고정 해제' : '상단 고정'}</button><button className="quiet-button delete-button" disabled={busy} onClick={() => setConfirming(true)} aria-label={`${message.text.slice(0, 20)} 게시물 삭제`}><Trash2 size={14} /></button></>}
      </div>{confirming && <div className="delete-confirm" role="alert"><span>이 게시물을 삭제할까요?</span><button disabled={busy} onClick={() => onAction({ type: 'delete', id: message.id }, '게시물을 삭제했어요.')}>삭제하기</button><button onClick={() => setConfirming(false)}>취소</button></div>}
    </div>
  </article>;
}
function Composer({ busy, active, onAction }: { busy: boolean; active: boolean; onAction: (input: Record<string, unknown>, success: string) => Promise<void> }) {
  const [link, setLink] = useState(false); const [text, setText] = useState(''); const [url, setUrl] = useState(''); const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null); const urlRef = useRef<HTMLInputElement>(null);
  async function send(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!text.trim()) { setError('내용을 입력해주세요.'); textRef.current?.focus(); return; }
    if (link) {
      try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); }
      catch { setError('http:// 또는 https://로 시작하는 링크를 입력해주세요.'); urlRef.current?.focus(); return; }
    }
    try { await onAction({ type: 'message', text, url: link ? url : null }, link ? `${text} 링크를 공유했어요.` : '강의 소식을 게시했어요.'); setText(''); setUrl(''); textRef.current?.focus(); }
    catch { /* room action displays failure and preserves the draft */ }
  }
  return <form className="composer" onSubmit={send}><div className="composer-heading"><span className="tiny-avatar">강</span><b>수강생에게 소식을 전해보세요</b></div><label htmlFor="message-text" className="sr-only">{link ? '링크 제목' : '강의 소식 내용'}</label><textarea id="message-text" ref={textRef} value={text} onChange={e => setText(e.target.value)} placeholder={link ? '공유할 링크의 제목을 적어주세요.' : '오늘의 공지, 실습 안내, 하고 싶은 이야기…'} maxLength={2000} rows={3} disabled={!active} aria-invalid={Boolean(error)} aria-describedby={error ? 'composer-error' : undefined} />{link && <div className="composer-url"><Link2 size={17} /><label htmlFor="message-url" className="sr-only">링크 주소</label><input id="message-url" ref={urlRef} type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" maxLength={2048} disabled={!active} aria-describedby={error ? 'composer-error' : undefined} /></div>}{error && <p className="error" role="alert" id="composer-error">{error}</p>}<div className="composer-bottom"><button className={`quiet-button ${link ? 'is-on' : ''}`} type="button" onClick={() => setLink(!link)} aria-pressed={link} disabled={!active}><Link2 size={17} />링크 첨부</button><span className="char-count">{text.length}/2000</span><button className="primary" type="submit" disabled={busy || !active}>{busy ? '게시 중…' : '게시하기'}<Send size={16} /></button></div></form>;
}
export function RoomView({ code, host, onBack, onLogout }: { code: string; host: boolean; onBack?: () => void; onLogout?: () => Promise<void> }) {
  const [data, setData] = useState<Snapshot | null>(null); const [date, setDate] = useState(''); const [error, setError] = useState(''); const [connected, setConnected] = useState(true); const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(false); const [tab, setTab] = useState<'all' | 'links'>('all'); const [notice, setNotice] = useState(''); const [showHistory, setShowHistory] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(message: string) { setNotice(message); if (noticeTimer.current) clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 6000); }
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);
  useEffect(() => {
    let stopped = false;
    api<Snapshot>(`/api/rooms/${code}`, { type: host ? 'start-day' : 'join' }).then(value => { if (!stopped) { setData(value); setDate(value.date); setError(''); } }).catch(e => { if (!stopped) setError(e.message); });
    return () => { stopped = true; };
  }, [code, host]);
  useEffect(() => {
    if (!date) return;
    let stopped = false; let inflight = false;
    async function refresh() {
      if (inflight || document.hidden) return;
      inflight = true;
      try { const value = await api<Snapshot>(`/api/rooms/${code}?date=${date}`); if (!stopped) { setData(value); setConnected(true); setError(''); } }
      catch (e) { if (!stopped) { setConnected(false); setError((e as Error).message); } }
      finally { inflight = false; }
    }
    refresh(); const timer = setInterval(refresh, 2000); document.addEventListener('visibilitychange', refresh);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [code, date]);
  useEffect(() => {
    if (host || !data || data.date !== data.today || !data.active) return;
    const timer = setInterval(() => { if (!document.hidden) api(`/api/rooms/${code}`, { type: 'heartbeat' }).catch(() => {}); }, 15_000);
    return () => clearInterval(timer);
  }, [host, code, data?.date, data?.today, data?.active]);
  const action = useCallback(async (input: Record<string, unknown>, success: string) => {
    setBusy(true);
    try { const value = await api<Snapshot>(`/api/rooms/${code}`, { ...input, date }); setData(value); setConnected(true); setError(''); notify(success); }
    catch (e) { setError((e as Error).message); throw e; }
    finally { setBusy(false); }
  }, [code, date]);
  // Event handlers for non-form controls report errors centrally without unhandled promises.
  const safeAction = useCallback(async (input: Record<string, unknown>, success: string) => { try { await action(input, success); } catch { /* visible room error */ } }, [action]);
  const pinned = data?.messages.find(m => m.pinned);
  const messages = data?.messages.filter(m => !m.pinned && (tab === 'all' || m.url)).slice().reverse() ?? [];
  const editable = Boolean(data && data.date === data.today);
  const active = Boolean(data?.active && editable && connected);
  return <div className="room-app">
    <a className="skip-link" href="#main">본문으로 건너뛰기</a><header className="app-header"><Brand /><span className="header-divider" /><span className="header-context">{host ? '강사 공간' : '함께하는 강의실'}</span><div className="header-right"><span className="role-label">{host ? '강사' : '수강생'}</span>{host && onLogout && <button className="icon-button" aria-label="로그아웃" onClick={() => onLogout().catch(e => setError(e.message))}><LogOut size={18} /></button>}<button className="share-header" onClick={() => setShare(true)}><QrCode size={17} /><span>참여 링크</span></button></div></header>
    <aside className="sidebar"><div className="sidebar-heading"><span className="sidebar-title">MY CLASSROOM</span><span className="room-code">{code}</span></div><nav className="room-nav" aria-label="강의실 탐색"><a className="nav-item" href="#feed"><MessageSquare size={20} /><span>강의 소식</span><span className="nav-count">{data?.messages.length ?? 0}</span></a><a className="nav-item" href="#polls"><Smile size={20} /><span>실시간 투표</span></a><button className="nav-item" onClick={() => setShare(true)}><QrCode size={20} /><span>강의실 공유</span></button></nav><div className="sidebar-bottom"><div className="sidebar-note"><Coffee size={28} strokeWidth={1.3} /><p>우리의 작은 반응이<br /><b>수업을 더 좋게 만들어요.</b></p></div>{host && onBack ? <button className="back-link" onClick={onBack}><ArrowLeft size={17} />내 강의실 목록</button> : <Link className="back-link" href="/"><ArrowLeft size={17} />다른 강의실 참여</Link>}<span className="sidebar-footer">틈 · 같이 배우는 시간</span></div></aside>
    <main id="main" className="room-main">
      {!data ? <section className="room-loading">{error ? <><WifiOff size={32} /><h1>강의실에 연결하지 못했어요.</h1><p role="alert">{error}</p><button className="primary" onClick={() => window.location.reload()}>다시 연결</button><Link className="text-button" href="/">참여 코드 다시 입력</Link></> : <><span className="loading-line" /><h1>강의실을 열고 있어요.</h1><p role="status">오늘의 소식과 반응을 불러오는 중입니다.</p></>}</section> : <>
      {data.mode === 'local' && <div className="preview-banner">{data.demo ? '미리보기 강의실 · 게시된 소식은 예시이며, 투표와 접속 인원은 실제 참여로 집계됩니다.' : '로컬 강의실 · 공개 주소에서 사용하려면 저장소 연결과 배포가 필요합니다.'}</div>}
      <section className="room-heading"><div><span className="eyebrow">{host ? 'TODAY, TOGETHER' : 'WELCOME TO OUR CLASS'}</span><h1>{data.title}</h1><div className="room-subtitle"><span>{host ? '오늘의 소식을 전하고, 수강생의 반응을 살펴보세요.' : '수업의 소식과 링크를 모아두었어요.'}</span></div></div><div className="online-badge"><span className={`live-dot ${!connected ? 'disconnected' : ''}`} /><Users size={16} /><strong>{data.online}</strong><span>접속 중</span></div></section>
      <div className="day-toolbar"><div className="date-field"><CalendarDays size={17} /><label className="sr-only" htmlFor="lecture-date">강의 날짜</label><select id="lecture-date" value={date} onChange={e => setDate(e.target.value)}>{data.dates.map(d => <option key={d} value={d}>{dateLabel(d)}{d === data.today ? ' · 오늘' : ''}</option>)}</select><ChevronDown size={15} /></div><span className={`session-state ${!data.active ? 'ended' : ''}`}><span />{data.active ? '강의 진행 중' : editable ? '강의 종료' : '지난 강의 기록'}</span><span className="sync-status">{connected ? '2초마다 갱신' : '연결 확인 중'}</span>{host && editable && <button className="session-button" disabled={busy} onClick={() => safeAction({ type: 'active', active: !data.active }, data.active ? '오늘 강의를 종료했어요. 기록은 계속 볼 수 있어요.' : '오늘 강의를 다시 시작했어요.')}>{data.active ? '오늘 강의 종료' : '강의 다시 시작'}</button>}</div>
      {error && <div className="room-error" role="alert"><WifiOff size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="오류 메시지 닫기">닫기</button></div>}
      <div className="room-columns"><section id="feed" className="feed-column" aria-labelledby="feed-title"><div className="section-heading"><h2 id="feed-title">강의 소식 <span>{data.messages.length}</span></h2><span>선생님이 전하는 이야기</span></div>
        {host && editable && <Composer busy={busy} active={active} onAction={action} />}
        {pinned && (tab === 'all' || pinned.url) && <section className="pinned-card" aria-label="고정된 공지"><div className="pinned-label"><Pin size={14} fill="currentColor" /><span>꼭 확인해주세요</span>{host && editable && <button disabled={busy} className="quiet-button" onClick={() => safeAction({ type: 'pin', id: pinned.id }, '상단 고정을 해제했어요.')}>고정 해제</button>}</div>{pinned.url ? <a href={pinned.url} target="_blank" rel="noopener noreferrer"><h3>{pinned.text}</h3><ArrowUpRight size={21} /></a> : <p><MessageText text={pinned.text} /></p>}{pinned.url && <span className="pinned-domain"><Link2 size={13} />{new URL(pinned.url).hostname}</span>}</section>}
        <div className="feed-tabs" role="group" aria-label="강의 소식 필터"><button className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')} aria-pressed={tab === 'all'}>전체 소식</button><button className={tab === 'links' ? 'selected' : ''} onClick={() => setTab('links')} aria-pressed={tab === 'links'}><Link2 size={15} />링크만</button><span className="feed-sort">최근 소식부터</span></div><div className="message-list">{messages.map(message => <FeedItem key={message.id} message={message} host={host} active={editable} busy={busy} onAction={safeAction} onNotice={notify} />)}{messages.length === 0 && <div className="feed-empty"><MessageSquare size={30} strokeWidth={1.3} /><h3>{tab === 'links' ? '공유된 링크가 아직 없어요.' : '새로운 이야기를 기다리고 있어요.'}</h3><p>{host ? '위에서 첫 소식이나 링크를 올려보세요.' : '강사가 올리는 소식이 여기에 표시됩니다.'}</p></div>}</div><p className="feed-end">오늘의 소식을 모두 확인했어요.</p>
      </section><aside id="polls" className="poll-column" aria-labelledby="polls-title"><div className="section-heading"><h2 id="polls-title">지금, 우리</h2><span>가볍게 알려주세요</span></div>{data.polls.filter(p => !p.archived).map(poll => <PollCard key={poll.id} poll={poll} host={host} active={active} busy={busy} onAction={safeAction} />)}{host && active && <NewPoll busy={busy} onAction={action} />}<p className="privacy-note"><Users size={15} /><span>이름 없이 집계됩니다.<br />같은 브라우저에서는 응답을 바꿀 수 있어요.</span></p>{data.polls.some(p => p.archived) && <div className="poll-history"><button className="text-button" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory} aria-controls="previous-polls"><CalendarDays size={16} />이전 투표 결과 <ChevronDown size={15} /></button>{showHistory && <div id="previous-polls">{data.polls.filter(p => p.archived).map(p => <PollCard key={p.id} poll={p} host={false} active={false} busy={false} onAction={safeAction} />)}</div>}</div>}</aside></div>
      <footer className="room-footer"><span>틈 · 함께하는 강의실</span><span>한국 시간 기준으로 날짜별 기록이 남습니다.</span></footer></>}
    </main><div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice && <><Check size={17} /><span>{notice}</span></>}</div>{share && <ShareDialog code={code} onClose={() => setShare(false)} />}
  </div>;
}
