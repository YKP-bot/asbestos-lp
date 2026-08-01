# アスベスト調査ナビ 静的公開パッケージ

アスベストとアスベスト事前調査の情報をまとめ、記事・地域・FAQ・写真による簡易チェックから既存の相談LPへ送客する静的サイト生成プロジェクトです。コンテンツは `/asbestos/` 配下へ出力し、サイト全体の `sitemap.xml` と `robots.txt` だけをドメイン直下へ出力します。現在は65本のコラム、47都道府県の地域ガイド、東京都62自治体・神奈川県33自治体・埼玉県63自治体・千葉県54自治体の計212自治体ガイドを収録しています。地域ガイドは、届出先、条例、測定、完了報告、補助制度の適用範囲を自治体の一次情報から分けて掲載します。

## URL構成

| ページ | 本番URL |
|---|---|
| 情報トップ | `https://lp.sakuraigr.co.jp/asbestos/` |
| 相談LP | `https://lp.sakuraigr.co.jp/`（既存LP） |
| 記事一覧 | `https://lp.sakuraigr.co.jp/asbestos/column/` |
| 記事 | `https://lp.sakuraigr.co.jp/asbestos/column/{slug}/` |
| 全国の地域情報 | `https://lp.sakuraigr.co.jp/asbestos/area/` |
| 47都道府県ガイド | `https://lp.sakuraigr.co.jp/asbestos/area/{slug}/` |
| 市区町村ガイド | `https://lp.sakuraigr.co.jp/asbestos/area/{prefecture-slug}/{municipality-slug}/` |
| FAQ | `https://lp.sakuraigr.co.jp/asbestos/faq/` |
| 写真で簡易チェック | `https://lp.sakuraigr.co.jp/asbestos/check/` |
| サイト全体のサイトマップ | `https://lp.sakuraigr.co.jp/sitemap.xml` |
| アスベスト領域のサイトマップ | `https://lp.sakuraigr.co.jp/asbestos/sitemap.xml` |
| RSS | `https://lp.sakuraigr.co.jp/asbestos/rss.xml` |

`/asbestos/` を情報ハブとし、相談導線は `LP_URL` で既存LPへ接続します。既存LP本体はこのパッケージへ複製しません。簡易チェック結果のテキストだけを問い合わせ欄へ引き継ぐため、公開リポジトリの既存 `script.js` には受取処理を追記します。LPの表示、送信先、PHP、画像、ルーティングは変更しません。

## 本番設定

`config/site.config.json` の次の値を変更します。

```json
{
  "SITE_URL": "https://lp.sakuraigr.co.jp",
  "BASE_PATH": "/asbestos",
  "ENVIRONMENT": "production",
  "LP_URL": "https://lp.sakuraigr.co.jp/",
  "LP_LASTMOD": "2026-07-24",
  "INCLUDE_LP_COPY": false
}
```

- `SITE_URL`: 末尾スラッシュなしの本番オリジン
- `BASE_PATH`: 公開先パス。通常は `/asbestos`
- `ENVIRONMENT`: 確認環境は `preview`、本番は `production`
- `LP_URL`: 情報サイトのCTAから遷移する既存LPのURL
- `LP_LASTMOD`: 既存LP本文を最後に大きく更新した日
- `INCLUDE_LP_COPY`: `false` のままにすると既存LPを公開物へ複製しない

`preview` では全HTMLに `noindex, nofollow` を出力し、`robots.txt` でもクロールを拒否します。`production` では `index, follow` と本番サイトマップURLへ切り替わります。本番設定で `example.com` が残っている場合、ビルドはエラーで停止します。

## ビルドと検証

Node.js 18以上で実行します。外部パッケージのインストールは不要です。

```text
node scripts/build.mjs
node scripts/check.mjs
```

通常ビルドでは、本番設定のファイルが `dist/asbestos/` に生成され、ドメイン直下へ配置する `dist/sitemap.xml` と `dist/robots.txt` も同時生成されます。ルートサイトマップには既存LPとアスベスト領域の全公開ページが入り、記事の追加・更新時は記事データの `modified` を `lastmod` へ自動反映します。管理画面のプレビュー更新は明示的に `preview` を指定するため、確認環境だけは引き続き `noindex, nofollow` になります。

## 本番公開手順

1. `config/site.config.json` の `SITE_URL` が `https://lp.sakuraigr.co.jp`、`BASE_PATH` が `/asbestos` であることを確認する。
2. PowerShellで次を実行し、公開専用の `release/asbestos/` を生成する。

```powershell
$env:ENVIRONMENT='production'
$env:OUTPUT_ROOT='release'
node scripts/build.mjs
node scripts/check.mjs
Remove-Item Env:ENVIRONMENT,Env:OUTPUT_ROOT
```

3. `node scripts/check.mjs` が「検証成功」になることを確認する。
4. ZIPで受け渡す場合は、ルートSEOファイルを含めるためプロジェクト直下で次を実行する。

```powershell
Compress-Archive -Path release\* -DestinationPath asbestos-production.zip -Force
```

5. `release/asbestos/` をドキュメントルート直下へ配置し、`release/sitemap.xml` と `release/robots.txt` はドメイン直下へ配置する。ZIPの場合も同じ階層を維持する。
6. 簡易チェック結果を既存LPの問い合わせ欄へ引き継ぐ場合は、同梱済みの受取処理が公開リポジトリ直下の `script.js` に入っていることを確認する。LPのHTML、CSS、PHP、画像、ルーティングは変更しない。
7. 公開URLで情報トップ、LP、記事、地域、FAQ、簡易チェック、画像、CSS、JavaScript、AIモデル、`/sitemap.xml`、`/robots.txt`、RSSが200で返ることを確認する。
8. `PRODUCTION_CHECKLIST.md` を上から順に確認する。

## フォームについて

SEOページは静的HTML・CSS・JavaScriptのみで、フォーム送信機能を持ちません。相談ボタンは `LP_URL` の既存LPへ遷移するため、Netlify Forms / FunctionsやPHPメール送信には依存しません。

## 写真で簡易チェックについて

`/asbestos/check/` は写真1〜4枚と任意情報から「調査推奨度」「画像上の類似度」「判定の確信度」を表示します。これは石綿含有の有無・含有率を判定する機能ではなく、結果だけを根拠に事前調査を省略できません。画像AIは同梱したMITライセンスのTinyCLIPモデルをブラウザで実行し、外部AI APIや有料サービスへ依存しません。判定後は選択写真への参照を破棄し、LPへ引き継ぐのは結果と入力内容のテキストだけです。

画像AIのスコアは、登録した画像表現どうしの相対的な近さを表示用に整理したもので、石綿含有確率や分析精度ではありません。画面キャプチャ、書類、人物・機器・遠景だけの写真、梱包済み廃棄物など、建材表面を確認できない入力は「判定不能」にします。似た外観の別建材もあるため、低い結果でも「石綿なし」「調査不要」とは表示しません。

画像判定の変更時は `scripts/benchmark-check.mjs` を使用し、本番と同じブラウザ・WASM経路で、明確な建材、外観が曖昧な公的資料、似た建材、実際の画面キャプチャ、1〜4枚の混在入力を回帰確認します。

## 千葉県市町村ガイドの再生成

千葉県の調査データを更新した場合は、公開ビルド前に共通形式化と画像生成を順番に実行します。画像スクリプトは54件すべてのJSON仕様を先に書き出して再読込・検証した後、1200×630のWebPを生成します。Python 3、Pillow、`NotoSansJP-VF.ttf` が必要です。

```powershell
node scripts/assemble-kanagawa-saitama-municipalities.mjs
python scripts/create-tokyo-municipality-images.py --prefecture-slug chiba --expected-count 54
```

## ファイル構成

```text
config/site.config.json      URL・環境設定
content/articles*.json      記事データ（複数ファイルを自動統合）
content/article-ranking.json 人気記事ランキングの5件と将来のアクセス集計設定
content/category-relevance.json カテゴリ別記事一覧の関連度順
content/areas.json          47都道府県の名称・slug・既存関連記事の対応
content/prefecture-guides.json  47都道府県の地域差・窓口・補助・公式出典
content/tokyo-municipalities.json  東京都62自治体の窓口・補助・地域特性・公式出典
content/kanagawa-municipalities.json  神奈川県33自治体の窓口・補助・地域特性・公式出典
content/saitama-municipalities.json  埼玉県63自治体の窓口・補助・地域特性・公式出典
content/chiba-municipalities.json  千葉県54自治体の窓口・補助・地域特性・公式出典
content/image-prompts-*-municipalities.json  自治体別カード画像のJSON仕様
content/faq.json            FAQデータ
templates/article.html      共通記事テンプレート
source/lp/                  完成済みLPの参照用複製（INCLUDE_LP_COPY=falseでは出力しない）
source/images/              LP画像の複製
source/images/articles/     記事ごとに生成した固有画像
source/images/areas/tokyo/  東京都62自治体の固有カード画像
source/images/areas/kanagawa/  神奈川県33自治体の固有カード画像
source/images/areas/saitama/  埼玉県63自治体の固有カード画像
source/images/areas/chiba/  千葉県54自治体の固有カード画像
source/seo.css              情報サイト共通CSS
source/site.js              情報サイト共通JavaScript
source/check.css            写真で簡易チェック専用CSS
source/check.js             写真・入力・結果・LP引き継ぎ制御
source/check-ai.js          ブラウザ内画像AI推論
source/ai/                  TinyCLIP・Transformers.js・ONNX Runtime
scripts/build.mjs           静的生成
scripts/check.mjs           公開前検証
scripts/assemble-tokyo-municipalities.mjs  自治体調査データの共通形式化
scripts/assemble-kanagawa-saitama-municipalities.mjs  神奈川・埼玉・千葉の調査データの共通形式化
scripts/create-tokyo-municipality-images.py  JSON仕様作成後に自治体カードを描画
scripts/serve.mjs           ローカル確認用サーバー
dist/asbestos/              生成された公開用ファイル
dist/sitemap.xml            既存LPを含むサイト全体のサイトマップ
dist/robots.txt             ドメイン直下へ配置するクローラー設定
```

公開リポジトリ直下のLPは、簡易チェック結果を問い合わせ欄へ受け取る `script.js` の追記以外は変更しません。
