# 包成 Android App（TWA）上架 Google Play

遊戲網址：https://a20051024941024-ctrl.github.io/tide-village/

## 重點：驗證檔要放在網域最上層
Android 只會去 `https://a20051024941024-ctrl.github.io/.well-known/assetlinks.json` 找驗證檔，
**不會**去 `/tide-village/.well-known/`。所以驗證檔不能放在這個專案裡，要另外開一個 GitHub 專案：

1. 在 GitHub 建一個新的公開專案，名字一定要是 `a20051024941024-ctrl.github.io`。
2. 在裡面放兩個檔案：
   - `.nojekyll`（空檔案，不然 GitHub Pages 會略過 `.well-known` 這種點開頭的資料夾）
   - `.well-known/assetlinks.json`（內容照這個資料夾的 assetlinks.json，換掉指紋）
3. 專案設定 → Pages → 從 main 分支發佈。

## 指紋從哪裡來
1. 用 PWABuilder（https://www.pwabuilder.com）輸入遊戲網址 → Android → 套件名稱填 `com.chaoxi.fishing`（之後不能改）。
2. 上傳到 Play Console 後，到「設定 → 應用程式完整性 → 應用程式簽署」，複製「SHA-256 憑證指紋」。
3. 把指紋貼進 assetlinks.json（格式像 `AB:CD:12:...`）。PWABuilder 自己的上傳金鑰指紋也可以一起放（陣列裡放兩個）。

驗證成功的話，App 打開時上面不會出現網址列。

## manifest 已經準備好的
- 圖示：192、512、512 maskable（icons/）
- 截圖：icons/shots/ 四張 1280×720（港口、廣場、拔河、釣到魚）。Play 商店的截圖也可以直接用這四張。
- 橫向、全螢幕、分類 games
