# アスベスト調査推奨度チェック 最終QA記録

## 固定した公開候補

- 公開アセット版: `20260729-16`
- `check-ai.js` SHA-256: `4bc855734b597c54ca898de5fd3f39d21b38ba3011ddfa1188b8a386fa09bf29`
- `check.js` SHA-256: `6a1278bad3b679c4c2829a535bf0d6457a9daf542cb12d9ba60821ce0d754eac`
- TinyCLIPモデル SHA-256: `cd682e9bd91142c5bc74ac53ac5cb5a87e0ee16a95ca33ffc902b8d4a3e1283a`

## ブラウザ実機経路による最終結果

公開用HTML、公開用JavaScript、ブラウザ内WASMモデル、写真アップロード、結果集計までを通して検証した。

| セット | 結果 |
|---|---:|
| 重点回帰ケース | 27 / 27 PASS |
| 記事・サイト用画像 | 74 / 74 PASS |
| HSE公式建材画像 | 32 / 32 PASS |
| 実サイト・ブログ等のスクリーンショット | 19 / 19 PASS |
| 複数写真の混在ケース | 5 / 5 PASS |
| ユーザー指定サンプル | 3 / 3 PASS |
| 合計 | 160 / 160 PASS |

重複を除いた画像は125点。複数写真セットでは、建材写真とスクリーンショットの混在、スクリーンショットのみ、最大4枚の混在を確認した。

## 指定サンプルの結果

- 吹付材見本: `推奨度5 / 類似度 高`
- 明るいフォーム画面: `判定不能`
- 暗色の検索結果画面: `判定不能`

## 今回追加した主な回帰ケース

- 明確な吹付け材、剥離した吹付け被覆、配管保温材、グローブバッグ
- ボード材の穿孔、軒天、スレート屋根、天井パネル、床材
- 裸の金属煙突、一般断熱材などの見た目が似る非アスベスト材料
- 作業員・防護具、測定器、除去機材、密封廃棄物、研究室、図面確認
- 明るいWeb画面、暗い検索結果、縦長画面、カード、管理画面

## 製品上の限界

この機能は写真と任意入力から「調査を勧める度合い」を補助的に示すもので、アスベストの有無や含有率を確定するものではない。写真だけで含有なしとは判断せず、工事時は法令・条例に従った事前調査と必要な分析を行う。

画像認識には未知画像での誤判定可能性が残る。公開後も問い合わせで得られた誤判定例を個人情報を含まない形で回帰セットへ追加し、同一手順で再検証する。

## 最終結果ファイル

- `work/check-benchmark/tinyclip-critical-final-10/benchmark-results.json`
- `work/check-benchmark/tinyclip-article-assets-release-final-fixed/benchmark-results.json`
- `work/check-benchmark/tinyclip-hse-release-final-fixed/benchmark-results.json`
- `work/check-benchmark/tinyclip-screenshots-release-final-fixed/benchmark-results.json`
- `work/check-benchmark/tinyclip-multi-release-final-fixed/benchmark-results.json`
- `work/check-benchmark/tinyclip-user-release-final-fixed/benchmark-results.json`
