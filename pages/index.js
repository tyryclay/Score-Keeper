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
];

const CFG = {
  flip7:    {defWin:200,  winLbl:'Score to win',              hasPhases:false,hasRules:false,hi:false},
  farkle:   {defWin:10000,winLbl:'Score to win',              hasPhases:false,hasRules:true, hi:true },
  nertz:    {defWin:100,  winLbl:'Score to win',              hasPhases:false,hasRules:true, hi:true },
  phase10:  {defWin:0,    winLbl:'',                          hasPhases:true, hasRules:false,hi:false},
  general:  {defWin:0,    winLbl:'Win score (0 = manual end)',hasPhases:false,hasRules:false,hi:true },
  dominoes: {defWin:150,  winLbl:'Score to win',              hasPhases:false,hasRules:false,hi:false},
};

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
  return {
    playerIds: [...selIds], winScore: ws, rounds: [],
    phases: cfg.hasPhases ? Object.fromEntries(selIds.map(id=>[id,1])) : null,
    winner: null, ...extra,
  };
}

function initGamesState() {
  return { flip7:null, farkle:null, nertz:null, phase10:null, general:null, dominoes:null };
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
  <div className="brand b-flip7">
    <img
      src="/flip7-logo.png"
      alt="Flip 7"
      style={{
        width: '100%',
        maxWidth: 320,
        height: 'auto',
        display: 'block',
        margin: '0 auto',
        borderRadius: 8,
      }}
    />
  </div>
);
  if (gameKey === 'farkle') return (
  <div className="brand b-farkle">
    <img
      src="/farkle-logo.png"
      alt="Farkle"
      style={{
        width: '100%',
        maxWidth: 320,
        height: 'auto',
        display: 'block',
        margin: '0 auto',
        borderRadius: 8,
      }}
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
    <div className="brand b-p10">
       <img
      src="/phase101-logo.png"
      alt="Phase 10"
      style={{
        width: '100%',
        maxWidth: 320,
        height: 'auto',
        display: 'block',
        margin: '0 auto',
        borderRadius: 8,
      }}
    />
  </div>
);
  if (gameKey === 'dominoes') return (
    <div className="brand b-dominoes">
        <img
      src="/dominoes-logo.png"
      alt="Dominoes"
      style={{
        width: '100%',
        maxWidth: 320,
        height: 'auto',
        display: 'block',
        margin: '0 auto',
        borderRadius: 8,
      }}
    />
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

// ── ACTIVE GAME ──────────────────────────────────────
function ActiveGame({ gameKey, game, players, onUpdate, onNewGame, showRules, onToggleRules, expandedScores, onToggleScore, roundView, onRoundView, onSaveHistory }) {
  const c = CFG[gameKey];
  const T = calcTotals(game);
  const hiWins = (gameKey==='general' || gameKey==='dominoes') && game.hiWins!==undefined ? game.hiWins : c.hi;
  const gp = game.playerIds.map(id => players.find(p=>p.id===id)).filter(Boolean);
  const sorted = [...gp].sort((a,b) => hiWins ? T[b.id]-T[a.id] : T[a.id]-T[b.id]);
  const wp = game.winner ? players.find(p=>p.id===game.winner) : null;

  // Round nav state
  const total = game.rounds.length;
  const maxIdx = game.winner ? Math.max(0, total-1) : total;
  const vi = Math.min(Math.max(0, roundView ?? total), maxIdx);
  const isNew = vi >= total;
  const rn = total + 1;

  // Inputs tracked locally to avoid re-render on each keystroke
  const [inputs, setInputs] = useState({});

  function recalc(updatedGame) {
    if (c.hasPhases) return updatedGame;
    if (updatedGame.winScore <= 0 || !updatedGame.rounds.length) return {...updatedGame, winner:null};
    const tots = calcTotals(updatedGame);
    const anyOver = gp.some(p => tots[p.id] >= updatedGame.winScore);
    if (!anyOver) return {...updatedGame, winner:null};
    const s = [...gp].sort((a,b) => hiWins ? tots[b.id]-tots[a.id] : tots[a.id]-tots[b.id]);
    const winnerId = s[0].id;
    if (winnerId !== updatedGame.winner) {
      onSaveHistory({
        id: Date.now().toString(),
        gameKey,
        displayName: updatedGame.gameName || getGameName(gameKey),
        date: new Date().toISOString(),
        playerIds: [...updatedGame.playerIds],
        winnerId,
        rounds: updatedGame.rounds.length,
        finalScores: tots,
      });
    }
    return {...updatedGame, winner:winnerId};
  }

  function submitRound() {
    const sc = {};
    gp.forEach(p => { sc[p.id] = parseInt(inputs[p.id]||'0')||0; });
    const updated = recalc({...game, rounds:[...game.rounds, sc]});
    onUpdate(updated);
    onRoundView(updated.rounds.length);
    setInputs({});
  }

  const [savedFlash, setSavedFlash] = useState(false);

  function saveRound() {
    if (vi >= game.rounds.length) return;
    const sc = {};
    gp.forEach(p => { sc[p.id] = parseInt(inputs[p.id]||String(game.rounds[vi][p.id]||0))||0; });
    const newRounds = [...game.rounds];
    newRounds[vi] = sc;
    onUpdate(recalc({...game, rounds:newRounds}));
    // Advance to next round (or new-round slot), with a brief flash
    setSavedFlash(true);
    setTimeout(() => {
      setSavedFlash(false);
      onRoundView(vi + 1);
      setInputs({});
    }, 600);
  }

  function changePhase(playerId, delta) {
    const cur = game.phases[playerId]||1;
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

  return (
    <div>
      <BrandHeader gameKey={gameKey} winScore={game.winScore} gameName={game.gameName} />
      <div className="hdr-row">
        <div style={{flex:1}} className="game-meta">
          {c.hasPhases
            ? `Round ${game.rounds.length} \u00b7 First to complete all 10 phases wins`
            : game.winScore>0
            ? `${hiWins?'First to':'Lowest when someone hits'} ${game.winScore.toLocaleString()} pts \u00b7 Round ${game.rounds.length}`
            : `Round ${game.rounds.length} \u00b7 ${hiWins?'Highest':'Lowest'} score wins`}
        </div>
        <button className="btn-ghost" onClick={onNewGame}>New game</button>
      </div>

      {c.hasRules && <RulesPanel gameKey={gameKey} show={showRules} onToggle={onToggleRules} />}

      {wp && (
        <div className="win-banner">
          <div className="win-trophy">{'\uD83C\uDFC6'}</div>
          <div className="win-name">{wp.name} wins!</div>
          <div className="win-sub">{game.rounds.length} rounds · {(T[wp.id]||0).toLocaleString()} pts</div>
        </div>
      )}

      {/* Score cards */}
      {sorted.map((p, idx) => {
        const isW = game.winner===p.id, isF = idx===0;
        const hl = isW || (!game.winner && isF);
        const tot = T[p.id]||0;
        const pct = game.winScore>0 ? Math.min(100,(tot/game.winScore)*100) : 0;
        const ph = c.hasPhases ? (game.phases?.[p.id]||1) : null;
        const phPct = ph ? Math.min(100,((ph-1)/10)*100) : 0;
        const pi = players.findIndex(pl=>pl.id===p.id);
        const avBg = hl ? 'var(--acc)' : AV[pi%AV.length];
        const avFg = hl ? 'var(--fg)' : '#fff';
        const isExp = expandedScores[p.id];
        return (
          <div key={p.id} className={`sc-card${isW?' win':isF&&!game.winner?' lead':''}`}>
            <div className="sc-body">
              <div className="sc-av-wrap">
                <div style={{width:40,height:40,borderRadius:'50%',background:avBg,color:avFg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:17,transition:'background .2s'}}>
                  {p.name[0].toUpperCase()}
                </div>
                {hl && <span className="sc-crown">{isW?'\uD83C\uDFC6':'\uD83D\uDC51'}</span>}
              </div>
              <div className="sc-name-col">
                <div className="sc-name">{p.name}</div>
                {c.hasPhases && (
                  <div className="ph-ctrl">
                    <button className="ph-btn minus" onClick={() => changePhase(p.id,-1)} disabled={ph<=1}>-</button>
                    <div className="ph-badge">{ph<=10?`Phase ${ph}`:'\u2705 Done'}</div>
                    <button className="ph-btn plus" onClick={() => changePhase(p.id,1)} disabled={ph>10}>+</button>
                  </div>
                )}
              </div>
              <div className="sc-num-col">
                <div className={`sc-total${hl?' hl':''}`}>{tot.toLocaleString()}</div>
                {game.winScore>0 && <div className="sc-of">/ {game.winScore.toLocaleString()}</div>}
              </div>
              <button className="exp-btn" onClick={() => onToggleScore(p.id)}>{isExp?'\u25b2':'\u25bc'}</button>
            </div>
            {((game.winScore>0&&!c.hasPhases)||c.hasPhases) && (
              <div className="prog-wrap"><div className="prog-fill" style={{width:`${c.hasPhases?phPct:pct}%`}} /></div>
            )}
            {isExp && (
              <div className="hist-panel">
                {c.hasPhases && ph && (
                  <div className="ph-info">
                    <span style={{color:'var(--acc)',fontWeight:700}}>{ph<=10?`Phase ${ph}: `:'All done! '}</span>
                    <span style={{color:'var(--muted)'}}>{ph<=10?PHASES[ph-1]:'\uD83C\uDF89'}</span>
                  </div>
                )}
                <div className="sec-lbl mb8">ROUND HISTORY</div>
                {!game.rounds.length
                  ? <div style={{color:'var(--muted)',fontSize:13}}>No rounds yet.</div>
                  : game.rounds.map((r,i) => {
                      const run = game.rounds.slice(0,i+1).reduce((s,rr)=>s+(rr[p.id]||0),0);
                      return (
                        <div key={i} className="hist-row">
                          <span style={{color:'var(--muted)'}}>Round {i+1}</span>
                          <div style={{display:'flex',gap:14}}>
                            <span style={{fontWeight:600}}>+{(r[p.id]||0).toLocaleString()}</span>
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
          <button className="rnd-nav" disabled={vi===0} onClick={() => { onRoundView(vi-1); setInputs({}); }}>←</button>
          <div style={{flex:1,textAlign:'center'}}>
            {isNew
              ? <div className="rnd-lbl">NEW ROUND {rn}</div>
              : <><div className="rnd-lbl">ROUND {vi+1} <span style={{opacity:.45}}>/ {total}</span></div><div className="rnd-sub">✏ EDITING</div></>}
          </div>
          <button className="rnd-nav" disabled={vi>=maxIdx} onClick={() => { onRoundView(vi+1); setInputs({}); }}>→</button>
        </div>
        {gp.map((p,i) => {
          const pi = players.findIndex(pl=>pl.id===p.id);
          const defaultVal = isNew ? '' : String(game.rounds[vi]?.[p.id] ?? 0);
          return (
            <div key={p.id} className="rnd-row">
              <div style={{width:32,height:32,borderRadius:'50%',background:AV[pi%AV.length],color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,flexShrink:0}}>
                {p.name[0].toUpperCase()}
              </div>
              <span style={{flex:1,fontWeight:600,fontSize:15}}>{p.name}</span>
              <input className="num-inp" type="text" inputMode="numeric" pattern="[0-9]*"
                placeholder="0"
                defaultValue={defaultVal}
                key={`${vi}-${p.id}`}
                onChange={e => setInputs(prev => ({...prev, [p.id]: e.target.value}))} />
            </div>
          );
        })}
        {isNew
          ? <button className="btn mt8" onClick={submitRound}>Submit round {rn}</button>
          : <button className="btn-edit" onClick={saveRound}
              style={savedFlash ? {background:'var(--acc)',color:'var(--fg)',transition:'background .15s,color .15s'} : {}}>
              {savedFlash ? '✓ Saved!' : '✓ Save changes'}
            </button>}
      </div>

      {wp && <button className="btn mt12" onClick={onNewGame}>Start new game</button>}
    </div>
  );
}

// ── GAMES TAB ────────────────────────────────────────
function GamesTab({ games, players, history, selectedGame, onGameSelect, onGameUpdate, onNewGame, onSaveHistory }) {
  const [selIds, setSelIds]       = useState({flip7:[],farkle:[],nertz:[],phase10:[],general:[],dominoes:[]});
  const [winScores, setWinScores] = useState({flip7:200,farkle:10000,nertz:100,phase10:0,general:0,dominoes:150});
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
          <option value="dominoes">&#9646;  Dominoes</option>
          <option value="farkle">{'\uD83C\uDFB2'}  Farkle</option>
          <option value="flip7">{'\uD83C\uDCCF'}  Flip 7</option>
          <option value="general">{'\uD83C\uDFAF'}  General Games</option>
          <option value="nertz">Nertz &#9824;</option>
          <option value="phase10">{'\uD83D\uDD22'}  Phase 10</option>
        </select>
        <span className="picker-arrow" />
      </div>
      {game ? (
        <ActiveGame
          gameKey={gk} game={game} players={players}
          onUpdate={g => onGameUpdate(gk,g)}
          onNewGame={handleNewGame}
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
