# 把《築城守土》（作者在 Claude 作品頁做的那一份 HTML）加上「回潮汐村」的按鈕，放到 zc/index.html
# 用法：python3 tools/zc_embed.py <作品頁抓下來的.html>
import sys,re
s=open(sys.argv[1],encoding='utf-8').read()
i=s.find('<!DOCTYPE html>'); j=s.rfind('</html>'); assert i>=0 and j>i; s=s[i:j+7]
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:60],s.count(a)); s=s.replace(a,b)
rep('<button class="go" id="bGo">建立新領地</button>','<button class="go" id="bGo">建立新領地</button><button class="go alt" id="bHome" hidden>回潮汐村</button>')
rep('<button class="go alt" id="bQuit">回到主選單</button>','<button class="go alt" id="bQuit">回到主選單</button><button class="go alt" id="bHome2" hidden>存檔並回潮汐村</button>')
rep('</body>',"""<script>
/* 潮汐釣魚村加的：嵌在村子裡的時候才出現「回潮汐村」 */
(()=>{if(window.parent===window)return;const out=()=>{try{parent.postMessage({zc:'exit'},location.origin)}catch(e){}};
const a=document.getElementById('bHome'),b=document.getElementById('bHome2');
if(a){a.hidden=false;a.addEventListener('click',out)}
if(b){b.hidden=false;b.addEventListener('click',()=>{try{document.getElementById('bQuit').click()}catch(e){}setTimeout(out,200)})}
try{parent.postMessage({zc:'ready'},location.origin)}catch(e){}})();
</script>
</body>""")
open('zc/index.html','w',encoding='utf-8').write(s); print('zc/index.html',len(s))
