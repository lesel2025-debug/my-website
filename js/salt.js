(function () {
"use strict";

/*=================================================================
  塩ふる粒子エンジン
  TOPは粒が自動で降り続ける事はせず、指(スマホ)やマウス(PC)でなぞった時だけ
  その場から塩がふわっと舞い上がる——「塩をふる」動きそのものをブランドの
  アニメーションにしている。
  About/Gallery/Contactでは、粒が1つの図形(オブジェクト)を形づくり、
  それ自体がゆっくり動くことで、コンテンツが切り替わったことを表現する。
    fall  : 自動では降らず、なぞった時だけ舞い上がる(TOP)
    ring  : 球体を形づくり、ゆっくり回転する(About。奥行きのある擬似3D表現)
    grid  : 格子状に並び、静かに呼吸する(Gallery)
    link  : 面が直交する2つの輪を形づくり、一緒にゆっくり回転する(Contact。擬似3D。
            自分とお客さんが繋がるイメージ)
  タッチ/マウスでの「塩をふる」インタラクションはTOP/About/Galleryで楽しめる。
  Contactだけは、フォーム操作の邪魔にならないよう反応させていない。
  背景の明暗(data-tone)に合わせて、粒の色を白⇔インクにクロスフェードする。
=================================================================*/

function SaltField(canvas) {
	this.canvas = canvas;
	this.ctx = canvas.getContext("2d");
	this.grains = [];
	this.maxGrains = 380;
	this.baseCount = 0;
	this.dpr = Math.min(window.devicePixelRatio || 1, 2);
	this.w = 0;
	this.h = 0;

	// 0 = 白い粒(暗い背景の上), 1 = 濃色の粒(明るい背景の上)
	this.tone = 0;
	this.toneTarget = 0;

	// About/Gallery/Contact(panel--paper)の様に、パネル自体に濃色の半透明背景がある
	// セクションでは、キャンバス側でも先に同系色を薄く塗っておく。こうする事で、
	// 「パネルの背景色が粒の上に重なって粒を暗く覆い隠してしまう」のを防ぎ、
	// 粒がパネルの背景色の"上"にはっきり乗って見えるようにしている。
	this.wash = 0;
	this.washTarget = 0;

	// 塩の動き方。値が変わるたびmodeVersionを進め、各粒に再初期化させる
	this.mode = "fall";
	this.modeVersion = 1;
	this.shapePoints = null;
	this.shapeCursor = 0;

	this.pointer = {x: -9999, y: -9999, active: false, lastX: -9999, lastY: -9999};

	this.resize();
	window.addEventListener("resize", this.resize.bind(this), {passive: true});

	this.bindPointer();
}

SaltField.prototype.resize = function () {
	this.dpr = Math.min(window.devicePixelRatio || 1, 2);
	this.w = window.innerWidth;
	this.h = window.innerHeight;
	this.canvas.width = Math.round(this.w * this.dpr);
	this.canvas.height = Math.round(this.h * this.dpr);
	this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

	var target = Math.round((this.w * this.h) / 7200);
	this.baseCount = Math.max(60, Math.min(220, target));

	if (this.mode) {
		this.buildShapePoints();
		this.modeVersion++;	/*画面サイズが変わったら図形の点数を合わせて作り直す*/
	}

	while (this.grains.length < this.targetCount()) {
		this.grains.push(this.makeGrain(true));
	}
	if (this.grains.length > this.maxGrains) {
		this.grains.length = this.maxGrains;
	}
};

SaltField.prototype.makeGrain = function (randomY) {
	return {
		x: Math.random() * this.w,
		y: randomY ? Math.random() * this.h : -8,
		r: 0.7 + Math.random() * 1.6,
		vy: 6 + Math.random() * 14,
		vx: (Math.random() - 0.5) * 4,
		sway: Math.random() * Math.PI * 2,
		swaySpeed: 0.6 + Math.random() * 0.8,
		alpha: 0.3 + Math.random() * 0.45,
		twinklePhase: Math.random() * Math.PI * 2,
		life: 1,
		ambient: true,
		modeVersion: -1	/*-1にしておくと次のupdateで必ず現在のmode用に初期化される*/
	};
};

/*=================================================================
  図形ジェネレーター
  About/Gallery/Contact用に、正規化座標(-1〜1、中心が原点)の点群を作る。
=================================================================*/

/*球体(About)。フィボナッチ球状分布で、表面にまんべんなく点を置く(x,y,zの3次元)*/
function genSphere3D(n) {
	var pts = [];
	var ga = Math.PI * (3 - Math.sqrt(5));
	for (var i = 0; i < n; i++) {
		var y = 1 - (i / Math.max(1, n - 1)) * 2;
		var r = Math.sqrt(Math.max(0, 1 - y * y));
		var phi = i * ga;
		pts.push({x: Math.cos(phi) * r, y: y, z: Math.sin(phi) * r});
	}
	return pts;
}

/*格子(Gallery)*/
function genGridPoints(n) {
	var cols = Math.max(2, Math.round(Math.sqrt(n * 1.3)));
	var rows = Math.max(2, Math.ceil(n / cols));
	var pts = [];
	for (var i = 0; i < n; i++) {
		var col = i % cols, row = Math.floor(i / cols);
		pts.push({
			x: (cols === 1 ? 0 : (col / (cols - 1)) * 2 - 1),
			y: (rows === 1 ? 0 : (row / (rows - 1)) * 2 - 1)
		});
	}
	return pts;
}

/*つながる2つの輪(Contact)の共通パラメータ。輪の形自体(傾き・重なり具合)は
  時間が経っても変えず、その輪の上を粒がまわる速さだけを輪ごとに変える事で、
  常に交差したまま2つの輪がそれぞれ独立して回っているように見せる
  (stepAmbientGrainのlink分岐で使う)*/
var LINK_R = 0.56;			/*輪の半径*/
var LINK_D = 0.12;			/*輪同士の中心のずれ(Rよりだいぶ小さいので、常に重なり合う)*/
var LINK_TILT = Math.PI / 3;	/*輪を内向きに傾ける角度(60度)*/
var LINK_COS_T = Math.cos(LINK_TILT);
var LINK_SIN_T = Math.sin(LINK_TILT);
var LINK_Z0 = 0.16;

/*つながる2つの輪(Contact)。自分とお客さんが繋がるイメージ。互いに内向きに
  傾いた輪を、輪の半径より狭い間隔で並べる事で、2つの輪が実際に重なって
  (交差して)見えるようにしている*/
function genLinkedRings3D(n) {
	var pts = [];
	var nA = Math.round(n / 2);
	var nB = n - nA;
	var i;

	// 輪A(自分):+方向に傾いた輪
	for (i = 0; i < nA; i++) {
		var a = (i / nA) * Math.PI * 2;
		pts.push({a: a, ring: 0});
	}

	// 輪B(お客さん):輪Aと逆向きに傾いた輪。輪Aと重なる位置に中心をずらす
	for (i = 0; i < nB; i++) {
		var b = (i / nB) * Math.PI * 2;
		pts.push({a: b, ring: 1});
	}

	return pts;
}

/*図形をはっきり見せたいモードでは、通常の塩の粒数より多めの点数を使う
  (参考:idealump.com「Pure CSS 3D Sphere」のような、密度の高い明確な球体オブジェクト)*/
SaltField.prototype.targetCount = function () {
	/*TOPは常に降り続ける粒をやめ、マウス/タッチでその場に舞う粒だけにする*/
	if (this.mode === "fall") return 0;
	if (this.mode === "ring") return Math.min(this.maxGrains, Math.round(this.baseCount * 1.7));
	if (this.mode === "link") return Math.min(this.maxGrains, Math.round(this.baseCount * 1.9));
	return this.baseCount;
};

/*this.modeに応じた図形の点群を、現在の粒数ぶん作り直す*/
SaltField.prototype.buildShapePoints = function () {
	var n = Math.max(24, this.targetCount());
	if (this.mode === "ring") this.shapePoints = genSphere3D(n);
	else if (this.mode === "grid") this.shapePoints = genGridPoints(n);
	else if (this.mode === "link") this.shapePoints = genLinkedRings3D(n);
	else this.shapePoints = null;
	this.shapeCursor = 0;
};

/*粒を現在のthis.modeに応じて初期化する(モードが切り替わった時、既存の粒にも反映する為)*/
SaltField.prototype.initGrainForMode = function (g) {
	if (this.shapePoints) {
		g.shapeIdx = this.shapeCursor % this.shapePoints.length;
		this.shapeCursor++;
		g.jitterX = (Math.random() - 0.5) * 10;
		g.jitterY = (Math.random() - 0.5) * 10;
		g.jitterPhase = Math.random() * Math.PI * 2;
		g.depthScale = 1;
		g.depthZ = 0;
		if (this.mode === "ring") {
			g.r = 0.9 + Math.random() * 1.3;
			g.alpha = 0.45 + Math.random() * 0.4;
		} else if (this.mode === "link") {
			/*Contactはフォームを目立たせたいので、他より少しだけ控えめにしている*/
			g.r = 1.0 + Math.random() * 1.5;
			g.alpha = 0.32 + Math.random() * 0.32;
		}
	} else { // "fall"
		g.vy = 6 + Math.random() * 14;
		g.vx = (Math.random() - 0.5) * 4;
		g.sway = Math.random() * Math.PI * 2;
		g.swaySpeed = 0.6 + Math.random() * 0.8;
		g.depthScale = 1;
		g.depthZ = 0;
	}
	g.modeVersion = this.modeVersion;
};

/*図形の中心・大きさを画面サイズから決める(セクションによって少し縦位置を変える)*/
SaltField.prototype.shapeStage = function () {
	var size = Math.min(this.w, this.h) * (this.mode === "grid" ? 0.36 : 0.32);
	return {cx: this.w * 0.5, cy: this.h * 0.44, size: size};
};

/*3D点群(球体・矢印の板)を回転させ、簡易パースをかけて2Dに投影する共通処理。
  z(奥行き)に応じて大きさ・不透明度を変え、奥にあるほど小さく薄く見せることで
  立体感を出している*/
SaltField.prototype.projectShape3D = function (g, p, t, speed, tilt) {
	var stage = this.shapeStage();
	var rot = t * speed;

	// Y軸回転(左右にくるくる回る)
	var x1 = p.x * Math.cos(rot) + p.z * Math.sin(rot);
	var z1 = -p.x * Math.sin(rot) + p.z * Math.cos(rot);
	var y1 = p.y;

	// 少し見下ろす角度に固定で傾けて、球らしさ/奥行きを出す
	var y2 = y1 * Math.cos(tilt) - z1 * Math.sin(tilt);
	var z2 = y1 * Math.sin(tilt) + z1 * Math.cos(tilt);

	var focal = 2.6;
	var scale = focal / (focal + z2);

	g.x = stage.cx + x1 * scale * stage.size + g.jitterX * 0.3;
	g.y = stage.cy + y2 * scale * stage.size + g.jitterY * 0.3;
	g.depthScale = scale;
	g.depthZ = z2;
};

/*現在のthis.modeに沿って、粒を1フレーム分動かす*/
SaltField.prototype.stepAmbientGrain = function (g, dt, t) {
	if (this.mode === "ring") {
		var sp = this.shapePoints[g.shapeIdx % this.shapePoints.length];
		this.projectShape3D(g, sp, t, 0.22, 0.4);
		return;
	}

	if (this.mode === "link") {
		var lp = this.shapePoints[g.shapeIdx % this.shapePoints.length];
		/*輪ごとに自分の中心を軸にした独立回転を加える事で、輪自体の傾き・重なり具合が
		  時間とともに変化する(逆向き・別速度で回すので、2つの輪が独立して動いているのが
		  分かりやすい)*/
		var sign = lp.ring === 0 ? 1 : -1;
		var cx = lp.ring === 0 ? -LINK_D : LINK_D;
		var cz = lp.ring === 0 ? LINK_Z0 : -LINK_Z0;
		var cosA = Math.cos(lp.a) * LINK_R;
		var lx0 = cosA * LINK_COS_T;
		var lz0 = sign * cosA * LINK_SIN_T;
		var spin = t * (lp.ring === 0 ? 0.35 : -0.27);
		var cosS = Math.cos(spin), sinS = Math.sin(spin);
		var rp = {
			x: cx + (lx0 * cosS + lz0 * sinS),
			y: Math.sin(lp.a) * LINK_R,
			z: cz + (-lx0 * sinS + lz0 * cosS)
		};
		this.projectShape3D(g, rp, t, 0.24, 0.34);	/*2つの輪が一緒にゆっくり回転する(共通の周回)*/
		return;
	}

	if (this.mode === "grid") {
		var pt = this.shapePoints[g.shapeIdx % this.shapePoints.length];
		var stage = this.shapeStage();
		var breathe = 1 + Math.sin(t * 0.5) * 0.06;
		var sway = Math.sin(t * 0.18) * 0.18;
		var gx = pt.x * breathe, gy = pt.y * breathe;
		var x = gx * Math.cos(sway) - gy * Math.sin(sway);
		var y = gx * Math.sin(sway) + gy * Math.cos(sway);
		g.x = stage.cx + x * stage.size + g.jitterX * 0.4 + Math.sin(t * 1.4 + g.jitterPhase) * 2;
		g.y = stage.cy + y * stage.size + g.jitterY * 0.4 + Math.cos(t * 1.3 + g.jitterPhase) * 2;
		return;
	}

	// "fall"
	g.y += g.vy * dt;
	g.sway += g.swaySpeed * dt;
	g.x += (g.vx + Math.sin(g.sway) * 10) * dt;
	if (g.y > this.h + 8) {g.y = -8;g.x = Math.random() * this.w;}
};

/*指/マウスの位置から塩を数粒まき散らす*/
SaltField.prototype.sprinkle = function (x, y, count) {
	for (var i = 0; i < count; i++) {
		var g = {
			x: x + (Math.random() * 20 - 10),
			y: y + (Math.random() * 10 - 12),
			r: 0.9 + Math.random() * 1.7,
			vy: 14 + Math.random() * 22,
			vx: (Math.random() - 0.5) * 40,
			sway: Math.random() * Math.PI * 2,
			swaySpeed: 1 + Math.random() * 1.2,
			alpha: 0.35 + Math.random() * 0.45,
			twinklePhase: Math.random() * Math.PI * 2,
			life: 1,
			ambient: false
		};
		this.grains.push(g);
	}
	if (this.grains.length > this.maxGrains) {
		this.grains.splice(0, this.grains.length - this.maxGrains);
	}
};

SaltField.prototype.bindPointer = function () {
	var self = this;

	function sprinkleFromMove(x, y) {
		var p = self.pointer;
		var dx = x - p.lastX, dy = y - p.lastY;
		var dist = Math.sqrt(dx * dx + dy * dy);
		p.lastX = x; p.lastY = y;
		if (self.mode === "link") return;	/*Contactはフォーム操作の邪魔にならないよう反応させない*/
		if (dist > 4 || !p.active) {
			self.sprinkle(x, y, dist > 40 ? 3 : 2);
		}
		p.x = x; p.y = y; p.active = true;
	}

	window.addEventListener("mousemove", function (e) {
		sprinkleFromMove(e.clientX, e.clientY);
	}, {passive: true});

	window.addEventListener("mouseleave", function () {
		self.pointer.active = false;
	});

	window.addEventListener("touchstart", function (e) {
		var t = e.touches[0];
		if (!t) return;
		self.pointer.lastX = t.clientX;
		self.pointer.lastY = t.clientY;
		if (self.mode !== "link") self.sprinkle(t.clientX, t.clientY, 10);
		self.pointer.active = true;
	}, {passive: true});

	window.addEventListener("touchmove", function (e) {
		var t = e.touches[0];
		if (!t) return;
		sprinkleFromMove(t.clientX, t.clientY);
	}, {passive: true});

	window.addEventListener("touchend", function () {
		self.pointer.active = false;
	}, {passive: true});
};

SaltField.prototype.setTone = function (tone) {
	this.toneTarget = tone;
};

/*パネル自体の背景色を薄くする代わりに、キャンバスの粒より下の層に同系色を
  塗っておくかどうか。onの間はdraw()内で粒を描く前にfillRectする*/
SaltField.prototype.setWash = function (on) {
	this.washTarget = on ? 1 : 0;
};

/*塩の動き方を切り替える。値が変わった時だけ、図形を作り直し、既存の粒に
  再初期化の合図(modeVersion)を出す*/
SaltField.prototype.setMode = function (mode) {
	if (mode === this.mode) return;
	this.mode = mode;
	this.buildShapePoints();
	this.modeVersion++;
};

SaltField.prototype.update = function (dt, t) {
	this.tone += (this.toneTarget - this.tone) * Math.min(1, dt * 2.2);
	this.wash += (this.washTarget - this.wash) * Math.min(1, dt * 2.2);

	var next = [];
	for (var i = 0; i < this.grains.length; i++) {
		var g = this.grains[i];

		if (g.ambient) {
			if (this.mode === "fall") continue;	/*自動で降る粒はTOPでは持たない*/
			if (g.modeVersion !== this.modeVersion) this.initGrainForMode(g);
			this.stepAmbientGrain(g, dt, t);
		} else {
			g.y += g.vy * dt;
			g.sway += g.swaySpeed * dt;
			g.x += (g.vx + Math.sin(g.sway) * 10) * dt;
			g.vy += 24 * dt;
			g.vx *= (1 - Math.min(1, dt * 1.4));
			if (g.y > this.h + 8) continue;
		}

		if (g.x < -12) g.x = this.w + 12;
		if (g.x > this.w + 12) g.x = -12;

		next.push(g);
	}
	while (next.length < this.targetCount()) {
		next.push(this.makeGrain(false));
	}
	this.grains = next;
};

SaltField.prototype.draw = function (t) {
	var ctx = this.ctx;
	ctx.clearRect(0, 0, this.w, this.h);

	var darkC = "56,53,47";
	var lightC = "255,255,255";

	/*panel--paperセクションでは、粒がパネル自体の背景色に埋もれないよう、
	  粒を描く前に同系色を薄く敷いておく(粒は常にこの上に描かれるので隠れない)。
	  色はTOPの動画のトーンに合わせたグラデーション(#acafb1→#c1c4c6を、視認性の為に
	  少し濃くした色。全セクション共通でこの一枚のcanvasが背景を塗るので、
	  Contactを含め毎回同じグラデーションになる)。*/
	if (this.wash > 0.01) {
		if (this.tone > 0.5) {
			ctx.fillStyle = "rgba(244,242,238," + (0.5 * this.wash) + ")";
			ctx.fillRect(0, 0, this.w, this.h);
		} else {
			var washGrad = ctx.createLinearGradient(0, 0, this.w, this.h);
			washGrad.addColorStop(0, "rgba(80,83,85," + (0.95 * this.wash) + ")");
			washGrad.addColorStop(1, "rgba(112,115,117," + (0.85 * this.wash) + ")");
			ctx.fillStyle = washGrad;
			ctx.fillRect(0, 0, this.w, this.h);
		}
	}

	// 3D表示(ring/link)の粒は奥から手前の順に描く事で重なりが自然に見えるようにする
	var is3D = this.mode === "ring" || this.mode === "link";
	var order = this.grains;
	if (is3D) {
		order = this.grains.slice().sort(function (a, b) {
			return (a.depthZ || 0) - (b.depthZ || 0);
		});
	}

	for (var i = 0; i < order.length; i++) {
		var g = order[i];
		var depth = g.depthScale !== undefined ? g.depthScale : 1;
		var twinkle = 0.85 + 0.15 * Math.sin(t * 2.4 + g.twinklePhase);
		var a = g.alpha * twinkle * (0.45 + 0.55 * depth);	/*奥は薄く、手前は濃く*/
		var r = g.r * (0.55 + 0.45 * depth);				/*奥は小さく、手前は大きく*/
		var color = this.tone > 0.5 ? darkC : lightC;
		var mixA = this.tone > 0.5 ? (this.tone - 0.5) * 2 : (0.5 - this.tone) * 2;

		/*ring/linkは輪郭が少し見えるよう、手前の粒にだけ軽く光彩(グロー)を乗せる。
		  トンマナ(白/インク)は変えず、明るさの効果としてだけ加えている*/
		if (is3D && g.ambient) {
			ctx.shadowBlur = 2 * depth;
			ctx.shadowColor = "rgba(" + color + "," + Math.min(1, a) + ")";
		} else {
			ctx.shadowBlur = 0;
		}

		ctx.beginPath();
		ctx.fillStyle = "rgba(" + color + "," + Math.min(1, a) + ")";
		ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
		ctx.fill();
		if (mixA < 0.94) {
			var otherColor = this.tone > 0.5 ? lightC : darkC;
			ctx.beginPath();
			ctx.fillStyle = "rgba(" + otherColor + "," + Math.min(1, a * (1 - mixA)) + ")";
			ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.shadowBlur = 0;
};

function boot() {
	var canvas = document.getElementById("saltCanvas");
	if (!canvas) return;
	var field = new SaltField(canvas);
	window.saltField = field;

	var last = performance.now();
	function frame(now) {
		var dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		field.update(dt, now / 1000);
		field.draw(now / 1000);
		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", boot);
} else {
	boot();
}

})();
