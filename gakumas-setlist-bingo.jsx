import React, { useState, useMemo } from "react";

const SONG_POOL = [
  "モーニング・プリズム", "リハーサル・トワイライト", "backstage diary",
  "誓いのファンファーレ", "灯火のオーバーチュア", "きらめきステップ",
  "初陣ノート", "夢のリレー", "拍手のカーテンコール", "青のリフレイン",
  "ネオンの約束", "初舞台", "追いかけるスポットライト", "花道のワルツ",
  "レッスンルームの窓", "喝采のあと", "夜明けのセットリスト",
  "手をつなぐ瞬間", "涙のアンコール", "全力アピール", "舞台裏の約束",
  "拝啓、あの日の私へ", "みんなのプロデュース", "終幕のリボン",
  "ネクストステージ", "つぼみの合図", "拍動リズム", "銀テープの軌跡",
  "君と見る景色", "最後の一音まで",
];

const IDOL_POOL = [
  "陽向ひまり", "小鳥遊そら", "水無月れん", "花村みなも",
  "十六夜つむぎ", "白金ののか", "星野かなで", "美濃部あおい",
];

const LINES = [
  { id: "row1", label: "横1列目", idx: [0, 1, 2, 3, 4] },
  { id: "col1", label: "縦1列目", idx: [0, 5, 10, 15, 20] },
  { id: "row2", label: "横2列目", idx: [5, 6, 7, 8, 9] },
  { id: "col2", label: "縦2列目", idx: [1, 6, 11, 16, 21] },
  { id: "row3", label: "横3列目", idx: [10, 11, 12, 13, 14] },
  { id: "col3", label: "縦3列目", idx: [2, 7, 12, 17, 22] },
  { id: "row4", label: "横4列目", idx: [15, 16, 17, 18, 19] },
  { id: "col4", label: "縦4列目", idx: [3, 8, 13, 18, 23] },
  { id: "row5", label: "横5列目", idx: [20, 21, 22, 23, 24] },
  { id: "col5", label: "縦5列目", idx: [4, 9, 14, 19, 24] },
  { id: "diag1", label: "斜め ↘", idx: [0, 6, 12, 18, 24] },
  { id: "diag2", label: "斜め ↙", idx: [4, 8, 12, 16, 20] },
];

const INITIAL_POINTS = 150;
const DEFAULT_BET = 10;

const COLORS = {
  bg: "#15121c",
  card: "#211e2c",
  cardAlt: "#2a2638",
  front: "#1c2a2c",
  back: "#2a1f2e",
  gold: "#f4c95d",
  teal: "#43d9c0",
  pink: "#ff5d8f",
  text: "#f5f1e8",
  muted: "#9c97ae",
  line: "#3a3650",
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeEmptyBoard() {
  return Array(25).fill(null);
}

function makeDefaultBets() {
  const b = {};
  LINES.forEach((l) => (b[l.id] = DEFAULT_BET));
  return b;
}

function groupOf(i) {
  if (i === 12) return "free";
  if (i < 12) return "front";
  return "back";
}

export default function App() {
  const [board, setBoard] = useState(makeEmptyBoard());
  const [bets, setBets] = useState(makeDefaultBets());
  const [correctSetlist, setCorrectSetlist] = useState(null);
  const [selectedIdol, setSelectedIdol] = useState(IDOL_POOL[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [shareText, setShareText] = useState("");
  const [shareError, setShareError] = useState("");
  const [copied, setCopied] = useState(false);

  const totalBet = useMemo(
    () => Object.values(bets).reduce((s, v) => s + (Number(v) || 0), 0),
    [bets]
  );
  const betDiff = INITIAL_POINTS - totalBet;
  const filledCount = board.filter((s, i) => i === 12 || s).length;

  const songMembers = useMemo(() => {
    const map = {};
    if (correctSetlist) correctSetlist.forEach((e) => (map[e.song] = e.members));
    return map;
  }, [correctSetlist]);

  function updateCell(i, value) {
    const next = [...board];
    next[i] = value || null;
    setBoard(next);
    setResult(null);
  }

  function updateBet(id, value) {
    setBets((prev) => ({ ...prev, [id]: value === "" ? "" : Number(value) }));
    setResult(null);
  }

  function generateDummySetlist() {
    const chosenSongs = shuffle(SONG_POOL).slice(0, 24);
    const list = chosenSongs.map((song) => {
      const memberCount = 1 + Math.floor(Math.random() * 2);
      const members = shuffle(IDOL_POOL).slice(0, memberCount);
      return { song, members };
    });
    setCorrectSetlist(list);
    setResult(null);
    setError("");
  }

  function generateShareText() {
    setShareError("");
    if (filledCount < 25) {
      setShareError("すべてのマスに曲を入力してから生成してください(中央はフリー)。");
      return;
    }
    const opening = board[0];
    const encore = board[24];
    const frontRest = board.slice(1, 12);
    const backRest = board.slice(13, 24);

    let text = "🎫 学園セトリ予想ビンゴ 🎫\n\n";
    text += `🎤 1曲目(OPENING)予想: ${opening}\n\n`;
    text += "▼前半(1〜12曲目)予想\n";
    frontRest.forEach((s) => { text += `・${s}\n`; });
    text += "\n▼後半(13〜24曲目)予想\n";
    backRest.forEach((s) => { text += `・${s}\n`; });
    text += `\n🎉 ラスト曲(ENCORE)予想: ${encore}\n`;
    text += `\n担当アイドル: ${selectedIdol}\n`;

    if (result) {
      const bingoCount = result.lineResults.filter((l) => l.status === "BINGO").length;
      text += `\n─────\n🏆 判定結果\n`;
      text += `持ち点: ${INITIAL_POINTS} → ${result.finalTotal}点\n`;
      text += `BINGO成立ライン: ${bingoCount}本\n`;
    }

    text += "\n#学マス #セトリ予想ビンゴ";
    setShareText(text);
    setCopied(false);
  }

  async function copyShareText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setShareError("コピーに失敗しました。テキストを選択して手動でコピーしてください。");
    }
  }

  function resetAll() {
    setBoard(makeEmptyBoard());
    setBets(makeDefaultBets());
    setCorrectSetlist(null);
    setResult(null);
    setError("");
    setShareText("");
    setShareError("");
    setCopied(false);
  }

  function judge() {
    setError("");
    if (totalBet !== INITIAL_POINTS) {
      setError(`ベット合計が${INITIAL_POINTS}点になっていません(現在 ${totalBet}点)。`);
      return;
    }
    if (filledCount < 25) {
      setError("すべてのマスに曲を入力してください(中央はフリー)。");
      return;
    }
    if (!correctSetlist) {
      setError("先に「ダミー正解セトリを生成」を押してください。");
      return;
    }

    const songs = correctSetlist.map((e) => e.song);
    const front = songs.slice(0, 12);
    const back = songs.slice(12, 24);

    const hits = board.map((song, i) => {
      if (i === 12) return true;
      if (i === 0) return song === songs[0];
      if (i === 24) return song === songs[23];
      if (i < 12) return front.includes(song);
      return back.includes(song);
    });

    const lineResults = LINES.map((line) => {
      const hitCount = line.idx.filter((i) => hits[i]).length;
      const bet = Number(bets[line.id]) || 0;
      let payout, status, tantouCount = 0;

      if (hitCount === 5) {
        status = "BINGO";
        tantouCount = line.idx.filter(
          (i) => i !== 12 && hits[i] && songMembers[board[i]]?.includes(selectedIdol)
        ).length;
        payout = bet * 2 * Math.pow(2, tantouCount);
      } else if (hitCount === 0) {
        status = "不成立";
        payout = 0;
      } else {
        status = "一部的中";
        payout = Math.round(bet * (hitCount / 5));
      }
      return { ...line, hitCount, bet, payout, status, tantouCount };
    });

    const subtotal = lineResults.reduce((s, l) => s + l.payout, 0);
    const openingHit = hits[0];
    const encoreHit = hits[24];
    let multiplier = 1;
    if (openingHit) multiplier *= 2;
    if (encoreHit) multiplier *= 2;
    const finalTotal = subtotal * multiplier;

    setResult({ lineResults, subtotal, openingHit, encoreHit, multiplier, finalTotal });
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", color: COLORS.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .display-font { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.04em; }
        .mono-font { font-family: 'JetBrains Mono', monospace; }
        select, input[type=number] {
          background: ${COLORS.cardAlt};
          color: ${COLORS.text};
          border: 1px solid ${COLORS.line};
          border-radius: 6px;
        }
        select:focus, input:focus, button:focus-visible {
          outline: 2px solid ${COLORS.gold};
          outline-offset: 2px;
        }
        button { cursor: pointer; }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ marginBottom: 24 }}>
          <div className="mono-font" style={{ color: COLORS.gold, fontSize: 13, letterSpacing: "0.2em", marginBottom: 6 }}>
            SETLIST BINGO
          </div>
          <h1 className="display-font" style={{ fontSize: 40, margin: 0, lineHeight: 1 }}>
            学園セトリ予想ビンゴ
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 8, maxWidth: 600 }}>
            5×5マスにセトリ予想を入力し、12ライン(縦・横・斜め)に持ち点をベット。
            公演終了後、正解セトリで一括判定する。曲・担当アイドルはテスト用ダミーです。
          </p>
        </div>

        <div style={{
          display: "flex", gap: 16, marginBottom: 20, padding: "14px 18px",
          background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.line}`,
          alignItems: "center", flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>初期持ち点</div>
            <div className="mono-font" style={{ fontSize: 22, fontWeight: 700 }}>{INITIAL_POINTS}</div>
          </div>
          <div style={{ width: 1, height: 32, background: COLORS.line }} />
          <div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>ベット合計</div>
            <div className="mono-font" style={{ fontSize: 22, fontWeight: 700, color: betDiff === 0 ? COLORS.teal : COLORS.pink }}>
              {totalBet}
            </div>
          </div>
          <div style={{ fontSize: 12, color: betDiff === 0 ? COLORS.teal : COLORS.pink }}>
            {betDiff === 0 ? "✓ 配分OK" : betDiff > 0 ? `残り ${betDiff}点 未配分` : `${-betDiff}点 超過`}
          </div>
          <div style={{ width: 1, height: 32, background: COLORS.line, marginLeft: "auto" }} />
          <div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>担当アイドル</div>
            <select value={selectedIdol} onChange={(e) => { setSelectedIdol(e.target.value); setResult(null); }} style={{ padding: "6px 8px", fontSize: 13 }}>
              {IDOL_POOL.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 10, fontSize: 12, color: COLORS.muted, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, background: COLORS.front, border: `1px solid ${COLORS.line}`, borderRadius: 3, display: "inline-block" }} />
            前半予想(1〜12曲目)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, background: COLORS.back, border: `1px solid ${COLORS.line}`, borderRadius: 3, display: "inline-block" }} />
            後半予想(13〜24曲目)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, background: COLORS.cardAlt, border: `1px solid ${COLORS.line}`, borderRadius: 3, display: "inline-block" }} />
            中央FREE(前半/後半の区切り)
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 28 }}>
          {board.map((song, i) => {
            const group = groupOf(i);
            const isCenter = i === 12;
            const isOpening = i === 0;
            const isEncore = i === 24;
            const special = isOpening || isEncore;
            const bgColor = isCenter ? COLORS.cardAlt : group === "front" ? COLORS.front : COLORS.back;

            let hitMark = null;
            if (result && !isCenter) {
              const isHit = isOpening ? result.openingHit
                : isEncore ? result.encoreHit
                : (group === "front"
                    ? correctSetlist.map(e=>e.song).slice(0,12).includes(song)
                    : correctSetlist.map(e=>e.song).slice(12,24).includes(song));
              hitMark = isHit ? "●" : "—";
            }

            return (
              <div key={i} style={{
                position: "relative",
                aspectRatio: "1 / 1",
                background: bgColor,
                border: special ? `1.5px solid ${COLORS.gold}` : `1px solid ${COLORS.line}`,
                borderRadius: 8,
                boxShadow: special ? `0 0 0 3px rgba(244,201,93,0.12)` : "none",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: 6,
              }}>
                {special && (
                  <div className="mono-font" style={{
                    position: "absolute", top: 4, fontSize: 9,
                    color: COLORS.gold, letterSpacing: "0.1em",
                  }}>
                    {isOpening ? "OPENING" : "ENCORE"}
                  </div>
                )}
                {!isCenter && !special && (
                  <div className="mono-font" style={{
                    position: "absolute", top: 3, left: 5, fontSize: 8, color: COLORS.muted, letterSpacing: "0.05em",
                  }}>
                    {group === "front" ? "前半" : "後半"}
                  </div>
                )}
                {isCenter ? (
                  <div className="display-font" style={{ fontSize: 20, color: COLORS.muted }}>FREE</div>
                ) : (
                  <select
                    value={song || ""}
                    onChange={(e) => updateCell(i, e.target.value)}
                    style={{ width: "100%", fontSize: 11, padding: "4px 2px", marginTop: special ? 12 : 10 }}
                  >
                    <option value="">未選択</option>
                    {SONG_POOL.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                {hitMark && (
                  <div style={{
                    position: "absolute", bottom: 4, right: 6, fontSize: 13,
                    color: hitMark === "●" ? COLORS.teal : COLORS.pink,
                  }}>
                    {hitMark}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          marginBottom: 28, padding: 18, background: COLORS.card,
          borderRadius: 10, border: `1px solid ${COLORS.line}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <h2 className="display-font" style={{ fontSize: 22, margin: 0 }}>SNS共有用テキスト</h2>
            <button onClick={generateShareText} style={{
              background: COLORS.teal, color: "#0c231f", border: "none",
              borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700,
            }}>
              予想一覧を生成
            </button>
          </div>
          <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 8 }}>
            25マスの予想(＋判定済みならスコアも)をテキスト化する。判定前でも生成できる。
          </p>
          {shareError && <div style={{ color: COLORS.pink, fontSize: 13, marginTop: 6 }}>{shareError}</div>}
          {shareText && (
            <div style={{ marginTop: 14 }}>
              <textarea
                readOnly
                value={shareText}
                rows={14}
                style={{
                  width: "100%", boxSizing: "border-box", fontSize: 13, padding: 12,
                  background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.line}`,
                  borderRadius: 8, resize: "vertical", fontFamily: "'Inter', sans-serif", lineHeight: 1.6,
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <button onClick={copyShareText} style={{
                  background: COLORS.gold, color: "#221a08", border: "none",
                  borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700,
                }}>
                  コピー
                </button>
                {copied && <span style={{ color: COLORS.teal, fontSize: 12 }}>✓ コピーしました</span>}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 28 }}>
          <h2 className="display-font" style={{ fontSize: 22, margin: "0 0 12px" }}>ライン別ベット</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 10 }}>
            {LINES.map((line) => (
              <div key={line.id} style={{
                background: COLORS.card, border: `1px solid ${COLORS.line}`,
                borderRadius: 8, padding: "8px 10px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              }}>
                <span style={{ fontSize: 13, color: COLORS.muted }}>{line.label}</span>
                <input
                  type="number" min={0} step={5}
                  value={bets[line.id]}
                  onChange={(e) => updateBet(line.id, e.target.value)}
                  style={{ width: 56, padding: "4px 6px", fontSize: 13, textAlign: "right" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{
          marginBottom: 28, padding: 18, background: COLORS.card,
          borderRadius: 10, border: `1px solid ${COLORS.line}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <h2 className="display-font" style={{ fontSize: 22, margin: 0 }}>正解セトリ(テスト用ダミー)</h2>
            <button onClick={generateDummySetlist} style={{
              background: COLORS.gold, color: "#221a08", border: "none",
              borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700,
            }}>
              ダミー正解セトリを生成
            </button>
          </div>
          {correctSetlist && (
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>
              <div>
                <div style={{ color: COLORS.gold, marginBottom: 6 }}>前半(1〜12曲目)</div>
                <ol style={{ margin: 0, paddingLeft: 18, color: COLORS.muted }}>
                  {correctSetlist.slice(0, 12).map((e, i) => (
                    <li key={i} style={{ color: i === 0 ? COLORS.gold : COLORS.muted }}>
                      {e.song} <span style={{ opacity: 0.7 }}>({e.members.join("・")})</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div style={{ color: COLORS.gold, marginBottom: 6 }}>後半(13〜24曲目)</div>
                <ol start={13} style={{ margin: 0, paddingLeft: 22, color: COLORS.muted }}>
                  {correctSetlist.slice(12, 24).map((e, i) => (
                    <li key={i} style={{ color: i === 11 ? COLORS.gold : COLORS.muted }}>
                      {e.song} <span style={{ opacity: 0.7 }}>({e.members.join("・")})</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ color: COLORS.pink, fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <button onClick={judge} style={{
            background: COLORS.teal, color: "#0c231f", border: "none",
            borderRadius: 8, padding: "12px 22px", fontSize: 15, fontWeight: 700,
          }}>
            判定する
          </button>
          <button onClick={resetAll} style={{
            background: "transparent", color: COLORS.muted, border: `1px solid ${COLORS.line}`,
            borderRadius: 8, padding: "12px 18px", fontSize: 14,
          }}>
            リセット
          </button>
        </div>

        {result && (
          <div style={{
            padding: 20, background: COLORS.card, borderRadius: 10,
            border: `1px solid ${COLORS.gold}`,
          }}>
            <h2 className="display-font" style={{ fontSize: 24, margin: "0 0 4px" }}>判定結果</h2>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
              担当アイドル: <span style={{ color: COLORS.gold }}>{selectedIdol}</span>
              (BINGO成立ラインの担当曲マス1つにつきスコア×2)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
              <thead>
                <tr style={{ color: COLORS.muted, textAlign: "left" }}>
                  <th style={{ padding: "4px 6px" }}>ライン</th>
                  <th>ベット</th>
                  <th>的中数</th>
                  <th>結果</th>
                  <th>担当曲</th>
                  <th>払戻</th>
                </tr>
              </thead>
              <tbody>
                {result.lineResults.map((l) => (
                  <tr key={l.id} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: "6px" }}>{l.label}</td>
                    <td className="mono-font">{l.bet}</td>
                    <td className="mono-font">{l.hitCount}/5</td>
                    <td style={{
                      color: l.status === "BINGO" ? COLORS.gold : l.status === "一部的中" ? COLORS.teal : COLORS.pink,
                      fontWeight: 600,
                    }}>
                      {l.status}
                    </td>
                    <td className="mono-font">{l.status === "BINGO" ? `${l.tantouCount}マス (×${Math.pow(2,l.tantouCount)})` : "-"}</td>
                    <td className="mono-font">{l.payout}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, marginBottom: 14 }}>
              <div>ライン精算小計: <span className="mono-font" style={{ color: COLORS.text }}>{result.subtotal}点</span></div>
              <div>OPENING的中: <span style={{ color: result.openingHit ? COLORS.gold : COLORS.muted }}>{result.openingHit ? "○ (×2)" : "×"}</span></div>
              <div>ENCORE的中: <span style={{ color: result.encoreHit ? COLORS.gold : COLORS.muted }}>{result.encoreHit ? "○ (×2)" : "×"}</span></div>
            </div>

            <div style={{
              padding: "16px 20px", background: COLORS.bg, borderRadius: 8,
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
            }}>
              <span className="display-font" style={{ fontSize: 18, color: COLORS.muted }}>最終持ち点</span>
              <span className="mono-font" style={{ fontSize: 36, fontWeight: 700, color: COLORS.gold }}>
                {result.finalTotal}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
