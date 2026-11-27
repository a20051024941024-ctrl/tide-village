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

## 11/27 下午加的（v926 村子的人和攤子搬到新主島）

- `w2people.js`：人和板子搬過來的整套檢查。`PARTS=site,open,gang,roam,hop,nav,indoor`
  （站位和按鈕、按下去開的畫面、老港釣魚、阿鐵在攤位旁走動、回舊村子再回來、找人找店、進店再出來）。
  `roam` 很慢（三四分鐘），單獨跑、`timeout 420`。
- `w2map.js`：從上面看的示意圖（地是什麼、哪裡擋住、門、車站、排好的位置），挑位置用。
  `REGS='名字:x0,y0,x1,y1;…' SC=10`（規劃圖的像素範圍；SC＝一公尺幾個點）。
- `w2shot.js`：站到某個位置拍一張。`SHOTS='名字:x,y,鏡頭方向,俯角,距離'`（跟著人的鏡頭）、
  `FREE='名字:人x,人y,人面朝,鏡頭x,鏡頭y,鏡頭高,看x,看y,看高'`（自己擺鏡頭）；`CLEAN=1 Q=high DSF=2`。
- `w2trim.js`：查「畫面整個不見（WebGL context lost）」是不是遊戲造成的——不是。

### 這次踩到的坑
- **在舊村子的港邊廣場連續畫幾百格，無頭瀏覽器的軟體顯示卡會撐不住（context lost）**，之後畫面不再前進。
  v925 也一樣，跟遊戲無關。長的迴圈要切成小段（一段 ≤200 格），段跟段之間 `waitForTimeout` 一下。
- 進店、出店是用真的計時器（setTimeout 260 毫秒），假時間推不動它：要 `waitForTimeout` 等真的時間。
- `h.js` 的錯誤訊息現在會帶出錯的位置（前三層）。

## 11/27 傍晚加的（v927–v928）

- `w2people.js` 現在的段落：`PARTS=site,open,fish,sci,roam,hop,nav,indoor`。
  `fish`（釣魚的四位，約 5 分鐘）和 `roam`（顧攤的在攤位旁走動，一位約 3 分鐘，`ONLY=news,salon` 挑人）很慢，各自單獨跑、`timeout 560`。
  其他幾段一起跑約 2 分鐘。
- `npcstep.js`：村民每一格移動多少（有沒有平移、瞬移、沒走路動作卻在動）。`HASH='&nobb'` 是舊村子；加 `&map2` 和 `AT='x,z'` 可以看新主島。
- `W2.rail` 是鐵軌中心線（陣列，給測試畫圖用）；村民用的是 `W2.railNear(x, z, 幾公尺)`。

## 11/27 晚上（v929–v930）
- `w2map.js` 加 `HSH=1`：森林畫等高線（每 2 公尺一條），挑山坡位置用。
- `Env.tideTest=1` 不會把 `Env.tide.lv` 拉回滿潮，測「漲潮時」要另外想辦法。
