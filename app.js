import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, FAKE_EMAIL_DOMAIN } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- ダミー楽曲プール(本番では実際のセトリ候補曲に差し替え予定) ----
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

// ---- ダミー担当アイドルプール(本番ではCSVの歌唱メンバー列から生成) ----
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

// ---------------- 状態 ----------------
let board = Array(25).fill(null);
let bets = {};
LINES.forEach((l) => (bets[l.id] = DEFAULT_BET));
let points = INITIAL_POINTS;
let selectedIdol = IDOL_POOL[0];
let correctSetlist = null; // [{song, members:[...]}]
let result = null;
let currentUser = null;
let authMode = "login"; // or "signup"

// ---------------- ユーティリティ ----------------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function groupOf(i) {
  if (i === 12) return "free";
  if (i < 12) return "front";
  return "back";
}
function fakeEmail(id) {
  return `${id.trim().toLowerCase()}@${FAKE_EMAIL_DOMAIN}`;
}
function songMembersMap() {
  const map = {};
  if (correctSetlist) correctSetlist.forEach((e) => (map[e.song] = e.members));
  return map;
}

// ================= 認証 =================
const authScreen = document.getElementById("auth-screen");
const gameScreen = document.getElementById("game-screen");
const authIdInput = document.getElementById("auth-id");
const authPasswordInput = document.getElementById("auth-password");
const authError = document.getElementById("auth-error");
const authSubmitBtn = document.getElementById("auth-submit");
const authToggleBtn = document.getElementById("auth-toggle-mode");

authToggleBtn.addEventListener("click", () => {
  authMode = authMode === "login" ? "signup" : "login";
  authSubmitBtn.textContent = authMode === "login" ? "ログイン" : "新規登録";
  authToggleBtn.textContent = authMode === "login" ? "新規登録はこちら" : "ログインはこちら";
  authError.classList.add("hidden");
});

authSubmitBtn.addEventListener("click", async () => {
  authError.classList.add("hidden");
  const id = authIdInput.value.trim();
  const password = authPasswordInput.value;
  if (!id || !password) {
    showAuthError("IDとパスワードを入力してください。");
    return;
  }
  if (password.length < 6) {
    showAuthError("パスワードは6文字以上にしてください。");
    return;
  }

  const email = fakeEmail(id);
  authSubmitBtn.disabled = true;
  try {
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        // Confirm emailがONのままだとここに来る
        showAuthError("登録はできましたが、自動ログインできませんでした。Supabase側で「Confirm email」がOFFになっているか確認してください。");
        authSubmitBtn.disabled = false;
        return;
      }
      await onLoggedIn(data.session.user, id);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await onLoggedIn(data.user, id);
    }
  } catch (e) {
    showAuthError(translateAuthError(e.message));
  } finally {
    authSubmitBtn.disabled = false;
  }
});

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove("hidden");
}

function translateAuthError(msg) {
  if (/Invalid login credentials/i.test(msg)) return "IDまたはパスワードが違います。";
  if (/already registered/i.test(msg)) return "このIDはすでに登録されています。ログインしてください。";
  return msg;
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  gameScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
  authIdInput.value = "";
  authPasswordInput.value = "";
});

async function onLoggedIn(user, id) {
  currentUser = { id: user.id, label: id };
  document.getElementById("whoami-id").textContent = id;
  await loadSave();
  authScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  renderAll();
}

// 既存セッションがあれば自動ログイン
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    const email = data.session.user.email || "";
    const id = email.split("@")[0];
    await onLoggedIn(data.session.user, id);
  }
})();

// ================= Supabase 保存/読込 =================
async function loadSave() {
  const { data, error } = await supabase
    .from("game_saves")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("load error", error);
    return;
  }
  if (data) {
    board = data.board || Array(25).fill(null);
    bets = data.bets || Object.fromEntries(LINES.map((l) => [l.id, DEFAULT_BET]));
    points = typeof data.points === "number" ? data.points : INITIAL_POINTS;
    selectedIdol = data.selected_idol || IDOL_POOL[0];
  } else {
    board = Array(25).fill(null);
    bets = Object.fromEntries(LINES.map((l) => [l.id, DEFAULT_BET]));
    points = INITIAL_POINTS;
    selectedIdol = IDOL_POOL[0];
  }
  result = null;
  correctSetlist = null;
}

async function saveGame() {
  const saveStatus = document.getElementById("save-status");
  const { error } = await supabase.from("game_saves").upsert({
    user_id: currentUser.id,
    board,
    bets,
    points,
    selected_idol: selectedIdol,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("save error", error);
    saveStatus.textContent = "保存に失敗しました: " + error.message;
    saveStatus.classList.remove("hidden");
    return;
  }
  saveStatus.textContent = "✓ 保存しました";
  saveStatus.classList.remove("hidden");
  setTimeout(() => saveStatus.classList.add("hidden"), 2000);
}

// ================= 描画 =================
function renderAll() {
  renderIdolSelect();
  renderBoard();
  renderBetGrid();
  updatePointsAndBetTotal();
  renderSetlistDisplay();
  renderResult();
}

function renderIdolSelect() {
  const sel = document.getElementById("idol-select");
  sel.innerHTML = "";
  IDOL_POOL.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === selectedIdol) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", (e) => {
    selectedIdol = e.target.value;
    result = null;
    renderResult();
  });
}

function renderBoard() {
  const boardEl = document.getElementById("board");
  boardEl.innerHTML = "";
  const members = songMembersMap();

  for (let i = 0; i < 25; i++) {
    const group = groupOf(i);
    const isCenter = i === 12;
    const isOpening = i === 0;
    const isEncore = i === 24;
    const special = isOpening || isEncore;

    const cell = document.createElement("div");
    cell.className = "cell " + (isCenter ? "center" : group) + (special ? " special" : "");

    if (special) {
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.textContent = isOpening ? "OPENING" : "ENCORE";
      cell.appendChild(tag);
    }
    if (!isCenter && !special) {
      const halfTag = document.createElement("div");
      halfTag.className = "half-tag";
      halfTag.textContent = group === "front" ? "前半" : "後半";
      cell.appendChild(halfTag);
    }

    if (isCenter) {
      const label = document.createElement("div");
      label.className = "free-label";
      label.textContent = "FREE";
      cell.appendChild(label);
    } else {
      const select = document.createElement("select");
      select.style.marginTop = special ? "12px" : "10px";
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "未選択";
      select.appendChild(emptyOpt);
      SONG_POOL.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        if (board[i] === s) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", (e) => {
        board[i] = e.target.value || null;
        result = null;
        renderResult();
      });
      cell.appendChild(select);
    }

    if (result && !isCenter) {
      const song = board[i];
      let isHit;
      if (isOpening) isHit = result.openingHit;
      else if (isEncore) isHit = result.encoreHit;
      else {
        const songs = correctSetlist.map((e) => e.song);
        isHit = group === "front" ? songs.slice(0, 12).includes(song) : songs.slice(12, 24).includes(song);
      }
      const mark = document.createElement("div");
      mark.className = "hit-mark";
      mark.style.color = isHit ? "var(--teal)" : "var(--pink)";
      mark.textContent = isHit ? "●" : "—";
      cell.appendChild(mark);
    }

    boardEl.appendChild(cell);
  }
}

function renderBetGrid() {
  const grid = document.getElementById("bet-grid");
  grid.innerHTML = "";
  LINES.forEach((line) => {
    const row = document.createElement("div");
    row.className = "bet-row";
    const label = document.createElement("span");
    label.textContent = line.label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "5";
    input.value = bets[line.id];
    input.addEventListener("input", (e) => {
      bets[line.id] = e.target.value === "" ? "" : Number(e.target.value);
      result = null;
      updatePointsAndBetTotal();
      renderResult();
    });
    row.appendChild(label);
    row.appendChild(input);
    grid.appendChild(row);
  });
}

function updatePointsAndBetTotal() {
  document.getElementById("points-value").textContent = points;
  const total = Object.values(bets).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalEl = document.getElementById("bet-total-value");
  totalEl.textContent = total;
  const statusEl = document.getElementById("bet-status");
  const diff = points - total;
  totalEl.style.color = diff === 0 ? "var(--teal)" : "var(--pink)";
  statusEl.style.color = diff === 0 ? "var(--teal)" : "var(--pink)";
  statusEl.textContent = diff === 0 ? "✓ 配分OK" : diff > 0 ? `残り ${diff}点 未配分` : `${-diff}点 超過`;
}

function renderSetlistDisplay() {
  const el = document.getElementById("setlist-display");
  if (!correctSetlist) {
    el.innerHTML = "";
    return;
  }
  function listHtml(entries, startNum) {
    return `<ol start="${startNum}" style="margin:0; padding-left:20px; color:var(--muted);">${entries
      .map((e, i) => `<li style="color:${(startNum === 1 && i === 0) || (startNum === 13 && i === entries.length - 1) ? "var(--gold)" : "var(--muted)"};">${e.song} <span style="opacity:0.7;">(${e.members.join("・")})</span></li>`)
      .join("")}</ol>`;
  }
  el.innerHTML = `
    <div class="setlist-cols">
      <div>
        <div class="col-title">前半(1〜12曲目)</div>
        ${listHtml(correctSetlist.slice(0, 12), 1)}
      </div>
      <div>
        <div class="col-title">後半(13〜24曲目)</div>
        ${listHtml(correctSetlist.slice(12, 24), 13)}
      </div>
    </div>
  `;
}

function renderResult() {
  const box = document.getElementById("result-box");
  if (!result) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  const rows = result.lineResults
    .map(
      (l) => `
      <tr>
        <td>${l.label}</td>
        <td class="mono-font">${l.bet}</td>
        <td class="mono-font">${l.hitCount}/5</td>
        <td style="color:${l.status === "BINGO" ? "var(--gold)" : l.status === "一部的中" ? "var(--teal)" : "var(--pink)"}; font-weight:600;">${l.status}</td>
        <td class="mono-font">${l.status === "BINGO" ? `${l.tantouCount}マス (×${Math.pow(2, l.tantouCount)})` : "-"}</td>
        <td class="mono-font">${l.payout}</td>
      </tr>`
    )
    .join("");

  box.innerHTML = `
    <h2 class="display-font" style="font-size:24px; margin:0 0 4px;">判定結果</h2>
    <div style="font-size:12px; color:var(--muted); margin-bottom:14px;">
      担当アイドル: <span style="color:var(--gold);">${selectedIdol}</span>
      (BINGO成立ラインの担当曲マス1つにつきスコア×2)
    </div>
    <table>
      <thead><tr><th>ライン</th><th>ベット</th><th>的中数</th><th>結果</th><th>担当曲</th><th>払戻</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="flex-gap" style="font-size:13px; margin-bottom:14px;">
      <div>ライン精算小計: <span class="mono-font" style="color:var(--text);">${result.subtotal}点</span></div>
      <div>OPENING的中: <span style="color:${result.openingHit ? "var(--gold)" : "var(--muted)"};">${result.openingHit ? "○ (×2)" : "×"}</span></div>
      <div>ENCORE的中: <span style="color:${result.encoreHit ? "var(--gold)" : "var(--muted)"};">${result.encoreHit ? "○ (×2)" : "×"}</span></div>
    </div>
    <div class="final-total">
      <span class="label">最終持ち点</span>
      <span class="value">${result.finalTotal}</span>
    </div>
  `;
}

// ================= アクション =================
document.getElementById("gen-setlist-btn").addEventListener("click", () => {
  const chosenSongs = shuffle(SONG_POOL).slice(0, 24);
  correctSetlist = chosenSongs.map((song) => {
    const memberCount = 1 + Math.floor(Math.random() * 2);
    const members = shuffle(IDOL_POOL).slice(0, memberCount);
    return { song, members };
  });
  result = null;
  renderSetlistDisplay();
  renderResult();
});

document.getElementById("judge-btn").addEventListener("click", () => {
  const errorEl = document.getElementById("judge-error");
  errorEl.classList.add("hidden");

  const totalBet = Object.values(bets).reduce((s, v) => s + (Number(v) || 0), 0);
  const filledCount = board.filter((s, i) => i === 12 || s).length;

  if (totalBet !== points) {
    errorEl.textContent = `ベット合計が現在の持ち点(${points}点)と一致していません(現在 ${totalBet}点)。`;
    errorEl.classList.remove("hidden");
    return;
  }
  if (filledCount < 25) {
    errorEl.textContent = "すべてのマスに曲を入力してください(中央はフリー)。";
    errorEl.classList.remove("hidden");
    return;
  }
  if (!correctSetlist) {
    errorEl.textContent = "先に「ダミー正解セトリを生成」を押してください。";
    errorEl.classList.remove("hidden");
    return;
  }

  const songs = correctSetlist.map((e) => e.song);
  const front = songs.slice(0, 12);
  const back = songs.slice(12, 24);
  const members = songMembersMap();

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
      tantouCount = line.idx.filter((i) => i !== 12 && hits[i] && members[board[i]]?.includes(selectedIdol)).length;
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

  result = { lineResults, subtotal, openingHit, encoreHit, multiplier, finalTotal };
  points = finalTotal;
  renderBoard();
  renderResult();
  updatePointsAndBetTotal();
  saveGame();
});

document.getElementById("save-btn").addEventListener("click", saveGame);

document.getElementById("new-round-btn").addEventListener("click", () => {
  board = Array(25).fill(null);
  bets = Object.fromEntries(LINES.map((l) => [l.id, DEFAULT_BET]));
  correctSetlist = null;
  result = null;
  renderAll();
  saveGame();
});

// ---- SNS共有 ----
document.getElementById("share-generate-btn").addEventListener("click", () => {
  const shareError = document.getElementById("share-error");
  const shareBox = document.getElementById("share-box");
  shareError.classList.add("hidden");

  const filledCount = board.filter((s, i) => i === 12 || s).length;
  if (filledCount < 25) {
    shareError.textContent = "すべてのマスに曲を入力してから生成してください(中央はフリー)。";
    shareError.classList.remove("hidden");
    return;
  }

  const opening = board[0];
  const encore = board[24];
  const frontRest = board.slice(1, 12);
  const backRest = board.slice(13, 24);

  let text = "🎫 学園セトリ予想ビンゴ 🎫\n\n";
  text += `🎤 1曲目(OPENING)予想: ${opening}\n\n`;
  text += "▼前半(1〜12曲目)予想\n";
  frontRest.forEach((s) => (text += `・${s}\n`));
  text += "\n▼後半(13〜24曲目)予想\n";
  backRest.forEach((s) => (text += `・${s}\n`));
  text += `\n🎉 ラスト曲(ENCORE)予想: ${encore}\n`;
  text += `\n担当アイドル: ${selectedIdol}\n`;

  if (result) {
    const bingoCount = result.lineResults.filter((l) => l.status === "BINGO").length;
    text += `\n─────\n🏆 判定結果\n`;
    text += `持ち点: ${INITIAL_POINTS} → ${result.finalTotal}点\n`;
    text += `BINGO成立ライン: ${bingoCount}本\n`;
  }
  text += "\n#学マス #セトリ予想ビンゴ";

  document.getElementById("share-text-area").value = text;
  shareBox.classList.remove("hidden");
  document.getElementById("share-copied").classList.add("hidden");
});

document.getElementById("share-copy-btn").addEventListener("click", async () => {
  const textarea = document.getElementById("share-text-area");
  try {
    await navigator.clipboard.writeText(textarea.value);
  } catch {
    textarea.select();
    document.execCommand("copy");
  }
  const copied = document.getElementById("share-copied");
  copied.classList.remove("hidden");
  setTimeout(() => copied.classList.add("hidden"), 1800);
});
