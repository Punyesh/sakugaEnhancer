  // Native <video> metadata loading is faster and simpler than shelling out
  // to ffmpeg just to read a duration — no need to touch the wasm side for this.
  // Accepts either plain seconds ("7.5") or MM:SS ("1:23") for the advanced
  // per-clip trim range and custom-duration inputs. Returns null for
  // anything blank or unparseable, rather than guessing.
  function parseTimeInput(str) {
    str = (str || '').trim();
    if (!str) return null;
    if (str.indexOf(':') !== -1) {
      var parts = str.split(':');
      var mins = parseInt(parts[0], 10);
      var secs = parseFloat(parts[1]);
      if (isNaN(mins) || isNaN(secs)) return null;
      return mins * 60 + secs;
    }
    var n = parseFloat(str);
    return isNaN(n) ? null : n;
  }
  function formatTimeInput(seconds) {
    if (seconds == null || isNaN(seconds)) return '';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Fractional-second display for the frame bar/trim labels — distinct from
  // formatTimeInput above, which is whole-second and meant for editable text
  // fields, not a live-updating playhead display.
  function formatVideoTime(t) {
    var m = Math.floor(t / 60);
    var s = t - m * 60;
    var sStr = s.toFixed(1);
    if (s < 10) sStr = '0' + sStr;
    return m + ':' + sStr;
  }

  // Shared by the post viewer and the grid-result preview — frame-accurate
  // review is the whole point of sakuga, so both get the same stepping
  // controls rather than the grid result getting a stripped-down version.
  // fps is only ever a display/step-size approximation (browser seeking
  // can't guarantee landing on an exact decoded frame), not a claim of
  // true frame accuracy.
  function buildFrameSteppingBar(box, vid, fps) {
    var MED_STEP = 10;
    var bigStep = Math.max(1, Math.round(fps)); // ~1 second worth of frames

    var frameBar = document.createElement('div');
    frameBar.className = 'sk-frame-bar';
    frameBar.innerHTML =
      '<div class="sk-frame-row">' +
        '<button class="sk-frame-btn" id="sk-fb-bigback" title="back ~1s">«</button>' +
        '<button class="sk-frame-btn" id="sk-fb-medback" title="back ' + MED_STEP + ' frames">‹‹</button>' +
        '<button class="sk-frame-btn" id="sk-fb-back" title="previous frame ( , )">‹</button>' +
        '<span class="sk-frame-count" id="sk-frame-count">0 / 0</span>' +
        '<button class="sk-frame-btn" id="sk-fb-fwd" title="next frame ( . )">›</button>' +
        '<button class="sk-frame-btn" id="sk-fb-medfwd" title="forward ' + MED_STEP + ' frames">››</button>' +
        '<button class="sk-frame-btn" id="sk-fb-bigfwd" title="forward ~1s">»</button>' +
      '</div>' +
      '<div class="sk-frame-time" id="sk-frame-time">0:00.0 / 0:00.0</div>';
    box.appendChild(frameBar);

    var countEl = frameBar.querySelector('#sk-frame-count');
    var timeEl = frameBar.querySelector('#sk-frame-time');

    function updateDisplay() {
      var total = Math.round((vid.duration || 0) * fps);
      var cur = Math.round(vid.currentTime * fps);
      countEl.textContent = cur + ' / ' + total;
      timeEl.textContent = formatVideoTime(vid.currentTime) + ' / ' + formatVideoTime(vid.duration || 0);
    }
    function step(deltaFrames) {
      vid.pause();
      var next = vid.currentTime + deltaFrames / fps;
      vid.currentTime = Math.max(0, Math.min(vid.duration || next, next));
    }
    vid.addEventListener('loadedmetadata', updateDisplay);
    vid.addEventListener('timeupdate', updateDisplay);

    frameBar.querySelector('#sk-fb-back').onclick = function () { step(-1); };
    frameBar.querySelector('#sk-fb-fwd').onclick = function () { step(1); };
    frameBar.querySelector('#sk-fb-medback').onclick = function () { step(-MED_STEP); };
    frameBar.querySelector('#sk-fb-medfwd').onclick = function () { step(MED_STEP); };
    frameBar.querySelector('#sk-fb-bigback').onclick = function () { step(-bigStep); };
    frameBar.querySelector('#sk-fb-bigfwd').onclick = function () { step(bigStep); };

    function onFrameKey(e) {
      if (e.key === ',') step(-1);
      else if (e.key === '.') step(1);
    }
    document.addEventListener('keydown', onFrameKey);
    box._onClose(function () { document.removeEventListener('keydown', onFrameKey); });
  }

