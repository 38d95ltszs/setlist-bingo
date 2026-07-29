# CLAUDE.md

このファイルは、Claude Code がこのリポジトリで作業する際のガイドです。

## プロジェクト概要

**セトリ予想ビンゴ** ― ライブのセットリストを3×3ビンゴで予想し、倍率別にジュエルを賭けて得点を競うゲーム。

- 公開URL: https://38d95ltszs.github.io/setlist-bingo/
- リポジトリ: https://github.com/38d95ltszs/setlist-bingo
- 構成: フロントエンドは `index.html` 1ファイル(ビルド不要、素のHTML/CSS/JS)。GitHub Pagesでそのまま公開。バックエンドはSupabase(認証・DB・RLS)。サーバーは持たない
- ビルドツール・パッケージマネージャは無し(`package.json`なし)。ローカル確認は `python3 -m http.server` などで静的配信すれば十分

仕様・使い方の詳細は `README.md` に全て書かれている。**コードの挙動について迷ったら、まず`README.md`を読むこと。**

## ファイル構成

```
index.html                アプリ本体。画面・ロジック・Supabase接続設定すべてを含む単一ファイル
casts-manifest.json        担当アイドルJSON一覧の目次(idとfileパスの対応表)
casts/                     担当アイドル一覧の実データ(アイドル名+声優CV)。大会ごとに複数
  casts-data.json            学園アイドルマスター
  casts-data-sc.json          シャイニーカラーズ
  casts-data-yakudou.json     DAY1 YAKUDOU用
  casts-data-zesshou.json     DAY2 ZESSHOU用
  casts-data-kyoumei.json     DAY3 KYOUMEI用
songs-manifest.json        候補曲JSON一覧の目次
songs/                     候補曲リストの実データ。大会ごとに複数
  songs-data.json             全ブランド共通(1963曲)
  songs-data-gaku.json        学園アイドルマスターのみ(93曲)
  songs-data-sc.json          シャイニーカラーズのみ(235曲)
supabase-schema.sql        Supabaseに流し込むDDL・RLSポリシー・トレンド集計関数
README.md                  仕様・セットアップ手順・使い方
banner.png                 ログイン後トップのバナー画像
```

**重要**: `index.html`は`casts-manifest.json`/`songs-manifest.json`をリポジトリRootから相対パス(`./casts-manifest.json`など)で読み込み、その中の`file`値(`casts/casts-data-xxx.json`のようにフォルダ込みの相対パス)でさらに実データを読み込む。新しい候補曲リスト/担当アイドル一覧を追加する場合は、①`casts/`または`songs/`にJSONを追加し、②対応するmanifestに`{id, label, file}`を追記する。`index.html`本体の変更は不要。

## 主要な設定値(`index.html`内、`<script type="module">`冒頭)

```js
const SUPABASE_URL = "...";
const SUPABASE_ANON_KEY = "...";       // anon keyは公開前提の値。保護はRLSが担う
const FAKE_EMAIL_DOMAIN = "gakumas-bingo.local";
const SUPER_ADMIN_LOGIN_ID = "potchim"; // 大会作成ができる唯一の管理者ログインID
```

## セキュリティ上、最も重要な申し送り

`supabase-schema.sql`の`events insert admin only`ポリシーは、`SUPER_ADMIN_LOGIN_ID`と`FAKE_EMAIL_DOMAIN`から合成される固定メールアドレス(現在は`potchim@gakumas-bingo.local`)を`auth.email()`で直接照合することで、大会作成を管理者1人に制限している。

```sql
create policy "events insert admin only"
  on public.events for insert
  with check (auth.email() = 'potchim@gakumas-bingo.local');
```

**`index.html`側の`SUPER_ADMIN_LOGIN_ID`または`FAKE_EMAIL_DOMAIN`を変更した場合は、このSQLの照合文字列も必ず同時に変更し、Supabase側のSQL Editorで再実行すること。** ここがズレると「アプリ上はボタンが隠れているだけで、実際は誰でも大会を作成できてしまう」状態に戻る(過去に実際に発生し、指摘を受けて修正した脆弱性)。`supabase-schema.sql`をリポジトリにpushしただけでは本番のSupabaseには反映されない。Supabase側で手動実行して初めて有効になる点に注意。

このアプリはサーバーを持たない構成のため、データ保護は全面的にSupabaseのRLSに依存している。フロントのHTML/JSはブラウザの開発者ツールで誰でも書き換え・直接API呼び出しができる前提で設計されており、「見た目のボタンを隠す」ことと「実際にDBへの操作を制限する」ことは常に別物として扱うこと。

## データの整合性に関する注意(継続的な確認事項)

正解セトリCSV(管理タブから登録する`曲名,歌唱者`形式)の曲名は、その大会が使っている候補曲リスト(`songs-data-*.json`)の曲名と**完全一致**していないと的中判定されない。フランチャイズ名の括弧付記(例:「Love & Joy (学園)」)などの表記ゆれに注意。大会ごとに正解セトリを登録する際は毎回確認すること。

## 未確定・保留中の項目

- DAY3(KYOUMEI)正解セトリの声優名変換で、「バックダンス: 〇〇」のような注記付き括弧内の人物を歌唱者(担当曲ボーナス対象)として含めるかは、ユーザーの明示確認がまだ取れていない仮判断。確定させる場合は本人に確認すること
- 同じくDAY3で、CSV原文のカンマ抜け(区切り漏れ)を手動補完した箇所がある。正誤の再確認は未実施

## 開発の経緯(要約)

1. 5×5(25マス)ビンゴとして開発開始 → 難易度が高すぎたため3×3(9マス)+8ラインに縮小
2. 倍率をマスター(×765)/プロ(×8)/レギュラー(×4)の3グループに整理
3. 「保存」と「確定」を統合し、フロート型の保存ボタン1つに集約(締切までは何度でも再調整可能)
4. 候補曲・担当アイドルを大会ごとに複数JSONから選べる仕組みに変更(マニフェスト方式)
5. RLSポリシーの監査で大会作成権限の穴を発見・修正(上記セキュリティ項参照)
6. チュートリアル・バナー・自動採点一括処理・トレンド集計などを追加
7. データファイルをルート直下から`casts/`・`songs/`フォルダに整理(本ファイル作成と同時期の変更)
