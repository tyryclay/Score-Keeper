import Head from 'next/head';
import { useState, useEffect } from 'react';

// ── CONSTANTS ────────────────────────────────────────
const AV = ['#2563EB','#16A34A','#DC2626','#9333EA','#D97706','#0891B2','#DB2777','#65A30D'];

const GAME_LIST = [
  { key:'dominoes', name:'Dominoes'     },
  { key:'farkle',  name:'Farkle'        },
  { key:'flip7',   name:'Flip 7'        },
  { key:'general', name:'General Games' },
  { key:'nertz',   name:'Nertz'         },
  { key:'phase10', name:'Phase 10'      },
  { key:'yahtzee', name:'Yahtzee'       },
];

const CFG = {
  flip7:    {defWin:200,  winLbl:'Score to win',              hasPhases:false,hasRules:false,hi:true},
  farkle:   {defWin:10000,winLbl:'Score to win',              hasPhases:false,hasRules:true, hi:true },
  nertz:    {defWin:100,  winLbl:'Score to win',              hasPhases:false,hasRules:true, hi:true },
  phase10:  {defWin:0,    winLbl:'',                          hasPhases:true, hasRules:false,hi:false},
  general:  {defWin:0,    winLbl:'Win score (0 = manual end)',hasPhases:false,hasRules:false,hi:true },
  dominoes: {defWin:150,  winLbl:'Score to win',              hasPhases:false,hasRules:false,hi:false},
  yahtzee:  {defWin:0,    winLbl:'',                          hasPhases:false,hasRules:false,hi:true, hasScorecard:true},
};

const YAHTZEE_CATEGORIES = [
  { key:'ones',          label:'Ones',          section:'upper' },
  { key:'twos',          label:'Twos',          section:'upper' },
  { key:'threes',        label:'Threes',        section:'upper' },
  { key:'fours',         label:'Fours',         section:'upper' },
  { key:'fives',         label:'Fives',         section:'upper' },
  { key:'sixes',         label:'Sixes',         section:'upper' },
  { key:'threeKind',     label:'3 of a Kind',   section:'lower' },
  { key:'fourKind',      label:'4 of a Kind',   section:'lower' },
  { key:'fullHouse',     label:'Full House',    section:'lower', hint:25 },
  { key:'smallStraight', label:'Sm. Straight',  section:'lower', hint:30 },
  { key:'largeStraight', label:'Lg. Straight',  section:'lower', hint:40 },
  { key:'yahtzee',       label:'YAHTZEE',       section:'lower', hint:50 },
  { key:'chance',        label:'Chance',        section:'lower' },
];

const FARKLE_RULES = [
  ['Single Five','50 pts'],['Single One','100 pts'],
  ['Three 1s','300 pts'],['Three 2s','200 pts'],['Three 3s','300 pts'],
  ['Three 4s','400 pts'],['Three 5s','500 pts'],['Three 6s','600 pts'],
  ['Four of any number','1,000 pts'],['Five of any number','2,000 pts'],
  ['Six of any number','3,000 pts'],['1-6 Straight','1,500 pts'],
  ['Three pairs','1,500 pts'],['Four of any + a pair','1,500 pts'],
  ['Two triplets','2,500 pts'],
];
const NERTZ_RULES = [
  ['Cards played to a foundation pile','+1 pt each'],
  ['Cards left in your Nertz pile','-2 pts each'],
  ['Call "Nertz!" to end the round',''],
  ['Tiebreaker: most cards played wins',''],
];
const PHASES = [
  '2 sets of 3','1 set of 3 + 1 run of 4','1 set of 4 + 1 run of 4',
  '1 run of 7','1 run of 8','1 run of 9','2 sets of 4',
  '7 cards of one color','1 set of 5 + 1 set of 2','1 set of 5 + 1 set of 3',
];
const F7_PIPS = [
  ['0','#D32F2F'],['1','#1565C0'],['2','#2E7D32'],['3','#E65100'],
  ['4','#6A1B9A'],['5','#00838F'],['6','#AD1457'],['7','#F9A825'],
];

// ── UTILITIES ────────────────────────────────────────
function calcTotals(game) {
  if (!game) return {};
  return Object.fromEntries(
    game.playerIds.map(id => [id, game.rounds.reduce((s,r) => s+(r[id]||0), 0)])
  );
}

function computeStats(playerId, history) {
  const entries = history.filter(h => h.playerIds.includes(playerId));
  const byGame = {};
  GAME_LIST.forEach(({ key, name }) => {
    const g = entries.filter(h => h.gameKey === key);
    byGame[key] = {
      name,
      played: g.length,
      wins: g.filter(h => h.winnerId === playerId).length,
      points: g.reduce((s,h) => s + (h.finalScores?.[playerId] || 0), 0),
    };
  });
  return {
    played: entries.length,
    wins: entries.filter(h => h.winnerId === playerId).length,
    points: entries.reduce((s,h) => s + (h.finalScores?.[playerId] || 0), 0),
    byGame,
    recent: [...entries].reverse().slice(0, 5),
  };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function getGameName(gameKey, displayName) {
  if (gameKey === 'general' && displayName) return displayName;
  return GAME_LIST.find(g => g.key === gameKey)?.name || gameKey;
}

function makeGame(selIds, ws, cfg, extra={}) {
  if (cfg.hasScorecard) {
    return {
      playerIds: [...selIds],
      scores: Object.fromEntries(selIds.map(id => [id, {}])),
      winner: null, ...extra,
    };
  }
  return {
    playerIds: [...selIds], winScore: ws, rounds: [],
    phases: cfg.hasPhases ? Object.fromEntries(selIds.map(id=>[id,1])) : null,
    winner: null, ...extra,
  };
}

function calcYahtzeeTotals(game) {
  if (!game) return {};
  const out = {};
  game.playerIds.forEach(id => {
    const sc = (game.scores && game.scores[id]) || {};
    let upper = 0, lower = 0;
    YAHTZEE_CATEGORIES.forEach(c => {
      const v = sc[c.key];
      if (typeof v === 'number') {
        if (c.section === 'upper') upper += v; else lower += v;
      }
    });
    const bonus = upper >= 63 ? 35 : 0;
    const yahtzeeBonus = (sc.yahtzeeBonusCount||0) * 100;
    out[id] = { upper, bonus, lower, yahtzeeBonus, total: upper + bonus + lower + yahtzeeBonus };
  });
  return out;
}

function initGamesState() {
  return { flip7:null, farkle:null, nertz:null, phase10:null, general:null, dominoes:null, yahtzee:null };
}

// ── COMPONENTS ───────────────────────────────────────

function Avatar({ name, color, size=38 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:color||'#2563EB',
      color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:900, fontSize:Math.round(size*.42), flexShrink:0,
      userSelect:'none', letterSpacing:'-0.02em',
    }}>
      {name ? name[0].toUpperCase() : '?'}
    </div>
  );
}

function MiniBar({ pct }) {
  return (
    <div style={{ height:3, background:'var(--surf2)', borderRadius:2, margin:'3px 0 0' }}>
      <div style={{ height:'100%', width:`${pct}%`, background:'var(--acc)', borderRadius:2 }} />
    </div>
  );
}

function DominoSVG() {
  // A single domino tile showing [3|4] as decorative art
  const dot = (cx, cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="white" opacity="0.9" />;
  const leftDots  = [[28,28],[28,52],[28,76],[52,28],[52,76]]; // 5 pips  (top half ≈ [3])
  const rightDots = [[108,28],[132,28],[108,52],[132,52],[108,76],[132,76]]; // 6 pips (bottom half)
  return (
    <svg viewBox="0 0 162 108" width="120" height="80" style={{margin:'0 auto',display:'block',filter:'drop-shadow(0 4px 14px rgba(0,0,0,0.55))'}}>
      {/* Tile body */}
      <rect x="2" y="2" width="158" height="104" rx="12" ry="12" fill="#1a1a1a" stroke="#444" strokeWidth="2"/>
      {/* Dividing line */}
      <line x1="81" y1="12" x2="81" y2="96" stroke="#555" strokeWidth="2.5"/>
      {/* Left side — 5 dots */}
      {[[28,28],[52,52],[28,76],[52,28],[28,52]].map(([cx,cy]) => dot(cx,cy))}
      {/* Right side — 6 dots */}
      {[[100,24],[130,24],[100,52],[130,52],[100,80],[130,80]].map(([cx,cy]) => dot(cx,cy))}
    </svg>
  );
}

function BrandHeader({ gameKey, winScore, gameName }) {
if (gameKey === 'flip7') return (
  <div style={{marginBottom:18,textAlign:'center'}}>
    <img
      src="/flip7-logo.png"
      alt="Flip 7"
      style={{width:'100%',maxWidth:320,height:'auto',display:'block',margin:'0 auto'}}
    />
  </div>
);
  if (gameKey === 'farkle') return (
  <div style={{marginBottom:18,textAlign:'center'}}>
    <img
      src="/farkle-logo.png"
      alt="Farkle"
      style={{width:'100%',maxWidth:320,height:'auto',display:'block',margin:'0 auto'}}
    />
  </div>
);
  if (gameKey === 'nertz') return (
    <div className="brand b-nertz">
      <div className="nz-suits">&#9824; &#9829; &#9830; &#9827;</div>
      <div className="nz-word">NERTZ!</div>
    </div>
  );
  if (gameKey === 'phase10') return (
  <div style={{marginBottom:18,textAlign:'center'}}>
    <img
      src="/phase10-logo.png"
      alt="Phase 10"
      style={{width:'100%',maxWidth:320,height:'auto',display:'block',margin:'0 auto'}}
    />
  </div>
);
  if (gameKey === 'dominoes') return (
  <div style={{marginBottom:18,textAlign:'center'}}>
    <img
      src="/dominoes-logo.png"
      alt="Dominoes"
      style={{width:'100%',maxWidth:320,height:'auto',display:'block',margin:'0 auto'}}
    />
  </div>
);
  if (gameKey === 'yahtzee') return (
    <div className="brand b-yahtzee">
      <div className="yz-dice">&#9856; &#9857; &#9858; &#9859; &#9860;</div>
      <div className="yz-word">YAHTZEE!</div>
      <div className="yz-tag">SCOREPAD</div>
    </div>
  );
  if (gameKey === 'general') {
    return gameName ? (
      <div className="brand b-general">
        <div className="gen-gname">{gameName}</div>
      </div>
    ) : (
      <div className="brand b-general">
        <div className="gen-icons">&#127919; &#9822; &#127922; &#127921; &#127918;</div>
        <div className="gen-title">GENERAL</div>
        <div className="gen-sub">GAMES</div>
      </div>
    );
  }
  return null;
}

function RulesPanel({ gameKey, show, onToggle }) {
  const rows = gameKey === 'nertz' ? NERTZ_RULES : FARKLE_RULES;
  return (
    <div className="mb14">
      <button className="rules-btn" onClick={onToggle}>
        <span>{gameKey === 'nertz' ? '\u2660' : '\uD83C\uDFB2'} Scoring reference</span>
        <span style={{fontSize:11,color:'var(--muted)'}}>{show ? '\u25b2 hide' : '\u25bc show'}</span>
      </button>
      {show && (
        <div className="rules-grid">
          {rows.map(([c,p]) => (
            <div key={c} className="r-row">
              <span>{c}</span>
              {p && <span className="r-pts">{p}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PLAYER STATS ─────────────────────────────────────
function StatsPanel({ player, history, players }) {
  const s = computeStats(player.id, history);
  const wr = s.played > 0 ? Math.round((s.wins/s.played)*100) : 0;

  if (s.played === 0) return (
    <div style={{padding:'8px 14px 14px',color:'var(--muted)',fontSize:13}}>
      No completed games yet. Finish a game to see stats here!
    </div>
  );

  return (
    <div style={{padding:'4px 14px 14px'}}>
      {/* Summary row */}
      <div style={{display:'flex',gap:4,marginBottom:14,background:'var(--surf2)',borderRadius:10,padding:'12px 0'}}>
        {[
          [s.wins, 'WINS'],
          [s.played, 'GAMES'],
          [wr+'%', 'WIN RATE'],
          [s.points.toLocaleString(), 'TOTAL PTS'],
        ].map(([val,lbl]) => (
          <div key={lbl} style={{flex:1,textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:900,color:lbl==='WIN RATE'&&wr>=50?'var(--acc)':lbl==='WINS'?'var(--acc)':'var(--txt)'}}>{val}</div>
            <div style={{fontSize:9,color:'var(--muted)',letterSpacing:'0.08em',marginTop:2}}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Per-game */}
      <div className="sec-lbl">BY GAME</div>
      {GAME_LIST.map(({ key, name }) => {
        const g = s.byGame[key];
        if (!g || g.played === 0) return null;
        const gwr = Math.round((g.wins/g.played)*100);
        return (
          <div key={key} style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:3}}>
              <span style={{fontWeight:600}}>{name}</span>
              <span style={{color:'var(--muted)'}}>
                {g.wins}W / {g.played}G
                <span style={{marginLeft:8,color:'var(--acc)',fontWeight:700}}>{gwr}%</span>
              </span>
            </div>
            <MiniBar pct={gwr} />
          </div>
        );
      })}

      {/* Recent games */}
      {s.recent.length > 0 && (
        <>
          <div className="sec-lbl" style={{marginTop:14}}>RECENT GAMES</div>
          {s.recent.map(h => {
            const isWin = h.winnerId === player.id;
            const score = h.finalScores?.[player.id];
            const winner = players.find(p => p.id === h.winnerId);
            return (
              <div key={h.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--divider)',fontSize:13}}>
                <span style={{color:'var(--muted)',minWidth:38,fontSize:11}}>{formatDate(h.date)}</span>
                <span style={{flex:1,fontWeight:600}}>{getGameName(h.gameKey, h.displayName)}</span>
                <span style={{fontWeight:700,color:isWin?'var(--acc)':'var(--muted)',fontSize:12}}>
                  {isWin ? '\uD83C\uDFC6 Won' : `Lost${winner ? ' to '+winner.name : ''}`}
                </span>
                {score != null && score > 0 && (
                  <span style={{color:'var(--muted)',fontSize:11}}>{score.toLocaleString()}</span>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function PlayerCard({ player, idx, history, players, onRemove }) {
  const [open, setOpen] = useState(false);
  const s = computeStats(player.id, history);
  return (
    <div className="p-card">
      <div className="p-row">
        <Avatar name={player.name} color={AV[idx % AV.length]} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:16}}>{player.name}</div>
          {s.played > 0 && (
            <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>
              {'\uD83C\uDFC6'} {s.wins}W · {s.played}G · {Math.round((s.wins/s.played)*100)}% win rate
            </div>
          )}
        </div>
        <button onClick={() => setOpen(o => !o)}
          style={{color:'var(--muted)',fontSize:14,padding:8,minWidth:36,minHeight:36,display:'flex',alignItems:'center',justifyContent:'center',touchAction:'manipulation'}}>
          {open ? '\u25b2' : '\u25bc'}
        </button>
        <button onClick={() => onRemove(player.id)}
          style={{color:'var(--muted)',fontSize:22,padding:'4px 8px',minWidth:44,minHeight:44,display:'flex',alignItems:'center',justifyContent:'center',touchAction:'manipulation'}}>
          ×
        </button>
      </div>
      {open && <StatsPanel player={player} history={history} players={players} />}
    </div>
  );
}

function PlayersTab({ players, history, onAdd, onRemove }) {
  const [name, setName] = useState('');
  function add() {
    const n = name.trim();
    if (!n || players.some(p => p.name.toLowerCase() === n.toLowerCase())) return;
    onAdd(n); setName('');
  }
  return (
    <div>
      <div className="pg-title">Players</div>
      <div className="pg-sub">Your roster — stats tracked across all games.</div>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <input type="text" className="txt-inp" style={{flex:1}} placeholder="Enter name…"
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key==='Enter' && add()}
          autoComplete="off" autoCorrect="off" autoCapitalize="words" />
        <button className="btn" style={{width:'auto',padding:'12px 22px',flexShrink:0}} onClick={add}>Add</button>
      </div>
      {!players.length ? (
        <div className="empty">
          <div className="empty-ico">{'\uD83D\uDC65'}</div>
          <div className="empty-ttl">No players yet</div>
          <div className="empty-sub">Add names above to get started</div>
        </div>
      ) : players.map((p, i) => (
        <PlayerCard key={p.id} player={p} idx={i} history={history} players={players} onRemove={onRemove} />
      ))}
      {history.length > 0 && (
        <div style={{marginTop:24,textAlign:'center',fontSize:12,color:'var(--muted)'}}>
          {history.length} completed game{history.length!==1?'s':''} in history
        </div>
      )}
    </div>
  );
}

// ── GAME SETUP ───────────────────────────────────────
function GameSetup({ gameKey, players, selIds, onTogglePlayer, winScore, onWinScore, generalName, onGeneralName, generalHi, onDirection, dominoesHi, onDominoesDirection, onStart, showRules, onToggleRules }) {
  const c = CFG[gameKey];
  const ok = selIds.length >= 2;
  return (
    <div>
      <BrandHeader gameKey={gameKey} winScore={winScore} />
      {gameKey === 'general' && (
        <>
          <div className="mb16">
            <div className="sec-lbl">GAME NAME</div>
            <input type="text" className="txt-inp" placeholder="e.g. Catan, Yahtzee, Uno…"
              value={generalName} onChange={e => onGeneralName(e.target.value)}
              autoComplete="off" autoCorrect="off" autoCapitalize="words" />
          </div>
          <div className="mb16">
            <div className="sec-lbl">WHO WINS?</div>
            <div className="dir-row">
              <button className={`dir-btn${generalHi?' on':''}`} onClick={() => onDirection(true)}>&#128316; Highest score</button>
              <button className={`dir-btn${!generalHi?' on':''}`} onClick={() => onDirection(false)}>&#128317; Lowest score</button>
            </div>
          </div>
        </>
      )}
      {gameKey === 'dominoes' && (
        <div className="mb16">
          <div className="sec-lbl">WHO WINS?</div>
          <div className="dir-row">
            <button className={`dir-btn${dominoesHi?' on':''}`} onClick={() => onDominoesDirection(true)}>&#128316; Highest score</button>
            <button className={`dir-btn${!dominoesHi?' on':''}`} onClick={() => onDominoesDirection(false)}>&#128317; Lowest score</button>
          </div>
        </div>
      )}
      {c.hasRules && <RulesPanel gameKey={gameKey} show={showRules} onToggle={onToggleRules} />}
      {!players.length ? (
        <div style={{padding:28,textAlign:'center',color:'var(--muted)',background:'var(--surf)',borderRadius:12,border:'1px solid var(--bdr)',fontSize:15}}>
          Head to the <strong style={{color:'var(--txt)'}}>Players</strong> tab to add players first.
        </div>
      ) : (
        <>
          <div className="sec-lbl">SELECT PLAYERS</div>
          {players.map((p,i) => {
            const sel = selIds.includes(p.id);
            return (
              <div key={p.id} className={`p-row sel-able${sel?' sel-ed':''}`} onClick={() => onTogglePlayer(p.id)}>
                <div style={{width:38,height:38,borderRadius:'50%',background:sel?'var(--acc)':AV[i%AV.length],color:sel?'var(--fg)':'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:16,flexShrink:0,transition:'background .15s'}}>
                  {p.name[0].toUpperCase()}
                </div>
                <span style={{flex:1,fontWeight:600,fontSize:15}}>{p.name}</span>
                <span style={{color:'var(--acc)',fontSize:18,width:20,textAlign:'center'}}>{sel?'\u2713':''}</span>
              </div>
            );
          })}
          {(c.defWin > 0 || gameKey === 'general') && (
            <div className="mt16 mb16">
              <div className="sec-lbl">{gameKey==='general'?(generalHi?'WIN SCORE (0 = MANUAL END)':'END SCORE (0 = MANUAL END)'):c.winLbl.toUpperCase()}</div>
              <input type="text" inputMode="numeric" pattern="[0-9]*" className="ws-inp"
                value={winScore} onChange={e => onWinScore(parseInt(e.target.value)||0)} />
            </div>
          )}
          <button className="btn mt8" disabled={!ok} onClick={onStart}>
            {ok ? `Start game \u2014 ${selIds.length} player${selIds.length>1?'s':''}` : 'Select at least 2 players'}
          </button>
        </>
      )}
    </div>
  );
}

// ── CONFIRM MODAL ────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position:'fixed',inset:0,zIndex:999,
      background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:24,
    }}>
      <div style={{
        background:'var(--surf)',border:'1px solid var(--bdr)',borderRadius:16,
        padding:'28px 24px',maxWidth:320,width:'100%',textAlign:'center',
        boxShadow:'0 8px 40px rgba(0,0,0,.5)',
      }}>
        <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
        <div style={{fontSize:16,fontWeight:700,color:'var(--txt)',marginBottom:8}}>{message}</div>
        <div style={{fontSize:13,color:'var(--muted)',marginBottom:24}}>This cannot be undone.</div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn-ghost" style={{flex:1,minHeight:48,fontSize:15}} onClick={onCancel}>Cancel</button>
          <button className="btn" style={{flex:1,background:'#DC2626',minHeight:48,fontSize:15}} onClick={onConfirm}>Yes, continue</button>
        </div>
      </div>
    </div>
  );
}

// ── ACTIVE GAME ──────────────────────────────────────
function ActiveGame({ gameKey, game, players, onUpdate, onNewGame, onEndGame, showRules, onToggleRules, expandedScores, onToggleScore, roundView, onRoundView, onSaveHistory }) {
  const c = CFG[gameKey];
  const T = calcTotals(game);
  const hiWins = (gameKey==='general' || gameKey==='dominoes') && game.hiWins!==undefined ? game.hiWins : c.hi;
  const gp = game.playerIds.map(id => players.find(p=>p.id===id)).filter(Boolean);
  const sorted = [...gp].sort((a,b) => hiWins ? T[b.id]-T[a.id] : T[a.id]-T[b.id]);
  const wp = game.winner ? players.find(p=>p.id===game.winner) : null;

  // Games where negative scores are possible
  const allowNeg = ['flip7','nertz','general'].includes(gameKey);

  // Round nav
  const total  = game.rounds.length;
  const maxIdx = game.winner ? Math.max(0, total-1) : total;
  const vi     = Math.min(Math.max(0, roundView ?? total), maxIdx);
  const isNew  = vi >= total;
  const rn     = total + 1;

  const [inputs,     setInputs]     = useState({});
  const [negIds,     setNegIds]     = useState({});   // which players are in subtract mode
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirm,    setConfirm]    = useState(null); // null | 'newgame' | 'endgame'

  // recalc: never auto-declares winner — End Game button does that manually
  function recalc(updatedGame) {
    return {...updatedGame, winner: updatedGame.winner ?? null};
  }

  function getRawInput(pid) {
    const raw = inputs[pid] !== undefined ? inputs[pid] : '';
    const n   = parseInt(raw) || 0;
    return negIds[pid] ? -Math.abs(n) : n;
  }

  function submitRound() {
    const sc = {};
    gp.forEach(p => { sc[p.id] = getRawInput(p.id); });
    const updated = recalc({...game, rounds:[...game.rounds, sc]});
    onUpdate(updated);
    onRoundView(updated.rounds.length);
    setInputs({}); setNegIds({});
  }

  function saveRound() {
    if (vi >= game.rounds.length) return;
    const sc = {};
    gp.forEach(p => {
      const raw = inputs[p.id] !== undefined ? inputs[p.id] : String(Math.abs(game.rounds[vi][p.id]||0));
      const n   = parseInt(raw) || 0;
      sc[p.id]  = negIds[p.id] ? -Math.abs(n) : (game.rounds[vi][p.id] < 0 && inputs[p.id] === undefined ? game.rounds[vi][p.id] : n);
    });
    const newRounds = [...game.rounds];
    newRounds[vi] = sc;
    onUpdate(recalc({...game, rounds:newRounds}));
    setSavedFlash(true);
    setTimeout(() => { setSavedFlash(false); onRoundView(vi+1); setInputs({}); setNegIds({}); }, 600);
  }

  function handleEndGame() {
    // Declare winner based on current totals and archive
    const tots = calcTotals(game);
    const s    = [...gp].sort((a,b) => hiWins ? tots[b.id]-tots[a.id] : tots[a.id]-tots[b.id]);
    const winnerId = s[0].id;
    onSaveHistory({
      id: Date.now().toString(), gameKey,
      displayName: game.gameName || getGameName(gameKey),
      date: new Date().toISOString(),
      playerIds: [...game.playerIds], winnerId,
      rounds: game.rounds.length, finalScores: tots,
    });
    onEndGame();
  }

  function changePhase(playerId, delta) {
    const cur  = game.phases[playerId]||1;
    const next = Math.max(1, Math.min(11, cur+delta));
    if (next===cur) return;
    const newPhases = {...game.phases, [playerId]:next};
    let winner = game.winner;
    if (next > 10) {
      winner = playerId;
      const tots = calcTotals(game);
      onSaveHistory({
        id: Date.now().toString(), gameKey:'phase10', displayName:'Phase 10',
        date: new Date().toISOString(), playerIds:[...game.playerIds],
        winnerId: playerId, rounds: game.rounds.length, finalScores: tots,
      });
    } else if (game.winner===playerId && delta<0) winner=null;
    onUpdate({...game, phases:newPhases, winner});
  }

  // Which input value to show (absolute value, sign controlled by toggle)
  function displayVal(pid, roundIdx) {
    if (inputs[pid] !== undefined) return inputs[pid];
    if (roundIdx !== undefined && game.rounds[roundIdx]) {
      return String(Math.abs(game.rounds[roundIdx][pid]||0));
    }
    return '';
  }

  // Initialise negIds when navigating to an existing round with negative scores
  function initNegIds(roundIdx) {
    if (roundIdx >= game.rounds.length) { setNegIds({}); return; }
    const neg = {};
    gp.forEach(p => { if ((game.rounds[roundIdx][p.id]||0) < 0) neg[p.id] = true; });
    setNegIds(neg);
  }

  return (
    <div>
      {confirm && (
        <ConfirmModal
          message={confirm==='endgame' ? 'End this game and archive it?' : 'Start a new game? Current game will be lost.'}
          onConfirm={() => { setConfirm(null); confirm==='endgame' ? handleEndGame() : onNewGame(); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <BrandHeader gameKey={gameKey} winScore={game.winScore} gameName={game.gameName} />
      <div className="hdr-row">
        <div style={{flex:1}} className="game-meta">
          {c.hasPhases
            ? `Round ${game.rounds.length} · First to complete all 10 phases wins`
            : game.winScore>0
            ? `First to ${game.winScore.toLocaleString()} pts · Round ${game.rounds.length}`
            : `Round ${game.rounds.length} · ${hiWins?'Highest':'Lowest'} score wins`}
        </div>
        <button className="btn-ghost" onClick={() => setConfirm('newgame')}>New game</button>
      </div>

      {c.hasRules && <RulesPanel gameKey={gameKey} show={showRules} onToggle={onToggleRules} />}

      {wp && (
        <div className="win-banner">
          <div className="win-trophy">🏆</div>
          <div className="win-name">{wp.name} wins!</div>
          <div className="win-sub">{game.rounds.length} rounds · {(T[wp.id]||0).toLocaleString()} pts</div>
        </div>
      )}

      {/* Score cards */}
      {sorted.map((p, idx) => {
        const isW  = game.winner===p.id, isF = idx===0;
        const hl   = isW || (!game.winner && isF);
        const tot  = T[p.id]||0;
        const pct  = game.winScore>0 ? Math.min(100, Math.max(0, (tot/game.winScore)*100)) : 0;
        const ph   = c.hasPhases ? (game.phases?.[p.id]||1) : null;
        const phPct = ph ? Math.min(100,((ph-1)/10)*100) : 0;
        const pi   = players.findIndex(pl=>pl.id===p.id);
        const avBg = hl ? 'var(--acc)' : AV[pi%AV.length];
        const avFg = hl ? 'var(--fg)' : '#fff';
        const isExp = expandedScores[p.id];
        // Highlight scores at or over threshold
        const atWin = game.winScore > 0 && tot >= game.winScore;
        return (
          <div key={p.id} className={`sc-card${isW?' win':isF&&!game.winner?' lead':''}`}>
            <div className="sc-body">
              <div className="sc-av-wrap">
                <div style={{width:40,height:40,borderRadius:'50%',background:avBg,color:avFg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:17,transition:'background .2s'}}>
                  {p.name[0].toUpperCase()}
                </div>
                {hl && <span className="sc-crown">{isW?'🏆':'👑'}</span>}
              </div>
              <div className="sc-name-col">
                <div className="sc-name">{p.name}</div>
                {c.hasPhases && (
                  <div className="ph-ctrl">
                    <button className="ph-btn minus" onClick={() => changePhase(p.id,-1)} disabled={ph<=1}>-</button>
                    <div className="ph-badge">{ph<=10?`Phase ${ph}`:'✅ Done'}</div>
                    <button className="ph-btn plus"  onClick={() => changePhase(p.id,1)} disabled={ph>10}>+</button>
                  </div>
                )}
              </div>
              <div className="sc-num-col">
                <div className={`sc-total${hl?' hl':''}`} style={atWin&&!isW?{color:'var(--gold)'}:{}}>{tot.toLocaleString()}</div>
                {game.winScore>0 && <div className="sc-of">/ {game.winScore.toLocaleString()}</div>}
              </div>
              <button className="exp-btn" onClick={() => onToggleScore(p.id)}>{isExp?'▲':'▼'}</button>
            </div>
            {((game.winScore>0&&!c.hasPhases)||c.hasPhases) && (
              <div className="prog-wrap"><div className="prog-fill" style={{width:`${c.hasPhases?phPct:pct}%`}} /></div>
            )}
            {isExp && (
              <div className="hist-panel">
                {c.hasPhases && ph && (
                  <div className="ph-info">
                    <span style={{color:'var(--acc)',fontWeight:700}}>{ph<=10?`Phase ${ph}: `:'All done! '}</span>
                    <span style={{color:'var(--muted)'}}>{ph<=10?PHASES[ph-1]:'🎉'}</span>
                  </div>
                )}
                <div className="sec-lbl mb8">ROUND HISTORY</div>
                {!game.rounds.length
                  ? <div style={{color:'var(--muted)',fontSize:13}}>No rounds yet.</div>
                  : game.rounds.map((r,i) => {
                      const pts = r[p.id]||0;
                      const run = game.rounds.slice(0,i+1).reduce((s,rr)=>s+(rr[p.id]||0),0);
                      return (
                        <div key={i} className="hist-row">
                          <span style={{color:'var(--muted)'}}>Round {i+1}</span>
                          <div style={{display:'flex',gap:14}}>
                            <span style={{fontWeight:600,color:pts<0?'#F87171':'inherit'}}>{pts>=0?'+':''}{pts.toLocaleString()}</span>
                            <span style={{color:'var(--muted)',minWidth:52,textAlign:'right'}}>{run.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
              </div>
            )}
          </div>
        );
      })}

      {/* Round panel */}
      <div className={`rnd-panel${isNew?'':' editing'}`}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <button className="rnd-nav" disabled={vi===0} onClick={() => { onRoundView(vi-1); setInputs({}); initNegIds(vi-1); }}>←</button>
          <div style={{flex:1,textAlign:'center'}}>
            {isNew
              ? <div className="rnd-lbl">NEW ROUND {rn}</div>
              : <><div className="rnd-lbl">ROUND {vi+1} <span style={{opacity:.45}}>/ {total}</span></div><div className="rnd-sub">✏ EDITING</div></>}
          </div>
          <button className="rnd-nav" disabled={vi>=maxIdx} onClick={() => { onRoundView(vi+1); setInputs({}); initNegIds(vi+1); }}>→</button>
        </div>

        {gp.map((p) => {
          const pi       = players.findIndex(pl=>pl.id===p.id);
          const isNeg    = !!negIds[p.id];
          const defVal   = displayVal(p.id, isNew ? undefined : vi);
          return (
            <div key={p.id} className="rnd-row">
              <div style={{width:32,height:32,borderRadius:'50%',background:AV[pi%AV.length],color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,flexShrink:0}}>
                {p.name[0].toUpperCase()}
              </div>
              <span style={{flex:1,fontWeight:600,fontSize:15}}>{p.name}</span>
              {/* Subtract toggle — only for games that support negative scores */}
              {allowNeg && (
                <button
                  onClick={() => setNegIds(prev => ({...prev, [p.id]:!prev[p.id]}))}
                  style={{
                    width:36,height:36,borderRadius:8,flexShrink:0,
                    background:isNeg?'#DC2626':'var(--surf2)',
                    color:isNeg?'#fff':'var(--muted)',
                    fontSize:20,fontWeight:900,display:'flex',alignItems:'center',
                    justifyContent:'center',transition:'background .15s,color .15s',
                    border:`1.5px solid ${isNeg?'#DC2626':'var(--bdr)'}`,
                    touchAction:'manipulation',marginRight:6,
                  }}
                  aria-label="Toggle subtract"
                >−</button>
              )}
              <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                {isNeg && <span style={{position:'absolute',left:10,color:'#F87171',fontWeight:900,fontSize:18,pointerEvents:'none'}}>−</span>}
                <input className="num-inp" type="text" inputMode="numeric" pattern="[0-9]*"
                  placeholder="0"
                  defaultValue={defVal}
                  key={`${vi}-${p.id}-${isNeg}`}
                  style={{paddingLeft:isNeg?24:12,color:isNeg?'#F87171':'var(--txt)'}}
                  onChange={e => setInputs(prev => ({...prev, [p.id]: e.target.value}))} />
              </div>
            </div>
          );
        })}

        {isNew
          ? <button className="btn mt8" onClick={submitRound}>Submit round {rn}</button>
          : <button className="btn-edit" onClick={saveRound}
              style={savedFlash?{background:'var(--acc)',color:'var(--fg)',transition:'background .15s,color .15s'}:{}}>
              {savedFlash ? '✓ Saved!' : '✓ Save changes'}
            </button>}
      </div>

      {/* End Game button — always visible, archives and declares winner */}
      {!game.winner && game.rounds.length > 0 && (
        <button className="btn-ghost" style={{width:'100%',marginTop:10,minHeight:48,fontSize:14}}
          onClick={() => setConfirm('endgame')}>
          🏁 End game &amp; archive
        </button>
      )}
      {wp && <button className="btn mt12" onClick={() => setConfirm('newgame')}>Start new game</button>}
    </div>
  );
}

// ── ACTIVE YAHTZEE GAME (scorecard, not round-based) ─
function ActiveYahtzeeGame({ game, players, onUpdate, onNewGame, onEndGame, expandedScores, onToggleScore, onSaveHistory }) {
  const T = calcYahtzeeTotals(game);
  const gp = game.playerIds.map(id => players.find(p=>p.id===id)).filter(Boolean);
  const sorted = [...gp].sort((a,b) => (T[b.id]?.total||0) - (T[a.id]?.total||0));
  const wp = game.winner ? players.find(p => p.id === game.winner) : null;
  const allFilled = gp.length>0 && gp.every(p => YAHTZEE_CATEGORIES.every(c => typeof (game.scores[p.id]||{})[c.key] === 'number'));

  const [confirm, setConfirm] = useState(null); // null | 'newgame' | 'endgame'

  function setScore(pid, catKey, raw) {
    const trimmed = raw.trim();
    const val = trimmed === '' ? undefined : (parseInt(trimmed)||0);
    const newScores = {...game.scores, [pid]: {...game.scores[pid], [catKey]: val}};
    onUpdate({...game, scores:newScores});
  }

  function adjustYahtzeeBonus(pid, delta) {
    const cur = game.scores[pid]?.yahtzeeBonusCount || 0;
    const next = Math.max(0, cur + delta);
    const newScores = {...game.scores, [pid]: {...game.scores[pid], yahtzeeBonusCount: next}};
    onUpdate({...game, scores:newScores});
  }

  function handleEndGame() {
    const tots = calcYahtzeeTotals(game);
    const s = [...gp].sort((a,b) => (tots[b.id]?.total||0) - (tots[a.id]?.total||0));
    const winnerId = s[0].id;
    const finalScores = Object.fromEntries(gp.map(p => [p.id, tots[p.id]?.total||0]));
    onSaveHistory({
      id: Date.now().toString(), gameKey:'yahtzee', displayName:'Yahtzee',
      date: new Date().toISOString(), playerIds:[...game.playerIds],
      winnerId, rounds: YAHTZEE_CATEGORIES.length, finalScores,
    });
    onEndGame();
  }

  return (
    <div>
      {confirm && (
        <ConfirmModal
          message={confirm==='endgame' ? 'End this game and archive it?' : 'Start a new game? Current game will be lost.'}
          onConfirm={() => { setConfirm(null); confirm==='endgame' ? handleEndGame() : onNewGame(); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <BrandHeader gameKey="yahtzee" />
      <div className="hdr-row">
        <div style={{flex:1}} className="game-meta">Highest total wins · {gp.length} player{gp.length!==1?'s':''}</div>
        <button className="btn-ghost" onClick={() => setConfirm('newgame')}>New game</button>
      </div>

      {wp && (
        <div className="win-banner">
          <div className="win-trophy">🏆</div>
          <div className="win-name">{wp.name} wins!</div>
          <div className="win-sub">{(T[wp.id]?.total||0).toLocaleString()} pts</div>
        </div>
      )}

      {sorted.map((p, idx) => {
        const isW = game.winner === p.id, isF = idx === 0;
        const hl = isW || (!game.winner && isF && allFilled);
        const tot = T[p.id]?.total || 0;
        const pi = players.findIndex(pl => pl.id === p.id);
        const avBg = hl ? 'var(--acc)' : AV[pi % AV.length];
        const avFg = hl ? 'var(--fg)' : '#fff';
        const isExp = expandedScores[p.id];
        const sc = game.scores[p.id] || {};
        return (
          <div key={p.id} className={`sc-card${isW?' win':isF&&!game.winner?' lead':''}`}>
            <div className="sc-body">
              <div className="sc-av-wrap">
                <div style={{width:40,height:40,borderRadius:'50%',background:avBg,color:avFg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:17,transition:'background .2s'}}>
                  {p.name[0].toUpperCase()}
                </div>
                {hl && <span className="sc-crown">{isW?'🏆':'👑'}</span>}
              </div>
              <div className="sc-name-col">
                <div className="sc-name">{p.name}</div>
              </div>
              <div className="sc-num-col">
                <div className={`sc-total${hl?' hl':''}`}>{tot.toLocaleString()}</div>
              </div>
              <button className="exp-btn" onClick={() => onToggleScore(p.id)}>{isExp?'▲':'▼'}</button>
            </div>
            {isExp && (
              <div className="hist-panel">
                <div className="sec-lbl mb8">UPPER SECTION</div>
                {YAHTZEE_CATEGORIES.filter(c=>c.section==='upper').map(c => (
                  <div key={c.key} className="r-row">
                    <span>{c.label}</span>
                    <input className="num-inp" style={{width:64}} type="text" inputMode="numeric" pattern="[0-9]*"
                      placeholder="—"
                      defaultValue={typeof sc[c.key]==='number' ? String(sc[c.key]) : ''}
                      key={`${p.id}-${c.key}-${sc[c.key]}`}
                      onChange={e => setScore(p.id, c.key, e.target.value)} />
                  </div>
                ))}
                <div className="r-row" style={{fontWeight:700}}>
                  <span>Upper subtotal</span><span>{T[p.id]?.upper||0}</span>
                </div>
                <div className="r-row" style={{fontWeight:700,color: (T[p.id]?.bonus>0) ? 'var(--gold)' : 'var(--muted)'}}>
                  <span>Bonus (63+ = 35)</span><span>{T[p.id]?.bonus||0}</span>
                </div>
                <div className="sec-lbl mb8 mt12">LOWER SECTION</div>
                {YAHTZEE_CATEGORIES.filter(c=>c.section==='lower').map(c => (
                  <div key={c.key} className="r-row">
                    <span>{c.label}{c.hint ? <span style={{color:'var(--muted)',fontWeight:400}}> ({c.hint})</span> : null}</span>
                    <input className="num-inp" style={{width:64}} type="text" inputMode="numeric" pattern="[0-9]*"
                      placeholder="—"
                      defaultValue={typeof sc[c.key]==='number' ? String(sc[c.key]) : ''}
                      key={`${p.id}-${c.key}-${sc[c.key]}`}
                      onChange={e => setScore(p.id, c.key, e.target.value)} />
                  </div>
                ))}
                <div className="r-row">
                  <span>Extra Yahtzees <span style={{color:'var(--muted)',fontWeight:400}}>(×100 each)</span></span>
                  <div className="ph-ctrl" style={{marginTop:0}}>
                    <button className="ph-btn minus" onClick={() => adjustYahtzeeBonus(p.id,-1)} disabled={(sc.yahtzeeBonusCount||0)<=0}>-</button>
                    <div className="ph-badge">{sc.yahtzeeBonusCount||0}</div>
                    <button className="ph-btn plus" onClick={() => adjustYahtzeeBonus(p.id,1)}>+</button>
                  </div>
                </div>
                <div className="r-row" style={{fontWeight:700}}>
                  <span>Lower subtotal</span><span>{(T[p.id]?.lower||0) + (T[p.id]?.yahtzeeBonus||0)}</span>
                </div>
                <div className="r-row" style={{fontWeight:900,fontSize:15,borderTop:'1.5px solid var(--bdr)',marginTop:4,paddingTop:10}}>
                  <span>GRAND TOTAL</span><span style={{color:'var(--acc)'}}>{tot.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!game.winner && (
        <button className="btn-ghost" style={{width:'100%',marginTop:10,minHeight:48,fontSize:14}}
          onClick={() => setConfirm('endgame')}>
          🏁 End game &amp; archive
        </button>
      )}
      {wp && <button className="btn mt12" onClick={() => setConfirm('newgame')}>Start new game</button>}
    </div>
  );
}

// ── GAMES TAB ────────────────────────────────────────
function GamesTab({ games, players, history, selectedGame, onGameSelect, onGameUpdate, onNewGame, onSaveHistory }) {
  const [selIds, setSelIds]       = useState({flip7:[],farkle:[],nertz:[],phase10:[],general:[],dominoes:[],yahtzee:[]});
  const [winScores, setWinScores] = useState({flip7:200,farkle:10000,nertz:100,phase10:0,general:0,dominoes:150,yahtzee:0});
  const [generalName, setGenName] = useState('');
  const [generalHi, setGenHi]     = useState(true);
  const [dominoesHi, setDomHi]    = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [expandedScores, setExpScores] = useState({});
  const [roundView, setRoundView] = useState({});

  const gk = selectedGame;
  const game = games[gk];
  const c = CFG[gk];

  function togglePlayer(id) {
    setSelIds(prev => {
      const s = prev[gk];
      return {...prev, [gk]: s.includes(id) ? s.filter(x=>x!==id) : [...s,id]};
    });
  }

  function startGame() {
    const sel = selIds[gk];
    if (sel.length < 2) return;
    const ws = c.hasPhases ? 0 : (winScores[gk] || 0);
    const extra = gk==='general'
      ? {gameName:generalName.trim()||'General Game', hiWins:generalHi}
      : gk==='dominoes'
      ? {hiWins:dominoesHi}
      : {};
    onGameUpdate(gk, makeGame(sel, ws, c, extra));
    setRoundView(prev => ({...prev, [gk]: null}));
    setExpScores({});
  }

  function handleNewGame() {
    onNewGame(gk);
    setSelIds(prev => ({...prev, [gk]:[]}));
    setExpScores({});
    setRoundView(prev => ({...prev, [gk]: null}));
    setShowRules(false);
  }

  // Sync winScore display from active game
  if (game) {
    const ws = game.winScore;
    if (ws && winScores[gk] !== ws) setWinScores(prev => ({...prev, [gk]:ws}));
  }

  return (
    <div>
      <div className="picker-wrap">
        <select className="game-picker" value={gk}
          onChange={e => { onGameSelect(e.target.value); setShowRules(false); setExpScores({}); }}>
          <option value="dominoes">Dominoes 🀴</option>
          <option value="farkle">Farkle {'\uD83C\uDFB2'}</option>
          <option value="flip7">Flip 7 7️⃣</option>
          <option value="general">General Games {'\uD83C\uDFAF'}</option>
          <option value="nertz">Nertz &#9824;</option>
          <option value="phase10">Phase 10 {'\uD83D\uDD22'}</option>
          <option value="yahtzee">Yahtzee {'\uD83C\uDFB2'}</option>
        </select>
        <span className="picker-arrow" />
      </div>
      {game && c.hasScorecard ? (
        <ActiveYahtzeeGame
          game={game} players={players}
          onUpdate={g => onGameUpdate(gk,g)}
          onNewGame={handleNewGame}
          onEndGame={() => { onNewGame(gk); }}
          expandedScores={expandedScores}
          onToggleScore={id => setExpScores(prev => ({...prev,[id]:!prev[id]}))}
          onSaveHistory={onSaveHistory}
        />
      ) : game ? (
        <ActiveGame
          gameKey={gk} game={game} players={players}
          onUpdate={g => onGameUpdate(gk,g)}
          onNewGame={handleNewGame}
          onEndGame={() => { onNewGame(gk); }}
          showRules={showRules} onToggleRules={() => setShowRules(r=>!r)}
          expandedScores={expandedScores}
          onToggleScore={id => setExpScores(prev => ({...prev,[id]:!prev[id]}))}
          roundView={roundView[gk] ?? null}
          onRoundView={v => setRoundView(prev => ({...prev,[gk]:v}))}
          onSaveHistory={onSaveHistory}
        />
      ) : (
        <GameSetup
          gameKey={gk} players={players}
          selIds={selIds[gk]}
          onTogglePlayer={togglePlayer}
          winScore={winScores[gk]}
          onWinScore={v => setWinScores(prev => ({...prev,[gk]:v}))}
          generalName={generalName} onGeneralName={setGenName}
          generalHi={generalHi} onDirection={setGenHi}
          dominoesHi={dominoesHi} onDominoesDirection={setDomHi}
          onStart={startGame}
          showRules={showRules} onToggleRules={() => setShowRules(r=>!r)}
        />
      )}
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────
export default function App() {
  const [players,  setPlayers]  = useState([]);
  const [games,    setGames]    = useState(initGamesState);
  const [history,  setHistory]  = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [selGame,  setSelGame]  = useState('flip7');
  const [tab,      setTab]      = useState('players');
  const [loaded,   setLoaded]   = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('gnt_v9') || 'null');
      if (d) {
        if (d.players)  setPlayers(d.players);
        if (d.games)    setGames(g => ({...g,...d.games}));
        if (d.history)  setHistory(d.history);
        if (d.darkMode !== undefined) setDarkMode(d.darkMode);
        if (d.selGame)  setSelGame(d.selGame);
      }
    } catch(e) {}
    setLoaded(true);
  }, []);

  // Save on every change
  useEffect(() => {
    if (!loaded) return;
    const data = { players, games, history, darkMode, selGame };
    localStorage.setItem('gnt_v9', JSON.stringify(data));
  }, [players, games, history, darkMode, selGame, loaded]);

  // Save on window close (safety net)
  useEffect(() => {
    if (!loaded) return;
    const save = () => localStorage.setItem('gnt_v9', JSON.stringify({players,games,history,darkMode,selGame}));
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [players, games, history, darkMode, selGame, loaded]);

  // Apply body theme class
  useEffect(() => {
    if (!loaded) return;
    const gameClass = tab==='games' ? `t-${selGame}` : '';
    document.body.className = [gameClass, darkMode?'':'light'].filter(Boolean).join(' ');
  }, [tab, selGame, darkMode, loaded]);

  function addPlayer(name) {
    setPlayers(prev => [...prev, {id: String(Date.now()), name}]);
  }
  function removePlayer(id) {
    setPlayers(prev => prev.filter(p => p.id !== id));
  }
  function updateGame(key, g) {
    setGames(prev => ({...prev, [key]:g}));
  }
  function endGame(key) {
    setGames(prev => ({...prev, [key]:null}));
  }
  function saveHistory(entry) {
    setHistory(prev => [entry, ...prev.slice(0,99)]);
  }

  if (!loaded) return <div className="loading">Loading…</div>;

  return (
    <>
      <Head>
        <title>Game Night Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#1F3658" />
      </Head>

      <nav className="tab-bar">
        <button className={`tab${tab==='players'?' on':''}`} onClick={() => setTab('players')}>
          <span className="ico">{'\uD83D\uDC65'}</span>
          <span>PLAYERS</span>
        </button>
        <button className={`tab${tab==='games'?' on':''}`} onClick={() => setTab('games')}>
          <span className="ico">{'\uD83C\uDFAE'}</span>
          <span>GAMES</span>
        </button>
        <button className="mode-btn" onClick={() => setDarkMode(d=>!d)} aria-label="Toggle light/dark mode">
          {darkMode ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>
      </nav>

      <main className="app-main">
        {tab === 'players' ? (
          <PlayersTab players={players} history={history} onAdd={addPlayer} onRemove={removePlayer} />
        ) : (
          <GamesTab
            games={games} players={players} history={history}
            selectedGame={selGame} onGameSelect={setSelGame}
            onGameUpdate={updateGame} onNewGame={endGame} onSaveHistory={saveHistory}
          />
        )}
      </main>
    </>
  );
}
