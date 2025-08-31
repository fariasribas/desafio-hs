// frontfingerprint.js

// Função simples de hash (substitui XXHash para exemplo)
function hashString(str) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0; // 32-bit
	}
	return hash.toString(16);
}

// Captura do fingerprint avançado
async function getAdvancedFingerprintData() {
	const data = {
		userAgent: navigator.userAgent,
		language: navigator.language,
		platform: navigator.platform,
		screen: {
			width: window.screen.width,
			height: window.screen.height,
			colorDepth: window.screen.colorDepth,
		},
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		plugins: Array.from(navigator.plugins).map((p) => p.name),
		cookiesEnabled: navigator.cookieEnabled,
		localStorage: !!window.localStorage,
		sessionStorage: !!window.sessionStorage,
		doNotTrack: navigator.doNotTrack,
		hardwareConcurrency: navigator.hardwareConcurrency || 0,
		deviceMemory: navigator.deviceMemory || 0,
		canvas: getCanvasFingerprint(),
		fonts: getFontsViaFontFaceSet(),
		webglAdvanced: getWebGLAdvancedFingerprint(),
		mediaCapabilities: getMediaCapabilitiesFingerprint(),
		touchCapabilities: getTouchPointerFingerprint(),
		battery: await getBatteryInfo(),
		audioFingerprint: await getAudioFingerprint(),
	};

	data.testHash = hashString(JSON.stringify(data));
	return data;
}

// Canvas fingerprint (simples)
function getCanvasFingerprint() {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	ctx.textBaseline = 'top';
	ctx.font = "14px 'Arial'";
	ctx.fillStyle = '#f60';
	ctx.fillRect(125, 1, 62, 20);
	ctx.fillStyle = '#069';
	ctx.fillText('fingerprint!', 2, 15);
	ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
	ctx.fillText('fingerprint!', 4, 17);
	return canvas.toDataURL();
}

// WebGL avançado: shaders, texturas, driver info
function getWebGLAdvancedFingerprint() {
	try {
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
		if (!gl) return null;

		const ext = gl.getExtension('WEBGL_debug_renderer_info');
		const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
		const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);

		// Renderizando formas/texturas simples
		const pixels = new Uint8Array(4 * 16 * 16);
		gl.clearColor(0.1, 0.2, 0.3, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
		let sum = 0;
		for (let i = 0; i < pixels.length; i++) sum += pixels[i];

		// --- Shader test ---
		const vertexShaderSrc = `
			attribute vec4 a_position;
			void main() {
				gl_Position = a_position;
			}
		`;
		const fragmentShaderSrc = `
			precision mediump float;
			void main() {
				gl_FragColor = vec4(0.2, 0.4, 0.6, 1.0);
			}
		`;

		function compileShader(src, type) {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, src);
			gl.compileShader(shader);
			return shader;
		}

		const program = gl.createProgram();
		const vs = compileShader(vertexShaderSrc, gl.VERTEX_SHADER);
		const fs = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER);
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);
		gl.useProgram(program);

		const vertices = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

		const posLoc = gl.getAttribLocation(program, 'a_position');
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// Ler pixels do shader
		const shaderPixels = new Uint8Array(4 * 16 * 16);
		gl.readPixels(0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, shaderPixels);
		let shaderSum = 0;
		for (let i = 0; i < shaderPixels.length; i++) shaderSum += shaderPixels[i];

		return { vendor, renderer, pixelSum: sum, shaderSum };
	} catch (e) {
		return { vendor: 'unknown', renderer: 'unknown', pixelSum: 0, shaderSum: 0 };
	}
}

// FontFaceSet API
function getFontsViaFontFaceSet() {
	try {
		if (document.fonts && document.fonts.size > 0) {
			return Array.from(document.fonts).map((f) => f.family);
		}
		return null;
	} catch {
		return null;
	}
}

// MediaCapabilities API
function getMediaCapabilitiesFingerprint() {
	if (!navigator.mediaCapabilities || !navigator.mediaCapabilities.decodingInfo) return null;
	return {
		audio: navigator.mediaCapabilities.decodingInfo({
			type: 'file',
			audio: { contentType: 'audio/mp3', channels: 2, bitrate: 128000, samplerate: 44100 },
		}),
		video: navigator.mediaCapabilities.decodingInfo({
			type: 'file',
			video: { contentType: 'video/mp4', width: 1920, height: 1080, bitrate: 5000000, framerate: 30 },
		}),
	};
}

// Touch / pointer capabilities
function getTouchPointerFingerprint() {
	return {
		maxTouchPoints: navigator.maxTouchPoints || 0,
		pointerPrecision: navigator.pointerEnabled || false,
	};
}

// Battery API
async function getBatteryInfo() {
	try {
		if (!navigator.getBattery) return null;
		const battery = await navigator.getBattery();
		return {
			level: battery.level,
			charging: battery.charging,
			chargingTime: battery.chargingTime,
			dischargingTime: battery.dischargingTime,
		};
	} catch {
		return null;
	}
}

// Audio fingerprint (não usa microfone)
async function getAudioFingerprint() {
	return new Promise((resolve) => {
		try {
			const audioCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
			const oscillator = audioCtx.createOscillator();
			oscillator.type = 'triangle';
			oscillator.frequency.value = 10000;

			const compressor = audioCtx.createDynamicsCompressor();
			oscillator.connect(compressor);
			compressor.connect(audioCtx.destination);
			oscillator.start(0);

			audioCtx
				.startRendering()
				.then((buffer) => {
					let sum = 0;
					for (let i = 0; i < buffer.length; i += 1000) {
						sum += buffer.getChannelData(0)[i];
					}
					resolve(sum.toString(16));
				})
				.catch(() => resolve('0'));
		} catch (err) {
			resolve('0');
		}
	});
}

// Gera e envia fingerprint
async function generateAndSendFingerprint() {
	const data = await getAdvancedFingerprintData();

	// Mostra na página (debug)
	const advDiv = document.getElementById('advancedInfo');
	if (advDiv) {
		advDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
	}

	// Envia pro endpoint /capture
	try {
		await fetch('/capture', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
		});
	} catch (err) {
		console.error('Erro ao enviar fingerprint:', err);
	}
}

// Executa
generateAndSendFingerprint();
