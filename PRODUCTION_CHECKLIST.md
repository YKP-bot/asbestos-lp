# 本番切り替えチェックリスト

## 設定

- [ ] `SITE_URL` が会社公式ドメインになっている
- [ ] `SITE_URL` に末尾スラッシュがない
- [ ] `BASE_PATH` が `/asbestos` になっている
- [ ] 本番ビルド時の `ENVIRONMENT` が `production` になっている
- [ ] `LP_URL` が既存の相談LP `https://lp.sakuraigr.co.jp/` を指している
- [ ] `INCLUDE_LP_COPY` が `false` になっている
- [ ] `example.com` が生成物に残っていない

## SEO

- [ ] 全HTMLの robots が `index, follow`
- [ ] canonical が各ページ自身の本番URL
- [ ] `og:url` が canonical と一致
- [ ] `og:image` が本番ドメインの `/asbestos/` 配下
- [ ] JSON-LD内のURLが本番ドメイン
- [ ] Article、FAQPage、BreadcrumbList、WebSite等のJSON-LDが構文エラーなし
- [ ] ルート `sitemap.xml` に既存LPと全公開ページが1回ずつ掲載されている（現在435 URL）
- [ ] `/asbestos/sitemap.xml` にアスベスト領域の全公開ページが1回ずつ掲載されている（現在434 URL）
- [ ] 各記事の `lastmod` が記事データの `modified` と一致している
- [ ] `sitemap.xml` がUTF-8・絶対URL・Sitemap 0.9名前空間のXMLになっている
- [ ] `rss.xml` に全コラム、47都道府県ガイド、東京都・神奈川県・埼玉県・千葉県・大阪府・愛知県の309自治体ガイドが掲載されている
- [ ] title・descriptionがページごとに重複していない

## 表示とリンク

- [ ] `/asbestos/` が情報サイトとして表示される
- [ ] `/asbestos/check/` で注意事項の確認後に写真1〜4枚を選択できる
- [ ] 簡易チェックで調査推奨度・画像上の類似度・判定の確信度が表示される
- [ ] 建材が確認できない画像では「判定不能」になり、含有なし・調査不要と断定しない
- [ ] 吹付け状・繊維状の建材写真で調査推奨度が「高」または「最高」になる
- [ ] WebページやSNS等のスクリーンショットで「判定不能」と理由が表示される
- [ ] 建材写真と判定不能写真を同時に選んだ場合、確認できた写真だけで判定され、除外枚数が表示される
- [ ] PC・スマホのヘッダーから「写真で簡易チェック」へ移動できる
- [ ] 相談CTAから既存LP `https://lp.sakuraigr.co.jp/` へ移動できる
- [ ] 記事一覧から全記事へ移動できる
- [ ] 記事・地域・FAQから相談LPへ移動できる
- [ ] 東京都ページで62自治体を検索でき、23区・多摩26市・西多摩・島しょの各ページへ移動できる
- [ ] 神奈川県ページで33自治体を検索でき、5地域分類をスマホでは「＋」で開閉できる
- [ ] 埼玉県ページで63自治体を検索でき、10地域分類をスマホでは「＋」で開閉できる
- [ ] 千葉県ページで54自治体を検索でき、11地域分類をPC・タブレット・スマホで「＋」から開閉できる
- [ ] 大阪府ページで43自治体（33市・9町・1村）を検索でき、9地域分類をPC・タブレット・スマホで「＋」から開閉できる
- [ ] 愛知県ページで54自治体（38市・14町・2村）を検索でき、名古屋・尾張・海部・知多・西三河・東三河の6地域分類をPC・タブレット・スマホで「＋」から開閉できる
- [ ] 名古屋市の16区が独立URLにならず、名古屋市ページ内で区ごとの窓口・管轄差分を確認できる
- [ ] `content/image-prompts-aichi-municipalities.json` が54件で、`source/images/areas/aichi/` と公開先の愛知県カード画像が54枚ある
- [ ] 愛知県54市町村の住宅形態が表示され、2023年住宅・土地統計調査で非表章の自治体を県平均で補完していない
- [ ] 画像、CSS、JavaScriptがすべて200で返る
- [ ] 内部リンクにNetlifyドメインがない
- [ ] 既存LPは結果受取用 `script.js` の追記以外に、HTML・CSS・PHP・画像・送信先・ルーティングを変更していない

## 相談導線

- [ ] 情報サイト側にフォームや `send.php` が出力されていない
- [ ] PC・スマホの相談CTAが既存LPへ移動する
- [ ] 簡易チェック結果と入力内容のテキストが既存LPの問い合わせ欄へ1回だけ引き継がれる
- [ ] 写真そのものは既存LPへ引き継がれない
- [ ] 既存LP側のフォーム送信を別途テスト済み

## 公開作業

- [ ] `node scripts/assemble-aichi-municipalities.mjs` が54市町村を出力
- [ ] `python scripts/create-tokyo-municipality-images.py --prefecture-slug aichi --expected-count 54` がJSON仕様54件を検証し、WebP 54枚を生成
- [ ] `node scripts/update-housing-stock-stats.mjs` を画像生成後・本番ビルド前に実行
- [ ] `ENVIRONMENT=production`、`OUTPUT_ROOT=release` で `node scripts/build.mjs` が成功
- [ ] 同じ環境変数で `node scripts/check.mjs` が「検証成功」
- [ ] 配置前バックアップを取得
- [ ] `release/asbestos/` を所定の場所へ配置
- [ ] `release/sitemap.xml` と `release/robots.txt` をドメイン直下へ配置
- [ ] 公開した全HTMLで `noindex` がなく、robots が `index, follow` になっている
- [ ] レスポンスヘッダーに `X-Robots-Tag: noindex` がない
- [ ] `https://lp.sakuraigr.co.jp/robots.txt` が `Allow: /` でルートサイトマップを参照している
- [ ] `https://lp.sakuraigr.co.jp/sitemap.xml` が表示でき、既存LPを含む全435 URLを含んでいる
- [ ] `https://lp.sakuraigr.co.jp/asbestos/sitemap.xml` が表示でき、アスベスト領域の全434 URLを含んでいる
- [ ] `/asbestos/assets/ai/` 配下のモデル・ランタイムが200で返り、画像AIが予備判定へフォールバックしていない
- [ ] `https://lp.sakuraigr.co.jp/asbestos/rss.xml` が表示でき、421件（コラム65本＋都道府県47件＋6都府県の自治体309件）を含んでいる
- [ ] 公開後にPC・タブレット・スマホで主要ページを確認
- [ ] Search Consoleで `https://lp.sakuraigr.co.jp/sitemap.xml` を送信
- [ ] Search ConsoleのURL検査で `/asbestos/` をライブテストし、インデックス登録をリクエスト
- [ ] 主要記事もURL検査し、「インデックス登録が可能」になっていることを確認
