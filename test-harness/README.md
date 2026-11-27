# 測試工具（只放在這個分支，不進 main、不上線）

無頭瀏覽器開遊戲、用假的時間一格一格走，檢查功能有沒有壞。雲端全部擋掉（離線模式）。

## 怎麼用

1. three.js r158 要先放好（測試機器連不到 CDN）：
   `GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 --branch r158 --filter=blob:none --sparse https://github.com/mrdoob/three.js`
   → `git sparse-checkout set build examples/jsm/utils examples/jsm/loaders examples/jsm/libs examples/jsm/geometries`
   → 把 `build` 和 `examples/jsm` 複製到 `<工作資料夾>/vendor/three/` 底下。
2. 把這個資料夾的檔案複製到 `<工作資料夾>/vid2/`。
3. `cd <工作資料夾>/vid2 && HASH='&nobb&map2' node w2fish.js > out 2>&1 &`（一次只開一個瀏覽器）。
   `REPO=/路徑/tide-village/` 可以指定遊戲的資料夾（預設 /home/claude/tide-village/）。

## 檔案

- `h.js`：開瀏覽器、攔網路、把遊戲裡的東西掛到 `__T`（`__T.ev('程式')` 可以跑任何東西）、`__step(n, ms)` 推進畫面。
- `lib.js`：等遊戲載完、`go(n)` 走 n 格、`snap(檔名)` 截圖（截圖時要一直推進畫面，不然會卡住）。
- `w2fish.js`：新主島釣魚（v922）。
- `w2normfish.js`：一般玩家（沒有 #map2，`HASH='&nobb'`）釣魚不受影響、別人等魚時看得到浮標。`HASHONLY=1 GAMEJS=舊版game.js` 可以算舊版的地形指紋來比。
- `w2walk.js`：新主島走路（木棧道、棧橋、小橋、步道），`TIDES=0,-1` 中潮和乾潮各跑一次。
- `w2probe.js`：開新主島後跑一段 `CODE='...'`，印出結果（查東西用）。

`w2fish.js` 的 `PARTS`：map（整座島哪裡是水、哪種水，畫成 w2/fish/map.png）、dry（陸地上不能出現拋竿）、fish（六種水邊完整釣一次）、rep（重複拋竿，浮標都要在水裡）、tide（乾潮：濕沙能走、不能把浮標拋在沙上、漲潮被推回岸）、fai（水裡的魚影）、peer（別人看得到浮標、打窩同步）、nav（找釣點帶路）、old（舊島不受影響）。一次跑太多會超過十分鐘，分兩三次跑。
