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
- `w2train.js`：新主島小火車（v923）。`PARTS=sched,plat,ride,peer,all`：時刻表、月台、上車坐一站下車、別人坐車、11 站全部跑一次。
- `w2trainvid.js`：錄小火車的影片（一格一格拍成 JPG，再用 ffmpeg 接起來；`FROM=港口` 選哪一站上車）。
- `w2probe.js`：開新主島後跑一段 `CODE='...'`，印出結果（查東西用）。

`w2fish.js` 的 `PARTS`：map（整座島哪裡是水、哪種水，畫成 w2/fish/map.png）、dry（陸地上不能出現拋竿）、fish（六種水邊完整釣一次）、rep（重複拋竿，浮標都要在水裡）、tide（乾潮：濕沙能走、不能把浮標拋在沙上、漲潮被推回岸）、fai（水裡的魚影）、peer（別人看得到浮標、打窩同步）、nav（找釣點帶路）、old（舊島不受影響）。一次跑太多會超過十分鐘，分兩三次跑。

## 報告用的圖

`report/grid.html`、`report/mapleg.html` 把測試拍的圖排成一張有說明的大圖，`node report/shot.js grid.html 輸出.jpg 1920` 轉成 JPG（圖檔路徑照當時的資料夾改）。

## 小提醒

- `Env.tideTest = -1 / 0 / 1`：強制乾潮／中潮／滿潮。`w2fish.js` 一開始會固定在中潮（`TIDE=` 可以改），不然找岸邊站位的結果會跟著跑測試的時間變。
- 比對舊島地形的指紋（`hash`）時會把 `Env.tide.lv` 暫時固定，因為舊島紅樹林的泥灘跟著潮汐露出來。
- 新主島的樹只有走近才蓋，樹的碰撞也是那時候才有，所以「可以站的岸邊」數量會因為之前走過哪裡差一點。
