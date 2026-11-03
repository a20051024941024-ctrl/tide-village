// 私人房間：用 PeerJS 讓手機直接互連（5 個字母的房間代碼）
/* ===== 5 碼房間代碼：用 PeerJS 做一個跟 Claude 房間一樣用法的「房間」 =====
   一個人當房主（開房的人），其他人連到房主；房主負責把每個人的位置、聊天、廣播轉給大家。
   對外提供的用法：connected() emit(topic,data) on(topic,fn) presence(obj) onPeers(fn) onConnection(fn) leave() code */
window.PJRoom = (function () {
  var PFX = 'tide-v1-', LIB = null;
  function loadLib() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (LIB) return LIB;
    LIB = new Promise(function (res, rej) {
      var urls = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'], k = 0;
      (function next() {
        if (k >= urls.length) { LIB = null; return rej(new Error('load')); }
        var s = document.createElement('script'); s.src = urls[k++]; s.async = true;
        s.onload = function () { window.Peer ? res(window.Peer) : next(); }; s.onerror = next; document.head.appendChild(s);
      })();
    });
    return LIB;
  }
  function newCode() { var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', c = ''; for (var i = 0; i < 5; i++) c += A.charAt(Math.floor(Math.random() * A.length)); return c; }

  function make(isHost, code, myName) {
    var R = { code: code, host: isHost }, peer = null, me = null, conns = {}, hostConn = null, live = false;
    var pres = {}, names = {}, lis = {}, peerFns = [], connFns = [], myPres = null, seen = {}, hbT = null;
    function fire(t, msg) { (lis[t] || []).forEach(function (f) { try { f(msg); } catch (e) {} }); }
    function firePeers(ch) { peerFns.forEach(function (f) { try { f(ch); } catch (e) {} }); }
    function fireConn() { connFns.forEach(function (f) { try { f(live); } catch (e) {} }); }
    function pp(id) { return { peer: id, isMe: id === me, kind: 'viewer', presence: pres[id] || {}, by: id, guest: false }; }
    function bcast(o, except) { var s = JSON.stringify(o); Object.keys(conns).forEach(function (id) { if (id !== except) try { conns[id].send(s); } catch (e) {} }); }
    function onHostMsg(id, raw) { /* 房主收到某位朋友的訊息 */
      var m; try { m = JSON.parse(raw); } catch (e) { return; }
      seen[id] = Date.now(); if (m.t === 'hb') return;
      if (m.t === 'pres') { var isNew = !pres[id]; pres[id] = m.p || {}; bcast({ t: 'pres', id: id, p: pres[id] }, id); firePeers(isNew ? { joined: [pp(id)], updated: [], left: [] } : { joined: [], updated: [pp(id)], left: [] }); }
      else if (m.t === 'ev' && typeof m.topic === 'string') { bcast({ t: 'ev', id: id, topic: m.topic, data: m.data }, id); fire(m.topic, { peer: id, data: m.data, sameTab: false }); }
    }
    function onGuestMsg(raw) { /* 朋友收到房主轉來的訊息 */
      var m; try { m = JSON.parse(raw); } catch (e) { return; }
      if (m.t === 'snap') { var j = []; Object.keys(m.all || {}).forEach(function (id) { if (id === me) return; pres[id] = m.all[id]; j.push(pp(id)); }); if (j.length) firePeers({ joined: j, updated: [], left: [] }); }
      else if (m.t === 'pres' && m.id !== me) { var isNew = !pres[m.id]; pres[m.id] = m.p || {}; firePeers(isNew ? { joined: [pp(m.id)], updated: [], left: [] } : { joined: [], updated: [pp(m.id)], left: [] }); }
      else if (m.t === 'left' && pres[m.id]) { var x = pp(m.id); delete pres[m.id]; firePeers({ joined: [], updated: [], left: [x] }); }
      else if (m.t === 'ev' && m.id !== me) fire(m.topic, { peer: m.id, data: m.data, sameTab: false });
    }
    R.connected = function () { return live; };
    R.on = function (t, fn) { (lis[t] || (lis[t] = [])).push(fn); return function () {}; };
    R.onPeers = function (fn) { peerFns.push(fn); var j = Object.keys(pres).filter(function (id) { return id !== me; }).map(pp); if (j.length) setTimeout(function () { fn({ joined: j, updated: [], left: [] }); }, 0); return function () {}; };
    R.onConnection = function (fn) { connFns.push(fn); return function () {}; };
    R.presence = function (o) {
      myPres = o; if (!live) return Promise.resolve();
      if (isHost) { pres[me] = o; bcast({ t: 'pres', id: me, p: o }); }
      else if (hostConn) try { hostConn.send(JSON.stringify({ t: 'pres', p: o })); } catch (e) {}
      return Promise.resolve();
    };
    R.emit = function (topic, data) {
      if (!live) return Promise.reject({ code: 'not_connected' });
      if (isHost) bcast({ t: 'ev', id: me, topic: topic, data: data });
      else if (hostConn) try { hostConn.send(JSON.stringify({ t: 'ev', topic: topic, data: data })); } catch (e) {}
      fire(topic, { peer: me, data: data, sameTab: true });
      return Promise.resolve();
    };
    R._gone = {};
    R.leave = function () { live = false; clearInterval(hbT); try { peer && peer.destroy(); } catch (e) {} fireConn(); };
    R.start = function () {
      return loadLib().then(function (Peer) {
        return new Promise(function (res, rej) {
          var tries = 0;
          (function attempt() {
            if (isHost) {
              var c = R.code || newCode(); tries++;
              peer = new Peer(PFX + c, { debug: 0 });
              peer.on('open', function (id) { me = id; R.code = c; live = true; fireConn(); if (myPres) R.presence(myPres); res(R);
                hbT = setInterval(function () { var t = Date.now(); Object.keys(conns).forEach(function (k) { if (seen[k] && t - seen[k] > 20000 && R._gone[k]) R._gone[k](); }); bcast({ t: 'hb' }); }, 5000); });
              peer.on('connection', function (conn) {
                var id = conn.peer;
                var ready = function () { if (conns[id]) return; conns[id] = conn; var all = {}; Object.keys(pres).forEach(function (k) { all[k] = pres[k]; }); if (myPres) all[me] = myPres; try { conn.send(JSON.stringify({ t: 'snap', all: all })); } catch (e) {} };
                conn.on('open', ready); if (conn.open) setTimeout(ready, 0);
                conn.on('data', function (d) { ready(); onHostMsg(id, d); });
                var gone = R._gone[id] = function () { if (!conns[id]) return; delete conns[id]; var x = pp(id); delete pres[id]; bcast({ t: 'left', id: id }); firePeers({ joined: [], updated: [], left: [x] }); };
                conn.on('close', gone); conn.on('error', gone);
              });
              peer.on('error', function (e) { if (e && e.type === 'unavailable-id' && tries < 4) { try { peer.destroy(); } catch (x) {} R.code = null; return attempt(); } if (!live) rej(e); });
              peer.on('disconnected', function () { try { peer.reconnect(); } catch (e) {} });
            } else {
              peer = new Peer({ debug: 0 });
              var done = false;
              peer.on('open', function (id) {
                me = id; hostConn = peer.connect(PFX + code, { reliable: true });
                var lastHost = Date.now();
                var opened = function () { if (done) return; done = true; live = true; fireConn(); if (myPres) R.presence(myPres); res(R);
                  hbT = setInterval(function () { try { hostConn.send(JSON.stringify({ t: 'hb' })); } catch (e) {} if (Date.now() - lastHost > 20000 && live) { live = false; fireConn(); } }, 5000); };
                hostConn.on('open', opened);
                hostConn.on('data', function (d) { lastHost = Date.now(); if (!live && done) { live = true; fireConn(); } opened(); onGuestMsg(d); });
                hostConn.on('close', function () { live = false; fireConn(); });
                setTimeout(function () { if (!done) rej({ type: 'timeout' }); }, 15000);
              });
              peer.on('error', function (e) { if (!done) rej(e); });
            }
          })();
        });
      });
    };
    return R;
  }
  return { host: function (name) { return make(true, null, name).start(); }, join: function (code, name) { return make(false, String(code || '').toUpperCase().replace(/[^A-Z]/g, ''), name).start(); }, available: function () { return typeof RTCPeerConnection !== 'undefined'; } };
})();

