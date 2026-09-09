(function () {
"use strict";

var header = document.getElementById("siteHeader");
var navToggle = document.getElementById("navToggle");
var siteNav = document.getElementById("siteNav");
var toTopBtn = document.getElementById("toTop");
var toneZones = Array.prototype.slice.call(document.querySelectorAll(".hero, .panel"));
var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav-list li"));
var photoFixedBg = document.querySelector(".photo-fixed-bg");
var serviceEl = document.getElementById("service");
var root = document.documentElement;


//===============================================================
// スマホ用ナビゲーションの開閉
//===============================================================
function closeNav() {
	siteNav.classList.remove("is-open");
	navToggle.classList.remove("is-active");
	navToggle.setAttribute("aria-expanded", "false");
	document.body.classList.remove("nav-locked");
}

function openNav() {
	siteNav.classList.add("is-open");
	navToggle.classList.add("is-active");
	navToggle.setAttribute("aria-expanded", "true");
	document.body.classList.add("nav-locked");
}

if (navToggle && siteNav) {
	navToggle.addEventListener("click", function () {
		if (siteNav.classList.contains("is-open")) {
			closeNav();
		} else {
			openNav();
		}
	});

	Array.prototype.forEach.call(siteNav.querySelectorAll("a"), function (link) {
		link.addEventListener("click", closeNav);
	});

	window.addEventListener("resize", function () {
		if (window.innerWidth >= 900) closeNav();
	});
}


//===============================================================
// スクロール連動処理
// ・背景の明暗に応じて、ロゴと塩の粒の色を自動で切り替える
// ・トップへ戻るボタンの表示/非表示
// ・各コンテンツをふわっと表示
//===============================================================
var ticking = false;

/*今、画面上部(ヘッダー付近)に来ているセクションを調べ、その
  data-tone(背景の明暗)とdata-motion(塩の動き方)を返す。
  ナビの現在地(id)はヘッダー付近の早めの切り替わりでOKだが、塩の形(motion)は
  形自体が一気に変わる(粒の数も変わる)大きな見た目の変化なので、そこだけ
  画面の真ん中を基準にする事で、実際にコンテンツが視界の中心に来たタイミングに
  近づけている(例:Gallery→Contactで、輪の形がヘッダー付近だけで早く切り替わって
  不自然に見えていたのを解消)*/
function zoneAtHeader() {
	var headerH = header ? header.offsetHeight : 80;
	var probeY = window.scrollY + headerH * 0.5 + 30;
	var motionProbeY = window.scrollY + window.innerHeight * 0.5;
	var tone = "dark", motion = "fall", wash = false, id = "top";

	for (var i = 0; i < toneZones.length; i++) {
		var el = toneZones[i];
		var top = el.offsetTop;
		var bottom = top + el.offsetHeight;
		if (probeY >= top && probeY < bottom) {
			tone = el.getAttribute("data-tone") || "dark";
			wash = el.classList.contains("panel--paper");
			id = el.id;
		}
		if (motionProbeY >= top && motionProbeY < bottom) {
			motion = el.getAttribute("data-motion") || "fall";
		}
	}
	return {tone: tone, motion: motion, wash: wash, id: id};
}

/*iOS Safariはアドレスバーの出し引きでツールバーの高さが変わり、window.innerHeightは
  その変化に追従しない事がある(常に一番小さい表示エリアを基準にした値のままになりがち)。
  window.visualViewportがあればそちらを使う事で、実際に今見えている高さとズレない様にする*/
function getViewportHeight() {
	return (window.visualViewport && window.visualViewport.height) || window.innerHeight;
}

/*背景(粒の下地=wash・粒の色=tone)は、セクションの区切り線で急に切り替えるのではなく、
  「今画面に見えている各セクションの割合」に応じて連続的に混ぜる事で、
  スクロールに合わせてなめらかに背景が変わっていく様にする*/
function computeContinuousBackground() {
	var viewTop = window.scrollY;
	var viewH = getViewportHeight();
	var viewBottom = viewTop + viewH;
	var wash = 0, tone = 0;

	for (var i = 0; i < toneZones.length; i++) {
		var el = toneZones[i];
		var top = el.offsetTop;
		var bottom = top + el.offsetHeight;
		var overlap = Math.min(viewBottom, bottom) - Math.max(viewTop, top);
		if (overlap <= 0) continue;
		var frac = overlap / viewH;
		var isWash = el.classList.contains("panel--paper") ? 1 : 0;
		var isLight = (el.getAttribute("data-tone") === "light") ? 1 : 0;
		wash += isWash * frac;
		tone += isLight * frac;
	}
	return {wash: wash, tone: tone};
}

/*今いるセクションのメニュー項目の右に「・」を付ける(gliq.co.jpを参考)*/
function updateCurrentNav(id) {
	Array.prototype.forEach.call(navItems, function (li) {
		var a = li.querySelector("a");
		var isCurrent = a && a.getAttribute("href") === "#" + id;
		li.classList.toggle("is-current", isCurrent);
	});
}

function updateOnScroll() {
	var scrollY = window.scrollY;

	var zone = zoneAtHeader();
	var bg = computeContinuousBackground();
	root.classList.toggle("tone-light", zone.tone === "light");
	updateCurrentNav(zone.id);
	/*SP/タブレットでのService背景の疑似固定(iOS Safari対策)。
	  不透明度を0/1で切り替えるだけだと、画面全体が一様にフェードしてしまい、
	  実際にServiceの内容が画面のどこまで見えているかとズレて見える。
	  PCのbackground-attachment:fixedは要素の範囲でそのまま切り取られる為、
	  それと同じ見た目になるよう、Serviceの箱が画面と重なっている部分だけを
	  clip-pathで正確に切り取って見せる*/
	if (photoFixedBg && serviceEl) {
		var viewTop = window.scrollY, viewH = getViewportHeight(), viewBottom = viewTop + viewH;
		var sTop = serviceEl.offsetTop, sBottom = sTop + serviceEl.offsetHeight;
		var clipTop = Math.max(0, sTop - viewTop);
		var clipBottom = Math.max(0, viewBottom - sBottom);
		if (clipTop + clipBottom >= viewH) {
			photoFixedBg.style.clipPath = "inset(0 0 100% 0)";
		} else {
			photoFixedBg.style.clipPath = "inset(" + clipTop + "px 0 " + clipBottom + "px 0)";
		}
	}
	if (window.saltField) {
		window.saltField.setTone(bg.tone);
		window.saltField.setMode(zone.motion);
		window.saltField.setWash(bg.wash);
	}

	if (toTopBtn) toTopBtn.classList.toggle("is-visible", scrollY > 300);

	ticking = false;
}

function requestScrollUpdate() {
	if (!ticking) {
		window.requestAnimationFrame(updateOnScroll);
		ticking = true;
	}
}

window.addEventListener("scroll", requestScrollUpdate, {passive: true});
/*iOS Safariでアドレスバーの出し引きが起きた時(scrollイベントを伴わない事がある)にも、
  Serviceの背景の切り取り位置を再計算する*/
if (window.visualViewport) {
	window.visualViewport.addEventListener("resize", requestScrollUpdate);
}

window.addEventListener("load", updateOnScroll);
updateOnScroll();


//===============================================================
// コンテンツのふわっとした出現(IntersectionObserver)
//===============================================================
if ("IntersectionObserver" in window) {
	var revealTargets = document.querySelectorAll(".prose, .service-item, .movie-grid, .work-grid, .inquiry-form");
	var io = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (entry.isIntersecting) {
				entry.target.classList.add("is-in");
				io.unobserve(entry.target);
			}
		});
	}, {threshold: 0.15});
	Array.prototype.forEach.call(revealTargets, function (el) {
		el.classList.add("will-reveal");
		io.observe(el);
	});
}


//===============================================================
// トップへ戻る
//===============================================================
if (toTopBtn) {
	toTopBtn.addEventListener("click", function () {
		window.scrollTo({top: 0, behavior: "smooth"});
	});
}


//===============================================================
// お問い合わせフォーム
// FormSubmit(https://formsubmit.co/)のAJAXエンドポイントに送信し、
// ページ遷移せずにそのまま「送信完了」表示に切り替える
//===============================================================
var inquiryForm = document.getElementById("inquiryForm");
var inquiryDone = document.getElementById("inquiryDone");
var inquiryError = document.getElementById("inquiryError");
var inquiryEmail = document.getElementById("cf-email");
var inquiryEmailConfirm = document.getElementById("cf-email-confirm");
var inquiryEmailMismatch = document.getElementById("cf-email-mismatch");

if (inquiryForm) {
	var submitBtn = inquiryForm.querySelector(".field-submit");

	inquiryForm.addEventListener("submit", function (e) {
		e.preventDefault();

		if (!inquiryForm.checkValidity()) {
			inquiryForm.reportValidity();
			return;
		}

		/*メールアドレスの入力ミスを防ぐ為、確認用の2つが一致しているかをチェックする*/
		if (inquiryEmail && inquiryEmailConfirm && inquiryEmail.value !== inquiryEmailConfirm.value) {
			if (inquiryEmailMismatch) inquiryEmailMismatch.hidden = false;
			inquiryEmailConfirm.focus();
			return;
		}
		if (inquiryEmailMismatch) inquiryEmailMismatch.hidden = true;

		if (inquiryError) inquiryError.hidden = true;
		if (submitBtn) submitBtn.disabled = true;

		var ajaxAction = inquiryForm.action.replace(
			"formsubmit.co/",
			"formsubmit.co/ajax/"
		);

		fetch(ajaxAction, {
			method: "POST",
			headers: {"Accept": "application/json"},
			body: new FormData(inquiryForm)
		}).then(function (res) {
			if (!res.ok) throw new Error("send failed");
			inquiryForm.hidden = true;
			if (inquiryDone) inquiryDone.hidden = false;
		}).catch(function () {
			if (submitBtn) submitBtn.disabled = false;
			if (inquiryError) inquiryError.hidden = false;
		});
	});
}

})();
