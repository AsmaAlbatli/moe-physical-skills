/* ============================================================
   منصة المهارات البنية — المرحلة الابتدائية
   إعداد المعلمة: تهاني الباتلي
   ============================================================ */
(function () {
  "use strict";

  const STAR_PATH = "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9Z";
  const STORAGE_KEY = "thf-physical-skills-v1";
  const SITE_URL = "https://asmaalbatli.github.io/moe-physical-skills/";
  const LETTERS = ["أ", "ب", "ج", "د"];
  const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  const TOTAL_STARS = STAGES.length * SPORT_ORDER.length * 3;
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const els = {
    stageTabs: $("#stageTabs"),
    stagePanels: $("#stagePanels"),
    totalStars: $("#totalStars"),
    soundToggle: $("#soundToggle"),
    resetProgress: $("#resetProgress"),
    quizModal: $("#quizModal"),
    quizIcon: $("#quizIcon"),
    quizStage: $("#quizStage"),
    quizTitle: $("#quizTitle"),
    quizCount: $("#quizCount"),
    quizProgress: $("#quizProgress"),
    quizBody: $("#quizBody"),
    videoModal: $("#videoModal"),
    videoFrame: $("#videoFrame"),
    videoTitle: $("#videoTitle"),
    videoDesc: $("#videoDesc"),
    videoChannel: $("#videoChannel"),
    videoDuration: $("#videoDuration"),
    videoLink: $("#videoLink"),
    videoGrid: $("#videoGrid"),
    mobileModal: $("#mobileModal"),
    mobileUrlText: $("#mobileUrlText"),
    mobileOpenLink: $("#mobileOpenLink"),
    copyMobileUrl: $("#copyMobileUrl"),
    copyStatus: $("#copyStatus"),
    confettiLayer: $("#confettiLayer"),
    liveRegion: $("#liveRegion")
  };

  let state = {
    best: {},
    sound: true,
    lastStage: "g1"
  };

  let activeStageId = "g1";
  let activeModal = null;
  let lastFocusedElement = null;
  let quiz = null;
  let audioContext = null;

  /* ---------- أدوات مساعدة ---------- */
  function ar(number) {
    return String(number).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[character];
    });
  }

  function starSvg(isEarned, className = "") {
    return `<svg class="star ${isEarned ? "is-earned" : "is-off"} ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${STAR_PATH}"/></svg>`;
  }

  function quizKey(stageId, sportKey) {
    return `${stageId}:${sportKey}`;
  }

  function getBest(stageId, sportKey) {
    const value = state.best[quizKey(stageId, sportKey)];
    if (!value || typeof value.score !== "number") return null;
    const score = Math.max(0, Math.min(3, value.score));
    return {
      score,
      stars: Math.max(0, Math.min(3, typeof value.stars === "number" ? value.stars : score)),
      total: typeof value.total === "number" ? value.total : 3
    };
  }

  function getStars(stageId, sportKey) {
    const best = getBest(stageId, sportKey);
    return best ? best.stars : 0;
  }

  function getStageStats(stage) {
    let stars = 0;
    let done = 0;
    SPORT_ORDER.forEach((sportKey) => {
      const best = getBest(stage.id, sportKey);
      if (best) {
        done += 1;
        stars += best.stars;
      }
    });
    return { stars, done, total: SPORT_ORDER.length, maxStars: SPORT_ORDER.length * 3 };
  }

  function getTotalStars() {
    return STAGES.reduce((total, stage) => total + getStageStats(stage).stars, 0);
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  /* ---------- حفظ التقدم ---------- */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return;

      if (saved.best && typeof saved.best === "object") {
        Object.keys(saved.best).forEach((key) => {
          const value = saved.best[key];
          if (!value || typeof value.score !== "number") return;
          const score = Math.max(0, Math.min(3, Math.round(value.score)));
          const stars = Math.max(0, Math.min(3, typeof value.stars === "number" ? Math.round(value.stars) : score));
          state.best[key] = { score, stars, total: 3 };
        });
      }

      if (saved.sound === false) state.sound = false;
      if (STAGES.some((stage) => stage.id === saved.lastStage)) state.lastStage = saved.lastStage;
    } catch (error) {
      state.best = {};
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* التخزين قد يكون غير متاح في التصفح الخاص */
    }
  }

  function announce(message) {
    if (!els.liveRegion) return;
    els.liveRegion.textContent = "";
    window.setTimeout(() => {
      els.liveRegion.textContent = message;
    }, 40);
  }

  /* ---------- بناء الواجهة ---------- */
  function renderTabs() {
    els.stageTabs.innerHTML = STAGES.map((stage) => {
      const stats = getStageStats(stage);
      return `
        <button class="stage-tab ${stage.id === activeStageId ? "is-active" : ""}"
          id="tab-${stage.id}" type="button" role="tab" data-stage="${stage.id}"
          aria-selected="${stage.id === activeStageId}" aria-controls="stage-${stage.id}"
          aria-label="${esc(stage.name)}، ${ar(stats.done)} من ${ar(4)} اختبارات، ${ar(stats.stars)} نجمة"
          tabindex="${stage.id === activeStageId ? "0" : "-1"}"
          style="--tab-color:${stage.color}">
          <span class="tab-num" aria-hidden="true">${stage.number}</span>
          <span class="tab-text">
            <strong>الصف ${esc(stage.short)}</strong>
            <small><svg class="tab-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${STAR_PATH}"/></svg> ${ar(stats.stars)}/${ar(12)} نجمة</small>
          </span>
        </button>`;
    }).join("");
  }

  function renderStageBanner(stage) {
    return `
      <div class="stage-banner">
        <div class="stage-banner-copy">
          <span class="stage-kicker">${stage.icon} ${esc(stage.tag)}</span>
          <h2>${esc(stage.name)} <span class="stage-age">${esc(stage.age)}</span></h2>
          <p class="stage-intro">${esc(stage.intro)}</p>
          <div class="focus-chips" aria-label="المهارات المستهدفة">
            ${stage.focus.map((focus) => `<span>${esc(focus)}</span>`).join("")}
          </div>
        </div>
        <div class="stage-progress">
          <div class="progress-ring" data-ring="${stage.id}" style="--p:0" aria-hidden="true">
            <span data-ring-text="${stage.id}">٠/${ar(12)}</span>
          </div>
          <div class="stage-progress-text">
            <strong data-stage-done="${stage.id}">لم تبدأ بعد</strong>
            <small data-stage-stars="${stage.id}">٠ من ١٢ نجمة</small>
          </div>
        </div>
      </div>`;
  }

  function renderSportCard(stage, sportKey) {
    const sport = SPORTS[sportKey];
    const video = VIDEOS[sport.videoKey];
    const goals = stage.goals[sportKey];
    const key = quizKey(stage.id, sportKey);

    return `
      <article class="sport-card" style="--sport:${sport.color};--sport-dark:${sport.dark};--sport-soft:${sport.soft}">
        <div class="sport-media">
          <img src="${sport.image}" alt="${esc(sport.name)} — ${esc(stage.name)}" loading="lazy">
          <span class="sport-badge" aria-hidden="true">${sport.icon}</span>
          <span class="video-pill">${video.duration}</span>
          <span class="card-done" data-done="${key}" hidden></span>
        </div>
        <div class="sport-body">
          <div class="sport-head">
            <h3>${esc(sport.name)}</h3>
            <span class="card-stars" data-card-stars="${key}" aria-label="لم تُسجل نتيجة بعد">
              ${[1, 2, 3].map(() => starSvg(false)).join("")}
            </span>
          </div>
          <p class="sport-tagline">${esc(sport.tagline)}</p>
          <ul class="skill-list">
            ${goals.map((goal) => `<li>${esc(goal)}</li>`).join("")}
          </ul>
          <div class="card-actions">
            <button class="btn btn-quiz" type="button" data-quiz="${key}">
              اختبر نفسك <span aria-hidden="true">✨</span>
            </button>
            <button class="btn btn-video" type="button" data-video="${sport.videoKey}">
              شاهد المقطع <span aria-hidden="true">▶</span>
            </button>
          </div>
        </div>
      </article>`;
  }

  function renderPanels() {
    els.stagePanels.innerHTML = STAGES.map((stage) => `
      <section class="stage-panel" id="stage-${stage.id}" data-stage="${stage.id}"
        role="tabpanel" aria-labelledby="tab-${stage.id}" ${stage.id === activeStageId ? "" : "hidden"}
        style="--stage-color:${stage.color};--stage-color-2:${stage.color2}">
        ${renderStageBanner(stage)}
        <div class="sport-grid">
          ${SPORT_ORDER.map((sportKey) => renderSportCard(stage, sportKey)).join("")}
        </div>
      </section>`).join("");
  }

  function renderVideoGrid() {
    els.videoGrid.innerHTML = SPORT_ORDER.map((sportKey) => {
      const sport = SPORTS[sportKey];
      const video = VIDEOS[sport.videoKey];
      return `
        <button class="video-tile" type="button" data-video="${sportKey}" style="--vcolor:${sport.color}"
          aria-label="شاهد فيديو ${esc(video.title)}">
          <span class="video-thumb">
            <img src="${video.thumb}" alt="" loading="lazy">
            <span class="play-badge" aria-hidden="true">▶</span>
            <span class="video-time">${video.duration}</span>
          </span>
          <span class="video-tile-body">
            <span class="video-sport">${sport.icon} ${esc(sport.name)}</span>
            <span class="video-title">${esc(video.title)}</span>
            <span class="video-meta-text">${esc(video.channel)}</span>
          </span>
        </button>`;
    }).join("");
  }

  /* ---------- تحديث النجوم والتقدم ---------- */
  function refreshProgress() {
    const totalStars = getTotalStars();
    els.totalStars.textContent = ar(totalStars);

    STAGES.forEach((stage) => {
      const stats = getStageStats(stage);
      const percent = Math.round((stats.stars / stats.maxStars) * 100);
      const ring = $(`[data-ring="${stage.id}"]`);
      const ringText = $(`[data-ring-text="${stage.id}"]`);
      const doneText = $(`[data-stage-done="${stage.id}"]`);
      const starsText = $(`[data-stage-stars="${stage.id}"]`);

      if (ring) ring.style.setProperty("--p", String(percent));
      if (ringText) ringText.textContent = `${ar(stats.stars)}/${ar(12)}`;
      if (doneText) {
        doneText.textContent = stats.done === 0
          ? "لم تبدأ بعد"
          : `${ar(stats.done)} من ${ar(stats.total)} اختبارات`;
      }
      if (starsText) starsText.textContent = `${ar(stats.stars)} من ${ar(12)} نجمة`;

      const tab = $(`#tab-${stage.id}`);
      if (tab) {
        const miniStars = $(".tab-text small", tab);
        if (miniStars) {
          miniStars.innerHTML = `<svg class="tab-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${STAR_PATH}"/></svg> ${ar(stats.stars)}/${ar(12)} نجمة`;
        }
        tab.setAttribute("aria-label", `${stage.name}، ${ar(stats.done)} من ${ar(stats.total)} اختبارات، ${ar(stats.stars)} نجمة`);
      }

      SPORT_ORDER.forEach((sportKey) => {
        const key = quizKey(stage.id, sportKey);
        const best = getBest(stage.id, sportKey);
        const stars = best ? best.stars : 0;
        const holder = $(`[data-card-stars="${key}"]`);
        const badge = $(`[data-done="${key}"]`);

        if (holder) {
          holder.innerHTML = [1, 2, 3].map((index) => starSvg(index <= stars)).join("");
          holder.setAttribute(
            "aria-label",
            best ? `أفضل نتيجة: ${ar(stars)} من ${ar(3)} نجوم` : "لم تُسجل نتيجة بعد"
          );
        }

        if (badge) {
          if (best) {
            badge.hidden = false;
            badge.innerHTML = `${starSvg(true)} ${ar(stars)}`;
            badge.setAttribute("aria-label", `أفضل نتيجة: ${ar(stars)} من ${ar(3)} نجوم`);
          } else {
            badge.hidden = true;
          }
        }
      });
    });
  }

  /* ---------- التنقل بين المراحل ---------- */
  function activateStage(stageId, options = {}) {
    const { scroll = true, updateHash = true, focusTab = false } = options;
    if (!STAGES.some((stage) => stage.id === stageId)) return;

    activeStageId = stageId;
    state.lastStage = stageId;
    persist();

    $$(".stage-tab", els.stageTabs).forEach((tab) => {
      const isActive = tab.dataset.stage === stageId;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });

    $$(".stage-panel", els.stagePanels).forEach((panel) => {
      panel.hidden = panel.dataset.stage !== stageId;
    });

    if (updateHash) {
      try {
        history.replaceState(null, "", `#${stageId}`);
      } catch (error) {
        /* تجاهل */
      }
    }

    if (focusTab) {
      const activeTab = $(`#tab-${stageId}`);
      if (activeTab) activeTab.focus({ preventScroll: true });
    }

    if (scroll) {
      const stagesSection = $("#stages");
      if (stagesSection) {
        stagesSection.scrollIntoView({
          behavior: REDUCED_MOTION ? "auto" : "smooth",
          block: "start"
        });
      }
    }
  }

  /* ---------- الصوت ---------- */
  function ensureAudio() {
    if (!state.sound) return null;
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function playNote(frequency, delay, duration, type = "sine", volume = 0.07) {
    const context = ensureAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function playCorrectSound() {
    playNote(659.25, 0, 0.16, "sine", 0.07);
    playNote(880, 0.12, 0.24, "sine", 0.065);
  }

  function playWrongSound() {
    playNote(220, 0, 0.18, "triangle", 0.05);
    playNote(174.61, 0.14, 0.24, "triangle", 0.045);
  }

  function playResultSound(score) {
    if (score === 3) {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        playNote(frequency, index * 0.12, 0.3, "sine", 0.06);
      });
    } else if (score >= 1) {
      [523.25, 659.25].forEach((frequency, index) => {
        playNote(frequency, index * 0.14, 0.26, "sine", 0.05);
      });
    } else {
      playNote(392, 0, 0.3, "sine", 0.04);
    }
  }

  function updateSoundButton() {
    els.soundToggle.setAttribute("aria-pressed", String(state.sound));
    els.soundToggle.setAttribute("aria-label", state.sound ? "إيقاف المؤثرات الصوتية" : "تشغيل المؤثرات الصوتية");
  }

  /* ---------- النوافذ ---------- */
  function openModal(modal, focusSelector = ".modal-close") {
    if (activeModal === modal) return;
    if (activeModal) closeModal(activeModal, false);
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeModal = modal;
    modal.hidden = false;
    document.body.classList.add("modal-open");

    if (focusSelector) {
      window.setTimeout(() => {
        const target = modal.querySelector(focusSelector);
        if (target && document.contains(target)) target.focus({ preventScroll: true });
      }, 40);
    }
  }

  function closeModal(modal, restoreFocus = true) {
    if (!modal) return;
    modal.hidden = true;
    if (modal === els.videoModal) stopVideo();
    if (modal === els.quizModal) quiz = null;
    document.body.classList.remove("modal-open");
    if (activeModal === modal) activeModal = null;
    if (restoreFocus && lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  function trapFocus(event) {
    if (!activeModal || event.key !== "Tab") return;
    const focusable = $$("a[href], button:not([disabled]), iframe, input, [tabindex]:not([tabindex='-1'])", activeModal)
      .filter((element) => !element.hidden && element.getClientRects().length > 0);

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const focusIsInside = activeModal.contains(document.activeElement);

    if (event.shiftKey && (!focusIsInside || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!focusIsInside || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------- الفيديو ---------- */
  function openVideo(sportKey) {
    const video = VIDEOS[sportKey];
    const sport = SPORTS[sportKey];
    if (!video || !sport) return;

    els.videoTitle.textContent = video.title;
    els.videoDesc.textContent = video.description;
    els.videoChannel.textContent = video.channel;
    els.videoDuration.textContent = video.duration;
    els.videoLink.href = `https://www.youtube.com/watch?v=${video.youtubeId}`;
    els.videoFrame.title = `${sport.name}: ${video.title}`;
    els.videoFrame.src = `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    openModal(els.videoModal, ".modal-close");
  }

  function stopVideo() {
    if (els.videoFrame) els.videoFrame.src = "about:blank";
  }

  /* ---------- فتح المنصة على الجوال ---------- */
  function openMobileAccess() {
    if (!els.mobileModal) return;
    if (els.mobileUrlText) els.mobileUrlText.textContent = SITE_URL;
    if (els.mobileOpenLink) els.mobileOpenLink.href = SITE_URL;
    if (els.copyStatus) els.copyStatus.textContent = "";
    openModal(els.mobileModal, ".modal-close");
  }

  async function copySiteLink() {
    if (!els.copyStatus) return;
    let copied = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(SITE_URL);
        copied = true;
      } else {
        const area = document.createElement("textarea");
        area.value = SITE_URL;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand("copy");
        area.remove();
      }
    } catch (error) {
      copied = false;
    }

    els.copyStatus.textContent = copied
      ? "تم نسخ الرابط ✓"
      : "تعذّر النسخ تلقائيًا، يمكنك تحديد الرابط ونسخه يدويًا.";
    announce(copied ? "تم نسخ رابط المنصة" : "تعذّر نسخ الرابط تلقائيًا");

    if (copied) {
      window.setTimeout(() => {
        if (els.copyStatus) els.copyStatus.textContent = "";
      }, 3000);
    }
  }

  /* ---------- الاختبار ---------- */
  function startQuiz(stageId, sportKey) {
    const stage = STAGES.find((item) => item.id === stageId);
    const sport = SPORTS[sportKey];
    if (!stage || !sport || !stage.quizzes[sportKey]) return;

    const questions = stage.quizzes[sportKey];
    quiz = {
      stageId,
      sportKey,
      questions,
      index: 0,
      score: 0,
      answered: false,
      optionOrders: questions.map((question) => shuffle(Array.from(question.options.keys())))
    };

    const quizCard = $(".quiz-card", els.quizModal);
    if (quizCard) {
      quizCard.style.setProperty("--quiz-color", sport.color);
      quizCard.style.setProperty("--quiz-soft", sport.soft);
    }

    els.quizIcon.textContent = sport.icon;
    els.quizStage.textContent = stage.name;
    els.quizTitle.textContent = sport.name;
    openModal(els.quizModal, null);
    renderQuestion();
  }

  function renderQuestion() {
    if (!quiz) return;
    if (quiz.index >= quiz.questions.length) {
      renderResult();
      return;
    }

    const total = quiz.questions.length;
    const question = quiz.questions[quiz.index];
    const order = quiz.optionOrders[quiz.index];
    const progress = Math.round((quiz.index / total) * 100);

    quiz.answered = false;
    els.quizCount.textContent = `السؤال ${ar(quiz.index + 1)} من ${ar(total)}`;
    els.quizProgress.style.width = `${progress}%`;
    const track = els.quizProgress.parentElement;
    if (track) track.setAttribute("aria-valuenow", String(progress));

    els.quizBody.innerHTML = `
      <div class="question-layout">
        <figure class="question-visual">
          <img src="assets/img/${question.img}.svg" alt="${esc(question.alt)}">
          <figcaption class="question-visual-caption">تأمّل الصورة قبل الإجابة</figcaption>
        </figure>
        <div class="question-content">
          <span class="question-kicker">اختر الإجابة الصحيحة</span>
          <h3 class="question-text">${esc(question.q)}</h3>
          <div class="options" role="group" aria-label="خيارات الإجابة">
            ${order.map((optionIndex, position) => `
              <button class="option" type="button" data-option="${optionIndex}">
                <span class="option-letter" aria-hidden="true">${LETTERS[position]}</span>
                <span class="option-text">${esc(question.options[optionIndex])}</span>
                <span class="option-mark" aria-hidden="true"></span>
              </button>`).join("")}
          </div>
          <div class="feedback" id="feedback" hidden></div>
          <div class="quiz-actions">
            <span class="quiz-hint">اختر إجابة واحدة</span>
            <button class="btn-next" id="nextBtn" type="button" disabled>
              ${quiz.index === total - 1 ? "عرض النتيجة ⭐" : "السؤال التالي ←"}
            </button>
          </div>
        </div>
      </div>`;

    announce(`السؤال ${ar(quiz.index + 1)} من ${ar(total)}: ${question.q}`);

    window.requestAnimationFrame(() => {
      const firstOption = $(".option", els.quizBody);
      if (firstOption) firstOption.focus({ preventScroll: true });
    });
  }

  function selectAnswer(originalIndex, selectedButton) {
    if (!quiz || quiz.answered) return;
    const question = quiz.questions[quiz.index];
    const total = quiz.questions.length;
    const isCorrect = originalIndex === question.answer;
    quiz.answered = true;

    if (isCorrect) quiz.score += 1;

    $$(".option", els.quizBody).forEach((button) => {
      const optionIndex = Number(button.dataset.option);
      button.disabled = true;
      const mark = $(".option-mark", button);

      if (optionIndex === question.answer) {
        button.classList.add("is-correct");
        if (mark) mark.textContent = "✓";
      } else if (button === selectedButton) {
        button.classList.add("is-wrong");
        if (mark) mark.textContent = "✕";
      } else {
        button.classList.add("is-muted");
      }
    });

    const feedback = $("#feedback", els.quizBody);
    if (feedback) {
      feedback.hidden = false;
      feedback.classList.add(isCorrect ? "is-correct" : "is-wrong");
      feedback.innerHTML = isCorrect
        ? `<span class="feedback-icon" aria-hidden="true">🎉</span><span><strong>إجابة صحيحة!</strong> ${esc(question.explain)}</span>`
        : `<span class="feedback-icon" aria-hidden="true">💡</span><span><strong>ليست الإجابة الصحيحة.</strong> الإجابة الصحيحة: <strong>${esc(question.options[question.answer])}</strong>. ${esc(question.explain)}</span>`;
    }

    const nextButton = $("#nextBtn", els.quizBody);
    if (nextButton) {
      nextButton.disabled = false;
      nextButton.textContent = quiz.index === total - 1 ? "عرض النتيجة ⭐" : "السؤال التالي ←";
      window.requestAnimationFrame(() => nextButton.focus({ preventScroll: true }));
    }

    const answeredProgress = Math.round(((quiz.index + 1) / total) * 100);
    els.quizProgress.style.width = `${answeredProgress}%`;
    const track = els.quizProgress.parentElement;
    if (track) track.setAttribute("aria-valuenow", String(answeredProgress));

    announce(isCorrect ? "إجابة صحيحة. أحسنت!" : `إجابة غير صحيحة. الإجابة الصحيحة هي ${question.options[question.answer]}.`);
    if (isCorrect) playCorrectSound();
    else playWrongSound();
  }

  function goToNextQuestion() {
    if (!quiz || !quiz.answered) return;
    quiz.index += 1;
    if (quiz.index >= quiz.questions.length) renderResult();
    else renderQuestion();
  }

  function restartQuiz() {
    if (!quiz) return;
    quiz.index = 0;
    quiz.score = 0;
    quiz.answered = false;
    quiz.optionOrders = quiz.questions.map((question) => shuffle(Array.from(question.options.keys())));
    renderQuestion();
  }

  function starsMessage(stars) {
    if (stars === 0) return "لم تحصل على نجوم هذه المرة، لكن المحاولة نفسها خطوة جميلة.";
    if (stars === 1) return "حصلت على نجمة واحدة من ثلاث نجوم.";
    if (stars === 2) return "حصلت على نجمتين من ثلاث نجوم.";
    return "حصلت على ثلاث نجوم كاملة!";
  }

  function renderResult() {
    if (!quiz) return;
    const total = quiz.questions.length;
    const score = quiz.score;
    const stars = score;
    const key = quizKey(quiz.stageId, quiz.sportKey);
    const hadBest = Boolean(state.best[key]) && typeof state.best[key].score === "number";
    const previousBest = hadBest ? state.best[key].score : 0;
    const isNewBest = !hadBest || score > previousBest;

    if (isNewBest) {
      state.best[key] = { score, total, stars, completedAt: new Date().toISOString() };
      persist();
    }

    const bestScore = Math.max(previousBest, score);
    const bestLabel = !hadBest
      ? "تم حفظ محاولتك الأولى 🌟"
      : score > previousBest
        ? "🏅 رقم قياسي جديد!"
        : `أفضل نتيجة لك: ${ar(bestScore)} من ${ar(total)}`;
    const resultCopy = {
      3: {
        title: "مبدع! أداء رائع",
        text: "لقد أتقنت هذه المهارة وجمعت النجوم الثلاث! هل تجرّب مهارة أخرى؟"
      },
      2: {
        title: "رائع جدًا!",
        text: "أنت قريب من الإتقان. راجع الإجابة التي أخطأت فيها ثم أعد المحاولة لتجمع النجوم الثلاث."
      },
      1: {
        title: "بداية جيدة!",
        text: "تعلّمت شيئًا جديدًا اليوم. شاهد الفيديو مرة أخرى، ثم أعد الاختبار وستجمع نجومًا أكثر."
      },
      0: {
        title: "لا بأس، هذه محاولة!",
        text: "المحاولة أول خطوة نحو التعلّم. شاهد المقطع القصير ثم أعد الاختبار، وستنجح بإذن الله."
      }
    }[score];

    els.quizCount.textContent = "النتيجة النهائية";
    els.quizProgress.style.width = "100%";
    const track = els.quizProgress.parentElement;
    if (track) track.setAttribute("aria-valuenow", "100");

    els.quizBody.innerHTML = `
      <div class="result">
        <div class="result-trophy" aria-hidden="true">${score === 3 ? "🏆" : score >= 1 ? "🥇" : "🌱"}</div>
        <h3>${resultCopy.title}</h3>
        <div class="result-stars" role="img" aria-label="${starsMessage(stars)}">
          ${[1, 2, 3].map((index) => starSvg(index <= stars)).join("")}
        </div>
        <div class="result-score">
          <strong>${ar(score)}</strong>
          <span>من ${ar(total)} إجابات صحيحة</span>
        </div>
        <p class="result-message">${resultCopy.text}</p>
        <span class="result-best">${bestLabel}</span>
        <div class="result-actions">
          <button class="btn-retry" type="button" data-retry>أعد المحاولة ↻</button>
          <button class="btn-continue" type="button" data-continue>متابعة الاستكشاف</button>
        </div>
      </div>`;

    refreshProgress();
    playResultSound(score);
    if (score >= 2) launchConfetti();
    announce(`انتهى الاختبار. نتيجتك ${ar(score)} من ${ar(total)}. ${starsMessage(stars)}`);

    window.requestAnimationFrame(() => {
      const retryButton = $("[data-retry]", els.quizBody);
      if (retryButton) retryButton.focus({ preventScroll: true });
    });
  }

  /* ---------- الكونفيتي ---------- */
  function launchConfetti() {
    if (REDUCED_MOTION || !els.confettiLayer) return;
    const colors = ["#ffc93c", "#0f9d76", "#1889e8", "#7b61ff", "#f2742c", "#e64980", "#ffffff"];
    els.confettiLayer.innerHTML = "";

    for (let index = 0; index < 80; index += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[index % colors.length];
      piece.style.width = `${5 + Math.random() * 6}px`;
      piece.style.height = `${9 + Math.random() * 8}px`;
      piece.style.borderRadius = Math.random() > 0.6 ? "50%" : "2px";
      piece.style.setProperty("--drift", `${-120 + Math.random() * 240}px`);
      piece.style.setProperty("--spin", `${360 + Math.random() * 900}deg`);
      piece.style.setProperty("--fall-time", `${2 + Math.random() * 1.7}s`);
      piece.style.setProperty("--delay", `${Math.random() * 0.5}s`);
      els.confettiLayer.appendChild(piece);
    }

    window.setTimeout(() => {
      els.confettiLayer.innerHTML = "";
    }, 4600);
  }

  /* ---------- الأحداث ---------- */
  function bindEvents() {
    els.stageTabs.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-stage]");
      if (!tab) return;
      activateStage(tab.dataset.stage, { scroll: true });
    });

    els.stageTabs.addEventListener("keydown", (event) => {
      const tab = event.target.closest("[data-stage]");
      if (!tab) return;
      const currentIndex = STAGES.findIndex((stage) => stage.id === tab.dataset.stage);
      let nextIndex = null;

      if (event.key === "ArrowLeft") nextIndex = (currentIndex + 1) % STAGES.length;
      else if (event.key === "ArrowRight") nextIndex = (currentIndex - 1 + STAGES.length) % STAGES.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = STAGES.length - 1;

      if (nextIndex !== null) {
        event.preventDefault();
        activateStage(STAGES[nextIndex].id, { scroll: false, focusTab: true });
      }
    });

    document.addEventListener("click", (event) => {
      const quizButton = event.target.closest("[data-quiz]");
      if (quizButton) {
        const [stageId, sportKey] = quizButton.dataset.quiz.split(":");
        startQuiz(stageId, sportKey);
        return;
      }

      const videoButton = event.target.closest("[data-video]");
      if (videoButton) {
        openVideo(videoButton.dataset.video);
        return;
      }

      const mobileButton = event.target.closest("[data-mobile-access]");
      if (mobileButton) {
        openMobileAccess();
        return;
      }

      const closeButton = event.target.closest("[data-close]");
      if (closeButton) {
        const closeType = closeButton.dataset.close;
        const modal = closeType === "quiz"
          ? els.quizModal
          : closeType === "mobile"
            ? els.mobileModal
            : els.videoModal;
        if (modal) closeModal(modal);
      }
    });

    els.quizBody.addEventListener("click", (event) => {
      if (event.target.closest("[data-retry]")) {
        restartQuiz();
        return;
      }

      if (event.target.closest("[data-continue]")) {
        closeModal(els.quizModal);
        return;
      }

      if (event.target.closest("#nextBtn")) {
        goToNextQuestion();
        return;
      }

      const option = event.target.closest(".option[data-option]");
      if (option) selectAnswer(Number(option.dataset.option), option);
    });

    document.addEventListener("keydown", (event) => {
      if (!activeModal) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal(activeModal);
        return;
      }
      trapFocus(event);
    });

    els.soundToggle.addEventListener("click", () => {
      state.sound = !state.sound;
      persist();
      updateSoundButton();
      if (state.sound) playNote(660, 0, 0.16, "sine", 0.05);
      announce(state.sound ? "تم تشغيل المؤثرات الصوتية" : "تم إيقاف المؤثرات الصوتية");
    });

    if (els.copyMobileUrl) {
      els.copyMobileUrl.addEventListener("click", copySiteLink);
    }

    els.resetProgress.addEventListener("click", () => {
      const confirmed = window.confirm("هل تريد إعادة ضبط جميع النتائج والنجوم؟ لا يمكن التراجع عن هذه الخطوة.");
      if (!confirmed) return;
      state.best = {};
      persist();
      refreshProgress();
      announce("تمت إعادة ضبط التقدم. يمكنك البدء من جديد.");
    });
  }

  /* ---------- التشغيل ---------- */
  function init() {
    loadState();
    updateSoundButton();

    if (els.mobileUrlText) els.mobileUrlText.textContent = SITE_URL;
    if (els.mobileOpenLink) els.mobileOpenLink.href = SITE_URL;

    const hashStage = window.location.hash.replace("#", "");
    const initialStage = STAGES.some((stage) => stage.id === hashStage)
      ? hashStage
      : state.lastStage;
    activeStageId = initialStage;

    renderTabs();
    renderPanels();
    renderVideoGrid();
    bindEvents();
    refreshProgress();
    activateStage(initialStage, { scroll: false, updateHash: false });

    console.info(`منصة المهارات البنية جاهزة — ${TOTAL_STARS} نجمة متاحة.`);
  }

  init();
})();
