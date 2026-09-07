(function () {
"use strict";

var header = document.getElementById("siteHeader");
var navToggle = document.getElementById("navToggle");
var siteNav = document.getElementById("siteNav");
var toTopBtn = document.getElementById("toTop");
var toneZones = Array.prototype.slice.call(document.querySelectorAll(".hero, .panel"));
var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav-list li"));
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
  data-tone(背景の明暗)とdata-motion(塩の動き方)を返す*/
function zoneAtHeader() {
	var headerH = header ? header.offsetHeight : 80;
	var probeY = window.scrollY + headerH * 0.5 + 30;
	var tone = "dark", motion = "fall", wash = false, id = "top";

	for (var i = 0; i < toneZones.length; i++) {
		var el = toneZones[i];
		var top = el.offsetTop;
		var bottom = top + el.offsetHeight;
		if (probeY >= top && probeY < bottom) {
			tone = el.getAttribute("data-tone") || "dark";
			motion = el.getAttribute("data-motion") || "fall";
			wash = el.classList.contains("panel--paper");
			id = el.id;
		}
	}
	return {tone: tone, motion: motion, wash: wash, id: id};
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
	root.classList.toggle("tone-light", zone.tone === "light");
	updateCurrentNav(zone.id);
	if (window.saltField) {
		window.saltField.setTone(zone.tone === "light" ? 1 : 0);
		window.saltField.setMode(zone.motion);
		window.saltField.setWash(zone.wash);
	}

	if (toTopBtn) toTopBtn.classList.toggle("is-visible", scrollY > 300);

	ticking = false;
}

window.addEventListener("scroll", function () {
	if (!ticking) {
		window.requestAnimationFrame(updateOnScroll);
		ticking = true;
	}
}, {passive: true});

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
// ※現在は送信先未設定の仮実装です。Formspree/Netlify Forms等、
//   送信先サービスが決まり次第、実送信処理に差し替えてください。
//===============================================================
var inquiryForm = document.getElementById("inquiryForm");
var inquiryDone = document.getElementById("inquiryDone");

if (inquiryForm) {
	inquiryForm.addEventListener("submit", function (e) {
		e.preventDefault();

		if (!inquiryForm.checkValidity()) {
			inquiryForm.reportValidity();
			return;
		}

		inquiryForm.hidden = true;
		if (inquiryDone) inquiryDone.hidden = false;
	});
}

})();
